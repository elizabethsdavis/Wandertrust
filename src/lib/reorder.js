// Reordering helpers for the packing list. Order is nothing more than the order
// of `trip.items`: sections appear in order of their first item, categories in
// the app's fixed CATEGORIES order. So "move a section" and "move an item" are
// both just a rebuild of the items array — no new fields anywhere.
//
// Pure functions, no imports. Tested in node.

/** groups(items) → [{ category, sections: [{ name, items }] }] in first-appearance order. */
export function groupForArrange(items) {
  const cats = [];
  const byCat = new Map();
  for (const it of items || []) {
    if (!byCat.has(it.category)) {
      byCat.set(it.category, { category: it.category, sections: [], bySec: new Map() });
      cats.push(byCat.get(it.category));
    }
    const g = byCat.get(it.category);
    if (!g.bySec.has(it.section)) {
      g.bySec.set(it.section, { name: it.section, items: [] });
      g.sections.push(g.bySec.get(it.section));
    }
    g.bySec.get(it.section).items.push(it);
  }
  return cats.map(({ category, sections }) => ({ category, sections }));
}

/** Flatten groups back into an items array (categories and sections in the groups' order). */
export function flattenGroups(groups) {
  const out = [];
  for (const g of groups) for (const s of g.sections) out.push(...s.items);
  return out;
}

function move(arr, from, to) {
  const a = arr.slice();
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

/** Move section `sectionName` within `category` to index `toIndex` → new items array. */
export function moveSection(items, category, sectionName, toIndex) {
  const groups = groupForArrange(items);
  const g = groups.find((x) => x.category === category);
  if (!g) return items;
  const from = g.sections.findIndex((s) => s.name === sectionName);
  if (from < 0 || toIndex < 0 || toIndex >= g.sections.length || from === toIndex) return items;
  g.sections = move(g.sections, from, toIndex);
  return flattenGroups(groups);
}

/** Move item `itemId` within its section to index `toIndex` → new items array. */
export function moveItem(items, itemId, toIndex) {
  const groups = groupForArrange(items);
  for (const g of groups) {
    for (const s of g.sections) {
      const from = s.items.findIndex((i) => i.id === itemId);
      if (from < 0) continue;
      if (toIndex < 0 || toIndex >= s.items.length || from === toIndex) return items;
      s.items = move(s.items, from, toIndex);
      return flattenGroups(groups);
    }
  }
  return items;
}
