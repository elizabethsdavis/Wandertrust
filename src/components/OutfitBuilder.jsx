// Build My Outfits — the in-trip outfit planner (Outfits batch rewrite).
//
// Two tabs:
//   Outfits — the outfits you're bringing on THIS trip (trip.outfitIds, the
//             "shortlist"): build new ones, pull in saved ones from the closet,
//             add a photo, rename, edit pieces, remove from the trip. Every
//             outfit built here is also saved to the closet (savedOutfits), so
//             it's there for the next trip.
//   Days    — the wearing plan: each day's occasions (Daytime / Evening / …),
//             each wearing one outfit picked from the shortlist (or the closet,
//             or built on the spot). A day can tweak its copy of an outfit —
//             that makes a day-only variant (occasion.customized) and the
//             saved outfit is untouched unless you choose "Update saved".
//
// Persisted through onSave(occasions, dayNames, syncToList, dayEmojis, outfitIds):
// the caller writes trip.outfitPlan / outfitDayNames / dayEmojis (unchanged
// shapes; occasions gain the additive outfitId / customized) and
// trip.outfitIds. Saved outfits are edited through setSavedOutfits.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, X, Plus, Copy, Trash2, Sparkles, Search, Shirt, Pencil, Camera, FolderOpen, CalendarDays, Loader, Trash } from "lucide-react";
import { C, F } from "../lib/theme";
import { id as newId, haptic, lastGrapheme } from "../lib/utils";
import { Btn } from "./ui";
import { OutfitEditor, OUTFIT_SLOTS, PhotoButton } from "./OutfitEditor";
import { OutfitCard, OutfitPicker, OutfitVisual, PieceList, Sheet } from "./OutfitCard";
import { newOutfit, updateOutfit, assignOutfit, detachOutfit, propagateOutfit, slotsKey, slotCount, defaultOutfitName, cleanSlots } from "../lib/outfits";
import { savePhoto, deletePhoto } from "../lib/photos";

export const DAY_EMOJIS = ["✈️", "☀️", "🌤️", "⭐", "🌸", "🎯", "💫", "🌊", "🏔️", "🎉", "🌺", "⚡", "🦋", "🌙", "🍂"];
export const OCCASION_TYPES = [
  { id: "daytime", label: "Daytime", icon: "☀️" },
  { id: "evening", label: "Evening", icon: "🌙" },
  { id: "activity", label: "Activity", icon: "🏃‍♀️" },
  { id: "special", label: "Special Event", icon: "✨" },
];
const OCCASION_EMOJIS = [
  "☀️","🌙","🏃‍♀️","✨","🍽️","🥂","💼","🎭","🛍️","🏖️","🎶","💃","🧘","⛷️","🎪","🏊","🚶‍♀️","🍳",
  "☕","🎉","🎂","💐","📸","🏛️","⛪","🎓","👰","🧖‍♀️","🏋️","🚴","🧗","🎿","⛵","🎨","🎬",
  "🍕","🍷","🎤","🪩","🌅","🌃","❄️","🔥","🦋","🌺","🌈","💎","🪷","🫧",
];

const defaultDayName = (i, n) => (i === 0 ? "Travel Day" : i === n - 1 ? "Travel Home" : `Day ${i + 1}`);

/** "What kind of outfit?" — occasion types incl. custom ones (ported from the old builder). */
function OccasionTypePicker({ types, onPick, onCreate, onCancel }) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (creating && ref.current) ref.current.focus(); }, [creating]);
  const create = () => { if (!name.trim()) return; onCreate(name.trim(), emoji || "🏷️"); };
  return (
    <div style={{ padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${C.borderLight}`, background: C.warmWhite }}>
      {!creating ? (<>
        <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: C.charcoal, marginBottom: 10 }}>What kind of occasion?</div>
        {types.length >= 6 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: C.cream, borderRadius: 10, border: `1px solid ${C.borderLight}`, marginBottom: 10 }}>
            <Search size={13} color={C.softGray} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search types..." style={{ flex: 1, border: "none", background: "none", outline: "none", fontFamily: F.body, fontSize: 12, color: C.charcoal }} />
            {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={12} color={C.softGray} /></button>}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxHeight: 200, overflowY: "auto", paddingRight: 4 }}>
          {types.filter((t) => !q || t.label.toLowerCase().includes(q.toLowerCase())).map((t) => (
            <button key={t.id} onClick={() => onPick(t)} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.borderLight}`, background: C.cream, cursor: "pointer",
              fontFamily: F.body, fontSize: 12, color: C.charcoal, display: "flex", alignItems: "center", gap: 6 }}>{t.icon} {t.label}</button>
          ))}
          <button onClick={() => setCreating(true)} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px dashed ${C.borderMedium}`, background: "transparent", cursor: "pointer",
            fontFamily: F.body, fontSize: 12, color: C.copper, display: "flex", alignItems: "center", gap: 6 }}><Plus size={13} /> New type</button>
        </div>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 10, padding: "4px 0" }}>Cancel</button>
      </>) : (<>
        <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: C.charcoal, marginBottom: 10 }}>Create a new occasion type</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={() => setEmojiOpen(!emojiOpen)} aria-label="Pick an emoji" style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
            border: `1.5px solid ${emoji ? C.copper : C.borderMedium}`, background: emoji ? C.copperGlow : C.cream, cursor: "pointer", fontSize: emoji ? 22 : 14, color: C.softGray, flexShrink: 0 }}>{emoji || "🏷️"}</button>
          <input ref={ref} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brunch, Pool Party, Hiking..." aria-label="New occasion type"
            onKeyDown={(e) => { if (e.key === "Enter") create(); }}
            style={{ flex: 1, fontFamily: F.body, fontSize: 13, padding: "10px 14px", border: `1.5px solid ${C.borderMedium}`, borderRadius: 10, background: C.cream, outline: "none", color: C.charcoal }} />
        </div>
        {emojiOpen && (
          <div style={{ marginBottom: 10 }}>
            <input value={emoji} onChange={(e) => setEmoji(lastGrapheme(e.target.value))} placeholder="Type any emoji..." aria-label="Emoji"
              style={{ fontFamily: F.body, fontSize: 18, padding: "6px 10px", textAlign: "center", border: `1.5px solid ${C.borderMedium}`, borderRadius: 8, background: C.warmWhite, outline: "none", color: C.charcoal, width: 90, marginBottom: 8 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4, maxHeight: 160, overflowY: "auto", padding: 8, background: C.cream, borderRadius: 12, border: `1px solid ${C.borderLight}` }}>
              {OCCASION_EMOJIS.map((em) => (
                <button key={em} onClick={() => { setEmoji(em); setEmojiOpen(false); }} style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1px solid ${emoji === em ? C.copper : "transparent"}`, background: emoji === em ? C.copperGlow : "transparent", cursor: "pointer", fontSize: 18 }}>{em}</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setCreating(false); setName(""); setEmoji(""); setEmojiOpen(false); }} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.borderLight}`, background: C.cream, cursor: "pointer", fontFamily: F.body, fontSize: 12, color: C.warmGray }}>Back</button>
          <Btn v="primary" sz="sm" onClick={create} style={{ flex: 1, opacity: name.trim() ? 1 : 0.5 }}><Plus size={14} /> Create & use</Btn>
        </div>
      </>)}
    </div>
  );
}

export function OutfitBuilder({ trip, savedOutfits, setSavedOutfits, wardrobe, setWardrobe, wardrobeMeta, setWardrobeMeta, customOccasions, setCustomOccasions, uid, onSave, onExit, celebrate }) {
  const allOccasionTypes = useMemo(() => [...OCCASION_TYPES, ...(customOccasions || [])], [customOccasions]);
  const saved = savedOutfits || [];
  const byId = useMemo(() => new Map(saved.map((o) => [o.id, o])), [saved]);

  // ── trip plan state (resumed from the trip) ──
  const [occasions, setOccasions] = useState(() => {
    if (trip.outfitPlan && trip.outfitPlan.length === trip.days) return trip.outfitPlan;
    return Array.from({ length: trip.days }, (_, i) => [{ id: newId(), type: "daytime", label: defaultDayName(i, trip.days), slots: {} }]);
  });
  const [dayNames, setDayNames] = useState(() => (trip.outfitDayNames && trip.outfitDayNames.length === trip.days ? trip.outfitDayNames : Array.from({ length: trip.days }, (_, i) => defaultDayName(i, trip.days))));
  const [dayEmojiMap, setDayEmojiMap] = useState(() => trip.dayEmojis || {});
  const [outfitIds, setOutfitIds] = useState(() => {
    const ids = new Set(Array.isArray(trip.outfitIds) ? trip.outfitIds : []);
    (trip.outfitPlan || []).forEach((day) => (day || []).forEach((o) => { if (o?.outfitId) ids.add(o.outfitId); }));
    return [...ids].filter((x) => saved.some((o) => o.id === x));
  });
  const shortlist = outfitIds.map((x) => byId.get(x)).filter(Boolean);

  const [tab, setTab] = useState(() => (shortlist.length > 0 ? "days" : "outfits"));
  const [editing, setEditing] = useState(null); // { kind: "outfit", id, draft, returnTo? } | { kind: "occasion", dayIdx, occIdx }
  const [picker, setPicker] = useState(null); // { dayIdx, occIdx } | "closet"
  const [sheet, setSheet] = useState(null); // outfit id (card detail)
  const [wearSheet, setWearSheet] = useState(null); // outfit id (choose a day/occasion)
  const [addingOccForDay, setAddingOccForDay] = useState(null);
  const [renamingDay, setRenamingDay] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [editingDayEmoji, setEditingDayEmoji] = useState(null);
  const [dayEmojiVal, setDayEmojiVal] = useState("");
  const [editingOccEmoji, setEditingOccEmoji] = useState(null);
  const [occEmojiVal, setOccEmojiVal] = useState("");
  const [flash, setFlash] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const renameRef = useRef(null);
  useEffect(() => { if (renamingDay !== null && renameRef.current) { renameRef.current.focus(); renameRef.current.select(); } }, [renamingDay]);
  useEffect(() => { window.scrollTo(0, 0); }, [tab, editing]);

  const say = (msg) => { setFlash(msg); setTimeout(() => setFlash(""), 1600); };
  const totalDays = trip.days;
  const dayLabel = (di) => dayNames[di] || defaultDayName(di, totalDays);
  const dayEmoji = (di) => dayEmojiMap[di] || DAY_EMOJIS[di % DAY_EMOJIS.length];

  // Auto-save the plan whenever it changes (items sync only on Done).
  useEffect(() => { onSave(occasions, dayNames, false, dayEmojiMap, outfitIds); }, [occasions, dayNames, dayEmojiMap, outfitIds]);

  const plannedCount = occasions.reduce((s, d) => s + d.filter((o) => slotCount(o.slots) > 0).length, 0);
  const totalOccasions = occasions.reduce((s, d) => s + d.length, 0);
  const wornOn = (oid) => {
    const out = [];
    occasions.forEach((day, di) => day.forEach((o) => { if (o.outfitId === oid) out.push(`${dayLabel(di)} ${o.label}`); }));
    return out;
  };

  // ── saved-outfit helpers ──
  const upsertSaved = (rec) => setSavedOutfits((prev) => { const list = prev || []; return list.some((o) => o.id === rec.id) ? list.map((o) => (o.id === rec.id ? rec : o)) : [...list, rec]; });
  const ensureShortlisted = (oid) => setOutfitIds((prev) => (prev.includes(oid) ? prev : [...prev, oid]));
  const patchOccasion = (di, oi, fn) => setOccasions((prev) => prev.map((day, d) => (d !== di ? day : day.map((o, i) => (i !== oi ? o : fn(o))))));

  const startNewOutfit = (returnTo) => {
    setPicker(null); setSheet(null);
    setEditing({ kind: "outfit", id: null, draft: { id: newId(), name: defaultOutfitName(shortlist), slots: {}, photo: null }, returnTo });
  };
  const startEditOutfit = (o) => { setSheet(null); setEditing({ kind: "outfit", id: o.id, draft: { id: o.id, name: o.name, slots: JSON.parse(JSON.stringify(o.slots || {})), photo: o.photo || null } }); };

  const finishOutfitEdit = () => {
    const { id: existingId, draft, returnTo } = editing;
    const empty = slotCount(draft.slots) === 0 && !draft.photo && (!draft.name || /^Outfit \d+$/.test(draft.name.trim()));
    if (!existingId && empty) { setEditing(null); return; } // nothing to keep
    let rec;
    if (existingId && byId.get(existingId)) {
      rec = updateOutfit(byId.get(existingId), { name: draft.name, slots: draft.slots, photo: draft.photo });
      // keep the days on this trip that still wear it (and weren't tweaked) in step
      setOccasions((prev) => propagateOutfit(prev, rec));
    } else {
      rec = { ...newOutfit({ name: draft.name, slots: draft.slots, photo: draft.photo }), id: draft.id };
    }
    upsertSaved(rec);
    ensureShortlisted(rec.id);
    if (returnTo) patchOccasion(returnTo.dayIdx, returnTo.occIdx, (o) => assignOutfit(o, rec));
    if (slotCount(rec.slots) >= 3 && !existingId) celebrate?.("outfitDone", "medium");
    haptic("success");
    say(existingId ? "Outfit updated" : "Saved to your closet");
    setEditing(null);
  };

  const pickPhoto = async (outfitId, file, applyTo) => {
    setPhotoBusy(true); setPhotoError("");
    try {
      const photo = await savePhoto({ uid, outfitId, file });
      applyTo(photo);
      haptic("success");
    } catch (e) {
      setPhotoError(e?.message || "Couldn't add that photo.");
    } finally {
      setPhotoBusy(false);
    }
  };
  const setSavedPhoto = (oid, photo) => setSavedOutfits((prev) => (prev || []).map((o) => (o.id === oid ? updateOutfit(o, { photo }) : o)));

  const removeFromTrip = (o) => {
    const worn = wornOn(o.id);
    if (worn.length && !confirm(`${o.name} is planned for ${worn.join(", ")}. Remove it from this trip? Those days will be cleared (the outfit stays in your closet).`)) return;
    setOutfitIds((prev) => prev.filter((x) => x !== o.id));
    setOccasions((prev) => prev.map((day) => day.map((occ) => (occ.outfitId === o.id ? { ...detachOutfit(occ), slots: {} } : occ))));
    setSheet(null);
    say(`Removed from ${trip.destination}`);
  };

  const assignTo = (di, oi, o) => {
    patchOccasion(di, oi, (occ) => assignOutfit(occ, o));
    ensureShortlisted(o.id);
    setPicker(null); setWearSheet(null);
    haptic("light");
    say(`${o.name} → ${dayLabel(di)}`);
  };

  // ── occasion (day) editing ──
  const occAt = (e) => occasions[e.dayIdx]?.[e.occIdx];
  const setOccSlots = (e, updater) => patchOccasion(e.dayIdx, e.occIdx, (occ) => {
    const next = typeof updater === "function" ? updater(occ.slots || {}) : updater;
    const saved = occ.outfitId ? byId.get(occ.outfitId) : null;
    return { ...occ, slots: next, ...(saved ? { customized: slotsKey(next) !== slotsKey(saved.slots) } : {}) };
  });
  const saveOccAsNew = (e) => {
    const occ = occAt(e);
    const rec = newOutfit({ name: `${dayLabel(e.dayIdx)} ${occ.label}`, slots: occ.slots });
    upsertSaved(rec); ensureShortlisted(rec.id);
    patchOccasion(e.dayIdx, e.occIdx, (o) => ({ ...o, outfitId: rec.id, customized: false }));
    say("Saved as a new outfit");
  };
  const updateSavedFromOcc = (e) => {
    const occ = occAt(e);
    const base = byId.get(occ.outfitId);
    if (!base) return;
    const rec = updateOutfit(base, { slots: occ.slots });
    upsertSaved(rec);
    setOccasions((prev) => propagateOutfit(prev.map((day, d) => (d !== e.dayIdx ? day : day.map((o, i) => (i !== e.occIdx ? o : { ...o, customized: false })))), rec));
    say(`${rec.name} updated`);
  };
  const revertOcc = (e) => {
    const occ = occAt(e);
    const base = byId.get(occ.outfitId);
    if (!base) return;
    patchOccasion(e.dayIdx, e.occIdx, (o) => assignOutfit(o, base));
    say("Back to the saved outfit");
  };

  const addOccasion = (di, type) => {
    const occ = { id: newId(), type: type.id, label: type.label, icon: type.icon, slots: {} };
    setOccasions((prev) => prev.map((day, d) => (d === di ? [...day, occ] : day)));
    setAddingOccForDay(null);
    setPicker({ dayIdx: di, occIdx: occasions[di].length });
  };
  const createType = (di, label, icon) => {
    const typeId = label.toLowerCase().replace(/\s+/g, "-");
    const t = { id: typeId, label, icon };
    if (!allOccasionTypes.find((x) => x.id === typeId)) setCustomOccasions((prev) => [...(prev || []), t]);
    addOccasion(di, t);
  };
  const removeOccasion = (di, oi) => { if (occasions[di].length <= 1) return; setOccasions((prev) => prev.map((day, d) => (d === di ? day.filter((_, i) => i !== oi) : day))); };
  const copyOccasion = (di, oi) => {
    const occ = occasions[di][oi];
    const target = occasions.findIndex((d, idx) => idx > di && d.length < 4);
    if (target < 0) { say("No room to copy"); return; }
    setOccasions((prev) => prev.map((day, d) => (d === target ? [...day, { ...occ, id: newId() }] : day)));
    say(`Copied to ${dayLabel(target)}`);
  };

  const finish = () => { onSave(occasions, dayNames, true, dayEmojiMap, outfitIds); onExit(); };

  // ═══ EDITORS ═══
  if (editing?.kind === "outfit") {
    const d = editing.draft;
    return (
      <OutfitEditor title={editing.id ? "Edit outfit" : "New outfit"} subtitle={trip.destination}
        name={d.name} onName={(v) => setEditing((e) => ({ ...e, draft: { ...e.draft, name: v } }))}
        slots={d.slots} onSlots={(u) => setEditing((e) => ({ ...e, draft: { ...e.draft, slots: typeof u === "function" ? u(e.draft.slots) : u } }))}
        wardrobe={wardrobe} setWardrobe={setWardrobe} wardrobeMeta={wardrobeMeta} setWardrobeMeta={setWardrobeMeta}
        photo={d.photo} photoBusy={photoBusy} photoError={photoError}
        onPickPhoto={(file) => pickPhoto(d.id, file, (photo) => setEditing((e) => ({ ...e, draft: { ...e.draft, photo } })))}
        onRemovePhoto={() => { deletePhoto(d.photo); setEditing((e) => ({ ...e, draft: { ...e.draft, photo: null } })); }}
        onDone={finishOutfitEdit} doneLabel={editing.id ? "Save" : "Save outfit"} />
    );
  }
  if (editing?.kind === "occasion") {
    const occ = occAt(editing);
    if (!occ) { setEditing(null); return null; }
    const base = occ.outfitId ? byId.get(occ.outfitId) : null;
    const footer = (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {base && occ.customized && (<>
          <Btn v="secondary" sz="sm" onClick={() => updateSavedFromOcc(editing)}><Check size={14} /> Update “{base.name}”</Btn>
          <Btn v="secondary" sz="sm" onClick={() => saveOccAsNew(editing)}><Plus size={14} /> Save as new outfit</Btn>
          <Btn v="ghost" sz="sm" onClick={() => revertOcc(editing)}>Revert to saved</Btn>
        </>)}
        {!base && slotCount(occ.slots) > 0 && <Btn v="secondary" sz="sm" onClick={() => saveOccAsNew(editing)}><FolderOpen size={14} /> Save as an outfit</Btn>}
      </div>
    );
    return (
      <OutfitEditor title={`${dayEmoji(editing.dayIdx)} ${dayLabel(editing.dayIdx)}`} subtitle={base ? `${base.name}${occ.customized ? " · customized for this day" : ""}` : "custom for this day"}
        name={occ.label} onName={(v) => patchOccasion(editing.dayIdx, editing.occIdx, (o) => ({ ...o, label: v }))} namePlaceholder="Occasion"
        slots={occ.slots || {}} onSlots={(u) => setOccSlots(editing, u)}
        wardrobe={wardrobe} setWardrobe={setWardrobe} wardrobeMeta={wardrobeMeta} setWardrobeMeta={setWardrobeMeta}
        footer={footer} onDone={() => { setEditing(null); haptic("success"); }} />
    );
  }

  const active = sheet ? byId.get(sheet) : null;
  const wearing = wearSheet ? byId.get(wearSheet) : null;

  // ═══ MAIN ═══
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #FFF8F2 0%, ${C.cream} 100%)`, paddingBottom: 110 }}>
      {/* Pickers / sheets */}
      {picker && (
        <OutfitPicker title={picker === "closet" ? "Add from your closet" : `${dayLabel(picker.dayIdx)} · ${occasions[picker.dayIdx]?.[picker.occIdx]?.label || "outfit"}`}
          outfits={saved} tripIds={picker === "closet" ? [] : outfitIds} excludeIds={picker === "closet" ? outfitIds : []}
          tripLabel="On this trip" currentId={picker === "closet" ? null : occasions[picker.dayIdx]?.[picker.occIdx]?.outfitId}
          onPick={(o) => { if (picker === "closet") { ensureShortlisted(o.id); setPicker(null); say(`${o.name} added to ${trip.destination}`); } else assignTo(picker.dayIdx, picker.occIdx, o); }}
          onNew={() => startNewOutfit(picker === "closet" ? undefined : picker)} onClose={() => setPicker(null)} />
      )}
      {active && (
        <Sheet title={active.name} onClose={() => setSheet(null)} ariaLabel={`Outfit ${active.name}`}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <OutfitVisual outfit={active} size={132} radius={18} full />
            <div style={{ flex: 1, minWidth: 0 }}>
              <PieceList slots={active.slots} />
              {wornOn(active.id).length > 0 && (
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.sage, marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}><CalendarDays size={12} /> {wornOn(active.id).join(", ")}</div>
              )}
            </div>
          </div>
          {photoError && <div role="alert" style={{ fontFamily: F.body, fontSize: 12, color: C.danger, marginTop: 8 }}>{photoError}</div>}
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            <Btn v="primary" sz="md" onClick={() => { setSheet(null); setWearSheet(active.id); }} style={{ width: "100%" }}><CalendarDays size={16} /> Wear it on a day…</Btn>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="secondary" sz="md" onClick={() => startEditOutfit(active)} style={{ flex: 1 }}><Pencil size={15} /> Edit pieces</Btn>
              <PhotoButton busy={photoBusy} ariaLabel={active.photo ? "Replace photo" : "Add photo"}
                onFile={(file) => pickPhoto(active.id, file, (photo) => setSavedPhoto(active.id, photo))}
                style={{ flex: 1, fontFamily: F.body, fontWeight: 500, fontSize: 14, borderRadius: 14, padding: "12px 16px", cursor: "pointer", background: C.warmWhite, color: C.copper,
                  border: `1.5px solid ${C.borderMedium}`, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Camera size={15} /> {active.photo ? "Replace photo" : "Add photo"}
              </PhotoButton>
            </div>
            <button onClick={() => removeFromTrip(active)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.body, fontSize: 13, color: C.danger, padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Trash size={14} /> Remove from this trip (stays in your closet)
            </button>
          </div>
        </Sheet>
      )}
      {wearing && (
        <Sheet title={`Wear “${wearing.name}” on…`} onClose={() => setWearSheet(null)}>
          {occasions.map((day, di) => (
            <div key={di} style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: C.copper, padding: "0 4px 6px" }}>{dayEmoji(di)} {dayLabel(di)}</div>
              <div style={{ display: "grid", gap: 6 }}>
                {day.map((occ, oi) => {
                  const cur = occ.outfitId ? byId.get(occ.outfitId) : null;
                  return (
                    <button key={occ.id} onClick={() => assignTo(di, oi, wearing)} aria-label={`Wear on ${dayLabel(di)} ${occ.label}`}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1px solid ${occ.outfitId === wearing.id ? C.copper : C.borderLight}`,
                        background: occ.outfitId === wearing.id ? C.copperGlow : C.warmWhite, cursor: "pointer", textAlign: "left", width: "100%" }}>
                      <span style={{ fontSize: 15 }}>{occ.icon || allOccasionTypes.find((t) => t.id === occ.type)?.icon}</span>
                      <span style={{ flex: 1, fontFamily: F.body, fontSize: 13, color: C.charcoal }}>{occ.label}</span>
                      <span style={{ fontFamily: F.body, fontSize: 11.5, color: C.softGray }}>{occ.outfitId === wearing.id ? "wearing this" : cur ? `now: ${cur.name}` : slotCount(occ.slots) ? "custom pieces" : "empty"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Sheet>
      )}

      {/* Header */}
      <div style={{ padding: "16px 20px 10px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.borderLight}`, background: "rgba(255,248,242,.95)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 5 }}>
        <button onClick={finish} aria-label="Back" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><ArrowLeft size={20} color={C.warmGray} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper }}>Build My Outfits</div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{trip.destination} · {shortlist.length} outfit{shortlist.length === 1 ? "" : "s"} · {plannedCount} of {totalOccasions} occasions planned</div>
        </div>
        {flash && <span role="status" style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.sage, animation: "fadeIn .3s" }}>{flash}</span>}
      </div>

      {/* Tabs */}
      <div style={{ margin: "14px 16px 0", padding: 4, borderRadius: 13, background: C.creamDark, display: "flex", gap: 4 }}>
        {[["outfits", "Outfits"], ["days", "Days"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
            style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: tab === k ? C.warmWhite : "transparent",
              color: tab === k ? C.charcoal : C.warmGray, fontFamily: F.body, fontSize: 13, fontWeight: 600, boxShadow: tab === k ? `0 1px 4px ${C.shadow}` : "none" }}>
            {label}{k === "outfits" && shortlist.length ? ` · ${shortlist.length}` : ""}
          </button>
        ))}
      </div>

      {tab === "outfits" ? (
        <div style={{ padding: "18px 16px 8px" }}>
          <h2 style={{ fontFamily: F.display, fontSize: 26, color: C.charcoal, fontWeight: 400, margin: "0 4px 4px" }}>Outfits for {trip.destination}</h2>
          <p style={{ fontFamily: F.body, fontSize: 13, color: C.softGray, margin: "0 4px 16px", lineHeight: 1.5 }}>
            Build the outfits you're bringing, then slot them into days on the <strong>Days</strong> tab. Everything you build here is saved to your closet for next time.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Btn v="primary" sz="md" onClick={() => startNewOutfit()} style={{ flex: 1 }}><Plus size={16} /> New outfit</Btn>
            <Btn v="secondary" sz="md" onClick={() => setPicker("closet")} style={{ flex: 1 }}><FolderOpen size={16} /> From my closet</Btn>
          </div>
          {shortlist.length === 0 ? (
            <div style={{ padding: "26px 20px", borderRadius: 18, border: `1px dashed ${C.borderMedium}`, textAlign: "center" }}>
              <Shirt size={26} color={C.copperLight} />
              <div style={{ fontFamily: F.display, fontSize: 20, color: C.charcoal, marginTop: 8 }}>No outfits on this trip yet</div>
              <div style={{ fontFamily: F.body, fontSize: 13, color: C.softGray, marginTop: 4, lineHeight: 1.5 }}>
                Start a new one, or pull in outfits you've built before{saved.length ? ` (${saved.length} in your closet)` : ""}.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {shortlist.map((o) => <OutfitCard key={o.id} outfit={o} worn={wornOn(o.id)} onClick={() => setSheet(o.id)} />)}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: "18px 16px 8px" }}>
          <h2 style={{ fontFamily: F.display, fontSize: 26, color: C.charcoal, fontWeight: 400, margin: "0 4px 4px" }}>Day by day</h2>
          <p style={{ fontFamily: F.body, fontSize: 13, color: C.softGray, margin: "0 4px 18px", lineHeight: 1.5 }}>
            Tap an occasion to choose one of your outfits. The pencil tweaks that day's copy without changing the saved outfit.
          </p>
          {occasions.map((dayOccs, di) => (
            <div key={di} style={{ marginBottom: 20 }}>
              {/* Day header: emoji + name, both editable */}
              <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: C.copper, marginBottom: 8, padding: "0 4px", display: "flex", alignItems: "center", gap: 6 }}>
                {editingDayEmoji === di ? (
                  <input value={dayEmojiVal} onChange={(e) => setDayEmojiVal(lastGrapheme(e.target.value))} autoFocus aria-label="Day emoji"
                    onBlur={() => { if (dayEmojiVal) setDayEmojiMap((p) => ({ ...p, [di]: dayEmojiVal })); setEditingDayEmoji(null); setDayEmojiVal(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setEditingDayEmoji(null); setDayEmojiVal(""); } }}
                    style={{ width: 36, fontSize: 16, textAlign: "center", padding: "2px 4px", borderRadius: 6, border: `1.5px solid ${C.copper}`, background: C.copperGlow, outline: "none" }} />
                ) : (
                  <button onClick={() => { setEditingDayEmoji(di); setDayEmojiVal(dayEmoji(di)); }} title="Tap to change emoji" aria-label={`Change emoji for ${dayLabel(di)}`}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 2px", borderRadius: 4, fontSize: 14 }}>{dayEmoji(di)}</button>
                )}
                {renamingDay === di ? (
                  <form onSubmit={(e) => { e.preventDefault(); renameRef.current?.blur(); }} style={{ display: "inline-flex" }}>
                    <input ref={renameRef} value={renameVal} onChange={(e) => setRenameVal(e.target.value)} aria-label="Day name"
                      onBlur={() => { if (renameVal.trim()) setDayNames((p) => { const u = [...p]; u[di] = renameVal.trim(); return u; }); setRenamingDay(null); setRenameVal(""); }}
                      onKeyDown={(e) => { if (e.key === "Escape") { setRenamingDay(null); setRenameVal(""); } }}
                      style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.copper, background: C.copperGlow, border: `1.5px solid ${C.copper}`, borderRadius: 8, padding: "3px 8px", outline: "none", textTransform: "uppercase", letterSpacing: ".06em", width: 150 }} />
                  </form>
                ) : (
                  <button onClick={() => { setRenamingDay(di); setRenameVal(dayLabel(di)); }} title="Tap to rename this day"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 6, fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: C.copper }}>
                    {dayLabel(di)}
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {dayOccs.map((occ, oi) => {
                  const o = occ.outfitId ? byId.get(occ.outfitId) : null;
                  const typeInfo = allOccasionTypes.find((t) => t.id === occ.type);
                  const n = slotCount(occ.slots);
                  const isEmojiEdit = editingOccEmoji && editingOccEmoji.dayIdx === di && editingOccEmoji.occIdx === oi;
                  return (
                    <div key={occ.id} style={{ borderRadius: 16, background: C.warmWhite, border: `1.5px solid ${n ? C.sageLight : C.borderLight}`, boxShadow: `0 2px 8px ${C.shadow}`, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        {isEmojiEdit ? (
                          <input value={occEmojiVal} onChange={(e) => setOccEmojiVal(lastGrapheme(e.target.value))} autoFocus aria-label="Occasion emoji"
                            onBlur={() => { if (occEmojiVal) patchOccasion(di, oi, (x) => ({ ...x, icon: occEmojiVal })); setEditingOccEmoji(null); setOccEmojiVal(""); }}
                            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setEditingOccEmoji(null); setOccEmojiVal(""); } }}
                            style={{ width: 30, fontSize: 14, textAlign: "center", padding: "1px 3px", borderRadius: 4, border: `1.5px solid ${C.copper}`, background: C.copperGlow, outline: "none" }} />
                        ) : (
                          <button onClick={() => { setEditingOccEmoji({ dayIdx: di, occIdx: oi }); setOccEmojiVal(occ.icon || typeInfo?.icon || "🏷️"); }} title="Change emoji" aria-label={`Change emoji for ${occ.label}`}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", fontSize: 14, borderRadius: 4 }}>{occ.icon || typeInfo?.icon}</button>
                        )}
                        <span style={{ flex: 1, fontFamily: F.body, fontSize: 13, fontWeight: 500, color: C.charcoal }}>{occ.label}</span>
                        {n > 0 && <button onClick={() => copyOccasion(di, oi)} title="Copy to another day" aria-label={`Copy ${occ.label} to another day`}
                          style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: C.softGray, display: "flex", alignItems: "center", justifyContent: "center" }}><Copy size={13} /></button>}
                        {dayOccs.length > 1 && <button onClick={() => removeOccasion(di, oi)} title="Remove this occasion" aria-label={`Remove ${occ.label}`}
                          style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: C.softGray, display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={13} /></button>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button onClick={() => setPicker({ dayIdx: di, occIdx: oi })} aria-label={o ? `Change outfit for ${dayLabel(di)} ${occ.label}` : `Choose outfit for ${dayLabel(di)} ${occ.label}`}
                          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: 6, borderRadius: 12, cursor: "pointer", textAlign: "left",
                            background: o || n ? C.cream : C.copperSubtle, border: `1.5px ${o || n ? "solid" : "dashed"} ${o || n ? C.borderLight : C.borderMedium}` }}>
                          {o ? <OutfitVisual outfit={o} size={44} radius={10} /> : (
                            <span style={{ width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: C.warmWhite, color: C.copper, flexShrink: 0 }}><Shirt size={18} /></span>
                          )}
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontFamily: F.body, fontSize: 13, fontWeight: 500, color: o || n ? C.charcoal : C.copper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {o ? o.name : n ? "Custom pieces for this day" : "Choose an outfit"}
                            </span>
                            <span style={{ display: "block", fontFamily: F.body, fontSize: 11, color: C.softGray, marginTop: 2 }}>
                              {o ? (occ.customized ? "customized for this day · " : "") + `${n} piece${n === 1 ? "" : "s"}` : n ? `${n} piece${n === 1 ? "" : "s"} · tap to pick a saved outfit` : "from this trip or your closet"}
                            </span>
                          </span>
                        </button>
                        <button onClick={() => setEditing({ kind: "occasion", dayIdx: di, occIdx: oi })} title="Tweak this day's pieces" aria-label={`Tweak pieces for ${dayLabel(di)} ${occ.label}`}
                          style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${C.borderLight}`, background: C.warmWhite, cursor: "pointer", color: C.warmGray, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Pencil size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {addingOccForDay === di ? (
                  <OccasionTypePicker types={allOccasionTypes} onPick={(t) => addOccasion(di, t)} onCreate={(label, icon) => createType(di, label, icon)} onCancel={() => setAddingOccForDay(null)} />
                ) : (
                  <button onClick={() => setAddingOccForDay(di)}
                    style={{ padding: "12px 16px", borderRadius: 14, border: `2px dashed ${C.borderMedium}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: F.body, fontSize: 13, color: C.copper }}>
                    <Plus size={14} /> Add occasion for {dayLabel(di).toLowerCase()}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 20px 28px", borderTop: `1px solid ${C.borderLight}`, background: "rgba(253,248,240,.96)", backdropFilter: "blur(8px)", zIndex: 20 }}>
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <Btn v="sage" sz="lg" onClick={finish} style={{ width: "100%" }}>
            {photoBusy ? <Loader size={18} className="spin" /> : <Sparkles size={18} />} Done — sync to packing list
          </Btn>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, textAlign: "center", marginTop: 8 }}>
            {shortlist.length} outfit{shortlist.length === 1 ? "" : "s"} on this trip · their pieces are added to your list
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-exported for anyone who still needs the slot table with icons.
export { OUTFIT_SLOTS, cleanSlots };
