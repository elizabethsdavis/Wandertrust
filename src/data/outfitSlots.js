// The nine outfit slots (pure data — the Lucide icons are attached in the
// components). Slot ids are frozen: every saved outfit and every occasion in a
// trip's outfitPlan keys its `slots` by them, and lib/migrations.js maps them
// to packing-list sections (slotToSection).
//   multi  → the slot holds an array of names (necklaces, bracelets, …)
//   optional → the editor offers "Skip"
//   placeholder / typePlaceholder → hints for the editor's "Add new …" form (type field)

export const OUTFIT_SLOT_DEFS = [
  { id: "top", label: "Top", emoji: "👚", color: "#C17F59", placeholder: "e.g. Cream cashmere top, Black contour top...", typePlaceholder: "e.g. cashmere top, sports bra" },
  { id: "bottom", label: "Bottoms", emoji: "👖", color: "#7BA3C9", placeholder: "e.g. Blue Zevelyn jeans, Flowy sheer pants...", typePlaceholder: "e.g. flowy pants, jeans" },
  { id: "layer", label: "Layer / Jacket", emoji: "🧥", color: "#8B7355", optional: true, placeholder: "e.g. Black leather jacket, Cream puffer...", typePlaceholder: "e.g. leather jacket, cardigan" },
  { id: "shoes", label: "Shoes", emoji: "👟", color: "#8BA888", placeholder: "e.g. Black Doc Martens, Gold sandals...", typePlaceholder: "e.g. sandals, sneakers" },
  { id: "bag", label: "Bag / Purse", emoji: "👜", color: "#C47EAA", placeholder: "e.g. Black Longchamp, Gold clutch...", typePlaceholder: "e.g. tote, clutch" },
  { id: "necklace", label: "Necklace(s)", emoji: "📿", color: "#D4A574", optional: true, multi: true, placeholder: "e.g. Gold layered necklace, Faux diamond pendant...", typePlaceholder: "e.g. layered necklace, pendant" },
  { id: "bracelet", label: "Bracelet(s)", emoji: "💎", color: "#D4A04A", optional: true, multi: true, placeholder: "e.g. Gold cuff bracelet, Sparkly bangle...", typePlaceholder: "e.g. cuff bracelet, bangle" },
  { id: "eyewear", label: "Eyewear", emoji: "🕶️", color: "#4EADC5", optional: true, multi: true, placeholder: "e.g. Artsy Sunglasses, Gold Eyeglasses...", typePlaceholder: "e.g. sunglasses, eyeglasses" },
  { id: "hair", label: "Hair Accessory", emoji: "✨", color: "#9B8EC4", optional: true, multi: true, placeholder: "e.g. Hair clips, Headband, Scarf...", typePlaceholder: "e.g. hair clips, headband" },
];

export const SLOT_IDS = OUTFIT_SLOT_DEFS.map((s) => s.id);
export const SLOT_BY_ID = Object.fromEntries(OUTFIT_SLOT_DEFS.map((s) => [s.id, s]));
