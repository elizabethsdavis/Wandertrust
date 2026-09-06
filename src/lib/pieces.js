// Editing an existing wardrobe piece (Piece Edit batch).
//
// A piece's NAME is its identity everywhere: the slot's wardrobe array, every
// saved outfit's `slots`, every trip day's occasion `slots`, the packing items
// the outfit sync created (category "outfits", section = slotToSection(slot))
// and the `wardrobeMeta` key that holds its details. So a rename has to follow
// through all of them at once — that is what renamePiece() does, purely, over
// the four stores; the app shell applies the result with the four setters and
// the open editor patches its own drafts (OutfitBuilder / Closet).
//
// Names are compared case-insensitively (trimmed) so an older lower-case copy
// of the same piece is caught too. Renaming onto a name the slot already holds
// MERGES into that piece: the existing spelling wins and the old entry goes.
//
// Pure functions, node-tested. Nothing here touches the store.
import { slotToSection } from "./migrations";

const norm = (s) => String(s || "").trim();
const lower = (s) => norm(s).toLowerCase();
const same = (a, b) => lower(a) === lower(b);

/** One slots object with `oldName` replaced in `slotId` (same object when nothing matched). */
export function renameInSlots(slots, slotId, oldName, newName) {
  const v = slots?.[slotId];
  if (Array.isArray(v)) {
    if (!v.some((x) => same(x, oldName))) return slots;
    const seen = new Set();
    const next = v.map((x) => (same(x, oldName) ? newName : x)).filter((x) => { const k = lower(x); if (seen.has(k)) return false; seen.add(k); return true; });
    return { ...slots, [slotId]: next };
  }
  if (typeof v === "string" && v && same(v, oldName)) return { ...slots, [slotId]: newName };
  return slots;
}

/** A trip's day plan (occasions[day][i]) with the piece renamed → { occasions, days } (days = how many days changed). */
export function renameInOccasions(occasions, slotId, oldName, newName) {
  let days = 0;
  const next = (occasions || []).map((day) => {
    if (!Array.isArray(day)) return day;
    let touched = false;
    const nd = day.map((occ) => {
      if (!occ || !occ.slots) return occ;
      const slots = renameInSlots(occ.slots, slotId, oldName, newName);
      if (slots === occ.slots) return occ;
      touched = true;
      return { ...occ, slots };
    });
    if (touched) days += 1;
    return touched ? nd : day;
  });
  return days ? { occasions: next, days } : { occasions, days: 0 };
}

/** The closet with the piece renamed inside every saved outfit that wears it → { outfits, count }. */
export function renameInOutfits(savedOutfits, slotId, oldName, newName) {
  let count = 0;
  const stamp = new Date().toISOString();
  const next = (savedOutfits || []).map((o) => {
    const slots = renameInSlots(o?.slots, slotId, oldName, newName);
    if (slots === o?.slots) return o;
    count += 1;
    return { ...o, slots, updatedAt: stamp };
  });
  return count ? { outfits: next, count } : { outfits: savedOutfits, count: 0 };
}

/** Every trip's day plan AND its synced packing items renamed → { trips, days, items }. */
export function renameInTrips(trips, slotId, oldName, newName) {
  const section = slotToSection(slotId);
  let days = 0, items = 0;
  const next = (trips || []).map((t) => {
    let changed = false;
    const patch = {};
    if (Array.isArray(t?.outfitPlan)) {
      const r = renameInOccasions(t.outfitPlan, slotId, oldName, newName);
      if (r.days) { patch.outfitPlan = r.occasions; days += r.days; changed = true; }
    }
    if (Array.isArray(t?.items) && t.items.some((i) => i?.category === "outfits" && i.section === section && same(i.name, oldName))) {
      patch.items = t.items.map((i) => (i?.category === "outfits" && i.section === section && same(i.name, oldName) ? (items += 1, { ...i, name: newName }) : i));
      changed = true;
    }
    return changed ? { ...t, ...patch } : t;
  });
  return days || items ? { trips: next, days, items } : { trips, days: 0, items: 0 };
}

/**
 * The slot's wardrobe list with the piece renamed. If the slot already holds
 * `newName` (any casing, and not the entry being renamed) the two merge: the
 * existing spelling stays, the old entry goes → { wardrobe, finalName, merged }.
 */
export function renameWardrobe(wardrobe, slotId, oldName, newName) {
  const list = wardrobe?.[slotId] || [];
  const existing = list.find((x) => same(x, newName) && !same(x, oldName));
  const finalName = existing || norm(newName);
  let seen = false;
  const next = list.flatMap((x) => {
    if (same(x, oldName)) { if (existing || seen) return []; seen = true; return [finalName]; }
    return [x];
  });
  return { wardrobe: { ...(wardrobe || {}), [slotId]: next }, finalName, merged: !!existing };
}

/** wardrobeMeta with the old key gone and `entry` stored under the new name (merged over anything already there; null → no entry). */
export function renameMeta(wardrobeMeta, oldName, newName, entry) {
  const next = { ...(wardrobeMeta || {}) };
  // merging into a different existing piece keeps that piece's entry underneath the new one
  const carried = same(oldName, newName) ? {} : { ...(next[newName] || {}) };
  for (const k of Object.keys(next)) if (same(k, oldName) || same(k, newName)) delete next[k];
  const merged = { ...carried, ...(entry || {}) };
  if (Object.keys(merged).length) next[newName] = merged;
  return next;
}

/** Where a piece is used: { outfits, days, items } (saved outfits wearing it, trip days, synced packing items). */
export function pieceUsage(slotId, name, savedOutfits, trips) {
  const section = slotToSection(slotId);
  const wears = (slots) => { const v = slots?.[slotId]; return Array.isArray(v) ? v.some((x) => same(x, name)) : typeof v === "string" && same(v, name); };
  let outfits = 0, days = 0, items = 0;
  for (const o of savedOutfits || []) if (wears(o?.slots)) outfits += 1;
  for (const t of trips || []) {
    for (const day of t?.outfitPlan || []) if (Array.isArray(day) && day.some((occ) => wears(occ?.slots))) days += 1;
    for (const i of t?.items || []) if (i?.category === "outfits" && i.section === section && same(i.name, name)) items += 1;
  }
  return { outfits, days, items };
}

/**
 * renamePiece({ slotId, oldName, newName, entry, wardrobe, wardrobeMeta, savedOutfits, trips })
 *   → { wardrobe, wardrobeMeta, savedOutfits, trips, finalName, merged, counts: { outfits, days, items } }
 * `entry` is the wardrobeMeta entry to keep under the new name (null = none).
 * Same name (any casing) → only the details change; nothing else is touched.
 */
export function renamePiece({ slotId, oldName, newName, entry, wardrobe, wardrobeMeta, savedOutfits, trips }) {
  const target = norm(newName) || norm(oldName);
  if (same(target, oldName) && target === norm(oldName)) {
    return { wardrobe, wardrobeMeta: renameMeta(wardrobeMeta, oldName, target, entry), savedOutfits, trips, finalName: target, merged: false, counts: { outfits: 0, days: 0, items: 0 } };
  }
  const w = renameWardrobe(wardrobe, slotId, oldName, target);
  const finalName = w.finalName;
  const o = renameInOutfits(savedOutfits, slotId, oldName, finalName);
  const t = renameInTrips(trips, slotId, oldName, finalName);
  return {
    wardrobe: w.wardrobe,
    wardrobeMeta: renameMeta(wardrobeMeta, oldName, finalName, entry),
    savedOutfits: o.outfits,
    trips: t.trips,
    finalName,
    merged: w.merged,
    counts: { outfits: o.count, days: t.days, items: t.items },
  };
}
