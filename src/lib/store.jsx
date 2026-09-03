import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { db, LOCAL_MODE } from "./firebase";
import { useAuth } from "./auth";
import { readLocal, writeLocal, clearLocal, getMirrorOwner, setMirrorOwner } from "./localMirror";
import { mergeState } from "./merge";

// ─────────────────────────────────────────────────────────────
// Cloud-synced state store
//
// The whole PackPal state (trips, wardrobe, customOccasions, otdItems, …) is
// stored as ONE JSON-string blob per user in the Firestore doc state/{uid}.
// Stringifying sidesteps Firestore's nested-array / undefined limits, mirrors
// how the app already treated localStorage, and lets usePersist() keep its
// exact signature so every call site in PackPal.jsx is unchanged.
//
//  • Cloud mode  → load blob on login, then a live onSnapshot listener; edits
//    are debounced and written in a transaction. localStorage is an offline
//    mirror. Multi-device: `baseRef` remembers the last cloud state this
//    device applied or wrote; anything arriving from another device is
//    applied wholesale when we're clean, or three-way merged (see ./merge)
//    when we hold unsaved edits — and the transaction merges the same way
//    if the doc moved under us between read and write. Last-write-wins is
//    gone; no new Firestore fields were needed (the `state` string itself
//    is the version).
//  • Local mode  → pure localStorage, identical to the pre-cloud app.
// ─────────────────────────────────────────────────────────────

const StoreCtx = createContext(null);

// Firestore caps a document at 1 MiB (field names + values). The whole state
// lives in ONE doc, so we measure the serialized blob before every write and
// refuse (loudly) instead of letting setDoc fail in the dark. Headroom covers
// the field names, the timestamp and the doc path.
export const CLOUD_DOC_LIMIT = 1048576;
const CLOUD_DOC_HEADROOM = 8192;
const byteLength = (str) => (typeof TextEncoder !== "undefined" ? new TextEncoder().encode(str).length : str.length);

// The localStorage mirror helpers (key layout, read/write/clear) live in
// ./localMirror so auth.jsx can clear the mirror on sign-out without importing
// this module (which would be a circular dependency).

function StoreSplash() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FDF8F0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "3px solid rgba(193,127,89,0.2)",
          borderTopColor: "#C17F59",
        }}
        className="spin"
      />
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#9B9490", letterSpacing: ".04em" }}>
        Syncing your trips…
      </div>
    </div>
  );
}

export function StoreProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.id || null;

  const [data, setData] = useState(() => (LOCAL_MODE ? readLocal() : {}));
  const [loaded, setLoaded] = useState(LOCAL_MODE);
  const [syncState, setSyncState] = useState(LOCAL_MODE ? "local" : "idle"); // idle | saving | error | full | local
  const [sizeBytes, setSizeBytes] = useState(0); // serialized blob size at the last measure (cloud mode)
  const [lastRemoteAt, setLastRemoteAt] = useState(null); // when another device's change was last applied here

  const dataRef = useRef(data);
  dataRef.current = data;
  const loadedRef = useRef(LOCAL_MODE);
  const saveTimer = useRef(null);
  const dirtyRef = useRef(false); // true while the latest state has not reached Firestore
  const baseRef = useRef(null); // the cloud `state` string this device last applied or wrote (merge ancestor)
  const pendingJsonRef = useRef(null); // the string we are writing right now (to recognise our own echo)
  const editSeqRef = useRef(0); // bumped on every local edit; lets a write know if it is still current
  const scheduleSaveRef = useRef(null); // latest scheduleSave, for the snapshot listener

  // ── Load on login / user change (cloud mode only) ──
  useEffect(() => {
    if (LOCAL_MODE) return; // local mode is initialized synchronously above
    let active = true;
    loadedRef.current = false;
    setLoaded(false);

    let unsubscribe = null;
    (async () => {
      // The mirror belongs to exactly one account. If a different user signs in
      // on this device, drop the previous user's cache before anything can read
      // it (Onboarding offers "bring this device's trips" from these keys).
      const owner = getMirrorOwner();
      if (uid && owner && owner !== uid) clearLocal();
      const localCache = readLocal();
      if (!db || !uid) {
        if (!active) return;
        setData({});
        loadedRef.current = true;
        setLoaded(true);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "state", uid));
        if (!active) return;
        let cloud = null;
        let restoredFromMirror = false;
        let baseRaw = null;
        if (snap.exists()) {
          const raw = snap.data()?.state;
          try {
            cloud = raw ? JSON.parse(raw) : {};
          } catch {
            cloud = {};
          }
          baseRaw = raw || null;
          setSizeBytes(byteLength(raw || ""));
        } else if (getMirrorOwner() === uid && Object.keys(localCache).length > 0) {
          // The doc is gone but this device holds THIS user's mirror: never treat that
          // as a brand-new empty account (which would clobber the cloud with `{}` on
          // the next save). Keep the mirror and re-upload it on the next flush/edit.
          console.warn("[PackPal] Cloud doc missing for a returning user — keeping this device's copy.");
          cloud = localCache;
          restoredFromMirror = true;
        }
        // Returning user → cloud is source of truth. Brand-new user → empty
        // (onboarding decides what to import). The local mirror is only a
        // fallback for when the network is unavailable.
        const next = cloud ?? {};
        setData(next);
        writeLocal(next);
        setMirrorOwner(uid);
        baseRef.current = baseRaw; // null when the cloud has nothing yet
        if (restoredFromMirror) dirtyRef.current = true;
        setSyncState(restoredFromMirror ? "error" : "idle");

        // ── Live updates from other devices ──
        unsubscribe = onSnapshot(
          doc(db, "state", uid),
          (s) => {
            if (!active) return;
            if (s.metadata?.hasPendingWrites) return; // our own optimistic echo — wait for the acked one
            const raw = s.exists() ? s.data()?.state : null;
            if (raw == null) return; // doc deleted remotely: the next load's missing-doc guard handles it
            if (raw === baseRef.current || raw === pendingJsonRef.current) {
              baseRef.current = raw; // our own write coming back, or nothing new
              return;
            }
            let remote;
            try {
              remote = JSON.parse(raw);
            } catch {
              return;
            }
            let base = null;
            try {
              base = baseRef.current ? JSON.parse(baseRef.current) : null;
            } catch {
              base = null;
            }
            baseRef.current = raw;
            setSizeBytes(byteLength(raw));
            setLastRemoteAt(Date.now());
            if (!dirtyRef.current && !saveTimer.current) {
              // Nothing unsaved here → the other device's state simply becomes ours.
              setData(remote);
              writeLocal(remote);
            } else {
              // We hold unsaved edits → merge, keep them, and push the merged result.
              const merged = mergeState(base, dataRef.current, remote);
              setData(merged);
              scheduleSaveRef.current?.(merged);
            }
          },
          (e) => console.warn("[PackPal] Live sync listener error:", e?.message || e)
        );
      } catch (e) {
        console.warn("[PackPal] Cloud load failed; using offline cache:", e?.message || e);
        if (!active) return;
        setData(localCache);
        setSyncState("error");
      } finally {
        if (active) {
          loadedRef.current = true;
          setLoaded(true);
        }
      }
    })();

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [uid]);

  const tooLarge = (bytes) => bytes > CLOUD_DOC_LIMIT - CLOUD_DOC_HEADROOM;

  const pushCloud = useCallback(
    async (snapshot) => {
      if (LOCAL_MODE || !db || !uid) return true;
      const localJson = JSON.stringify(snapshot);
      setSizeBytes(byteLength(localJson));
      if (tooLarge(byteLength(localJson))) {
        // The write would be rejected anyway; say so instead of failing silently.
        console.warn(`[PackPal] State is ${byteLength(localJson)} bytes — over the Firestore document limit; cloud save skipped (kept locally).`);
        setSyncState("full");
        return false;
      }
      const seqAtStart = editSeqRef.current;
      setSyncState("saving");
      try {
        let finalJson = localJson;
        let merged = null;
        await runTransaction(db, async (tx) => {
          // Re-read inside the transaction: if another device wrote since our
          // base, merge onto it instead of overwriting. Firestore re-runs this
          // function on contention, so the merge is always against the latest.
          const cur = await tx.get(doc(db, "state", uid));
          const curRaw = cur.exists() ? cur.data()?.state : null;
          merged = null;
          finalJson = localJson;
          if (curRaw != null && curRaw !== baseRef.current) {
            let base = null;
            try {
              base = baseRef.current ? JSON.parse(baseRef.current) : null;
            } catch {
              base = null;
            }
            let remote = {};
            try {
              remote = JSON.parse(curRaw);
            } catch {
              remote = {};
            }
            merged = mergeState(base, snapshot, remote);
            finalJson = JSON.stringify(merged);
            if (tooLarge(byteLength(finalJson))) throw Object.assign(new Error("too large after merge"), { code: "pp/too-large" });
          }
          pendingJsonRef.current = finalJson;
          tx.set(doc(db, "state", uid), { state: finalJson, updatedAt: serverTimestamp() }, { merge: true });
        });
        baseRef.current = finalJson;
        setSizeBytes(byteLength(finalJson));
        if (merged) {
          setData(merged);
          writeLocal(merged);
          setLastRemoteAt(Date.now());
        }
        // Only mark clean if no local edit happened while this write was in flight.
        if (editSeqRef.current === seqAtStart) dirtyRef.current = false;
        setSyncState("idle");
        return true;
      } catch (e) {
        pendingJsonRef.current = null;
        if (e?.code === "pp/too-large") {
          console.warn("[PackPal] Merged state is over the Firestore document limit; cloud save skipped (kept locally).");
          setSyncState("full");
          return false;
        }
        console.warn("[PackPal] Cloud save failed (kept locally):", e?.message || e);
        setSyncState("error");
        return false;
      }
    },
    [uid]
  );

  const scheduleSave = useCallback(
    (snapshot) => {
      writeLocal(snapshot); // synchronous, reliable mirror
      if (LOCAL_MODE || !db || !uid) {
        setSyncState("local");
        return;
      }
      dirtyRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => pushCloud(snapshot), 800);
    },
    [uid, pushCloud]
  );

  scheduleSaveRef.current = scheduleSave;

  const setKey = useCallback(
    (key, updater, def) => {
      editSeqRef.current += 1;
      setData((prev) => {
        const current = prev[key] !== undefined ? prev[key] : def;
        const next = typeof updater === "function" ? updater(current) : updater;
        const newData = { ...prev, [key]: next };
        if (loadedRef.current) scheduleSave(newData);
        return newData;
      });
    },
    [scheduleSave]
  );

  // Push the latest state now (cancelling the debounce). Resolves true when the
  // cloud is up to date, false if the write failed — callers such as sign-out
  // use that to warn before discarding the local mirror.
  const flush = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (LOCAL_MODE || !db || !uid || !loadedRef.current) return true;
    if (!dirtyRef.current) return true;
    return pushCloud(dataRef.current);
  }, [uid, pushCloud]);

  // Flush any pending debounced save when the tab is hidden or closed.
  useEffect(() => {
    const onUnload = () => {
      flush();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    // A failed save stays "error" until the next edit — retry as soon as the
    // network is back so unsynced changes don't sit on one device.
    const onOnline = () => {
      flush();
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [flush]);

  // On unmount (sign-out) drop any pending debounced write: the account is gone,
  // so it could only fail against the rules. Account flushes before signing out.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const value = { data, setKey, ready: loaded, syncState, flush, sizeBytes, lastRemoteAt };

  return <StoreCtx.Provider value={value}>{loaded ? children : <StoreSplash />}</StoreCtx.Provider>;
}

// Drop-in replacement for the old localStorage usePersist — same signature,
// so PackPal.jsx call sites are untouched.
export function usePersist(key, def) {
  const store = useContext(StoreCtx);
  // Pin the default to its first value so an absent key returns a *stable*
  // reference across renders (call sites pass a fresh [] / {} literal each time).
  const defRef = useRef(def);
  const value = store && store.data[key] !== undefined ? store.data[key] : defRef.current;
  const setValue = useCallback(
    (updater) => {
      if (store) store.setKey(key, updater, defRef.current);
    },
    [store, key]
  );
  return [value, setValue];
}

const noopFlush = async () => true;
export function useStoreMeta() {
  const store = useContext(StoreCtx);
  return store
    ? { ready: store.ready, syncState: store.syncState, flush: store.flush, sizeBytes: store.sizeBytes, sizeLimit: CLOUD_DOC_LIMIT, lastRemoteAt: store.lastRemoteAt }
    : { ready: true, syncState: "local", flush: noopFlush, sizeBytes: 0, sizeLimit: CLOUD_DOC_LIMIT, lastRemoteAt: null };
}
