import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, LOCAL_MODE } from "./firebase";
import { useAuth } from "./auth";
import { readLocal, writeLocal, clearLocal, getMirrorOwner, setMirrorOwner } from "./localMirror";

// ─────────────────────────────────────────────────────────────
// Cloud-synced state store
//
// The whole PackPal state (trips, wardrobe, customOccasions, otdItems, …) is
// stored as ONE JSON-string blob per user in the Firestore doc state/{uid}.
// Stringifying sidesteps Firestore's nested-array / undefined limits, mirrors
// how the app already treated localStorage, and lets usePersist() keep its
// exact signature so every call site in PackPal.jsx is unchanged.
//
//  • Cloud mode  → load blob on login, debounced setDoc on change, localStorage
//    kept as an offline mirror.
//  • Local mode  → pure localStorage, identical to the pre-cloud app.
// ─────────────────────────────────────────────────────────────

const StoreCtx = createContext(null);

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
  const [syncState, setSyncState] = useState(LOCAL_MODE ? "local" : "idle"); // idle | saving | error | local

  const dataRef = useRef(data);
  dataRef.current = data;
  const loadedRef = useRef(LOCAL_MODE);
  const saveTimer = useRef(null);
  const dirtyRef = useRef(false); // true while the latest state has not reached Firestore

  // ── Load on login / user change (cloud mode only) ──
  useEffect(() => {
    if (LOCAL_MODE) return; // local mode is initialized synchronously above
    let active = true;
    loadedRef.current = false;
    setLoaded(false);

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
        if (snap.exists()) {
          const raw = snap.data()?.state;
          try {
            cloud = raw ? JSON.parse(raw) : {};
          } catch {
            cloud = {};
          }
        }
        // Returning user → cloud is source of truth. Brand-new user → empty
        // (onboarding decides what to import). The local mirror is only a
        // fallback for when the network is unavailable.
        const next = cloud ?? {};
        setData(next);
        writeLocal(next);
        setMirrorOwner(uid);
        setSyncState("idle");
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
    };
  }, [uid]);

  const pushCloud = useCallback(
    async (snapshot) => {
      if (LOCAL_MODE || !db || !uid) return true;
      setSyncState("saving");
      try {
        await setDoc(
          doc(db, "state", uid),
          { state: JSON.stringify(snapshot), updatedAt: serverTimestamp() },
          { merge: true }
        );
        // Only mark clean if nothing newer was scheduled while this write was in flight.
        if (dataRef.current === snapshot) dirtyRef.current = false;
        setSyncState("idle");
        return true;
      } catch (e) {
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

  const setKey = useCallback(
    (key, updater, def) => {
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
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [flush]);

  // On unmount (sign-out) drop any pending debounced write: the account is gone,
  // so it could only fail against the rules. Account flushes before signing out.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const value = { data, setKey, ready: loaded, syncState, flush };

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
    ? { ready: store.ready, syncState: store.syncState, flush: store.flush }
    : { ready: true, syncState: "local", flush: noopFlush };
}
