import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, Plus, Check, ChevronRight, Plane, Sparkles, ArrowLeft, X, AlertTriangle, Clock, PackageCheck, Zap, RotateCcw, Trash2, Copy, Award, TrendingUp, Brain, BarChart3, Timer, Shield, RefreshCw, Thermometer, Wind, CloudRain, Heart, Eye, Star, Loader, Shirt, Gem, Watch, Footprints, ShoppingBag, Palette, ChevronLeft, DoorOpen, Edit3, BatteryCharging } from "lucide-react";
import { usePersist } from "./lib/store";
import AccountBadge from "./components/Account";
import { C, F } from "./lib/theme";
import { id, haptic } from "./lib/utils";
import { fetchWeather } from "./lib/weather";
import { genList, genTripOtd, tempToRange } from "./lib/packing";
import { TRIP_TYPES, TEMP_RANGES, CATEGORIES } from "./data/taxonomy";
import { TEMP_RECS, SMART_RECS } from "./data/recommendations";
import { UNFREEZE_STEPS, AFFIRMATIONS } from "./data/content";
import { HIST_TRIPS } from "./data/history";

// ═══════════════════════════════════════════════════════════════
// PACKPAL v2 — Elizabeth's Personal Packing Intelligence
// ═══════════════════════════════════════════════════════════════

// Design tokens (C = palette, F = fonts) and the id/haptic helpers now live in
// shared modules — imported above. See ./lib/theme and ./lib/utils.

// ── Confetti System ──
const CONFETTI_COLORS = ["#C17F59", "#D4A574", "#8BA888", "#A8C4A5", "#D4A04A", "#E8B84A", "#9B8EC4", "#B8A8D8", "#4EADC5", "#F2C6DE", "#FFD700"];
function ConfettiBurst({ intensity = "medium", onDone }) {
  const canvasRef = useRef(null);
  const count = intensity === "big" ? 120 : intensity === "medium" ? 60 : 30;
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const W = cvs.width = window.innerWidth, H = cvs.height = window.innerHeight;
    const pieces = Array.from({ length: count }, () => ({
      x: W * (.3 + Math.random() * .4), y: H * (.3 + Math.random() * .2),
      vx: (Math.random() - .5) * (intensity === "big" ? 18 : 10),
      vy: -(Math.random() * (intensity === "big" ? 18 : 12) + 4),
      w: Math.random() * 10 + 4, h: Math.random() * 6 + 2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rot: Math.random() * 360, rotV: (Math.random() - .5) * 12,
      gravity: .25 + Math.random() * .15, drag: .98 + Math.random() * .015,
      opacity: 1, shape: Math.random() > .5 ? "rect" : "circle",
    }));
    let frame = 0, raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      pieces.forEach(p => {
        p.vy += p.gravity; p.vx *= p.drag; p.vy *= p.drag;
        p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
        if (frame > 40) p.opacity = Math.max(0, p.opacity - .018);
        if (p.opacity <= 0 || p.y > H + 20) return;
        alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        if (p.shape === "rect") ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        else { ctx.beginPath(); ctx.arc(0, 0, p.w / 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      });
      frame++;
      if (alive > 0 && frame < 200) raf = requestAnimationFrame(draw);
      else onDone?.();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }} />;
}

// ── Celebration Toast ──
const CELEBRATE_MSGS = {
  section: ["Section done!", "Crushed it!", "That's a wrap!", "Nailed it!", "On a roll!"],
  category: ["Category complete!", "Whole category — boom!", "You're unstoppable!", "Category conquered!"],
  allPacked: ["ALL PACKED!", "You legend!", "Trip-ready!", "Everything's in!"],
  allRefilled: ["All refilled!", "Restocked & ready!", "Refill champion!"],
  allCharged: ["All charged up!", "Fully juiced!", "Powered & ready!"],
  otdDone: ["Ready to go!", "Out the door!", "Nothing forgotten!"],
  outfitDone: ["Outfit complete!", "Styled & sorted!", "Looking good!"],
};
function CelebrationToast({ msg, emoji }) {
  return (
    <div style={{ position: "fixed", top: "15%", left: "50%", transform: "translateX(-50%)", zIndex: 9998,
      background: "rgba(255,255,255,.95)", backdropFilter: "blur(12px)", borderRadius: 20,
      padding: "16px 28px", boxShadow: "0 8px 40px rgba(45,41,38,.18)", textAlign: "center",
      animation: "celebToastIn .4s cubic-bezier(.34,1.56,.64,1)" }}>
      <div style={{ fontSize: 36, marginBottom: 6 }}>{emoji}</div>
      <div style={{ fontFamily: F.body, fontSize: 16, fontWeight: 600, color: C.charcoal }}>{msg}</div>
    </div>
  );
}

function useCelebration() {
  const [show, setShow] = useState(null); // { msg, emoji, intensity }
  const timerRef = useRef(null);
  const celebrate = useCallback((type, intensity = "medium") => {
    const msgs = CELEBRATE_MSGS[type] || CELEBRATE_MSGS.section;
    const emojis = { section: "🎉", category: "🏆", allPacked: "🎊", allRefilled: "✅", allCharged: "🔋", otdDone: "🚀", outfitDone: "👗" };
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    haptic("celebration");
    setShow({ msg, emoji: emojis[type] || "🎉", intensity });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(null), intensity === "big" ? 3500 : 2200);
  }, []);
  const CelebrationLayer = useCallback(() => {
    if (!show) return null;
    return (
      <>
        <ConfettiBurst intensity={show.intensity} onDone={() => { if (show.intensity !== "big") setShow(null); }} />
        <CelebrationToast msg={show.msg} emoji={show.emoji} />
      </>
    );
  }, [show]);
  return { celebrate, CelebrationLayer };
}

// TRIP_TYPES, TEMP_RANGES → ./data/taxonomy

// TEMP_RECS, SMART_RECS → ./data/recommendations

// CATEGORIES → ./data/taxonomy

// CORE, COND_ITEMS → ./data/catalog

// UNFREEZE_STEPS, AFFIRMATIONS → ./data/content

// HIST_TRIPS → ./data/history

// genList, genTripOtd → ./lib/packing

// ── Persist ──
// usePersist now lives in ./lib/store — it transparently syncs to Supabase when
// signed in, and falls back to localStorage (these same pp2_* keys) offline.
// Imported at the top of this file; the call sites below are unchanged.

// ═══════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

function ProgressRing({ pct, size = 120, sw = 6, children }) {
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

function Btn({ children, v = "primary", sz = "md", onClick, style, disabled, ...p }) {
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

function PackItem({ item, onToggle, onRemove, readOnly, refillMode, onToggleRefill, onToggleRefilled, chargeMode, onToggleCharge, onToggleCharged }) {
  const [hov, setHov] = useState(false);
  const markMode = refillMode || chargeMode;
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 2,
        borderRadius: 12, background: hov ? C.copperSubtle : "transparent", transition: "all .15s", minHeight: 44 }}>
      {/* Main checkbox: refill-mark mode, charge-mark mode, OR pack mode */}
      {refillMode ? (
        <div onClick={() => onToggleRefill?.(item.id)}
          style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            border: item.needsRefill ? "none" : `2px solid ${C.borderMedium}`,
            background: item.needsRefill ? `linear-gradient(135deg,${C.amber},#E8B84A)` : "transparent",
            transition: "all .2s", boxShadow: item.needsRefill ? `0 2px 8px rgba(212,160,74,.3)` : "none",
            cursor: "pointer" }}>
          {item.needsRefill && <RefreshCw size={13} color="#fff" strokeWidth={3} />}
        </div>
      ) : chargeMode ? (
        <div onClick={() => onToggleCharge?.(item.id)}
          style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            border: item.needsCharge ? "none" : `2px solid ${C.borderMedium}`,
            background: item.needsCharge ? `linear-gradient(135deg,${C.teal},#6BC4D8)` : "transparent",
            transition: "all .2s", boxShadow: item.needsCharge ? `0 2px 8px rgba(78,173,197,.3)` : "none",
            cursor: "pointer" }}>
          {item.needsCharge && <BatteryCharging size={13} color="#fff" strokeWidth={3} />}
        </div>
      ) : (
        <div onClick={() => { if (!readOnly) onToggle(item.id); }}
          style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            border: item.packed ? "none" : `2px solid ${C.borderMedium}`,
            background: item.packed ? `linear-gradient(135deg,${C.sage},${C.sageLight})` : "transparent",
            transition: "all .2s", boxShadow: item.packed ? `0 2px 8px rgba(139,168,136,.3)` : "none",
            cursor: readOnly ? "default" : "pointer" }}>
          {item.packed && <Check size={14} color="#fff" strokeWidth={3} />}
        </div>
      )}

      <span style={{ flex: 1, fontFamily: F.body, fontSize: 14.5, color: C.charcoal,
        textDecoration: !markMode && item.packed ? "line-through" : "none",
        opacity: !markMode && item.packed ? .5 : 1, transition: "all .2s",
        cursor: markMode ? "pointer" : readOnly ? "default" : "pointer" }}
        onClick={() => { if (refillMode) onToggleRefill?.(item.id); else if (chargeMode) onToggleCharge?.(item.id); else if (!readOnly) onToggle(item.id); }}>
        {item.name}
      </span>

      {/* Badges */}
      {!markMode && item.ff && !item.packed && (
        <span style={{ fontSize: 10, fontFamily: F.body, fontWeight: 600, color: C.amber, background: C.amberGlow,
          padding: "2px 8px", borderRadius: 6, letterSpacing: ".03em", textTransform: "uppercase", flexShrink: 0 }}>Don't forget!</span>
      )}
      {!markMode && item.essential && !item.packed && !item.ff && (
        <span style={{ fontSize: 10, fontFamily: F.body, fontWeight: 600, color: C.copper, background: C.copperGlow,
          padding: "2px 8px", borderRadius: 6, letterSpacing: ".03em", textTransform: "uppercase", flexShrink: 0 }}>Essential</span>
      )}

      {/* Inline refill indicator */}
      {!markMode && item.needsRefill && (
        <button onClick={(e) => { e.stopPropagation(); onToggleRefilled?.(item.id); }}
          title={item.refilled ? "Refilled!" : "Tap to mark as refilled"}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 8, flexShrink: 0,
            border: `1px solid ${item.refilled ? "rgba(139,168,136,.3)" : "rgba(212,160,74,.3)"}`,
            background: item.refilled ? C.sageGlow : C.amberGlow,
            cursor: "pointer", transition: "all .15s" }}>
          {item.refilled ? <Check size={11} color={C.sage} strokeWidth={3} /> : <RefreshCw size={11} color={C.amber} />}
          <span style={{ fontSize: 10, fontFamily: F.body, fontWeight: 600,
            color: item.refilled ? C.sage : C.amber,
            textTransform: "uppercase", letterSpacing: ".03em" }}>
            {item.refilled ? "Refilled" : "Refill"}
          </span>
        </button>
      )}

      {/* Inline charge indicator */}
      {!markMode && item.needsCharge && (
        <button onClick={(e) => { e.stopPropagation(); onToggleCharged?.(item.id); }}
          title={item.charged ? "Charged!" : "Tap to mark as charged"}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 8, flexShrink: 0,
            border: `1px solid ${item.charged ? "rgba(139,168,136,.3)" : "rgba(78,173,197,.3)"}`,
            background: item.charged ? C.sageGlow : C.tealGlow,
            cursor: "pointer", transition: "all .15s" }}>
          {item.charged ? <Check size={11} color={C.sage} strokeWidth={3} /> : <BatteryCharging size={11} color={C.teal} />}
          <span style={{ fontSize: 10, fontFamily: F.body, fontWeight: 600,
            color: item.charged ? C.sage : C.teal,
            textTransform: "uppercase", letterSpacing: ".03em" }}>
            {item.charged ? "Charged" : "Charge"}
          </span>
        </button>
      )}

      {refillMode && item.needsRefill && (
        <span style={{ fontSize: 10, fontFamily: F.body, fontWeight: 600, color: C.amber, background: C.amberGlow,
          padding: "2px 8px", borderRadius: 6, letterSpacing: ".03em", textTransform: "uppercase", flexShrink: 0 }}>Needs refill</span>
      )}
      {chargeMode && item.needsCharge && (
        <span style={{ fontSize: 10, fontFamily: F.body, fontWeight: 600, color: C.teal, background: C.tealGlow,
          padding: "2px 8px", borderRadius: 6, letterSpacing: ".03em", textTransform: "uppercase", flexShrink: 0 }}>Needs charge</span>
      )}

      {hov && !readOnly && !markMode && onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6,
            display: "flex", color: C.softGray }}><X size={14} /></button>
      )}
    </div>
  );
}

function PackSection({ title, items, onToggle, onRemove, onAddItem, readOnly, refillMode, onToggleRefill, onToggleRefilled, chargeMode, onToggleCharge, onToggleCharged }) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState("");
  const ref = useRef(null);
  const pk = items.filter(i => i.packed).length, tot = items.length, done = tot > 0 && pk === tot;
  useEffect(() => { if (adding && ref.current) ref.current.focus(); }, [adding]);
  const markMode = refillMode || chargeMode;
  const refillCount = refillMode ? items.filter(i => i.needsRefill).length : 0;
  const chargeCount = chargeMode ? items.filter(i => i.needsCharge).length : 0;

  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        cursor: "pointer", borderRadius: 12, transition: "background .15s" }}
        onMouseEnter={e => e.currentTarget.style.background = C.copperSubtle}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ transition: "transform .2s", transform: open ? "rotate(90deg)" : "rotate(0)" }}>
          <ChevronRight size={16} color={C.softGray} />
        </div>
        <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".08em", color: done ? C.sage : C.warmGray, flex: 1 }}>{title}</span>
        {refillMode ? (
          <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: refillCount > 0 ? C.amber : C.softGray,
            background: refillCount > 0 ? C.amberGlow : C.copperSubtle, padding: "2px 10px", borderRadius: 8 }}>
            {refillCount} refill{refillCount !== 1 ? "s" : ""}
          </span>
        ) : chargeMode ? (
          <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: chargeCount > 0 ? C.teal : C.softGray,
            background: chargeCount > 0 ? C.tealGlow : C.copperSubtle, padding: "2px 10px", borderRadius: 8 }}>
            {chargeCount} charge{chargeCount !== 1 ? "s" : ""}
          </span>
        ) : (
          <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: done ? C.sage : C.softGray,
            background: done ? C.sageGlow : C.copperSubtle, padding: "2px 10px", borderRadius: 8 }}>{pk}/{tot}</span>
        )}
      </div>
      {open && (
        <div style={{ paddingLeft: 12 }}>
          {items.map(i => <PackItem key={i.id} item={i} onToggle={onToggle} onRemove={onRemove} readOnly={readOnly}
            refillMode={refillMode} onToggleRefill={onToggleRefill} onToggleRefilled={onToggleRefilled}
            chargeMode={chargeMode} onToggleCharge={onToggleCharge} onToggleCharged={onToggleCharged} />)}
          {!readOnly && !markMode && (adding ? (
            <form onSubmit={e => { e.preventDefault(); if (nv.trim()) { onAddItem(nv.trim()); setNv(""); setAdding(false); } }}
              style={{ display: "flex", gap: 8, padding: "6px 14px" }}>
              <input ref={ref} value={nv} onChange={e => setNv(e.target.value)} placeholder="Add item..."
                onBlur={() => { if (!nv.trim()) setAdding(false); }}
                style={{ flex: 1, fontFamily: F.body, fontSize: 14, padding: "8px 12px",
                  border: `1.5px solid ${C.borderMedium}`, borderRadius: 10, background: C.warmWhite,
                  outline: "none", color: C.charcoal }}
                onFocus={e => e.target.style.borderColor = C.copper} />
              <Btn v="primary" sz="sm" onClick={() => { if (nv.trim()) { onAddItem(nv.trim()); setNv(""); setAdding(false); } }}>Add</Btn>
            </form>
          ) : (
            <button onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
              background: "none", border: "none", cursor: "pointer", fontFamily: F.body, fontSize: 13,
              color: C.softGray, borderRadius: 10, width: "100%", transition: "all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.color = C.copper; e.currentTarget.style.background = C.copperSubtle; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.softGray; e.currentTarget.style.background = "none"; }}>
              <Plus size={14} /> Add item
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mini Bar Chart ──
function MiniBar({ label, value, max, color }) {
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

// ── Freak Out Mode Component ──
function FreakOutMode({ onExit, onStartPacking }) {
  const [step, setStep] = useState(-1); // -1 = landing
  const [affIdx, setAffIdx] = useState(() => Math.floor(Math.random() * AFFIRMATIONS.length));
  const [breathing, setBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState("in");
  const [breathCount, setBreathCount] = useState(0);

  useEffect(() => {
    if (!breathing) return;
    const phases = [
      { phase: "in", dur: 4000 },
      { phase: "hold", dur: 1000 },
      { phase: "out", dur: 6000 },
    ];
    let idx = 0;
    let timer;
    const cycle = () => {
      setBreathPhase(phases[idx].phase);
      timer = setTimeout(() => {
        idx = (idx + 1) % phases.length;
        if (idx === 0) setBreathCount(c => c + 1);
        cycle();
      }, phases[idx].dur);
    };
    cycle();
    return () => clearTimeout(timer);
  }, [breathing]);

  useEffect(() => {
    if (breathCount >= 3) setBreathing(false);
  }, [breathCount]);

  // Landing
  if (step === -1) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #F0EBF5 0%, ${C.cream} 100%)`,
        display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 28px" }}>
        <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, background: "none",
          border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
          <ArrowLeft size={18} /> Back
        </button>

        <div style={{ fontSize: 64, marginBottom: 16, marginTop: 40 }}>🧠</div>
        <h1 style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 400,
          textAlign: "center", marginBottom: 8, lineHeight: 1.2 }}>
          Hey. It's okay.
        </h1>

        <div style={{ background: C.lavenderGlow, borderRadius: 16, padding: "16px 24px",
          maxWidth: 400, textAlign: "center", marginBottom: 32, border: `1px solid rgba(155,142,196,.15)` }}>
          <p style={{ fontFamily: F.body, fontSize: 15, color: C.charcoal, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
            "{AFFIRMATIONS[affIdx]}"
          </p>
        </div>

        <p style={{ fontFamily: F.body, fontSize: 15, color: C.warmGray, textAlign: "center",
          maxWidth: 380, lineHeight: 1.6, marginBottom: 32 }}>
          Your brain hit the freeze button. That's neurological, not a character flaw.
          Let's gently work through this together — no rush, no judgment.
        </p>

        <Btn v="lavender" sz="lg" onClick={() => setStep(0)} style={{ marginBottom: 16 }}>
          <Heart size={18} /> Start the unfreeze protocol
        </Btn>
        <button onClick={() => setAffIdx((affIdx + 1) % AFFIRMATIONS.length)}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.body,
            fontSize: 13, color: C.lavender, display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={14} /> Another affirmation
        </button>
      </div>
    );
  }

  const cur = UNFREEZE_STEPS[step];
  const isLast = step === UNFREEZE_STEPS.length - 1;

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #F0EBF5 0%, ${C.cream} 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 28px" }}>
      <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, background: "none",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
        <ArrowLeft size={18} /> Exit
      </button>

      {/* Progress */}
      <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
        {UNFREEZE_STEPS.map((_, i) => (
          <div key={i} style={{ width: i <= step ? 20 : 8, height: 8, borderRadius: 4,
            background: i <= step ? C.lavender : C.creamDark, transition: "all .3s" }} />
        ))}
      </div>

      <div style={{ fontSize: 56, marginBottom: 20 }}>{cur.icon}</div>
      <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400,
        textAlign: "center", marginBottom: 8 }}>
        {cur.title}
      </h2>
      <div style={{ fontFamily: F.body, fontSize: 12, color: C.lavender, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 20 }}>
        {cur.duration}
      </div>

      <p style={{ fontFamily: F.body, fontSize: 16, color: C.charcoal, textAlign: "center",
        maxWidth: 420, lineHeight: 1.7, marginBottom: 32 }}>
        {cur.body}
      </p>

      {/* Breathing exercise on step 0 */}
      {step === 0 && (
        <div style={{ marginBottom: 24 }}>
          {!breathing && breathCount < 3 ? (
            <Btn v="lavender" sz="sm" onClick={() => { setBreathing(true); setBreathCount(0); }}>
              <Wind size={15} /> Start guided breathing
            </Btn>
          ) : breathing ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 100, height: 100, borderRadius: "50%", margin: "0 auto 12px",
                background: C.lavenderGlow, display: "flex", alignItems: "center", justifyContent: "center",
                border: `3px solid ${C.lavender}`,
                transform: breathPhase === "in" ? "scale(1.3)" : breathPhase === "hold" ? "scale(1.3)" : "scale(1)",
                transition: breathPhase === "in" ? "transform 4s ease-in-out" : breathPhase === "out" ? "transform 6s ease-in-out" : "none" }}>
                <span style={{ fontFamily: F.body, fontSize: 14, fontWeight: 600, color: C.lavender, textTransform: "uppercase" }}>
                  {breathPhase === "in" ? "Breathe in..." : breathPhase === "hold" ? "Hold..." : "Breathe out..."}
                </span>
              </div>
              <span style={{ fontFamily: F.body, fontSize: 12, color: C.softGray }}>{breathCount + 1} of 3</span>
            </div>
          ) : (
            <div style={{ fontFamily: F.body, fontSize: 14, color: C.sage, textAlign: "center" }}>
              Nice. Three breaths done. You're already moving.
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        {step > 0 && <Btn v="secondary" sz="md" onClick={() => setStep(s => s - 1)}>Back</Btn>}
        {!isLast ? (
          <Btn v="lavender" sz="md" onClick={() => setStep(s => s + 1)}>
            I'm ready for the next step <ChevronRight size={16} />
          </Btn>
        ) : (
          <Btn v="sage" sz="lg" onClick={onStartPacking}>
            <Zap size={18} /> I'm ready to pack
          </Btn>
        )}
      </div>

      <div style={{ marginTop: 24, background: C.lavenderGlow, borderRadius: 12, padding: "12px 20px",
        maxWidth: 360, border: `1px solid rgba(155,142,196,.1)` }}>
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.lavender, textAlign: "center", margin: 0, fontStyle: "italic" }}>
          "{AFFIRMATIONS[(affIdx + step) % AFFIRMATIONS.length]}"
        </p>
      </div>
    </div>
  );
}

// ── Guided Pack Mode ──
function GuidedPack({ items, onToggle, onToggleRefilled, onToggleCharged, onRemove, onExit, tripName }) {
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

// ═══════════════════════════════════════════════════════
// FOCUS REFILL
// ═══════════════════════════════════════════════════════
function FocusRefill({ items, onToggleRefill, onToggleRefilled, onExit }) {
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
                  background: item.refilled ? `linear-gradient(135deg,${C.sage},${C.sageDeep})` : "transparent",
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

// ═══════════════════════════════════════════════════════
// FOCUS CHARGE
// ═══════════════════════════════════════════════════════
function FocusCharge({ items, onToggleCharge, onToggleCharged, onExit }) {
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

// ═══════════════════════════════════════════════════════
// OUT THE DOOR
// ═══════════════════════════════════════════════════════
const DEFAULT_OTD_ITEMS = [
  { name: "Passport / ID", emoji: "🪪" },
  { name: "Phone + charger", emoji: "📱" },
  { name: "Wallet + cards", emoji: "💳" },
  { name: "Keys (house + car)", emoji: "🔑" },
  { name: "Boarding pass / tickets", emoji: "🎫" },
  { name: "Suitcase zipped & locked", emoji: "🧳" },
  { name: "Carry-on bag packed", emoji: "🎒" },
  { name: "Medications", emoji: "💊" },
  { name: "Snacks + water bottle", emoji: "🍫" },
  { name: "Headphones", emoji: "🎧" },
  { name: "Sunglasses", emoji: "🕶️" },
  { name: "Lights off, AC off", emoji: "💡" },
  { name: "Windows + doors locked", emoji: "🚪" },
  { name: "Thermostat set", emoji: "🌡️" },
  { name: "Pet care arranged", emoji: "🐾" },
  { name: "Plants watered", emoji: "🌱" },
  { name: "Trash taken out", emoji: "🗑️" },
];

function OutTheDoor({ trip, otdItems, setOtdItems, otdChecked, setOtdChecked, onExit, celebrate }) {
  const [mode, setMode] = useState("focus"); // "focus" or "edit"
  const [addingItem, setAddingItem] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const addRef = useRef(null);

  useEffect(() => { if (addingItem && addRef.current) addRef.current.focus(); }, [addingItem]);

  const checked = otdChecked || {};
  const toggleCheck = (idx) => {
    const wasChecked = checked[idx];
    setOtdChecked(prev => ({ ...prev, [idx]: !prev[idx] }));
    if (!wasChecked) {
      haptic("success");
      // Check if this completes everything
      const newChecked = { ...checked, [idx]: true };
      const allDone = otdItems.every((_, i) => newChecked[i]);
      if (allDone) setTimeout(() => celebrate?.("otdDone", "big"), 200);
    }
  };
  const checkedCount = otdItems.filter((_, i) => checked[i]).length;
  const pct = otdItems.length > 0 ? Math.round((checkedCount / otdItems.length) * 100) : 0;

  // Focus mode index — skip checked items
  const unchecked = otdItems.map((item, i) => ({ ...item, idx: i })).filter(it => !checked[it.idx]);
  const [focusIdx, setFocusIdx] = useState(0);
  const cur = unchecked[focusIdx];

  const addItem = () => {
    if (newName.trim()) {
      setOtdItems(prev => [...prev, { name: newName.trim(), emoji: newEmoji || "📌" }]);
      setNewName("");
      setNewEmoji("");
      setAddingItem(false);
    }
  };

  const removeItem = (idx) => {
    setOtdItems(prev => prev.filter((_, i) => i !== idx));
    // Shift checked state
    setOtdChecked(prev => {
      const next = {};
      Object.keys(prev).forEach(k => {
        const ki = parseInt(k);
        if (ki < idx) next[ki] = prev[ki];
        else if (ki > idx) next[ki - 1] = prev[ki];
      });
      return next;
    });
  };

  // ═══ ALL DONE ═══
  if (checkedCount === otdItems.length && otdItems.length > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "80vh", padding: 40, textAlign: "center",
        background: `linear-gradient(180deg, #FFF8F2 0%, ${C.cream} 100%)` }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>🚀</div>
        <h2 style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 500, marginBottom: 8 }}>
          You're out the door!
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 16, color: C.warmGray, marginBottom: 8 }}>
          Everything's checked. Have an amazing trip.
        </p>
        <p style={{ fontFamily: F.body, fontSize: 14, color: C.softGray, marginBottom: 32 }}>
          {trip.destination} — here you come!
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Btn v="sage" sz="lg" onClick={onExit}>Back to trip</Btn>
          <Btn v="secondary" sz="lg" onClick={() => setOtdChecked({})}>
            <RotateCcw size={16} /> Reset
          </Btn>
        </div>
      </div>
    );
  }

  // ═══ EDIT MODE ═══
  if (mode === "edit") {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #FFF8F2 0%, ${C.cream} 100%)` }}>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid ${C.borderLight}`, background: "rgba(255,248,242,.95)", backdropFilter: "blur(10px)" }}>
          <button onClick={() => setMode("focus")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ArrowLeft size={20} color={C.warmGray} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper }}>Edit Checklist</div>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{otdItems.length} items</div>
          </div>
          <Btn v="sage" sz="sm" onClick={() => setMode("focus")}>
            <Check size={14} /> Done
          </Btn>
        </div>

        <div style={{ padding: "16px 16px 120px" }}>
          <p style={{ fontFamily: F.body, fontSize: 13, color: C.softGray, marginBottom: 16, padding: "0 4px" }}>
            Customize your out-the-door checklist for this trip. Edit the global defaults from the homepage.
          </p>

          {otdItems.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 4,
              borderRadius: 12, background: C.warmWhite, border: `1px solid ${C.borderLight}` }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{item.emoji}</span>
              <span style={{ flex: 1, fontFamily: F.body, fontSize: 14, color: C.charcoal }}>{item.name}</span>
              <button onClick={() => removeItem(i)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6,
                  display: "flex", color: C.softGray, transition: "color .15s" }}
                onMouseEnter={e => e.currentTarget.style.color = C.danger}
                onMouseLeave={e => e.currentTarget.style.color = C.softGray}>
                <X size={16} />
              </button>
            </div>
          ))}

          {/* Add new item */}
          {addingItem ? (
            <form onSubmit={(e) => { e.preventDefault(); addItem(); }}
              style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <button onClick={() => {
                const emojis = ["📌","🔑","📱","💳","🎒","💊","🎧","🧴","📄","🧥","☂️","🔌","💻","📷","🪥","✈️"];
                setNewEmoji(emojis[Math.floor(Math.random() * emojis.length)]);
              }}
                type="button"
                style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1.5px solid ${C.borderMedium}`, background: C.cream, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>
                {newEmoji || "📌"}
              </button>
              <input ref={addRef} value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Laptop charger, Travel pillow..."
                onBlur={() => { if (!newName.trim()) setTimeout(() => setAddingItem(false), 150); }}
                style={{ flex: 1, fontFamily: F.body, fontSize: 14, padding: "10px 14px",
                  border: `1.5px solid ${C.borderMedium}`, borderRadius: 10,
                  background: C.warmWhite, outline: "none", color: C.charcoal }}
                onFocus={e => e.target.style.borderColor = C.copper} />
              <Btn v="primary" sz="sm" onClick={addItem}>Add</Btn>
            </form>
          ) : (
            <button onClick={() => setAddingItem(true)}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 14, marginTop: 8,
                border: `2px dashed ${C.borderMedium}`, background: "transparent",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: F.body, fontSize: 14, color: C.copper, transition: "all .15s" }}
              onMouseEnter={e => e.currentTarget.style.background = C.copperSubtle}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Plus size={16} /> Add item
            </button>
          )}

          {/* Reset to defaults */}
          <button onClick={() => { if (confirm("Reset to global defaults? Trip-specific edits will be lost.")) { setOtdItems(DEFAULT_OTD_ITEMS); setOtdChecked({}); } }}
            style={{ width: "100%", padding: "12px", borderRadius: 10, marginTop: 16,
              border: "none", background: "transparent", cursor: "pointer",
              fontFamily: F.body, fontSize: 12, color: C.softGray, textAlign: "center" }}>
            Reset to defaults
          </button>
        </div>
      </div>
    );
  }

  // ═══ FOCUS MODE ═══
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #FFF8F2 0%, ${C.cream} 100%)`,
      display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${C.borderLight}`, background: "rgba(255,248,242,.95)", backdropFilter: "blur(10px)" }}>
        <button onClick={onExit} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ArrowLeft size={20} color={C.warmGray} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper,
            display: "flex", alignItems: "center", gap: 6 }}>
            <DoorOpen size={15} /> Out the Door
          </div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>
            {checkedCount} of {otdItems.length} checked
          </div>
        </div>
        <button onClick={() => setMode("edit")}
          style={{ background: C.copperSubtle, border: `1px solid ${C.borderLight}`, borderRadius: 10,
            padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            fontFamily: F.body, fontSize: 12, fontWeight: 500, color: C.copper }}>
          <Edit3 size={13} /> Edit list
        </button>
      </div>

      {/* Focus card */}
      {cur ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
          <ProgressRing pct={pct} size={120} sw={7}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 500 }}>{pct}%</div>
              <div style={{ fontFamily: F.body, fontSize: 10, color: C.softGray, textTransform: "uppercase", letterSpacing: ".08em" }}>ready</div>
            </div>
          </ProgressRing>

          <div style={{ marginTop: 40 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{cur.emoji}</div>
            <h2 style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 400, marginBottom: 8, lineHeight: 1.2 }}>
              {cur.name}
            </h2>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.softGray }}>
              {focusIdx + 1} of {unchecked.length} remaining
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 40 }}>
            <Btn v="sage" sz="lg" onClick={() => {
              toggleCheck(cur.idx);
              // Don't advance focusIdx — the item leaves unchecked array automatically
            }} style={{ minWidth: 160 }}>
              <Check size={20} /> Got it
            </Btn>
            <Btn v="secondary" sz="lg" onClick={() => setFocusIdx(i => Math.min(i + 1, unchecked.length - 1))}
              style={{ minWidth: 100 }}>Skip</Btn>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🚀</div>
          <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 500 }}>All clear!</h2>
        </div>
      )}

      {/* Quick-check list at bottom */}
      <div style={{ padding: "0 16px 24px" }}>
        <details>
          <summary style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: ".06em", color: C.warmGray, cursor: "pointer", padding: "8px 4px",
            listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
            <ChevronRight size={14} /> Full checklist
          </summary>
          <div style={{ marginTop: 8, background: C.warmWhite, borderRadius: 14, border: `1px solid ${C.borderLight}`,
            padding: "4px 0", maxHeight: 280, overflowY: "auto" }}>
            {otdItems.map((item, i) => {
              const done = !!checked[i];
              return (
                <div key={i} onClick={() => toggleCheck(i)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    cursor: "pointer", borderRadius: 10, transition: "background .15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.copperSubtle}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: done ? "none" : `2px solid ${C.borderMedium}`,
                    background: done ? `linear-gradient(135deg,${C.sage},${C.sageLight})` : "transparent",
                    transition: "all .2s" }}>
                    {done && <Check size={13} color="#fff" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 16 }}>{item.emoji}</span>
                  <span style={{ flex: 1, fontFamily: F.body, fontSize: 13, color: C.charcoal,
                    textDecoration: done ? "line-through" : "none", opacity: done ? .5 : 1 }}>
                    {item.name}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      </div>
    </div>
  );
}

// ── Global OTD Editor ──
function GlobalOtdEditor({ items, setItems, onExit }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const addRef = useRef(null);
  useEffect(() => { if (adding && addRef.current) addRef.current.focus(); }, [adding]);

  const doAdd = () => {
    if (newName.trim()) {
      setItems(prev => [...prev, { name: newName.trim(), emoji: newEmoji || "📌" }]);
      setNewName(""); setNewEmoji(""); setAdding(false);
      haptic("success");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #FFF8F2 0%, ${C.cream} 100%)` }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${C.borderLight}`, background: "rgba(255,248,242,.95)", backdropFilter: "blur(10px)" }}>
        <button onClick={onExit} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ArrowLeft size={20} color={C.warmGray} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F.body, fontSize: 15, fontWeight: 600, color: C.charcoal }}>Out the Door Defaults</div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{items.length} items · Starting list for every new trip</div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 120px" }}>
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.warmGray, marginBottom: 16, padding: "0 4px", lineHeight: 1.5 }}>
          This is your global out-the-door checklist. New trips start with a copy of this list — you can then customize it per trip.
        </p>

        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 4,
            borderRadius: 12, background: C.warmWhite, border: `1px solid ${C.borderLight}` }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{item.emoji}</span>
            <span style={{ flex: 1, fontFamily: F.body, fontSize: 14, color: C.charcoal }}>{item.name}</span>
            <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6,
                display: "flex", color: C.softGray, transition: "color .15s" }}
              onMouseEnter={e => e.currentTarget.style.color = C.danger}
              onMouseLeave={e => e.currentTarget.style.color = C.softGray}>
              <X size={16} />
            </button>
          </div>
        ))}

        {adding ? (
          <form onSubmit={e => { e.preventDefault(); doAdd(); }}
            style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <button onClick={() => {
              const emojis = ["📌","🔑","📱","💳","🎒","💊","🎧","🧴","📄","🧥","☂️","🔌","💻","📷","🪥","✈️"];
              setNewEmoji(emojis[Math.floor(Math.random() * emojis.length)]);
            }} type="button"
              style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                border: `1.5px solid ${C.borderMedium}`, background: C.cream, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>
              {newEmoji || "📌"}
            </button>
            <input ref={addRef} value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Laptop charger, Travel pillow..."
              onBlur={() => { if (!newName.trim()) setTimeout(() => setAdding(false), 150); }}
              style={{ flex: 1, fontFamily: F.body, fontSize: 14, padding: "10px 14px",
                border: `1.5px solid ${C.borderMedium}`, borderRadius: 10,
                background: C.warmWhite, outline: "none", color: C.charcoal }}
              onFocus={e => e.target.style.borderColor = C.copper} />
            <Btn v="primary" sz="sm" onClick={doAdd}>Add</Btn>
          </form>
        ) : (
          <button onClick={() => setAdding(true)}
            style={{ width: "100%", padding: "14px 16px", borderRadius: 14, marginTop: 8,
              border: `2px dashed ${C.borderMedium}`, background: "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: F.body, fontSize: 14, color: C.copper, transition: "all .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = C.copperSubtle}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <Plus size={16} /> Add item
          </button>
        )}

        <button onClick={() => { if (confirm("Reset to factory defaults? Your customizations will be lost.")) { setItems(DEFAULT_OTD_ITEMS); } }}
          style={{ width: "100%", padding: "12px", borderRadius: 10, marginTop: 16,
            border: "none", background: "transparent", cursor: "pointer",
            fontFamily: F.body, fontSize: 12, color: C.softGray, textAlign: "center" }}>
          Reset to factory defaults
        </button>
      </div>
    </div>
  );
}

// ── Smart Recommendations Step ──
function SmartRecsView({ tripTypes, tempRange, onAdd, onClose }) {
  const [added, setAdded] = useState(new Set());
  const types = Array.isArray(tripTypes) ? tripTypes : [tripTypes];

  // Gather recs
  const typeRecs = [];
  types.forEach(t => {
    if (SMART_RECS[t]) {
      SMART_RECS[t].forEach(r => {
        if (!typeRecs.find(x => x.name === r.name)) typeRecs.push({ ...r, source: t });
      });
    }
  });

  const tempItems = tempRange && TEMP_RECS[tempRange] ? TEMP_RECS[tempRange] : [];

  const handleAdd = (name) => {
    setAdded(prev => new Set([...prev, name]));
    onAdd(name);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.cream }}>
      <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${C.borderLight}`, background: "rgba(253,248,240,.95)" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ArrowLeft size={20} color={C.warmGray} />
        </button>
        <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>Smart Recommendations</span>
      </div>

      <div style={{ padding: "24px 20px" }}>
        <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>
          Items you might want
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 24 }}>
          Curated for your trip type and weather. Tap to add to your list.
        </p>

        {/* Trip-type recs */}
        {typeRecs.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Sparkles size={16} color={C.copper} />
              <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper,
                textTransform: "uppercase", letterSpacing: ".05em" }}>
                For your {types.map(t => TRIP_TYPES.find(tt => tt.id === t)?.label).join(" + ")} trip
              </span>
            </div>
            {typeRecs.map(r => {
              const isAdded = added.has(r.name);
              return (
                <div key={r.name} onClick={() => !isAdded && handleAdd(r.name)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                    marginBottom: 6, borderRadius: 14, cursor: isAdded ? "default" : "pointer",
                    background: isAdded ? C.sageGlow : C.warmWhite,
                    border: `1px solid ${isAdded ? "rgba(139,168,136,.2)" : C.borderLight}`,
                    transition: "all .2s", opacity: isAdded ? .7 : 1 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    background: isAdded ? `linear-gradient(135deg,${C.sage},${C.sageLight})` : C.copperGlow }}>
                    {isAdded ? <Check size={16} color="#fff" /> : <Plus size={16} color={C.copper} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.charcoal,
                      textDecoration: isAdded ? "line-through" : "none" }}>{r.name}</div>
                    <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>{r.why}</div>
                  </div>
                  {!isAdded && <span style={{ fontFamily: F.body, fontSize: 11, color: C.copper, fontWeight: 500 }}>+ Add</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Temperature recs */}
        {tempItems.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Thermometer size={16} color={C.teal} />
              <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.teal,
                textTransform: "uppercase", letterSpacing: ".05em" }}>
                For {TEMP_RANGES.find(t => t.id === tempRange)?.label} weather ({TEMP_RANGES.find(t => t.id === tempRange)?.range})
              </span>
            </div>
            {tempItems.map(r => {
              const isAdded = added.has(r.name);
              return (
                <div key={r.name} onClick={() => !isAdded && handleAdd(r.name)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                    marginBottom: 6, borderRadius: 14, cursor: isAdded ? "default" : "pointer",
                    background: isAdded ? C.sageGlow : C.warmWhite,
                    border: `1px solid ${isAdded ? "rgba(139,168,136,.2)" : C.borderLight}`,
                    transition: "all .2s", opacity: isAdded ? .7 : 1 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    background: isAdded ? `linear-gradient(135deg,${C.sage},${C.sageLight})` : C.tealGlow }}>
                    {isAdded ? <Check size={16} color="#fff" /> : <Plus size={16} color={C.teal} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.charcoal,
                      textDecoration: isAdded ? "line-through" : "none" }}>{r.name}</div>
                    <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>{r.why}</div>
                  </div>
                  {!isAdded && <span style={{ fontFamily: F.body, fontSize: 11, color: C.teal, fontWeight: 500 }}>+ Add</span>}
                </div>
              );
            })}
          </div>
        )}

        {typeRecs.length === 0 && tempItems.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.softGray, fontFamily: F.body }}>
            No additional recommendations for this trip configuration.
          </div>
        )}
      </div>
    </div>
  );
}

// fetchWeather → ./lib/weather

// tempToRange → ./lib/packing

// ── Insights Component (Visual) ──
function Insights({ trips }) {
  const total = trips.length + HIST_TRIPS.length;
  const avgItems = trips.length > 0 ? Math.round(trips.reduce((s, t) => s + (t.items?.length || 0), 0) / trips.length) : 0;
  const completed = trips.filter(t => { const p = (t.items || []).filter(i => i.packed).length; return p === (t.items || []).length && (t.items || []).length > 0; }).length;

  // Trip type distribution
  const typeCounts = {};
  [...trips, ...HIST_TRIPS.map(t => ({ tripType: [t.type] }))].forEach(t => {
    const types = t.tripType || [t.type];
    (Array.isArray(types) ? types : [types]).forEach(tt => { typeCounts[tt] = (typeCounts[tt] || 0) + 1; });
  });
  const maxTypeCount = Math.max(...Object.values(typeCounts), 1);

  // Category packing rates
  const catStats = {};
  trips.forEach(t => {
    (t.items || []).forEach(i => {
      if (!catStats[i.category]) catStats[i.category] = { packed: 0, total: 0 };
      catStats[i.category].total++;
      if (i.packed) catStats[i.category].packed++;
    });
  });

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total Trips", value: total, icon: <Plane size={18} />, col: C.copper },
          { label: "Avg Items", value: avgItems, icon: <PackageCheck size={18} />, col: C.sage },
          { label: "Fully Packed", value: completed, icon: <Award size={18} />, col: C.teal },
        ].map(({ label, value, icon, col }) => (
          <div key={label} style={{ background: C.warmWhite, borderRadius: 16, padding: "20px 16px",
            border: `1px solid ${C.borderLight}`, textAlign: "center" }}>
            <div style={{ color: col, marginBottom: 8, display: "flex", justifyContent: "center" }}>{icon}</div>
            <div style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 500 }}>{value}</div>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, textTransform: "uppercase",
              letterSpacing: ".06em", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Trip Type Distribution */}
      <div style={{ background: C.warmWhite, borderRadius: 16, padding: 20, border: `1px solid ${C.borderLight}`, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <BarChart3 size={16} color={C.copper} />
          <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper,
            textTransform: "uppercase", letterSpacing: ".05em" }}>Trip type breakdown</span>
        </div>
        {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
          const tt = TRIP_TYPES.find(t => t.id === type);
          return <MiniBar key={type} label={`${tt?.icon || ""} ${tt?.label || type}`} value={count} max={maxTypeCount} color={tt?.color || C.copper} />;
        })}
      </div>

      {/* Category Completion (if data) */}
      {Object.keys(catStats).length > 0 && (
        <div style={{ background: C.warmWhite, borderRadius: 16, padding: 20, border: `1px solid ${C.borderLight}`, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} color={C.sage} />
            <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.sage,
              textTransform: "uppercase", letterSpacing: ".05em" }}>Packing completion by category</span>
          </div>
          {CATEGORIES.map(cat => {
            const s = catStats[cat.id];
            if (!s) return null;
            const pct = s.total > 0 ? Math.round(s.packed / s.total * 100) : 0;
            return <MiniBar key={cat.id} label={`${cat.icon} ${cat.label}`} value={pct} max={100} color={cat.color} />;
          })}
        </div>
      )}

      {/* Blind Spots */}
      <div style={{ background: C.amberGlow, borderRadius: 16, padding: 20,
        border: `1px solid rgba(212,160,74,.2)`, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Brain size={16} color={C.amber} />
          <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.amber,
            textTransform: "uppercase", letterSpacing: ".05em" }}>Your blind spots</span>
        </div>
        <p style={{ fontFamily: F.body, fontSize: 14, color: C.charcoal, lineHeight: 1.5, margin: 0 }}>
          Hair products are forgotten on ~60% of your trips. Edge control, hair mousse, and brushes are the top culprits.
          PackPal now auto-flags these with "Don't forget!" badges.
        </p>
      </div>

      {/* Patterns */}
      <div style={{ background: C.warmWhite, borderRadius: 16, padding: 20, border: `1px solid ${C.borderLight}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Star size={16} color={C.copper} />
          <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper,
            textTransform: "uppercase", letterSpacing: ".05em" }}>Packing intelligence</span>
        </div>
        {[
          { fact: "7-supplement stack is your non-negotiable core", detail: "Pre-loaded on every trip" },
          { fact: "Skincare: 10+ AM, 8+ PM products", detail: "Organized by routine sequence" },
          { fact: "Tech setup: 5 cables + 3 power blocks minimum", detail: "Never caught without charge" },
          { fact: "Away luggage system appears on 95% of trips", detail: "Your consistent travel foundation" },
          { fact: "Satin pillowcase + bonnet are essential", detail: "Historically forgotten but critical for you" },
        ].map(({ fact, detail }) => (
          <div key={fact} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: C.copper, marginTop: 7, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: F.body, fontSize: 14, color: C.charcoal, lineHeight: 1.4 }}>{fact}</div>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>{detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// OUTFIT BUILDER
// ═══════════════════════════════════════════════════════

const OUTFIT_SLOTS = [
  { id: "top", label: "Top", icon: <Shirt size={18} />, emoji: "👚", color: C.copper, placeholder: "e.g. Cream cashmere top, Black contour top..." },
  { id: "bottom", label: "Bottoms", icon: <Palette size={18} />, emoji: "👖", color: "#7BA3C9", placeholder: "e.g. Blue Zevelyn jeans, Flowy sheer pants..." },
  { id: "layer", label: "Layer / Jacket", icon: <Shield size={18} />, emoji: "🧥", color: "#8B7355", optional: true, placeholder: "e.g. Black leather jacket, Cream puffer..." },
  { id: "shoes", label: "Shoes", icon: <Footprints size={18} />, emoji: "👟", color: C.sage, placeholder: "e.g. Black Doc Martens, Gold sandals..." },
  { id: "bag", label: "Bag / Purse", icon: <ShoppingBag size={18} />, emoji: "👜", color: "#C47EAA", placeholder: "e.g. Black Longchamp, Gold clutch..." },
  { id: "necklace", label: "Necklace(s)", icon: <Gem size={18} />, emoji: "📿", color: C.copperLight, optional: true, multi: true, placeholder: "e.g. Gold layered necklace, Faux diamond pendant..." },
  { id: "bracelet", label: "Bracelet(s)", icon: <Watch size={18} />, emoji: "💎", color: C.amber, optional: true, multi: true, placeholder: "e.g. Gold cuff bracelet, Sparkly bangle..." },
  { id: "eyewear", label: "Eyewear", icon: <Eye size={18} />, emoji: "🕶️", color: C.teal, optional: true, multi: true, placeholder: "e.g. Artsy Sunglasses, Gold Eyeglasses..." },
  { id: "hair", label: "Hair Accessory", icon: <Star size={18} />, emoji: "✨", color: C.lavender, optional: true, multi: true, placeholder: "e.g. Hair clips, Headband, Scarf..." },
];

const DAY_EMOJIS = ["✈️", "☀️", "🌤️", "⭐", "🌸", "🎯", "💫", "🌊", "🏔️", "🎉", "🌺", "⚡", "🦋", "🌙", "🍂"];
const OCCASION_TYPES = [
  { id: "daytime", label: "Daytime", icon: "☀️" },
  { id: "evening", label: "Evening", icon: "🌙" },
  { id: "activity", label: "Activity", icon: "🏃‍♀️" },
  { id: "special", label: "Special Event", icon: "✨" },
];

function parseItemMeta(name) {
  const lower = name.toLowerCase();
  const colors = ["black", "white", "cream", "gold", "pink", "blue", "navy", "brown", "tan", "turquoise", "lavender", "green", "red", "rose gold", "silver", "fawn", "sparkly"];
  const brands = ["zevelyn", "diarrablu", "longchamp", "doc marten", "gucci", "fenty", "nike", "ugg", "birkenstock", "away", "heattech"];
  const foundColor = colors.find(c => lower.includes(c)) || null;
  const foundBrand = brands.find(b => lower.includes(b)) || null;
  return { color: foundColor, brand: foundBrand };
}

function colorToHex(name) {
  const map = { black: "#2D2926", white: "#F5F0EB", cream: "#F5EDE0", gold: "#D4A04A", pink: "#D4889A", blue: "#7BA3C9",
    navy: "#3B5175", brown: "#8B7355", tan: "#C4A882", turquoise: "#4EADC5", lavender: "#9B8EC4", green: "#8BA888",
    red: "#C75B5B", "rose gold": "#C9A08B", silver: "#A8A8A8", fawn: "#C4A882", sparkly: "#D4A04A" };
  return map[name] || C.copperLight;
}

function WardrobeCarousel({ slotId, wardrobe, onSelect, selected, onRemoveItem }) {
  const items = (wardrobe[slotId] || []);
  const scrollRef = useRef(null);
  // selected can be a string (single) or array (multi)
  const selArr = Array.isArray(selected) ? selected : selected ? [selected] : [];

  // Group by color for visual organization
  const grouped = useMemo(() => {
    const colorMap = {};
    items.forEach(item => {
      const meta = parseItemMeta(item);
      const key = meta.color || "other";
      if (!colorMap[key]) colorMap[key] = [];
      colorMap[key].push(item);
    });
    return Object.entries(colorMap).sort((a, b) => b[1].length - a[1].length);
  }, [items]);

  const allItems = grouped.flatMap(([, items]) => items);

  return (
    <div>
      {allItems.length > 0 && (
        <div ref={scrollRef} style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8,
          scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}>
          {allItems.map((item, i) => {
            const meta = parseItemMeta(item);
            const isSel = selArr.includes(item);
            return (
              <div key={`${item}-${i}`} style={{ position: "relative", flexShrink: 0 }}>
                <button onClick={() => onSelect(item)}
                  style={{ minWidth: 130, maxWidth: 160, padding: "12px 14px", borderRadius: 14, width: "100%",
                    border: `2px solid ${isSel ? C.copper : C.borderLight}`,
                    background: isSel ? C.copperGlow : C.warmWhite,
                    cursor: "pointer", textAlign: "left", transition: "all .2s",
                    transform: isSel ? "scale(1.02)" : "scale(1)",
                    boxShadow: isSel ? `0 4px 16px rgba(193,127,89,.2)` : `0 1px 4px ${C.shadow}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    {meta.color && <div style={{ width: 10, height: 10, borderRadius: 5,
                      background: colorToHex(meta.color), border: meta.color === "white" ? `1px solid ${C.borderLight}` : "none" }} />}
                    {meta.brand && <span style={{ fontFamily: F.body, fontSize: 9, fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: ".05em", color: C.softGray }}>{meta.brand}</span>}
                  </div>
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

function slotToSection(slotId) {
  return slotId === "shoes" ? "Shoes" : slotId === "bag" ? "Bags & Purses" :
    slotId === "necklace" || slotId === "bracelet" ? "Jewelry" :
    slotId === "eyewear" ? "Eyewear" : slotId === "hair" ? "Hair Accessories" :
    slotId === "layer" ? "Outerwear" : "Clothing";
}

function collectUniqueOutfitItems(occasions) {
  const uniqueItems = new Map();
  occasions.forEach((dayOccs) => {
    dayOccs.forEach((occ) => {
      Object.entries(occ.slots).forEach(([slotId, val]) => {
        // Handle multi-select (array) and single (string) values
        const values = Array.isArray(val) ? val : val ? [val] : [];
        values.forEach(v => {
          if (v && !uniqueItems.has(v.toLowerCase())) {
            uniqueItems.set(v.toLowerCase(), { name: v, section: slotToSection(slotId) });
          }
        });
      });
    });
  });
  return Array.from(uniqueItems.values());
}

const OCCASION_EMOJIS = [
  "☀️","🌙","🏃‍♀️","✨","🍽️","🥂","💼","🎭","🛍️","🏖️","🎶","💃","🧘","⛷️","🎪","🏊","🚶‍♀️","🍳",
  "☕","🎉","🎂","💐","📸","🏛️","⛪","🎓","👰","🧖‍♀️","🏋️","🚴","🧗","🎿","⛵","🎨","🎬",
  "🍕","🍷","🎤","🪩","🌅","🌃","❄️","🔥","🦋","🌺","🌈","💎","🪷","🫧"
];

function OutfitBuilder({ trip, wardrobe, setWardrobe, customOccasions, setCustomOccasions, onSave, onExit, celebrate }) {
  // Merge default + custom occasion types
  const allOccasionTypes = useMemo(() => [...OCCASION_TYPES, ...customOccasions], [customOccasions]);

  // Hub vs editor mode
  const [editing, setEditing] = useState(null); // null = hub, { dayIdx, occIdx } = editing
  const [occasions, setOccasions] = useState(() => {
    // Resume from saved outfitPlan if it exists
    if (trip.outfitPlan && trip.outfitPlan.length === trip.days) return trip.outfitPlan;
    return Array.from({ length: trip.days }, (_, i) => [{
      id: id(), type: "daytime", label: i === 0 ? "Travel Day" : i === trip.days - 1 ? "Travel Home" : `Day ${i + 1}`,
      slots: {}
    }]);
  });
  const [dayNames, setDayNames] = useState(() => {
    if (trip.outfitDayNames && trip.outfitDayNames.length === trip.days) return trip.outfitDayNames;
    return Array.from({ length: trip.days }, (_, i) => i === 0 ? "Travel Day" : i === trip.days - 1 ? "Travel Home" : `Day ${i + 1}`);
  });
  const [slotIdx, setSlotIdx] = useState(0);
  const [addingNew, setAddingNew] = useState(false);
  const [newItemVal, setNewItemVal] = useState("");
  const [saveFlash, setSaveFlash] = useState("");
  const [addingOccForDay, setAddingOccForDay] = useState(null); // index of day showing occasion picker
  const [creatingType, setCreatingType] = useState(false); // show "create new type" form
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeEmoji, setNewTypeEmoji] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [typeSearchQ, setTypeSearchQ] = useState("");
  const newTypeRef = useRef(null);
  const [renamingDay, setRenamingDay] = useState(null); // index of day being renamed
  const [renamingOcc, setRenamingOcc] = useState(false); // whether renaming the current occasion
  const [renameVal, setRenameVal] = useState("");
  const [dayEmojiMap, setDayEmojiMap] = useState(() => trip.dayEmojis || {});
  const [editingDayEmoji, setEditingDayEmoji] = useState(null);
  const [dayEmojiVal, setDayEmojiVal] = useState("");
  const [editingOccEmoji, setEditingOccEmoji] = useState(null);
  const [occEmojiVal, setOccEmojiVal] = useState("");
  const renameRef = useRef(null);
  const occRenameRef = useRef(null);
  const newRef = useRef(null);

  useEffect(() => { if (addingNew && newRef.current) newRef.current.focus(); }, [addingNew]);
  useEffect(() => { if (renamingDay !== null && renameRef.current) { renameRef.current.focus(); renameRef.current.select(); } }, [renamingDay]);
  useEffect(() => { if (renamingOcc && occRenameRef.current) { occRenameRef.current.focus(); occRenameRef.current.select(); } }, [renamingOcc]);
  useEffect(() => { if (creatingType && newTypeRef.current) newTypeRef.current.focus(); }, [creatingType]);

  const totalDays = trip.days;
  const totalSlots = OUTFIT_SLOTS.length;

  // Auto-save whenever occasions, dayNames, or dayEmojiMap change
  useEffect(() => { onSave(occasions, dayNames, false, dayEmojiMap); }, [occasions, dayNames, dayEmojiMap]);

  // Count completed outfits (has at least top + bottom filled)
  const completedOutfits = useMemo(() => {
    let count = 0;
    occasions.forEach(dayOccs => dayOccs.forEach(occ => {
      if (occ.slots.top && occ.slots.bottom) count++;
    }));
    return count;
  }, [occasions]);

  const totalOccasions = occasions.reduce((s, d) => s + d.length, 0);

  // ── Slot editing helpers ──
  const dayIdx = editing?.dayIdx ?? 0;
  const occIdx = editing?.occIdx ?? 0;
  const currentDayOccasions = occasions[dayIdx] || [];
  const currentOccasion = currentDayOccasions[occIdx];
  const currentSlot = OUTFIT_SLOTS[slotIdx];

  const setSlotValue = (val, autoAdvance = false) => {
    const isMulti = currentSlot.multi;
    const updated = [...occasions];
    updated[dayIdx] = [...updated[dayIdx]];
    if (isMulti && val) {
      // Multi-select: toggle item in array
      const prev = updated[dayIdx][occIdx].slots[currentSlot.id];
      const arr = Array.isArray(prev) ? [...prev] : prev ? [prev] : [];
      const idx = arr.indexOf(val);
      if (idx >= 0) { arr.splice(idx, 1); } else { arr.push(val); }
      updated[dayIdx][occIdx] = { ...updated[dayIdx][occIdx], slots: { ...updated[dayIdx][occIdx].slots, [currentSlot.id]: arr.length ? arr : "" } };
    } else {
      updated[dayIdx][occIdx] = { ...updated[dayIdx][occIdx], slots: { ...updated[dayIdx][occIdx].slots, [currentSlot.id]: val } };
    }
    setOccasions(updated);
    if (val) haptic("light");
    if (val && !wardrobe[currentSlot.id]?.includes(val)) {
      setWardrobe(prev => ({ ...prev, [currentSlot.id]: [...(prev[currentSlot.id] || []), val] }));
    }
    // Auto-advance only for single-select
    if (val && autoAdvance && !isMulti && slotIdx < totalSlots - 1) {
      setTimeout(() => setSlotIdx(s => s + 1), 350);
    }
  };

  const pickOccasionType = (di, typeId, label, icon) => {
    const updated = [...occasions];
    updated[di] = [...updated[di], { id: id(), type: typeId, label: label, icon: icon, slots: {} }];
    setOccasions(updated);
    setEditing({ dayIdx: di, occIdx: updated[di].length - 1 });
    setSlotIdx(0);
    setAddingOccForDay(null);
    setTypeSearchQ("");
  };

  const createAndPickType = (di) => {
    if (!newTypeName.trim()) return;
    const typeId = newTypeName.trim().toLowerCase().replace(/\s+/g, "-");
    const emoji = newTypeEmoji || "🏷️";
    const newType = { id: typeId, label: newTypeName.trim(), icon: emoji };
    // Check for duplicate
    if (!allOccasionTypes.find(t => t.id === typeId)) {
      setCustomOccasions(prev => [...prev, newType]);
    }
    pickOccasionType(di, typeId, newTypeName.trim(), emoji);
    setCreatingType(false);
    setNewTypeName("");
    setNewTypeEmoji("");
    setEmojiPickerOpen(false);
  };

  const removeOccasion = (di, oi) => {
    if (occasions[di].length <= 1) return;
    const updated = [...occasions];
    updated[di] = updated[di].filter((_, i) => i !== oi);
    setOccasions(updated);
    if (editing && editing.dayIdx === di && editing.occIdx >= oi) {
      setEditing({ dayIdx: di, occIdx: Math.max(0, editing.occIdx - 1) });
    }
  };

  const handleDoneOutfit = () => {
    // Save + sync to packing list immediately
    setSaveFlash("Saved!");
    setTimeout(() => setSaveFlash(""), 1500);
    onSave(occasions, dayNames, true, dayEmojiMap);
    haptic("success");
    // Check if this outfit had all slots filled
    if (editing && currentOccasion) {
      const OUTFIT_SLOTS = [{ id: "top" }, { id: "bottom" }, { id: "shoes" }, { id: "layer" }, { id: "bag" }, { id: "jewelry" }];
      const filledSlots = OUTFIT_SLOTS.filter(s => currentOccasion.slots?.[s.id]);
      if (filledSlots.length >= 3) celebrate?.("outfitDone", "medium");
    }
    setEditing(null);
    setSlotIdx(0);
  };

  const commitRenameRef = useRef(false);
  const commitRename = () => {
    if (commitRenameRef.current) return; // prevent double-fire from blur + submit
    commitRenameRef.current = true;
    if (renamingDay !== null && renameVal.trim()) {
      const idx = renamingDay;
      const val = renameVal.trim();
      setDayNames(prev => { const u = [...prev]; u[idx] = val; return u; });
    }
    setRenamingDay(null);
    setRenameVal("");
    setTimeout(() => { commitRenameRef.current = false; }, 50);
  };

  const commitOccRename = () => {
    if (renameVal.trim() && editing) {
      const updated = [...occasions];
      updated[dayIdx] = [...updated[dayIdx]];
      updated[dayIdx][occIdx] = { ...updated[dayIdx][occIdx], label: renameVal.trim() };
      setOccasions(updated);
    }
    setRenamingOcc(false);
    setRenameVal("");
  };

  const goNext = () => {
    if (slotIdx < totalSlots - 1) setSlotIdx(s => s + 1);
    else handleDoneOutfit(); // auto-finish when last slot reached
  };

  const goPrev = () => {
    if (slotIdx > 0) setSlotIdx(s => s - 1);
  };

  const rawSlotVal = currentOccasion?.slots?.[currentSlot?.id] || "";
  const selectedValue = currentSlot?.multi ? (Array.isArray(rawSlotVal) ? rawSlotVal : rawSlotVal ? [rawSlotVal] : []) : rawSlotVal;
  const selectedIsMulti = currentSlot?.multi;
  const dayLabel = (di) => dayNames[di] || (di === 0 ? "Travel Day" : di === totalDays - 1 ? "Last Day" : `Day ${di + 1}`);
  const dayEmoji = (di) => dayEmojiMap[di] || DAY_EMOJIS[di % DAY_EMOJIS.length];

  // ═══ HUB VIEW — shows all outfits as cards ═══
  if (!editing) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #FFF8F2 0%, ${C.cream} 100%)` }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid ${C.borderLight}`, background: "rgba(255,248,242,.95)", backdropFilter: "blur(10px)" }}>
          <button onClick={onExit} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ArrowLeft size={20} color={C.warmGray} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper }}>Build My Outfits</div>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{trip.destination} · {completedOutfits} of {totalOccasions} outfits built</div>
          </div>
          {saveFlash && <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.sage,
            animation: "fadeIn .3s" }}>{saveFlash}</span>}
        </div>

        <div style={{ padding: "20px 16px 32px" }}>
          <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4, padding: "0 4px" }}>
            Your outfits
          </h2>
          <p style={{ fontFamily: F.body, fontSize: 13, color: C.softGray, marginBottom: 20, padding: "0 4px" }}>
            Tap any outfit to edit it, or add new ones. Progress saves automatically.
          </p>

          {occasions.map((dayOccs, di) => (
            <div key={di} style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: ".06em", color: C.copper, marginBottom: 8, padding: "0 4px",
                display: "flex", alignItems: "center", gap: 6 }}>
                {editingDayEmoji === di ? (
                  <span style={{ position: "relative" }}>
                    <input value={dayEmojiVal} onChange={e => setDayEmojiVal(e.target.value.slice(-2))}
                      autoFocus
                      onBlur={() => {
                        if (dayEmojiVal) setDayEmojiMap(prev => ({ ...prev, [di]: dayEmojiVal }));
                        setEditingDayEmoji(null); setDayEmojiVal("");
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") { if (dayEmojiVal) setDayEmojiMap(prev => ({ ...prev, [di]: dayEmojiVal })); setEditingDayEmoji(null); setDayEmojiVal(""); }
                        if (e.key === "Escape") { setEditingDayEmoji(null); setDayEmojiVal(""); }
                      }}
                      style={{ width: 36, fontSize: 16, textAlign: "center", padding: "2px 4px", borderRadius: 6,
                        border: `1.5px solid ${C.copper}`, background: C.copperGlow, outline: "none" }} />
                  </span>
                ) : (
                  <button onClick={() => { setEditingDayEmoji(di); setDayEmojiVal(dayEmoji(di)); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 2px", borderRadius: 4,
                      fontSize: 14, transition: "all .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.copperGlow}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    title="Tap to change emoji">
                    {dayEmoji(di)}
                  </button>
                )}
                {renamingDay === di ? (
                  <form onSubmit={(e) => { e.preventDefault(); commitRename(); }} style={{ display: "inline-flex", gap: 6 }}>
                    <input ref={renameRef} value={renameVal} onChange={e => setRenameVal(e.target.value)}
                      onBlur={commitRename} onKeyDown={e => { if (e.key === "Escape") { setRenamingDay(null); setRenameVal(""); } }}
                      style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.copper, background: C.copperGlow,
                        border: `1.5px solid ${C.copper}`, borderRadius: 8, padding: "3px 8px", outline: "none",
                        textTransform: "uppercase", letterSpacing: ".06em", width: 140 }} />
                  </form>
                ) : (
                  <button onClick={() => { setRenamingDay(di); setRenameVal(dayNames[di]); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 6,
                      fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: ".06em", color: C.copper, transition: "all .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.copperGlow}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    title="Tap to rename this day">
                    {dayLabel(di)}
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {dayOccs.map((occ, oi) => {
                  const filled = Object.entries(occ.slots).filter(([, v]) => Array.isArray(v) ? v.length > 0 : !!v);
                  const hasTopBottom = occ.slots.top && occ.slots.bottom;
                  const typeInfo = allOccasionTypes.find(t => t.id === occ.type);
                  return (
                    <div key={occ.id} style={{ position: "relative" }}>
                      <button onClick={() => { setEditing({ dayIdx: di, occIdx: oi }); setSlotIdx(0); }}
                        style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 16,
                          background: C.warmWhite, border: `1.5px solid ${hasTopBottom ? C.sageLight : C.borderLight}`,
                          cursor: "pointer", textAlign: "left", width: "100%", transition: "all .2s",
                          boxShadow: `0 2px 8px ${C.shadow}` }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${C.shadowMed}`; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `0 2px 8px ${C.shadow}`; }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                          background: hasTopBottom ? C.sageGlow : C.copperSubtle, flexShrink: 0 }}>
                          {hasTopBottom ? <Check size={18} color={C.sage} /> : <Shirt size={18} color={C.copper} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 500, color: C.charcoal, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
                            {editingOccEmoji && editingOccEmoji.dayIdx === di && editingOccEmoji.occIdx === oi ? (
                              <input value={occEmojiVal} onChange={e => setOccEmojiVal(e.target.value.slice(-2))}
                                autoFocus
                                onClick={e => e.stopPropagation()}
                                onBlur={() => {
                                  if (occEmojiVal) { const u = [...occasions]; u[di] = [...u[di]]; u[di][oi] = { ...u[di][oi], icon: occEmojiVal }; setOccasions(u); }
                                  setEditingOccEmoji(null); setOccEmojiVal("");
                                }}
                                onKeyDown={e => {
                                  if (e.key === "Enter") { if (occEmojiVal) { const u = [...occasions]; u[di] = [...u[di]]; u[di][oi] = { ...u[di][oi], icon: occEmojiVal }; setOccasions(u); } setEditingOccEmoji(null); setOccEmojiVal(""); }
                                  if (e.key === "Escape") { setEditingOccEmoji(null); setOccEmojiVal(""); }
                                }}
                                style={{ width: 30, fontSize: 14, textAlign: "center", padding: "1px 3px", borderRadius: 4,
                                  border: `1.5px solid ${C.copper}`, background: C.copperGlow, outline: "none" }} />
                            ) : (
                              <button onClick={e => { e.stopPropagation(); setEditingOccEmoji({ dayIdx: di, occIdx: oi }); setOccEmojiVal(occ.icon || typeInfo?.icon || "🏷️"); }}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", fontSize: 13, borderRadius: 4, transition: "all .15s" }}
                                onMouseEnter={e => e.currentTarget.style.background = C.copperGlow}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                title="Change emoji">
                                {occ.icon || typeInfo?.icon}
                              </button>
                            )}
                            {occ.label}
                          </div>
                          {filled.length > 0 ? (
                            <div style={{ fontFamily: F.body, fontSize: 12, color: C.warmGray, lineHeight: 1.5 }}>
                              {filled.slice(0, 4).map(([slotId, val]) => {
                                const display = Array.isArray(val) ? val.join(", ") : val;
                                return <span key={slotId}>{OUTFIT_SLOTS.find(s => s.id === slotId)?.emoji} {display}  </span>;
                              })}
                              {filled.length > 4 && <span style={{ color: C.softGray }}>+{filled.length - 4} more</span>}
                            </div>
                          ) : (
                            <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, fontStyle: "italic" }}>
                              Tap to start building this outfit
                            </div>
                          )}
                        </div>
                        <ChevronRight size={16} color={C.softGray} style={{ marginTop: 4 }} />
                      </button>
                      {/* Outfit actions */}
                      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                        {filled.length > 0 && (
                          <button onClick={(e) => {
                            e.stopPropagation();
                            // Duplicate to next available day
                            const targetDay = occasions.findIndex((d, idx) => idx > di && d.length < 4);
                            if (targetDay >= 0) {
                              const updated = [...occasions];
                              updated[targetDay] = [...updated[targetDay], { ...occ, id: id() }];
                              setOccasions(updated);
                              setSaveFlash(`Copied to ${dayLabel(targetDay)}`);
                              setTimeout(() => setSaveFlash(""), 1500);
                            } else {
                              setSaveFlash("No room to copy");
                              setTimeout(() => setSaveFlash(""), 1500);
                            }
                          }}
                            title="Copy to another day"
                            style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                              border: "none", background: "rgba(255,255,255,.8)", cursor: "pointer", color: C.softGray,
                              transition: "all .15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.copperGlow; e.currentTarget.style.color = C.copper; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.8)"; e.currentTarget.style.color = C.softGray; }}>
                            <Copy size={13} />
                          </button>
                        )}
                        {dayOccs.length > 1 && (
                          <button onClick={(e) => {
                            e.stopPropagation();
                            removeOccasion(di, oi);
                          }}
                            title="Remove this outfit"
                            style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                              border: "none", background: "rgba(255,255,255,.8)", cursor: "pointer", color: C.softGray,
                              transition: "all .15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.dangerGlow; e.currentTarget.style.color = C.danger; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.8)"; e.currentTarget.style.color = C.softGray; }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add another occasion to this day */}
                {addingOccForDay === di ? (
                  <div style={{ padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${C.borderLight}`,
                    background: C.warmWhite }}>
                    {!creatingType ? (<>
                      <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: C.charcoal, marginBottom: 10 }}>
                        What kind of outfit?
                      </div>

                      {/* Search (shows when 6+ types) */}
                      {allOccasionTypes.length >= 6 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
                          background: C.cream, borderRadius: 10, border: `1px solid ${C.borderLight}`, marginBottom: 10 }}>
                          <Search size={13} color={C.softGray} />
                          <input value={typeSearchQ} onChange={e => setTypeSearchQ(e.target.value)}
                            placeholder="Search types..."
                            style={{ flex: 1, border: "none", background: "none", outline: "none",
                              fontFamily: F.body, fontSize: 12, color: C.charcoal }} />
                          {typeSearchQ && <button onClick={() => setTypeSearchQ("")}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                            <X size={12} color={C.softGray} /></button>}
                        </div>
                      )}

                      {/* Occasion type grid */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxHeight: 200, overflowY: "auto",
                        paddingRight: 4 }}>
                        {allOccasionTypes
                          .filter(t => !typeSearchQ || t.label.toLowerCase().includes(typeSearchQ.toLowerCase()))
                          .map(t => (
                          <button key={t.id} onClick={() => pickOccasionType(di, t.id, t.label, t.icon)}
                            style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.borderLight}`,
                              background: C.cream, cursor: "pointer", fontFamily: F.body, fontSize: 12, color: C.charcoal,
                              display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}
                            onMouseEnter={e => e.currentTarget.style.background = C.copperGlow}
                            onMouseLeave={e => e.currentTarget.style.background = C.cream}>
                            {t.icon} {t.label}
                          </button>
                        ))}

                        {/* Create new type button */}
                        <button onClick={() => setCreatingType(true)}
                          style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px dashed ${C.borderMedium}`,
                            background: "transparent", cursor: "pointer", fontFamily: F.body, fontSize: 12,
                            color: C.copper, display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = C.copperSubtle}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <Plus size={13} /> New type
                        </button>
                      </div>

                      <button onClick={() => { setAddingOccForDay(null); setTypeSearchQ(""); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.body,
                          fontSize: 12, color: C.softGray, marginTop: 10, padding: "4px 0" }}>
                        Cancel
                      </button>
                    </>) : (<>
                      {/* Create new occasion type form */}
                      <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: C.charcoal, marginBottom: 10 }}>
                        Create a new outfit type
                      </div>

                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        {/* Emoji selector */}
                        <button onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                          style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                            border: `1.5px solid ${newTypeEmoji ? C.copper : C.borderMedium}`,
                            background: newTypeEmoji ? C.copperGlow : C.cream, cursor: "pointer",
                            fontSize: newTypeEmoji ? 22 : 14, color: C.softGray, flexShrink: 0 }}>
                          {newTypeEmoji || "🏷️"}
                        </button>

                        {/* Name input */}
                        <input ref={newTypeRef} value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
                          placeholder="e.g. Brunch, Pool Party, Hiking..."
                          onKeyDown={e => { if (e.key === "Enter" && newTypeName.trim()) createAndPickType(di); }}
                          style={{ flex: 1, fontFamily: F.body, fontSize: 13, padding: "10px 14px",
                            border: `1.5px solid ${C.borderMedium}`, borderRadius: 10,
                            background: C.cream, outline: "none", color: C.charcoal }}
                          onFocus={e => e.target.style.borderColor = C.copper}
                          onBlur={e => e.target.style.borderColor = C.borderMedium} />
                      </div>

                      {/* Emoji picker grid + custom input */}
                      {emojiPickerOpen && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                            <input value={newTypeEmoji} onChange={e => { const v = e.target.value; setNewTypeEmoji(v.slice(-2)); }}
                              placeholder="Type any emoji..."
                              style={{ flex: 1, fontFamily: F.body, fontSize: 18, padding: "6px 10px", textAlign: "center",
                                border: `1.5px solid ${C.borderMedium}`, borderRadius: 8, background: C.warmWhite,
                                outline: "none", color: C.charcoal, width: 60 }}
                              onFocus={e => e.target.style.borderColor = C.copper}
                              onBlur={e => e.target.style.borderColor = C.borderMedium} />
                            <span style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>or pick below</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4,
                            maxHeight: 160, overflowY: "auto", padding: 8,
                            background: C.cream, borderRadius: 12, border: `1px solid ${C.borderLight}` }}>
                            {OCCASION_EMOJIS.map((em) => (
                              <button key={em} onClick={() => { setNewTypeEmoji(em); setEmojiPickerOpen(false); }}
                                style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center",
                                  justifyContent: "center", border: `1px solid ${newTypeEmoji === em ? C.copper : "transparent"}`,
                                  background: newTypeEmoji === em ? C.copperGlow : "transparent",
                                  cursor: "pointer", fontSize: 18, transition: "all .1s" }}
                                onMouseEnter={e => { if (newTypeEmoji !== em) e.currentTarget.style.background = C.copperSubtle; }}
                                onMouseLeave={e => { if (newTypeEmoji !== em) e.currentTarget.style.background = "transparent"; }}>
                                {em}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setCreatingType(false); setNewTypeName(""); setNewTypeEmoji(""); setEmojiPickerOpen(false); }}
                          style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.borderLight}`,
                            background: C.cream, cursor: "pointer", fontFamily: F.body, fontSize: 12, color: C.warmGray }}>
                          Back
                        </button>
                        <Btn v="primary" sz="sm" onClick={() => createAndPickType(di)}
                          style={{ flex: 1, opacity: newTypeName.trim() ? 1 : 0.5 }}>
                          <Plus size={14} /> Create & use
                        </Btn>
                      </div>
                    </>)}
                  </div>
                ) : (
                  <button onClick={() => { setAddingOccForDay(di); setCreatingType(false); }}
                    style={{ padding: "12px 16px", borderRadius: 14, border: `2px dashed ${C.borderMedium}`,
                      background: "transparent", cursor: "pointer", display: "flex", alignItems: "center",
                      justifyContent: "center", gap: 8, fontFamily: F.body, fontSize: 13, color: C.copper,
                      transition: "all .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.copperSubtle}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <Plus size={14} /> Add outfit for {dayLabel(di).toLowerCase()}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ padding: "16px 20px 32px", borderTop: `1px solid ${C.borderLight}`,
          background: "rgba(253,248,240,.95)", position: "sticky", bottom: 0 }}>
          <Btn v="sage" sz="lg" onClick={() => { onSave(occasions, dayNames, true, dayEmojiMap); onExit(); }} style={{ width: "100%" }}>
            <Sparkles size={18} /> Done — sync to packing list
          </Btn>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, textAlign: "center", marginTop: 8 }}>
            {completedOutfits} outfit{completedOutfits !== 1 ? "s" : ""} ready · items auto-added to your list
          </div>
        </div>
      </div>
    );
  }

  // ═══ OUTFIT EDITOR — editing a single outfit ═══
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #FFF8F2 0%, ${C.cream} 100%)` }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${C.borderLight}`, background: "rgba(255,248,242,.95)", backdropFilter: "blur(10px)" }}>
        <button onClick={handleDoneOutfit} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ArrowLeft size={20} color={C.warmGray} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper }}>
            {dayEmoji(dayIdx)} {dayLabel(dayIdx)}
          </div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, display: "flex", alignItems: "center", gap: 4 }}>
            {renamingOcc ? (
              <form onSubmit={(e) => { e.preventDefault(); commitOccRename(); }} style={{ display: "inline-flex" }}>
                <input ref={occRenameRef} value={renameVal} onChange={e => setRenameVal(e.target.value)}
                  onBlur={commitOccRename} onKeyDown={e => { if (e.key === "Escape") { setRenamingOcc(false); setRenameVal(""); } }}
                  style={{ fontFamily: F.body, fontSize: 11, color: C.charcoal, background: C.copperGlow,
                    border: `1px solid ${C.copper}`, borderRadius: 6, padding: "2px 6px", outline: "none", width: 120 }} />
              </form>
            ) : (
              <button onClick={() => { setRenamingOcc(true); setRenameVal(currentOccasion?.label || "Outfit"); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 4px", borderRadius: 4,
                  fontFamily: F.body, fontSize: 11, color: C.softGray, transition: "all .15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = C.copperGlow; e.currentTarget.style.color = C.copper; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.softGray; }}
                title="Tap to rename">
                {currentOccasion?.label || "Outfit"}
              </button>
            )}
            <span>· {Object.values(currentOccasion?.slots || {}).reduce((c, v) => c + (Array.isArray(v) ? v.length : v ? 1 : 0), 0)} items</span>
          </div>
        </div>
        <Btn v="sage" sz="sm" onClick={handleDoneOutfit}>
          <Check size={14} /> Done
        </Btn>
      </div>

      {/* Occasion tabs for this day */}
      {currentDayOccasions.length > 1 && (
        <div style={{ padding: "8px 16px 4px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {currentDayOccasions.map((occ, i) => {
              const active = i === occIdx;
              const typeInfo = allOccasionTypes.find(t => t.id === occ.type);
              return (
                <button key={occ.id} onClick={() => { setEditing({ dayIdx, occIdx: i }); setSlotIdx(0); }}
                  style={{ padding: "6px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6,
                    border: `1px solid ${active ? C.copper : C.borderLight}`,
                    background: active ? C.copperGlow : C.warmWhite,
                    cursor: "pointer", fontFamily: F.body, fontSize: 12, fontWeight: active ? 600 : 400,
                    color: active ? C.copper : C.warmGray }}>
                  {occ.icon || typeInfo?.icon} {occ.label}
                  {currentDayOccasions.length > 1 && active && (
                    <button onClick={(e) => { e.stopPropagation(); removeOccasion(dayIdx, i); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
                        marginLeft: 4, color: C.softGray, display: "flex" }}>
                      <X size={12} />
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Current slot */}
      <div style={{ padding: "16px 20px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 16,
            background: `linear-gradient(135deg, ${currentSlot.color}15, ${currentSlot.color}08)`,
            border: `1.5px solid ${currentSlot.color}25`, marginBottom: 12 }}>
            <span style={{ fontSize: 28 }}>{currentSlot.emoji}</span>
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>
            {currentSlot.label}
          </h2>
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.softGray }}>
            {currentSlot.optional && <span style={{ fontStyle: "italic" }}>optional · </span>}
            {slotIdx + 1} of {totalSlots}
          </div>
        </div>

        {/* Slot progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {OUTFIT_SLOTS.map((s, i) => {
            const sv = currentOccasion?.slots?.[s.id];
            const filled = Array.isArray(sv) ? sv.length > 0 : !!sv;
            const active = i === slotIdx;
            return (
              <button key={s.id} onClick={() => setSlotIdx(i)}
                style={{ width: active ? 20 : 10, height: 10, borderRadius: 5, border: "none", cursor: "pointer",
                  background: filled ? C.sage : active ? C.copper : C.creamDark,
                  transition: "all .2s" }} />
            );
          })}
        </div>

        {/* Mini outfit preview — what you've picked so far */}
        {(() => {
          const pickedSlots = OUTFIT_SLOTS.filter(s => {
            const v = currentOccasion?.slots?.[s.id];
            return Array.isArray(v) ? v.length > 0 : !!v;
          }).map(s => ({
            ...s, val: Array.isArray(currentOccasion.slots[s.id]) ? currentOccasion.slots[s.id].join(", ") : currentOccasion.slots[s.id]
          }));
          return pickedSlots.length > 0 && (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
              {pickedSlots.map(s => (
                <div key={s.id} style={{ padding: "4px 10px", borderRadius: 8,
                  background: s.id === currentSlot.id ? C.copperGlow : C.sageGlow,
                  border: `1px solid ${s.id === currentSlot.id ? C.copper + "30" : "rgba(139,168,136,.15)"}`,
                  fontFamily: F.body, fontSize: 11, color: C.charcoal, maxWidth: 120,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  cursor: "pointer" }}
                  onClick={() => setSlotIdx(OUTFIT_SLOTS.findIndex(os => os.id === s.id))}
                  title={s.val}>
                  {s.emoji} {s.val}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Selected value display */}
        {selectedIsMulti ? (
          selectedValue.length > 0 && (
            <div style={{ background: C.sageGlow, borderRadius: 14, padding: "10px 14px", marginBottom: 16,
              border: `1px solid rgba(139,168,136,.2)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Check size={14} color={C.sage} />
                <span style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, color: C.sage }}>
                  {selectedValue.length} selected
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selectedValue.map(v => (
                  <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px",
                    borderRadius: 8, background: C.warmWhite, border: `1px solid ${C.borderLight}`,
                    fontFamily: F.body, fontSize: 12, color: C.charcoal }}>
                    {v}
                    <button onClick={() => {
                      const updated = [...occasions];
                      updated[dayIdx] = [...updated[dayIdx]];
                      const arr = (Array.isArray(updated[dayIdx][occIdx].slots[currentSlot.id]) ? [...updated[dayIdx][occIdx].slots[currentSlot.id]] : []).filter(x => x !== v);
                      updated[dayIdx][occIdx] = { ...updated[dayIdx][occIdx], slots: { ...updated[dayIdx][occIdx].slots, [currentSlot.id]: arr.length ? arr : "" } };
                      setOccasions(updated);
                    }} style={{ background: "none", border: "none", cursor: "pointer", color: C.softGray, padding: 0, display: "flex" }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )
        ) : (
          selectedValue && (
            <div style={{ background: C.sageGlow, borderRadius: 14, padding: "12px 18px",
              display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
              border: `1px solid rgba(139,168,136,.2)` }}>
              <Check size={16} color={C.sage} />
              <span style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.charcoal, flex: 1 }}>
                {selectedValue}
              </span>
              <button onClick={() => setSlotValue("")} style={{ background: "none", border: "none", cursor: "pointer",
                color: C.softGray, padding: 4, display: "flex" }}>
                <X size={14} />
              </button>
            </div>
          )
        )}

        {/* Wardrobe carousel */}
        <div style={{ marginBottom: 16 }}>
          {(wardrobe[currentSlot.id] || []).length > 0 && (
            <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: ".06em", color: C.warmGray, marginBottom: 10, paddingLeft: 4 }}>
              Your wardrobe
            </div>
          )}
          <WardrobeCarousel slotId={currentSlot.id} wardrobe={wardrobe}
            onSelect={(item) => setSlotValue(item, true)} selected={selectedValue}
            onRemoveItem={(item) => setWardrobe(prev => ({ ...prev, [currentSlot.id]: (prev[currentSlot.id] || []).filter(i => i !== item) }))} />
        </div>

        {/* Add new item */}
        {addingNew ? (
          <form onSubmit={(e) => { e.preventDefault(); if (newItemVal.trim()) { setSlotValue(newItemVal.trim(), true); setNewItemVal(""); setAddingNew(false); } }}
            style={{ display: "flex", gap: 10 }}>
            <input ref={newRef} value={newItemVal} onChange={e => setNewItemVal(e.target.value)}
              placeholder={currentSlot.placeholder}
              onBlur={() => { if (!newItemVal.trim()) setTimeout(() => setAddingNew(false), 150); }}
              style={{ flex: 1, fontFamily: F.body, fontSize: 14, padding: "12px 16px",
                border: `1.5px solid ${C.borderMedium}`, borderRadius: 12,
                background: C.warmWhite, outline: "none", color: C.charcoal }}
              onFocus={e => e.target.style.borderColor = C.copper} />
            <Btn v="primary" sz="sm" onClick={() => { if (newItemVal.trim()) { setSlotValue(newItemVal.trim(), true); setNewItemVal(""); setAddingNew(false); } }}>
              Add
            </Btn>
          </form>
        ) : (
          <button onClick={() => setAddingNew(true)}
            style={{ width: "100%", padding: "14px 18px", borderRadius: 14,
              border: `2px dashed ${C.borderMedium}`, background: C.copperSubtle,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: F.body, fontSize: 14, color: C.copper, transition: "all .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = C.copperGlow}
            onMouseLeave={e => e.currentTarget.style.background = C.copperSubtle}>
            <Plus size={16} /> Add {selectedIsMulti ? "another" : "new"} {currentSlot.label.toLowerCase()}
          </button>
        )}

        {selectedIsMulti && selectedValue.length > 0 && (
          <button onClick={goNext}
            style={{ width: "100%", marginTop: 10, padding: "12px", borderRadius: 12,
              border: `1.5px solid ${C.sage}`, background: C.sageGlow, cursor: "pointer",
              fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.sage, textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Check size={14} /> Done with {currentSlot.label.toLowerCase()} ({selectedValue.length})
          </button>
        )}

        {currentSlot.optional && (selectedIsMulti ? selectedValue.length === 0 : !selectedValue) && (
          <button onClick={goNext}
            style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 10,
              border: "none", background: "transparent", cursor: "pointer",
              fontFamily: F.body, fontSize: 13, color: C.softGray, textAlign: "center" }}>
            Skip this — it's optional
          </button>
        )}
      </div>

      {/* Navigation */}
      <div style={{ padding: "12px 20px 32px", display: "flex", gap: 12,
        borderTop: `1px solid ${C.borderLight}`, background: "rgba(253,248,240,.95)" }}>
        {slotIdx > 0 && (
          <Btn v="secondary" sz="md" onClick={goPrev} style={{ flex: 0 }}>
            <ChevronLeft size={16} />
          </Btn>
        )}
        {slotIdx < totalSlots - 1 ? (
          <Btn v="primary" sz="md" onClick={goNext} style={{ flex: 1 }}>
            Next <ChevronRight size={16} />
          </Btn>
        ) : (
          <Btn v="sage" sz="lg" onClick={handleDoneOutfit} style={{ flex: 1 }}>
            <Check size={18} /> Done with this outfit
          </Btn>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════
export default function PackPal() {
  const [trips, setTrips] = usePersist("trips", []);
  const [view, setView] = useState("home");
  const [activeTrip, setActiveTrip] = useState(null);
  const [guidedMode, setGuidedMode] = useState(false);
  const [freakOut, setFreakOut] = useState(false);
  const [refillMode, setRefillMode] = useState(false);
  const [showRecs, setShowRecs] = useState(false);
  const [outfitMode, setOutfitMode] = useState(false);
  const [outTheDoor, setOutTheDoor] = useState(false);
  const [focusRefill, setFocusRefill] = useState(false);
  const [chargeMode, setChargeMode] = useState(false);
  const [focusCharge, setFocusCharge] = useState(false);
  const [wardrobe, setWardrobe] = usePersist("wardrobe", {});
  const [customOccasions, setCustomOccasions] = usePersist("customOccasions", []);
  const [otdItems, setOtdItems] = usePersist("otdItems", DEFAULT_OTD_ITEMS);
  const [editGlobalOtd, setEditGlobalOtd] = useState(false);

  // Migration: move checkout category items into trip.otdItems and strip them from trip.items
  useEffect(() => {
    let changed = false;
    const migrated = trips.map(t => {
      const checkoutItems = (t.items || []).filter(i => i.category === "checkout");
      if (checkoutItems.length === 0 && t.otdItems) return t;
      changed = true;
      const existing = t.otdItems || otdItems.map(i => ({ ...i }));
      const nameSet = new Set(existing.map(i => i.name.toLowerCase()));
      checkoutItems.forEach(ci => {
        if (!nameSet.has(ci.name.toLowerCase())) {
          existing.push({ name: ci.name, emoji: "📌" });
          nameSet.add(ci.name.toLowerCase());
        }
      });
      return { ...t, items: (t.items || []).filter(i => i.category !== "checkout"), otdItems: existing, otdChecked: t.otdChecked || {} };
    });
    if (changed) setTrips(migrated);
  }, []);

  const [searchQ, setSearchQ] = useState("");
  const [catFilter, setCatFilter] = useState(null);
  const [secFilter, setSecFilter] = useState(null);
  const [addingSec, setAddingSec] = useState(null); // category id we're adding a section to
  const [newSecName, setNewSecName] = useState("");
  const newSecRef = useRef(null);
  const [histTrip, setHistTrip] = useState(null);
  const { celebrate, CelebrationLayer } = useCelebration();

  // Wizard
  const [wStep, setWStep] = useState(0);
  const [nTrip, setNTrip] = useState({ destination: "", tripType: [], days: 4, weather: "warm", startDate: "", tempRange: "" });
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // ── Weather Fetch ──
  const doFetchWeather = async (loc) => {
    if (!loc) return;
    setWeatherLoading(true);
    const data = await fetchWeather(loc);
    setWeatherData(data);
    if (data?.forecast?.length) {
      const avgMax = Math.round(data.forecast.reduce((s, d) => s + d.maxF, 0) / data.forecast.length);
      setNTrip(prev => ({ ...prev, tempRange: tempToRange(avgMax) }));
    }
    setWeatherLoading(false);
  };

  // ── CRUD ──
  const createTrip = () => {
    const items = genList(nTrip.tripType, nTrip.days);
    const tripOtd = genTripOtd(otdItems, nTrip.tripType);
    const trip = { id: id(), ...nTrip, items, otdItems: tripOtd, otdChecked: {}, createdAt: new Date().toISOString(),
      icon: TRIP_TYPES.find(t => t.id === nTrip.tripType[0])?.icon || "✈️", weatherData };
    setTrips(p => [trip, ...p]);
    setActiveTrip(trip);
    setView("trip");
    setNTrip({ destination: "", tripType: [], days: 4, weather: "warm", startDate: "", tempRange: "" });
    setWStep(0); setWeatherData(null);
  };

  const toggle = (tid, iid) => {
    const trip = trips.find(t => t.id === tid);
    const item = trip?.items.find(i => i.id === iid);
    const wasPacked = item?.packed;
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, packed: !i.packed } : i) } : t));
    if (activeTrip?.id === tid) setActiveTrip(p => ({ ...p, items: p.items.map(i => i.id === iid ? { ...i, packed: !i.packed } : i) }));
    if (!wasPacked && item) {
      haptic("light");
      // Check if this completes a section, category, or everything
      setTimeout(() => {
        const t = trips.find(tr => tr.id === tid);
        if (!t) return;
        const updated = t.items.map(i => i.id === iid ? { ...i, packed: true } : i);
        const sec = updated.filter(i => i.section === item.section);
        const cat = updated.filter(i => i.category === item.category);
        const all = updated;
        if (all.every(i => i.packed)) celebrate("allPacked", "big");
        else if (cat.every(i => i.packed)) celebrate("category", "medium");
        else if (sec.every(i => i.packed)) celebrate("section", "small");
      }, 50);
    }
  };
  const toggleRefill = (tid, iid) => {
    haptic("light");
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, needsRefill: !i.needsRefill } : i) } : t));
    if (activeTrip?.id === tid) setActiveTrip(p => ({ ...p, items: p.items.map(i => i.id === iid ? { ...i, needsRefill: !i.needsRefill } : i) }));
  };
  const toggleRefilled = (tid, iid) => {
    const trip = trips.find(t => t.id === tid);
    const item = trip?.items.find(i => i.id === iid);
    const wasRefilled = item?.refilled;
    haptic("success");
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, refilled: !i.refilled } : i) } : t));
    if (activeTrip?.id === tid) setActiveTrip(p => ({ ...p, items: p.items.map(i => i.id === iid ? { ...i, refilled: !i.refilled } : i) }));
    if (!wasRefilled && item) {
      setTimeout(() => {
        const t = trips.find(tr => tr.id === tid);
        if (!t) return;
        const updated = t.items.map(i => i.id === iid ? { ...i, refilled: true } : i);
        const refillItems = updated.filter(i => i.needsRefill);
        if (refillItems.length > 0 && refillItems.every(i => i.refilled)) celebrate("allRefilled", "medium");
      }, 50);
    }
  };
  const toggleCharge = (tid, iid) => {
    haptic("light");
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, needsCharge: !i.needsCharge } : i) } : t));
    if (activeTrip?.id === tid) setActiveTrip(p => ({ ...p, items: p.items.map(i => i.id === iid ? { ...i, needsCharge: !i.needsCharge } : i) }));
  };
  const toggleCharged = (tid, iid) => {
    const trip = trips.find(t => t.id === tid);
    const item = trip?.items.find(i => i.id === iid);
    const wasCharged = item?.charged;
    haptic("success");
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, charged: !i.charged } : i) } : t));
    if (activeTrip?.id === tid) setActiveTrip(p => ({ ...p, items: p.items.map(i => i.id === iid ? { ...i, charged: !i.charged } : i) }));
    if (!wasCharged && item) {
      setTimeout(() => {
        const t = trips.find(tr => tr.id === tid);
        if (!t) return;
        const updated = t.items.map(i => i.id === iid ? { ...i, charged: true } : i);
        const chargeItems = updated.filter(i => i.needsCharge);
        if (chargeItems.length > 0 && chargeItems.every(i => i.charged)) celebrate("allCharged", "medium");
      }, 50);
    }
  };
  const addItem = (tid, sec, cat, name) => {
    const ni = { id: id(), name, section: sec, category: cat, packed: false, essential: false, ff: false, freq: 0, needsRefill: false, needsCharge: false };
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: [...t.items, ni] } : t));
    if (activeTrip?.id === tid) setActiveTrip(p => ({ ...p, items: [...p.items, ni] }));
  };
  const addRecItem = (name) => {
    if (!activeTrip) return;
    const ni = { id: id(), name, section: "Smart Recommendations", category: "necessities", packed: false, essential: false, ff: false, freq: 0, needsRefill: false, needsCharge: false };
    setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, items: [...t.items, ni] } : t));
    setActiveTrip(p => ({ ...p, items: [...p.items, ni] }));
  };
  const addSection = (catId, secName) => {
    if (!activeTrip || !secName.trim()) return;
    // Check if section already exists in this category
    const exists = activeTrip.items.some(i => i.category === catId && i.section.toLowerCase() === secName.trim().toLowerCase());
    if (exists) return;
    // Add a placeholder item so the section appears — user will rename/add real items
    const ni = { id: id(), name: "New item", section: secName.trim(), category: catId, packed: false, essential: false, ff: false, freq: 0, needsRefill: false, needsCharge: false };
    setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, items: [...t.items, ni] } : t));
    setActiveTrip(p => ({ ...p, items: [...p.items, ni] }));
    setAddingSec(null);
    setNewSecName("");
    haptic("success");
  };
  const removeItem = (tid, iid) => {
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.filter(i => i.id !== iid) } : t));
    if (activeTrip?.id === tid) setActiveTrip(p => ({ ...p, items: p.items.filter(i => i.id !== iid) }));
  };
  const deleteTrip = (tid) => {
    setTrips(p => p.filter(t => t.id !== tid));
    if (activeTrip?.id === tid) { setActiveTrip(null); setView("home"); }
  };
  const dupTrip = (trip) => {
    const ni = trip.items.map(i => ({ ...i, id: id(), packed: false, needsRefill: false, needsCharge: false }));
    const d = { ...trip, id: id(), items: ni, createdAt: new Date().toISOString(), destination: `${trip.destination} (copy)` };
    setTrips(p => [d, ...p]); setActiveTrip(d); setView("trip");
  };

  const stats = (t) => {
    if (!t?.items) return { pk: 0, tot: 0, pct: 0 };
    const pk = t.items.filter(i => i.packed).length, tot = t.items.length;
    return { pk, tot, pct: tot > 0 ? Math.round(pk / tot * 100) : 0 };
  };

  const groupItems = (items) => {
    const g = {};
    items.forEach(i => { if (!g[i.category]) g[i.category] = {}; if (!g[i.category][i.section]) g[i.category][i.section] = []; g[i.category][i.section].push(i); });
    return g;
  };

  // ═══ FREAK OUT MODE ═══
  if (freakOut) {
    return <FreakOutMode onExit={() => setFreakOut(false)}
      onStartPacking={() => { setFreakOut(false); if (activeTrip) setGuidedMode(true); }} />;
  }

  // ═══ GUIDED PACK ═══
  if (guidedMode && activeTrip) {
    return <><GuidedPack items={activeTrip.items} onToggle={iid => toggle(activeTrip.id, iid)}
      onToggleRefilled={iid => toggleRefilled(activeTrip.id, iid)}
      onToggleCharged={iid => toggleCharged(activeTrip.id, iid)}
      onRemove={iid => removeItem(activeTrip.id, iid)}
      onExit={() => setGuidedMode(false)} tripName={activeTrip.destination} /><CelebrationLayer /></>;
  }

  // ═══ FOCUS REFILL ═══
  if (focusRefill && activeTrip) {
    return <><FocusRefill items={activeTrip.items}
      onToggleRefill={iid => toggleRefill(activeTrip.id, iid)}
      onToggleRefilled={iid => toggleRefilled(activeTrip.id, iid)}
      onExit={() => setFocusRefill(false)} tripName={activeTrip.destination} /><CelebrationLayer /></>;
  }

  // ═══ FOCUS CHARGE ═══
  if (focusCharge && activeTrip) {
    return <><FocusCharge items={activeTrip.items}
      onToggleCharge={iid => toggleCharge(activeTrip.id, iid)}
      onToggleCharged={iid => toggleCharged(activeTrip.id, iid)}
      onExit={() => setFocusCharge(false)} tripName={activeTrip.destination} /><CelebrationLayer /></>;
  }

  // ═══ SMART RECS ═══
  if (showRecs && activeTrip) {
    return <SmartRecsView tripTypes={activeTrip.tripType} tempRange={activeTrip.tempRange}
      onAdd={addRecItem} onClose={() => setShowRecs(false)} />;
  }

  // ═══ OUTFIT BUILDER ═══
  if (outfitMode && activeTrip) {
    return <><OutfitBuilder trip={activeTrip} wardrobe={wardrobe} setWardrobe={setWardrobe}
      customOccasions={customOccasions} setCustomOccasions={setCustomOccasions}
      celebrate={celebrate}
      onExit={() => setOutfitMode(false)}
      onSave={(occasions, dayNames, syncToList, dayEmojis) => {
        if (syncToList) {
          const outfitItems = collectUniqueOutfitItems(occasions);
          const outfitNames = new Set(outfitItems.map(i => i.name.toLowerCase()));
          setTrips(p => p.map(t => {
            if (t.id !== activeTrip.id) return t;
            const nonOutfit = t.items.filter(i => i.category !== "outfits");
            const existingOutfit = t.items.filter(i => i.category === "outfits");
            const existingNames = new Set(existingOutfit.map(i => i.name.toLowerCase()));
            const kept = existingOutfit.filter(i => outfitNames.has(i.name.toLowerCase()));
            const brandNew = outfitItems
              .filter(item => !existingNames.has(item.name.toLowerCase()))
              .map(item => ({ id: id(), name: item.name, category: "outfits", section: item.section,
                packed: false, essential: false, ff: false, freq: 0, needsRefill: false, needsCharge: false }));
            return { ...t, outfitPlan: occasions, outfitDayNames: dayNames, dayEmojis: dayEmojis || {}, items: [...nonOutfit, ...kept, ...brandNew] };
          }));
          setActiveTrip(p => {
            const nonOutfit = p.items.filter(i => i.category !== "outfits");
            const existingOutfit = p.items.filter(i => i.category === "outfits");
            const existingNames = new Set(existingOutfit.map(i => i.name.toLowerCase()));
            const kept = existingOutfit.filter(i => outfitNames.has(i.name.toLowerCase()));
            const brandNew = outfitItems
              .filter(item => !existingNames.has(item.name.toLowerCase()))
              .map(item => ({ id: id(), name: item.name, category: "outfits", section: item.section,
                packed: false, essential: false, ff: false, freq: 0, needsRefill: false, needsCharge: false }));
            return { ...p, outfitPlan: occasions, outfitDayNames: dayNames, dayEmojis: dayEmojis || {}, items: [...nonOutfit, ...kept, ...brandNew] };
          });
        } else {
          setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, outfitPlan: occasions, outfitDayNames: dayNames, dayEmojis: dayEmojis || {} } : t));
          setActiveTrip(p => ({ ...p, outfitPlan: occasions, outfitDayNames: dayNames, dayEmojis: dayEmojis || {} }));
        }
      }} /><CelebrationLayer /></>;
  }

  // ═══ OUT THE DOOR ═══
  if (outTheDoor && activeTrip) {
    // Migrate: if trip has no otdItems yet, seed from global defaults
    const tripOtdList = activeTrip.otdItems || genTripOtd(otdItems, activeTrip.tripType || []);
    const tripOtdChecked = activeTrip.otdChecked || {};
    return <><OutTheDoor trip={activeTrip} otdItems={tripOtdList}
      setOtdItems={(updater) => {
        const update = typeof updater === "function" ? updater : () => updater;
        setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, otdItems: update(t.otdItems || tripOtdList) } : t));
        setActiveTrip(p => ({ ...p, otdItems: update(p.otdItems || tripOtdList) }));
      }}
      otdChecked={tripOtdChecked}
      celebrate={celebrate}
      setOtdChecked={(updater) => {
        const update = typeof updater === "function" ? updater : () => updater;
        setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, otdChecked: update(t.otdChecked || {}) } : t));
        setActiveTrip(p => ({ ...p, otdChecked: update(p.otdChecked || {}) }));
      }}
      onExit={() => setOutTheDoor(false)} /><CelebrationLayer /></>;
  }

  // ═══ HISTORICAL TRIP DETAIL ═══
  if (view === "hist-detail" && histTrip) {
    return (
      <div style={{ minHeight: "100vh", background: C.cream }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid ${C.borderLight}` }}>
          <button onClick={() => { setView("history"); setHistTrip(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ArrowLeft size={20} color={C.warmGray} />
          </button>
          <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>
            {histTrip.icon} {histTrip.dest}
          </span>
        </div>
        <div style={{ padding: "24px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <span style={{ fontSize: 48 }}>{histTrip.icon}</span>
            <div>
              <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, margin: 0 }}>
                {histTrip.dest}
              </h2>
              <div style={{ fontFamily: F.body, fontSize: 13, color: C.warmGray, marginTop: 4 }}>
                {histTrip.dates} · {histTrip.days} days · {histTrip.type}
              </div>
            </div>
          </div>

          <div style={{ background: C.copperSubtle, borderRadius: 12, padding: "10px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 8 }}>
            <Eye size={14} color={C.copper} />
            <span style={{ fontFamily: F.body, fontSize: 13, color: C.copper }}>
              Read-only — this is your historical packing data
            </span>
          </div>

          {Object.entries(histTrip.sections).map(([sec, items]) => (
            <div key={sec} style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: ".08em", color: C.warmGray, padding: "8px 4px" }}>{sec}</div>
              <div style={{ background: C.warmWhite, borderRadius: 14, border: `1px solid ${C.borderLight}`, padding: "8px 0" }}>
                {items.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                      background: `linear-gradient(135deg,${C.sage},${C.sageLight})` }}>
                      <Check size={12} color="#fff" strokeWidth={3} />
                    </div>
                    <span style={{ fontFamily: F.body, fontSize: 14, color: C.charcoal }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Btn v="primary" sz="md" onClick={() => {
            setNTrip({ destination: histTrip.dest, tripType: [histTrip.type], days: histTrip.days, weather: "warm", startDate: "", tempRange: "" });
            setWStep(1); setView("new-trip");
          }} style={{ width: "100%", marginTop: 12 }}>
            <Copy size={15} /> Pack for {histTrip.dest} again
          </Btn>
        </div>
      </div>
    );
  }

  // ═══ NEW TRIP WIZARD ═══
  if (view === "new-trip") {
    const steps = ["Where", "Trip type", "Details", "Weather", "Review"];
    return (
      <div style={{ minHeight: "100vh", background: C.cream, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid ${C.borderLight}`, background: "rgba(253,248,240,.95)" }}>
          <button onClick={() => { setView("home"); setWStep(0); setWeatherData(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ArrowLeft size={20} color={C.warmGray} />
          </button>
          <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>New Trip</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "24px 0 8px" }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === wStep ? 24 : 8, height: 8, borderRadius: 4,
              background: i <= wStep ? C.copper : C.creamDark, transition: "all .3s" }} />
          ))}
        </div>

        <div style={{ flex: 1, padding: "24px 28px", maxWidth: 500, margin: "0 auto", width: "100%" }}>
          {/* Step 0: Where */}
          {wStep === 0 && (<div>
            <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400, marginBottom: 8 }}>Where are you headed?</h2>
            <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 32 }}>PackPal will personalize your list.</p>
            <input value={nTrip.destination} onChange={e => setNTrip({ ...nTrip, destination: e.target.value })}
              placeholder="e.g. Tokyo, Tulum, 90210..." autoFocus
              style={{ width: "100%", fontFamily: F.display, fontSize: 28, padding: "16px 0", border: "none",
                borderBottom: `2px solid ${C.borderMedium}`, background: "transparent", outline: "none",
                color: C.charcoal, fontWeight: 400 }}
              onFocus={e => e.target.style.borderBottomColor = C.copper}
              onBlur={e => e.target.style.borderBottomColor = C.borderMedium} />
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, textTransform: "uppercase",
                letterSpacing: ".06em", marginBottom: 12 }}>Quick picks from your history</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["New York", "San Francisco", "Thailand", "Bora Bora", "Morocco", "Mammoth"].map(d => (
                  <button key={d} onClick={() => setNTrip({ ...nTrip, destination: d })}
                    style={{ padding: "8px 16px", borderRadius: 20, border: `1px solid ${C.borderLight}`,
                      background: nTrip.destination === d ? C.copperGlow : C.warmWhite,
                      fontFamily: F.body, fontSize: 13, color: C.charcoal, cursor: "pointer" }}>
                    {HIST_TRIPS.find(t => t.dest === d)?.icon} {d}
                  </button>
                ))}
              </div>
            </div>
          </div>)}

          {/* Step 1: Trip Type */}
          {wStep === 1 && (<div>
            <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400, marginBottom: 8 }}>What kind of trip?</h2>
            <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 28 }}>Select all that apply.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
              {TRIP_TYPES.map(t => {
                const sel = nTrip.tripType.includes(t.id);
                return (<button key={t.id} onClick={() => setNTrip({ ...nTrip, tripType: sel ? nTrip.tripType.filter(x => x !== t.id) : [...nTrip.tripType, t.id] })}
                  style={{ padding: "18px 16px", borderRadius: 16, border: `1.5px solid ${sel ? t.color : C.borderLight}`,
                    background: sel ? `${t.color}10` : C.warmWhite, cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{t.icon}</span>
                  <span style={{ fontFamily: F.body, fontSize: 14, fontWeight: sel ? 600 : 400, color: C.charcoal }}>{t.label}</span>
                </button>);
              })}
            </div>
          </div>)}

          {/* Step 2: Details */}
          {wStep === 2 && (<div>
            <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400, marginBottom: 8 }}>Trip details</h2>
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: ".06em", color: C.warmGray, display: "block", marginBottom: 10 }}>How many days?</label>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button onClick={() => setNTrip({ ...nTrip, days: Math.max(1, nTrip.days - 1) })}
                  style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${C.borderMedium}`,
                    background: C.warmWhite, cursor: "pointer", fontSize: 20, color: C.charcoal,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 400, minWidth: 50, textAlign: "center" }}>{nTrip.days}</span>
                <button onClick={() => setNTrip({ ...nTrip, days: Math.min(30, nTrip.days + 1) })}
                  style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${C.borderMedium}`,
                    background: C.warmWhite, cursor: "pointer", fontSize: 20, color: C.charcoal,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                <span style={{ fontFamily: F.body, fontSize: 14, color: C.softGray }}>days</span>
              </div>
            </div>
            <div>
              <label style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: ".06em", color: C.warmGray, display: "block", marginBottom: 10 }}>Start date (optional)</label>
              <input type="date" value={nTrip.startDate} onChange={e => setNTrip({ ...nTrip, startDate: e.target.value })}
                style={{ fontFamily: F.body, fontSize: 15, padding: "12px 16px", border: `1.5px solid ${C.borderMedium}`,
                  borderRadius: 12, background: C.warmWhite, color: C.charcoal, outline: "none", width: "100%" }} />
            </div>
          </div>)}

          {/* Step 3: Weather / Temperature */}
          {wStep === 3 && (<div>
            <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400, marginBottom: 8 }}>Weather check</h2>
            <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 24 }}>
              We'll try to look up the forecast, or you can pick a temperature range.
            </p>

            {/* Auto-fetch */}
            <div style={{ marginBottom: 24 }}>
              <Btn v="teal" sz="md" onClick={() => doFetchWeather(nTrip.destination)} disabled={weatherLoading || !nTrip.destination}>
                {weatherLoading ? <><Loader size={15} className="spin" /> Checking weather...</> : <><CloudRain size={15} /> Look up forecast for {nTrip.destination || "..."}</>}
              </Btn>
            </div>

            {weatherData && (
              <div style={{ background: C.tealGlow, borderRadius: 16, padding: 20, marginBottom: 24,
                border: `1px solid rgba(78,173,197,.2)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Thermometer size={16} color={C.teal} />
                  <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.teal }}>Current: {weatherData.current.tempF}°F — {weatherData.current.desc}</span>
                </div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {weatherData.forecast.slice(0, 7).map((d, i) => (
                    <div key={i} style={{ minWidth: 70, textAlign: "center", padding: "8px 6px",
                      background: C.warmWhite, borderRadius: 10, border: `1px solid ${C.borderLight}` }}>
                      <div style={{ fontFamily: F.body, fontSize: 10, color: C.softGray }}>
                        {new Date(d.date).toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 600, color: C.charcoal, marginTop: 2 }}>
                        {d.maxF}°
                      </div>
                      <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{d.minF}°</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.teal, marginTop: 10 }}>
                  Auto-detected: <strong>{TEMP_RANGES.find(t => t.id === nTrip.tempRange)?.label}</strong> weather
                </div>
              </div>
            )}

            <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: ".06em", color: C.warmGray, marginBottom: 12 }}>
              {weatherData ? "Or override:" : "Or pick manually:"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {TEMP_RANGES.map(t => (
                <button key={t.id} onClick={() => setNTrip({ ...nTrip, tempRange: t.id })}
                  style={{ padding: "14px 16px", borderRadius: 14, textAlign: "left",
                    border: `1.5px solid ${nTrip.tempRange === t.id ? t.color : C.borderLight}`,
                    background: nTrip.tempRange === t.id ? `${t.color}12` : C.warmWhite,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: nTrip.tempRange === t.id ? 600 : 400, color: C.charcoal }}>{t.label}</div>
                    <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{t.range}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>)}

          {/* Step 4: Review */}
          {wStep === 4 && (<div>
            <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400, marginBottom: 8 }}>Looking good</h2>
            <div style={{ background: C.warmWhite, borderRadius: 20, padding: 28, border: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{TRIP_TYPES.find(t => t.id === nTrip.tripType[0])?.icon || "✈️"}</div>
              <h3 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>
                {nTrip.destination || "Untitled Trip"}
              </h3>
              <div style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 16 }}>
                {nTrip.days} days
                {nTrip.tempRange && ` · ${TEMP_RANGES.find(t => t.id === nTrip.tempRange)?.icon} ${TEMP_RANGES.find(t => t.id === nTrip.tempRange)?.label}`}
                {nTrip.startDate && ` · ${new Date(nTrip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {nTrip.tripType.map(t => {
                  const tt = TRIP_TYPES.find(x => x.id === t);
                  return <span key={t} style={{ padding: "6px 14px", borderRadius: 10, background: `${tt.color}12`,
                    border: `1px solid ${tt.color}30`, fontFamily: F.body, fontSize: 12, fontWeight: 500, color: tt.color }}>
                    {tt.icon} {tt.label}</span>;
                })}
              </div>
            </div>
            <div style={{ marginTop: 20, padding: 16, background: C.sageGlow, borderRadius: 14,
              display: "flex", alignItems: "center", gap: 12 }}>
              <Sparkles size={18} color={C.sage} />
              <span style={{ fontFamily: F.body, fontSize: 13, color: C.sageDark, lineHeight: 1.4 }}>
                Your list will include smart recs for your trip type + weather, with "don't forget" reminders for your blind spots.
              </span>
            </div>
          </div>)}
        </div>

        <div style={{ padding: "16px 28px 28px", display: "flex", gap: 12, maxWidth: 500, margin: "0 auto", width: "100%" }}>
          {wStep > 0 && <Btn v="secondary" sz="lg" onClick={() => setWStep(s => s - 1)} style={{ flex: 1 }}>Back</Btn>}
          {wStep < 4 ? (
            <Btn v="primary" sz="lg" disabled={(wStep === 0 && !nTrip.destination.trim()) || (wStep === 1 && nTrip.tripType.length === 0)}
              onClick={() => setWStep(s => s + 1)} style={{ flex: 1 }}>Continue <ChevronRight size={18} /></Btn>
          ) : (
            <Btn v="sage" sz="lg" onClick={createTrip} style={{ flex: 1 }}>
              <Sparkles size={18} /> Generate my list
            </Btn>
          )}
        </div>
      </div>
    );
  }

  // ═══ TRIP VIEW ═══
  if (view === "trip" && activeTrip) {
    const st = stats(activeTrip);
    let fitems = activeTrip.items;
    if (searchQ) { const q = searchQ.toLowerCase(); fitems = fitems.filter(i => i.name.toLowerCase().includes(q) || i.section.toLowerCase().includes(q)); }
    if (catFilter) fitems = fitems.filter(i => i.category === catFilter);
    if (secFilter) fitems = fitems.filter(i => i.section === secFilter);
    const grouped = groupItems(fitems);
    const refillCount = activeTrip.items.filter(i => i.needsRefill).length;
    const refilledCount = activeTrip.items.filter(i => i.needsRefill && i.refilled).length;
    const refillPending = refillCount - refilledCount;
    const chargeItemCount = activeTrip.items.filter(i => i.needsCharge).length;
    const chargedCount = activeTrip.items.filter(i => i.needsCharge && i.charged).length;
    const chargePending = chargeItemCount - chargedCount;

    return (<>
      <CelebrationLayer />
      <div style={{ minHeight: "100vh", background: C.cream }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,${C.warmWhite},${C.cream})`, padding: "20px 24px 24px",
          borderBottom: `1px solid ${C.borderLight}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => { setView("home"); setSearchQ(""); setCatFilter(null); setSecFilter(null); setRefillMode(false); setChargeMode(false); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <ArrowLeft size={20} color={C.warmGray} />
            </button>
            <div style={{ flex: 1 }} />
            <Btn v="ghost" sz="sm" onClick={() => dupTrip(activeTrip)}><Copy size={14} /></Btn>
            <Btn v="ghost" sz="sm" onClick={() => { if (confirm("Delete this trip?")) deleteTrip(activeTrip.id); }}
              style={{ color: C.danger }}><Trash2 size={14} /></Btn>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ProgressRing pct={st.pct} size={80} sw={5}>
              <span style={{ fontFamily: F.display, fontSize: 22, color: C.charcoal, fontWeight: 500 }}>{st.pct}%</span>
            </ProgressRing>
            <div>
              <h1 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, margin: 0, lineHeight: 1.2 }}>
                {activeTrip.icon} {activeTrip.destination}
              </h1>
              <div style={{ fontFamily: F.body, fontSize: 13, color: C.warmGray, marginTop: 4 }}>
                {activeTrip.days} days · {st.pk} of {st.tot} packed
                {activeTrip.tempRange && ` · ${TEMP_RANGES.find(t => t.id === activeTrip.tempRange)?.icon}`}
              </div>
            </div>
          </div>

          {/* ── Primary Actions ── */}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <Btn v="sage" sz="sm" onClick={() => setGuidedMode(true)} style={{ flex: 1 }}>
              <Zap size={15} /> Focus Pack
            </Btn>
            <Btn v="primary" sz="sm" onClick={() => setOutfitMode(true)} style={{ flex: 1 }}>
              <Shirt size={15} /> Build Outfits
            </Btn>
          </div>

          {/* ── Quick Actions ── */}
          <div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto", paddingBottom: 2 }}>
            {[
              { label: "Out the Door", icon: <DoorOpen size={14} />, action: () => setOutTheDoor(true), color: C.copper },
              { label: "Smart Recs", icon: <Sparkles size={14} />, action: () => setShowRecs(true), color: C.copper },
              { label: "Freak Out", icon: <Brain size={14} />, action: () => setFreakOut(true), color: C.copper },
              { label: "Reset", icon: <RotateCcw size={13} />, action: () => {
                setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, items: t.items.map(i => ({ ...i, packed: false })) } : t));
                setActiveTrip(p => ({ ...p, items: p.items.map(i => ({ ...i, packed: false })) }));
              }, color: C.softGray },
            ].map(({ label, icon, action, color }) => (
              <button key={label} onClick={action} style={{ display: "flex", alignItems: "center", gap: 5,
                padding: "6px 14px", borderRadius: 10, whiteSpace: "nowrap", cursor: "pointer",
                background: C.warmWhite, border: `1px solid ${C.borderLight}`,
                fontFamily: F.body, fontSize: 12, fontWeight: 500, color, transition: "all .15s",
                flexShrink: 0 }}>
                {icon} {label}
              </button>
            ))}
          </div>

          {/* ── Trip Prep ── */}
          {(() => {
            const hasRefills = refillCount > 0;
            const hasCharges = chargeItemCount > 0;
            // Refill & Charge are always available: entering "mark" mode is how
            // items get flagged in the first place, so it must never be gated.
            return (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontFamily: F.body, fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: ".1em", color: C.softGray, marginBottom: 8, paddingLeft: 2 }}>Trip Prep</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {/* Refill toggle */}
                  <button onClick={() => { setRefillMode(!refillMode); setChargeMode(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10,
                      cursor: "pointer", fontFamily: F.body, fontSize: 12, fontWeight: 500, transition: "all .15s",
                      background: refillMode ? `linear-gradient(135deg,${C.amber},#E8B84A)` : C.warmWhite,
                      color: refillMode ? "#fff" : hasRefills ? C.amber : C.warmGray,
                      border: `1px solid ${refillMode ? "transparent" : hasRefills ? "rgba(212,160,74,.3)" : C.borderLight}`,
                      boxShadow: refillMode ? "0 2px 8px rgba(212,160,74,.3)" : "none" }}>
                    <RefreshCw size={13} />
                    {refillMode ? `Done (${refillCount})` : hasRefills ? `Refills ${refilledCount}/${refillCount}` : "Mark Refills"}
                  </button>
                  {/* Focus Refill */}
                  {hasRefills && !refillMode && !chargeMode && (
                    <button onClick={() => setFocusRefill(true)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10,
                        cursor: "pointer", fontFamily: F.body, fontSize: 12, fontWeight: 500,
                        background: C.amberGlow, color: C.amber, border: "1px solid rgba(212,160,74,.2)", transition: "all .15s" }}>
                      <Zap size={12} /> Focus{refillPending > 0 ? ` (${refillPending})` : ""}
                    </button>
                  )}
                  {/* Charge toggle */}
                  <button onClick={() => { setChargeMode(!chargeMode); setRefillMode(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10,
                      cursor: "pointer", fontFamily: F.body, fontSize: 12, fontWeight: 500, transition: "all .15s",
                      background: chargeMode ? `linear-gradient(135deg,${C.teal},#6BC4D8)` : C.warmWhite,
                      color: chargeMode ? "#fff" : hasCharges ? C.teal : C.warmGray,
                      border: `1px solid ${chargeMode ? "transparent" : hasCharges ? "rgba(78,173,197,.3)" : C.borderLight}`,
                      boxShadow: chargeMode ? "0 2px 8px rgba(78,173,197,.3)" : "none" }}>
                    <BatteryCharging size={13} />
                    {chargeMode ? `Done (${chargeItemCount})` : hasCharges ? `Charges ${chargedCount}/${chargeItemCount}` : "Mark Charges"}
                  </button>
                  {/* Focus Charge */}
                  {hasCharges && !chargeMode && !refillMode && (
                    <button onClick={() => setFocusCharge(true)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10,
                        cursor: "pointer", fontFamily: F.body, fontSize: 12, fontWeight: 500,
                        background: C.tealGlow, color: C.teal, border: "1px solid rgba(78,173,197,.2)", transition: "all .15s" }}>
                      <Zap size={12} /> Focus{chargePending > 0 ? ` (${chargePending})` : ""}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Mode banners */}
          {refillMode && (
            <div style={{ marginTop: 12, background: C.amberGlow, borderRadius: 12, padding: "10px 16px",
              display: "flex", alignItems: "center", gap: 8, border: `1px solid rgba(212,160,74,.15)` }}>
              <RefreshCw size={14} color={C.amber} />
              <span style={{ fontFamily: F.body, fontSize: 13, color: C.amber }}>
                Tap items you need to restock before your trip
              </span>
            </div>
          )}
          {chargeMode && (
            <div style={{ marginTop: 12, background: C.tealGlow, borderRadius: 12, padding: "10px 16px",
              display: "flex", alignItems: "center", gap: 8, border: `1px solid rgba(78,173,197,.15)` }}>
              <BatteryCharging size={14} color={C.teal} />
              <span style={{ fontFamily: F.body, fontSize: 13, color: C.teal }}>
                Tap devices you need to charge before your trip
              </span>
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div style={{ padding: "16px 24px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
            background: C.warmWhite, borderRadius: 14, border: `1px solid ${C.borderLight}` }}>
            <Search size={16} color={C.softGray} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search items..."
              style={{ flex: 1, border: "none", background: "none", outline: "none",
                fontFamily: F.body, fontSize: 14, color: C.charcoal }} />
            {searchQ && <button onClick={() => setSearchQ("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
              <X size={14} color={C.softGray} /></button>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto", paddingBottom: 4 }}>
            <button onClick={() => { setCatFilter(null); setSecFilter(null); }} style={{ padding: "6px 14px", borderRadius: 10, whiteSpace: "nowrap",
              border: `1px solid ${!catFilter ? C.copper : C.borderLight}`,
              background: !catFilter ? C.copperGlow : "transparent",
              fontFamily: F.body, fontSize: 12, fontWeight: 500, color: !catFilter ? C.copper : C.warmGray, cursor: "pointer" }}>All</button>
            {CATEGORIES.map(cat => {
              const ci = activeTrip.items.filter(i => i.category === cat.id);
              if (!ci.length) return null;
              const cp = ci.filter(i => i.packed).length, active = catFilter === cat.id;
              return (<button key={cat.id} onClick={() => { setCatFilter(active ? null : cat.id); setSecFilter(null); }}
                style={{ padding: "6px 14px", borderRadius: 10, whiteSpace: "nowrap",
                  border: `1px solid ${active ? cat.color : C.borderLight}`,
                  background: active ? `${cat.color}15` : "transparent",
                  fontFamily: F.body, fontSize: 12, fontWeight: 500, color: active ? cat.color : C.warmGray,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {cat.icon} {cat.label} <span style={{ opacity: .6 }}>{cp}/{ci.length}</span>
              </button>);
            })}
          </div>
          {/* Section sub-pills — visible when a category is selected */}
          {catFilter && (() => {
            const catItems = activeTrip.items.filter(i => i.category === catFilter);
            const sections = [...new Set(catItems.map(i => i.section))];
            const activeCat = CATEGORIES.find(c => c.id === catFilter);
            const acColor = activeCat?.color || C.copper;
            return (
              <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto", paddingBottom: 4, flexWrap: "wrap", alignItems: "center" }}>
                {sections.length > 1 && (
                  <button onClick={() => setSecFilter(null)} style={{ padding: "5px 12px", borderRadius: 8, whiteSpace: "nowrap",
                    border: `1px solid ${!secFilter ? acColor : C.borderLight}`,
                    background: !secFilter ? `${acColor}15` : "transparent",
                    fontFamily: F.body, fontSize: 11, fontWeight: 500,
                    color: !secFilter ? acColor : C.softGray, cursor: "pointer" }}>
                    All {activeCat?.label || ""}
                  </button>
                )}
                {sections.map(sec => {
                  const si = catItems.filter(i => i.section === sec);
                  const sp = si.filter(i => i.packed).length;
                  const active = secFilter === sec;
                  return (
                    <button key={sec} onClick={() => setSecFilter(active ? null : sec)}
                      style={{ padding: "5px 12px", borderRadius: 8, whiteSpace: "nowrap",
                        border: `1px solid ${active ? acColor : C.borderLight}`,
                        background: active ? `${acColor}15` : "transparent",
                        fontFamily: F.body, fontSize: 11, fontWeight: 500,
                        color: active ? acColor : C.softGray,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      {sec} <span style={{ opacity: .5 }}>{sp}/{si.length}</span>
                    </button>
                  );
                })}
                {addingSec === catFilter ? (
                  <form onSubmit={e => { e.preventDefault(); addSection(catFilter, newSecName); }}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input ref={newSecRef} value={newSecName} onChange={e => setNewSecName(e.target.value)}
                      placeholder="Section name..."
                      autoFocus
                      onBlur={() => { if (!newSecName.trim()) { setAddingSec(null); setNewSecName(""); } }}
                      onKeyDown={e => { if (e.key === "Escape") { setAddingSec(null); setNewSecName(""); } }}
                      style={{ fontFamily: F.body, fontSize: 11, padding: "5px 10px", borderRadius: 8,
                        border: `1.5px solid ${acColor}`, background: C.warmWhite, outline: "none",
                        color: C.charcoal, width: 120 }} />
                    <button type="submit" style={{ padding: "4px 10px", borderRadius: 8, border: "none",
                      background: acColor, color: "#fff", fontFamily: F.body, fontSize: 11,
                      fontWeight: 600, cursor: "pointer" }}>Add</button>
                  </form>
                ) : (
                  <button onClick={() => { setAddingSec(catFilter); setNewSecName(""); }}
                    style={{ padding: "5px 10px", borderRadius: 8, whiteSpace: "nowrap",
                      border: `1px dashed ${C.borderMedium}`,
                      background: "transparent", fontFamily: F.body, fontSize: 11, fontWeight: 500,
                      color: C.softGray, cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
                      transition: "all .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = acColor; e.currentTarget.style.color = acColor; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderMedium; e.currentTarget.style.color = C.softGray; }}>
                    <Plus size={12} /> Section
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {/* Items */}
        <div style={{ padding: "8px 16px 100px" }}>
          {CATEGORIES.map(cat => {
            const cs = grouped[cat.id]; if (!cs) return null;
            const ci = activeTrip.items.filter(i => i.category === cat.id);
            const cp = ci.filter(i => i.packed).length, allDone = cp === ci.length;
            return (
              <div key={cat.id} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 8px 4px" }}>
                  <span style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span style={{ fontFamily: F.display, fontSize: 20, color: C.charcoal, fontWeight: 500 }}>{cat.label}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: allDone ? C.sage : C.softGray }}>
                    {allDone ? "✓ Complete" : `${cp}/${ci.length}`}
                  </span>
                </div>
                <div style={{ background: C.warmWhite, borderRadius: 16, border: `1px solid ${C.borderLight}`, padding: "4px 0" }}>
                  {Object.entries(cs).map(([sec, items]) => (
                    <PackSection key={sec} title={sec} items={items}
                      onToggle={iid => toggle(activeTrip.id, iid)} onRemove={iid => removeItem(activeTrip.id, iid)}
                      onAddItem={name => addItem(activeTrip.id, sec, cat.id, name)}
                      readOnly={false} refillMode={refillMode}
                      onToggleRefill={iid => toggleRefill(activeTrip.id, iid)}
                      onToggleRefilled={iid => toggleRefilled(activeTrip.id, iid)}
                      chargeMode={chargeMode}
                      onToggleCharge={iid => toggleCharge(activeTrip.id, iid)}
                      onToggleCharged={iid => toggleCharged(activeTrip.id, iid)} />
                  ))}
                  {!refillMode && !chargeMode && (
                    addingSec === cat.id && !catFilter ? (
                      <form onSubmit={e => { e.preventDefault(); addSection(cat.id, newSecName); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px" }}>
                        <input autoFocus value={newSecName} onChange={e => setNewSecName(e.target.value)}
                          placeholder="New section name..."
                          onBlur={() => { if (!newSecName.trim()) { setAddingSec(null); setNewSecName(""); } }}
                          onKeyDown={e => { if (e.key === "Escape") { setAddingSec(null); setNewSecName(""); } }}
                          style={{ flex: 1, fontFamily: F.body, fontSize: 13, padding: "8px 12px",
                            border: `1.5px solid ${cat.color || C.copper}`, borderRadius: 10, background: C.warmWhite,
                            outline: "none", color: C.charcoal }} />
                        <Btn v="primary" sz="sm" onClick={() => addSection(cat.id, newSecName)}>Add</Btn>
                      </form>
                    ) : !catFilter && (
                      <button onClick={() => { setAddingSec(cat.id); setNewSecName(""); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                          background: "none", border: "none", cursor: "pointer", fontFamily: F.body, fontSize: 12,
                          color: C.softGray, borderRadius: 10, width: "100%", transition: "all .15s",
                          fontWeight: 500, letterSpacing: ".03em" }}
                        onMouseEnter={e => { e.currentTarget.style.color = cat.color || C.copper; e.currentTarget.style.background = C.copperSubtle; }}
                        onMouseLeave={e => { e.currentTarget.style.color = C.softGray; e.currentTarget.style.background = "none"; }}>
                        <Plus size={13} /> Add section
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>);
  }

  // ═══ INSIGHTS ═══
  if (view === "insights") {
    return (
      <div style={{ minHeight: "100vh", background: C.cream }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid ${C.borderLight}` }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ArrowLeft size={20} color={C.warmGray} />
          </button>
          <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>Insights</span>
        </div>
        <div style={{ padding: "24px 20px" }}>
          <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>Your packing intelligence</h2>
          <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 28 }}>Built from 22 trips of personal data.</p>
          <Insights trips={trips} />
        </div>
      </div>
    );
  }

  // ═══ HISTORY ═══
  if (view === "history") {
    return (
      <div style={{ minHeight: "100vh", background: C.cream }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid ${C.borderLight}` }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ArrowLeft size={20} color={C.warmGray} />
          </button>
          <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>Trip History</span>
        </div>
        <div style={{ padding: "24px 20px" }}>
          <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>Past adventures</h2>
          <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 24 }}>Tap any trip to see what you packed.</p>
          <div style={{ display: "grid", gap: 10 }}>
            {HIST_TRIPS.map(t => (
              <button key={t.dest} onClick={() => { setHistTrip(t); setView("hist-detail"); }}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 16,
                  background: C.warmWhite, border: `1px solid ${C.borderLight}`, cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "all .2s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${C.shadowMed}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <span style={{ fontSize: 28 }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>{t.dest}</div>
                  <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>{t.dates} · {t.days} days</div>
                </div>
                <div style={{ padding: "4px 12px", borderRadius: 8, background: C.copperSubtle,
                  fontFamily: F.body, fontSize: 11, fontWeight: 500, color: C.warmGray, textTransform: "capitalize" }}>{t.type}</div>
                <ChevronRight size={16} color={C.softGray} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ═══ GLOBAL OTD EDITOR ═══
  if (editGlobalOtd) {
    return <GlobalOtdEditor items={otdItems} setItems={setOtdItems} onExit={() => setEditGlobalOtd(false)} />;
  }

  // ═══ HOME ═══
  return (
    <div style={{ minHeight: "100vh", background: C.cream }}>
      <div style={{ padding: "48px 28px 32px",
        background: `linear-gradient(160deg,${C.warmWhite} 0%,${C.cream} 60%,rgba(193,127,89,.05) 100%)` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: ".12em", color: C.copper }}>PackPal</div>
          <AccountBadge />
        </div>
        <h1 style={{ fontFamily: F.display, fontSize: 40, color: C.charcoal, fontWeight: 400, margin: 0, lineHeight: 1.15 }}>
          Pack smarter,<br />not harder.
        </h1>
        <p style={{ fontFamily: F.body, fontSize: 15, color: C.warmGray, marginTop: 12, lineHeight: 1.5, maxWidth: 340 }}>
          Your personal packing assistant, trained on 22 of your real trips.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <Btn v="primary" sz="lg" onClick={() => setView("new-trip")}><Plus size={18} /> New Trip</Btn>
          <Btn v="lavender" sz="lg" onClick={() => setFreakOut(true)}><Brain size={18} /> Freak Out</Btn>
        </div>
      </div>

      {/* Active trips */}
      {trips.length > 0 && (
        <div style={{ padding: "0 20px 24px" }}>
          <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: ".08em", color: C.warmGray, padding: "20px 8px 12px" }}>Your trips</div>
          <div style={{ display: "grid", gap: 12 }}>
            {trips.map(trip => {
              const st = stats(trip);
              return (
                <button key={trip.id} onClick={() => { setActiveTrip(trip); setView("trip"); }}
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: 18,
                    background: C.warmWhite, border: `1px solid ${C.borderLight}`, cursor: "pointer",
                    textAlign: "left", width: "100%", transition: "all .2s", boxShadow: `0 2px 8px ${C.shadow}` }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 16px ${C.shadowMed}`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 2px 8px ${C.shadow}`; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <ProgressRing pct={st.pct} size={52} sw={4}>
                    <span style={{ fontSize: 20 }}>{trip.icon}</span>
                  </ProgressRing>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.body, fontSize: 16, fontWeight: 500, color: C.charcoal }}>{trip.destination}</div>
                    <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>
                      {trip.days} days · {st.pk}/{st.tot} packed
                    </div>
                  </div>
                  <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 500,
                    color: st.pct === 100 ? C.sage : C.copper }}>{st.pct}%</div>
                  <ChevronRight size={18} color={C.softGray} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ padding: "0 20px 32px" }}>
        <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".08em", color: C.warmGray, padding: "8px 8px 12px" }}>Explore</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          {[
            { label: "Trip History", sub: "22 past trips", icon: <Clock size={20} />, act: () => setView("history"), col: C.copper },
            { label: "Insights", sub: "Patterns & tips", icon: <BarChart3 size={20} />, act: () => setView("insights"), col: C.sage },
            { label: "Freak Out Mode", sub: "ADHD support", icon: <Brain size={20} />, act: () => setFreakOut(true), col: C.lavender },
            { label: "Out the Door", sub: `${otdItems.length} default items`, icon: <DoorOpen size={20} />, act: () => setEditGlobalOtd(true), col: "#C17F59" },
            { label: "Quick Pack", sub: "Weekend getaway", icon: <Timer size={20} />, act: () => {
              setNTrip({ destination: "", tripType: ["city"], days: 3, weather: "warm", startDate: "", tempRange: "warm" });
              setView("new-trip");
            }, col: "#C47EAA" },
          ].map(({ label, sub, icon, act, col }) => (
            <button key={label} onClick={act} style={{ padding: "22px 18px", borderRadius: 18, textAlign: "left",
              background: C.warmWhite, border: `1px solid ${C.borderLight}`, cursor: "pointer",
              transition: "all .2s", boxShadow: `0 1px 4px ${C.shadow}` }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 16px ${C.shadowMed}`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 1px 4px ${C.shadow}`; }}>
              <div style={{ color: col, marginBottom: 12 }}>{icon}</div>
              <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.charcoal }}>{label}</div>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 28px 40px", textAlign: "center", borderTop: `1px solid ${C.borderLight}` }}>
        <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, letterSpacing: ".04em" }}>
          Built for Elizabeth · Powered by 22 trips of real data
        </div>
      </div>
    </div>
  );
}
