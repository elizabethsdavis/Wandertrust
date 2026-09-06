// In-memory stand-in for the four `firebase/*` modules PackPal imports, so the
// CLOUD code paths (StoreProvider load/save/flush, the live listener, the
// transactional write + merge, sign-out, the size guard, the missing-doc guard)
// can be driven in a real browser without a Firebase project. Built via
// scripts/cloud-sim/vite.config.js, driven by scripts/cloud-checks.py.
// Never shipped: the alias only exists in that config.
//
// Everything is controlled through localStorage so a Playwright harness can
// steer it without reloading the module — and so two TABS share one "cloud",
// which is how the multi-device checks work:
//   __fakeUid        uid to sign in as on load (default "userA"); "" = signed out
//   __fakeDocs       JSON map of Firestore docs by "collection/id" (write-through)
//   __fakeFailWrites "1" → setDoc / transaction commit throws
//   __fakeFailReads  "1" → getDoc throws
//   __fakePausePush  "1" → listeners are not notified (simulates a stalled connection)
//   __fakeLatencyMs  N   → every read / commit takes N ms (Sync Fix batch: lets two tabs' transactions overlap)
//   __fakeWrites     JSON log of every successful write {path, bytes, at}
// Docs carry a hidden `__v` version (Sync Fix batch): a transaction whose commit
// finds the doc changed since its read is re-run from a fresh read, like Firestore.

const ls = (k, fb = null) => {
  try { const v = localStorage.getItem(k); return v == null ? fb : v; } catch { return fb; }
};
const setLs = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const loadDocs = () => { try { return JSON.parse(ls("__fakeDocs", "{}")); } catch { return {}; } };
const saveDocs = (docs) => setLs("__fakeDocs", JSON.stringify(docs));

const uid = ls("__fakeUid", "userA");
const state = {
  user: uid ? { uid, phoneNumber: "+15555550100" } : null,
  authListeners: new Set(),
  docListeners: new Map(),   // path → Set(cb)
  lastDelivered: new Map(),  // path → JSON string last delivered to listeners
};
window.__fake = state;

const visible = (d) => { if (!d) return d; const { __v, ...rest } = d; void __v; return rest; };
const snapshotOf = (path) => {
  const d = loadDocs()[path];
  return { exists: () => d !== undefined, data: () => visible(d), metadata: { hasPendingWrites: false }, __v: d?.__v || 0 };
};
const latency = () => { const ms = parseInt(ls("__fakeLatencyMs", "0"), 10) || 0; return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : null; };
const logWrite = (path, data) => {
  const log = (() => { try { return JSON.parse(ls("__fakeWrites", "[]")); } catch { return []; } })();
  log.push({ path, bytes: JSON.stringify(data).length, at: Date.now() });
  setLs("__fakeWrites", JSON.stringify(log));
};
// Deliver the current doc to its listeners if it changed since last delivery.
const notify = (path) => {
  if (ls("__fakePausePush") === "1") return;
  const cbs = state.docListeners.get(path);
  if (!cbs || cbs.size === 0) return;
  const json = JSON.stringify(loadDocs()[path] ?? null);
  if (state.lastDelivered.get(path) === json) return;
  state.lastDelivered.set(path, json);
  const snap = snapshotOf(path);
  cbs.forEach((cb) => cb(snap));
};
// Other tabs (or the harness) write to localStorage directly: poll for changes.
setInterval(() => { for (const path of state.docListeners.keys()) notify(path); }, 250);

// ── firebase/app ──
export function initializeApp() { return { fake: true }; }

// ── firebase/auth ──
const authObj = { get currentUser() { return state.user; } };
export function getAuth() { return authObj; }
export function onAuthStateChanged(_auth, cb) {
  state.authListeners.add(cb);
  setTimeout(() => cb(state.user), 0);
  return () => state.authListeners.delete(cb);
}
export async function signOut() {
  state.user = null;
  setLs("__fakeUid", "");
  state.authListeners.forEach((cb) => cb(null));
}
export class RecaptchaVerifier { constructor() {} clear() {} }
export async function signInWithPhoneNumber() {
  return { confirm: async () => { state.user = { uid: "userA", phoneNumber: "+15555550100" }; setLs("__fakeUid", "userA"); state.authListeners.forEach((cb) => cb(state.user)); } };
}
export async function signInWithCustomToken() { return {}; }

// ── firebase/firestore ──
export function getFirestore() { return { fake: true }; }
export function doc(_db, col, id) { return { path: `${col}/${id}` }; }
export async function getDoc(ref) {
  await latency();
  if (ls("__fakeFailReads") === "1") throw new Error("fake: network unavailable");
  return snapshotOf(ref.path);
}
function commit(ref, data, opts) {
  if (ls("__fakeFailWrites") === "1") throw new Error("fake: write rejected");
  const docs = loadDocs();
  const prev = docs[ref.path] || {};
  docs[ref.path] = { ...(opts?.merge ? { ...prev, ...data } : { ...data }), __v: (prev.__v || 0) + 1 };
  saveDocs(docs);
  logWrite(ref.path, data);
  notify(ref.path);
}
export async function setDoc(ref, data, opts) { await latency(); commit(ref, data, opts); }
export async function runTransaction(_db, fn) {
  for (let attempt = 1; ; attempt++) {
    const writes = [];
    const reads = new Map(); // path → version read
    const tx = {
      get: async (ref) => {
        await latency();
        if (ls("__fakeFailReads") === "1") throw new Error("fake: network unavailable");
        const snap = snapshotOf(ref.path);
        reads.set(ref.path, snap.__v);
        return snap;
      },
      set: (ref, data, opts) => { writes.push([ref, data, opts]); },
    };
    const result = await fn(tx);
    if (writes.length === 0) return result;
    await latency();
    // Firestore's rule: the commit fails if anything read changed since the read; the SDK re-runs fn (5 attempts).
    const docs = loadDocs();
    const moved = [...reads].some(([path, v]) => (docs[path]?.__v || 0) !== v);
    if (moved) {
      if (attempt >= 5) throw new Error("fake: transaction aborted — too much contention");
      continue;
    }
    for (const [ref, data, opts] of writes) commit(ref, data, opts);
    return result;
  }
}
export function onSnapshot(ref, cb, _err) {
  if (!state.docListeners.has(ref.path)) state.docListeners.set(ref.path, new Set());
  state.docListeners.get(ref.path).add(cb);
  // Firestore delivers the current document right away.
  setTimeout(() => { state.lastDelivered.set(ref.path, JSON.stringify(loadDocs()[ref.path] ?? null)); cb(snapshotOf(ref.path)); }, 0);
  return () => { state.docListeners.get(ref.path)?.delete(cb); };
}
export function serverTimestamp() { return { __serverTimestamp: true }; }

// ── firebase/functions ──
export function getFunctions() { return { fake: true }; }
export function httpsCallable() { return async () => ({ data: {} }); }

// ── firebase/storage ── (Outfits batch) uploads live in memory; the "download
// URL" is a blob: URL of the uploaded bytes, so <img> renders it in the harness.
const uploads = new Map(); // path → { blob, url }
export function getStorage() { return { fake: true }; }
export function ref(_s, path) { return { path }; }
export async function uploadBytes(r, blob) {
  if (ls("__fakeFailUploads") === "1") throw new Error("fake storage: upload failed");
  const url = URL.createObjectURL(blob);
  uploads.set(r.path, { blob, url });
  const log = (() => { try { return JSON.parse(ls("__fakeUploads", "[]")); } catch { return []; } })();
  log.push({ path: r.path, bytes: blob.size, type: blob.type, at: Date.now() });
  setLs("__fakeUploads", JSON.stringify(log));
  return { ref: r };
}
export async function getDownloadURL(r) {
  const u = uploads.get(r.path);
  if (!u) throw new Error("fake storage: object-not-found");
  return u.url;
}
export async function deleteObject(r) {
  uploads.delete(r.path);
  const log = (() => { try { return JSON.parse(ls("__fakeDeletes", "[]")); } catch { return []; } })();
  log.push({ path: r.path, at: Date.now() });
  setLs("__fakeDeletes", JSON.stringify(log));
}
