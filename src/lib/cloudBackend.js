// The Firestore side of the sync engine (lib/syncEngine.js): one document per
// user, state/{uid} = { state: "<json>", updatedAt } — the frozen persisted
// shape. Everything the engine needs is three calls; keeping them here means
// the engine itself never imports Firebase and can be exercised in plain node.
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const rawOf = (snap) => {
  if (!snap.exists()) return null;
  const v = snap.data()?.state;
  return v == null ? null : String(v);
};

export function cloudBackend(uid) {
  const ref = doc(db, "state", uid);
  return {
    /** Read the doc once. Throws when the network is unavailable. */
    get: async () => {
      const snap = await getDoc(ref);
      return { exists: snap.exists(), raw: rawOf(snap) };
    },
    /** Live updates; `pending` marks a local optimistic echo (transactions never produce one). */
    subscribe: (onRaw, onError) => onSnapshot(ref, (snap) => onRaw(rawOf(snap), { pending: !!snap.metadata?.hasPendingWrites }), onError),
    /**
     * Read-merge-write in one transaction. `fn` gets the doc's current string
     * and returns the string to write (or null for nothing). Firestore re-runs
     * `fn` from a fresh read whenever the doc changed under us, so the merge
     * inside it is always against the latest version.
     */
    transact: (fn) =>
      runTransaction(db, async (tx) => {
        const cur = await tx.get(ref);
        const json = fn(rawOf(cur));
        if (json == null) return;
        tx.set(ref, { state: json, updatedAt: serverTimestamp() }, { merge: true });
      }),
  };
}
