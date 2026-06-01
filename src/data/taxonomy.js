import { C } from "../lib/theme";

// Controlled vocabularies that classify a trip and its items. Colors come from
// the shared design tokens so the taxonomy stays visually consistent.

export const TRIP_TYPES = [
  { id: "city", label: "City Trip", icon: "🏙️", color: C.copper },
  { id: "beach", label: "Beach / Tropical", icon: "🏝️", color: "#4EADC5" },
  { id: "ski", label: "Ski / Snow", icon: "❄️", color: "#7BA3C9" },
  { id: "business", label: "Business / Offsite", icon: "💼", color: C.sage },
  { id: "festival", label: "Festival", icon: "🎪", color: "#C47EAA" },
  { id: "safari", label: "Safari / Adventure", icon: "🌍", color: "#B8944F" },
  { id: "roadtrip", label: "Road Trip", icon: "🚗", color: "#8B7355" },
  { id: "international", label: "International", icon: "✈️", color: C.copperLight },
];

export const TEMP_RANGES = [
  { id: "scorching", label: "Scorching", range: "95°F+", icon: "🔥", color: "#E85D3A" },
  { id: "hot", label: "Hot", range: "80–95°F", icon: "☀️", color: "#E8993A" },
  { id: "warm", label: "Warm", range: "65–80°F", icon: "🌤️", color: "#D4A04A" },
  { id: "cool", label: "Cool", range: "50–65°F", icon: "🍂", color: "#8BA888" },
  { id: "cold", label: "Cold", range: "32–50°F", icon: "🥶", color: "#7BA3C9" },
  { id: "freezing", label: "Freezing", range: "Below 32°F", icon: "🧊", color: "#5B8CC9" },
];

export const CATEGORIES = [
  { id: "outfits", label: "Explore Outfits", icon: "👗", color: C.copper },
  { id: "activewear", label: "Active & Chill", icon: "💪🏾", color: "#7BA3C9" },
  { id: "necessities", label: "Travel Necessities", icon: "⚙️", color: C.sage },
  { id: "tech", label: "Technology", icon: "📱", color: "#8B7355" },
  { id: "toiletries", label: "Toiletries", icon: "🧴", color: "#C47EAA" },
  { id: "checkout", label: "Out the Door", icon: "🚪", color: C.danger },
];
