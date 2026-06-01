// Shared design tokens for the auth / account / onboarding screens.
// Mirrors the palette defined inside PackPal.jsx so the new surfaces match
// the copper / sage / cream system without refactoring the main component.

export const C = {
  cream: "#FDF8F0", creamDark: "#F5EDE0", warmWhite: "#FEFCF9",
  copper: "#C17F59", copperLight: "#D4A574",
  copperGlow: "rgba(193,127,89,0.12)", copperSubtle: "rgba(193,127,89,0.06)",
  sage: "#8BA888", sageLight: "#A8C4A5", sageDark: "#6B8B68",
  sageGlow: "rgba(139,168,136,0.15)",
  charcoal: "#2D2926", warmGray: "#6B635B", softGray: "#9B9490",
  borderLight: "rgba(193,127,89,0.15)", borderMedium: "rgba(193,127,89,0.25)",
  shadow: "rgba(45,41,38,0.06)", shadowMed: "rgba(45,41,38,0.10)",
  danger: "#C75B5B", dangerGlow: "rgba(199,91,91,0.1)",
  amber: "#D4A04A", amberGlow: "rgba(212,160,74,0.12)",
  lavender: "#9B8EC4", lavenderGlow: "rgba(155,142,196,0.12)",
  teal: "#4EADC5", tealGlow: "rgba(78,173,197,0.12)",
};

export const F = {
  display: "'Cormorant Garamond','Playfair Display',Georgia,serif",
  body: "'DM Sans','Inter',-apple-system,sans-serif",
};

// A small, extensible set of country calling codes for the phone field.
export const COUNTRY_CODES = [
  { code: "+1", label: "🇺🇸 +1", name: "US / Canada" },
  { code: "+44", label: "🇬🇧 +44", name: "United Kingdom" },
  { code: "+61", label: "🇦🇺 +61", name: "Australia" },
  { code: "+33", label: "🇫🇷 +33", name: "France" },
  { code: "+49", label: "🇩🇪 +49", name: "Germany" },
  { code: "+34", label: "🇪🇸 +34", name: "Spain" },
  { code: "+39", label: "🇮🇹 +39", name: "Italy" },
  { code: "+81", label: "🇯🇵 +81", name: "Japan" },
  { code: "+82", label: "🇰🇷 +82", name: "South Korea" },
  { code: "+91", label: "🇮🇳 +91", name: "India" },
  { code: "+52", label: "🇲🇽 +52", name: "Mexico" },
  { code: "+55", label: "🇧🇷 +55", name: "Brazil" },
  { code: "+254", label: "🇰🇪 +254", name: "Kenya" },
  { code: "+971", label: "🇦🇪 +971", name: "UAE" },
];
