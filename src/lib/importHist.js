import { HIST_TRIPS } from "../data/history";

// Convert the app's 22 built-in historical lists (HIST_TRIPS) into real,
// editable trips matching PackPal's internal trip/item shape. Used by the
// one-time onboarding import.

const rid = () => Math.random().toString(36).slice(2, 11);

// Map a free-text historical section name onto one of PackPal's categories.
// The original section name is preserved on each item, so the trip view still
// groups items under their familiar headings (e.g. "Supplement Stack").
export function categoryForSection(section = "") {
  const s = section.toLowerCase();
  if (/(outfit|swim|dress|attire|clothes)/.test(s)) return "outfits";
  if (/(accessor|jewel)/.test(s)) return "outfits";
  if (/(active|workout|gym|hik|sport|run|cardio)/.test(s)) return "activewear";
  if (/(lounge|sleep|pajama|pyjama|cozy)/.test(s)) return "activewear";
  if (/(weather|outerwear|jacket|coat|cold)/.test(s)) return "activewear";
  if (/(device|tech|electronic|charger|camera|photo|gadget)/.test(s)) return "tech";
  if (/(skincare|cosmetic|makeup|beauty|hair|toiletr|fragrance|nail|grooming)/.test(s)) return "toiletries";
  if (/(supplement|vitamin|medic|meds|health|pharma|wellness)/.test(s)) return "toiletries";
  if (/(luggage|bag|nutrition|snack|food|document|misc)/.test(s)) return "necessities";
  return "necessities";
}

export function histToTrip(h) {
  const items = [];
  for (const [section, names] of Object.entries(h.sections || {})) {
    const category = categoryForSection(section);
    (names || []).forEach((name) => {
      items.push({
        id: rid(),
        name,
        section,
        category,
        packed: false,
        essential: false,
        ff: false,
        freq: 0,
        needsRefill: false,
        needsCharge: false,
      });
    });
  }
  return {
    id: rid(),
    destination: h.dest,
    tripType: h.type ? [h.type] : [],
    days: h.days || 4,
    weather: "warm",
    startDate: "",
    tempRange: "",
    items,
    otdItems: [], // seeded on demand by the app's Out-the-Door flow
    otdChecked: {},
    createdAt: new Date().toISOString(),
    icon: h.icon || "✈️",
    weatherData: null,
    imported: true,
  };
}

export function buildStarterTrips() {
  return HIST_TRIPS.map(histToTrip);
}

export const STARTER_COUNT = HIST_TRIPS.length;
