// The slot-by-slot outfit editor (top → bottoms → layer → shoes → bag →
// necklaces → bracelets → eyewear → hair), extracted from the old in-trip
// builder in the Outfits batch and made props-only so the same screen edits a
// SAVED outfit (closet, trip shortlist) or one DAY's occasion.
//
//   name / onName        optional name field in the header (outfit name or occasion label)
//   slots / onSlots      the pieces; onSlots(updaterFn | slots)
//   photo / onPickPhoto / onRemovePhoto / photoBusy   optional photo controls (saved outfits)
//   footer               optional extra actions rendered above the navigation
//   onDone(reason)       back arrow / Done; onCancel when provided renders an "x"
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, X, Plus, ChevronLeft, ChevronRight, Camera, Loader, Trash2, Shirt, Palette, Shield, Footprints, ShoppingBag, Gem, Watch, Eye, Star } from "lucide-react";
import { C, F } from "../lib/theme";
import { Btn } from "./ui";
import { WardrobeCarousel } from "./WardrobeCarousel";
import { OUTFIT_SLOT_DEFS } from "../data/outfitSlots";
import { photoSrc } from "../lib/photos";

const ICONS = { top: Shirt, bottom: Palette, layer: Shield, shoes: Footprints, bag: ShoppingBag, necklace: Gem, bracelet: Watch, eyewear: Eye, hair: Star };
/** The slot table with its Lucide icon attached (what the old OUTFIT_SLOTS was). */
export const OUTFIT_SLOTS = OUTFIT_SLOT_DEFS.map((s) => { const I = ICONS[s.id]; return { ...s, icon: <I size={18} /> }; });

/** A hidden file input behind a button — the iPhone offers Take Photo / Photo Library. */
export function PhotoButton({ onFile, busy, children, style, ariaLabel = "Add photo" }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} aria-label={ariaLabel}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile?.(f); }} />
      <button type="button" onClick={() => !busy && ref.current?.click()} disabled={busy} aria-label={ariaLabel} style={style}>
        {busy ? <Loader size={14} className="spin" /> : children}
      </button>
    </>
  );
}

export function OutfitEditor({ title, subtitle, name, onName, namePlaceholder = "Name this outfit", slots, onSlots,
  wardrobe, setWardrobe, wardrobeMeta, setWardrobeMeta, photo, onPickPhoto, onRemovePhoto, photoBusy, photoError,
  footer, onDone, onCancel, doneLabel = "Done", startSlot = 0 }) {
  const [slotIdx, setSlotIdx] = useState(startSlot);
  const [addingNew, setAddingNew] = useState(false);
  const [newItemVal, setNewItemVal] = useState("");
  const newRef = useRef(null);
  useEffect(() => { if (addingNew && newRef.current) newRef.current.focus(); }, [addingNew]);
  useEffect(() => { window.scrollTo(0, 0); }, [slotIdx]);

  const totalSlots = OUTFIT_SLOTS.length;
  const currentSlot = OUTFIT_SLOTS[slotIdx];
  const cur = slots || {};
  const rawSlotVal = cur[currentSlot.id] || "";
  const selectedIsMulti = !!currentSlot.multi;
  const selectedValue = selectedIsMulti ? (Array.isArray(rawSlotVal) ? rawSlotVal : rawSlotVal ? [rawSlotVal] : []) : rawSlotVal;
  const pieceCount = Object.values(cur).reduce((c, v) => c + (Array.isArray(v) ? v.length : v ? 1 : 0), 0);

  const setSlotValue = (val, autoAdvance = false) => {
    const sid = currentSlot.id;
    onSlots((prev) => {
      const p = prev || {};
      if (selectedIsMulti && val) {
        const arr = Array.isArray(p[sid]) ? [...p[sid]] : p[sid] ? [p[sid]] : [];
        const i = arr.indexOf(val);
        if (i >= 0) arr.splice(i, 1); else arr.push(val);
        return { ...p, [sid]: arr.length ? arr : "" };
      }
      return { ...p, [sid]: val };
    });
    if (val && !(wardrobe?.[sid] || []).includes(val)) setWardrobe?.((prev) => ({ ...(prev || {}), [sid]: [...((prev || {})[sid] || []), val] }));
    if (val && autoAdvance && !selectedIsMulti && slotIdx < totalSlots - 1) setTimeout(() => setSlotIdx((s) => s + 1), 350);
  };
  const goNext = () => { if (slotIdx < totalSlots - 1) setSlotIdx((s) => s + 1); else onDone?.("done"); };
  const goPrev = () => { if (slotIdx > 0) setSlotIdx((s) => s - 1); };
  const src = photoSrc(photo);

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #FFF8F2 0%, ${C.cream} 100%)` }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${C.borderLight}`, background: "rgba(255,248,242,.95)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => (onCancel || onDone)?.("back")} aria-label="Back" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ArrowLeft size={20} color={C.warmGray} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper }}>{title}</div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{subtitle ? `${subtitle} · ` : ""}{pieceCount} piece{pieceCount === 1 ? "" : "s"}</div>
        </div>
        <Btn v="sage" sz="sm" onClick={() => onDone?.("done")}><Check size={14} /> {doneLabel}</Btn>
      </div>

      {/* Name + photo */}
      {(onName || onPickPhoto) && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 20px 0" }}>
          {onPickPhoto && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <PhotoButton onFile={onPickPhoto} busy={photoBusy} ariaLabel={src ? "Replace photo" : "Add photo"}
                style={{ width: 64, height: 64, borderRadius: 16, border: `1.5px ${src ? "solid" : "dashed"} ${C.borderMedium}`, background: C.warmWhite,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 0, color: C.copper }}>
                {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Camera size={20} />}
              </PhotoButton>
              {src && onRemovePhoto && (
                <button onClick={onRemovePhoto} aria-label="Remove photo" title="Remove photo"
                  style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: `1px solid ${C.borderLight}`,
                    background: C.warmWhite, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, color: C.softGray }}>
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          )}
          {onName && (
            <input value={name || ""} onChange={(e) => onName(e.target.value)} placeholder={namePlaceholder} aria-label="Outfit name"
              style={{ flex: 1, minWidth: 0, fontFamily: F.display, fontSize: 22, padding: "8px 0", border: "none", borderBottom: `1.5px solid ${C.borderMedium}`,
                background: "transparent", outline: "none", color: C.charcoal }}
              onFocus={(e) => (e.target.style.borderBottomColor = C.copper)} onBlur={(e) => (e.target.style.borderBottomColor = C.borderMedium)} />
          )}
        </div>
      )}
      {photoError && <div role="alert" style={{ fontFamily: F.body, fontSize: 12, color: C.danger, padding: "8px 20px 0" }}>{photoError}</div>}

      {/* Current slot */}
      <div style={{ padding: "16px 20px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16,
            background: `linear-gradient(135deg, ${currentSlot.color}15, ${currentSlot.color}08)`, border: `1.5px solid ${currentSlot.color}25`, marginBottom: 12 }}>
            <span style={{ fontSize: 28 }}>{currentSlot.emoji}</span>
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>{currentSlot.label}</h2>
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.softGray }}>
            {currentSlot.optional && <span style={{ fontStyle: "italic" }}>optional · </span>}{slotIdx + 1} of {totalSlots}
          </div>
        </div>

        {/* Slot progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {OUTFIT_SLOTS.map((s, i) => {
            const sv = cur[s.id];
            const filled = Array.isArray(sv) ? sv.length > 0 : !!sv;
            const active = i === slotIdx;
            return <button key={s.id} onClick={() => setSlotIdx(i)} aria-label={`Go to ${s.label}`}
              style={{ width: active ? 20 : 10, height: 10, borderRadius: 5, border: "none", cursor: "pointer", background: filled ? C.sage : active ? C.copper : C.creamDark, transition: "all .2s" }} />;
          })}
        </div>

        {/* Mini preview of what's picked so far */}
        {(() => {
          const picked = OUTFIT_SLOTS.filter((s) => { const v = cur[s.id]; return Array.isArray(v) ? v.length > 0 : !!v; })
            .map((s) => ({ ...s, val: Array.isArray(cur[s.id]) ? cur[s.id].join(", ") : cur[s.id] }));
          return picked.length > 0 && (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
              {picked.map((s) => (
                <div key={s.id} onClick={() => setSlotIdx(OUTFIT_SLOTS.findIndex((os) => os.id === s.id))} title={s.val}
                  style={{ padding: "4px 10px", borderRadius: 8, background: s.id === currentSlot.id ? C.copperGlow : C.sageGlow,
                    border: `1px solid ${s.id === currentSlot.id ? C.copper + "30" : "rgba(139,168,136,.15)"}`, fontFamily: F.body, fontSize: 11, color: C.charcoal,
                    maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>
                  {s.emoji} {s.val}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Selected value */}
        {selectedIsMulti ? (
          selectedValue.length > 0 && (
            <div style={{ background: C.sageGlow, borderRadius: 14, padding: "10px 14px", marginBottom: 16, border: `1px solid rgba(139,168,136,.2)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Check size={14} color={C.sage} /><span style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, color: C.sage }}>{selectedValue.length} selected</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selectedValue.map((v) => (
                  <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, background: C.warmWhite,
                    border: `1px solid ${C.borderLight}`, fontFamily: F.body, fontSize: 12, color: C.charcoal }}>
                    {v}
                    <button onClick={() => setSlotValue(v)} aria-label={`Remove ${v}`} style={{ background: "none", border: "none", cursor: "pointer", color: C.softGray, padding: 0, display: "flex" }}><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          )
        ) : (
          selectedValue && (
            <div style={{ background: C.sageGlow, borderRadius: 14, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, marginBottom: 16, border: `1px solid rgba(139,168,136,.2)` }}>
              <Check size={16} color={C.sage} />
              <span style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.charcoal, flex: 1 }}>{selectedValue}</span>
              <button onClick={() => setSlotValue("")} aria-label="Clear" style={{ background: "none", border: "none", cursor: "pointer", color: C.softGray, padding: 4, display: "flex" }}><X size={14} /></button>
            </div>
          )
        )}

        {/* Wardrobe */}
        <div style={{ marginBottom: 16 }}>
          {(wardrobe?.[currentSlot.id] || []).length > 0 && (
            <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: C.warmGray, marginBottom: 10, paddingLeft: 4 }}>Your wardrobe</div>
          )}
          <WardrobeCarousel slotId={currentSlot.id} wardrobe={wardrobe || {}} wardrobeMeta={wardrobeMeta}
            onSetMeta={(n, patch) => setWardrobeMeta?.((prev) => { const next = { ...(prev || {}) }; if (patch) next[n] = patch; else delete next[n]; return next; })}
            onSelect={(item) => setSlotValue(item, true)} selected={selectedValue}
            onRemoveItem={(item) => setWardrobe?.((prev) => ({ ...(prev || {}), [currentSlot.id]: ((prev || {})[currentSlot.id] || []).filter((i) => i !== item) }))} />
        </div>

        {/* Add new item */}
        {addingNew ? (
          <form onSubmit={(e) => { e.preventDefault(); if (newItemVal.trim()) { setSlotValue(newItemVal.trim(), true); setNewItemVal(""); setAddingNew(false); } }} style={{ display: "flex", gap: 10 }}>
            <input ref={newRef} value={newItemVal} onChange={(e) => setNewItemVal(e.target.value)} placeholder={currentSlot.placeholder}
              onBlur={() => { if (!newItemVal.trim()) setTimeout(() => setAddingNew(false), 150); }}
              style={{ flex: 1, fontFamily: F.body, fontSize: 14, padding: "12px 16px", border: `1.5px solid ${C.borderMedium}`, borderRadius: 12, background: C.warmWhite, outline: "none", color: C.charcoal }}
              onFocus={(e) => (e.target.style.borderColor = C.copper)} />
            <Btn v="primary" sz="sm" onClick={() => { if (newItemVal.trim()) { setSlotValue(newItemVal.trim(), true); setNewItemVal(""); setAddingNew(false); } }}>Add</Btn>
          </form>
        ) : (
          <button onClick={() => setAddingNew(true)}
            style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: `2px dashed ${C.borderMedium}`, background: C.copperSubtle, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: F.body, fontSize: 14, color: C.copper }}>
            <Plus size={16} /> Add {selectedIsMulti ? "another" : "new"} {currentSlot.label.toLowerCase()}
          </button>
        )}
        {selectedIsMulti && selectedValue.length > 0 && (
          <button onClick={goNext} style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, border: `1.5px solid ${C.sage}`, background: C.sageGlow, cursor: "pointer",
            fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.sage, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Check size={14} /> Done with {currentSlot.label.toLowerCase()} ({selectedValue.length})
          </button>
        )}
        {currentSlot.optional && (selectedIsMulti ? selectedValue.length === 0 : !selectedValue) && (
          <button onClick={goNext} style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", fontFamily: F.body, fontSize: 13, color: C.softGray }}>
            Skip this — it's optional
          </button>
        )}
      </div>

      {footer && <div style={{ padding: "0 20px 12px" }}>{footer}</div>}

      {/* Navigation */}
      <div style={{ padding: "12px 20px 32px", display: "flex", gap: 12, borderTop: `1px solid ${C.borderLight}`, background: "rgba(253,248,240,.95)" }}>
        {slotIdx > 0 && <Btn v="secondary" sz="md" onClick={goPrev} aria-label="Previous slot" style={{ flex: 0 }}><ChevronLeft size={16} /></Btn>}
        {slotIdx < totalSlots - 1 ? (
          <Btn v="primary" sz="md" onClick={goNext} style={{ flex: 1 }}>Next <ChevronRight size={16} /></Btn>
        ) : (
          <Btn v="sage" sz="lg" onClick={() => onDone?.("done")} style={{ flex: 1 }}><Check size={18} /> {doneLabel === "Done" ? "Done with this outfit" : doneLabel}</Btn>
        )}
      </div>
    </div>
  );
}
