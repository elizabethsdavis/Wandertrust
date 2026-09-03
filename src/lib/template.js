// The packing template: the catalog every NEW trip is generated from. Stored
// under the additive `catalogTemplate` key (null = the built-in CORE). Template
// items are { name, f, e?, ff?, cond?, needsRefill?, needsCharge?, needsWash? } —
// the three flags are optional and additive; genList copies them onto items.
//
// This module holds the pure logic behind the editor and the "Update template
// from this trip" flow, so both can be tested in node.
import { CORE } from "../data/catalog";

const clone = (o) => JSON.parse(JSON.stringify(o));
const key = (s) => String(s || "").trim().toLowerCase();

/** A fresh editable draft: the stored template, or CORE without the OTD category. */
export function templateBase(template) {
  const d = template ? clone(template) : clone(CORE);
  delete d.checkout;
  return d;
}

/** The items genList would produce from `template` for this trip type + length (no ids). */
export function expectedTemplateItems(template, tripTypes, days) {
  const ts = Array.isArray(tripTypes) ? tripTypes : [tripTypes];
  const out = [];
  Object.entries(template || {}).forEach(([catId, sections]) => {
    if (catId === "checkout") return;
    Object.entries(sections || {}).forEach(([sec, arr]) => {
      (arr || []).forEach((it) => {
        if (it.cond && !it.cond.some((t) => ts.includes(t))) return;
        if (it.f >= 0.3 || (days > 5 && it.f >= 0.2)) out.push({ ...it, category: catId, section: sec });
      });
    });
  });
  return out;
}

export const FLAGS = ["needsRefill", "needsCharge", "needsWash"];
export const FLAG_LABELS = { needsRefill: "refill", needsCharge: "charge", needsWash: "laundry" };

/**
 * diffTripAgainstTemplate(trip, template) →
 *   { added: [{ id, name, category, section, flags }], removed: [{ id, name, category, section }],
 *     flagged: [{ id, name, category, section, flags }] }
 *  - added:   trip items (not outfits) whose name isn't in the template's category at all
 *  - removed: items the template WOULD have generated for this trip that the trip no longer has
 *  - flagged: trip items carrying a refill/charge/laundry flag the template item lacks
 * Each entry has a stable `id` for checkbox state.
 */
export function diffTripAgainstTemplate(trip, template) {
  const base = templateBase(template);
  const items = (trip?.items || []).filter((i) => i.category !== "outfits" && i.category !== "checkout");
  const inTemplate = new Map(); // "cat|name" → { section, item }
  Object.entries(base).forEach(([catId, sections]) =>
    Object.entries(sections || {}).forEach(([sec, arr]) => (arr || []).forEach((it) => inTemplate.set(`${catId}|${key(it.name)}`, { section: sec, item: it })))
  );
  const inTrip = new Map(items.map((i) => [`${i.category}|${key(i.name)}`, i]));

  const added = [], flagged = [];
  for (const i of items) {
    const k = `${i.category}|${key(i.name)}`;
    const t = inTemplate.get(k);
    const flags = Object.fromEntries(FLAGS.filter((f) => i[f]).map((f) => [f, true]));
    if (!t) {
      added.push({ id: `add|${k}`, name: i.name, category: i.category, section: i.section, flags });
    } else {
      const missing = FLAGS.filter((f) => i[f] && !t.item[f]);
      if (missing.length) flagged.push({ id: `flag|${k}`, name: i.name, category: i.category, section: t.section, flags: Object.fromEntries(missing.map((f) => [f, true])) });
    }
  }
  const removed = expectedTemplateItems(base, trip?.tripType || [], trip?.days || 0)
    .filter((it) => !inTrip.has(`${it.category}|${key(it.name)}`))
    .map((it) => ({ id: `rm|${it.category}|${key(it.name)}`, name: it.name, category: it.category, section: it.section }));
  return { added, removed, flagged };
}

/**
 * applyTemplateChanges(template, diff, selectedIds) → new template object.
 * Adds selected `added` entries (as always-included items, f: 1, with their flags),
 * deletes selected `removed` entries (dropping sections that become empty), and
 * sets the flags of selected `flagged` entries.
 */
export function applyTemplateChanges(template, diff, selectedIds) {
  const sel = new Set(selectedIds || []);
  const next = templateBase(template);
  for (const a of diff.added || []) {
    if (!sel.has(a.id)) continue;
    if (!next[a.category]) next[a.category] = {};
    if (!next[a.category][a.section]) next[a.category][a.section] = [];
    if (!next[a.category][a.section].some((it) => key(it.name) === key(a.name))) {
      next[a.category][a.section].push({ name: a.name, f: 1, e: false, ...a.flags });
    }
  }
  for (const r of diff.removed || []) {
    if (!sel.has(r.id)) continue;
    const arr = next[r.category]?.[r.section];
    if (!arr) continue;
    next[r.category][r.section] = arr.filter((it) => key(it.name) !== key(r.name));
    if (next[r.category][r.section].length === 0) delete next[r.category][r.section];
  }
  for (const f of diff.flagged || []) {
    if (!sel.has(f.id)) continue;
    const arr = next[f.category]?.[f.section];
    const it = arr?.find((x) => key(x.name) === key(f.name));
    if (it) Object.assign(it, f.flags);
  }
  return next;
}
