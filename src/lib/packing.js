import { CORE, COND_ITEMS } from "../data/catalog";
import { id } from "./utils";

// Pure domain logic for building and classifying packing lists.

// Generate a personalized list from the core catalog + conditional add-ons,
// filtered by trip type and length.
export function genList(types, days) {
  const items = [];
  const ts = Array.isArray(types) ? types : [types];
  Object.entries(CORE).forEach(([catId, sections]) => {
    if (catId === "checkout") return; // OTD items handled separately via trip.otdItems
    Object.entries(sections).forEach(([sec, arr]) => {
      arr.forEach((it) => {
        if (it.cond && !it.cond.some((t) => ts.includes(t)) && it.f < 0.5) return;
        if (it.f >= 0.3 || (days > 5 && it.f >= 0.2)) {
          items.push({ id: id(), name: it.name, category: catId, section: sec, packed: false, essential: !!it.e, ff: !!it.ff, freq: it.f, needsRefill: false, needsCharge: false });
        }
      });
    });
  });
  ts.forEach((t) => {
    if (COND_ITEMS[t]) {
      Object.entries(COND_ITEMS[t]).forEach(([sec, arr]) => {
        const cat = t === "ski" || t === "beach" ? "activewear" : "necessities";
        arr.forEach((name) => {
          items.push({ id: id(), name, category: cat, section: sec, packed: false, essential: false, ff: false, freq: 0.7, needsRefill: false, needsCharge: false });
        });
      });
    }
  });
  return items;
}

export function genTripOtd(globalOtdItems, tripTypes) {
  const ts = Array.isArray(tripTypes) ? tripTypes : [tripTypes];
  // Start with a copy of the global defaults
  const items = globalOtdItems.map(i => ({ ...i }));
  const nameSet = new Set(items.map(i => i.name.toLowerCase()));
  // Add any checkout CORE items not already in the list
  if (CORE.checkout) {
    Object.values(CORE.checkout).forEach(arr => {
      arr.forEach(it => {
        if (it.cond && !it.cond.some(t => ts.includes(t))) return;
        if (!nameSet.has(it.name.toLowerCase())) {
          items.push({ name: it.name, emoji: "📌" });
          nameSet.add(it.name.toLowerCase());
        }
      });
    });
  }
  return items;
}

/** Map a Fahrenheit temperature onto a TEMP_RANGES band id. */
export function tempToRange(f) {
  if (f >= 95) return "scorching";
  if (f >= 80) return "hot";
  if (f >= 65) return "warm";
  if (f >= 50) return "cool";
  if (f >= 32) return "cold";
  return "freezing";
}
