// Three-way merge of the persisted PackPal state — how two devices editing at
// the same time converge without either overwriting the other.
//
//   base   = the last cloud state this device applied or wrote (common ancestor)
//   local  = this device's current state (may have unsaved edits)
//   remote = what the cloud holds now (another device's writes)
//
// The rule at every level is the classic one: the side that didn't change
// yields to the side that did; if both changed, go one level deeper and merge
// by identity (trip id, item id, slot name, …). At the leaves, when both sides
// changed the same value, LOCAL wins — the person holding this device is the
// one looking at it. A record deleted on one side stays deleted unless the
// other side changed it meanwhile (then the edit survives).
//
// Pure, synchronous, no imports, never mutates its inputs. The persisted shape
// is untouched: everything here is keyed by fields the data already has.

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Field-level three-way merge of two plain objects. `deep(key)` may return a
 * merge function used when BOTH sides changed that key; otherwise local wins.
 */
function mergeFields(base, local, remote, deep = () => undefined) {
  const b = base || {}, l = local || {}, r = remote || {};
  const out = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
    const inL = k in l, inR = k in r, inB = k in b;
    if (inL && !inR) {                                   // missing remotely
      if (inB && same(l[k], b[k])) continue;             //   → they deleted it, we didn't touch it: drop
      out[k] = l[k]; continue;                           //   → we added or changed it: keep
    }
    if (inR && !inL) {                                   // missing locally
      if (inB && same(r[k], b[k])) continue;             //   → we deleted it, they didn't touch it: drop
      out[k] = r[k]; continue;                           //   → they added or changed it: take
    }
    if (same(l[k], r[k])) { out[k] = l[k]; continue; }
    if (inB && same(l[k], b[k])) { out[k] = r[k]; continue; }
    if (inB && same(r[k], b[k])) { out[k] = l[k]; continue; }
    const fn = deep(k);
    out[k] = fn ? fn(b[k], l[k], r[k]) : l[k];           // both changed → deeper merge, else local wins
  }
  return out;
}

/** Merge arrays of records by identity. Order: local order first, then remote-only additions. */
function mergeById(base, local, remote, keyOf, mergeOne) {
  const B = new Map((base || []).map((x) => [keyOf(x), x]));
  const L = new Map((local || []).map((x) => [keyOf(x), x]));
  const R = new Map((remote || []).map((x) => [keyOf(x), x]));
  const decide = (k) => {
    const b = B.get(k), l = L.get(k), r = R.get(k);
    if (l && !r) return B.has(k) ? (same(l, b) ? null : l) : l;   // deleted remotely (unless we changed it) / added locally
    if (r && !l) return B.has(k) ? (same(r, b) ? null : r) : r;   // deleted locally (unless they changed it) / added remotely
    if (same(l, r)) return l;
    if (b && same(l, b)) return r;
    if (b && same(r, b)) return l;
    return mergeOne ? mergeOne(b, l, r) : l;                        // both changed
  };
  const out = [];
  for (const k of L.keys()) { const v = decide(k); if (v) out.push(v); }
  for (const k of R.keys()) { if (!L.has(k)) { const v = decide(k); if (v) out.push(v); } }
  return out;
}

const byId = (x) => x?.id;
const byName = (x) => String(x?.name ?? "").toLowerCase();

/** Both sides changed the same trip: items by id, per-index/per-key maps field-wise. */
function mergeTrip(base, local, remote) {
  const deep = {
    items: (b, l, r) => mergeById(b, l, r, byId, (bi, li, ri) => mergeFields(bi, li, ri)),
    otdItems: (b, l, r) => mergeById(b, l, r, byName),
    otdChecked: (b, l, r) => mergeFields(b, l, r),
    dayEmojis: (b, l, r) => mergeFields(b, l, r),
    // outfitPlan is edited as a whole in the Outfit Builder; if both devices
    // re-planned outfits at the same time, the one in your hand wins.
  };
  return mergeFields(base, local, remote, (k) => deep[k]);
}

/** Wardrobe slots hold string arrays. Both changed → keep everything either side kept or added; honour deliberate removals. */
function mergeStringLists(base, local, remote) {
  const b = new Set(base || []), l = local || [], r = remote || [];
  const out = [], seen = new Set();
  const push = (v) => { if (!seen.has(v)) { seen.add(v); out.push(v); } };
  for (const v of l) if (!(b.has(v) && !r.includes(v))) push(v);   // skip what they removed
  for (const v of r) if (!(b.has(v) && !l.includes(v))) push(v);   // skip what we removed
  return out;
}

/**
 * mergeState(base, local, remote) → the merged state blob.
 * Top-level keys are merged independently; keys this code doesn't know about
 * (a newer client's) fall back to the generic field rule, so they survive.
 */
export function mergeState(base, local, remote) {
  const deep = {
    trips: (b, l, r) => mergeById(b, l, r, byId, mergeTrip),
    wardrobe: (b, l, r) => mergeFields(b, l, r, () => mergeStringLists),
    customOccasions: (b, l, r) => mergeById(b, l, r, byId),
    otdItems: (b, l, r) => mergeById(b, l, r, byName),
    catalogTemplate: (b, l, r) => (isObj(l) && isObj(r) ? mergeFields(b, l, r) : l),
  };
  return mergeFields(base, local, remote, (k) => deep[k]);
}

/** True when two state blobs serialize identically (cheap "anything changed?" check). */
export function sameState(a, b) {
  return same(a, b);
}
