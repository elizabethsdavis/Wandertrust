import { useState, useEffect } from "react";
import { DndContext, closestCenter, MeasuringStrategy } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, X, RotateCcw, Check, RefreshCw, BatteryCharging, WashingMachine, Pencil } from "lucide-react";
import { C, F } from "../lib/theme";
import { CATEGORIES } from "../data/taxonomy";
import { templateBase, FLAGS, moveGroupSection, moveGroupItem, renameGroupSection } from "../lib/template";
import { addinsBase, defaultAddins, TYPE_KEYS, WEATHER_KEYS } from "../lib/addins";
import { resolveCategories, isCategoryOverridden, setCategoryOverride, EMOJI_SUGGESTIONS } from "../lib/categories";
import { useDndSensors, Grip } from "./dnd";
import { EmojiPicker } from "./EmojiPicker";

// ─────────────────────────────────────────────────────────────
// Packing Template editor — two tabs.
//
// "Default items": the master catalog that seeds every NEW trip, stored (by the
// caller) under the additive `catalogTemplate` key — `null` means "use the
// built-in CORE". Shape mirrors CORE: { categoryId: { section: [{name,f,e,ff,…}] } }.
// The "checkout" category (the Out-the-Door list) is edited separately.
//
// "Add-ins": the items added ON TOP of the template when a new trip matches a
// trip type or the weather, stored under the additive `addins` key — `null`
// means the built-in COND_ITEMS. See lib/addins.js for the shape.
//
// Sections and items can be dragged into a new order (grip handles); the order
// is simply the object-key / array order, which genList follows. Sections can
// be renamed in place. Category names and emojis are display overrides stored
// under the additive `categoryMeta` key (lib/categories.js) — those apply
// everywhere, existing trips included, since items reference category ids.
// Everything else only affects trips created afterwards.
// ─────────────────────────────────────────────────────────────

const clone = (o) => JSON.parse(JSON.stringify(o));
const coreDraft = () => templateBase(null);

// Per-item flag toggles: pre-set what every new trip should start with.
const FLAG_UI = {
  needsRefill: { Icon: RefreshCw, color: C.amber, glow: C.amberGlow, title: "Needs refill before each trip" },
  needsCharge: { Icon: BatteryCharging, color: C.teal, glow: C.tealGlow, title: "Needs charging before each trip" },
  needsWash: { Icon: WashingMachine, color: C.lavender, glow: C.lavenderGlow, title: "Needs a wash before each trip" },
};

function AddRow({ placeholder, accent, onAdd }) {
  const [v, setV] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) {
          onAdd(v.trim());
          setV("");
        }
      }}
      style={{ display: "flex", gap: 8, padding: "6px 14px" }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, fontFamily: F.body, fontSize: 14, padding: "8px 12px", borderRadius: 10,
          border: `1.5px solid ${C.borderLight}`, background: C.warmWhite, outline: "none", color: C.charcoal }}
        onFocus={(e) => (e.target.style.borderColor = accent)}
        onBlur={(e) => (e.target.style.borderColor = C.borderLight)}
      />
      <button type="submit" style={{ padding: "0 16px", borderRadius: 10, border: "none", cursor: "pointer",
        background: accent, color: "#fff", fontFamily: F.body, fontSize: 13, fontWeight: 600 }}>
        Add
      </button>
    </form>
  );
}

// One editable item row: grip · name · flag toggles · remove.
function ItemRow({ id, item, onRename, onToggleFlag, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, display: "flex", alignItems: "center", gap: 4,
      padding: "2px 12px 2px 6px", borderRadius: 10, background: isDragging ? C.copperGlow : "transparent", position: "relative", zIndex: isDragging ? 2 : 1 }}>
      <Grip attributes={attributes} listeners={listeners} label={`Drag ${item.name}`} size={28} />
      <input
        value={item.name}
        onChange={(e) => onRename(e.target.value)}
        aria-label="Item name"
        style={{ flex: 1, minWidth: 0, fontFamily: F.body, fontSize: 14, color: C.charcoal, padding: "8px 8px",
          border: "1.5px solid transparent", borderRadius: 8, background: "transparent", outline: "none" }}
        onFocus={(e) => { e.target.style.borderColor = C.borderMedium; e.target.style.background = C.cream; }}
        onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
      />
      {FLAGS.map((flag) => {
        const ui = FLAG_UI[flag]; const on = !!item[flag];
        return (
          <button key={flag} onClick={() => onToggleFlag(flag)} title={ui.title} aria-label={ui.title} aria-pressed={on}
            style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid ${on ? "transparent" : C.borderLight}`, background: on ? ui.glow : "transparent" }}>
            <ui.Icon size={13} color={on ? ui.color : C.borderMedium} />
          </button>
        );
      })}
      <button onClick={onRemove} aria-label="Remove"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 6, flexShrink: 0 }}>
        <X size={15} color={C.softGray} />
      </button>
    </div>
  );
}

// One section: draggable header + its own sortable item list + an add row.
function SectionBlock({ id, name, items, accent, onChange, newItem, collapsed }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const sensors = useDndSensors();
  const [nameDraft, setNameDraft] = useState(name);
  useEffect(() => { setNameDraft(name); }, [name]);
  const commitName = () => {
    const v = nameDraft.trim();
    if (!v || v === name) { setNameDraft(name); return; }
    onChange((g) => renameGroupSection(g, name, v));
  };
  const itemId = (i) => `${id}#${i}`;
  const onItemDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = Number(String(active.id).split("#").pop());
    const to = Number(String(over.id).split("#").pop());
    onChange((g) => moveGroupItem(g, name, from, to));
  };
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, marginBottom: 6, borderRadius: 12,
      background: isDragging ? C.warmWhite : "transparent", border: `1px solid ${isDragging ? C.copper : "transparent"}`,
      boxShadow: isDragging ? `0 8px 24px ${C.shadowMed}` : "none", position: "relative", zIndex: isDragging ? 3 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 16px 2px 6px" }}>
        <Grip attributes={attributes} listeners={listeners} label={`Drag section ${name}`} size={28} />
        <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={commitName}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setNameDraft(name); e.currentTarget.blur(); } }}
          aria-label={`Section name ${name}`} title="Tap to rename this section"
          style={{ flex: 1, minWidth: 0, fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em",
            color: C.warmGray, padding: "6px 8px", border: "1.5px solid transparent", borderRadius: 8, background: "transparent", outline: "none" }}
          onFocus={(e) => { e.target.style.borderColor = C.borderMedium; e.target.style.background = C.cream; }}
          onBlurCapture={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }} />
        <span style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{items.length}</span>
      </div>
      {!collapsed && (<>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onItemDragEnd}>
          <SortableContext items={items.map((_, i) => itemId(i))} strategy={verticalListSortingStrategy}>
            {items.map((it, i) => (
              <ItemRow key={itemId(i)} id={itemId(i)} item={it}
                onRename={(v) => onChange((g) => ({ ...g, [name]: g[name].map((x, k) => (k === i ? { ...x, name: v } : x)) }))}
                onToggleFlag={(flag) => onChange((g) => ({ ...g, [name]: g[name].map((x, k) => { if (k !== i) return x; const n = { ...x }; if (n[flag]) delete n[flag]; else n[flag] = true; return n; }) }))}
                onRemove={() => onChange((g) => { const arr = g[name].filter((_, k) => k !== i); const n = { ...g }; if (arr.length) n[name] = arr; else delete n[name]; return n; })} />
            ))}
          </SortableContext>
        </DndContext>
        <AddRow placeholder={`Add to ${name}…`} accent={accent} onAdd={(v) => onChange((g) => ({ ...g, [name]: [...(g[name] || []), newItem(v)] }))} />
      </>)}
    </div>
  );
}

// A card for one group ({ section: [items] }): a template category or an add-in group.
function GroupEditor({ gid, icon, title, hint, accent, group, onChange, newItem, emptyText, meta }) {
  // meta (template categories only): { defaultLabel, defaultIcon, overridden, onLabel, onIcon, onReset }
  const sensors = useDndSensors();
  const [draggingSection, setDraggingSection] = useState(false);
  const [labelDraft, setLabelDraft] = useState(title);
  useEffect(() => { setLabelDraft(title); }, [title]);   // Reset / default buttons change the title from outside
  const [pickingIcon, setPickingIcon] = useState(false);
  const commitLabel = () => {
    const v = labelDraft.trim();
    if (!v) { setLabelDraft(title); return; }
    if (v !== title) meta.onLabel(v);
  };
  const names = Object.keys(group || {});
  const secId = (i) => `${gid}/${i}`;
  const onSectionDragEnd = ({ active, over }) => {
    setDraggingSection(false);
    if (!over || active.id === over.id) return;
    const from = Number(String(active.id).split("/").pop());
    const to = Number(String(over.id).split("/").pop());
    onChange((g) => moveGroupSection(g, names[from], to));
  };
  return (
    <div style={{ marginBottom: 22 }}>
      {pickingIcon && meta && (
        <EmojiPicker title="Category emoji" value={icon} defaultValue={meta.defaultIcon} suggestions={EMOJI_SUGGESTIONS.category}
          onSave={(e) => meta.onIcon(e)} onClose={() => setPickingIcon(false)} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 8px 6px" }}>
        {meta ? (
          <>
            <button onClick={() => setPickingIcon(true)} aria-label={`Change emoji for ${title}`} title="Change emoji"
              style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.borderLight}`, background: C.warmWhite, cursor: "pointer",
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</button>
            <input value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} onBlur={commitLabel}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setLabelDraft(title); e.currentTarget.blur(); } }}
              aria-label={`Category name ${meta.defaultLabel}`} title="Tap to rename this category"
              style={{ flex: 1, minWidth: 0, fontFamily: F.display, fontSize: 20, color: C.charcoal, fontWeight: 500, padding: "4px 8px",
                border: "1.5px solid transparent", borderRadius: 8, background: "transparent", outline: "none" }}
              onFocus={(e) => { e.target.style.borderColor = C.borderMedium; e.target.style.background = C.warmWhite; }}
              onBlurCapture={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }} />
            {meta.overridden ? (
              <button onClick={() => { meta.onReset(); setLabelDraft(meta.defaultLabel); }} aria-label={`Reset ${meta.defaultLabel} name and emoji`}
                title={`Back to ${meta.defaultIcon} ${meta.defaultLabel}`}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 4,
                  fontFamily: F.body, fontSize: 11, color: C.softGray }}>
                <RotateCcw size={13} /> default
              </button>
            ) : (
              <Pencil size={13} color={C.borderMedium} aria-hidden="true" />
            )}
          </>
        ) : (
          <>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontFamily: F.display, fontSize: 20, color: C.charcoal, fontWeight: 500 }}>{title}</span>
            {hint && <span style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, flex: 1 }}>{hint}</span>}
          </>
        )}
      </div>
      <div style={{ background: C.warmWhite, borderRadius: 16, border: `1px solid ${C.borderLight}`, padding: "6px 0" }}>
        {names.length === 0 && (
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.softGray, padding: "8px 16px" }}>{emptyText}</div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={() => setDraggingSection(true)} onDragCancel={() => setDraggingSection(false)} onDragEnd={onSectionDragEnd}>
          <SortableContext items={names.map((_, i) => secId(i))} strategy={verticalListSortingStrategy}>
            {names.map((name, i) => (
              <SectionBlock key={name} id={secId(i)} name={name} items={group[name] || []} accent={accent} onChange={onChange} newItem={newItem}
                collapsed={draggingSection} />
            ))}
          </SortableContext>
        </DndContext>
        <div style={{ borderTop: `1px solid ${C.borderLight}`, marginTop: 4, paddingTop: 4 }}>
          <AddRow placeholder="New section name…" accent={accent} onAdd={(name) => onChange((g) => (g[name] ? g : { ...g, [name]: [] }))} />
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer",
        background: active ? C.warmWhite : "transparent", color: active ? C.charcoal : C.warmGray,
        fontFamily: F.body, fontSize: 13, fontWeight: 600, boxShadow: active ? `0 1px 4px ${C.shadow}` : "none" }}>
      {children}
    </button>
  );
}

function SubHeading({ children }) {
  return (
    <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em",
      color: C.warmGray, padding: "18px 8px 4px" }}>{children}</div>
  );
}

export default function TemplateEditor({ template, setTemplate, addins, setAddins, categoryMeta, setCategoryMeta, onExit }) {
  const [tab, setTab] = useState("items");
  const [draft, setDraft] = useState(() => {
    const base = template ? clone(template) : coreDraft();
    delete base.checkout;
    return { template: base, addins: addinsBase(addins), categoryMeta: clone(categoryMeta || {}) };
  });
  const [dirty, setDirty] = useState({ template: false, addins: false, categories: false });
  const [flash, setFlash] = useState(false);
  const anyDirty = dirty.template || dirty.addins || dirty.categories;

  const editable = resolveCategories(draft.categoryMeta).filter((c) => c.id !== "checkout");
  const setCategory = (id, patch) => {
    setDraft((prev) => ({ ...prev, categoryMeta: setCategoryOverride(prev.categoryMeta, id, patch) }));
    setDirty((d) => ({ ...d, categories: true }));
  };
  const resetCategory = (id) => {
    setDraft((prev) => { const m = { ...prev.categoryMeta }; delete m[id]; return { ...prev, categoryMeta: m }; });
    setDirty((d) => ({ ...d, categories: true }));
  };

  // Every edit is "replace this one group": template category, or add-in group.
  const setTemplateGroup = (catId, fn) => {
    setDraft((prev) => ({ ...prev, template: { ...prev.template, [catId]: fn(prev.template[catId] || {}) } }));
    setDirty((d) => ({ ...d, template: true }));
  };
  const setAddinGroup = (kind, key, fn) => {
    setDraft((prev) => ({ ...prev, addins: { ...prev.addins, [kind]: { ...prev.addins[kind], [key]: fn(prev.addins[kind]?.[key] || {}) } } }));
    setDirty((d) => ({ ...d, addins: true }));
  };
  const templateItem = (name) => ({ name, f: 1, e: false }); // user items: always included
  const addinItem = (name) => ({ name });

  const save = () => {
    if (dirty.template) setTemplate(draft.template);
    if (dirty.addins) setAddins(draft.addins);
    if (dirty.categories) setCategoryMeta?.(draft.categoryMeta);
    setDirty({ template: false, addins: false, categories: false });
    setFlash(true);
    setTimeout(() => setFlash(false), 1600);
  };
  const reset = () => {
    if (!confirm("Reset the packing template, its add-ins and the category names / emojis back to the built-in defaults?")) return;
    setTemplate(null);
    setAddins(null);
    setCategoryMeta?.({});
    setDraft({ template: coreDraft(), addins: defaultAddins(), categoryMeta: {} });
    setDirty({ template: false, addins: false, categories: false });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.cream, paddingBottom: 96 }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "rgba(253,248,240,.95)", backdropFilter: "blur(8px)",
        padding: "18px 20px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onExit} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ArrowLeft size={20} color={C.warmGray} />
        </button>
        <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal, flex: 1 }}>Packing Template</span>
        <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", cursor: "pointer",
          border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: "6px 12px", fontFamily: F.body, fontSize: 12,
          fontWeight: 500, color: C.warmGray }}>
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {/* Tabs */}
      <div style={{ margin: "16px 18px 0", padding: 4, borderRadius: 13, background: C.creamDark, display: "flex", gap: 4 }}>
        <TabBtn active={tab === "items"} onClick={() => setTab("items")}>Default items</TabBtn>
        <TabBtn active={tab === "addins"} onClick={() => setTab("addins")}>Add-ins</TabBtn>
      </div>

      {tab === "items" ? (
        <>
          <div style={{ padding: "20px 18px 8px" }}>
            <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, margin: 0 }}>Your default items</h2>
            <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginTop: 6, lineHeight: 1.5 }}>
              Add, rename, or remove the items every <strong>new</strong> trip starts with, pre-mark what needs a
              refill, a charge, or a wash, and drag the grips to put sections and items in the order you pack them.
              Tap a section name to rename it, or a category name / emoji to change those. Item and section changes
              only affect trips you create from now on; category names and emojis show everywhere right away.
              To pull a trip's edits back in here, open the trip and tap <strong>Save to template</strong>.
            </p>
          </div>
          <div style={{ padding: "8px 16px" }}>
            {editable.map((cat) => {
              const base = CATEGORIES.find((c) => c.id === cat.id);
              return (
                <GroupEditor key={cat.id} gid={`t-${cat.id}`} icon={cat.icon} title={cat.label} accent={cat.color || C.copper}
                  group={draft.template[cat.id] || {}} onChange={(fn) => setTemplateGroup(cat.id, fn)} newItem={templateItem}
                  emptyText="No items yet — add a section below."
                  meta={{ defaultLabel: base.label, defaultIcon: base.icon, overridden: isCategoryOverridden(draft.categoryMeta, cat.id),
                    onLabel: (v) => setCategory(cat.id, { label: v }), onIcon: (v) => setCategory(cat.id, { icon: v }), onReset: () => resetCategory(cat.id) }} />
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: "20px 18px 8px" }}>
            <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, margin: 0 }}>Add-ins</h2>
            <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginTop: 6, lineHeight: 1.5 }}>
              Items added <strong>on top of</strong> your default list when a new trip matches: by trip type, or by the
              weather — the temperature band the wizard finds, and rain or snow in the forecast (you can also tick those
              by hand on the weather step). New trips only, like everything here.
            </p>
          </div>
          <div style={{ padding: "0 16px" }}>
            <SubHeading>By trip type</SubHeading>
            {TYPE_KEYS.map((k) => (
              <GroupEditor key={k.id} gid={`a-${k.id}`} icon={k.icon} title={k.label} hint={`on every ${k.label} trip`} accent={k.color || C.copper}
                group={draft.addins.types?.[k.id] || {}} onChange={(fn) => setAddinGroup("types", k.id, fn)} newItem={addinItem}
                emptyText="Nothing extra for this trip type yet — add a section below." />
            ))}
            <SubHeading>By weather</SubHeading>
            {WEATHER_KEYS.map((k) => (
              <GroupEditor key={k.id} gid={`w-${k.id}`} icon={k.icon} title={k.label} hint={k.sub} accent={k.color || C.copper}
                group={draft.addins.weather?.[k.id] || {}} onChange={(fn) => setAddinGroup("weather", k.id, fn)} newItem={addinItem}
                emptyText="Nothing extra for this weather yet — add a section below." />
            ))}
          </div>
        </>
      )}

      {/* Save bar */}
      {(anyDirty || flash) && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 18px", zIndex: 20,
          background: "rgba(253,248,240,.96)", backdropFilter: "blur(8px)", borderTop: `1px solid ${C.borderLight}`,
          display: "flex", justifyContent: "center" }}>
          <button onClick={save} disabled={!anyDirty}
            style={{ width: "100%", maxWidth: 460, minHeight: 52, borderRadius: 14, border: "none",
              cursor: anyDirty ? "pointer" : "default",
              background: flash ? `linear-gradient(135deg,${C.sage},${C.sageLight})` : `linear-gradient(135deg,${C.copper},${C.copperLight})`,
              color: "#fff", fontFamily: F.body, fontSize: 16, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
              boxShadow: "0 2px 14px rgba(193,127,89,.3)" }}>
            {flash ? <><Check size={18} /> Saved</> : "Save template"}
          </button>
        </div>
      )}
    </div>
  );
}
