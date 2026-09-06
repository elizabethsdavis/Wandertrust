// "Edit piece" bottom sheet for an existing wardrobe item (Piece Edit batch;
// replaces the old "Fix details" colour / brand picker).
//
// The same three fields as the "Add new …" form — colour, brand, type — come
// prefilled (what was typed, or the name carved up for older free-text pieces),
// plus the swatch family grid the old sheet had (a manual override for when the
// parser can't tell "champagne" from "cream"). Saving with a changed name hands
// the rename to the parent (`onSave` → OutfitEditor → OutfitBuilder / Closet →
// PackPal), which follows it through every outfit, trip day and packing item.
//
//   name, meta          the piece and its wardrobeMeta entry
//   usage               { outfits, days, items } — shown when the name changes
//   onSave({ name, entry })   the new (or unchanged) name + the entry to store (null = none)
//   onRemove?           "Remove from wardrobe" (the card's × does the same)
import { useMemo, useRef, useState } from "react";
import { X, Check, Trash2 } from "lucide-react";
import { C, F } from "../lib/theme";
import { COLOR_FAMILY_IDS, colorToHex, parseItemMeta, swatchBackground, composeItemName, splitItemName, structuredMeta } from "../lib/wardrobe";

const fieldStyle = { width: "100%", fontFamily: F.body, fontSize: 14, padding: "11px 14px", border: `1.5px solid ${C.borderMedium}`, borderRadius: 12,
  background: C.warmWhite, outline: "none", color: C.charcoal, boxSizing: "border-box" };
const fieldLabel = { fontFamily: F.body, fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".07em", color: C.softGray, marginBottom: 5, paddingLeft: 2 };
const label = (id) => id.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function PieceEditSheet({ slot, name, meta, usage, onSave, onRemove, onClose }) {
  const initial = useMemo(() => splitItemName(name, meta), [name, meta]);
  const [color, setColor] = useState(initial.color);
  const [brand, setBrand] = useState(initial.brand);
  const [type, setType] = useState(initial.type);
  const [dirty, setDirty] = useState(false);                        // a field was edited → the typed fields are authoritative
  const [swatchPick, setSwatchPick] = useState(null);               // null = untouched, "" = none, else a family id
  const shownNow = parseItemMeta(name, meta);                       // what the card shows today
  const brandRef = useRef(null), typeRef = useRef(null);

  // The name only changes once a field was actually edited — a legacy piece whose
  // fields don't recompose byte-for-byte (lower-case first letter) stays as it is.
  const composed = composeItemName({ color, brand, type });
  const newName = dirty && composed ? composed : name;
  const renamed = newName !== name;
  // Details to store: the typed fields when edited, otherwise whatever the entry already held.
  const entryBase = dirty
    ? { ...(structuredMeta({ color, brand, type }) || {}), ...(!brand.trim() && parseItemMeta(newName).brand ? { brand: "" } : {}) }
    : { ...(meta?.colorName ? { colorName: meta.colorName } : {}), ...(meta?.type ? { type: meta.type } : {}), ...(meta && "brand" in meta ? { brand: meta.brand } : {}) };
  const autoFamily = parseItemMeta(newName).color || "";
  // Swatch: an explicit pick wins; a renamed piece follows its new colour; an unchanged one keeps its override.
  const swatch = swatchPick !== null ? swatchPick : renamed ? autoFamily : shownNow.color || "";
  const entry = { ...entryBase, ...(swatch !== autoFamily ? { color: swatch } : {}) };
  const preview = parseItemMeta(newName, entry);
  const previewSwatch = swatchBackground(preview);
  const canSave = !!(type.trim() || brand.trim()) || !dirty;
  const setSwatch = setSwatchPick;

  const edit = (setter) => (e) => { setter(e.target.value); setDirty(true); };
  const hop = (ref) => (e) => { if (e.key === "Enter") { e.preventDefault(); ref.current?.focus(); } };
  const save = (e) => {
    e?.preventDefault();
    if (!canSave) return;
    onSave({ name: newName, entry: Object.keys(entry).length ? entry : null });
    onClose();
  };
  const u = usage || { outfits: 0, days: 0, items: 0 };
  const usedIn = [u.outfits ? plural(u.outfits, "saved outfit") : "", u.days ? plural(u.days, "trip day") : "", u.items ? plural(u.items, "packing item") : ""].filter(Boolean);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(45,41,38,.35)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save} role="dialog" aria-label={`Edit ${name}`}
        style={{ width: "100%", maxWidth: 460, background: C.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: "8px 22px 30px", boxShadow: `0 -8px 40px ${C.shadowMed}`, animation: "fadeIn .2s ease", maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.borderMedium, margin: "8px auto 18px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <h3 style={{ fontFamily: F.display, fontSize: 24, color: C.charcoal, fontWeight: 400, margin: 0 }}>Edit piece</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={C.softGray} />
          </button>
        </div>
        <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.warmGray, marginBottom: 16 }}>{slot?.emoji} {slot?.label} · {name}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <label style={{ minWidth: 0 }}>
            <div style={fieldLabel}>Colour</div>
            <input value={color} onChange={edit(setColor)} placeholder="e.g. Black" aria-label="Edit colour" autoComplete="off" autoCapitalize="sentences"
              enterKeyHint="next" onKeyDown={hop(brandRef)} style={fieldStyle}
              onFocus={(e) => (e.target.style.borderColor = C.copper)} onBlur={(e) => (e.target.style.borderColor = C.borderMedium)} />
          </label>
          <label style={{ minWidth: 0 }}>
            <div style={fieldLabel}>Brand <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· optional</span></div>
            <input ref={brandRef} value={brand} onChange={edit(setBrand)} placeholder="e.g. Lululemon" aria-label="Edit brand" autoComplete="off" autoCapitalize="words"
              enterKeyHint="next" onKeyDown={hop(typeRef)} style={fieldStyle}
              onFocus={(e) => (e.target.style.borderColor = C.copper)} onBlur={(e) => (e.target.style.borderColor = C.borderMedium)} />
          </label>
        </div>
        <label style={{ display: "block", marginBottom: 12 }}>
          <div style={fieldLabel}>Type of clothing</div>
          <input ref={typeRef} value={type} onChange={edit(setType)} placeholder={slot?.typePlaceholder || "e.g. flowy pants"} aria-label="Edit type" autoComplete="off" autoCapitalize="none"
            enterKeyHint="done" style={fieldStyle}
            onFocus={(e) => (e.target.style.borderColor = C.copper)} onBlur={(e) => (e.target.style.borderColor = C.borderMedium)} />
        </label>

        {/* Preview of the name as it will be saved */}
        <div aria-label="Edited piece preview" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 22, marginBottom: 4, paddingLeft: 2 }}>
          {previewSwatch ? (
            <span style={{ width: 12, height: 12, borderRadius: 6, background: previewSwatch, flexShrink: 0,
              border: `1px solid ${preview.color === "white" || preview.color === "cream" ? C.borderMedium : "rgba(45,41,38,.12)"}` }} />
          ) : (
            <span style={{ width: 12, height: 12, borderRadius: 6, flexShrink: 0, border: `1px dashed ${C.borderMedium}` }} />
          )}
          {preview.brand && <span style={{ fontFamily: F.body, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: C.softGray }}>{preview.brand}</span>}
          <span style={{ fontFamily: F.body, fontSize: 13.5, fontWeight: 500, color: C.charcoal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{newName}</span>
        </div>
        <div aria-live="polite" style={{ fontFamily: F.body, fontSize: 11.5, color: renamed ? C.copper : C.softGray, minHeight: 16, marginBottom: 14, paddingLeft: 2 }}>
          {renamed
            ? (usedIn.length ? `Renaming updates ${usedIn.join(", ")}.` : "Renaming — nothing else uses this piece yet.")
            : dirty && !canSave ? "Give it a type or a brand." : "Name unchanged."}
        </div>

        <div style={fieldLabel}>
          Swatch {autoFamily && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· auto-detected {label(autoFamily)}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 18 }}>
          <button type="button" onClick={() => setSwatch("")} title="No swatch"
            style={{ height: 40, borderRadius: 12, cursor: "pointer", background: C.warmWhite,
              border: `2px solid ${swatch === "" ? C.copper : C.borderLight}`, fontFamily: F.body, fontSize: 10, color: C.softGray }}>none</button>
          {COLOR_FAMILY_IDS.map((id) => (
            <button key={id} type="button" onClick={() => setSwatch(id)} title={label(id)} aria-label={`Colour ${label(id)}`}
              style={{ height: 40, borderRadius: 12, cursor: "pointer", background: colorToHex(id),
                border: `2px solid ${swatch === id ? C.copper : "rgba(45,41,38,.12)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {swatch === id && <Check size={16} color={["white", "cream", "yellow", "silver"].includes(id) ? C.charcoal : "#fff"} strokeWidth={3} />}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {onRemove && (
            <button type="button" onClick={() => { onRemove(); onClose(); }} title="Remove from wardrobe" aria-label="Remove from wardrobe"
              style={{ minWidth: 48, minHeight: 48, borderRadius: 14, cursor: "pointer", border: `1px solid ${C.borderLight}`, background: C.warmWhite,
                display: "flex", alignItems: "center", justifyContent: "center", color: C.softGray }}>
              <Trash2 size={16} />
            </button>
          )}
          <button type="button" onClick={onClose}
            style={{ flex: 1, minHeight: 48, borderRadius: 14, cursor: "pointer", border: `1px solid ${C.borderLight}`, background: C.warmWhite,
              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
            Cancel
          </button>
          <button type="submit" aria-disabled={!canSave}
            style={{ flex: 2, minHeight: 48, borderRadius: 14, cursor: canSave ? "pointer" : "default", border: "none", opacity: canSave ? 1 : 0.5,
              background: `linear-gradient(135deg,${C.copper},${C.copperLight})`, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: F.body, fontSize: 14.5, fontWeight: 600 }}>
            <Check size={16} /> {renamed ? "Save & rename" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
