// Outfit cards and pickers (Outfits batch): a saved outfit as a tappable card
// with its photo — or, without one, a small "collage" of its pieces — and the
// bottom-sheet picker used to choose an outfit for a day or add one to a trip.
import { useState } from "react";
import { X, Search, Plus, Check, FolderOpen } from "lucide-react";
import { C, F } from "../lib/theme";
import { SLOT_BY_ID } from "../data/outfitSlots";
import { slotEntries, matchesQuery } from "../lib/outfits";
import { photoThumb, photoSrc } from "../lib/photos";

/** Photo or a piece collage, square. */
export function OutfitVisual({ outfit, size = 120, radius = 16, full = false }) {
  const src = full ? photoSrc(outfit?.photo) : photoThumb(outfit?.photo);
  const pieces = slotEntries(outfit?.slots);
  const px = typeof size === "number" ? size : 140; // "100%" (grid cards) → size the collage type as a 140px tile
  if (src) {
    return <img src={src} alt={outfit?.name || "Outfit"} style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", display: "block", background: C.creamDark }} />;
  }
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: radius, background: `linear-gradient(135deg, ${C.creamDark}, ${C.cream})`,
      border: `1px solid ${C.borderLight}`, padding: Math.max(6, px * 0.07), display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 3, overflow: "hidden" }}>
      {pieces.length === 0 ? (
        <span style={{ margin: "auto", fontSize: px * 0.32 }}>👗</span>
      ) : pieces.slice(0, px >= 100 ? 5 : 3).map(([sid, name], i) => (
        <span key={i} style={{ fontFamily: F.body, fontSize: Math.max(8, px * 0.085), color: C.charcoal, background: "rgba(255,255,255,.75)", borderRadius: 6,
          padding: "2px 5px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {SLOT_BY_ID[sid]?.emoji} {name}
        </span>
      ))}
    </div>
  );
}

/** Pieces as emoji + name lines. */
export function PieceList({ slots, compact = false, max }) {
  const pieces = slotEntries(slots);
  if (pieces.length === 0) return <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, fontStyle: "italic" }}>No pieces yet</div>;
  const shown = max ? pieces.slice(0, max) : pieces;
  return (
    <div style={{ display: "flex", flexDirection: compact ? "row" : "column", flexWrap: "wrap", gap: compact ? 6 : 4 }}>
      {shown.map(([sid, name], i) => (
        <span key={i} style={{ fontFamily: F.body, fontSize: compact ? 11 : 13, color: C.charcoal, lineHeight: 1.4 }}>{SLOT_BY_ID[sid]?.emoji} {name}</span>
      ))}
      {max && pieces.length > max && <span style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>+{pieces.length - max} more</span>}
    </div>
  );
}

/** A grid card: visual + name + piece count (+ optional badge / worn labels). */
export function OutfitCard({ outfit, onClick, badge, worn = [], selected, size = "grid" }) {
  const n = slotEntries(outfit?.slots).length;
  if (size === "row") {
    return (
      <button onClick={onClick} aria-label={outfit.name} aria-pressed={selected}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, width: "100%", textAlign: "left", cursor: "pointer",
          background: selected ? C.copperGlow : C.warmWhite, border: `1.5px solid ${selected ? C.copper : C.borderLight}` }}>
        <OutfitVisual outfit={outfit} size={52} radius={12} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.charcoal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{outfit.name}</div>
          <div style={{ fontFamily: F.body, fontSize: 11.5, color: C.softGray, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {n} piece{n === 1 ? "" : "s"}{worn.length > 0 ? ` · ${worn.join(", ")}` : ""}
          </div>
        </div>
        {selected && <Check size={16} color={C.copper} />}
        {badge}
      </button>
    );
  }
  return (
    <button onClick={onClick} aria-label={outfit.name}
      style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 18, textAlign: "left", cursor: "pointer", width: "100%",
        background: C.warmWhite, border: `1.5px solid ${selected ? C.copper : C.borderLight}`, boxShadow: `0 2px 8px ${C.shadow}`, position: "relative" }}>
      {/* padding-top square: an <img> with height:100% inside an aspect-ratio box grows past it in Chrome */}
      <div style={{ position: "relative", width: "100%", paddingTop: "100%" }}>
        <div style={{ position: "absolute", inset: 0 }}><OutfitVisual outfit={outfit} size="100%" radius={12} /></div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: F.body, fontSize: 13.5, fontWeight: 500, color: C.charcoal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{outfit.name}</div>
        <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {n} piece{n === 1 ? "" : "s"}{worn.length > 0 ? ` · ${worn.join(", ")}` : ""}
        </div>
      </div>
      {badge && <div style={{ position: "absolute", top: 14, left: 14 }}>{badge}</div>}
    </button>
  );
}

/** Small sheet chrome shared by the pickers and detail sheets. */
export function Sheet({ title, onClose, children, ariaLabel }) {
  return (
    <div onClick={onClose} role="dialog" aria-label={ariaLabel || title}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(45,41,38,.35)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", background: C.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: "8px 18px 30px", boxShadow: `0 -8px 40px ${C.shadowMed}`, animation: "fadeIn .2s ease" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.borderMedium, margin: "8px auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontFamily: F.display, fontSize: 24, color: C.charcoal, fontWeight: 400, margin: 0 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={20} color={C.softGray} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * The picker: outfits on this trip first, then the rest of the closet, with a
 * search box; `onNew` adds a "New outfit" row. `excludeIds` hides outfits
 * already where they'd be picked into.
 */
export function OutfitPicker({ title = "Choose an outfit", outfits, tripIds = [], excludeIds = [], onPick, onNew, onClose, tripLabel = "On this trip", currentId }) {
  const [q, setQ] = useState("");
  const ex = new Set(excludeIds);
  const list = (outfits || []).filter((o) => !ex.has(o.id) && matchesQuery(o, q));
  const onTrip = list.filter((o) => tripIds.includes(o.id));
  const rest = list.filter((o) => !tripIds.includes(o.id));
  const Group = ({ label, items }) => items.length === 0 ? null : (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: C.warmGray, padding: "0 4px 8px" }}>{label} · {items.length}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((o) => <OutfitCard key={o.id} outfit={o} size="row" selected={o.id === currentId} onClick={() => onPick(o)} />)}
      </div>
    </div>
  );
  return (
    <Sheet title={title} onClose={onClose}>
      {(outfits || []).length > 4 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: C.warmWhite, borderRadius: 12, border: `1px solid ${C.borderLight}`, marginBottom: 14 }}>
          <Search size={14} color={C.softGray} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search outfits or pieces…" aria-label="Search outfits"
            style={{ flex: 1, border: "none", background: "none", outline: "none", fontFamily: F.body, fontSize: 13, color: C.charcoal }} />
          {q && <button onClick={() => setQ("")} aria-label="Clear search" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={12} color={C.softGray} /></button>}
        </div>
      )}
      {onNew && (
        <button onClick={onNew} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", borderRadius: 14, marginBottom: 14, cursor: "pointer",
          border: `2px dashed ${C.borderMedium}`, background: C.copperSubtle, fontFamily: F.body, fontSize: 14, color: C.copper }}>
          <Plus size={16} /> New outfit
        </button>
      )}
      <Group label={tripLabel} items={onTrip} />
      <Group label={onTrip.length ? "Rest of your closet" : "Your closet"} items={rest} />
      {list.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 4px", fontFamily: F.body, fontSize: 13, color: C.softGray }}>
          <FolderOpen size={16} /> {q ? "No outfit matches that." : "No saved outfits yet — build one and it'll be here for every trip."}
        </div>
      )}
    </Sheet>
  );
}
