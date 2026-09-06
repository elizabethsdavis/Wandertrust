// The localStorage mirror of the persisted PackPal state.
//
//  • Local mode → this IS the store (no backend configured).
//  • Cloud mode → an offline read cache of the signed-in user's Firestore blob.
//
// Key layout (frozen — see HANDOFF.md): one `pp2_<key>` entry per usePersist key,
// plus `pp2_owner`, the uid the cached data belongs to (absent for local-mode /
// pre-cloud data so onboarding can still offer to import it).
// Sync Fix batch adds bookkeeping the sync engine uses to carry unsaved edits
// across a kill / reload (cloud mode only, never data keys):
//   pp2_syncBase          the cloud `state` string the cached data was last derived from
//   pp2_pending_<tab>     a tab's copy of the state while it holds edits that have not
//   pp2_pendingBase_<tab>   reached the cloud, plus the cloud string they were built on.
//                         Per tab because Safari tabs share localStorage: one tab's
//                         unsaved outfit must survive another tab rewriting the cache.
//                         Removed once the edits land; adopted (merged) by whichever
//                         tab loads next if the tab that wrote them died first.

export const LS_PREFIX = "pp2_";
const OWNER_KEY = LS_PREFIX + "owner";
const SYNC_BASE_KEY = LS_PREFIX + "syncBase";
const PENDING_PREFIX = LS_PREFIX + "pending_";
const PENDING_BASE_PREFIX = LS_PREFIX + "pendingBase_";

// This tab's id for its pending entry: kept in sessionStorage so it survives a
// reload of the same tab (the old entry is then adopted by the load anyway).
let tabId = null;
function getTabId() {
  if (tabId) return tabId;
  try {
    tabId = sessionStorage.getItem(LS_PREFIX + "tab");
    if (!tabId) {
      tabId = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(LS_PREFIX + "tab", tabId);
    }
  } catch {
    tabId = Math.random().toString(36).slice(2, 10);
  }
  return tabId;
}

// Every usePersist key. readLocal() only restores keys listed here, so a new
// key MUST be added or it silently drops out of the offline / local-mode mirror.
export const KNOWN_KEYS = ["trips", "wardrobe", "customOccasions", "otdItems", "catalogTemplate", "wardrobeMeta", "addins", "categoryMeta", "savedOutfits"];

export function readLocal() {
  const data = {};
  for (const k of KNOWN_KEYS) {
    try {
      const v = localStorage.getItem(LS_PREFIX + k);
      if (v != null) data[k] = JSON.parse(v);
    } catch {
      /* ignore */
    }
  }
  return data;
}

// Every edit rewrites the mirror. The app updates state immutably (only the
// edited key gets a new object), so a key whose value is the very same object
// we wrote last time is skipped — that keeps a 200 KB state from being
// re-serialized nine times per tap.
const lastWritten = new Map(); // key → the object last written under it
export function writeLocal(data) {
  for (const k of Object.keys(data || {})) {
    const v = data[k];
    if (lastWritten.get(k) === v && v !== undefined && typeof v === "object" && v !== null) continue;
    try {
      localStorage.setItem(LS_PREFIX + k, JSON.stringify(v));
      lastWritten.set(k, v);
    } catch {
      /* ignore */
    }
  }
}

/** The cloud string the cached data was last derived from (null when unknown / older build). */
export function readSyncBase() {
  try {
    return localStorage.getItem(SYNC_BASE_KEY);
  } catch {
    return null;
  }
}

let lastBase = undefined;
export function writeSyncBase(base) {
  if (base === lastBase) return; // the ancestor only changes when the cloud does — don't rewrite 200 KB per tap
  try {
    if (base) localStorage.setItem(SYNC_BASE_KEY, base);
    else localStorage.removeItem(SYNC_BASE_KEY);
    lastBase = base;
  } catch {
    /* ignore */
  }
}

/** Every tab's unsaved-edits entry, this tab's included: [{ id, base, data }]. */
export function readPendings() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PENDING_PREFIX)) continue;
      const id = k.slice(PENDING_PREFIX.length);
      try {
        const data = JSON.parse(localStorage.getItem(k));
        if (data && typeof data === "object") out.push({ id, base: localStorage.getItem(PENDING_BASE_PREFIX + id), data });
      } catch {
        /* a torn entry: skip it */
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

let lastPendingBase = undefined;
/** Record this tab's unsaved state (called on every edit while dirty). */
export function writePending({ base, data }) {
  const id = getTabId();
  try {
    localStorage.setItem(PENDING_PREFIX + id, JSON.stringify(data));
    if (base !== lastPendingBase) {
      if (base) localStorage.setItem(PENDING_BASE_PREFIX + id, base);
      else localStorage.removeItem(PENDING_BASE_PREFIX + id);
      lastPendingBase = base;
    }
  } catch {
    /* ignore — the cloud write is what matters */
  }
}

/** This tab's edits reached the cloud (or were adopted): drop its entry. */
export function clearPending(id = getTabId()) {
  try {
    localStorage.removeItem(PENDING_PREFIX + id);
    localStorage.removeItem(PENDING_BASE_PREFIX + id);
  } catch {
    /* ignore */
  }
  if (id === tabId) lastPendingBase = undefined;
}

/** Wipe the mirror (all known keys + owner + sync bookkeeping). Used on sign-out and when a
 *  different account signs in on this device. */
export function clearLocal() {
  for (const k of [...KNOWN_KEYS, "owner", "syncBase"]) {
    try {
      localStorage.removeItem(LS_PREFIX + k);
    } catch {
      /* ignore */
    }
  }
  for (const p of readPendings()) clearPending(p.id);
  lastWritten.clear();
  lastBase = undefined;
  lastPendingBase = undefined;
}

export function getMirrorOwner() {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function setMirrorOwner(uid) {
  try {
    if (uid) localStorage.setItem(OWNER_KEY, uid);
  } catch {
    /* ignore */
  }
}

/** The mirror as the sync engine sees it (see lib/syncEngine.js). */
export const mirrorAdapter = {
  read: readLocal,
  write: writeLocal,
  readBase: readSyncBase,
  writeBase: writeSyncBase,
  readPendings,
  writePending,
  clearPending,
  owner: getMirrorOwner,
  setOwner: setMirrorOwner,
  clear: clearLocal,
};
