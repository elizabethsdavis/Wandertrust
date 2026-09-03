// Bottom sheet for picking one emoji — used for a trip's icon and for a
// category's emoji in the template editor. Tap a suggestion, or type / paste
// any emoji (the iPhone emoji keyboard opens on the input); only the last
// grapheme is kept so flags and skin tones survive intact.
import { useState } from "react";
import { X, Check, RotateCcw } from "lucide-react";
import { C, F } from "../lib/theme";
import { lastGrapheme } from "../lib/utils";

export function EmojiPicker({ title, value, defaultValue, suggestions, onSave, onClose }) {
  const [draft, setDraft] = useState(value || "");
  const save = (v) => { const g = lastGrapheme(v); if (g) onSave(g); onClose(); };

  return (
    <div onClick={onClose} role="dialog" aria-label={title}
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(45,41,38,.35)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: C.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: "8px 22px 30px", boxShadow: `0 -8px 40px ${C.shadowMed}`, animation: "fadeIn .2s ease", maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.borderMedium, margin: "8px auto 18px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontFamily: F.display, fontSize: 24, color: C.charcoal, fontWeight: 400, margin: 0 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={C.softGray} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div aria-label="Current emoji" style={{ width: 64, height: 64, borderRadius: 18, background: C.warmWhite, border: `1px solid ${C.borderLight}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, flexShrink: 0 }}>{draft || value || "·"}</div>
          <input value={draft} onChange={(e) => setDraft(lastGrapheme(e.target.value))} aria-label="Emoji" placeholder="Type or paste any emoji"
            onKeyDown={(e) => { if (e.key === "Enter") save(draft); }}
            style={{ flex: 1, minWidth: 0, fontFamily: F.body, fontSize: 18, padding: "12px 14px", borderRadius: 12,
              border: `1.5px solid ${C.borderMedium}`, background: C.warmWhite, color: C.charcoal, outline: "none" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6, marginBottom: 18 }}>
          {(suggestions || []).map((e) => (
            <button key={e} onClick={() => save(e)} aria-label={`Pick ${e}`}
              style={{ height: 42, borderRadius: 10, cursor: "pointer", fontSize: 22, background: draft === e ? C.copperGlow : C.warmWhite,
                border: `1.5px solid ${draft === e ? C.copper : C.borderLight}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {e}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {defaultValue && (
            <button onClick={() => save(defaultValue)} title="Back to the default"
              style={{ flex: 1, minHeight: 48, borderRadius: 14, cursor: "pointer", border: `1px solid ${C.borderLight}`, background: C.warmWhite,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
              <RotateCcw size={15} /> Default {defaultValue}
            </button>
          )}
          <button onClick={() => save(draft)} disabled={!lastGrapheme(draft)}
            style={{ flex: 2, minHeight: 48, borderRadius: 14, cursor: "pointer", border: "none",
              background: `linear-gradient(135deg,${C.copper},${C.copperLight})`, color: "#fff", opacity: lastGrapheme(draft) ? 1 : .5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: F.body, fontSize: 14.5, fontWeight: 600 }}>
            <Check size={16} /> Use {draft || ""}
          </button>
        </div>
      </div>
    </div>
  );
}
