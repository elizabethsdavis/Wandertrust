// My Outfits — the closet (Outfits batch). Every outfit ever built, outside
// any trip: browse with photos, rename, add a photo, edit pieces, see which
// trips wear it, and — the only place this happens — delete it for good. Also
// the one-time "Bring in outfits from past trips" import.
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, X, Camera, Pencil, Trash2, Download, CalendarDays, Check } from "lucide-react";
import { C, F } from "../lib/theme";
import { id as newId } from "../lib/utils";
import { Btn } from "./ui";
import { OutfitEditor, PhotoButton } from "./OutfitEditor";
import { OutfitCard, OutfitVisual, PieceList, Sheet } from "./OutfitCard";
import { newOutfit, updateOutfit, matchesQuery, outfitUsage, forgetOutfitInTrips, importOutfitsFromTrips, linkImportedOutfits, slotCount } from "../lib/outfits";
import { savePhoto, deletePhoto } from "../lib/photos";
import { renameInSlots } from "../lib/pieces";

export function Closet({ savedOutfits, setSavedOutfits, trips, setTrips, wardrobe, setWardrobe, wardrobeMeta, setWardrobeMeta, uid, onExit, renamePiece, pieceUsageFor, pieceIndexFor }) {
  const saved = savedOutfits || [];
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null); // { id|null, draft }
  const [nameDraft, setNameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [flash, setFlash] = useState("");
  const say = (m) => { setFlash(m); setTimeout(() => setFlash(""), 1800); };

  const open = openId ? saved.find((o) => o.id === openId) : null;
  const list = useMemo(() => saved.filter((o) => matchesQuery(o, q)).slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))), [saved, q]);
  const importable = useMemo(() => importOutfitsFromTrips(trips, saved).outfits.length, [trips, saved]);

  const upsert = (rec) => setSavedOutfits((prev) => { const l = prev || []; return l.some((o) => o.id === rec.id) ? l.map((o) => (o.id === rec.id ? rec : o)) : [...l, rec]; });

  const importPast = () => {
    const { outfits, skipped } = importOutfitsFromTrips(trips, saved);
    if (!outfits.length) { say("Nothing new to bring in"); return; }
    setSavedOutfits((prev) => [...(prev || []), ...outfits]);
    const linked = linkImportedOutfits(trips, outfits);
    if (linked.changed) setTrips(linked.trips);
    say(`${outfits.length} outfit${outfits.length === 1 ? "" : "s"} brought in${skipped ? ` · ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : ""}`);
  };

  const pickPhoto = async (o, file) => {
    setPhotoBusy(true); setPhotoError("");
    try {
      const photo = await savePhoto({ uid, outfitId: o.id, file });
      upsert(updateOutfit(o, { photo }));
    } catch (e) {
      setPhotoError(e?.message || "Couldn't add that photo.");
    } finally {
      setPhotoBusy(false);
    }
  };
  const removePhoto = (o) => { deletePhoto(o.photo); upsert(updateOutfit(o, { photo: null })); };

  const deleteOutfit = (o) => {
    const usage = outfitUsage(o.id, trips);
    const where = [...new Set(usage.map((u) => u.destination))];
    if (!confirm(`Delete “${o.name}” from your closet for good?${where.length ? ` It's planned on ${where.join(", ")} — those days keep their pieces but lose the link.` : ""}`)) return;
    deletePhoto(o.photo);
    setSavedOutfits((prev) => (prev || []).filter((x) => x.id !== o.id));
    const r = forgetOutfitInTrips(trips, o.id);
    if (r.changed) setTrips(r.trips);
    setOpenId(null);
    say("Deleted");
  };

  const [editNotice, setEditNotice] = useState("");
  useEffect(() => { setEditNotice(""); }, [editing]);
  const finishEdit = (reason) => {
    const { id, draft } = editing;
    if (!id && slotCount(draft.slots) === 0 && !draft.photo && !draft.name.trim()) {
      // Nothing to keep: the back arrow closes, an explicit "Save outfit" says why (Sync Fix batch).
      if (reason === "done") { setEditNotice("Nothing to save yet — pick a piece, add a photo or name it."); return; }
      setEditing(null);
      return;
    }
    const base = id ? saved.find((o) => o.id === id) : null;
    const rec = base ? updateOutfit(base, { name: draft.name, slots: draft.slots, photo: draft.photo }) : { ...newOutfit({ name: draft.name || "New outfit", slots: draft.slots, photo: draft.photo }), id: draft.id };
    upsert(rec);
    setEditing(null);
    setOpenId(rec.id);
    say(base ? "Outfit updated" : "Added to your closet");
  };

  if (editing) {
    const d = editing.draft;
    return (
      <OutfitEditor title={editing.id ? "Edit outfit" : "New outfit"} subtitle="My Outfits"
        name={d.name} onName={(v) => setEditing((e) => ({ ...e, draft: { ...e.draft, name: v } }))}
        slots={d.slots} onSlots={(u) => setEditing((e) => ({ ...e, draft: { ...e.draft, slots: typeof u === "function" ? u(e.draft.slots) : u } }))}
        wardrobe={wardrobe} setWardrobe={setWardrobe} wardrobeMeta={wardrobeMeta} setWardrobeMeta={setWardrobeMeta}
        photo={d.photo} photoBusy={photoBusy} photoError={photoError} notice={editNotice}
        onPickPhoto={async (file) => { setPhotoBusy(true); setPhotoError(""); try { const photo = await savePhoto({ uid, outfitId: d.id, file }); setEditing((e) => ({ ...e, draft: { ...e.draft, photo } })); } catch (er) { setPhotoError(er?.message || "Couldn't add that photo."); } finally { setPhotoBusy(false); } }}
        onRemovePhoto={() => { deletePhoto(d.photo); setEditing((e) => ({ ...e, draft: { ...e.draft, photo: null } })); }}
        onRenamePiece={(args) => {   // Piece Edit batch: rename in every store, then in this draft
          const r = renamePiece ? renamePiece(args) : { finalName: args.newName };
          const to = r?.finalName || args.newName;
          setEditing((e) => (e?.draft ? { ...e, draft: { ...e.draft, slots: renameInSlots(e.draft.slots || {}, args.slotId, args.oldName, to) } } : e));
          return r;
        }} pieceUsageFor={pieceUsageFor} pieceIndexFor={pieceIndexFor}
        onDone={finishEdit} doneLabel={editing.id ? "Save" : "Save outfit"} />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.cream, paddingBottom: 40 }}>
      {open && (
        <Sheet title={renaming ? "" : open.name} onClose={() => { setOpenId(null); setRenaming(false); }} ariaLabel={`Outfit ${open.name}`}>
          {renaming && (
            <form onSubmit={(e) => { e.preventDefault(); if (nameDraft.trim()) upsert(updateOutfit(open, { name: nameDraft })); setRenaming(false); }} style={{ display: "flex", gap: 8, marginTop: -10, marginBottom: 14 }}>
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus aria-label="Outfit name"
                style={{ flex: 1, fontFamily: F.display, fontSize: 22, padding: "6px 0", border: "none", borderBottom: `1.5px solid ${C.copper}`, background: "transparent", outline: "none", color: C.charcoal }} />
              <Btn v="sage" sz="sm" onClick={() => { if (nameDraft.trim()) upsert(updateOutfit(open, { name: nameDraft })); setRenaming(false); }}><Check size={14} /> Save</Btn>
            </form>
          )}
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <OutfitVisual outfit={open} size={132} radius={18} full />
            <div style={{ flex: 1, minWidth: 0 }}>
              <PieceList slots={open.slots} />
              {open.source?.trip && <div style={{ fontFamily: F.body, fontSize: 11.5, color: C.softGray, marginTop: 8 }}>From {open.source.trip} · {open.source.day} {open.source.occasion}</div>}
              {(() => { const u = outfitUsage(open.id, trips); const names = [...new Set(u.map((x) => x.destination))]; return names.length ? (
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.sage, marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}><CalendarDays size={12} /> Worn on {names.join(", ")}</div>
              ) : null; })()}
            </div>
          </div>
          {photoError && <div role="alert" style={{ fontFamily: F.body, fontSize: 12, color: C.danger, marginTop: 8 }}>{photoError}</div>}
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <PhotoButton busy={photoBusy} ariaLabel={open.photo ? "Replace photo" : "Add photo"} onFile={(file) => pickPhoto(open, file)}
                style={{ flex: 1, fontFamily: F.body, fontWeight: 500, fontSize: 14, borderRadius: 14, padding: "12px 16px", cursor: "pointer", border: "none",
                  background: `linear-gradient(135deg,${C.copper},${C.copperLight})`, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 2px 12px rgba(193,127,89,.3)" }}>
                <Camera size={15} /> {open.photo ? "Replace photo" : "Add photo"}
              </PhotoButton>
              <Btn v="secondary" sz="md" onClick={() => setEditing({ id: open.id, draft: { id: open.id, name: open.name, slots: JSON.parse(JSON.stringify(open.slots || {})), photo: open.photo || null } })} style={{ flex: 1 }}><Pencil size={15} /> Edit pieces</Btn>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="secondary" sz="sm" onClick={() => { setNameDraft(open.name); setRenaming(true); }} style={{ flex: 1 }}>Rename</Btn>
              {open.photo && <Btn v="secondary" sz="sm" onClick={() => removePhoto(open)} style={{ flex: 1 }}>Remove photo</Btn>}
            </div>
            <button onClick={() => deleteOutfit(open)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.body, fontSize: 13, color: C.danger, padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Trash2 size={14} /> Delete from closet
            </button>
          </div>
        </Sheet>
      )}

      <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.borderLight}`, position: "sticky", top: 0, background: "rgba(253,248,240,.95)", backdropFilter: "blur(8px)", zIndex: 5 }}>
        <button onClick={onExit} aria-label="Back" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><ArrowLeft size={20} color={C.warmGray} /></button>
        <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal, flex: 1 }}>My Outfits</span>
        {flash && <span role="status" style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.sage }}>{flash}</span>}
      </div>

      <div style={{ padding: "24px 20px 8px" }}>
        <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>Your closet</h2>
        <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 18, lineHeight: 1.5 }}>
          Every outfit you've built, ready for any trip. Tap one to add a photo, rename it or edit its pieces.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Btn v="primary" sz="md" onClick={() => setEditing({ id: null, draft: { id: newId(), name: "", slots: {}, photo: null } })} style={{ flex: 1 }}><Plus size={16} /> New outfit</Btn>
          {importable > 0 && <Btn v="secondary" sz="md" onClick={importPast} style={{ flex: 1 }}><Download size={16} /> Bring in {importable} from past trips</Btn>}
        </div>
        {saved.length > 4 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: C.warmWhite, borderRadius: 12, border: `1px solid ${C.borderLight}`, marginBottom: 14 }}>
            <Search size={14} color={C.softGray} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search outfits or pieces…" aria-label="Search outfits"
              style={{ flex: 1, border: "none", background: "none", outline: "none", fontFamily: F.body, fontSize: 13, color: C.charcoal }} />
            {q && <button onClick={() => setQ("")} aria-label="Clear search" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={12} color={C.softGray} /></button>}
          </div>
        )}
        {list.length === 0 ? (
          <div style={{ padding: "28px 20px", borderRadius: 18, border: `1px dashed ${C.borderMedium}`, textAlign: "center" }}>
            <div style={{ fontSize: 30 }}>👗</div>
            <div style={{ fontFamily: F.display, fontSize: 20, color: C.charcoal, marginTop: 8 }}>{q ? "No outfit matches that" : "No outfits saved yet"}</div>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.softGray, marginTop: 4, lineHeight: 1.5 }}>
              {q ? "Try another word." : importable ? "Bring in the outfits from your past trips, or build a new one." : "Build one here or from any trip's Build Outfits."}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {list.map((o) => <OutfitCard key={o.id} outfit={o} onClick={() => { setOpenId(o.id); setRenaming(false); setPhotoError(""); }} />)}
          </div>
        )}
      </div>
    </div>
  );
}
