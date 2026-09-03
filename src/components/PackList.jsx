// A packing-list row (PackItem) and a collapsible section of rows (PackSection).
import { useState, useEffect, useRef } from "react";
import { Plus, Check, ChevronRight, X, RefreshCw, BatteryCharging } from "lucide-react";
import { C, F } from "../lib/theme";
import { Btn } from "./ui";

export function PackItem({ item, onToggle, onRemove, readOnly, refillMode, onToggleRefill, onToggleRefilled, chargeMode, onToggleCharge, onToggleCharged }) {
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

export function PackSection({ title, items, onToggle, onRemove, onAddItem, readOnly, refillMode, onToggleRefill, onToggleRefilled, chargeMode, onToggleCharge, onToggleCharged }) {
  const [override, setOverride] = useState(null); // null = auto: collapse once complete
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState("");
  const ref = useRef(null);
  const pk = items.filter(i => i.packed).length, tot = items.length, done = tot > 0 && pk === tot;
  // Auto-collapse a completed section (tap the header to reopen). Always open in
  // refill/charge modes, which need every item visible.
  const open = override !== null ? override : ((refillMode || chargeMode) ? true : !done);
  useEffect(() => { if (adding && ref.current) ref.current.focus(); }, [adding]);
  const markMode = refillMode || chargeMode;
  const refillCount = refillMode ? items.filter(i => i.needsRefill).length : 0;
  const chargeCount = chargeMode ? items.filter(i => i.needsCharge).length : 0;

  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={() => setOverride(!open)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
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
