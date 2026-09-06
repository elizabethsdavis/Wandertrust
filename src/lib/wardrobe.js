// Parsing a free-text clothing name ("Blue Zevelyn jeans", "Black Doc Martens",
// "light pink satin blouse") into display metadata: colour family (with an
// optional light/dark shade and a second tone), a pattern, and a brand.
//
// Rules:
//  • Colours match WHOLE words only, anywhere in the name, longest name first —
//    so "tan" no longer matches "tank top" and "red" no longer matches "layered".
//  • ~120 fashion colour names fold into 17 families that own a swatch colour;
//    a light/dark/pale/deep… word right before a colour tints the swatch.
//  • Two colours ("black and white", "navy/cream") → primary + secondary tone.
//  • Patterns (striped, floral, leopard…) are reported separately, not as colours
//    (leopard/cheetah also implies the brown family for the swatch).
//  • Brand = the first run of Capitalized (or ALL-CAPS) words that aren't colours,
//    modifiers, patterns, materials or garment nouns. A capitalized first word
//    that is a colour ("Cream cashmere top") is a colour, not a brand. A handful
//    of known brands still match in lowercase so older names keep their chip.
//  • wardrobeMeta overrides (`color` / `brand`, set from the "Edit piece" sheet) win over parsing.
//
// Pure, no imports. Tested in node (scripts/node-checks).

export const COLOR_FAMILIES = {
  black:       { hex: "#2D2926", names: ["black", "jet", "onyx", "ebony", "noir"] },
  white:       { hex: "#F5F0EB", names: ["white", "ivory", "off white", "off-white", "eggshell", "bone", "snow", "optic white"] },
  cream:       { hex: "#F5EDE0", names: ["cream", "vanilla", "butter", "oat", "oatmeal", "ecru", "buttercream"] },
  grey:        { hex: "#9B9490", names: ["grey", "gray", "charcoal", "heather", "slate", "ash", "graphite", "pewter", "stone", "heather grey", "heather gray"] },
  brown:       { hex: "#8B7355", names: ["brown", "chocolate", "espresso", "mocha", "coffee", "cognac", "chestnut", "walnut", "leopard", "cheetah", "animal print", "tortoise", "tortoiseshell"] },
  tan:         { hex: "#C4A882", names: ["tan", "camel", "taupe", "khaki", "beige", "sand", "nude", "fawn", "biscuit", "caramel", "toffee", "latte"] },
  gold:        { hex: "#D4A04A", names: ["gold", "golden", "brass", "bronze", "champagne", "sparkly", "glitter", "sequin", "sequins", "sequined"] },
  silver:      { hex: "#A8A8A8", names: ["silver", "metallic", "chrome", "gunmetal", "platinum"] },
  "rose gold": { hex: "#C9A08B", names: ["rose gold", "rosegold", "copper", "peach"] },
  pink:        { hex: "#D4889A", names: ["pink", "blush", "rose", "fuchsia", "hot pink", "magenta", "bubblegum", "salmon", "coral", "dusty rose", "mauve", "baby pink", "light pink", "pale pink"] },
  red:         { hex: "#C75B5B", names: ["red", "burgundy", "wine", "maroon", "crimson", "cherry", "scarlet", "rust", "brick", "oxblood", "berry", "cranberry"] },
  orange:      { hex: "#E0834A", names: ["orange", "tangerine", "apricot", "terracotta", "amber", "burnt orange"] },
  yellow:      { hex: "#E3C24C", names: ["yellow", "mustard", "lemon", "canary", "marigold", "saffron"] },
  green:       { hex: "#8BA888", names: ["green", "olive", "sage", "emerald", "forest", "forest green", "mint", "army green", "moss", "lime", "pistachio", "hunter green", "jade", "kelly green", "seafoam"] },
  teal:        { hex: "#4EADC5", names: ["teal", "turquoise", "aqua", "cyan"] },
  blue:        { hex: "#7BA3C9", names: ["blue", "navy", "cobalt", "denim", "indigo", "royal blue", "sky blue", "baby blue", "powder blue", "periwinkle", "azure", "sapphire", "chambray", "light blue", "dark blue"] },
  purple:      { hex: "#9B8EC4", names: ["purple", "lavender", "lilac", "violet", "plum", "eggplant", "aubergine", "grape", "amethyst", "orchid"] },
};

const MODIFIERS = new Set(["light", "dark", "pale", "deep", "bright", "dusty", "hot", "soft", "muted", "bold", "neon", "pastel", "vintage", "washed", "faded", "warm", "cool", "rich", "baby"]);
const LIGHTEN = new Set(["light", "pale", "pastel", "soft", "baby", "washed", "faded"]);
const DARKEN = new Set(["dark", "deep", "rich"]);
export const PATTERNS = ["striped", "stripe", "stripes", "floral", "plaid", "checked", "check", "gingham", "polka dot", "polka dots", "polka", "houndstooth", "tweed", "paisley", "tie-dye", "tie dye", "camo", "camouflage", "snakeskin", "zebra", "leopard", "cheetah", "animal print", "printed", "print", "ombre", "colorblock", "colourblock", "color-block", "graphic", "embroidered", "lace"];
const MATERIALS = new Set(["cotton", "linen", "silk", "satin", "cashmere", "wool", "knit", "denim", "leather", "suede", "velvet", "chiffon", "tulle", "mesh", "fleece", "jersey", "nylon", "corduroy", "canvas", "faux", "vegan", "ribbed", "sheer", "puffer", "quilted"]);
const GARMENT_WORDS = new Set(("top tops tee tees t-shirt tshirt shirt blouse sweater cardigan jacket coat blazer trench parka vest dress gown skirt pants jeans trousers shorts leggings joggers sweatpants hoodie sweatshirt tank cami camisole bodysuit jumpsuit romper set co-ord bag purse clutch tote backpack crossbody boots bootie booties sneakers sandals heels flats loafers mules slides shoes pumps wedges espadrilles necklace necklaces bracelet bracelets earrings earring ring rings watch sunglasses glasses eyeglasses hat cap beanie scarf belt socks tights bikini swimsuit one-piece cover-up coverup robe pajamas pyjamas slippers gloves clip clips headband bonnet bra underwear bralette "
  // descriptors that start many names and are not brands (Piece Edit batch — keeps "Hair clips" / "Wide-leg trousers" from growing a brand chip)
  + "hair wide-leg wide leg high-waisted high waisted cropped crop oversized long short sleeve sleeveless mini midi maxi flowy fitted slim straight relaxed baggy boxy flare flared bootcut skinny layered chunky dainty statement artsy diamond pearl pearls crystal beaded woven straw raffia platform strappy ankle knee thigh chelsea combat hiking running training sports contour seamless compression thermal bomber moto utility cargo pleated ruched smocked wrap halter strapless off-shoulder turtleneck mock crew v-neck scoop square button-down button-up collared polo henley tunic kaftan caftan sarong kimono poncho shawl cape gilet anorak windbreaker raincoat overcoat peacoat duster shacket pendant chain cuff bangle hoop hoops studs stud claw scrunchie barrette").split(" "));
const KNOWN_BRANDS = ["zevelyn", "diarrablu", "longchamp", "doc martens", "doc marten", "gucci", "fenty", "nike", "ugg", "birkenstock", "away", "heattech", "aritzia", "lululemon", "adidas", "zara", "reformation", "skims", "levi's", "levis", "madewell", "everlane", "uniqlo", "converse", "vans", "new balance", "prada", "chanel", "coach", "dior", "hermes", "hermès", "louis vuitton", "celine", "céline", "bottega", "ganni", "sezane", "sézane"];

const allColorNames = Object.entries(COLOR_FAMILIES)
  .flatMap(([family, def]) => def.names.map((n) => ({ name: n, family })))
  .sort((a, b) => b.name.length - a.name.length); // longest first: "rose gold" before "gold"

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (phrase) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(phrase)}(?![\\p{L}\\p{N}])`, "iu");

function findPhrases(lower, phrases) {
  // returns [{ phrase, index }] in order of appearance, without overlaps (longest first wins)
  const hits = [];
  const taken = [];
  for (const p of phrases) {
    const re = new RegExp(wordRe(p).source, "giu");
    let m;
    while ((m = re.exec(lower))) {
      const [s, e] = [m.index, m.index + m[0].length];
      if (taken.some(([a, b]) => s < b && e > a)) continue;
      taken.push([s, e]);
      hits.push({ phrase: p, index: s });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

function mix(hex, target, amount) {
  const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const a = p(hex), b = p(target);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Swatch colour for a family, optionally tinted by a shade ("light" | "dark"). */
export function colorToHex(family, shade) {
  const base = COLOR_FAMILIES[family]?.hex || "#D4A574";
  if (shade === "light") return mix(base, "#FFFFFF", 0.35);
  if (shade === "dark") return mix(base, "#000000", 0.25);
  return base;
}

/** CSS background for a swatch: solid, or a split for two-tone items. */
export function swatchBackground(meta) {
  if (!meta?.color) return null;
  const a = colorToHex(meta.color, meta.shade);
  if (meta.secondaryColor) {
    const b = colorToHex(meta.secondaryColor);
    return `linear-gradient(90deg, ${a} 50%, ${b} 50%)`;
  }
  return a;
}

/**
 * parseItemMeta(name, overrides?) →
 *   { color, shade, secondaryColor, pattern, brand, source: { color: "auto"|"manual", brand: "auto"|"manual" } }
 * `overrides` is the stored wardrobeMeta entry for this name ({ color?, brand? });
 * an explicit "" clears an auto value.
 */
export function parseItemMeta(name, overrides) {
  const raw = String(name || "").trim();
  const lower = raw.toLowerCase();
  const out = { color: null, shade: null, secondaryColor: null, pattern: null, brand: null, source: { color: "auto", brand: "auto" } };
  if (!raw) return out;

  // ── colours (whole words, longest first, in order of appearance) ──
  const colorHits = findPhrases(lower, allColorNames.map((c) => c.name));
  const families = [];
  for (const h of colorHits) {
    const fam = allColorNames.find((c) => c.name === h.phrase).family;
    if (!families.some((f) => f.family === fam)) families.push({ family: fam, index: h.index, phrase: h.phrase });
  }
  if (families.length) {
    out.color = families[0].family;
    if (families.length > 1) out.secondaryColor = families[1].family;
    // shade: a modifier word immediately before the first colour phrase (unless the phrase already carries it, e.g. "light pink")
    const before = lower.slice(0, families[0].index).trim().split(/\s+/).pop();
    if (before && MODIFIERS.has(before)) out.shade = LIGHTEN.has(before) ? "light" : DARKEN.has(before) ? "dark" : null;
    const firstWord = families[0].phrase.split(" ")[0];
    if (LIGHTEN.has(firstWord)) out.shade = "light";
    if (DARKEN.has(firstWord)) out.shade = "dark";
  }

  // ── pattern ──
  const patHits = findPhrases(lower, [...PATTERNS].sort((a, b) => b.length - a.length));
  if (patHits.length) out.pattern = patHits[0].phrase;

  // ── brand: first run of Capitalized / ALL-CAPS words that aren't descriptive ──
  const isColorWord = (w) => allColorNames.some((c) => c.name.split(" ").includes(w));
  const isPatternWord = (w) => PATTERNS.some((p) => p.split(" ").includes(w));
  const tokens = raw.split(/[\s/&+,]+/).filter(Boolean);
  const cleaned = tokens.map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’.-]+$/gu, ""));
  const isCap = (t) => /^\p{Lu}/u.test(t) && t.length > 1;
  const descriptive = (t) => {
    const w = t.toLowerCase().replace(/[’']s$/, "");
    return isColorWord(w) || MODIFIERS.has(w) || isPatternWord(w) || MATERIALS.has(w) || GARMENT_WORDS.has(w) || /^\d/.test(w) || w === "and" || w === "with";
  };
  let run = [];
  for (const t of cleaned) {
    if (t && isCap(t) && !descriptive(t)) run.push(t);
    else if (run.length) break;
  }
  if (run.length) out.brand = run.slice(0, 3).join(" ");
  if (!out.brand) {
    const known = KNOWN_BRANDS.sort((a, b) => b.length - a.length).find((b) => wordRe(b).test(lower));
    if (known) out.brand = known.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  }

  // ── manual overrides ──
  if (overrides && typeof overrides === "object") {
    if ("color" in overrides) {
      out.color = overrides.color || null;
      out.shade = null;
      out.secondaryColor = null;
      out.source.color = "manual";
    }
    if ("brand" in overrides) {
      out.brand = overrides.brand || null;
      out.source.brand = "manual";
    }
  }
  return out;
}

/** Family ids in display order for the picker. */
export const COLOR_FAMILY_IDS = Object.keys(COLOR_FAMILIES);

// ── structured entry (Fields batch) ──
//
// The outfit editor's "Add new …" form takes the colour, the brand and the type
// of clothing in separate fields. The item NAME stays the identity everywhere
// (wardrobe arrays, outfit slots, synced packing items, wardrobeMeta keys), so
// the fields are composed into the "<Colour> <Brand> <type>" convention the
// parser already reads ("Blue Zevelyn jeans"), and what was typed is kept in
// the item's wardrobeMeta entry — additive fields `colorName` and `type` next to
// the existing `color` / `brand` overrides — so a later edit can prefill it and
// nothing is lost to parsing.

const tidy = (s) => String(s || "").trim().replace(/\s+/g, " ");
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "Black Lululemon flowy pants" from { color, brand, type }; "" when every field is blank. */
export function composeItemName({ color, brand, type } = {}) {
  const c = tidy(color), b = tidy(brand), t = tidy(type);
  const parts = [c, b, t].filter(Boolean);
  if (!parts.length) return "";
  const name = parts.join(" ");
  // Capitalise the first letter unless the name starts with the brand — brands keep their own casing ("lululemon", "SKIMS").
  return c || !b ? capFirst(name) : name;
}

/**
 * The wardrobeMeta entry to store for a structured entry — only when more than
 * the type was given (a bare type is plain free text, exactly like the old single
 * field): { colorName?, brand?, type? }. `brand` doubles as the manual brand
 * override the parser honours. Returns null for a type-only / empty entry.
 */
export function structuredMeta({ color, brand, type } = {}) {
  const c = tidy(color), b = tidy(brand), t = tidy(type);
  if (!c && !b) return null;
  const meta = {};
  if (c) meta.colorName = c;
  if (b) meta.brand = b;
  if (t) meta.type = t;
  return meta;
}

/**
 * Layer a { color?, brand? } correction (or null = none) over an entry, keeping
 * its typed fields. Kept exported: the previous OutfitEditor imports it, and the
 * web-upload order ships src/lib before src/components, so the interim Vercel
 * build must still find it.
 */
export function applyMetaPatch(existing, patch) {
  const keep = {};
  if (existing?.colorName) keep.colorName = existing.colorName;
  if (existing?.type) keep.type = existing.type;
  const next = patch && typeof patch === "object" ? { ...keep, ...patch } : keep;
  return Object.keys(next).length ? next : null;
}

const uniqSorted = (values) => {
  const seen = new Map();
  for (const v of values) if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
};

/** Distinct brands across the whole wardrobe (stored or parsed) — suggestions for the brand field. */
export function wardrobeBrands(wardrobe, wardrobeMeta) {
  const out = [];
  for (const items of Object.values(wardrobe || {})) for (const it of items || []) out.push(parseItemMeta(it, wardrobeMeta?.[it]).brand);
  return uniqSorted(out);
}

/** Distinct types recorded for one slot (structured entries only) — suggestions for the type field. */
export function wardrobeTypes(wardrobe, wardrobeMeta, slotId) {
  return uniqSorted((wardrobe?.[slotId] || []).map((it) => wardrobeMeta?.[it]?.type));
}

// ── editing an existing piece (Piece Edit batch) ──

const JOINERS = /^(?:\s*(?:and|&|\/|with)\s*)$/i;

/**
 * splitItemName(name, meta) → { color, brand, type } to prefill the edit form.
 * A piece entered through the fields gives back exactly what was typed
 * (colorName / brand / type). An older free-text name is carved up: the colour
 * phrase (with its light/dark modifier and a second tone joined by "and" / "&" /
 * "/"), the brand as it appears in the name (a manual brand override wins), and
 * whatever is left is the type. composeItemName() of the result reproduces the
 * original name for the usual "<Colour> <Brand> <type>" shape.
 */
export function splitItemName(name, meta) {
  const raw = tidy(name);
  const hasStored = !!(tidy(meta?.colorName) || tidy(meta?.type));
  if (hasStored) return { color: tidy(meta?.colorName), brand: tidy(meta?.brand), type: tidy(meta?.type) };
  if (!raw) return { color: "", brand: "", type: "" };
  const lowerRaw = raw.toLowerCase();
  const spans = [];
  // colour phrase: first colour hit, extended backwards over a modifier and forwards over "and <colour>"
  const hits = findPhrases(lowerRaw, allColorNames.map((c) => c.name));
  let color = "";
  if (hits.length) {
    let start = hits[0].index, end = start + hits[0].phrase.length;
    const before = lowerRaw.slice(0, start).match(/(\S+)\s+$/);
    if (before && MODIFIERS.has(before[1])) start -= before[0].length;
    if (hits[1] && JOINERS.test(lowerRaw.slice(end, hits[1].index))) end = hits[1].index + hits[1].phrase.length;
    color = raw.slice(start, end);
    spans.push([start, end]);
  }
  // brand: the parsed brand as written in the name; a manual override replaces it in the fields
  const parsedBrand = parseItemMeta(raw).brand;
  if (parsedBrand) {
    const at = lowerRaw.indexOf(parsedBrand.toLowerCase());
    if (at >= 0) spans.push([at, at + parsedBrand.length]);
  }
  let type = "";
  let cursor = 0;
  for (const [s, e] of spans.sort((a, b) => a[0] - b[0])) { if (s > cursor) type += raw.slice(cursor, s) + " "; cursor = Math.max(cursor, e); }
  type += raw.slice(cursor);
  type = tidy(type.replace(/^[\s,\-–·]+|[\s,\-–·]+$/g, ""));
  const overrideBrand = meta && "brand" in meta ? tidy(meta.brand) : null;
  return { color, brand: overrideBrand !== null ? overrideBrand : parsedBrand || "", type };
}
