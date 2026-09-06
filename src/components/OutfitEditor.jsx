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
//   onRenamePiece({ slotId, oldName, newName, entry }) → { finalName }   (Piece Edit batch) the parent
//                        renames the piece in every store AND in its own drafts (incl. these `slots`)
//   pieceUsageFor(slotId, name) → { outfits, days, items }   for the edit sheet's note
//   pieceIndexFor(slotId) → pieceIndex() rows   (Picker batch) what the wardrobe picker lists
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, X, Plus, ChevronLeft, ChevronRight, Camera, Loader, Trash2, Shirt, Palette, Shield, Footprints, ShoppingBag, Gem, Watch, Eye, Star } from "lucide-react";
import { C, F } from "../lib/theme";
import { Btn } from "./ui";
import { WardrobePicker } from "./WardrobePicker";
import { OUTFIT_SLOT_DEFS } from "../data/outfitSlots";
import { photoSrc } from "../lib/photos";
import { composeItemName, structuredMeta, parseItemMeta, swatchBackground, wardrobeBrands, wardrobeTypes, splitItemName, COLOR_FAMILY_IDS } from "../lib/wardrobe";
import { renameWardrobe, renameMeta, pieceIndex } from "../lib/pieces";

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

const fieldStyle = { width: "100%", fontFamily: F.body, fontSize: 14, padding: "11px 14px", border: `1.5px solid ${C.borderMedium}`, borderRadius: 12,
  background: C.warmWhite, outline: "none", color: C.charcoal, boxSizing: "border-box" };
const fieldLabel = { fontFamily: F.body, fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".07em", color: C.softGray, marginBottom: 5, paddingLeft: 2 };

/**
 * "Add new <slot>" — the colour, the brand and the type of clothing in separate
 * fields (Fields batch). The three compose into one item name ("Black Lululemon
 * flowy pants"), previewed live with its colour swatch; Enter hops colour →
 * brand → type, Enter on the type adds. A type or a brand is required (a
 * brand-only piece like "Black Longchamp" is fine).
 */
function NewPieceForm({ slot, brands, types, onAdd, onCancel, initial }) {
  const [color, setColor] = useState(initial?.color || "");
  const [brand, setBrand] = useState(initial?.brand || "");
  const [type, setType] = useState(initial?.type || "");
  const colorRef = useRef(null), brandRef = useRef(null), typeRef = useRef(null);
  useEffect(() => { (initial?.type ? typeRef : colorRef).current?.focus(); }, [initial]);
  const name = composeItemName({ color, brand, type });
  const preview = name ? parseItemMeta(name, structuredMeta({ color, brand, type }) || undefined) : null;
  const swatch = preview ? swatchBackground(preview) : null;
  const canAdd = !!(type.trim() || brand.trim());
  const submit = (e) => { e?.preventDefault(); if (canAdd) onAdd({ color, brand, type }); };
  const hop = (ref) => (e) => { if (e.key === "Enter") { e.preventDefault(); ref.current?.focus(); } };
  const slotWord = slot.label.toLowerCase().replace(/\s*\(.*\)|\s*\/.*$/g, "");   // "Necklace(s)" → "necklace", "Bag / Purse" → "bag"
  return (
    <form onSubmit={submit} aria-label={`New ${slotWord}`}
      style={{ background: C.warmWhite, border: `1.5px solid ${C.copper}40`, borderRadius: 16, padding: 14, boxShadow: `0 2px 12px ${C.shadow}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <label style={{ minWidth: 0 }}>
          <div style={fieldLabel}>Colour</div>
          <input ref={colorRef} value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Black" aria-label="Piece colour"
            list="pp-piece-colours" autoComplete="off" autoCapitalize="sentences" enterKeyHint="next" onKeyDown={hop(brandRef)} style={fieldStyle}
            onFocus={(e) => (e.target.style.borderColor = C.copper)} onBlur={(e) => (e.target.style.borderColor = C.borderMedium)} />
        </label>
        <label style={{ minWidth: 0 }}>
          <div style={fieldLabel}>Brand <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· optional</span></div>
          <input ref={brandRef} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Lululemon" aria-label="Piece brand"
            list="pp-piece-brands" autoComplete="off" autoCapitalize="words" enterKeyHint="next" onKeyDown={hop(typeRef)} style={fieldStyle}
            onFocus={(e) => (e.target.style.borderColor = C.copper)} onBlur={(e) => (e.target.style.borderColor = C.borderMedium)} />
        </label>
      </div>
      <label style={{ display: "block", marginBottom: 12 }}>
        <div style={fieldLabel}>Type of clothing</div>
        <input ref={typeRef} value={type} onChange={(e) => setType(e.target.value)} placeholder={slot.typePlaceholder || "e.g. flowy pants"} aria-label="Piece type"
          list="pp-piece-types" autoComplete="off" autoCapitalize="none" enterKeyHint="done" style={fieldStyle}
          onFocus={(e) => (e.target.style.borderColor = C.copper)} onBlur={(e) => (e.target.style.borderColor = C.borderMedium)} />
      </label>
      <datalist id="pp-piece-colours">{COLOR_FAMILY_IDS.map((id) => <option key={id} value={id.replace(/\b\p{L}/gu, (ch) => ch.toUpperCase())} />)}</datalist>
      <datalist id="pp-piece-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
      <datalist id="pp-piece-types">{types.map((t) => <option key={t} value={t} />)}</datalist>

      {/* Live preview of the piece as it will be named */}
      <div aria-label="New piece preview" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 22, marginBottom: 12, paddingLeft: 2 }}>
        {swatch ? (
          <span style={{ width: 12, height: 12, borderRadius: 6, background: swatch, flexShrink: 0,
            border: `1px solid ${preview.color === "white" || preview.color === "cream" ? C.borderMedium : "rgba(45,41,38,.12)"}` }} />
        ) : (
          <span style={{ width: 12, height: 12, borderRadius: 6, flexShrink: 0, border: `1px dashed ${C.borderMedium}` }} />
        )}
        {preview?.brand && <span style={{ fontFamily: F.body, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: C.softGray }}>{preview.brand}</span>}
        <span style={{ fontFamily: F.body, fontSize: 13.5, fontWeight: name ? 500 : 400, color: name ? C.charcoal : C.softGray, fontStyle: name ? "normal" : "italic",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name || `What the ${slotWord} will be called`}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn v="secondary" sz="sm" type="button" onClick={onCancel} style={{ flex: 1 }}>Cancel</Btn>
        <Btn v="primary" sz="sm" type="submit" disabled={!canAdd} aria-disabled={!canAdd} style={{ flex: 2 }}><Plus size={14} /> Add {slotWord}</Btn>
      </div>
    </form>
  );
}

export function OutfitEditor({ title, subtitle, name, onName, namePlaceholder = "Name this outfit", slots, onSlots,
  wardrobe, setWardrobe, wardrobeMeta, setWardrobeMeta, photo, onPickPhoto, onRemovePhoto, photoBusy, photoError,
  footer, onDone, onCancel, doneLabel = "Done", startSlot = 0, onRenamePiece, pieceUsageFor, pieceIndexFor }) {
  const [slotIdx, setSlotIdx] = useState(startSlot);
  const [addingNew, setAddingNew] = useState(null); // null | { color, brand, type } prefill for the "Add new" form
  useEffect(() => { window.scrollTo(0, 0); }, [slotIdx]);
  useEffect(() => { setAddingNew(null); }, [slotIdx]);

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

  // "Add new …": compose the name from the fields, reuse an identical piece the
  // wardrobe already holds (case-insensitive), remember what was typed.
  const brandSuggestions = useMemo(() => wardrobeBrands(wardrobe, wardrobeMeta), [wardrobe, wardrobeMeta]);
  const typeSuggestions = useMemo(() => wardrobeTypes(wardrobe, wardrobeMeta, currentSlot.id), [wardrobe, wardrobeMeta, currentSlot.id]);
  const addPiece = (fields) => {
    const composed = composeItemName(fields);
    if (!composed) return;
    const sid = currentSlot.id;
    const existing = (wardrobe?.[sid] || []).find((i) => i.toLowerCase() === composed.toLowerCase());
    const finalName = existing || composed;
    const meta = structuredMeta(fields);
    if (meta && !existing) setWardrobeMeta?.((prev) => ({ ...(prev || {}), [finalName]: { ...((prev || {})[finalName] || {}), ...meta } }));   // an existing piece keeps its own details
    const alreadyOn = selectedIsMulti ? selectedValue.includes(finalName) : selectedValue === finalName;
    if (!alreadyOn) setSlotValue(finalName, true);
    setAddingNew(null);
  };
  // The picker's rows (Picker batch): the app shell's index (with where / when each piece was worn) or a bare one.
  const pickerIndex = useMemo(() => (pieceIndexFor ? pieceIndexFor(currentSlot.id) : pieceIndex({ slotId: currentSlot.id, wardrobe, wardrobeMeta })), [pieceIndexFor, currentSlot.id, wardrobe, wardrobeMeta]);
  // "+" or "Add “query” as a new …": open the form, prefilled by carving the query into colour / brand / type.
  const openAddForm = (query) => setAddingNew(query ? splitItemName(query) : { color: "", brand: "", type: "" });
  // "Edit piece" sheet: same name → store the details; new name → the parent renames it everywhere
  // (falls back to this wardrobe + these slots when no parent handler is wired).
  const editPiece = ({ name: oldName, newName, entry }) => {
    const sid = currentSlot.id;
    if (newName === oldName) { setWardrobeMeta?.((prev) => renameMeta(prev, oldName, oldName, entry)); return; }
    if (onRenamePiece) { onRenamePiece({ slotId: sid, oldName, newName, entry }); return; }
    const w = renameWardrobe(wardrobe, sid, oldName, newName);
    setWardrobe?.(() => w.wardrobe);
    setWardrobeMeta?.((prev) => renameMeta(prev, oldName, w.finalName, entry));
    onSlots((prev) => { const p = prev || {}; const v = p[sid]; if (Array.isArray(v)) return { ...p, [sid]: v.map((x) => (x === oldName ? w.finalName : x)) }; return v === oldName ? { ...p, [sid]: w.finalName } : p; });
  };

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

        {/* Add new item — colour / brand / type in separate fields (shown above the list so it never hides below a long wardrobe) */}
        {addingNew && (
          <div style={{ marginBottom: 14 }}>
            <NewPieceForm key={currentSlot.id} slot={currentSlot} brands={brandSuggestions} types={typeSuggestions} initial={addingNew} onAdd={addPiece} onCancel={() => setAddingNew(null)} />
          </div>
        )}

        {/* Wardrobe picker: search, chips, Recently worn, colour groups; ⋯ edits (Picker batch) */}
        <div style={{ marginBottom: 16 }}>
          <WardrobePicker slotId={currentSlot.id} index={pickerIndex} wardrobeMeta={wardrobeMeta} selected={selectedValue} adding={!!addingNew}
            onSelect={(item) => setSlotValue(item, true)}
            onEditPiece={editPiece} usageFor={(n) => pieceUsageFor?.(currentSlot.id, n)}
            onRemoveItem={(item) => setWardrobe?.((prev) => ({ ...(prev || {}), [currentSlot.id]: ((prev || {})[currentSlot.id] || []).filter((i) => i !== item) }))}
            onAddNew={openAddForm} />
        </div>
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

      {/* Navigation — sticky, so Next / Done stay reachable under a long wardrobe list (Picker batch) */}
      <div style={{ position: "sticky", bottom: 0, zIndex: 5, padding: "12px 20px 28px", display: "flex", gap: 12, borderTop: `1px solid ${C.borderLight}`, background: "rgba(253,248,240,.95)", backdropFilter: "blur(8px)" }}>
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
