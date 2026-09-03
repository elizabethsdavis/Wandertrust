// Add-ins: the items added ON TOP of the packing template when a new trip
// matches a trip type (ski, beach, international, …) or the weather (a
// temperature band, or rain / snow in the forecast). Editable in the template
// editor's "Add-ins" tab.
//
// Persisted under the additive `addins` key (null = the built-in defaults):
//   { types:   { [tripTypeId]: { [section]: [item] } },
//     weather: { [tempBandId | "rain" | "snow"]: { [section]: [item] } } }
//   item = { name, e?, ff?, needsRefill?, needsCharge?, needsWash? }
// The built-in defaults are data/catalog.js COND_ITEMS for trip types and
// nothing for weather, so an account that never opens the editor generates
// exactly the lists it always did.
import { COND_ITEMS } from "../data/catalog";
import { TRIP_TYPES, TEMP_RANGES } from "../data/taxonomy";

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Forecast conditions a trip can carry in `trip.conditions` (additive field). */
export const CONDITIONS = [
  { id: "rain", label: "Rain expected", short: "Rain", icon: "🌧️", color: "#4EADC5" },
  { id: "snow", label: "Snow expected", short: "Snow", icon: "🌨️", color: "#7BA3C9" },
];

/** Every weather key the editor offers: the six temperature bands, then rain / snow. */
export const WEATHER_KEYS = [
  ...TEMP_RANGES.map((t) => ({ id: t.id, label: t.label, sub: t.range, icon: t.icon, color: t.color })),
  ...CONDITIONS.map((c) => ({ id: c.id, label: c.label, sub: "from the forecast", icon: c.icon, color: c.color })),
];

export const TYPE_KEYS = TRIP_TYPES.map((t) => ({ id: t.id, label: t.label, icon: t.icon, color: t.color }));

/** The built-in add-ins: COND_ITEMS as editable groups, no weather groups. */
export function defaultAddins() {
  const types = {};
  Object.entries(COND_ITEMS).forEach(([t, secs]) => {
    types[t] = {};
    Object.entries(secs).forEach(([sec, names]) => { types[t][sec] = names.map((name) => ({ name })); });
  });
  return { types, weather: {} };
}

/** A safe, editable copy: the stored add-ins (with missing halves filled in) or the defaults. */
export function addinsBase(addins) {
  if (!addins || typeof addins !== "object") return defaultAddins();
  const a = clone(addins);
  if (!a.types || typeof a.types !== "object") a.types = {};
  if (!a.weather || typeof a.weather !== "object") a.weather = {};
  return a;
}

/** Which category add-in items land in. Weather gear follows the history import (Active & Chill). */
export function addinCategory(kind, key) {
  if (kind === "weather") return "activewear";
  return key === "ski" || key === "beach" ? "activewear" : "necessities";
}

/**
 * addinItemsFor(addins, { tripTypes, tempRange, conditions }) → [{ name, category, section, e, ff, needsRefill, needsCharge, needsWash }]
 * Trip-type groups first (in the trip's type order), then the temperature band, then rain / snow.
 */
export function addinItemsFor(addins, { tripTypes = [], tempRange = "", conditions = [] } = {}) {
  const a = addinsBase(addins);
  const out = [];
  const push = (kind, key) => {
    const group = a[kind]?.[key];
    if (!group) return;
    Object.entries(group).forEach(([section, items]) => {
      (items || []).forEach((it) => {
        const name = typeof it === "string" ? it : it?.name;
        if (!name) return;
        const o = typeof it === "string" ? {} : it;
        out.push({ name, category: addinCategory(kind, key), section, e: !!o.e, ff: !!o.ff,
          needsRefill: !!o.needsRefill, needsCharge: !!o.needsCharge, needsWash: !!o.needsWash });
      });
    });
  };
  (Array.isArray(tripTypes) ? tripTypes : [tripTypes]).forEach((t) => push("types", t));
  if (tempRange) push("weather", tempRange);
  (Array.isArray(conditions) ? conditions : []).forEach((c) => push("weather", c));
  return out;
}

const RAIN = /rain|drizzle|shower|thunder|storm/i;
const SNOW = /snow|sleet|blizzard|flurr|ice pellets|freezing (rain|drizzle)/i;

/** ["rain", "snow"] (subset) from a wttr.in-style forecast; [] when nothing is known. */
export function detectConditions(weatherData) {
  const descs = [];
  if (weatherData?.current?.desc) descs.push(weatherData.current.desc);
  (weatherData?.forecast || []).forEach((d) => { if (d?.desc) descs.push(d.desc); });
  const text = descs.join(" | ");
  const out = [];
  if (RAIN.test(text)) out.push("rain");
  if (SNOW.test(text)) out.push("snow");
  return out;
}
