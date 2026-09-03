// Export a trip's packing list as Markdown — the format that pastes cleanly into
// Claude (or any chat / notes app) and stays readable as plain text.
//
// Layout: one H2 per category (in the app's category order), one H3 per section
// (in the list's own order), GitHub-style task checkboxes, and the trip's
// Out-the-Door list at the end. Refill / charge / laundry flags ride along as
// short suffixes so the reader knows what still needs doing.
import { CATEGORIES } from "../data/taxonomy";

const flagText = (i) => {
  const f = [];
  if (i.needsRefill) f.push(i.refilled ? "refilled" : "needs refill");
  if (i.needsCharge) f.push(i.charged ? "charged" : "needs charge");
  if (i.needsWash) f.push(i.washed ? "clean" : "needs wash");
  if (i.essential && !i.packed) f.push("essential");
  if (i.ff && !i.packed) f.push("don't forget");
  return f.length ? ` — ${f.join(", ")}` : "";
};

const box = (done) => (done ? "- [x] " : "- [ ] ");

/** Human date like "Sep 3, 2026, 4:12 PM" (falls back gracefully in non-browser envs). */
function stamp(date = new Date()) {
  try {
    return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return date.toISOString();
  }
}

/**
 * tripToMarkdown(trip, opts) → string
 *   opts.otdItems   fallback Out-the-Door list when the trip has none
 *   opts.now        Date for the export stamp (tests pass a fixed one)
 */
export function tripToMarkdown(trip, opts = {}) {
  const items = Array.isArray(trip?.items) ? trip.items : [];
  const packed = items.filter((i) => i.packed).length;
  const lines = [];
  lines.push(`# ${trip.icon ? trip.icon + " " : ""}${trip.destination || "Trip"}`);
  const meta = [];
  if (trip.days) meta.push(`${trip.days} day${trip.days === 1 ? "" : "s"}`);
  if (Array.isArray(trip.tripType) && trip.tripType.length) meta.push(trip.tripType.join(" + "));
  if (trip.startDate) meta.push(`starts ${trip.startDate}`);
  meta.push(`${packed} of ${items.length} packed`);
  lines.push(meta.join(" · "));
  lines.push(`_Exported from PackPal ${stamp(opts.now)}_`);

  // Group by category (app order), then section (first-appearance order).
  const byCat = new Map();
  for (const i of items) {
    if (!byCat.has(i.category)) byCat.set(i.category, new Map());
    const secs = byCat.get(i.category);
    if (!secs.has(i.section)) secs.set(i.section, []);
    secs.get(i.section).push(i);
  }
  const order = CATEGORIES.map((c) => c.id).filter((id) => byCat.has(id));
  for (const id of byCat.keys()) if (!order.includes(id)) order.push(id); // unknown categories last
  for (const catId of order) {
    const cat = CATEGORIES.find((c) => c.id === catId);
    const secs = byCat.get(catId);
    const all = [...secs.values()].flat();
    const done = all.filter((i) => i.packed).length;
    lines.push("", `## ${cat?.icon ? cat.icon + " " : ""}${cat?.label || catId} (${done}/${all.length})`);
    for (const [sec, list] of secs) {
      lines.push("", `### ${sec}`);
      for (const i of list) lines.push(box(i.packed) + i.name + flagText(i));
    }
  }

  const otd = Array.isArray(trip.otdItems) ? trip.otdItems : Array.isArray(opts.otdItems) ? opts.otdItems : [];
  if (otd.length) {
    const checked = trip.otdChecked || {};
    const done = otd.filter((_, idx) => checked[idx]).length;
    lines.push("", `## 🚪 Out the Door (${done}/${otd.length})`, "");
    otd.forEach((o, idx) => lines.push(box(!!checked[idx]) + (o.emoji ? o.emoji + " " : "") + o.name));
  }
  return lines.join("\n") + "\n";
}

/** A safe file name for the download: "packpal-tokyo-2026-09-03.md". */
export function markdownFileName(trip, now = new Date()) {
  const slug = String(trip?.destination || "trip").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip";
  const d = now.toISOString().slice(0, 10);
  return `packpal-${slug}-${d}.md`;
}
