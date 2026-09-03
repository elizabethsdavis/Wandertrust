// Focus Pack — card-by-card guided packing.
import { useState, useMemo } from "react";
import { Check, ArrowLeft, AlertTriangle, RefreshCw, BatteryCharging, WashingMachine } from "lucide-react";
import { C, F } from "../lib/theme";
import { ProgressRing, Btn } from "./ui";

// ── Guided Pack Mode ──
export function GuidedPack({ items, onToggle, onToggleRefilled, onToggleCharged, onToggleWashed, onRemove, onExit, tripName }) {
  const unpacked = items.filter(i => !i.packed);
  const [idx, setIdx] = useState(0);
  const flat = useMemo(() => {
    const m = {};
    unpacked.forEach(i => { if (!m[i.section]) m[i.section] = []; m[i.section].push(i); });
    return Object.values(m).flat();
  }, [unpacked]);
  const cur = flat[idx];
  const pk = items.filter(i => i.packed).length, pct = Math.round(pk / items.length * 100);

  // How many items remain in this section from current index forward
  const sectionRemaining = cur ? flat.slice(idx).filter(i => i.section === cur.section).length : 0;

  const skipSection = () => {
    if (!cur) return;
    const sec = cur.section;
    let next = idx;
    while (next < flat.length && flat[next].section === sec) next++;
    setIdx(Math.min(next, flat.length - 1));
  };

  if (!cur) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "70vh", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🎉</div>
        <h2 style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 500, marginBottom: 12 }}>All packed!</h2>
        <p style={{ fontFamily: F.body, fontSize: 16, color: C.warmGray, marginBottom: 32 }}>{tripName} is going to be amazing.</p>
        <Btn v="sage" sz="lg" onClick={onExit}>Back to trip</Btn>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg,${C.cream},${C.warmWhite})`,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, background: "none",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
        <ArrowLeft size={18} /> Exit focus mode
      </button>
      <ProgressRing pct={pct} size={140} sw={8}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 500 }}>{pct}%</div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, textTransform: "uppercase", letterSpacing: ".08em" }}>packed</div>
        </div>
      </ProgressRing>
      <div style={{ marginTop: 48, textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".1em", color: C.copper, marginBottom: 12 }}>{cur.section}</div>
        <h2 style={{ fontFamily: F.display, fontSize: 40, color: C.charcoal, fontWeight: 400, marginBottom: 8, lineHeight: 1.2 }}>
          {cur.name}
        </h2>
        {cur.ff && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.amberGlow,
            padding: "6px 14px", borderRadius: 10, marginTop: 8 }}>
            <AlertTriangle size={14} color={C.amber} />
            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.amber }}>Frequently forgotten!</span>
          </div>
        )}
        {cur.needsRefill && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
            background: cur.refilled ? C.sageGlow : C.amberGlow,
            padding: "6px 14px", borderRadius: 10, border: `1px solid ${cur.refilled ? "rgba(139,168,136,.2)" : "rgba(212,160,74,.2)"}` }}>
            {cur.refilled ? <Check size={14} color={C.sage} /> : <RefreshCw size={14} color={C.amber} />}
            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600,
              color: cur.refilled ? C.sage : C.amber }}>
              {cur.refilled ? "Refilled!" : "Needs refill"}
            </span>
          </div>
        )}
        {cur.needsCharge && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
            background: cur.charged ? C.sageGlow : C.tealGlow,
            padding: "6px 14px", borderRadius: 10, border: `1px solid ${cur.charged ? "rgba(139,168,136,.2)" : "rgba(78,173,197,.2)"}` }}>
            {cur.charged ? <Check size={14} color={C.sage} /> : <BatteryCharging size={14} color={C.teal} />}
            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600,
              color: cur.charged ? C.sage : C.teal }}>
              {cur.charged ? "Charged!" : "Needs charge"}
            </span>
          </div>
        )}
        {cur.needsWash && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
            background: cur.washed ? C.sageGlow : C.lavenderGlow,
            padding: "6px 14px", borderRadius: 10, border: `1px solid ${cur.washed ? "rgba(139,168,136,.2)" : "rgba(155,142,196,.2)"}` }}>
            {cur.washed ? <Check size={14} color={C.sage} /> : <WashingMachine size={14} color={C.lavender} />}
            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600,
              color: cur.washed ? C.sage : C.lavender }}>
              {cur.washed ? "Clean!" : "Needs wash"}
            </span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 48, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn v="sage" sz="lg" onClick={() => { onToggle(cur.id); setTimeout(() => setIdx(i => Math.min(i, flat.length - 2)), 50); }}
          style={{ minWidth: 160 }}><Check size={20} /> Packed it</Btn>
        {cur.needsRefill && !cur.refilled && (
          <Btn v="amber" sz="lg" onClick={() => onToggleRefilled(cur.id)}
            style={{ minWidth: 140 }}>
            <RefreshCw size={18} /> Refilled
          </Btn>
        )}
        {cur.needsCharge && !cur.charged && (
          <Btn v="teal" sz="lg" onClick={() => onToggleCharged(cur.id)}
            style={{ minWidth: 140 }}>
            <BatteryCharging size={18} /> Charged
          </Btn>
        )}
        {cur.needsWash && !cur.washed && (
          <Btn v="lavender" sz="lg" onClick={() => onToggleWashed?.(cur.id)}
            style={{ minWidth: 140 }}>
            <WashingMachine size={18} /> Clean
          </Btn>
        )}
        <Btn v="secondary" sz="lg" onClick={() => setIdx(i => Math.min(i + 1, flat.length - 1))} style={{ minWidth: 120 }}>Skip</Btn>
      </div>

      {/* Secondary actions */}
      <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => { onRemove(cur.id); setTimeout(() => setIdx(i => Math.min(i, flat.length - 2)), 50); }}
          style={{ background: "none", border: "none", cursor: "pointer",
            fontFamily: F.body, fontSize: 13, color: C.softGray, textDecoration: "underline",
            padding: "4px 8px" }}>
          Don't need for trip
        </button>
        {sectionRemaining > 1 && (
          <button onClick={skipSection}
            style={{ background: "none", border: "none", cursor: "pointer",
              fontFamily: F.body, fontSize: 13, color: C.softGray, textDecoration: "underline",
              padding: "4px 8px" }}>
            Skip {cur.section} ({sectionRemaining} items)
          </button>
        )}
      </div>

      <div style={{ marginTop: 24, fontFamily: F.body, fontSize: 13, color: C.softGray }}>
        {idx + 1} of {flat.length} remaining
      </div>
    </div>
  );
}
