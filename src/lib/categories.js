// Category display overrides. The category *ids* (outfits, activewear,
// necessities, health, tech, toiletries, checkout) are frozen — every item in
// every trip references one — but the label and emoji shown for a category are
// Elizabeth's to change. Stored under the additive `categoryMeta` key:
//   { [categoryId]: { label?: string, icon?: string } }   ({} / null = defaults)
// resolveCategories() returns CATEGORIES with those overrides applied; every
// screen that shows a category name should render from it.
import { CATEGORIES } from "../data/taxonomy";

/** CATEGORIES with label / icon overrides applied (same order, same ids). */
export function resolveCategories(meta) {
  const m = meta && typeof meta === "object" ? meta : {};
  return CATEGORIES.map((c) => {
    const o = m[c.id];
    if (!o || typeof o !== "object") return c;
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : c.label;
    const icon = typeof o.icon === "string" && o.icon.trim() ? o.icon.trim() : c.icon;
    return label === c.label && icon === c.icon ? c : { ...c, label, icon };
  });
}

/** True when `meta` changes anything about category `id`. */
export function isCategoryOverridden(meta, id) {
  const base = CATEGORIES.find((c) => c.id === id);
  const o = meta?.[id];
  if (!base || !o) return false;
  return (!!o.label && o.label.trim() && o.label.trim() !== base.label) || (!!o.icon && o.icon.trim() && o.icon.trim() !== base.icon);
}

/**
 * setCategoryOverride(meta, id, patch) → new meta. Fields equal to the built-in
 * value are dropped, and a category with nothing left is removed, so `{}` keeps
 * meaning "all defaults".
 */
export function setCategoryOverride(meta, id, patch) {
  const base = CATEGORIES.find((c) => c.id === id);
  if (!base) return meta || {};
  const next = { ...(meta || {}) };
  const cur = { ...(next[id] || {}), ...(patch || {}) };
  const out = {};
  if (typeof cur.label === "string" && cur.label.trim() && cur.label.trim() !== base.label) out.label = cur.label.trim();
  if (typeof cur.icon === "string" && cur.icon.trim() && cur.icon.trim() !== base.icon) out.icon = cur.icon.trim();
  if (Object.keys(out).length) next[id] = out; else delete next[id];
  return next;
}

/** Emoji offered in the pickers (any emoji can still be typed). */
export const EMOJI_SUGGESTIONS = {
  trip: ["🏙️", "🏝️", "❄️", "💼", "🎪", "🌍", "🚗", "✈️", "🧳", "🎒", "🏔️", "🏕️", "🚢", "🌸", "🗼", "🎉", "🍷", "🏖️", "🎿", "🛍️", "🌴", "🗺️", "🎭", "🏨"],
  category: ["👗", "💪🏾", "⚙️", "💊", "📱", "🧴", "🚪", "🧳", "👟", "💄", "🧭", "🔌", "🧦", "🩱", "🕶️", "📚", "🎧", "🧸", "🍫", "🧼", "💍", "🧢", "🩹", "🗂️"],
};
