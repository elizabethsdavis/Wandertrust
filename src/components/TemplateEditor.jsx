import { useState } from "react";
import { ArrowLeft, X, RotateCcw, Check } from "lucide-react";
import { C, F } from "../lib/theme";
import { CATEGORIES } from "../data/taxonomy";
import { CORE } from "../data/catalog";

// ─────────────────────────────────────────────────────────────
// Packing Template editor.
//
// Lets the user customize the master catalog that seeds every NEW trip. Edits
// are stored (by the caller) under a single additive `catalogTemplate` key —
// `null` means "use the built-in CORE". genList() reads it at trip-creation
// time, so existing trips are never touched.
//
// The template mirrors CORE's shape: { categoryId: { section: [{name,f,e,ff}] } }.
// The "checkout" category (the Out-the-Door list) is edited separately, so it's
// excluded here.
// ─────────────────────────────────────────────────────────────

const clone = (o) => JSON.parse(JSON.stringify(o));

function coreDraft() {
  const d = clone(CORE);
  delete d.checkout;
  return d;
}

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

export default function TemplateEditor({ template, setTemplate, onExit }) {
  const [draft, setDraft] = useState(() => {
    const base = template ? clone(template) : coreDraft();
    delete base.checkout;
    return base;
  });
  const [dirty, setDirty] = useState(false);
  const [flash, setFlash] = useState(false);

  const editable = CATEGORIES.filter((c) => c.id !== "checkout");

  const mutate = (fn) => {
    setDraft((prev) => {
      const next = clone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const renameItem = (cat, sec, i, name) => mutate((d) => { d[cat][sec][i].name = name; });
  const removeItem = (cat, sec, i) =>
    mutate((d) => {
      d[cat][sec].splice(i, 1);
      if (d[cat][sec].length === 0) delete d[cat][sec];
    });
  const addItem = (cat, sec, name) =>
    mutate((d) => {
      if (!d[cat]) d[cat] = {};
      if (!d[cat][sec]) d[cat][sec] = [];
      d[cat][sec].push({ name, f: 1, e: false }); // user items: always included
    });
  const addSection = (cat, sec) =>
    mutate((d) => {
      if (!d[cat]) d[cat] = {};
      if (!d[cat][sec]) d[cat][sec] = [];
    });

  const save = () => {
    setTemplate(draft);
    setDirty(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 1600);
  };
  const reset = () => {
    if (!confirm("Reset the packing template back to the built-in defaults?")) return;
    setTemplate(null);
    setDraft(coreDraft());
    setDirty(false);
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

      <div style={{ padding: "20px 18px 8px" }}>
        <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, margin: 0 }}>Your default items</h2>
        <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginTop: 6, lineHeight: 1.5 }}>
          Add, rename, or remove the items every <strong>new</strong> trip starts with. Changes only affect trips you create
          from now on — existing lists stay as they are.
        </p>
      </div>

      {/* Categories */}
      <div style={{ padding: "8px 16px" }}>
        {editable.map((cat) => {
          const sections = draft[cat.id] || {};
          const accent = cat.color || C.copper;
          return (
            <div key={cat.id} style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px 6px" }}>
                <span style={{ fontSize: 18 }}>{cat.icon}</span>
                <span style={{ fontFamily: F.display, fontSize: 20, color: C.charcoal, fontWeight: 500 }}>{cat.label}</span>
              </div>
              <div style={{ background: C.warmWhite, borderRadius: 16, border: `1px solid ${C.borderLight}`, padding: "6px 0" }}>
                {Object.keys(sections).length === 0 && (
                  <div style={{ fontFamily: F.body, fontSize: 13, color: C.softGray, padding: "8px 16px" }}>
                    No items yet — add a section below.
                  </div>
                )}
                {Object.entries(sections).map(([sec, items]) => (
                  <div key={sec} style={{ marginBottom: 6 }}>
                    <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: ".08em", color: C.warmGray, padding: "8px 16px 4px" }}>{sec}</div>
                    {items.map((it, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 12px 2px 16px" }}>
                        <input
                          value={it.name}
                          onChange={(e) => renameItem(cat.id, sec, i, e.target.value)}
                          style={{ flex: 1, fontFamily: F.body, fontSize: 14, color: C.charcoal, padding: "8px 10px",
                            border: "1.5px solid transparent", borderRadius: 8, background: "transparent", outline: "none" }}
                          onFocus={(e) => { e.target.style.borderColor = C.borderMedium; e.target.style.background = C.cream; }}
                          onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
                        />
                        <button onClick={() => removeItem(cat.id, sec, i)} aria-label="Remove"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, flexShrink: 0 }}>
                          <X size={15} color={C.softGray} />
                        </button>
                      </div>
                    ))}
                    <AddRow placeholder={`Add to ${sec}…`} accent={accent} onAdd={(name) => addItem(cat.id, sec, name)} />
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${C.borderLight}`, marginTop: 4, paddingTop: 4 }}>
                  <AddRow placeholder="New section name…" accent={accent} onAdd={(name) => addSection(cat.id, name)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save bar */}
      {(dirty || flash) && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 18px",
          background: "rgba(253,248,240,.96)", backdropFilter: "blur(8px)", borderTop: `1px solid ${C.borderLight}`,
          display: "flex", justifyContent: "center" }}>
          <button onClick={save} disabled={!dirty}
            style={{ width: "100%", maxWidth: 460, minHeight: 52, borderRadius: 14, border: "none",
              cursor: dirty ? "pointer" : "default",
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
