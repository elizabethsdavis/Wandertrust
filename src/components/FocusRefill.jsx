// Focus Refill — card-by-card review of items flagged for refill.
import { useState, useMemo } from "react";
import { Check, ChevronRight, ArrowLeft, RefreshCw } from "lucide-react";
import { C, F } from "../lib/theme";
import { ProgressRing, Btn } from "./ui";

// ═══════════════════════════════════════════════════════
// FOCUS REFILL
// ═══════════════════════════════════════════════════════
export function FocusRefill({ items, onToggleRefill, onToggleRefilled, onExit }) {
  const needRefill = useMemo(() => items.filter(i => i.needsRefill), [items]);
  const notRefilled = useMemo(() => needRefill.filter(i => !i.refilled), [needRefill]);
  const [idx, setIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const cur = notRefilled[idx];
  const doneCount = needRefill.filter(i => i.refilled).length;
  const pct = needRefill.length > 0 ? Math.round((doneCount / needRefill.length) * 100) : 0;

  // ── Completion screen ──
  if (!cur) {
    const allDone = needRefill.length > 0 && doneCount === needRefill.length;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "70vh", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>{allDone ? "✅" : "📋"}</div>
        <h2 style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 500, marginBottom: 12 }}>
          {allDone ? "All refilled!" : needRefill.length === 0 ? "Nothing to refill" : "Review complete"}
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 16, color: C.warmGray, marginBottom: 8 }}>
          {allDone ? `${needRefill.length} item${needRefill.length !== 1 ? "s" : ""} restocked and ready to pack.`
            : needRefill.length === 0 ? "Mark items as needing refill from your packing list first."
            : `${doneCount} of ${needRefill.length} refilled. You can come back for the rest.`}
        </p>
        {needRefill.length > 0 && !allDone && (
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.amber, marginBottom: 24 }}>
            {needRefill.length - doneCount} still need refilling
          </div>
        )}
        <Btn v="sage" sz="lg" onClick={onExit}>Back to trip</Btn>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #FFF8F2 0%, ${C.cream} 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      {/* Exit */}
      <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, background: "none",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
        <ArrowLeft size={18} /> Exit
      </button>

      {/* Progress ring */}
      <ProgressRing pct={pct} size={140} sw={8}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 500 }}>{pct}%</div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, textTransform: "uppercase", letterSpacing: ".08em" }}>refilled</div>
        </div>
      </ProgressRing>

      {/* Current item card */}
      <div style={{ marginTop: 48, textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".1em", color: C.copper, marginBottom: 12 }}>{cur.section}</div>
        <h2 style={{ fontFamily: F.display, fontSize: 40, color: C.charcoal, fontWeight: 400, marginBottom: 8, lineHeight: 1.2 }}>
          {cur.name}
        </h2>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.amberGlow,
          padding: "6px 14px", borderRadius: 10, marginTop: 8, border: "1px solid rgba(212,160,74,.2)" }}>
          <RefreshCw size={14} color={C.amber} />
          <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.amber }}>Needs refill</span>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 16, marginTop: 48, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn v="amber" sz="lg" onClick={() => { onToggleRefilled(cur.id); setTimeout(() => setIdx(i => Math.min(i, notRefilled.length - 2)), 50); }}
          style={{ minWidth: 160 }}><RefreshCw size={18} /> Refilled</Btn>
        <Btn v="secondary" sz="lg" onClick={() => setIdx(i => Math.min(i + 1, notRefilled.length - 1))}
          style={{ minWidth: 120 }}>Skip</Btn>
      </div>

      {/* Remove refill tag */}
      <button onClick={() => { onToggleRefill(cur.id); setTimeout(() => setIdx(i => Math.min(i, notRefilled.length - 2)), 50); }}
        style={{ marginTop: 16, background: "none", border: "none", cursor: "pointer",
          fontFamily: F.body, fontSize: 13, color: C.softGray, textDecoration: "underline",
          padding: "4px 8px" }}>
        Doesn't need refill
      </button>

      <div style={{ marginTop: 24, fontFamily: F.body, fontSize: 13, color: C.softGray }}>
        {idx + 1} of {notRefilled.length} remaining
      </div>

      {/* Expandable full list */}
      <div style={{ marginTop: 32, width: "100%", maxWidth: 400 }}>
        <button onClick={() => setShowAll(!showAll)} style={{ width: "100%", background: "none", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontFamily: F.body, fontSize: 13, fontWeight: 500, color: C.copper, padding: "8px 0" }}>
          <ChevronRight size={14} style={{ transform: showAll ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
          View all refills ({doneCount}/{needRefill.length})
        </button>
        {showAll && (
          <div style={{ background: C.warmWhite, borderRadius: 14, padding: "12px 16px", marginTop: 8,
            border: `1px solid ${C.borderLight}`, maxHeight: 320, overflow: "auto" }}>
            {needRefill.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px",
                borderBottom: `1px solid ${C.borderLight}` }}>
                <button onClick={() => onToggleRefilled(item.id)} style={{ width: 28, height: 28, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  border: item.refilled ? "none" : `2px solid ${C.borderMedium}`,
                  background: item.refilled ? `linear-gradient(135deg,${C.sage},${C.sageDark})` : "transparent",
                  transition: "all .2s", flexShrink: 0 }}>
                  {item.refilled && <Check size={14} color="#fff" strokeWidth={3} />}
                </button>
                <span style={{ fontFamily: F.body, fontSize: 14, color: item.refilled ? C.softGray : C.charcoal,
                  textDecoration: item.refilled ? "line-through" : "none", opacity: item.refilled ? .6 : 1,
                  flex: 1 }}>{item.name}</span>
                <span style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{item.section}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
