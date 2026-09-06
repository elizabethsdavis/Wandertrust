// The cloud sync engine — everything about keeping ONE device's copy of the
// PackPal state in step with the Firestore blob (state/{uid}), written so it
// can run without React or Firebase (see scripts/sync-fuzz.mjs).
//
// Why this exists (Sync Fix batch). The previous store kept the "merge
// ancestor" (baseRef) and the data in separate React refs and pushed the
// snapshot captured at edit time. Three races fell out of that, and together
// they could erase an outfit that had already reached the cloud:
//   1. A write started with an older snapshot could commit AFTER a newer one
//      (a slow transaction loses contention, Firestore re-runs it, and by then
//      the ancestor had moved on to the newer write, so the re-run saw
//      "nothing changed" and overwrote it with the old snapshot).
//   2. A resumed / other tab could push a stale state after the live listener
//      had advanced the ancestor — same overwrite, no merge.
//   3. The merge then read that overwrite as "deleted remotely" everywhere.
// Plus: the localStorage mirror was thrown away on the next load, so edits
// that never got their 800 ms were gone once iOS killed the tab.
//
// The engine's rules:
//   • ONE write in flight at a time, and a write always carries the LATEST
//     local state — never a snapshot taken earlier.
//   • data and its ancestor (`base`, the cloud string this state was derived
//     from) move together. Inside the transaction the cloud is merged
//     three-way against THAT ancestor whenever it differs from the doc.
//   • A write that changes nothing is skipped (no more no-op rewrites).
//   • Failures retry with backoff while there is something to save.
//   • The mirror remembers whether it holds unsaved edits and which cloud
//     state they were built on, so a kill / reload merges them instead of
//     discarding them.
// The persisted Firestore shape is untouched: { state: "<json>", updatedAt }.
import { mergeState } from "./merge.js"; // explicit extension: scripts/sync-fuzz.mjs runs this file in plain node

// Firestore caps a document at 1 MiB (field names + values). The whole state
// lives in ONE doc, so the serialized blob is measured before every write and
// refused (loudly) instead of letting the commit fail in the dark. Headroom
// covers the field names, the timestamp and the doc path.
export const CLOUD_DOC_LIMIT = 1048576;
export const CLOUD_DOC_HEADROOM = 8192;
export const byteLength = (str) => (typeof TextEncoder !== "undefined" ? new TextEncoder().encode(str).length : str.length);
export const tooLarge = (bytes) => bytes > CLOUD_DOC_LIMIT - CLOUD_DOC_HEADROOM;

const parseOrNull = (raw) => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
};
const sameJson = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const nonEmpty = (o) => !!o && Object.keys(o).length > 0;

/**
 * createSyncEngine(options) → engine
 *
 * options.backend  { get():   Promise<{ exists, raw }>            — read the doc once (throws when offline)
 *                    subscribe(onRaw(raw | null, { pending }), onError) → unsubscribe
 *                    transact(fn(curRaw) → json | null): Promise   — fn runs once per attempt with the
 *                                                                   doc's current string; returns what
 *                                                                   to write or null to write nothing }
 * options.mirror   { read(): object, write(data), readBase(): string | null, writeBase(raw),
 *                    readPendings(): [{ id, base, data }], writePending({ base, data }), clearPending(id?),
 *                    owner(): uid | null, setOwner(uid), clear() }   — see lib/localMirror.js
 * options.uid, onData(data), onStatus({ status, sizeBytes, lastRemoteAt, dirty }), warn, debounceMs,
 * retryMs, maxRetryMs, setTimeout / clearTimeout / now (injectable for tests).
 *
 * engine: load(), edit(key, updater, def), flush() → Promise<boolean>, stop(), getData(), getStatus()
 * status: "idle" | "saving" | "error" | "full"
 */
export function createSyncEngine(options) {
  const { backend, mirror, uid } = options;
  const onData = options.onData || (() => {});
  const onStatus = options.onStatus || (() => {});
  const warn = options.warn || ((...a) => console.warn(...a));
  const debounceMs = options.debounceMs ?? 800;
  const retryMs = options.retryMs ?? 2000;
  const maxRetryMs = options.maxRetryMs ?? 60000;
  const setT = options.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const clearT = options.clearTimeout || ((t) => clearTimeout(t));
  const now = options.now || (() => Date.now());
  const trace = options.trace || null; // optional (tests): trace(event, details)

  const s = {
    data: {},
    base: null, // the cloud `state` string this data was derived from (merge ancestor); null = none yet
    dirty: false, // data holds changes that have not reached the cloud
    broken: false, // the cloud doc is unreadable: never write over it
    loaded: false,
    stopped: false,
    seq: 0, // bumped on every change to `data`
    pendingJson: null, // what the in-flight write is committing (to recognise our own echo)
    inFlight: null, // the running push, if any
    again: false, // something changed while a push was in flight → push once more when it lands
    remoteSince: false, // a remote snapshot was applied while the push was in flight
    pendingEdits: [], // edits made before load() finished (replayed on top of the loaded state)
    timer: null,
    retryTimer: null,
    retryDelay: retryMs,
    status: "idle",
    sizeBytes: 0,
    lastRemoteAt: null,
    unsubscribe: null,
  };

  const emitStatus = () => {
    if (s.stopped) return;
    onStatus({ status: s.status, sizeBytes: s.sizeBytes, lastRemoteAt: s.lastRemoteAt, dirty: s.dirty });
  };
  const setStatus = (status) => {
    s.status = status;
    emitStatus();
  };
  const setData = (data) => {
    s.data = data;
    s.seq += 1;
    if (!s.stopped) onData(data);
  };
  const persist = () => {
    try {
      mirror.write(s.data);
      mirror.writeBase(s.base);
      // While edits are unsaved this tab keeps its own copy (Safari tabs share
      // the cache above, and a clean tab would overwrite it).
      if (s.dirty) mirror.writePending({ base: s.base, data: s.data });
      else mirror.clearPending();
    } catch (e) {
      warn("[PackPal] Could not update the local mirror:", e?.message || e);
    }
  };
  // Fold every tab's unsaved edits (a killed tab's included) onto `state`.
  const adoptPendings = (pendings, state) => {
    let out = state;
    for (const p of pendings) out = mergeState(parseOrNull(p.base), p.data, out);
    return out;
  };
  const forgetPendings = (pendings) => {
    for (const p of pendings) {
      try {
        mirror.clearPending(p.id);
      } catch {
        /* ignore */
      }
    }
  };

  // ── load ──
  async function load() {
    // The mirror belongs to exactly one account: a different user signing in on
    // this device must never see (or upload) the previous user's cache.
    const owner = mirror.owner();
    if (uid && owner && owner !== uid) mirror.clear();
    const mine = mirror.owner() === uid;
    const local = mine ? mirror.read() : {};
    const localBase = mine ? mirror.readBase() : null;
    const pendings = mine ? mirror.readPendings() : [];

    let got;
    try {
      got = await backend.get();
    } catch (e) {
      warn("[PackPal] Cloud load failed; using offline cache:", e?.message || e);
      if (s.stopped) return;
      s.data = adoptPendings(pendings, local);
      s.base = localBase || null;
      s.dirty = pendings.length > 0 && nonEmpty(s.data);
      s.loaded = true;
      s.status = "error";
      replayPendingEdits();
      persist();
      forgetPendings(pendings);
      onData(s.data);
      emitStatus();
      subscribe(); // it will catch up as soon as the network is back
      if (s.dirty) scheduleRetry();
      return;
    }
    if (s.stopped) return;
    const raw = got?.exists && got.raw ? String(got.raw) : null;
    if (got?.exists && raw) {
      const remote = parseOrNull(raw);
      if (!remote) {
        // Unreadable cloud state: keep what this device has, refuse to write.
        warn("[PackPal] The cloud copy is unreadable; edits stay on this device until it is repaired.");
        s.broken = true;
        s.data = adoptPendings(pendings, local);
        s.base = raw;
        s.dirty = pendings.length > 0; // adopted edits stay in this tab's pending copy until the doc is readable again
      } else if (pendings.length > 0) {
        // A tab on this device was closed or killed with unsaved edits: keep them,
        // merged onto whatever the cloud holds now (the old store threw them away).
        const merged = adoptPendings(pendings, remote);
        s.data = merged;
        s.base = raw;
        s.dirty = !sameJson(merged, remote);
        if (s.dirty) warn("[PackPal] Restored unsaved edits from this device and merged them with the cloud copy.");
      } else {
        // Returning user → the cloud is the source of truth.
        s.data = remote;
        s.base = raw;
        s.dirty = false;
      }
      s.sizeBytes = byteLength(raw);
    } else if (mine && nonEmpty(local)) {
      // The doc is gone (or empty) but this device holds THIS user's mirror: never treat
      // that as a brand-new empty account (which would clobber the cloud with `{}`).
      // Re-upload the mirror right away.
      warn("[PackPal] Cloud doc missing for a returning user — keeping this device's copy.");
      s.data = adoptPendings(pendings, local);
      s.base = null;
      s.dirty = true;
    } else {
      // Brand-new user → empty (onboarding decides what to import).
      s.data = {};
      s.base = null;
      s.dirty = false;
    }
    mirror.setOwner(uid);
    s.loaded = true;
    s.status = s.broken ? "error" : "idle";
    replayPendingEdits();
    persist(); // (writes this tab's own pending entry when dirty — before the adopted ones go)
    forgetPendings(pendings);
    onData(s.data);
    emitStatus();
    subscribe();
    if (s.dirty && !s.broken) schedule(0);
  }

  // ── live updates from other devices ──
  function subscribe() {
    if (s.unsubscribe || s.stopped) return;
    s.unsubscribe = backend.subscribe(onRemote, (e) => warn("[PackPal] Live sync listener error:", e?.message || e));
  }
  function onRemote(raw, meta) {
    if (s.stopped) return;
    if (meta?.pending) return; // an optimistic local echo — wait for the acked one
    if (raw == null) return; // doc deleted remotely: the next load's missing-doc guard handles it
    if (raw === s.base || raw === s.pendingJson) {
      s.base = raw; // our own write coming back, or nothing new
      return;
    }
    const remote = parseOrNull(raw);
    if (!remote) {
      warn("[PackPal] Ignoring an unreadable cloud update.");
      return;
    }
    trace?.("remote", { dirty: s.dirty, inFlight: !!s.inFlight });
    const base = parseOrNull(s.base);
    s.base = raw;
    s.pendingJson = null; // a newer version than anything we wrote
    s.sizeBytes = byteLength(raw);
    s.lastRemoteAt = now();
    s.remoteSince = true;
    if (s.broken) s.broken = false; // repaired elsewhere → back in business
    if (!s.dirty && !s.inFlight) {
      // Nothing unsaved here → the other device's state simply becomes ours.
      setData(remote);
      s.dirty = false;
    } else {
      // We hold unsaved edits → keep them on top of the remote change, then push the result.
      const merged = mergeState(base, s.data, remote);
      setData(merged);
      s.dirty = !sameJson(merged, remote);
      if (s.dirty) schedule();
    }
    persist();
    emitStatus();
  }

  // ── edits ──
  function applyEdit(key, updater, def) {
    const prev = s.data;
    const current = prev[key] !== undefined ? prev[key] : def;
    const next = typeof updater === "function" ? updater(current) : updater;
    setData({ ...prev, [key]: next });
    s.dirty = true;
  }
  function edit(key, updater, def) {
    if (!s.loaded) {
      // Nothing to edit yet (the UI is gated on load, so this is belt and braces):
      // keep it and replay it on top of whatever load() brings back.
      s.pendingEdits.push([key, updater, def]);
      return;
    }
    applyEdit(key, updater, def);
    persist();
    emitStatus();
    if (!s.broken) schedule();
  }
  function replayPendingEdits() {
    const edits = s.pendingEdits;
    s.pendingEdits = [];
    for (const [key, updater, def] of edits) applyEdit(key, updater, def);
    return edits.length > 0;
  }

  function schedule(ms = debounceMs) {
    if (s.stopped) return;
    if (s.timer) clearT(s.timer);
    s.timer = setT(() => {
      s.timer = null;
      push();
    }, ms);
  }
  function scheduleRetry() {
    if (s.stopped || s.retryTimer) return;
    s.retryTimer = setT(() => {
      s.retryTimer = null;
      if (s.dirty) push();
    }, s.retryDelay);
    s.retryDelay = Math.min(s.retryDelay * 2, maxRetryMs);
  }

  // ── the write ──
  // Serialized: a second call while one is in flight just asks for another
  // round afterwards. Resolves true when the cloud holds this device's state.
  function push() {
    if (s.stopped) return Promise.resolve(false);
    if (s.inFlight) {
      s.again = true;
      return s.inFlight;
    }
    if (!s.dirty) return Promise.resolve(true);
    if (s.broken) {
      setStatus("error");
      return Promise.resolve(false);
    }
    s.inFlight = runPush().finally(() => {
      s.inFlight = null;
      if (s.again) {
        s.again = false;
        if (s.dirty) push();
      }
    });
    return s.inFlight;
  }

  async function runPush() {
    if (s.retryTimer) {
      clearT(s.retryTimer);
      s.retryTimer = null;
    }
    // The write would be rejected anyway; say so instead of failing silently
    // (and don't spend a transaction read on it).
    const localJson = JSON.stringify(s.data);
    s.sizeBytes = byteLength(localJson);
    if (tooLarge(s.sizeBytes)) {
      warn(`[PackPal] State is ${s.sizeBytes} bytes — over the Firestore document limit; cloud save skipped (kept locally).`);
      setStatus("full");
      return false;
    }
    setStatus("saving");
    s.remoteSince = false;
    let usedData = null, seqUsed = -1, outData = null, outJson = null;
    try {
      await backend.transact((curRaw) => {
        // Runs once per attempt (Firestore re-runs it on contention) — always
        // from the latest local state, merged onto the doc if it moved since
        // this state's ancestor. Never from a snapshot taken earlier.
        usedData = s.data;
        seqUsed = s.seq;
        let out = usedData;
        const cur = curRaw || null;
        if (cur != null && cur !== s.base) out = mergeState(parseOrNull(s.base), usedData, parseOrNull(cur) || {});
        const json = JSON.stringify(out);
        outData = out;
        outJson = json;
        // Nothing new to write — but only when the read matches our ancestor. A read
        // that differs is written even when the merge changed nothing: the read may
        // be OLDER than what the live listener already gave us (a transaction's read
        // and a watch delivery race), and a stale read is only caught by the commit
        // failing against it, which then re-runs this with a fresh one.
        if (cur != null && json === cur && cur === s.base) return null;
        if (tooLarge(byteLength(json))) throw Object.assign(new Error("too large after merge"), { code: "pp/too-large" });
        s.pendingJson = json;
        return json;
      });
      if (s.stopped) return true;
      trace?.("pushed", { editsDuring: s.seq !== seqUsed, remoteSince: s.remoteSince, merged: outData !== usedData });
      // Landed (or nothing needed): what we wrote is our new ancestor — unless
      // a newer remote snapshot arrived meanwhile (then the listener's is).
      if (!s.remoteSince) s.base = outJson;
      s.sizeBytes = byteLength(outJson);
      if (s.seq !== seqUsed) {
        // Edits (or a remote merge) came in while the write was in flight: fold
        // what the cloud now holds into the newer local state and go again.
        setData(mergeState(usedData, s.data, outData));
        s.dirty = true;
        s.again = true;
      } else {
        if (outData !== usedData) {
          // The transaction merged remote changes into what it wrote → show them.
          setData(outData);
          s.lastRemoteAt = now();
        }
        s.dirty = false;
      }
      s.retryDelay = retryMs;
      persist();
      setStatus("idle");
      return true;
    } catch (e) {
      s.pendingJson = null;
      if (s.stopped) return false;
      if (e?.code === "pp/too-large") {
        warn("[PackPal] Merged state is over the Firestore document limit; cloud save skipped (kept locally).");
        setStatus("full");
        return false;
      }
      warn("[PackPal] Cloud save failed (kept locally):", e?.message || e);
      setStatus("error");
      scheduleRetry();
      return false;
    }
  }

  // Push the latest state now (cancelling the debounce). Resolves true when the
  // cloud is up to date, false if the write failed — callers such as sign-out
  // use that to warn before discarding the local mirror.
  async function flush() {
    if (s.timer) {
      clearT(s.timer);
      s.timer = null;
    }
    if (!s.loaded || s.stopped) return true;
    for (let i = 0; i < 3 && s.dirty; i++) {
      const ok = await push();
      if (!ok) return false;
    }
    return !s.dirty;
  }

  function stop() {
    s.stopped = true;
    if (s.timer) clearT(s.timer);
    if (s.retryTimer) clearT(s.retryTimer);
    s.timer = s.retryTimer = null;
    if (s.unsubscribe) s.unsubscribe();
    s.unsubscribe = null;
  }

  return {
    load,
    edit,
    flush,
    stop,
    getData: () => s.data,
    getStatus: () => ({ status: s.status, sizeBytes: s.sizeBytes, lastRemoteAt: s.lastRemoteAt, dirty: s.dirty }),
    /** test hook: internal state (read-only use) */
    _state: s,
  };
}
