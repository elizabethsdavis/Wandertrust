// The localStorage mirror of the persisted PackPal state.
//
//  • Local mode → this IS the store (no backend configured).
//  • Cloud mode → an offline read cache of the signed-in user's Firestore blob.
//
// Key layout (frozen — see HANDOFF.md): one `pp2_<key>` entry per usePersist key,
// plus `pp2_owner`, the uid the cached data belongs to (absent for local-mode /
// pre-cloud data so onboarding can still offer to import it).

export const LS_PREFIX = "pp2_";
const OWNER_KEY = LS_PREFIX + "owner";

// Every usePersist key. readLocal() only restores keys listed here, so a new
// key MUST be added or it silently drops out of the offline / local-mode mirror.
export const KNOWN_KEYS = ["trips", "wardrobe", "customOccasions", "otdItems", "catalogTemplate", "wardrobeMeta", "addins", "categoryMeta"];

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

export function writeLocal(data) {
  for (const k of Object.keys(data || {})) {
    try {
      localStorage.setItem(LS_PREFIX + k, JSON.stringify(data[k]));
    } catch {
      /* ignore */
    }
  }
}

/** Wipe the mirror (all known keys + owner). Used on sign-out and when a
 *  different account signs in on this device. */
export function clearLocal() {
  for (const k of [...KNOWN_KEYS, "owner"]) {
    try {
      localStorage.removeItem(LS_PREFIX + k);
    } catch {
      /* ignore */
    }
  }
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
