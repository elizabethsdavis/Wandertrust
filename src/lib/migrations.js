// One-time, idempotent rewrites of persisted data, run on load (gated on the
// store being ready — see PackPal.jsx). Every rule here is backward compatible:
// it only relabels `category` / `section` strings or moves items between lists,
// never removes data, and produces the same result when run again. The persisted
// shape (HANDOFF.md) is unchanged.
//
// Pure functions, no imports — tested in node (scripts/… node checks).

/** Sections that moved from Travel Necessities into Health & Wellness. */
export const HEALTH_SECTIONS = new Set([
  "Hydration", "Nutrition", "Supplement Stack", "Energy: Sleep & Wake", "Pain & Sickness", "Hygiene & Immune",
]);

/** Outfit Builder slots → packing-list sections (Tops/Bottoms split since the UX batch). */
export function slotToSection(slotId) {
  switch (slotId) {
    case "top": return "Tops";
    case "bottom": return "Bottoms";
    case "shoes": return "Shoes";
    case "bag": return "Bags & Purses";
    case "necklace":
    case "bracelet": return "Jewelry";
    case "eyewear": return "Eyewear";
    case "hair": return "Hair Accessories";
    case "layer": return "Outerwear";
    default: return "Clothing";
  }
}

const lower = (s) => String(s || "").toLowerCase();

/**
 * migrateTrip(trip, otdDefaults) → { trip, changed }
 *  1. checkout items → trip.otdItems (the original migration)
 *  2. necessities items in a Health & Wellness section → category "health"
 *  3. outfit items in the legacy "Clothing" section → "Tops" / "Bottoms", using
 *     the trip's own outfitPlan to tell which is which (unknown ones stay put)
 */
export function migrateTrip(trip, otdDefaults = []) {
  if (!trip || !Array.isArray(trip.items)) return { trip, changed: false };
  let changed = false;
  let items = trip.items;
  let otdItems = trip.otdItems;
  let otdChecked = trip.otdChecked;

  // 1. checkout → OTD
  const checkoutItems = items.filter((i) => i.category === "checkout");
  if (checkoutItems.length > 0 || !otdItems) {
    changed = true;
    const existing = otdItems ? otdItems.map((i) => ({ ...i })) : otdDefaults.map((i) => ({ ...i }));
    const nameSet = new Set(existing.map((i) => lower(i.name)));
    checkoutItems.forEach((ci) => {
      if (!nameSet.has(lower(ci.name))) {
        existing.push({ name: ci.name, emoji: "📌" });
        nameSet.add(lower(ci.name));
      }
    });
    items = items.filter((i) => i.category !== "checkout");
    otdItems = existing;
    otdChecked = otdChecked || {};
  }

  // 2. Health & Wellness relabel
  if (items.some((i) => i.category === "necessities" && HEALTH_SECTIONS.has(i.section))) {
    changed = true;
    items = items.map((i) => (i.category === "necessities" && HEALTH_SECTIONS.has(i.section) ? { ...i, category: "health" } : i));
  }

  // 3. Clothing → Tops / Bottoms (only when the outfit plan can classify the item)
  if (items.some((i) => i.category === "outfits" && i.section === "Clothing") && Array.isArray(trip.outfitPlan)) {
    const tops = new Set(), bottoms = new Set();
    for (const day of trip.outfitPlan) for (const occ of day || []) {
      const slots = occ?.slots || {};
      for (const v of [].concat(slots.top || [])) tops.add(lower(v));
      for (const v of [].concat(slots.bottom || [])) bottoms.add(lower(v));
    }
    let any = false;
    items = items.map((i) => {
      if (i.category !== "outfits" || i.section !== "Clothing") return i;
      const n = lower(i.name);
      if (tops.has(n)) { any = true; return { ...i, section: "Tops" }; }
      if (bottoms.has(n)) { any = true; return { ...i, section: "Bottoms" }; }
      return i;
    });
    if (any) changed = true;
  }

  return changed ? { trip: { ...trip, items, otdItems, otdChecked }, changed: true } : { trip, changed: false };
}

/** migrateTemplate(template) → { template, changed }: move Health & Wellness sections out of necessities. */
export function migrateTemplate(template) {
  if (!template || typeof template !== "object" || !template.necessities) return { template, changed: false };
  const moving = Object.keys(template.necessities).filter((sec) => HEALTH_SECTIONS.has(sec));
  if (moving.length === 0) return { template, changed: false };
  const necessities = { ...template.necessities };
  const health = { ...(template.health || {}) };
  for (const sec of moving) {
    if (!health[sec]) health[sec] = necessities[sec];
    delete necessities[sec];
  }
  return { template: { ...template, necessities, health }, changed: true };
}
