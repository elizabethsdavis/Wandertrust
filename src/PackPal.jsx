import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Plus, Check, ChevronRight, Sparkles, ArrowLeft, X, Clock, Zap, WashingMachine, ChevronsDownUp, ChevronsUpDown, Share2, GripVertical, Save, RotateCcw, Trash2, Copy, Brain, BarChart3, Timer, Shield, RefreshCw, Thermometer, CloudRain, Eye, Star, Loader, Shirt, Gem, Watch, Footprints, ShoppingBag, Palette, ChevronLeft, DoorOpen, Edit3, BatteryCharging } from "lucide-react";
import { usePersist, useStoreMeta } from "./lib/store";
import AccountBadge from "./components/Account";
import TemplateEditor from "./components/TemplateEditor";
import { C, F } from "./lib/theme";
import { id, haptic, lastGrapheme } from "./lib/utils";
import { fetchWeather } from "./lib/weather";
import { genList, genTripOtd, tempToRange } from "./lib/packing";
import { TRIP_TYPES, TEMP_RANGES, CATEGORIES } from "./data/taxonomy";
import { HIST_TRIPS } from "./data/history";
import { useCelebration } from "./components/celebration";
import { ProgressRing, Btn } from "./components/ui";
import { PackSection } from "./components/PackList";
import { FreakOutMode } from "./components/FreakOutMode";
import { GuidedPack } from "./components/GuidedPack";
import { FocusRefill } from "./components/FocusRefill";
import { FocusCharge } from "./components/FocusCharge";
import { FocusLaundry } from "./components/FocusLaundry";
import { ShareSheet } from "./components/ShareSheet";
import { TemplateSync } from "./components/TemplateSync";
import { ArrangeList } from "./components/ArrangeList";
import { tripToMarkdown, markdownFileName } from "./lib/exportList";
import { parseItemMeta, swatchBackground } from "./lib/wardrobe";
import { WardrobeMetaPicker } from "./components/WardrobeMetaPicker";
import { DEFAULT_OTD_ITEMS } from "./data/otdDefaults";
import { migrateTrip, migrateTemplate, slotToSection } from "./lib/migrations";
import { GlobalOtdEditor } from "./components/GlobalOtdEditor";
import { SmartRecsView } from "./components/SmartRecsView";
import { Insights } from "./components/Insights";

// ═══════════════════════════════════════════════════════════════
// PACKPAL v2 — Elizabeth's Personal Packing Intelligence
// ═══════════════════════════════════════════════════════════════

// Design tokens (C = palette, F = fonts) and the id/haptic helpers now live in
// shared modules — imported above. See ./lib/theme and ./lib/utils.

// ── Persist ──
// usePersist now lives in ./lib/store — it transparently syncs to Firebase
// (Firestore) when signed in, and falls back to localStorage (these same pp2_* keys) offline.
// Imported at the top of this file; the call sites below are unchanged.

// ═══════════════════════════════════════════════════════
// IN-FILE VIEW COMPONENTS
// ═══════════════════════════════════════════════════════
// The props-only leaf components (ProgressRing/Btn/MiniBar, PackItem/PackSection,
// the celebration hook, Freak Out, Focus Pack/Refill/Charge, Smart Recs, Insights,
// the global OTD editor) live in ./components. OutTheDoor and OutfitBuilder are
// still here on purpose: they are wired tightly into trip state and were flagged
// as the risky extractions in the audit — move them one at a time, with both
// harnesses (scripts/browser-checks.py, scripts/cloud-checks.py) run after each.

// ═══════════════════════════════════════════════════════
// OUT THE DOOR
// ═══════════════════════════════════════════════════════

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

function WardrobeCarousel({ slotId, wardrobe, wardrobeMeta, onSetMeta, onSelect, selected, onRemoveItem }) {
  const items = (wardrobe[slotId] || []);
  const scrollRef = useRef(null);
  const [fixing, setFixing] = useState(null); // item name whose colour/brand is being corrected
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
      {fixing && (
        <WardrobeMetaPicker name={fixing} meta={wardrobeMeta?.[fixing]} onClose={() => setFixing(null)}
          onSave={(patch) => onSetMeta?.(fixing, patch)} />
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
                  {/* Colour / brand / pattern row — tap to correct */}
                  <span role="button" tabIndex={0} title="Tap to fix the colour or brand"
                    onClick={(e) => { e.stopPropagation(); setFixing(item); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setFixing(item); } }}
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

function OutfitBuilder({ trip, wardrobe, setWardrobe, wardrobeMeta, setWardrobeMeta, customOccasions, setCustomOccasions, onSave, onExit, celebrate }) {
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
    // Celebrate a substantially complete outfit (3+ real slots filled). Uses the
    // module-level OUTFIT_SLOTS — a local shadow used to list a non-existent
    // `jewelry` slot and ignored the multi-select accessory slots entirely.
    if (editing && currentOccasion) {
      const filledSlots = OUTFIT_SLOTS.filter(s => {
        const v = currentOccasion.slots?.[s.id];
        return Array.isArray(v) ? v.length > 0 : !!v;
      });
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
                    <input value={dayEmojiVal} onChange={e => setDayEmojiVal(lastGrapheme(e.target.value))}
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
                              <input value={occEmojiVal} onChange={e => setOccEmojiVal(lastGrapheme(e.target.value))}
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
                            <input value={newTypeEmoji} onChange={e => setNewTypeEmoji(lastGrapheme(e.target.value))}
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
          <WardrobeCarousel slotId={currentSlot.id} wardrobe={wardrobe} wardrobeMeta={wardrobeMeta}
            onSetMeta={(name, patch) => setWardrobeMeta(prev => { const next = { ...(prev || {}) }; if (patch) next[name] = patch; else delete next[name]; return next; })}
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
  // The open trip is a *lookup* into `trips`, never a second copy. Every mutation
  // goes through setTrips exactly once; the old paired setActiveTrip writes were a
  // bug magnet (e.g. outfit items minted different ids in the two copies, so packing
  // them was never persisted).
  const [activeTripId, setActiveTripId] = useState(null);
  const activeTrip = useMemo(
    () => (activeTripId ? trips.find(t => t.id === activeTripId) || null : null),
    [trips, activeTripId]
  );
  const [guidedMode, setGuidedMode] = useState(false);
  const [freakOut, setFreakOut] = useState(false);
  const [refillMode, setRefillMode] = useState(false);
  const [showRecs, setShowRecs] = useState(false);
  const [outfitMode, setOutfitMode] = useState(false);
  const [outTheDoor, setOutTheDoor] = useState(false);
  const [focusRefill, setFocusRefill] = useState(false);
  const [chargeMode, setChargeMode] = useState(false);
  const [focusCharge, setFocusCharge] = useState(false);
  const [washMode, setWashMode] = useState(false);
  const [focusLaundry, setFocusLaundry] = useState(false);
  const [sectionsForce, setSectionsForce] = useState(null); // { open: bool, seq } from the Collapse all / Expand all control
  const [shareOpen, setShareOpen] = useState(false);
  const [templateSync, setTemplateSync] = useState(false);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [wardrobe, setWardrobe] = usePersist("wardrobe", {});
  const [wardrobeMeta, setWardrobeMeta] = usePersist("wardrobeMeta", {}); // { [itemName]: { color?, brand? } } corrections (additive key)
  const [customOccasions, setCustomOccasions] = usePersist("customOccasions", []);
  const [otdItems, setOtdItems] = usePersist("otdItems", DEFAULT_OTD_ITEMS);
  const [editGlobalOtd, setEditGlobalOtd] = useState(false);
  const [catalogTemplate, setCatalogTemplate] = usePersist("catalogTemplate", null);
  const [editTemplate, setEditTemplate] = useState(false);

  // Migrations (see ./lib/migrations): checkout → OTD, Health & Wellness relabel,
  // Clothing → Tops/Bottoms. Idempotent: only writes when something actually changes.
  // Timing (audit B6): StoreProvider renders a splash until the cloud blob has loaded, so
  // this component never mounts with stale/empty `trips`; the `ready` gate makes that
  // invariant explicit instead of relying on the splash.
  const { ready: storeReady } = useStoreMeta();
  useEffect(() => {
    if (!storeReady) return;
    let changed = false;
    const migrated = trips.map(t => {
      const r = migrateTrip(t, otdItems);
      if (r.changed) changed = true;
      return r.trip;
    });
    if (changed) setTrips(migrated);
    const tr = migrateTemplate(catalogTemplate);
    if (tr.changed) setCatalogTemplate(tr.template);
  }, [storeReady]);

  const [searchQ, setSearchQ] = useState("");
  const [catFilter, setCatFilter] = useState(null);
  const [secFilter, setSecFilter] = useState(null);
  const [addingSec, setAddingSec] = useState(null); // category id we're adding a section to
  const [catOverride, setCatOverride] = useState({}); // trip view: completed categories the user manually expanded, keyed `${tripId}:${catId}`
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
    const items = genList(nTrip.tripType, nTrip.days, catalogTemplate);
    const tripOtd = genTripOtd(otdItems, nTrip.tripType);
    const trip = { id: id(), ...nTrip, items, otdItems: tripOtd, otdChecked: {}, createdAt: new Date().toISOString(),
      icon: TRIP_TYPES.find(t => t.id === nTrip.tripType[0])?.icon || "✈️", weatherData };
    setTrips(p => [trip, ...p]);
    setActiveTripId(trip.id);
    setView("trip");
    setNTrip({ destination: "", tripType: [], days: 4, weather: "warm", startDate: "", tempRange: "" });
    setWStep(0); setWeatherData(null);
  };

  const toggle = (tid, iid) => {
    const trip = trips.find(t => t.id === tid);
    const item = trip?.items.find(i => i.id === iid);
    const wasPacked = item?.packed;
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, packed: !i.packed } : i) } : t));
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
  };
  const toggleRefilled = (tid, iid) => {
    const trip = trips.find(t => t.id === tid);
    const item = trip?.items.find(i => i.id === iid);
    const wasRefilled = item?.refilled;
    haptic("success");
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, refilled: !i.refilled } : i) } : t));
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
  };
  const toggleCharged = (tid, iid) => {
    const trip = trips.find(t => t.id === tid);
    const item = trip?.items.find(i => i.id === iid);
    const wasCharged = item?.charged;
    haptic("success");
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, charged: !i.charged } : i) } : t));
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
  const reorderItems = (tid, nextItems) => {
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: nextItems } : t));
  };
  const toggleWash = (tid, iid) => {
    haptic("light");
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, needsWash: !i.needsWash } : i) } : t));
  };
  const toggleWashed = (tid, iid) => {
    const trip = trips.find(t => t.id === tid);
    const item = trip?.items.find(i => i.id === iid);
    const wasWashed = item?.washed;
    haptic("success");
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, washed: !i.washed } : i) } : t));
    if (!wasWashed && item) {
      setTimeout(() => {
        const t = trips.find(tr => tr.id === tid);
        if (!t) return;
        const updated = t.items.map(i => i.id === iid ? { ...i, washed: true } : i);
        const washItems = updated.filter(i => i.needsWash);
        if (washItems.length > 0 && washItems.every(i => i.washed)) celebrate("allWashed", "medium");
      }, 50);
    }
  };
  const addItem = (tid, sec, cat, name) => {
    const ni = { id: id(), name, section: sec, category: cat, packed: false, essential: false, ff: false, freq: 0, needsRefill: false, needsCharge: false };
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: [...t.items, ni] } : t));
  };
  const addRecItem = (name) => {
    if (!activeTrip) return;
    const ni = { id: id(), name, section: "Smart Recommendations", category: "necessities", packed: false, essential: false, ff: false, freq: 0, needsRefill: false, needsCharge: false };
    setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, items: [...t.items, ni] } : t));
  };
  const addSection = (catId, secName) => {
    if (!activeTrip || !secName.trim()) return;
    // Check if section already exists in this category
    const exists = activeTrip.items.some(i => i.category === catId && i.section.toLowerCase() === secName.trim().toLowerCase());
    if (exists) return;
    // Add a placeholder item so the section appears — user will rename/add real items
    const ni = { id: id(), name: "New item", section: secName.trim(), category: catId, packed: false, essential: false, ff: false, freq: 0, needsRefill: false, needsCharge: false };
    setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, items: [...t.items, ni] } : t));
    setAddingSec(null);
    setNewSecName("");
    haptic("success");
  };
  const removeItem = (tid, iid) => {
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.filter(i => i.id !== iid) } : t));
  };
  const deleteTrip = (tid) => {
    setTrips(p => p.filter(t => t.id !== tid));
    if (activeTripId === tid) { setActiveTripId(null); setView("home"); }
  };
  const dupTrip = (trip) => {
    // Fresh item ids + every progress flag cleared (packed / refill / charge).
    const ni = trip.items.map(i => ({ ...i, id: id(), packed: false, needsRefill: false, needsCharge: false, refilled: false, charged: false }));
    // Keep the outfit plan (a copy of a trip wants the same outfits) but deep-copy it
    // with fresh occasion ids so the two trips never share objects or ids.
    const outfitPlan = Array.isArray(trip.outfitPlan)
      ? trip.outfitPlan.map(day => (day || []).map(occ => ({ ...occ, id: id(), slots: JSON.parse(JSON.stringify(occ.slots || {})) })))
      : undefined;
    const d = {
      ...trip, id: id(), items: ni,
      otdChecked: {}, // Out-the-Door progress belongs to the original trip, not the copy
      ...(outfitPlan ? { outfitPlan } : {}),
      ...(Array.isArray(trip.outfitDayNames) ? { outfitDayNames: [...trip.outfitDayNames] } : {}),
      ...(trip.dayEmojis ? { dayEmojis: { ...trip.dayEmojis } } : {}),
      createdAt: new Date().toISOString(), destination: `${trip.destination} (copy)`,
    };
    setTrips(p => [d, ...p]); setActiveTripId(d.id); setView("trip");
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
      onToggleWashed={iid => toggleWashed(activeTrip.id, iid)}
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

  // ═══ SAVE TO TEMPLATE ═══
  if (templateSync && activeTrip) {
    return <TemplateSync trip={activeTrip} template={catalogTemplate}
      onApply={(next) => setCatalogTemplate(next)} onExit={() => setTemplateSync(false)} />;
  }

  // ═══ FOCUS LAUNDRY ═══
  if (focusLaundry && activeTrip) {
    return <><FocusLaundry items={activeTrip.items}
      onToggleWash={iid => toggleWash(activeTrip.id, iid)}
      onToggleWashed={iid => toggleWashed(activeTrip.id, iid)}
      onExit={() => setFocusLaundry(false)} tripName={activeTrip.destination} /><CelebrationLayer /></>;
  }

  // ═══ SMART RECS ═══
  if (showRecs && activeTrip) {
    return <SmartRecsView tripTypes={activeTrip.tripType} tempRange={activeTrip.tempRange}
      onAdd={addRecItem} onClose={() => setShowRecs(false)} />;
  }

  // ═══ OUTFIT BUILDER ═══
  if (outfitMode && activeTrip) {
    return <><OutfitBuilder trip={activeTrip} wardrobe={wardrobe} setWardrobe={setWardrobe} wardrobeMeta={wardrobeMeta} setWardrobeMeta={setWardrobeMeta}
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
        } else {
          setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, outfitPlan: occasions, outfitDayNames: dayNames, dayEmojis: dayEmojis || {} } : t));
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
      }}
      otdChecked={tripOtdChecked}
      celebrate={celebrate}
      setOtdChecked={(updater) => {
        const update = typeof updater === "function" ? updater : () => updater;
        setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, otdChecked: update(t.otdChecked || {}) } : t));
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
    const washItemCount = activeTrip.items.filter(i => i.needsWash).length;
    const washedCount = activeTrip.items.filter(i => i.needsWash && i.washed).length;
    const washPending = washItemCount - washedCount;

    return (<>
      <CelebrationLayer />
      {shareOpen && (
        <ShareSheet text={tripToMarkdown(activeTrip, { otdItems })} filename={markdownFileName(activeTrip)}
          title={`${activeTrip.destination} — packing list`} onClose={() => setShareOpen(false)} />
      )}
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
              { label: "Share", icon: <Share2 size={14} />, action: () => setShareOpen(true), color: C.copper },
              { label: "Save to template", icon: <Save size={14} />, action: () => setTemplateSync(true), color: C.sage },
              { label: arrangeMode ? "Done arranging" : "Arrange", icon: <GripVertical size={14} />, action: () => setArrangeMode(a => !a), color: arrangeMode ? C.sage : C.copper },
              { label: "Smart Recs", icon: <Sparkles size={14} />, action: () => setShowRecs(true), color: C.copper },
              { label: "Freak Out", icon: <Brain size={14} />, action: () => setFreakOut(true), color: C.copper },
              { label: "Reset", icon: <RotateCcw size={13} />, action: () => {
                setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, items: t.items.map(i => ({ ...i, packed: false })) } : t));
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
            const hasWashes = washItemCount > 0;
            // Refill & Charge are always available: entering "mark" mode is how
            // items get flagged in the first place, so it must never be gated.
            return (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontFamily: F.body, fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: ".1em", color: C.softGray, marginBottom: 8, paddingLeft: 2 }}>Trip Prep</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {/* Refill toggle */}
                  <button onClick={() => { setRefillMode(!refillMode); setChargeMode(false); setWashMode(false); }}
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
                  {hasRefills && !refillMode && !chargeMode && !washMode && (
                    <button onClick={() => setFocusRefill(true)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10,
                        cursor: "pointer", fontFamily: F.body, fontSize: 12, fontWeight: 500,
                        background: C.amberGlow, color: C.amber, border: "1px solid rgba(212,160,74,.2)", transition: "all .15s" }}>
                      <Zap size={12} /> Focus{refillPending > 0 ? ` (${refillPending})` : ""}
                    </button>
                  )}
                  {/* Charge toggle */}
                  <button onClick={() => { setChargeMode(!chargeMode); setRefillMode(false); setWashMode(false); }}
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
                  {hasCharges && !chargeMode && !refillMode && !washMode && (
                    <button onClick={() => setFocusCharge(true)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10,
                        cursor: "pointer", fontFamily: F.body, fontSize: 12, fontWeight: 500,
                        background: C.tealGlow, color: C.teal, border: "1px solid rgba(78,173,197,.2)", transition: "all .15s" }}>
                      <Zap size={12} /> Focus{chargePending > 0 ? ` (${chargePending})` : ""}
                    </button>
                  )}
                  {/* Laundry toggle */}
                  <button onClick={() => { setWashMode(!washMode); setRefillMode(false); setChargeMode(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10,
                      cursor: "pointer", fontFamily: F.body, fontSize: 12, fontWeight: 500, transition: "all .15s",
                      background: washMode ? `linear-gradient(135deg,${C.lavender},#B8A8D8)` : C.warmWhite,
                      color: washMode ? "#fff" : hasWashes ? C.lavender : C.warmGray,
                      border: `1px solid ${washMode ? "transparent" : hasWashes ? "rgba(155,142,196,.3)" : C.borderLight}`,
                      boxShadow: washMode ? "0 2px 8px rgba(155,142,196,.3)" : "none" }}>
                    <WashingMachine size={13} />
                    {washMode ? `Done (${washItemCount})` : hasWashes ? `Laundry ${washedCount}/${washItemCount}` : "Mark Laundry"}
                  </button>
                  {/* Focus Laundry */}
                  {hasWashes && !washMode && !refillMode && !chargeMode && (
                    <button onClick={() => setFocusLaundry(true)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10,
                        cursor: "pointer", fontFamily: F.body, fontSize: 12, fontWeight: 500,
                        background: C.lavenderGlow, color: C.lavender, border: "1px solid rgba(155,142,196,.2)", transition: "all .15s" }}>
                      <Zap size={12} /> Focus{washPending > 0 ? ` (${washPending})` : ""}
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
          {washMode && (
            <div style={{ marginTop: 12, background: C.lavenderGlow, borderRadius: 12, padding: "10px 16px",
              display: "flex", alignItems: "center", gap: 8, border: `1px solid rgba(155,142,196,.15)` }}>
              <WashingMachine size={14} color={C.lavender} />
              <span style={{ fontFamily: F.body, fontSize: 13, color: C.lavender }}>
                Tap clothes that need a wash before you pack them
              </span>
            </div>
          )}
        </div>

        {arrangeMode ? (
          <ArrangeList items={activeTrip.items} onReorder={(next) => reorderItems(activeTrip.id, next)} onDone={() => setArrangeMode(false)} />
        ) : (<>
        {/* Search & Filter */}
        <div style={{ padding: "16px 24px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
              background: C.warmWhite, borderRadius: 14, border: `1px solid ${C.borderLight}` }}>
              <Search size={16} color={C.softGray} />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search items..."
                style={{ flex: 1, minWidth: 0, border: "none", background: "none", outline: "none",
                  fontFamily: F.body, fontSize: 14, color: C.charcoal }} />
              {searchQ && <button onClick={() => setSearchQ("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                <X size={14} color={C.softGray} /></button>}
            </div>
            {/* Collapse all / Expand all — sections only (categories keep their own fold) */}
            <button onClick={() => setSectionsForce(f => ({ open: f ? !f.open : false, seq: (f?.seq || 0) + 1 }))}
              title={sectionsForce && !sectionsForce.open ? "Expand all sections" : "Collapse all sections"}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 12px", borderRadius: 14, flexShrink: 0,
                background: C.warmWhite, border: `1px solid ${C.borderLight}`, cursor: "pointer",
                fontFamily: F.body, fontSize: 12, fontWeight: 500, color: C.warmGray }}>
              {sectionsForce && !sectionsForce.open ? <ChevronsUpDown size={15} /> : <ChevronsDownUp size={15} />}
              {sectionsForce && !sectionsForce.open ? "Expand" : "Collapse"}
            </button>
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

        {/* Items — keyed by trip so per-section collapse state (PackSection) resets on a
            direct trip→trip switch (e.g. Duplicate) instead of carrying over. */}
        <div key={activeTrip.id} style={{ padding: "8px 16px 100px" }}>
          {CATEGORIES.map(cat => {
            const cs = grouped[cat.id]; if (!cs) return null;
            const ci = activeTrip.items.filter(i => i.category === cat.id);
            const cp = ci.filter(i => i.packed).length, allDone = cp === ci.length;
            // Collapse a whole category once every item in it is packed (normal view only).
            const catCollapsible = allDone && !refillMode && !chargeMode && !washMode && !catFilter && !searchQ;
            const catKey = `${activeTrip.id}:${cat.id}`; // per-trip: an expand in one trip must not leak into another
            const catOpen = catCollapsible ? catOverride[catKey] === true : true;
            return (
              <div key={cat.id} style={{ marginBottom: 24 }}>
                <div onClick={catCollapsible ? () => setCatOverride(o => ({ ...o, [catKey]: !catOpen })) : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 8px 4px",
                    cursor: catCollapsible ? "pointer" : "default" }}>
                  <span style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span style={{ fontFamily: F.display, fontSize: 20, color: C.charcoal, fontWeight: 500 }}>{cat.label}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: allDone ? C.sage : C.softGray }}>
                    {allDone ? "✓ Complete" : `${cp}/${ci.length}`}
                  </span>
                  {catCollapsible && (
                    <div style={{ transition: "transform .2s", transform: catOpen ? "rotate(90deg)" : "rotate(0)" }}>
                      <ChevronRight size={16} color={C.softGray} />
                    </div>
                  )}
                </div>
                {catOpen && (
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
                      onToggleCharged={iid => toggleCharged(activeTrip.id, iid)}
                      washMode={washMode}
                      onToggleWash={iid => toggleWash(activeTrip.id, iid)}
                      onToggleWashed={iid => toggleWashed(activeTrip.id, iid)}
                      forceOpen={sectionsForce} />
                  ))}
                  {!refillMode && !chargeMode && !washMode && (
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
                )}
              </div>
            );
          })}
        </div>
        </>)}
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

  // ═══ PACKING TEMPLATE EDITOR ═══
  if (editTemplate) {
    return <TemplateEditor template={catalogTemplate} setTemplate={setCatalogTemplate} onExit={() => setEditTemplate(false)} />;
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
                <button key={trip.id} onClick={() => { setActiveTripId(trip.id); setView("trip"); }}
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
            { label: "Packing Template", sub: catalogTemplate ? "Customized" : "Default items", icon: <Edit3 size={20} />, act: () => setEditTemplate(true), col: C.sage },
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
