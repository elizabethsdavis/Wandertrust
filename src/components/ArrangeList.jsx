// Arrange mode for a trip: drag sections within a category, open a section and
// drag its items. Drag handles only (the grip), so scrolling on a phone stays a
// scroll. Every drop rebuilds `trip.items` via lib/reorder.js and hands the new
// array back through onReorder — nothing else about the trip changes.
import { useState } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, Check } from "lucide-react";
import { C, F } from "../lib/theme";
import { CATEGORIES } from "../data/taxonomy";
import { groupForArrange, moveSection, moveItem } from "../lib/reorder";
import { useDndSensors, Grip } from "./dnd";

function SortableItem({ item }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, display: "flex", alignItems: "center", gap: 6,
      padding: "4px 8px 4px 4px", borderRadius: 10, background: isDragging ? C.copperGlow : "transparent", opacity: isDragging ? 0.9 : 1,
      boxShadow: isDragging ? `0 6px 18px ${C.shadowMed}` : "none", position: "relative", zIndex: isDragging ? 2 : 1 }}>
      <Grip attributes={attributes} listeners={listeners} label={`Drag ${item.name}`} />
      <span style={{ fontFamily: F.body, fontSize: 14, color: item.packed ? C.softGray : C.charcoal, flex: 1,
        textDecoration: item.packed ? "line-through" : "none" }}>{item.name}</span>
    </div>
  );
}

function SortableSection({ section, category, open, onToggle, onReorderItems }) {
  const sid = `sec|${category}|${section.name}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sid });
  const sensors = useDndSensors();
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const toIndex = section.items.findIndex((i) => i.id === over.id);
    if (toIndex >= 0) onReorderItems(active.id, toIndex);
  };
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, marginBottom: 6, borderRadius: 12,
      background: C.warmWhite, border: `1px solid ${isDragging ? C.copper : C.borderLight}`, boxShadow: isDragging ? `0 8px 24px ${C.shadowMed}` : "none",
      position: "relative", zIndex: isDragging ? 3 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px 4px 4px" }}>
        <Grip attributes={attributes} listeners={listeners} label={`Drag section ${section.name}`} />
        <button onClick={onToggle} aria-expanded={open}
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "8px 4px", textAlign: "left" }}>
          <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: C.warmGray, flex: 1 }}>{section.name}</span>
          <span style={{ fontFamily: F.body, fontSize: 12, color: C.softGray }}>{section.items.length}</span>
          <ChevronRight size={16} color={C.softGray} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
        </button>
      </div>
      {open && (
        <div style={{ padding: "0 8px 8px 8px" }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={section.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {section.items.map((it) => <SortableItem key={it.id} item={it} />)}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

export function ArrangeList({ items, onReorder, onDone }) {
  const groups = groupForArrange(items);
  const order = CATEGORIES.map((c) => c.id);
  const sorted = [...groups].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  const [openSec, setOpenSec] = useState(null); // "cat|section" currently expanded
  const sensors = useDndSensors();

  return (
    <div style={{ padding: "8px 16px 120px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px 14px" }}>
        <div style={{ flex: 1, fontFamily: F.body, fontSize: 13, color: C.warmGray, lineHeight: 1.45 }}>
          Drag the grip to reorder sections. Tap a section to open it and drag its items.
        </div>
        <button onClick={onDone}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 12, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg,${C.sage},${C.sageLight})`, color: "#fff", fontFamily: F.body, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          <Check size={15} /> Done
        </button>
      </div>
      {sorted.map((g) => {
        const cat = CATEGORIES.find((c) => c.id === g.category);
        const onDragEnd = ({ active, over }) => {
          if (!over || active.id === over.id) return;
          const name = String(active.id).split("|").slice(2).join("|");
          const toIndex = g.sections.findIndex((s) => `sec|${g.category}|${s.name}` === over.id);
          if (toIndex >= 0) onReorder(moveSection(items, g.category, name, toIndex));
        };
        return (
          <div key={g.category} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px 6px" }}>
              <span style={{ fontSize: 18 }}>{cat?.icon}</span>
              <span style={{ fontFamily: F.display, fontSize: 20, color: C.charcoal, fontWeight: 500 }}>{cat?.label || g.category}</span>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={g.sections.map((s) => `sec|${g.category}|${s.name}`)} strategy={verticalListSortingStrategy}>
                {g.sections.map((s) => {
                  const key = `${g.category}|${s.name}`;
                  return (
                    <SortableSection key={key} section={s} category={g.category} open={openSec === key}
                      onToggle={() => setOpenSec(openSec === key ? null : key)}
                      onReorderItems={(itemId, toIndex) => onReorder(moveItem(items, itemId, toIndex))} />
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
        );
      })}
    </div>
  );
}
