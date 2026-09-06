// The wardrobe picker for one slot (Picker batch — replaces the horizontal
// WardrobeCarousel): a search field, colour / brand chips, then a vertical list
// of rows — "Recently worn" first, then one group per colour family — where a
// tap on the row PICKS the piece and the single ⋯ button at the row's end opens
// the Edit piece sheet (remove lives in there). No more three tap targets on a
// tiny card. Props only.
//
//   index            pieceIndex() for this slot (name, parsed meta, last worn)
//   selected         string (single slot) or string[] (multi slot)
//   onSelect(name)   pick / toggle
//   onEditPiece({ name, newName, entry }), onRemoveItem(name), usageFor(name)  → the edit sheet
//   onAddNew(query)  "+" in the search row, or "Add “query” as a new …" when nothing matches
import { useMemo, useState } from "react";
import { Check, Search, X, Plus, MoreHorizontal } from "lucide-react";
import { C, F } from "../lib/theme";
import { swatchBackground } from "../lib/wardrobe";
import { pieceFacets, filterPieces, groupPieces } from "../lib/pieces";
import { SLOT_BY_ID } from "../data/outfitSlots";
import { PieceEditSheet } from "./PieceEditSheet";

const slotWordOf = (slot) => (slot?.label || "piece").toLowerCase().replace(/\s*\(.*\)|\s*\/.*$/g, "");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function relative(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} wk ago`;
  if (days < 365) return `${Math.round(days / 30)} mo ago`;
  return `${Math.round(days / 365)} yr ago`;
}

function Chip({ active, onClick, children, ariaLabel }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} aria-label={ariaLabel}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, flexShrink: 0, cursor: "pointer",
        border: `1px solid ${active ? C.copper : C.borderLight}`, background: active ? C.copperGlow : C.warmWhite,
        fontFamily: F.body, fontSize: 12, fontWeight: active ? 600 : 400, color: active ? C.copper : C.charcoal }}>
      {children}
    </button>
  );
}

function Row({ piece, selected, onSelect, onEdit }) {
  const { name, meta, where, lastUsed } = piece;
  const swatch = swatchBackground(meta);
  const when = relative(lastUsed);
  const sub = [meta.brand, meta.pattern, where ? `${where}${when ? ` · ${when}` : ""}` : null].filter(Boolean);
  return (
    <div data-piece={name} style={{ display: "flex", alignItems: "stretch", marginBottom: 6, borderRadius: 14, overflow: "hidden",
      background: selected ? C.copperGlow : C.warmWhite, border: `1.5px solid ${selected ? C.copper : C.borderLight}`, boxShadow: `0 1px 4px ${C.shadow}` }}>
      <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={name}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 8px 0 14px", minHeight: 52, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
        {swatch ? (
          <span data-swatch="1" style={{ width: 14, height: 14, borderRadius: 7, background: swatch, flexShrink: 0,
            border: `1px solid ${meta.color === "white" || meta.color === "cream" ? C.borderMedium : "rgba(45,41,38,.12)"}`,
            outline: meta.source?.color === "manual" ? `2px solid ${C.copperGlow}` : "none" }} />
        ) : (
          <span data-swatch="1" style={{ width: 14, height: 14, borderRadius: 7, flexShrink: 0, border: `1px dashed ${C.borderMedium}` }} />
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: F.body, fontSize: 14, fontWeight: selected ? 600 : 500, color: C.charcoal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>{name}</span>
          {sub.length > 0 && (
            <span style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: F.body, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: C.softGray, overflow: "hidden", whiteSpace: "nowrap" }}>
              {meta.brand && <span>{meta.brand}</span>}
              {meta.pattern && <span style={{ color: C.copper }}>{meta.pattern}</span>}
              {where && <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{where}{when ? ` · ${when}` : ""}</span>}
            </span>
          )}
        </span>
        {selected && <Check size={16} color={C.copper} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
      </button>
      <button type="button" onClick={onEdit} aria-label={`Edit ${name}`} title="Edit this piece"
        style={{ width: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderLeft: `1px solid ${C.borderLight}`, background: "transparent", cursor: "pointer", color: C.softGray, padding: 0 }}>
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}

export function WardrobePicker({ slotId, index, selected, onSelect, onEditPiece, onRemoveItem, usageFor, onAddNew, wardrobeMeta, adding = false }) {
  const slot = SLOT_BY_ID[slotId];
  const word = slotWordOf(slot);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [brand, setBrand] = useState("");
  const [editing, setEditing] = useState(null);
  const selArr = Array.isArray(selected) ? selected : selected ? [selected] : [];
  const items = index || [];
  const facets = useMemo(() => pieceFacets(items), [items]);
  const filtering = !!(query.trim() || family || brand);
  const filtered = useMemo(() => (filtering ? filterPieces(items, { query, family, brand }) : items), [items, query, family, brand, filtering]);
  const grouped = useMemo(() => (filtering ? null : groupPieces(items)), [items, filtering]);
  const showChips = facets.families.length > 1 || facets.brands.length > 0;
  const addLabel = `Add ${selArr.length && slot?.multi ? "another" : "new"} ${word}`;

  const rowFor = (p) => (
    <Row key={p.name} piece={p} selected={selArr.includes(p.name)} onSelect={() => onSelect(p.name)} onEdit={() => setEditing(p.name)} />
  );
  const sectionTitle = (text, hex) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 4px 6px", fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: C.softGray }}>
      {hex && <span style={{ width: 9, height: 9, borderRadius: 5, background: hex, border: "1px solid rgba(45,41,38,.12)" }} />}{text}
    </div>
  );

  return (
    <div>
      {editing && (
        <PieceEditSheet slot={slot} name={editing} meta={wardrobeMeta?.[editing]} usage={usageFor?.(editing)} onClose={() => setEditing(null)}
          onSave={({ name, entry }) => onEditPiece?.({ name: editing, newName: name, entry })}
          onRemove={onRemoveItem && !selArr.includes(editing) ? () => onRemoveItem(editing) : undefined} />
      )}

      {items.length === 0 ? (
        !adding && <button type="button" onClick={() => onAddNew?.("")} aria-label={addLabel}
          style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: `2px dashed ${C.borderMedium}`, background: C.copperSubtle, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: F.body, fontSize: 14, color: C.copper }}>
          <Plus size={16} /> {addLabel}
        </button>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8, paddingLeft: 4, fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: C.warmGray }}>
            Your wardrobe <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: C.softGray }}>· {plural(items.length, word)}</span>
          </div>
          {/* Search + add */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: C.warmWhite, border: `1.5px solid ${C.borderMedium}`, borderRadius: 12, padding: "0 10px" }}>
              <Search size={15} color={C.softGray} style={{ flexShrink: 0 }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find a ${word}… colour, brand or type`} aria-label={`Find a ${word}`}
                autoComplete="off" autoCapitalize="none" enterKeyHint="search"
                onKeyDown={(e) => { if (e.key === "Enter" && filtered.length === 1) { e.preventDefault(); onSelect(filtered[0].name); setQuery(""); } if (e.key === "Escape") setQuery(""); }}
                style={{ flex: 1, minWidth: 0, fontFamily: F.body, fontSize: 14, padding: "11px 0", border: "none", background: "transparent", outline: "none", color: C.charcoal }} />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" style={{ background: "none", border: "none", cursor: "pointer", color: C.softGray, padding: 4, display: "flex" }}><X size={14} /></button>
              )}
            </div>
            <button type="button" onClick={() => onAddNew?.("")} aria-label={addLabel} title={addLabel}
              style={{ width: 46, borderRadius: 12, border: `2px dashed ${C.borderMedium}`, background: C.copperSubtle, color: C.copper, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Plus size={18} />
            </button>
          </div>
          {/* Colour + brand chips */}
          {showChips && (
            <div role="group" aria-label={`Filter ${word}s`} style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 2, WebkitOverflowScrolling: "touch" }}>
              <Chip active={!family && !brand} onClick={() => { setFamily(""); setBrand(""); }}>All</Chip>
              {facets.families.map((f) => (
                <Chip key={f.id} active={family === f.id} onClick={() => { setFamily(family === f.id ? "" : f.id); setBrand(""); }} ariaLabel={`Only ${f.id}`}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, background: f.hex, border: "1px solid rgba(45,41,38,.12)" }} />{f.id}<span style={{ color: C.softGray, fontSize: 11 }}>{f.count}</span>
                </Chip>
              ))}
              {facets.brands.map((b) => (
                <Chip key={b.name} active={brand.toLowerCase() === b.name.toLowerCase()} onClick={() => { setBrand(brand.toLowerCase() === b.name.toLowerCase() ? "" : b.name); setFamily(""); }} ariaLabel={`Only ${b.name}`}>
                  {b.name}<span style={{ color: C.softGray, fontSize: 11 }}>{b.count}</span>
                </Chip>
              ))}
            </div>
          )}
          {/* The list */}
          {filtering ? (
            filtered.length > 0 ? (
              <div>{filtered.map(rowFor)}</div>
            ) : (
              <div style={{ padding: "14px 4px 6px", fontFamily: F.body, fontSize: 13, color: C.softGray }}>
                No {word}s match {query.trim() ? `“${query.trim()}”` : "that filter"}.
                {query.trim() && (
                  <button type="button" onClick={() => { onAddNew?.(query.trim()); setQuery(""); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, width: "100%", padding: "12px 16px", borderRadius: 14, border: `2px dashed ${C.borderMedium}`, background: C.copperSubtle, cursor: "pointer", fontFamily: F.body, fontSize: 14, color: C.copper }}>
                    <Plus size={16} /> Add “{query.trim()}” as a new {word}
                  </button>
                )}
              </div>
            )
          ) : (
            <div>
              {grouped.recent.length > 0 && (<>{sectionTitle("Recently worn")}{grouped.recent.map(rowFor)}</>)}
              {grouped.groups.map((g) => (
                <div key={g.family || "other"}>
                  {g.label && sectionTitle(`${g.label} · ${g.items.length}`, g.hex)}
                  {g.items.map(rowFor)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

