// "Fix the colour / brand" sheet for a wardrobe item. Writes the correction into
// the additive `wardrobeMeta` key ({ [itemName]: { color?, brand? } }); parsing
// stays the fallback for anything not overridden.
import { useState } from "react";
import { X, Check, RotateCcw } from "lucide-react";
import { C, F } from "../lib/theme";
import { COLOR_FAMILY_IDS, colorToHex, parseItemMeta } from "../lib/wardrobe";

export function WardrobeMetaPicker({ name, meta, onSave, onClose }) {
  const auto = parseItemMeta(name);                 // what the parser thinks, ignoring overrides
  const current = parseItemMeta(name, meta);        // what is shown today
  const [color, setColor] = useState(current.color || "");
  const [brand, setBrand] = useState(current.brand || "");

  const save = () => {
    const patch = {};
    if (color !== (auto.color || "")) patch.color = color;   // only store what differs from auto
    if (brand.trim() !== (auto.brand || "")) patch.brand = brand.trim();
    onSave(Object.keys(patch).length ? patch : null);        // null = back to automatic
    onClose();
  };

  const label = (id) => id.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(45,41,38,.35)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: C.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: "8px 22px 30px", boxShadow: `0 -8px 40px ${C.shadowMed}`, animation: "fadeIn .2s ease", maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.borderMedium, margin: "8px auto 18px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontFamily: F.display, fontSize: 24, color: C.charcoal, fontWeight: 400, margin: 0 }}>Fix details</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={C.softGray} />
          </button>
        </div>
        <div style={{ fontFamily: F.body, fontSize: 13.5, color: C.warmGray, marginBottom: 16 }}>{name}</div>

        <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: C.softGray, marginBottom: 8 }}>
          Colour {auto.color && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· auto-detected {label(auto.color)}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setColor("")} title="No colour"
            style={{ height: 44, borderRadius: 12, cursor: "pointer", background: C.warmWhite,
              border: `2px solid ${color === "" ? C.copper : C.borderLight}`, fontFamily: F.body, fontSize: 10, color: C.softGray }}>none</button>
          {COLOR_FAMILY_IDS.map((id) => (
            <button key={id} onClick={() => setColor(id)} title={label(id)} aria-label={`Colour ${label(id)}`}
              style={{ height: 44, borderRadius: 12, cursor: "pointer", background: colorToHex(id),
                border: `2px solid ${color === id ? C.copper : "rgba(45,41,38,.12)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {color === id && <Check size={16} color={["white", "cream", "yellow", "silver"].includes(id) ? C.charcoal : "#fff"} strokeWidth={3} />}
            </button>
          ))}
        </div>

        <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: C.softGray, marginBottom: 8 }}>
          Brand {auto.brand && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· auto-detected {auto.brand}</span>}
        </div>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Aritzia (leave empty for none)" aria-label="Brand"
          style={{ width: "100%", fontFamily: F.body, fontSize: 14, padding: "12px 14px", borderRadius: 12, marginBottom: 18,
            border: `1.5px solid ${C.borderMedium}`, background: C.warmWhite, color: C.charcoal, outline: "none" }} />

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { onSave(null); onClose(); }} title="Back to automatic"
            style={{ flex: 1, minHeight: 48, borderRadius: 14, cursor: "pointer", border: `1px solid ${C.borderLight}`, background: C.warmWhite,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
            <RotateCcw size={15} /> Auto
          </button>
          <button onClick={save}
            style={{ flex: 2, minHeight: 48, borderRadius: 14, cursor: "pointer", border: "none",
              background: `linear-gradient(135deg,${C.copper},${C.copperLight})`, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: F.body, fontSize: 14.5, fontWeight: 600 }}>
            <Check size={16} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}
