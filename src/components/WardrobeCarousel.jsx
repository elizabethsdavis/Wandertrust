// The wardrobe carousel: every item the closet holds for one slot, grouped by
// colour family, with the colour / brand row (tap to edit the piece — Piece
// Edit batch) and a remove button. Props only — used by the outfit editor
// (extracted from PackPal.jsx in the Outfits batch).
//   onEditPiece({ name, newName, entry })  save from the edit sheet (rename when newName differs)
//   usageFor(name) → { outfits, days, items }   for the sheet's "renaming updates …" line
import { useMemo, useRef, useState } from "react";
import { Check, X, Pencil } from "lucide-react";
import { C, F } from "../lib/theme";
import { parseItemMeta, swatchBackground } from "../lib/wardrobe";
import { SLOT_BY_ID } from "../data/outfitSlots";
import { PieceEditSheet } from "./PieceEditSheet";

export function WardrobeCarousel({ slotId, wardrobe, wardrobeMeta, onEditPiece, usageFor, onSelect, selected, onRemoveItem }) {
  const items = (wardrobe[slotId] || []);
  const scrollRef = useRef(null);
  const [editing, setEditing] = useState(null); // item name being edited in the sheet
  // selected can be a string (single) or array (multi)
  const selArr = Array.isArray(selected) ? selected : selected ? [selected] : [];
  const metaFor = (item) => parseItemMeta(item, wardrobeMeta?.[item]);

  // Group by colour family for visual organization
  const grouped = useMemo(() => {
    const colorMap = {};
    items.forEach(item => {
      const meta = parseItemMeta(item, wardrobeMeta?.[item]);
      const key = meta.color || "other";
      if (!colorMap[key]) colorMap[key] = [];
      colorMap[key].push(item);
    });
    return Object.entries(colorMap).sort((a, b) => b[1].length - a[1].length);
  }, [items, wardrobeMeta]);

  const allItems = grouped.flatMap(([, items]) => items);

  return (
    <div>
      {editing && (
        <PieceEditSheet slot={SLOT_BY_ID[slotId]} name={editing} meta={wardrobeMeta?.[editing]} usage={usageFor?.(editing)} onClose={() => setEditing(null)}
          onSave={({ name, entry }) => onEditPiece?.({ name: editing, newName: name, entry })}
          onRemove={onRemoveItem && !selArr.includes(editing) ? () => onRemoveItem(editing) : undefined} />
      )}
      {allItems.length > 0 && (
        <div ref={scrollRef} style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8,
          scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}>
          {allItems.map((item, i) => {
            const meta = metaFor(item);
            const isSel = selArr.includes(item);
            const swatch = swatchBackground(meta);
            return (
              <div key={`${item}-${i}`} style={{ position: "relative", flexShrink: 0 }}>
                <button onClick={() => onSelect(item)}
                  style={{ minWidth: 130, maxWidth: 160, padding: "12px 14px", borderRadius: 14, width: "100%",
                    border: `2px solid ${isSel ? C.copper : C.borderLight}`,
                    background: isSel ? C.copperGlow : C.warmWhite,
                    cursor: "pointer", textAlign: "left", transition: "all .2s",
                    transform: isSel ? "scale(1.02)" : "scale(1)",
                    boxShadow: isSel ? `0 4px 16px rgba(193,127,89,.2)` : `0 1px 4px ${C.shadow}` }}>
                  {/* Colour / brand / pattern row — tap to edit the piece */}
                  <span role="button" tabIndex={0} title="Edit this piece" aria-label={`Edit ${item}`}
                    onClick={(e) => { e.stopPropagation(); setEditing(item); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setEditing(item); } }}
                    style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, minHeight: 14, cursor: "pointer" }}>
                    {swatch ? (
                      <span style={{ width: 12, height: 12, borderRadius: 6, background: swatch, flexShrink: 0,
                        border: `1px solid ${meta.color === "white" || meta.color === "cream" ? C.borderMedium : "rgba(45,41,38,.12)"}`,
                        outline: meta.source.color === "manual" ? `2px solid ${C.copperGlow}` : "none" }} />
                    ) : (
                      <span style={{ width: 12, height: 12, borderRadius: 6, flexShrink: 0, border: `1px dashed ${C.borderMedium}` }} />
                    )}
                    {meta.brand && <span style={{ fontFamily: F.body, fontSize: 9, fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: ".05em", color: C.softGray, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta.brand}</span>}
                    {meta.pattern && <span style={{ fontFamily: F.body, fontSize: 9, fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: ".05em", color: C.copper, background: C.copperSubtle, padding: "1px 5px", borderRadius: 4 }}>{meta.pattern}</span>}
                    <Pencil size={10} color={C.softGray} style={{ marginLeft: "auto", flexShrink: 0 }} aria-hidden="true" />
                  </span>
                  <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: isSel ? 600 : 400,
                    color: C.charcoal, lineHeight: 1.3,
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {item}
                  </div>
                  {isSel && <div style={{ marginTop: 6 }}>
                    <Check size={14} color={C.copper} />
                  </div>}
                </button>
                {/* Remove from wardrobe */}
                {onRemoveItem && !isSel && (
                  <button onClick={(e) => { e.stopPropagation(); onRemoveItem(item); }}
                    style={{ position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: C.warmWhite, border: `1px solid ${C.borderLight}`,
                      cursor: "pointer", color: C.softGray, padding: 0, transition: "all .15s",
                      boxShadow: `0 1px 3px ${C.shadow}` }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.dangerGlow; e.currentTarget.style.color = C.danger; e.currentTarget.style.borderColor = C.danger; }}
                    onMouseLeave={e => { e.currentTarget.style.background = C.warmWhite; e.currentTarget.style.color = C.softGray; e.currentTarget.style.borderColor = C.borderLight; }}
                    title="Remove from wardrobe">
                    <X size={10} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
