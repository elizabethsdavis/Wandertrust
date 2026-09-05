// Saved outfits — the closet that lives OUTSIDE any trip (Outfits batch).
//
// Persisted under the additive top-level key `savedOutfits[]`:
//   { id, name, slots, photo|null, createdAt, updatedAt, source? }
//     slots   = { [slotId]: string | string[] }  — same convention as a trip
//               occasion's `slots` ("" / missing = empty; multi slots hold arrays)
//     photo   = { url?, path?, thumb?, dataUrl? } — see lib/photos.js
//     source  = { tripId?, trip?, day?, occasion? } for outfits imported from a
//               past trip's plan
//
// A trip references them with two additive fields:
//   trip.outfitIds[]            the outfits shortlisted for that trip ("what I'm bringing")
//   occasion.outfitId           which saved outfit an occasion in trip.outfitPlan wears;
//   occasion.customized (bool)  the day's copy was tweaked after assignment
// An occasion always keeps its own `slots` copy, so the packing sync, the
// Tops/Bottoms migration and every older build keep reading exactly what they
// read before. Deleting a saved outfit never deletes anything from a trip: the
// day keeps its slots and just loses the link (detachOutfit).
//
// Pure functions, node-tested. Nothing here touches the store.
import { id as newId } from "./utils";
import { SLOT_IDS } from "../data/outfitSlots";
import { slotToSection } from "./migrations";

const clone = (o) => JSON.parse(JSON.stringify(o ?? null));
const norm = (s) => String(s || "").trim();
const lower = (s) => norm(s).toLowerCase();

/** [ [slotId, name], … ] for every filled value, multi slots flattened. */
export function slotEntries(slots) {
  const out = [];
  for (const sid of SLOT_IDS) {
    const v = slots?.[sid];
    const vals = Array.isArray(v) ? v : v ? [v] : [];
    for (const name of vals) if (norm(name)) out.push([sid, norm(name)]);
  }
  return out;
}

export const slotCount = (slots) => slotEntries(slots).length;

/** "Complete" the way the old builder counted: a top and a bottom. */
export const hasTopBottom = (slots) => !!(slots?.top && slots?.bottom);

/** Canonical key for de-duplication: same pieces (case-insensitive) → same key. */
export function slotsKey(slots) {
  return slotEntries(slots).map(([sid, n]) => `${sid}:${lower(n)}`).sort().join("|");
}

/** Tidy copy of a slots object: trims names, drops empties, keeps arrays for multi slots. */
export function cleanSlots(slots) {
  const out = {};
  for (const sid of SLOT_IDS) {
    const v = slots?.[sid];
    if (Array.isArray(v)) {
      const arr = v.map(norm).filter(Boolean);
      if (arr.length) out[sid] = arr;
    } else if (norm(v)) out[sid] = norm(v);
  }
  return out;
}

const now = () => new Date().toISOString();

/** A fresh saved-outfit record. */
export function newOutfit({ name, slots, photo = null, source } = {}) {
  const t = now();
  const rec = { id: newId(), name: norm(name) || "Untitled outfit", slots: cleanSlots(slots), photo: photo || null, createdAt: t, updatedAt: t };
  if (source) rec.source = source;
  return rec;
}

/** Update a saved outfit (name / slots / photo) and bump updatedAt. */
export function updateOutfit(outfit, patch) {
  const next = { ...outfit, ...patch, updatedAt: now() };
  if (patch.slots) next.slots = cleanSlots(patch.slots);
  if (patch.name !== undefined) next.name = norm(patch.name) || outfit.name;
  return next;
}

/** Default name for the Nth outfit on a trip. */
export const defaultOutfitName = (existing, base = "Outfit") => {
  const n = (existing || []).length + 1;
  const taken = new Set((existing || []).map((o) => lower(o.name)));
  let i = n, name = `${base} ${i}`;
  while (taken.has(lower(name))) { i += 1; name = `${base} ${i}`; }
  return name;
};

// ── trips ↔ outfits ──

/** The occasion now wears `outfit`: fresh copy of its pieces, linked, not customized. */
export function assignOutfit(occ, outfit) {
  return { ...occ, slots: clone(outfit.slots) || {}, outfitId: outfit.id, customized: false };
}

/** Remove the link but keep the pieces (used when the saved outfit is deleted). */
export function detachOutfit(occ) {
  const next = { ...occ };
  delete next.outfitId;
  delete next.customized;
  return next;
}

/** Same pieces as the saved outfit it points at? (false when unlinked) */
export function occasionMatchesOutfit(occ, outfit) {
  return !!occ?.outfitId && !!outfit && occ.outfitId === outfit.id && slotsKey(occ.slots) === slotsKey(outfit.slots);
}

/** Where a saved outfit is used: [{ tripId, destination, dayIdx, dayName, occasion, customized }]. */
export function outfitUsage(outfitId, trips) {
  const out = [];
  for (const t of trips || []) {
    (t.outfitPlan || []).forEach((day, di) => (day || []).forEach((occ) => {
      if (occ?.outfitId === outfitId) out.push({ tripId: t.id, destination: t.destination, dayIdx: di, dayName: t.outfitDayNames?.[di] || `Day ${di + 1}`, occasion: occ.label, customized: !!occ.customized });
    }));
    if ((t.outfitIds || []).includes(outfitId) && !out.some((u) => u.tripId === t.id)) out.push({ tripId: t.id, destination: t.destination, dayIdx: -1, dayName: "", occasion: "", customized: false });
  }
  return out;
}

/**
 * Forget a saved outfit everywhere in `trips`: drop it from every shortlist and
 * unlink every occasion that wore it (pieces stay). Returns { trips, changed }.
 */
export function forgetOutfitInTrips(trips, outfitId) {
  let changed = false;
  const next = (trips || []).map((t) => {
    let tChanged = false;
    let outfitIds = t.outfitIds;
    if (Array.isArray(outfitIds) && outfitIds.includes(outfitId)) { outfitIds = outfitIds.filter((x) => x !== outfitId); tChanged = true; }
    let plan = t.outfitPlan;
    if (Array.isArray(plan) && plan.some((day) => (day || []).some((o) => o?.outfitId === outfitId))) {
      plan = plan.map((day) => (day || []).map((o) => (o?.outfitId === outfitId ? detachOutfit(o) : o)));
      tChanged = true;
    }
    if (!tChanged) return t;
    changed = true;
    return { ...t, ...(outfitIds !== t.outfitIds ? { outfitIds } : {}), ...(plan !== t.outfitPlan ? { outfitPlan: plan } : {}) };
  });
  return changed ? { trips: next, changed: true } : { trips, changed: false };
}

/**
 * Push a saved outfit's current pieces to every occasion still linked to it
 * (used after "Update saved outfit"; customized days are left alone unless `force`).
 */
export function propagateOutfit(occasions, outfit, { force = false } = {}) {
  let changed = false;
  const next = (occasions || []).map((day) => (day || []).map((occ) => {
    if (occ?.outfitId !== outfit.id) return occ;
    if (occ.customized && !force) return occ;
    if (slotsKey(occ.slots) === slotsKey(outfit.slots)) return occ;
    changed = true;
    return { ...occ, slots: clone(outfit.slots) || {}, customized: false };
  }));
  return changed ? next : occasions;
}

// ── packing sync ──

/**
 * The unique pieces to pack for a trip: every occasion's slots (the plan) plus
 * every shortlisted saved outfit (you're bringing it, assigned to a day or not).
 * → [{ name, section }] with sections from slotToSection (Tops / Bottoms / …).
 */
export function collectOutfitItems(occasions, shortlistOutfits = []) {
  const uniq = new Map();
  const take = (slots) => {
    for (const [sid, name] of slotEntries(slots)) {
      const k = lower(name);
      if (!uniq.has(k)) uniq.set(k, { name, section: slotToSection(sid) });
    }
  };
  (occasions || []).forEach((day) => (day || []).forEach((occ) => take(occ?.slots)));
  (shortlistOutfits || []).forEach((o) => take(o?.slots));
  return [...uniq.values()];
}

// ── importing what past trips already hold ──

/**
 * importOutfitsFromTrips(trips, existing, { minPieces }) → { outfits, skipped }
 * One saved outfit per occasion that has at least `minPieces` pieces (default 2),
 * named "<destination> · <day> <occasion>", de-duplicated against `existing`
 * and within the import by their pieces. Newest trips first so the freshest
 * copy of a repeated outfit is the one that survives.
 */
export function importOutfitsFromTrips(trips, existing = [], { minPieces = 2 } = {}) {
  const seen = new Set((existing || []).map((o) => slotsKey(o.slots)));
  const outfits = [];
  let skipped = 0;
  const sorted = [...(trips || [])].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  for (const t of sorted) {
    (t.outfitPlan || []).forEach((day, di) => (day || []).forEach((occ) => {
      const slots = cleanSlots(occ?.slots);
      if (slotCount(slots) < minPieces) return;
      const key = slotsKey(slots);
      if (seen.has(key)) { skipped += 1; return; }
      seen.add(key);
      const dayName = t.outfitDayNames?.[di] || `Day ${di + 1}`;
      const occLabel = occ.label || "Outfit";
      outfits.push(newOutfit({
        name: `${t.destination || "Trip"} · ${dayName} ${occLabel}`.trim(),
        slots,
        source: { tripId: t.id, trip: t.destination, day: dayName, occasion: occLabel },
      }));
    }));
  }
  return { outfits, skipped };
}

/** Link imported outfits back to the occasions they came from (so the trip shows them as worn). */
export function linkImportedOutfits(trips, imported) {
  const byKey = new Map(imported.map((o) => [slotsKey(o.slots), o.id]));
  let changed = false;
  const next = (trips || []).map((t) => {
    if (!Array.isArray(t.outfitPlan)) return t;
    let tChanged = false;
    const ids = new Set(t.outfitIds || []);
    const plan = t.outfitPlan.map((day) => (day || []).map((occ) => {
      if (!occ || occ.outfitId) return occ;
      const oid = byKey.get(slotsKey(occ.slots));
      if (!oid) return occ;
      tChanged = true; ids.add(oid);
      return { ...occ, outfitId: oid, customized: false };
    }));
    if (!tChanged) return t;
    changed = true;
    return { ...t, outfitPlan: plan, outfitIds: [...ids] };
  });
  return changed ? { trips: next, changed: true } : { trips, changed: false };
}

/** Search helper for the closet / pickers. */
export function matchesQuery(outfit, q) {
  const s = lower(q);
  if (!s) return true;
  if (lower(outfit.name).includes(s)) return true;
  return slotEntries(outfit.slots).some(([, n]) => lower(n).includes(s));
}
