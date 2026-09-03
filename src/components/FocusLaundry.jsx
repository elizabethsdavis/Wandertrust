// Focus Laundry — card-by-card review of clothes flagged as needing a wash before the trip.
import { useState, useMemo } from "react";
import { Check, ChevronRight, ArrowLeft, WashingMachine } from "lucide-react";
import { C, F } from "../lib/theme";
import { ProgressRing, Btn } from "./ui";

// ═══════════════════════════════════════════════════════
// FOCUS LAUNDRY
// ═══════════════════════════════════════════════════════
export function FocusLaundry({ items, onToggleWash, onToggleWashed, onExit }) {
  const needWash = useMemo(() => items.filter(i => i.needsWash), [items]);
  const notWashed = useMemo(() => needWash.filter(i => !i.washed), [needWash]);
  const [idx, setIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const cur = notWashed[idx];
  const doneCount = needWash.filter(i => i.washed).length;
  const pct = needWash.length > 0 ? Math.round((doneCount / needWash.length) * 100) : 0;

  if (!cur) {
    const allDone = needWash.length > 0 && doneCount === needWash.length;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "70vh", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>{allDone ? "🧺" : "🫧"}</div>
        <h2 style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 500, marginBottom: 12 }}>
          {allDone ? "Fresh & clean!" : needWash.length === 0 ? "Nothing to wash" : "Review complete"}
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 16, color: C.warmGray, marginBottom: 8 }}>
          {allDone ? `${needWash.length} piece${needWash.length !== 1 ? "s" : ""} washed and ready to pack.`
            : needWash.length === 0 ? "Mark clothes that need a wash from your packing list first."
            : `${doneCount} of ${needWash.length} clean. You can come back for the rest.`}
        </p>
        {needWash.length > 0 && !allDone && (
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.lavender, marginBottom: 24 }}>
            {needWash.length - doneCount} still in the laundry
          </div>
        )}
        <Btn v="sage" sz="lg" onClick={onExit}>Back to trip</Btn>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #F6F3FB 0%, ${C.cream} 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, background: "none",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
        <ArrowLeft size={18} /> Exit
      </button>

      <ProgressRing pct={pct} size={140} sw={8}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 500 }}>{pct}%</div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, textTransform: "uppercase", letterSpacing: ".08em" }}>clean</div>
        </div>
      </ProgressRing>

      <div style={{ marginTop: 48, textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".1em", color: C.copper, marginBottom: 12 }}>{cur.section}</div>
        <h2 style={{ fontFamily: F.display, fontSize: 40, color: C.charcoal, fontWeight: 400, marginBottom: 8, lineHeight: 1.2 }}>
          {cur.name}
        </h2>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.lavenderGlow,
          padding: "6px 14px", borderRadius: 10, marginTop: 8, border: "1px solid rgba(155,142,196,.2)" }}>
          <WashingMachine size={14} color={C.lavender} />
          <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.lavender }}>Needs wash</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 48, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn v="lavender" sz="lg" onClick={() => { onToggleWashed(cur.id); setTimeout(() => setIdx(i => Math.min(i, notWashed.length - 2)), 50); }}
          style={{ minWidth: 160 }}><WashingMachine size={18} /> Clean</Btn>
        <Btn v="secondary" sz="lg" onClick={() => setIdx(i => Math.min(i + 1, notWashed.length - 1))}
          style={{ minWidth: 120 }}>Skip</Btn>
      </div>

      <button onClick={() => { onToggleWash(cur.id); setTimeout(() => setIdx(i => Math.min(i, notWashed.length - 2)), 50); }}
        style={{ marginTop: 16, background: "none", border: "none", cursor: "pointer",
          fontFamily: F.body, fontSize: 13, color: C.softGray, textDecoration: "underline",
          padding: "4px 8px" }}>
        Doesn't need washing
      </button>

      <div style={{ marginTop: 24, fontFamily: F.body, fontSize: 13, color: C.softGray }}>
        {idx + 1} of {notWashed.length} remaining
      </div>

      <div style={{ marginTop: 32, width: "100%", maxWidth: 400 }}>
        <button onClick={() => setShowAll(!showAll)} style={{ width: "100%", background: "none", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontFamily: F.body, fontSize: 13, fontWeight: 500, color: C.lavender, padding: "8px 0" }}>
          <ChevronRight size={14} style={{ transform: showAll ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
          View all laundry ({doneCount}/{needWash.length})
        </button>
        {showAll && (
          <div style={{ background: C.warmWhite, borderRadius: 14, padding: "12px 16px", marginTop: 8,
            border: `1px solid ${C.borderLight}`, maxHeight: 320, overflow: "auto" }}>
            {needWash.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px",
                borderBottom: `1px solid ${C.borderLight}` }}>
                <button onClick={() => onToggleWashed(item.id)} style={{ width: 28, height: 28, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  border: item.washed ? "none" : `2px solid ${C.borderMedium}`,
                  background: item.washed ? `linear-gradient(135deg,${C.sage},${C.sageDark})` : "transparent",
                  transition: "all .2s", flexShrink: 0 }}>
                  {item.washed && <Check size={14} color="#fff" strokeWidth={3} />}
                </button>
                <span style={{ fontFamily: F.body, fontSize: 14, color: item.washed ? C.softGray : C.charcoal,
                  textDecoration: item.washed ? "line-through" : "none", opacity: item.washed ? .6 : 1,
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
