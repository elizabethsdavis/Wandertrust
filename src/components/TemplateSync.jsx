// "Save to template" — push a trip's edits back into the packing template.
// Shows three groups computed by lib/template.js: items you added to this trip,
// items the template would have generated that you removed, and refill / charge /
// laundry flags you set here that the template doesn't have yet. Tick what to
// keep, apply, done. Additions land as always-included items (f: 1).
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Plus, Minus, RefreshCw, BatteryCharging, WashingMachine } from "lucide-react";
import { C, F } from "../lib/theme";
import { CATEGORIES } from "../data/taxonomy";
import { diffTripAgainstTemplate, applyTemplateChanges, FLAG_LABELS } from "../lib/template";

const FLAG_ICON = { needsRefill: [RefreshCw, C.amber], needsCharge: [BatteryCharging, C.teal], needsWash: [WashingMachine, C.lavender] };
const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;

function Row({ entry, checked, onToggle, accent, Icon }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer",
      borderBottom: `1px solid ${C.borderLight}` }}>
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ width: 18, height: 18, accentColor: accent }} />
      <Icon size={14} color={accent} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: F.body, fontSize: 14, color: C.charcoal }}>{entry.name}</span>
        <span style={{ display: "block", fontFamily: F.body, fontSize: 11.5, color: C.softGray }}>
          {catLabel(entry.category)} · {entry.section}
          {entry.flags && Object.keys(entry.flags).length > 0 && (
            <> · {Object.keys(entry.flags).map((f) => FLAG_LABELS[f]).join(", ")}</>
          )}
        </span>
      </span>
      {entry.flags && Object.keys(entry.flags).map((f) => { const [I, col] = FLAG_ICON[f]; return <I key={f} size={13} color={col} />; })}
    </label>
  );
}

export function TemplateSync({ trip, template, onApply, onExit }) {
  const diff = useMemo(() => diffTripAgainstTemplate(trip, template), [trip, template]);
  // Additions and flags are pre-ticked; removals are opt-in (they change every future trip).
  const [selected, setSelected] = useState(() => new Set([...diff.added, ...diff.flagged].map((e) => e.id)));
  const [done, setDone] = useState(false);
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setGroup = (entries, on) => setSelected((s) => { const n = new Set(s); entries.forEach((e) => (on ? n.add(e.id) : n.delete(e.id))); return n; });
  const nothing = diff.added.length + diff.removed.length + diff.flagged.length === 0;
  const count = selected.size;

  const apply = () => {
    onApply(applyTemplateChanges(template, diff, [...selected]));
    setDone(true);
  };

  const Group = ({ title, hint, entries, accent, Icon }) => entries.length === 0 ? null : (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 8px 8px" }}>
        <span style={{ fontFamily: F.display, fontSize: 20, color: C.charcoal, fontWeight: 500 }}>{title}</span>
        <span style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, flex: 1 }}>{hint}</span>
        <button onClick={() => setGroup(entries, !entries.every((e) => selected.has(e.id)))}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.body, fontSize: 12, color: C.copper, padding: 0 }}>
          {entries.every((e) => selected.has(e.id)) ? "None" : "All"}
        </button>
      </div>
      <div style={{ background: C.warmWhite, borderRadius: 16, border: `1px solid ${C.borderLight}`, overflow: "hidden" }}>
        {entries.map((e) => <Row key={e.id} entry={e} checked={selected.has(e.id)} onToggle={() => toggle(e.id)} accent={accent} Icon={Icon} />)}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.cream, paddingBottom: 96 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "rgba(253,248,240,.95)", backdropFilter: "blur(8px)",
        padding: "18px 20px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onExit} aria-label="Back" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ArrowLeft size={20} color={C.warmGray} />
        </button>
        <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal, flex: 1 }}>Save to template</span>
      </div>

      <div style={{ padding: "20px 18px 8px" }}>
        <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, margin: 0 }}>
          {done ? "Template updated" : `From ${trip.destination}`}
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginTop: 6, lineHeight: 1.5 }}>
          {done
            ? "Every new trip will start with these changes. Existing trips are untouched."
            : nothing
              ? "This trip matches your template — nothing to save."
              : "Tick what every new trip should start with. Existing trips, including this one, are not changed."}
        </p>
      </div>

      {!done && (
        <div style={{ padding: "8px 16px" }}>
          <Group title="Added here" hint="not in the template yet" entries={diff.added} accent={C.sage} Icon={Plus} />
          <Group title="Flagged here" hint="refill / charge / laundry" entries={diff.flagged} accent={C.amber} Icon={Check} />
          <Group title="Removed here" hint="tick to drop from the template too" entries={diff.removed} accent={C.danger} Icon={Minus} />
        </div>
      )}

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 18px",
        background: "rgba(253,248,240,.96)", backdropFilter: "blur(8px)", borderTop: `1px solid ${C.borderLight}`,
        display: "flex", justifyContent: "center" }}>
        {done || nothing ? (
          <button onClick={onExit}
            style={{ width: "100%", maxWidth: 460, minHeight: 52, borderRadius: 14, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg,${C.sage},${C.sageLight})`, color: "#fff", fontFamily: F.body, fontSize: 16, fontWeight: 600 }}>
            Back to trip
          </button>
        ) : (
          <button onClick={apply} disabled={count === 0}
            style={{ width: "100%", maxWidth: 460, minHeight: 52, borderRadius: 14, border: "none", cursor: count ? "pointer" : "default",
              background: count ? `linear-gradient(135deg,${C.copper},${C.copperLight})` : C.creamDark, color: count ? "#fff" : C.softGray,
              fontFamily: F.body, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
            <Check size={18} /> Apply {count} change{count === 1 ? "" : "s"} to template
          </button>
        )}
      </div>
    </div>
  );
}
