import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { LOCAL_MODE, db } from "./firebase";
import { useAuth } from "./auth";
import { readLocal, writeLocal, mirrorAdapter } from "./localMirror";
import { cloudBackend } from "./cloudBackend";
import { createSyncEngine, CLOUD_DOC_LIMIT } from "./syncEngine";

// ─────────────────────────────────────────────────────────────
// Cloud-synced state store
//
// The whole PackPal state (trips, wardrobe, customOccasions, otdItems, …) is
// stored as ONE JSON-string blob per user in the Firestore doc state/{uid}.
// Stringifying sidesteps Firestore's nested-array / undefined limits, mirrors
// how the app already treated localStorage, and lets usePersist() keep its
// exact signature so every call site in PackPal.jsx is unchanged.
//
//  • Cloud mode  → lib/syncEngine.js owns the state: load on login, a live
//    listener, debounced serialized transactional writes with a three-way
//    merge (lib/merge.js) whenever another device wrote meanwhile, retries
//    with backoff, and a localStorage mirror that survives a kill / reload
//    with its unsaved edits. This component only mirrors the engine's data
//    into React state and exposes it. No new Firestore fields were needed
//    (the `state` string itself is the version).
//  • Local mode  → pure localStorage, identical to the pre-cloud app.
// ─────────────────────────────────────────────────────────────

export { CLOUD_DOC_LIMIT };

const StoreCtx = createContext(null);

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

const IDLE_META = { status: "idle", sizeBytes: 0, lastRemoteAt: null, dirty: false };
const LOCAL_META = { status: "local", sizeBytes: 0, lastRemoteAt: null, dirty: false };

export function StoreProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.id || null;

  const [data, setData] = useState(() => (LOCAL_MODE ? readLocal() : {}));
  const [loaded, setLoaded] = useState(LOCAL_MODE);
  const [meta, setMeta] = useState(LOCAL_MODE ? LOCAL_META : IDLE_META); // { status: idle | saving | error | full | local, sizeBytes, lastRemoteAt, dirty }
  const engineRef = useRef(null);

  // ── Cloud mode: one sync engine per signed-in user ──
  useEffect(() => {
    if (LOCAL_MODE) return;
    setLoaded(false);
    if (!db || !uid) {
      setData({});
      setMeta(IDLE_META);
      setLoaded(true);
      return;
    }
    let active = true;
    const engine = createSyncEngine({
      backend: cloudBackend(uid),
      mirror: mirrorAdapter,
      uid,
      onData: (d) => {
        if (active) setData(d);
      },
      onStatus: (m) => {
        if (active) setMeta((prev) => (prev.status === m.status && prev.sizeBytes === m.sizeBytes && prev.lastRemoteAt === m.lastRemoteAt && prev.dirty === m.dirty ? prev : m));
      },
    });
    engineRef.current = engine;
    engine
      .load()
      .catch((e) => console.warn("[PackPal] Cloud load crashed:", e?.message || e))
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
      engine.stop();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [uid]);

  const setKey = useCallback((key, updater, def) => {
    if (LOCAL_MODE) {
      setData((prev) => {
        const current = prev[key] !== undefined ? prev[key] : def;
        const next = typeof updater === "function" ? updater(current) : updater;
        const newData = { ...prev, [key]: next };
        writeLocal(newData);
        return newData;
      });
      return;
    }
    engineRef.current?.edit(key, updater, def);
  }, []);

  // Push the latest state now (cancelling the debounce). Resolves true when the
  // cloud is up to date, false if the write failed — callers such as sign-out
  // use that to warn before discarding the local mirror.
  const flush = useCallback(async () => {
    if (LOCAL_MODE) return true;
    const engine = engineRef.current;
    return engine ? engine.flush() : true;
  }, []);

  // Flush any pending debounced save when the tab is hidden or closed, and
  // retry as soon as the network is back so unsynced changes don't sit on one device.
  useEffect(() => {
    if (LOCAL_MODE) return;
    const onUnload = () => {
      flush();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
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

  const value = { data, setKey, ready: loaded, syncState: meta.status, flush, sizeBytes: meta.sizeBytes, lastRemoteAt: meta.lastRemoteAt, dirty: meta.dirty };

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
    ? { ready: store.ready, syncState: store.syncState, flush: store.flush, sizeBytes: store.sizeBytes, sizeLimit: CLOUD_DOC_LIMIT, lastRemoteAt: store.lastRemoteAt, dirty: store.dirty }
    : { ready: true, syncState: "local", flush: noopFlush, sizeBytes: 0, sizeLimit: CLOUD_DOC_LIMIT, lastRemoteAt: null, dirty: false };
}
