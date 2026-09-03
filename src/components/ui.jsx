// Small shared primitives: progress ring, button, mini bar chart.
import { useState } from "react";
import { C, F } from "../lib/theme";

export function ProgressRing({ pct, size = 120, sw = 6, children }) {
  const r = (size - sw) / 2, circ = r * 2 * Math.PI, off = circ - (pct / 100) * circ;
  const col = pct === 100 ? C.sage : pct > 60 ? C.copperLight : C.copper;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.creamDark} strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1), stroke 0.5s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

export function Btn({ children, v = "primary", sz = "md", onClick, style, disabled, ...p }) {
  const [pr, setPr] = useState(false);
  const styles = {
    primary: { background: `linear-gradient(135deg,${C.copper},${C.copperLight})`, color: "#fff", boxShadow: `0 2px 12px rgba(193,127,89,.3)` },
    secondary: { background: C.warmWhite, color: C.copper, border: `1.5px solid ${C.borderMedium}`, boxShadow: `0 1px 4px ${C.shadow}` },
    ghost: { background: "transparent", color: C.warmGray },
    sage: { background: `linear-gradient(135deg,${C.sage},${C.sageLight})`, color: "#fff", boxShadow: `0 2px 12px rgba(139,168,136,.3)` },
    danger: { background: C.dangerGlow, color: C.danger, border: `1.5px solid rgba(199,91,91,.2)` },
    lavender: { background: `linear-gradient(135deg,${C.lavender},#B8A8D8)`, color: "#fff", boxShadow: `0 2px 12px rgba(155,142,196,.3)` },
    teal: { background: `linear-gradient(135deg,${C.teal},#6BC4D8)`, color: "#fff", boxShadow: `0 2px 12px rgba(78,173,197,.3)` },
    amber: { background: `linear-gradient(135deg,${C.amber},#E8B84A)`, color: "#fff", boxShadow: `0 2px 12px rgba(212,160,74,.3)` },
  };
  const pad = sz === "sm" ? "8px 16px" : sz === "lg" ? "16px 32px" : "12px 24px";
  const fs = sz === "sm" ? 13 : sz === "lg" ? 16 : 14;
  return (
    <button style={{ fontFamily: F.body, fontWeight: 500, border: "none", cursor: disabled ? "default" : "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      transition: "all .2s cubic-bezier(.4,0,.2,1)", transform: pr ? "scale(.97)" : "scale(1)",
      opacity: disabled ? .5 : 1, borderRadius: 14, padding: pad, fontSize: fs, letterSpacing: ".01em",
      ...styles[v], ...style }}
      onClick={disabled ? undefined : onClick} onMouseDown={() => !disabled && setPr(true)}
      onMouseUp={() => setPr(false)} onMouseLeave={() => setPr(false)} {...p}>
      {children}
    </button>
  );
}

// ── Mini Bar Chart ──
export function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: F.body, fontSize: 12, color: C.charcoal }}>{label}</span>
        <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color }}>{value}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: C.creamDark, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${color}, ${color}99)`,
          transition: "width .6s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}
