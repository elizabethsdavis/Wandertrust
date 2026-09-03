// Focus Charge — card-by-card review of items flagged for charging.
import { useState, useMemo } from "react";
import { Check, ChevronRight, ArrowLeft, BatteryCharging } from "lucide-react";
import { C, F } from "../lib/theme";
import { ProgressRing, Btn } from "./ui";

// ═══════════════════════════════════════════════════════
// FOCUS CHARGE
// ═══════════════════════════════════════════════════════
export function FocusCharge({ items, onToggleCharge, onToggleCharged, onExit }) {
  const needCharge = useMemo(() => items.filter(i => i.needsCharge), [items]);
  const notCharged = useMemo(() => needCharge.filter(i => !i.charged), [needCharge]);
  const [idx, setIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const cur = notCharged[idx];
  const doneCount = needCharge.filter(i => i.charged).length;
  const pct = needCharge.length > 0 ? Math.round((doneCount / needCharge.length) * 100) : 0;

  if (!cur) {
    const allDone = needCharge.length > 0 && doneCount === needCharge.length;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "70vh", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>{allDone ? "🔋" : "🔌"}</div>
        <h2 style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 500, marginBottom: 12 }}>
          {allDone ? "All charged up!" : needCharge.length === 0 ? "Nothing to charge" : "Review complete"}
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 16, color: C.warmGray, marginBottom: 8 }}>
          {allDone ? `${needCharge.length} device${needCharge.length !== 1 ? "s" : ""} charged and ready.`
            : needCharge.length === 0 ? "Mark items as needing charge from your packing list first."
            : `${doneCount} of ${needCharge.length} charged. You can come back for the rest.`}
        </p>
        {needCharge.length > 0 && !allDone && (
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.teal, marginBottom: 24 }}>
            {needCharge.length - doneCount} still need charging
          </div>
        )}
        <Btn v="sage" sz="lg" onClick={onExit}>Back to trip</Btn>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #F0FAFB 0%, ${C.cream} 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, background: "none",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
        <ArrowLeft size={18} /> Exit
      </button>

      <ProgressRing pct={pct} size={140} sw={8}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 500 }}>{pct}%</div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, textTransform: "uppercase", letterSpacing: ".08em" }}>charged</div>
        </div>
      </ProgressRing>

      <div style={{ marginTop: 48, textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".1em", color: C.copper, marginBottom: 12 }}>{cur.section}</div>
        <h2 style={{ fontFamily: F.display, fontSize: 40, color: C.charcoal, fontWeight: 400, marginBottom: 8, lineHeight: 1.2 }}>
          {cur.name}
        </h2>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.tealGlow,
          padding: "6px 14px", borderRadius: 10, marginTop: 8, border: "1px solid rgba(78,173,197,.2)" }}>
          <BatteryCharging size={14} color={C.teal} />
          <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.teal }}>Needs charge</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 48, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn v="teal" sz="lg" onClick={() => { onToggleCharged(cur.id); setTimeout(() => setIdx(i => Math.min(i, notCharged.length - 2)), 50); }}
          style={{ minWidth: 160 }}><BatteryCharging size={18} /> Charged</Btn>
        <Btn v="secondary" sz="lg" onClick={() => setIdx(i => Math.min(i + 1, notCharged.length - 1))}
          style={{ minWidth: 120 }}>Skip</Btn>
      </div>

      <button onClick={() => { onToggleCharge(cur.id); setTimeout(() => setIdx(i => Math.min(i, notCharged.length - 2)), 50); }}
        style={{ marginTop: 16, background: "none", border: "none", cursor: "pointer",
          fontFamily: F.body, fontSize: 13, color: C.softGray, textDecoration: "underline",
          padding: "4px 8px" }}>
        Doesn't need charging
      </button>

      <div style={{ marginTop: 24, fontFamily: F.body, fontSize: 13, color: C.softGray }}>
        {idx + 1} of {notCharged.length} remaining
      </div>

      <div style={{ marginTop: 32, width: "100%", maxWidth: 400 }}>
        <button onClick={() => setShowAll(!showAll)} style={{ width: "100%", background: "none", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontFamily: F.body, fontSize: 13, fontWeight: 500, color: C.teal, padding: "8px 0" }}>
          <ChevronRight size={14} style={{ transform: showAll ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
          View all charges ({doneCount}/{needCharge.length})
        </button>
        {showAll && (
          <div style={{ background: C.warmWhite, borderRadius: 14, padding: "12px 16px", marginTop: 8,
            border: `1px solid ${C.borderLight}`, maxHeight: 320, overflow: "auto" }}>
            {needCharge.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px",
                borderBottom: `1px solid ${C.borderLight}` }}>
                <button onClick={() => onToggleCharged(item.id)} style={{ width: 28, height: 28, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  border: item.charged ? "none" : `2px solid ${C.borderMedium}`,
                  background: item.charged ? `linear-gradient(135deg,${C.sage},${C.sageDark})` : "transparent",
                  transition: "all .2s", flexShrink: 0 }}>
                  {item.charged && <Check size={14} color="#fff" strokeWidth={3} />}
                </button>
                <span style={{ fontFamily: F.body, fontSize: 14, color: item.charged ? C.softGray : C.charcoal,
                  textDecoration: item.charged ? "line-through" : "none", opacity: item.charged ? .6 : 1,
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
