import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Plus, Check, ChevronRight, Plane, Sparkles, ArrowLeft, X, AlertTriangle, Clock, PackageCheck, Zap, RotateCcw, Trash2, Copy, Award, TrendingUp, Brain, BarChart3, Timer, Shield, RefreshCw, Thermometer, Wind, CloudRain, Umbrella, Heart, Eye, Star, Loader, Shirt, Gem, Watch, Footprints, ShoppingBag, Palette, ChevronLeft, Sun, Moon as MoonIcon } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// PACKPAL v2 — Elizabeth's Personal Packing Intelligence
// ═══════════════════════════════════════════════════════════════

// ── Design Tokens ──
const C = {
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
const F = {
  display: "'Cormorant Garamond','Playfair Display',Georgia,serif",
  body: "'DM Sans','Inter',-apple-system,sans-serif",
};
const id = () => Math.random().toString(36).substr(2, 9);

// ── Trip Types ──
const TRIP_TYPES = [
  { id: "city", label: "City Trip", icon: "🏙️", color: C.copper },
  { id: "beach", label: "Beach / Tropical", icon: "🏝️", color: "#4EADC5" },
  { id: "ski", label: "Ski / Snow", icon: "❄️", color: "#7BA3C9" },
  { id: "business", label: "Business / Offsite", icon: "💼", color: C.sage },
  { id: "festival", label: "Festival", icon: "🎪", color: "#C47EAA" },
  { id: "safari", label: "Safari / Adventure", icon: "🌍", color: "#B8944F" },
  { id: "roadtrip", label: "Road Trip", icon: "🚗", color: "#8B7355" },
  { id: "international", label: "International", icon: "✈️", color: C.copperLight },
];

// ── Temperature Ranges ──
const TEMP_RANGES = [
  { id: "scorching", label: "Scorching", range: "95°F+", icon: "🔥", color: "#E85D3A" },
  { id: "hot", label: "Hot", range: "80–95°F", icon: "☀️", color: "#E8993A" },
  { id: "warm", label: "Warm", range: "65–80°F", icon: "🌤️", color: "#D4A04A" },
  { id: "cool", label: "Cool", range: "50–65°F", icon: "🍂", color: "#8BA888" },
  { id: "cold", label: "Cold", range: "32–50°F", icon: "🥶", color: "#7BA3C9" },
  { id: "freezing", label: "Freezing", range: "Below 32°F", icon: "🧊", color: "#5B8CC9" },
];

// ── Temperature-Based Recommendations ──
const TEMP_RECS = {
  scorching: [
    { name: "Ultra-lightweight linen/cotton clothes", why: "Maximum airflow in extreme heat" },
    { name: "Wide-brimmed sun hat", why: "Protects face, ears, neck from UV" },
    { name: "SPF 50+ mineral sunscreen", why: "Essential for intense UV exposure" },
    { name: "Cooling towel or bandana", why: "Dampen to cool down quickly" },
    { name: "Moisture-wicking underwear", why: "Prevents chafing in extreme heat" },
    { name: "Electrolyte packets (extra)", why: "Replace sodium lost through sweat" },
    { name: "Portable fan (rechargeable)", why: "Personal cooling on the go" },
    { name: "Light-colored breathable sneakers", why: "Dark shoes absorb and trap heat" },
  ],
  hot: [
    { name: "Short-sleeve cotton/linen shirts", why: "Breathable natural fibers wick sweat" },
    { name: "Lightweight shorts or capris", why: "Leg airflow + sun protection" },
    { name: "Thin cardigan for AC indoors", why: "Indoor spaces often over-air-conditioned" },
    { name: "SPF 30-50 sunscreen + SPF lip balm", why: "Consistent UV protection" },
    { name: "Breathable mesh sneakers", why: "Airflow prevents overheating feet" },
    { name: "Moisture-wicking socks", why: "Keeps feet dry during activities" },
  ],
  warm: [
    { name: "Light layering pieces", why: "Morning/evening temp swings" },
    { name: "Light jacket or denim jacket", why: "Essential for cooler evenings" },
    { name: "Comfortable jeans or casual pants", why: "Versatile for variable weather" },
    { name: "Lightweight scarf", why: "Adds warmth + dresses up outfits" },
    { name: "SPF 30 sunscreen", why: "UV protection even on mild days" },
  ],
  cool: [
    { name: "Fleece or wool sweaters", why: "Significant warmth without bulk" },
    { name: "Medium-weight jacket (water-resistant)", why: "Protection from wind + rain" },
    { name: "Warm socks (wool blend)", why: "Temperature regulation for feet" },
    { name: "Light gloves", why: "Hands are very temperature-sensitive" },
    { name: "Warm base layer shirt", why: "Merino wool under main layer" },
    { name: "Closed-toe insulated shoes", why: "Avoid mesh/breathable in cool weather" },
  ],
  cold: [
    { name: "Insulated winter coat", why: "Windproof outer shell essential" },
    { name: "Thermal base layers (top + bottom)", why: "Crucial layering foundation" },
    { name: "Winter gloves or mittens", why: "Thermal lining prevents numbness" },
    { name: "Warm beanie or winter hat", why: "Significant heat lost through head" },
    { name: "Thick wool or thermal socks", why: "Prevents cold feet + frostbite risk" },
    { name: "Waterproof insulated boots", why: "Protection from snow, ice, puddles" },
    { name: "Heavy scarf or neck gaiter", why: "Protects face + neck from wind" },
    { name: "Heavier moisturizer + lip balm", why: "Cold air strips skin moisture" },
  ],
  freezing: [
    { name: "Heavy insulated parka (down/synthetic)", why: "Rated for extreme cold essential" },
    { name: "Multiple thermal base layers", why: "Double up for serious insulation" },
    { name: "Insulated waterproof snow pants", why: "Windproof with thermal lining" },
    { name: "Extreme-weather mittens with liners", why: "Mittens warmer than gloves" },
    { name: "Insulated boots rated for extreme cold", why: "Look for -20°F rating minimum" },
    { name: "Balaclava or full face protection", why: "Prevents frostbite on exposed skin" },
    { name: "Hand & toe warmers (chemical)", why: "Crucial backup heat source" },
    { name: "Heavy-duty moisturizer + lip balm", why: "Freezing air extremely drying" },
  ],
};

// ── Trip-Type Smart Recommendations (from research) ──
const SMART_RECS = {
  festival: [
    { name: "Electrolyte packets (extra)", why: "Replace sodium lost through desert heat and dancing" },
    { name: "Bandana or headwrap", why: "Shields from dust between stages" },
    { name: "Extra portable power bank", why: "Phone drains fast with music/navigation/photos" },
    { name: "Wet wipes (large pack)", why: "Essential hygiene at festival restrooms" },
    { name: "Body glitter / face gems", why: "Festival fashion that makes friends" },
    { name: "Dry shampoo", why: "Refreshes hair during multi-day events" },
    { name: "Lightweight long-sleeve layer", why: "Desert nights drop dramatically after sunset" },
    { name: "Rain poncho (compact)", why: "Weather can shift unexpectedly at outdoor events" },
    { name: "Comfortable broken-in boots", why: "Miles of walking on uneven terrain" },
    { name: "Earplugs (concert-grade)", why: "Protect hearing at loud stages, enable sleep" },
  ],
  beach: [
    { name: "Reef-safe mineral sunscreen", why: "Protects coral and marine life" },
    { name: "Waterproof phone pouch", why: "Keeps device dry during water activities" },
    { name: "After-sun aloe vera gel", why: "Soothes inevitable sunburns quickly" },
    { name: "Sand-free microfiber towel", why: "Dries 5x faster, shakes off sand easily" },
    { name: "Mosquito repellent", why: "Prevents bites near tropical water" },
    { name: "Quick-dry swimsuit cover-up", why: "Transition beach to restaurant easily" },
    { name: "Waterproof bag for valuables", why: "Protects items from sand and salt" },
    { name: "Rashguard or swim shirt", why: "UV protection while in water" },
    { name: "Snorkel gear (if not provided)", why: "Personal gear is more hygienic" },
  ],
  ski: [
    { name: "Lip balm with SPF 30+", why: "Altitude + sun + wind = chapped lips fast" },
    { name: "Extra hand warmers (bulk)", why: "Crucial warmth on cold chairlift rides" },
    { name: "Goggle anti-fog spray", why: "Prevents vision-blocking condensation on slopes" },
    { name: "Merino wool base layers", why: "Moisture-wicking, odor-resistant, not cotton" },
    { name: "Thermal neck gaiter", why: "Covers face and neck from windchill" },
    { name: "Insulated water bottle", why: "Keeps drinks from freezing at altitude" },
    { name: "Saline nasal spray", why: "Combats dry sinuses from altitude + heating" },
    { name: "Boot dryer bags", why: "Dries boots overnight for next morning" },
  ],
  international: [
    { name: "Universal power adapter", why: "Works across multiple outlet types worldwide" },
    { name: "Voltage converter (if needed)", why: "Essential for single-voltage hair tools" },
    { name: "Photocopies of passport", why: "Carry separately for emergencies" },
    { name: "Travel insurance card/info", why: "Medical emergencies abroad need coverage" },
    { name: "Local eSIM or SIM card plan", why: "Cheap data + local number abroad" },
    { name: "Emergency contact card (printed)", why: "Backup if phone dies overseas" },
    { name: "Small bills in local currency", why: "Tips and small purchases on arrival" },
    { name: "Translation app downloaded offline", why: "Works without data connection" },
  ],
  business: [
    { name: "Portable garment steamer", why: "Removes wrinkles without hotel iron" },
    { name: "Stain remover pen", why: "Addresses coffee spills before they set" },
    { name: "Backup outfit in carry-on", why: "Handles luggage delays gracefully" },
    { name: "Presentation clicker/remote", why: "Move freely while presenting" },
    { name: "USB drive with backup files", why: "Redundancy if laptop fails" },
    { name: "Professional blazer", why: "Dresses up casual clothes for meetings" },
    { name: "Laptop stand or riser", why: "Ergonomics during all-day sessions" },
    { name: "Business cards", why: "Share contact info quickly at networking" },
  ],
  safari: [
    { name: "Binoculars (8x42)", why: "Essential for wildlife viewing at distance" },
    { name: "Quick-dry synthetic clothing", why: "Resists odor, dries fast with limited luggage" },
    { name: "Headlamp with red-light mode", why: "Night movement without disturbing wildlife" },
    { name: "Water purification tablets", why: "Safe drinking water anywhere" },
    { name: "Dust covers for camera", why: "Protects gear in arid/sandy conditions" },
    { name: "Extra memory cards + batteries", why: "Don't miss crucial wildlife moments" },
    { name: "Lightweight day pack", why: "Carries water, sun gear, and camera" },
    { name: "Neutral-colored clothing", why: "Avoids startling animals with bright colors" },
  ],
  roadtrip: [
    { name: "Car phone mount", why: "Safe navigation without handheld distraction" },
    { name: "Aux/USB-C audio cable", why: "Stream music to car audio system" },
    { name: "Compact cooler bag", why: "Cold drinks and snacks without gas station stops" },
    { name: "Emergency car kit", why: "Jumper cables, flashlight, first aid" },
    { name: "Travel pillow + blanket", why: "Passenger comfort on long stretches" },
    { name: "Rest stop refresh kit", why: "Face wipes, dry shampoo, deodorant" },
    { name: "Reusable bags for groceries", why: "Stocking up at local stores along the way" },
  ],
  city: [
    { name: "Comfortable broken-in walking shoes", why: "10+ mile urban exploration days" },
    { name: "Crossbody anti-theft bag", why: "Deters pickpockets in crowded areas" },
    { name: "Compact umbrella", why: "City weather shifts without warning" },
    { name: "Transit card or contactless app", why: "Skip individual ticket lines" },
    { name: "Collapsible water bottle", why: "Refill at fountains, shrinks when empty" },
    { name: "Lightweight scarf or wrap", why: "Covers shoulders for religious sites" },
    { name: "Portable phone charger", why: "Navigation + photos drain battery fast" },
  ],
};

// ── Categories ──
const CATEGORIES = [
  { id: "outfits", label: "Explore Outfits", icon: "👗", color: C.copper },
  { id: "activewear", label: "Active & Chill", icon: "💪🏾", color: "#7BA3C9" },
  { id: "necessities", label: "Travel Necessities", icon: "⚙️", color: C.sage },
  { id: "tech", label: "Technology", icon: "📱", color: "#8B7355" },
  { id: "toiletries", label: "Toiletries", icon: "🧴", color: "#C47EAA" },
  { id: "checkout", label: "Out the Door", icon: "🚪", color: C.danger },
];

// ── Core Packing Data (from 22 trips) ──
const CORE = {
  necessities: {
    "Luggage": [
      { name: "Away Everywhere Bag", f: 1.0, e: true },
      { name: "Away Checked Bag", f: 0.95, e: true },
      { name: "Longchamp Purse", f: 0.9, e: true },
      { name: "AirTags for Luggage", f: 0.9, e: true },
      { name: "Luggage scale", f: 0.7 },
    ],
    "Important Documents": [
      { name: "Driver's License", f: 1.0, e: true },
      { name: "Chase Credit Card", f: 1.0, e: true },
      { name: "Keys", f: 0.95, e: true },
      { name: "Chase Debit Card", f: 0.8 },
      { name: "$200 Cash", f: 0.8 },
      { name: "Passport", f: 0.7, cond: ["international", "beach"] },
      { name: "Corporate badge", f: 0.6, cond: ["business"] },
      { name: "Boarding Passes", f: 0.6 },
    ],
    "Flight Comfort": [
      { name: "Neck Brace", f: 0.95, e: true },
      { name: "Eye Masks", f: 0.95, e: true },
      { name: "Comfy compression socks", f: 0.85 },
      { name: "Skincare Masks", f: 0.8 },
    ],
    "Hydration": [
      { name: "Water Bottle", f: 0.95, e: true },
      { name: "Liquid IV", f: 0.95, e: true },
    ],
    "Nutrition": [
      { name: "Protein bars", f: 0.85 },
      { name: "Bag of almonds", f: 0.3 },
    ],
    "Supplement Stack": [
      { name: "Women's daily multivitamins", f: 0.95, e: true },
      { name: "Iron supplements", f: 0.95, e: true },
      { name: "Vitamin C supplements", f: 0.95, e: true },
      { name: "Magnesium supplement", f: 0.95, e: true },
      { name: "Probiotic supplement", f: 0.9, e: true },
      { name: "Cravings supplement", f: 0.85 },
      { name: "Metabolism supplement", f: 0.85 },
    ],
    "Energy: Sleep & Wake": [
      { name: "Caffeine pills", f: 0.9, e: true },
      { name: "Melatonin", f: 0.75 },
      { name: "Vitamin B12 supplement", f: 0.75 },
    ],
    "Pain & Sickness": [
      { name: "Advil", f: 0.95, e: true },
      { name: "Tylenol", f: 0.9, e: true },
      { name: "DayQuil/NyQuil", f: 0.3, cond: ["international"] },
      { name: "Diarrhea medicine", f: 0.25, cond: ["international"] },
      { name: "Benadryl", f: 0.2 },
    ],
    "Hygiene & Immune": [
      { name: "Hand sanitizer spray", f: 0.9 },
      { name: "Tissue", f: 0.5 },
    ],
    "Smell Management": [
      { name: "Laundry Bag", f: 0.9, e: true },
      { name: "Tampons", f: 0.7 },
      { name: "Panty liners", f: 0.5 },
    ],
    "Eyewear": [
      { name: "Contacts (6+ pairs)", f: 0.95, e: true },
      { name: "Glasses", f: 0.95, e: true },
      { name: "Eyeglasses cleaner", f: 0.9 },
    ],
    "Hair Supplies": [
      { name: "Satin Pillowcase", f: 0.95, e: true, ff: true },
      { name: "Satin Bonnet", f: 0.9, e: true, ff: true },
      { name: "Hair Stockings", f: 0.85, ff: true },
      { name: "Hair Ties", f: 0.8, ff: true },
    ],
  },
  tech: {
    "Devices": [
      { name: "iPhone", f: 1.0, e: true },
      { name: "Apple Watch", f: 0.95, e: true },
      { name: "AirPods", f: 0.95, e: true },
      { name: "AirPod Max", f: 0.9 },
      { name: "Laptop", f: 0.9 },
      { name: "iPad", f: 0.8 },
      { name: "Kindle", f: 0.85 },
      { name: "PDA", f: 0.7 },
      { name: "Loop Earplugs", f: 0.6 },
    ],
    "Photography": [
      { name: "Fujifilm X100VI Camera", f: 0.4, cond: ["beach", "international", "safari"] },
      { name: "Mini Phone Mount", f: 0.4 },
      { name: "Large Phone Tripod", f: 0.35 },
      { name: "GoPro", f: 0.25, cond: ["beach", "safari", "festival"] },
    ],
    "Cables": [
      { name: "USB-C to Lightning (2)", f: 0.95, e: true },
      { name: "USB-C to USB-C (1)", f: 0.9, e: true },
      { name: "USB to Apple Watch (1)", f: 0.9, e: true },
      { name: "USB to PDA", f: 0.7 },
      { name: "USB to Micro-USB (1)", f: 0.6 },
    ],
    "Power Blocks": [
      { name: "Small USB-C (2)", f: 0.95, e: true },
      { name: "Large USB-C (1)", f: 0.9, e: true },
      { name: "USB (2)", f: 0.85 },
    ],
    "Power & Misc": [
      { name: "Wireless Charging Power Bank", f: 0.9, e: true },
      { name: "Power Bank", f: 0.85 },
      { name: "Vanity Mirror", f: 0.8 },
    ],
    "Downloads & Setup": [
      { name: "Movie downloads", f: 0.85 },
      { name: "TV downloads", f: 0.85 },
      { name: "Song downloads", f: 0.8 },
      { name: "Podcast downloads", f: 0.8 },
      { name: "Book downloads", f: 0.8 },
      { name: "Google Maps offline map", f: 0.4, cond: ["international"] },
      { name: "CBP app setup", f: 0.3, cond: ["international"] },
    ],
  },
  toiletries: {
    "Body Care": [
      { name: "Deodorant", f: 1.0, e: true },
      { name: "Body Wash", f: 0.95, e: true },
      { name: "Shampoo", f: 0.95, e: true },
      { name: "Lotion", f: 0.95, e: true },
      { name: "Body Spray", f: 0.9 },
      { name: "Loofah", f: 0.85 },
    ],
    "Dental": [
      { name: "Toothbrush", f: 1.0, e: true },
      { name: "Toothpaste", f: 1.0, e: true },
    ],
    "Hair Products": [
      { name: "Edge control", f: 0.7, ff: true },
      { name: "Regular brush", f: 0.6, ff: true },
      { name: "Hair mousse", f: 0.6, ff: true },
      { name: "Hair conditioner", f: 0.5, ff: true },
      { name: "Hair shampoo", f: 0.5, ff: true },
      { name: "Edge control mini brush", f: 0.5, ff: true },
    ],
    "Daytime Skincare": [
      { name: "Foaming cleanser", f: 0.7 },
      { name: "Micellar cleansing water", f: 0.65 },
      { name: "Vitamin-C brightening serum", f: 0.6 },
      { name: "Niacinamide + tranexamic acid serum", f: 0.55 },
      { name: "Moisturizing sunscreen", f: 0.65, e: true },
      { name: "Pantothenic B5 soothing cream", f: 0.55 },
      { name: "Brow freeze", f: 0.85 },
      { name: "Brow brush", f: 0.85 },
      { name: "Lip Balm", f: 0.9, e: true },
      { name: "Disposable face towels", f: 0.45 },
      { name: "Exfoliating pore pads", f: 0.5 },
    ],
    "Nighttime Skincare": [
      { name: "Lip Mask", f: 0.85, e: true },
      { name: "Pimple patches", f: 0.8 },
      { name: "Hydro soothing cream", f: 0.55 },
      { name: "Good Genes Serum", f: 0.45 },
      { name: "Makeup wipes", f: 0.5 },
      { name: "Exfoliating pore pads", f: 0.45 },
      { name: "Glycolic acid serum", f: 0.4 },
      { name: "Retinol emulsion serum", f: 0.35 },
    ],
    "Cosmetics": [
      { name: "Concealer (Fenty 420)", f: 0.95, e: true },
      { name: "Mascara", f: 0.95, e: true },
      { name: "Setting Spray", f: 0.9, e: true },
      { name: "Blush", f: 0.9 },
      { name: "Eyeshadow", f: 0.85 },
      { name: "Freckle pen", f: 0.8 },
      { name: "Brow Brush (Black)", f: 0.85 },
      { name: "Lip oil", f: 0.6 },
      { name: "Lip Gloss", f: 0.4 },
      { name: "Beauty Blender", f: 0.85 },
      { name: "Travel Brush Kit", f: 0.85 },
    ],
  },
  activewear: {
    "Underwear & Socks": [
      { name: "Underwear", f: 1.0, e: true },
      { name: "Socks", f: 1.0, e: true },
    ],
  },
  checkout: {
    "Out the Door": [
      { name: "Phone", f: 1.0, e: true },
      { name: "AirPods", f: 0.95, e: true },
      { name: "Laptop", f: 0.9 },
      { name: "Keys", f: 0.95, e: true },
      { name: "Passport", f: 0.7, cond: ["international"] },
      { name: "Driver's License", f: 0.95, e: true },
      { name: "Credit Card", f: 0.95, e: true },
      { name: "Work badge", f: 0.5, cond: ["business"] },
    ],
  },
};

// ── Conditional (Ski, Beach, etc.) ──
const COND_ITEMS = {
  ski: {
    "Ski Outfits": [
      "Heattech Top (2)", "Heattech Bottom (2)", "Ski Pants (2)", "Ski Jacket",
      "Ski Technical Layer Bottom", "Ski Technical Layer Top",
    ],
    "Ski Accessories": ["Ski Socks (2)", "Ski Gloves", "Ski Beanie", "Ski Goggles"],
    "Ski Technology": ["Heated Sock Batteries", "Digital Hand Warmers", "Heated Socks", "Hand Warmers"],
    "Cold Weather Gear": ["Black beanie", "White beanie", "White gloves", "Black gloves", "Scarf"],
  },
  beach: {
    "Swimwear": ["Bikini #1", "Bikini #2"],
    "Sun Protection": ["Sun hat", "Aloe cream"],
  },
  international: {
    "International Prep": ["Waterproof passport case", "Local ride app download"],
  },
  safari: {
    "Safari Essentials": ["Bug spray", "Itch recovery cream", "Sun hat", "Portable fan"],
  },
};

// ── Freak Out Mode: ADHD Paralysis Protocol ──
const UNFREEZE_STEPS = [
  {
    title: "Breathe first",
    icon: "🫁",
    body: "You're frozen right now, and that's completely okay — your brain isn't broken, it's just overwhelmed. Place your feet flat on the floor. Take three slow breaths where your exhale is longer than your inhale (in for 4, out for 6). This tells your body \"we're safe right now.\"",
    duration: "2 min",
  },
  {
    title: "Ground yourself",
    icon: "🌿",
    body: "Look around and name 5 things you can see. Touch something near you and notice its texture. Listen for 2 sounds. This helps your brain come back to the present instead of spinning in overwhelm.",
    duration: "2 min",
  },
  {
    title: "Permission slip",
    icon: "💌",
    body: "This packing doesn't need to be perfect. It can be messy, chaotic, \"throw things in a bag\" energy. Give yourself explicit permission to pack in the least organized way possible. Perfection is a paralysis trap.",
    duration: "30 sec",
  },
  {
    title: "One tiny thing",
    icon: "🧦",
    body: "Don't think about packing everything. Pick ONE small item — a pair of socks, your phone charger, one shirt. Go get it. Place it near your bag. This is your first domino. It feels impossibly small, and that's exactly why it works.",
    duration: "1 min",
  },
  {
    title: "Activate your senses",
    icon: "🎵",
    body: "Put on a song you actually like — not a \"focusing\" playlist, but something that makes you want to move. Grab a drink you enjoy. Light a candle. You're giving your dopamine system what it needs to keep going.",
    duration: "1 min",
  },
  {
    title: "Build to two",
    icon: "✌️",
    body: "After that first item, grab one more. Two items isn't \"started packing\" but it IS momentum. You've proven to your brain that you can move. That's huge.",
    duration: "2 min",
  },
  {
    title: "Set a timer, then stop (or don't)",
    icon: "⏱️",
    body: "Set a timer for 10 minutes and pack during that time. When it goes off, you're done — guilt-free. Even if you've only packed 10 things. You unstuck yourself. That's the win. Keep going only if you want to.",
    duration: "10 min",
  },
];

const AFFIRMATIONS = [
  "My brain is being my brain right now — not lazy, not broken, just dysregulated.",
  "I don't have to see the whole staircase to take the first step.",
  "Starting imperfectly beats planning perfectly.",
  "Frozen doesn't mean failing. It means my brain needs a reset.",
  "I'm allowed to do this the weird way, the slow way, the messy way.",
  "One tiny thing is enough right now.",
  "My activation energy is just higher than other people's. That's neurological, not personal.",
  "I can do hard things. Right now I'm just doing small things first.",
  "This freeze is temporary. My brain can shift — it just needs the right conditions.",
  "My nervous system is trying to protect me. That's not weakness.",
];

// ── Viewable Historical Trips ──
const HIST_TRIPS = [
  { dest: "Thailand", dates: "Dec 7–15", days: 9, type: "international", icon: "🇹🇭",
    sections: {
      "Accessories": ["Gold Necklaces (3)", "Gold Bracelets (3)", "Gucci Sunglasses", "Rose Gold Sunglasses", "Gold Eyeglasses"],
      "Activewear": ["Hiking boots", "Mini hiking backpack", "Pink running shoes"],
      "Loungewear": ["Gold Birkenstocks"],
      "Luggage": ["Away Everywhere Bag", "Away Checked Bag", "Longchamp Purse", "Luggage scale", "AirTags for Luggage"],
      "Supplement Stack": ["Probiotic supplement", "Metabolism supplement", "Cravings supplement", "Magnesium supplement", "Iron supplements", "Vitamin C supplements", "Women's daily multivitamins"],
      "Devices": ["Laptop", "Chromecast", "Loop Earplugs", "PDA", "Kindle", "Apple Watch", "AirPod Max", "AirPods", "iPad", "iPhone", "GoPro"],
      "Skincare": ["Glow screen", "Lip Balm", "Facial Oil", "Hydrating Toner", "Facial Cleanser", "Cleansing oil", "Sunscreen", "Brow brush", "Brow freeze", "Rice + alpha-arbutin serum", "Vitamin C Serum", "Pimple patches", "Retinol emulsion serum", "Lip Mask", "Glycolic acid", "Hyaluronic acid", "Hydrating Mask", "Good Genes Serum"],
      "Cosmetics": ["Brow Brush (Black)", "Lip Balm", "Lip Gloss", "Setting Spray", "Mascara", "Eyeshadow", "Freckle pen", "Blush", "Foundation stick", "Concealer (Fenty 420)", "Beauty Blender", "Travel Brush Kit"],
    }
  },
  { dest: "Bora Bora", dates: "Oct 17–21", days: 5, type: "beach", icon: "🏝️",
    sections: {
      "Outfits": ["Turquoise Diarrablu set", "White lace bralette + flowy pants", "Navy cashmere tank + ombré pants", "Rose gold dress (photoshoot)", "Pink travel set"],
      "Accessories": ["Gold & sparkly necklaces", "Gold & sparkly bracelets", "Leather flip flops", "Gold clutch", "Fawn Longchamp", "Artsy Sunglasses"],
      "Swimwear": ["Pink bikini", "Teal bikini"],
      "Photography": ["Fujifilm X100VI Camera", "Camera Battery Charger", "GoPro", "Mini Phone Mount", "Large Phone Tripod"],
      "Skincare": ["Moisturizing sunscreen", "B5 soothing cream", "Vitamin-C serum", "Niacinamide serum", "Foaming cleanser", "Micellar water", "Lip Mask", "Pimple patches", "Good Genes serum", "Makeup wipes"],
    }
  },
  { dest: "Morocco", dates: "Dec 29–Jan 7", days: 10, type: "international", icon: "🕌",
    sections: {
      "Outfits": ["Turquoise Diarrablu set", "Pink jogger set", "White tank top"],
      "Accessories": ["Gold bracelets", "Sparkly bracelets", "Brown leather sandals", "Artsy Sunglasses", "White fanny pack", "Brown leather bag"],
      "Nutrition": ["Trail mix", "Low sugar sweets", "Protein bars", "Healthy jerky"],
      "Weather Gear": ["Hand warmers", "Umbrella", "White beanie", "White gloves", "Black gloves", "Black beanie"],
      "Photography": ["Fujifilm X100VI Camera", "Camera Battery Charger", "Head Lamp", "Large Camera Tripod"],
    }
  },
  { dest: "Seoul", dates: "Mar 3–10", days: 8, type: "international", icon: "🇰🇷",
    sections: {
      "Outfits": ["Black HeatTech long-sleeve", "Zevelyn Jean pants", "Black beanie", "Black boots", "Black puffer"],
      "Accessories": ["Gold Necklaces (3)", "Gold Bracelets (3)", "Gucci Sunglasses", "Rose Gold Sunglasses"],
      "Hiking Gear": ["Hiking boots", "Mini hiking backpack", "Pink running shoes"],
      "Photography": ["GoPro", "Phone camera cleaner", "Phone Case with Magnet", "Mini Phone Mount"],
    }
  },
  { dest: "Mammoth", dates: "Jan 9–11", days: 3, type: "ski", icon: "❄️",
    sections: {
      "Ski Outfits": ["Heattech Top (2)", "Heattech Bottom (2)", "Ski Pants (2)", "Ski Jacket", "Ski Technical Layers"],
      "Ski Accessories": ["Ski Socks (2)", "Ski Gloves", "Ski Beanie", "Ski Goggles"],
      "Ski Tech": ["Heated Sock Batteries", "Digital Hand Warmers", "Heated Socks", "Hand Warmers"],
      "Cold Weather": ["Black beanie", "White beanie", "White gloves", "Scarf"],
      "Swimwear": ["Lavender bikini"],
      "Photography": ["Fujifilm X100VI Camera", "Camera Battery Charger", "Camera Wide Angle Lens"],
    }
  },
  { dest: "Big Bear", dates: "Dec 22–24", days: 3, type: "ski", icon: "🏔️",
    sections: { "Ski Gear": ["Heattech layers", "Ski pants", "Ski jacket", "Ski accessories", "Snow boots"], }
  },
  { dest: "New York", dates: "Jun 2–5", days: 4, type: "business", icon: "🏙️",
    sections: {
      "Outfits": ["Cream & white flowy pants + cashmere top", "Flowy sheer pants + cashmere", "Cream contour top + linen pants", "Brown belt", "Cream crew neck + blue yoga set (travel)"],
      "Accessories": ["Brown sandals", "Gold sandals", "Cream tote bag", "Black Longchamp"],
      "Activewear": ["Peloton set", "Green yoga set", "Pink yoga set"],
      "Loungewear": ["AKA pajama pants", "Pink Nike set"],
      "Hair": ["Edge control", "Hair mousse", "Edge control mini brush", "Satin Durag"],
    }
  },
  { dest: "San Francisco", dates: "Various", days: 4, type: "business", icon: "🌉",
    sections: { "Business": ["Corporate badge", "Brex card", "Business casual outfits"], }
  },
  { dest: "Seattle", dates: "Apr 29–May 1", days: 3, type: "business", icon: "🌧️",
    sections: {
      "Outfits": ["Black leather jacket", "Denim Zevelyn Jean pants", "Black contour top", "Black Diarrablu pants"],
      "Accessories": ["Faux diamond necklace", "Black Doc Marten platform sandals", "Black Longchamp", "Artsy Sunglasses"],
    }
  },
  { dest: "Coachella", dates: "April", days: 4, type: "festival", icon: "🎪",
    sections: { "Festival": ["Festival outfits", "Comfortable boots", "Fanny pack", "Bandana"], }
  },
  { dest: "CDMX", dates: "Various", days: 5, type: "city", icon: "🇲🇽",
    sections: { "City": ["Walking shoes", "Light layers", "Crossbody bag"], }
  },
  { dest: "San Diego", dates: "Various", days: 3, type: "beach", icon: "🏖️",
    sections: { "Beach": ["Swimsuits", "Sun hat", "Sandals", "Cover-up"], }
  },
  { dest: "Atlanta", dates: "Various", days: 4, type: "city", icon: "🍑",
    sections: { "City": ["Casual outfits", "Walking shoes", "Light jacket"], }
  },
  { dest: "Houston", dates: "Various", days: 3, type: "city", icon: "🤠",
    sections: { "City": ["Light clothing", "Sun protection", "Comfortable shoes"], }
  },
  { dest: "Washington DC", dates: "Various", days: 4, type: "business", icon: "🏛️",
    sections: { "Business": ["Professional outfits", "Walking shoes", "Umbrella"], }
  },
  { dest: "Oakland", dates: "Various", days: 3, type: "city", icon: "🌳",
    sections: { "Casual": ["Layers for SF weather", "Walking shoes"], }
  },
  { dest: "Rhode Island", dates: "Various", days: 4, type: "beach", icon: "⛵",
    sections: { "East Coast": ["Light layers", "Beach gear", "Walking shoes"], }
  },
  { dest: "Sunnyvale", dates: "Various", days: 3, type: "business", icon: "☀️",
    sections: { "Business": ["Corporate badge", "Business casual", "Laptop"], }
  },
  { dest: "Nairobi", dates: "Various", days: 7, type: "safari", icon: "🦁",
    sections: {
      "Safari": ["Neutral clothing", "Bug spray", "Binoculars", "Headlamp"],
      "Photography": ["Fujifilm X100VI Camera", "Dust covers", "Extra memory cards"],
    }
  },
  { dest: "East Africa Multi", dates: "Various", days: 14, type: "safari", icon: "🌍",
    sections: { "Multi-stop": ["Extended safari gear", "Multiple neutral outfits", "Extra supplements"], }
  },
];

// ── List Generator ──
function genList(types, days) {
  const items = [];
  const ts = Array.isArray(types) ? types : [types];
  Object.entries(CORE).forEach(([catId, sections]) => {
    Object.entries(sections).forEach(([sec, arr]) => {
      arr.forEach((it) => {
        if (it.cond && !it.cond.some((t) => ts.includes(t)) && it.f < 0.5) return;
        if (it.f >= 0.3 || (days > 5 && it.f >= 0.2)) {
          items.push({ id: id(), name: it.name, category: catId, section: sec, packed: false, essential: !!it.e, ff: !!it.ff, freq: it.f, needsRefill: false });
        }
      });
    });
  });
  ts.forEach((t) => {
    if (COND_ITEMS[t]) {
      Object.entries(COND_ITEMS[t]).forEach(([sec, arr]) => {
        const cat = t === "ski" || t === "beach" ? "activewear" : "necessities";
        arr.forEach((name) => {
          items.push({ id: id(), name, category: cat, section: sec, packed: false, essential: false, ff: false, freq: 0.7, needsRefill: false });
        });
      });
    }
  });
  return items;
}

// ── Persist ──
function usePersist(key, def) {
  const [s, setS] = useState(() => { try { const v = localStorage.getItem(`pp2_${key}`); return v ? JSON.parse(v) : def; } catch { return def; } });
  useEffect(() => { try { localStorage.setItem(`pp2_${key}`, JSON.stringify(s)); } catch {} }, [key, s]);
  return [s, setS];
}

// ═══════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

function ProgressRing({ pct, size = 120, sw = 6, children }) {
  const r = (size - sw) / 2, circ = r * 2 * Math.PI, off = circ - (pct / 100) * circ;
  const col = pct === 100 ? C.sage : pct > 60 ? C.copperLight : C.copper;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.creamDark} strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1), stroke 0.5s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

function Btn({ children, v = "primary", sz = "md", onClick, style, disabled, ...p }) {
  const [pr, setPr] = useState(false);
  const styles = {
    primary: { background: `linear-gradient(135deg,${C.copper},${C.copperLight})`, color: "#fff", boxShadow: `0 2px 12px rgba(193,127,89,.3)` },
    secondary: { background: C.warmWhite, color: C.copper, border: `1.5px solid ${C.borderMedium}`, boxShadow: `0 1px 4px ${C.shadow}` },
    ghost: { background: "transparent", color: C.warmGray },
    sage: { background: `linear-gradient(135deg,${C.sage},${C.sageLight})`, color: "#fff", boxShadow: `0 2px 12px rgba(139,168,136,.3)` },
    danger: { background: C.dangerGlow, color: C.danger, border: `1.5px solid rgba(199,91,91,.2)` },
    lavender: { background: `linear-gradient(135deg,${C.lavender},#B8A8D8)`, color: "#fff", boxShadow: `0 2px 12px rgba(155,142,196,.3)` },
    teal: { background: `linear-gradient(135deg,${C.teal},#6BC4D8)`, color: "#fff", boxShadow: `0 2px 12px rgba(78,173,197,.3)` },
  };
  const pad = sz === "sm" ? "8px 16px" : sz === "lg" ? "16px 32px" : "12px 24px";
  const fs = sz === "sm" ? 13 : sz === "lg" ? 16 : 14;
  return (
    <button style={{ fontFamily: F.body, fontWeight: 500, border: "none", cursor: disabled ? "default" : "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      transition: "all .2s cubic-bezier(.4,0,.2,1)", transform: pr ? "scale(.97)" : "scale(1)",
      opacity: disabled ? .5 : 1, borderRadius: 14, padding: pad, fontSize: fs, letterSpacing: ".01em",
      ...styles[v], ...style }}
      onClick={disabled ? undefined : onClick} onMouseDown={() => !disabled && setPr(true)}
      onMouseUp={() => setPr(false)} onMouseLeave={() => setPr(false)} {...p}>
      {children}
    </button>
  );
}

function PackItem({ item, onToggle, onRemove, readOnly, refillMode, onToggleRefill }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => { if (refillMode) { onToggleRefill?.(item.id); } else if (!readOnly) { onToggle(item.id); } }}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 2,
        borderRadius: 12, cursor: readOnly && !refillMode ? "default" : "pointer",
        background: hov ? C.copperSubtle : "transparent", transition: "all .15s", minHeight: 44 }}>
      {refillMode ? (
        <div style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          border: item.needsRefill ? "none" : `2px solid ${C.borderMedium}`,
          background: item.needsRefill ? `linear-gradient(135deg,${C.amber},#E8B84A)` : "transparent",
          transition: "all .2s", boxShadow: item.needsRefill ? `0 2px 8px rgba(212,160,74,.3)` : "none" }}>
          {item.needsRefill && <RefreshCw size={13} color="#fff" strokeWidth={3} />}
        </div>
      ) : (
        <div style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          border: item.packed ? "none" : `2px solid ${C.borderMedium}`,
          background: item.packed ? `linear-gradient(135deg,${C.sage},${C.sageLight})` : "transparent",
          transition: "all .2s", boxShadow: item.packed ? `0 2px 8px rgba(139,168,136,.3)` : "none" }}>
          {item.packed && <Check size={14} color="#fff" strokeWidth={3} />}
        </div>
      )}
      <span style={{ flex: 1, fontFamily: F.body, fontSize: 14.5, color: C.charcoal,
        textDecoration: !refillMode && item.packed ? "line-through" : "none",
        opacity: !refillMode && item.packed ? .5 : 1, transition: "all .2s" }}>
        {item.name}
      </span>
      {!refillMode && item.ff && !item.packed && (
        <span style={{ fontSize: 10, fontFamily: F.body, fontWeight: 600, color: C.amber, background: C.amberGlow,
          padding: "2px 8px", borderRadius: 6, letterSpacing: ".03em", textTransform: "uppercase" }}>Don't forget!</span>
      )}
      {!refillMode && item.essential && !item.packed && !item.ff && (
        <span style={{ fontSize: 10, fontFamily: F.body, fontWeight: 600, color: C.copper, background: C.copperGlow,
          padding: "2px 8px", borderRadius: 6, letterSpacing: ".03em", textTransform: "uppercase" }}>Essential</span>
      )}
      {refillMode && item.needsRefill && (
        <span style={{ fontSize: 10, fontFamily: F.body, fontWeight: 600, color: C.amber, background: C.amberGlow,
          padding: "2px 8px", borderRadius: 6, letterSpacing: ".03em", textTransform: "uppercase" }}>Needs refill</span>
      )}
      {hov && !readOnly && !refillMode && onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6,
            display: "flex", color: C.softGray }}><X size={14} /></button>
      )}
    </div>
  );
}

function PackSection({ title, items, onToggle, onRemove, onAddItem, readOnly, refillMode, onToggleRefill }) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState("");
  const ref = useRef(null);
  const pk = items.filter(i => i.packed).length, tot = items.length, done = tot > 0 && pk === tot;
  useEffect(() => { if (adding && ref.current) ref.current.focus(); }, [adding]);
  const refillCount = refillMode ? items.filter(i => i.needsRefill).length : 0;

  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        cursor: "pointer", borderRadius: 12, transition: "background .15s" }}
        onMouseEnter={e => e.currentTarget.style.background = C.copperSubtle}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ transition: "transform .2s", transform: open ? "rotate(90deg)" : "rotate(0)" }}>
          <ChevronRight size={16} color={C.softGray} />
        </div>
        <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".08em", color: done ? C.sage : C.warmGray, flex: 1 }}>{title}</span>
        {refillMode ? (
          <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: refillCount > 0 ? C.amber : C.softGray,
            background: refillCount > 0 ? C.amberGlow : C.copperSubtle, padding: "2px 10px", borderRadius: 8 }}>
            {refillCount} refill{refillCount !== 1 ? "s" : ""}
          </span>
        ) : (
          <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: done ? C.sage : C.softGray,
            background: done ? C.sageGlow : C.copperSubtle, padding: "2px 10px", borderRadius: 8 }}>{pk}/{tot}</span>
        )}
      </div>
      {open && (
        <div style={{ paddingLeft: 12 }}>
          {items.map(i => <PackItem key={i.id} item={i} onToggle={onToggle} onRemove={onRemove} readOnly={readOnly}
            refillMode={refillMode} onToggleRefill={onToggleRefill} />)}
          {!readOnly && !refillMode && (adding ? (
            <form onSubmit={e => { e.preventDefault(); if (nv.trim()) { onAddItem(nv.trim()); setNv(""); setAdding(false); } }}
              style={{ display: "flex", gap: 8, padding: "6px 14px" }}>
              <input ref={ref} value={nv} onChange={e => setNv(e.target.value)} placeholder="Add item..."
                onBlur={() => { if (!nv.trim()) setAdding(false); }}
                style={{ flex: 1, fontFamily: F.body, fontSize: 14, padding: "8px 12px",
                  border: `1.5px solid ${C.borderMedium}`, borderRadius: 10, background: C.warmWhite,
                  outline: "none", color: C.charcoal }}
                onFocus={e => e.target.style.borderColor = C.copper} />
              <Btn v="primary" sz="sm" onClick={() => { if (nv.trim()) { onAddItem(nv.trim()); setNv(""); setAdding(false); } }}>Add</Btn>
            </form>
          ) : (
            <button onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
              background: "none", border: "none", cursor: "pointer", fontFamily: F.body, fontSize: 13,
              color: C.softGray, borderRadius: 10, width: "100%", transition: "all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.color = C.copper; e.currentTarget.style.background = C.copperSubtle; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.softGray; e.currentTarget.style.background = "none"; }}>
              <Plus size={14} /> Add item
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mini Bar Chart ──
function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: F.body, fontSize: 12, color: C.charcoal }}>{label}</span>
        <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color }}>{value}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: C.creamDark, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${color}, ${color}99)`,
          transition: "width .6s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}

// ── Freak Out Mode Component ──
function FreakOutMode({ onExit, onStartPacking }) {
  const [step, setStep] = useState(-1); // -1 = landing
  const [affIdx, setAffIdx] = useState(() => Math.floor(Math.random() * AFFIRMATIONS.length));
  const [breathing, setBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState("in");
  const [breathCount, setBreathCount] = useState(0);

  useEffect(() => {
    if (!breathing) return;
    const phases = [
      { phase: "in", dur: 4000 },
      { phase: "hold", dur: 1000 },
      { phase: "out", dur: 6000 },
    ];
    let idx = 0;
    let timer;
    const cycle = () => {
      setBreathPhase(phases[idx].phase);
      timer = setTimeout(() => {
        idx = (idx + 1) % phases.length;
        if (idx === 0) setBreathCount(c => c + 1);
        cycle();
      }, phases[idx].dur);
    };
    cycle();
    return () => clearTimeout(timer);
  }, [breathing]);

  useEffect(() => {
    if (breathCount >= 3) setBreathing(false);
  }, [breathCount]);

  // Landing
  if (step === -1) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #F0EBF5 0%, ${C.cream} 100%)`,
        display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 28px" }}>
        <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, background: "none",
          border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
          <ArrowLeft size={18} /> Back
        </button>

        <div style={{ fontSize: 64, marginBottom: 16, marginTop: 40 }}>🧠</div>
        <h1 style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 400,
          textAlign: "center", marginBottom: 8, lineHeight: 1.2 }}>
          Hey. It's okay.
        </h1>

        <div style={{ background: C.lavenderGlow, borderRadius: 16, padding: "16px 24px",
          maxWidth: 400, textAlign: "center", marginBottom: 32, border: `1px solid rgba(155,142,196,.15)` }}>
          <p style={{ fontFamily: F.body, fontSize: 15, color: C.charcoal, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
            "{AFFIRMATIONS[affIdx]}"
          </p>
        </div>

        <p style={{ fontFamily: F.body, fontSize: 15, color: C.warmGray, textAlign: "center",
          maxWidth: 380, lineHeight: 1.6, marginBottom: 32 }}>
          Your brain hit the freeze button. That's neurological, not a character flaw.
          Let's gently work through this together — no rush, no judgment.
        </p>

        <Btn v="lavender" sz="lg" onClick={() => setStep(0)} style={{ marginBottom: 16 }}>
          <Heart size={18} /> Start the unfreeze protocol
        </Btn>
        <button onClick={() => setAffIdx((affIdx + 1) % AFFIRMATIONS.length)}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.body,
            fontSize: 13, color: C.lavender, display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={14} /> Another affirmation
        </button>
      </div>
    );
  }

  const cur = UNFREEZE_STEPS[step];
  const isLast = step === UNFREEZE_STEPS.length - 1;

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #F0EBF5 0%, ${C.cream} 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 28px" }}>
      <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, background: "none",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
        <ArrowLeft size={18} /> Exit
      </button>

      {/* Progress */}
      <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
        {UNFREEZE_STEPS.map((_, i) => (
          <div key={i} style={{ width: i <= step ? 20 : 8, height: 8, borderRadius: 4,
            background: i <= step ? C.lavender : C.creamDark, transition: "all .3s" }} />
        ))}
      </div>

      <div style={{ fontSize: 56, marginBottom: 20 }}>{cur.icon}</div>
      <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400,
        textAlign: "center", marginBottom: 8 }}>
        {cur.title}
      </h2>
      <div style={{ fontFamily: F.body, fontSize: 12, color: C.lavender, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 20 }}>
        {cur.duration}
      </div>

      <p style={{ fontFamily: F.body, fontSize: 16, color: C.charcoal, textAlign: "center",
        maxWidth: 420, lineHeight: 1.7, marginBottom: 32 }}>
        {cur.body}
      </p>

      {/* Breathing exercise on step 0 */}
      {step === 0 && (
        <div style={{ marginBottom: 24 }}>
          {!breathing && breathCount < 3 ? (
            <Btn v="lavender" sz="sm" onClick={() => { setBreathing(true); setBreathCount(0); }}>
              <Wind size={15} /> Start guided breathing
            </Btn>
          ) : breathing ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 100, height: 100, borderRadius: "50%", margin: "0 auto 12px",
                background: C.lavenderGlow, display: "flex", alignItems: "center", justifyContent: "center",
                border: `3px solid ${C.lavender}`,
                transform: breathPhase === "in" ? "scale(1.3)" : breathPhase === "hold" ? "scale(1.3)" : "scale(1)",
                transition: breathPhase === "in" ? "transform 4s ease-in-out" : breathPhase === "out" ? "transform 6s ease-in-out" : "none" }}>
                <span style={{ fontFamily: F.body, fontSize: 14, fontWeight: 600, color: C.lavender, textTransform: "uppercase" }}>
                  {breathPhase === "in" ? "Breathe in..." : breathPhase === "hold" ? "Hold..." : "Breathe out..."}
                </span>
              </div>
              <span style={{ fontFamily: F.body, fontSize: 12, color: C.softGray }}>{breathCount + 1} of 3</span>
            </div>
          ) : (
            <div style={{ fontFamily: F.body, fontSize: 14, color: C.sage, textAlign: "center" }}>
              Nice. Three breaths done. You're already moving.
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        {step > 0 && <Btn v="secondary" sz="md" onClick={() => setStep(s => s - 1)}>Back</Btn>}
        {!isLast ? (
          <Btn v="lavender" sz="md" onClick={() => setStep(s => s + 1)}>
            I'm ready for the next step <ChevronRight size={16} />
          </Btn>
        ) : (
          <Btn v="sage" sz="lg" onClick={onStartPacking}>
            <Zap size={18} /> I'm ready to pack
          </Btn>
        )}
      </div>

      <div style={{ marginTop: 24, background: C.lavenderGlow, borderRadius: 12, padding: "12px 20px",
        maxWidth: 360, border: `1px solid rgba(155,142,196,.1)` }}>
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.lavender, textAlign: "center", margin: 0, fontStyle: "italic" }}>
          "{AFFIRMATIONS[(affIdx + step) % AFFIRMATIONS.length]}"
        </p>
      </div>
    </div>
  );
}

// ── Guided Pack Mode ──
function GuidedPack({ items, onToggle, onExit, tripName }) {
  const unpacked = items.filter(i => !i.packed);
  const [idx, setIdx] = useState(0);
  const flat = useMemo(() => {
    const m = {};
    unpacked.forEach(i => { if (!m[i.section]) m[i.section] = []; m[i.section].push(i); });
    return Object.values(m).flat();
  }, [unpacked]);
  const cur = flat[idx];
  const pk = items.filter(i => i.packed).length, pct = Math.round(pk / items.length * 100);

  if (!cur) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "70vh", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🎉</div>
        <h2 style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 500, marginBottom: 12 }}>All packed!</h2>
        <p style={{ fontFamily: F.body, fontSize: 16, color: C.warmGray, marginBottom: 32 }}>{tripName} is going to be amazing.</p>
        <Btn v="sage" sz="lg" onClick={onExit}>Back to trip</Btn>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg,${C.cream},${C.warmWhite})`,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, background: "none",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
        <ArrowLeft size={18} /> Exit focus mode
      </button>
      <ProgressRing pct={pct} size={140} sw={8}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 500 }}>{pct}%</div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, textTransform: "uppercase", letterSpacing: ".08em" }}>packed</div>
        </div>
      </ProgressRing>
      <div style={{ marginTop: 48, textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".1em", color: C.copper, marginBottom: 12 }}>{cur.section}</div>
        <h2 style={{ fontFamily: F.display, fontSize: 40, color: C.charcoal, fontWeight: 400, marginBottom: 8, lineHeight: 1.2 }}>
          {cur.name}
        </h2>
        {cur.ff && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.amberGlow,
            padding: "6px 14px", borderRadius: 10, marginTop: 8 }}>
            <AlertTriangle size={14} color={C.amber} />
            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: C.amber }}>Frequently forgotten!</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 48 }}>
        <Btn v="sage" sz="lg" onClick={() => { onToggle(cur.id); setTimeout(() => setIdx(i => Math.min(i, flat.length - 2)), 50); }}
          style={{ minWidth: 160 }}><Check size={20} /> Packed it</Btn>
        <Btn v="secondary" sz="lg" onClick={() => setIdx(i => Math.min(i + 1, flat.length - 1))} style={{ minWidth: 120 }}>Skip</Btn>
      </div>
      <div style={{ marginTop: 32, fontFamily: F.body, fontSize: 13, color: C.softGray }}>
        {idx + 1} of {flat.length} remaining
      </div>
    </div>
  );
}

// ── Smart Recommendations Step ──
function SmartRecsView({ tripTypes, tempRange, onAdd, onClose }) {
  const [added, setAdded] = useState(new Set());
  const types = Array.isArray(tripTypes) ? tripTypes : [tripTypes];

  // Gather recs
  const typeRecs = [];
  types.forEach(t => {
    if (SMART_RECS[t]) {
      SMART_RECS[t].forEach(r => {
        if (!typeRecs.find(x => x.name === r.name)) typeRecs.push({ ...r, source: t });
      });
    }
  });

  const tempItems = tempRange && TEMP_RECS[tempRange] ? TEMP_RECS[tempRange] : [];

  const handleAdd = (name) => {
    setAdded(prev => new Set([...prev, name]));
    onAdd(name);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.cream }}>
      <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${C.borderLight}`, background: "rgba(253,248,240,.95)" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ArrowLeft size={20} color={C.warmGray} />
        </button>
        <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>Smart Recommendations</span>
      </div>

      <div style={{ padding: "24px 20px" }}>
        <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>
          Items you might want
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 24 }}>
          Curated for your trip type and weather. Tap to add to your list.
        </p>

        {/* Trip-type recs */}
        {typeRecs.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Sparkles size={16} color={C.copper} />
              <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper,
                textTransform: "uppercase", letterSpacing: ".05em" }}>
                For your {types.map(t => TRIP_TYPES.find(tt => tt.id === t)?.label).join(" + ")} trip
              </span>
            </div>
            {typeRecs.map(r => {
              const isAdded = added.has(r.name);
              return (
                <div key={r.name} onClick={() => !isAdded && handleAdd(r.name)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                    marginBottom: 6, borderRadius: 14, cursor: isAdded ? "default" : "pointer",
                    background: isAdded ? C.sageGlow : C.warmWhite,
                    border: `1px solid ${isAdded ? "rgba(139,168,136,.2)" : C.borderLight}`,
                    transition: "all .2s", opacity: isAdded ? .7 : 1 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    background: isAdded ? `linear-gradient(135deg,${C.sage},${C.sageLight})` : C.copperGlow }}>
                    {isAdded ? <Check size={16} color="#fff" /> : <Plus size={16} color={C.copper} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.charcoal,
                      textDecoration: isAdded ? "line-through" : "none" }}>{r.name}</div>
                    <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>{r.why}</div>
                  </div>
                  {!isAdded && <span style={{ fontFamily: F.body, fontSize: 11, color: C.copper, fontWeight: 500 }}>+ Add</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Temperature recs */}
        {tempItems.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Thermometer size={16} color={C.teal} />
              <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.teal,
                textTransform: "uppercase", letterSpacing: ".05em" }}>
                For {TEMP_RANGES.find(t => t.id === tempRange)?.label} weather ({TEMP_RANGES.find(t => t.id === tempRange)?.range})
              </span>
            </div>
            {tempItems.map(r => {
              const isAdded = added.has(r.name);
              return (
                <div key={r.name} onClick={() => !isAdded && handleAdd(r.name)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                    marginBottom: 6, borderRadius: 14, cursor: isAdded ? "default" : "pointer",
                    background: isAdded ? C.sageGlow : C.warmWhite,
                    border: `1px solid ${isAdded ? "rgba(139,168,136,.2)" : C.borderLight}`,
                    transition: "all .2s", opacity: isAdded ? .7 : 1 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    background: isAdded ? `linear-gradient(135deg,${C.sage},${C.sageLight})` : C.tealGlow }}>
                    {isAdded ? <Check size={16} color="#fff" /> : <Plus size={16} color={C.teal} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.charcoal,
                      textDecoration: isAdded ? "line-through" : "none" }}>{r.name}</div>
                    <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>{r.why}</div>
                  </div>
                  {!isAdded && <span style={{ fontFamily: F.body, fontSize: 11, color: C.teal, fontWeight: 500 }}>+ Add</span>}
                </div>
              );
            })}
          </div>
        )}

        {typeRecs.length === 0 && tempItems.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.softGray, fontFamily: F.body }}>
            No additional recommendations for this trip configuration.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Weather Fetcher (Open-Meteo + wttr.in) ──
async function fetchWeather(location) {
  try {
    // Try wttr.in first (accepts city names and zip codes)
    const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
    if (res.ok) {
      const data = await res.json();
      const current = data.current_condition?.[0];
      const forecast = data.weather?.slice(0, 7) || [];
      return {
        current: {
          tempF: parseInt(current?.temp_F || "0"),
          desc: current?.weatherDesc?.[0]?.value || "",
          feelsLikeF: parseInt(current?.FeelsLikeF || "0"),
          humidity: current?.humidity || "",
        },
        forecast: forecast.map(d => ({
          date: d.date,
          maxF: parseInt(d.maxtempF || "0"),
          minF: parseInt(d.mintempF || "0"),
          desc: d.hourly?.[4]?.weatherDesc?.[0]?.value || "",
        })),
      };
    }
  } catch {}
  return null;
}

function tempToRange(f) {
  if (f >= 95) return "scorching";
  if (f >= 80) return "hot";
  if (f >= 65) return "warm";
  if (f >= 50) return "cool";
  if (f >= 32) return "cold";
  return "freezing";
}

// ── Insights Component (Visual) ──
function Insights({ trips }) {
  const total = trips.length + HIST_TRIPS.length;
  const allTrips = [...trips, ...HIST_TRIPS.map(t => ({ ...t, items: [] }))];
  const avgItems = trips.length > 0 ? Math.round(trips.reduce((s, t) => s + (t.items?.length || 0), 0) / trips.length) : 0;
  const completed = trips.filter(t => { const p = (t.items || []).filter(i => i.packed).length; return p === (t.items || []).length && (t.items || []).length > 0; }).length;

  // Trip type distribution
  const typeCounts = {};
  [...trips, ...HIST_TRIPS.map(t => ({ tripType: [t.type] }))].forEach(t => {
    const types = t.tripType || [t.type];
    (Array.isArray(types) ? types : [types]).forEach(tt => { typeCounts[tt] = (typeCounts[tt] || 0) + 1; });
  });
  const maxTypeCount = Math.max(...Object.values(typeCounts), 1);

  // Category packing rates
  const catStats = {};
  trips.forEach(t => {
    (t.items || []).forEach(i => {
      if (!catStats[i.category]) catStats[i.category] = { packed: 0, total: 0 };
      catStats[i.category].total++;
      if (i.packed) catStats[i.category].packed++;
    });
  });

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total Trips", value: total, icon: <Plane size={18} />, col: C.copper },
          { label: "Avg Items", value: avgItems, icon: <PackageCheck size={18} />, col: C.sage },
          { label: "Fully Packed", value: completed, icon: <Award size={18} />, col: C.teal },
        ].map(({ label, value, icon, col }) => (
          <div key={label} style={{ background: C.warmWhite, borderRadius: 16, padding: "20px 16px",
            border: `1px solid ${C.borderLight}`, textAlign: "center" }}>
            <div style={{ color: col, marginBottom: 8, display: "flex", justifyContent: "center" }}>{icon}</div>
            <div style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 500 }}>{value}</div>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, textTransform: "uppercase",
              letterSpacing: ".06em", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Trip Type Distribution */}
      <div style={{ background: C.warmWhite, borderRadius: 16, padding: 20, border: `1px solid ${C.borderLight}`, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <BarChart3 size={16} color={C.copper} />
          <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper,
            textTransform: "uppercase", letterSpacing: ".05em" }}>Trip type breakdown</span>
        </div>
        {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
          const tt = TRIP_TYPES.find(t => t.id === type);
          return <MiniBar key={type} label={`${tt?.icon || ""} ${tt?.label || type}`} value={count} max={maxTypeCount} color={tt?.color || C.copper} />;
        })}
      </div>

      {/* Category Completion (if data) */}
      {Object.keys(catStats).length > 0 && (
        <div style={{ background: C.warmWhite, borderRadius: 16, padding: 20, border: `1px solid ${C.borderLight}`, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} color={C.sage} />
            <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.sage,
              textTransform: "uppercase", letterSpacing: ".05em" }}>Packing completion by category</span>
          </div>
          {CATEGORIES.map(cat => {
            const s = catStats[cat.id];
            if (!s) return null;
            const pct = s.total > 0 ? Math.round(s.packed / s.total * 100) : 0;
            return <MiniBar key={cat.id} label={`${cat.icon} ${cat.label}`} value={pct} max={100} color={cat.color} />;
          })}
        </div>
      )}

      {/* Blind Spots */}
      <div style={{ background: C.amberGlow, borderRadius: 16, padding: 20,
        border: `1px solid rgba(212,160,74,.2)`, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Brain size={16} color={C.amber} />
          <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.amber,
            textTransform: "uppercase", letterSpacing: ".05em" }}>Your blind spots</span>
        </div>
        <p style={{ fontFamily: F.body, fontSize: 14, color: C.charcoal, lineHeight: 1.5, margin: 0 }}>
          Hair products are forgotten on ~60% of your trips. Edge control, hair mousse, and brushes are the top culprits.
          PackPal now auto-flags these with "Don't forget!" badges.
        </p>
      </div>

      {/* Patterns */}
      <div style={{ background: C.warmWhite, borderRadius: 16, padding: 20, border: `1px solid ${C.borderLight}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Star size={16} color={C.copper} />
          <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper,
            textTransform: "uppercase", letterSpacing: ".05em" }}>Packing intelligence</span>
        </div>
        {[
          { fact: "7-supplement stack is your non-negotiable core", detail: "Pre-loaded on every trip" },
          { fact: "Skincare: 10+ AM, 8+ PM products", detail: "Organized by routine sequence" },
          { fact: "Tech setup: 5 cables + 3 power blocks minimum", detail: "Never caught without charge" },
          { fact: "Away luggage system appears on 95% of trips", detail: "Your consistent travel foundation" },
          { fact: "Satin pillowcase + bonnet are essential", detail: "Historically forgotten but critical for you" },
        ].map(({ fact, detail }) => (
          <div key={fact} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: C.copper, marginTop: 7, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: F.body, fontSize: 14, color: C.charcoal, lineHeight: 1.4 }}>{fact}</div>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>{detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// OUTFIT BUILDER
// ═══════════════════════════════════════════════════════

const OUTFIT_SLOTS = [
  { id: "top", label: "Top", icon: <Shirt size={18} />, emoji: "👚", color: C.copper, placeholder: "e.g. Cream cashmere top, Black contour top..." },
  { id: "bottom", label: "Bottoms", icon: <Palette size={18} />, emoji: "👖", color: "#7BA3C9", placeholder: "e.g. Blue Zevelyn jeans, Flowy sheer pants..." },
  { id: "layer", label: "Layer / Jacket", icon: <Shield size={18} />, emoji: "🧥", color: "#8B7355", optional: true, placeholder: "e.g. Black leather jacket, Cream puffer..." },
  { id: "shoes", label: "Shoes", icon: <Footprints size={18} />, emoji: "👟", color: C.sage, placeholder: "e.g. Black Doc Martens, Gold sandals..." },
  { id: "bag", label: "Bag / Purse", icon: <ShoppingBag size={18} />, emoji: "👜", color: "#C47EAA", placeholder: "e.g. Black Longchamp, Gold clutch..." },
  { id: "necklace", label: "Necklace(s)", icon: <Gem size={18} />, emoji: "📿", color: C.copperLight, optional: true, placeholder: "e.g. Gold necklaces (3), Faux diamond..." },
  { id: "bracelet", label: "Bracelet(s)", icon: <Watch size={18} />, emoji: "💎", color: C.amber, optional: true, placeholder: "e.g. Gold bracelets (3), Sparkly bracelets..." },
  { id: "eyewear", label: "Eyewear", icon: <Eye size={18} />, emoji: "🕶️", color: C.teal, optional: true, placeholder: "e.g. Artsy Sunglasses, Gold Eyeglasses..." },
  { id: "hair", label: "Hair Accessory", icon: <Star size={18} />, emoji: "✨", color: C.lavender, optional: true, placeholder: "e.g. Hair clips, Headband, Scarf..." },
];

const DAY_EMOJIS = ["✈️", "☀️", "🌤️", "⭐", "🌸", "🎯", "💫", "🌊", "🏔️", "🎉", "🌺", "⚡", "🦋", "🌙", "🍂"];
const OCCASION_TYPES = [
  { id: "daytime", label: "Daytime / Explore", icon: "☀️" },
  { id: "evening", label: "Evening / Dinner", icon: "🌙" },
  { id: "activity", label: "Activity / Sport", icon: "🏃‍♀️" },
  { id: "special", label: "Special Event", icon: "✨" },
];

function parseItemMeta(name) {
  const lower = name.toLowerCase();
  const colors = ["black", "white", "cream", "gold", "pink", "blue", "navy", "brown", "tan", "turquoise", "lavender", "green", "red", "rose gold", "silver", "fawn", "sparkly"];
  const brands = ["zevelyn", "diarrablu", "longchamp", "doc marten", "gucci", "fenty", "nike", "ugg", "birkenstock", "away", "heattech"];
  const foundColor = colors.find(c => lower.includes(c)) || null;
  const foundBrand = brands.find(b => lower.includes(b)) || null;
  return { color: foundColor, brand: foundBrand };
}

function colorToHex(name) {
  const map = { black: "#2D2926", white: "#F5F0EB", cream: "#F5EDE0", gold: "#D4A04A", pink: "#D4889A", blue: "#7BA3C9",
    navy: "#3B5175", brown: "#8B7355", tan: "#C4A882", turquoise: "#4EADC5", lavender: "#9B8EC4", green: "#8BA888",
    red: "#C75B5B", "rose gold": "#C9A08B", silver: "#A8A8A8", fawn: "#C4A882", sparkly: "#D4A04A" };
  return map[name] || C.copperLight;
}

function WardrobeCarousel({ slotId, wardrobe, onSelect, onCreateNew, selected }) {
  const items = (wardrobe[slotId] || []);
  const scrollRef = useRef(null);

  // Group by color for visual organization
  const grouped = useMemo(() => {
    const colorMap = {};
    items.forEach(item => {
      const meta = parseItemMeta(item);
      const key = meta.color || "other";
      if (!colorMap[key]) colorMap[key] = [];
      colorMap[key].push(item);
    });
    // Sort by group size descending
    return Object.entries(colorMap).sort((a, b) => b[1].length - a[1].length);
  }, [items]);

  const allItems = grouped.flatMap(([, items]) => items);

  return (
    <div>
      {allItems.length > 0 && (
        <div ref={scrollRef} style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8,
          scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}>
          {allItems.map((item, i) => {
            const meta = parseItemMeta(item);
            const isSel = selected === item;
            return (
              <button key={`${item}-${i}`} onClick={() => onSelect(item)}
                style={{ minWidth: 130, maxWidth: 160, padding: "12px 14px", borderRadius: 14, flexShrink: 0,
                  border: `2px solid ${isSel ? C.copper : C.borderLight}`,
                  background: isSel ? C.copperGlow : C.warmWhite,
                  cursor: "pointer", textAlign: "left", transition: "all .2s",
                  transform: isSel ? "scale(1.02)" : "scale(1)",
                  boxShadow: isSel ? `0 4px 16px rgba(193,127,89,.2)` : `0 1px 4px ${C.shadow}` }}>
                {/* Color dot + brand */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  {meta.color && <div style={{ width: 10, height: 10, borderRadius: 5,
                    background: colorToHex(meta.color), border: meta.color === "white" ? `1px solid ${C.borderLight}` : "none" }} />}
                  {meta.brand && <span style={{ fontFamily: F.body, fontSize: 9, fontWeight: 600, textTransform: "uppercase",
                    letterSpacing: ".05em", color: C.softGray }}>{meta.brand}</span>}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: isSel ? 600 : 400,
                  color: C.charcoal, lineHeight: 1.3,
                  overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {item}
                </div>
                {isSel && <div style={{ marginTop: 6 }}>
                  <Check size={14} color={C.copper} />
                </div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OutfitBuilder({ trip, wardrobe, setWardrobe, onComplete, onExit }) {
  const [dayIdx, setDayIdx] = useState(0);
  const [slotIdx, setSlotIdx] = useState(0);
  const [occasions, setOccasions] = useState(() =>
    Array.from({ length: trip.days }, (_, i) => [{
      id: id(), type: "daytime", label: i === 0 ? "Travel Day" : i === trip.days - 1 ? "Travel Home" : `Day ${i + 1}`,
      slots: {}
    }])
  );
  const [addingNew, setAddingNew] = useState(false);
  const [newItemVal, setNewItemVal] = useState("");
  const [showAddOccasion, setShowAddOccasion] = useState(false);
  const newRef = useRef(null);

  useEffect(() => { if (addingNew && newRef.current) newRef.current.focus(); }, [addingNew]);

  const currentDayOccasions = occasions[dayIdx] || [];
  const [occIdx, setOccIdx] = useState(0);
  const currentOccasion = currentDayOccasions[occIdx];
  const currentSlot = OUTFIT_SLOTS[slotIdx];
  const totalDays = trip.days;
  const totalSlots = OUTFIT_SLOTS.length;

  // Calculate overall progress
  const totalOccasions = occasions.reduce((s, d) => s + d.length, 0);
  const filledSlots = occasions.reduce((s, d) => s + d.reduce((s2, o) => s2 + Object.keys(o.slots).filter(k => o.slots[k]).length, 0), 0);
  const requiredSlots = OUTFIT_SLOTS.filter(s => !s.optional).length;
  const progress = totalOccasions > 0 ? Math.min(100, Math.round((filledSlots / (totalOccasions * requiredSlots)) * 100)) : 0;

  const setSlotValue = (val) => {
    const updated = [...occasions];
    updated[dayIdx] = [...updated[dayIdx]];
    updated[dayIdx][occIdx] = { ...updated[dayIdx][occIdx], slots: { ...updated[dayIdx][occIdx].slots, [currentSlot.id]: val } };
    setOccasions(updated);

    // Save to wardrobe
    if (val && !wardrobe[currentSlot.id]?.includes(val)) {
      setWardrobe(prev => ({ ...prev, [currentSlot.id]: [...(prev[currentSlot.id] || []), val] }));
    }
  };

  const addOccasion = (type) => {
    const typeInfo = OCCASION_TYPES.find(t => t.id === type);
    const updated = [...occasions];
    updated[dayIdx] = [...updated[dayIdx], { id: id(), type, label: typeInfo?.label || type, slots: {} }];
    setOccasions(updated);
    setOccIdx(updated[dayIdx].length - 1);
    setSlotIdx(0);
    setShowAddOccasion(false);
  };

  const removeOccasion = (oi) => {
    if (currentDayOccasions.length <= 1) return;
    const updated = [...occasions];
    updated[dayIdx] = updated[dayIdx].filter((_, i) => i !== oi);
    setOccasions(updated);
    setOccIdx(Math.min(occIdx, updated[dayIdx].length - 1));
  };

  const goNext = () => {
    if (slotIdx < totalSlots - 1) { setSlotIdx(s => s + 1); }
    else if (occIdx < currentDayOccasions.length - 1) { setOccIdx(o => o + 1); setSlotIdx(0); }
    else if (dayIdx < totalDays - 1) { setDayIdx(d => d + 1); setOccIdx(0); setSlotIdx(0); }
    else { /* done */ }
  };

  const goPrev = () => {
    if (slotIdx > 0) setSlotIdx(s => s - 1);
    else if (occIdx > 0) { setOccIdx(o => o - 1); setSlotIdx(totalSlots - 1); }
    else if (dayIdx > 0) { setDayIdx(d => d - 1); setOccIdx(occasions[dayIdx - 1].length - 1); setSlotIdx(totalSlots - 1); }
  };

  const isLast = dayIdx === totalDays - 1 && occIdx === currentDayOccasions.length - 1 && slotIdx === totalSlots - 1;
  const isFirst = dayIdx === 0 && occIdx === 0 && slotIdx === 0;
  const selectedValue = currentOccasion?.slots?.[currentSlot.id] || "";

  // Finish: collect all unique items and return
  const handleFinish = () => {
    const uniqueItems = new Map(); // name -> { name, section }
    occasions.forEach((dayOccs, di) => {
      dayOccs.forEach((occ) => {
        Object.entries(occ.slots).forEach(([slotId, val]) => {
          if (val && !uniqueItems.has(val)) {
            const slot = OUTFIT_SLOTS.find(s => s.id === slotId);
            const section = slotId === "shoes" ? "Shoes" : slotId === "bag" ? "Bags & Purses" :
              slotId === "necklace" || slotId === "bracelet" ? "Jewelry" :
              slotId === "eyewear" ? "Eyewear" : slotId === "hair" ? "Hair Accessories" :
              slotId === "layer" ? "Outerwear" : "Clothing";
            uniqueItems.set(val, { name: val, section });
          }
        });
      });
    });
    onComplete(Array.from(uniqueItems.values()), occasions);
  };

  // Day label
  const dayLabel = dayIdx === 0 ? "Travel Day" : dayIdx === totalDays - 1 ? "Last Day" : `Day ${dayIdx + 1}`;
  const dayEmoji = DAY_EMOJIS[dayIdx % DAY_EMOJIS.length];

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #FFF8F2 0%, ${C.cream} 100%)` }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${C.borderLight}`, background: "rgba(255,248,242,.95)", backdropFilter: "blur(10px)" }}>
        <button onClick={onExit} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ArrowLeft size={20} color={C.warmGray} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.copper }}>Build My Outfits</div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{trip.destination} · {trip.days} days</div>
        </div>
        <ProgressRing pct={progress} size={40} sw={3}>
          <span style={{ fontFamily: F.body, fontSize: 10, fontWeight: 600, color: C.charcoal }}>{progress}%</span>
        </ProgressRing>
      </div>

      {/* Day tabs */}
      <div style={{ display: "flex", gap: 4, padding: "12px 16px", overflowX: "auto" }}>
        {Array.from({ length: totalDays }, (_, i) => {
          const dayOccs = occasions[i] || [];
          const dayFilled = dayOccs.some(o => Object.keys(o.slots).length > 0);
          const active = i === dayIdx;
          return (
            <button key={i} onClick={() => { setDayIdx(i); setOccIdx(0); setSlotIdx(0); }}
              style={{ minWidth: 48, padding: "8px 12px", borderRadius: 12, flexShrink: 0,
                border: `1.5px solid ${active ? C.copper : dayFilled ? C.sageLight : C.borderLight}`,
                background: active ? C.copperGlow : dayFilled ? C.sageGlow : "transparent",
                cursor: "pointer", textAlign: "center", transition: "all .2s" }}>
              <div style={{ fontSize: 14 }}>{DAY_EMOJIS[i % DAY_EMOJIS.length]}</div>
              <div style={{ fontFamily: F.body, fontSize: 10, fontWeight: active ? 600 : 400,
                color: active ? C.copper : C.warmGray, marginTop: 2 }}>
                {i === 0 ? "Go" : i === totalDays - 1 ? "Back" : `D${i + 1}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Occasion tabs for current day */}
      <div style={{ padding: "4px 16px 12px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {currentDayOccasions.map((occ, i) => {
            const active = i === occIdx;
            const typeInfo = OCCASION_TYPES.find(t => t.id === occ.type);
            return (
              <button key={occ.id} onClick={() => { setOccIdx(i); setSlotIdx(0); }}
                style={{ padding: "6px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6,
                  border: `1px solid ${active ? C.copper : C.borderLight}`,
                  background: active ? C.copperGlow : C.warmWhite,
                  cursor: "pointer", fontFamily: F.body, fontSize: 12, fontWeight: active ? 600 : 400,
                  color: active ? C.copper : C.warmGray }}>
                {typeInfo?.icon} {occ.label}
                {currentDayOccasions.length > 1 && active && (
                  <button onClick={(e) => { e.stopPropagation(); removeOccasion(i); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
                      marginLeft: 4, color: C.softGray, display: "flex" }}>
                    <X size={12} />
                  </button>
                )}
              </button>
            );
          })}
          <button onClick={() => setShowAddOccasion(!showAddOccasion)}
            style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px dashed ${C.borderMedium}`, background: "transparent", cursor: "pointer", color: C.softGray }}>
            <Plus size={14} />
          </button>
        </div>

        {showAddOccasion && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {OCCASION_TYPES.filter(t => !currentDayOccasions.find(o => o.type === t.id)).map(t => (
              <button key={t.id} onClick={() => addOccasion(t.id)}
                style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.borderLight}`,
                  background: C.warmWhite, cursor: "pointer", fontFamily: F.body, fontSize: 12, color: C.charcoal,
                  display: "flex", alignItems: "center", gap: 6 }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current slot */}
      <div style={{ padding: "8px 20px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 16,
            background: `linear-gradient(135deg, ${currentSlot.color}15, ${currentSlot.color}08)`,
            border: `1.5px solid ${currentSlot.color}25`, marginBottom: 12 }}>
            <span style={{ fontSize: 28 }}>{currentSlot.emoji}</span>
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>
            {currentSlot.label}
          </h2>
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.softGray }}>
            {dayEmoji} {dayLabel} · {currentOccasion?.label}
            {currentSlot.optional && <span style={{ color: C.softGray, fontStyle: "italic" }}> · optional</span>}
          </div>
        </div>

        {/* Slot progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {OUTFIT_SLOTS.map((s, i) => {
            const filled = !!currentOccasion?.slots?.[s.id];
            const active = i === slotIdx;
            return (
              <button key={s.id} onClick={() => setSlotIdx(i)}
                style={{ width: active ? 20 : 10, height: 10, borderRadius: 5, border: "none", cursor: "pointer",
                  background: filled ? C.sage : active ? C.copper : C.creamDark,
                  transition: "all .2s" }} />
            );
          })}
        </div>

        {/* Selected value display */}
        {selectedValue && (
          <div style={{ background: C.sageGlow, borderRadius: 14, padding: "12px 18px",
            display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
            border: `1px solid rgba(139,168,136,.2)` }}>
            <Check size={16} color={C.sage} />
            <span style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.charcoal, flex: 1 }}>
              {selectedValue}
            </span>
            <button onClick={() => setSlotValue("")} style={{ background: "none", border: "none", cursor: "pointer",
              color: C.softGray, padding: 4, display: "flex" }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Wardrobe carousel */}
        <div style={{ marginBottom: 16 }}>
          {(wardrobe[currentSlot.id] || []).length > 0 && (
            <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: ".06em", color: C.warmGray, marginBottom: 10, paddingLeft: 4 }}>
              Your wardrobe
            </div>
          )}
          <WardrobeCarousel slotId={currentSlot.id} wardrobe={wardrobe}
            onSelect={(item) => setSlotValue(item)} selected={selectedValue} />
        </div>

        {/* Add new item */}
        {addingNew ? (
          <form onSubmit={(e) => { e.preventDefault(); if (newItemVal.trim()) { setSlotValue(newItemVal.trim()); setNewItemVal(""); setAddingNew(false); } }}
            style={{ display: "flex", gap: 10 }}>
            <input ref={newRef} value={newItemVal} onChange={e => setNewItemVal(e.target.value)}
              placeholder={currentSlot.placeholder}
              onBlur={() => { if (!newItemVal.trim()) setTimeout(() => setAddingNew(false), 150); }}
              style={{ flex: 1, fontFamily: F.body, fontSize: 14, padding: "12px 16px",
                border: `1.5px solid ${C.borderMedium}`, borderRadius: 12,
                background: C.warmWhite, outline: "none", color: C.charcoal }}
              onFocus={e => e.target.style.borderColor = C.copper} />
            <Btn v="primary" sz="sm" onClick={() => { if (newItemVal.trim()) { setSlotValue(newItemVal.trim()); setNewItemVal(""); setAddingNew(false); } }}>
              Add
            </Btn>
          </form>
        ) : (
          <button onClick={() => setAddingNew(true)}
            style={{ width: "100%", padding: "14px 18px", borderRadius: 14,
              border: `2px dashed ${C.borderMedium}`, background: C.copperSubtle,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: F.body, fontSize: 14, color: C.copper, transition: "all .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = C.copperGlow}
            onMouseLeave={e => e.currentTarget.style.background = C.copperSubtle}>
            <Plus size={16} /> Add new {currentSlot.label.toLowerCase()}
          </button>
        )}

        {currentSlot.optional && !selectedValue && (
          <button onClick={goNext}
            style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 10,
              border: "none", background: "transparent", cursor: "pointer",
              fontFamily: F.body, fontSize: 13, color: C.softGray, textAlign: "center" }}>
            Skip this — it's optional
          </button>
        )}
      </div>

      {/* Navigation */}
      <div style={{ padding: "12px 20px 32px", display: "flex", gap: 12,
        borderTop: `1px solid ${C.borderLight}`, background: "rgba(253,248,240,.95)" }}>
        {!isFirst && (
          <Btn v="secondary" sz="md" onClick={goPrev} style={{ flex: 0 }}>
            <ChevronLeft size={16} />
          </Btn>
        )}
        {!isLast ? (
          <Btn v="primary" sz="md" onClick={goNext} style={{ flex: 1 }}>
            Next <ChevronRight size={16} />
          </Btn>
        ) : (
          <Btn v="sage" sz="lg" onClick={handleFinish} style={{ flex: 1 }}>
            <Sparkles size={18} /> Add outfits to my list
          </Btn>
        )}
      </div>

      {/* Summary panel at bottom */}
      <div style={{ padding: "0 20px 24px" }}>
        <details>
          <summary style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: ".06em", color: C.warmGray, cursor: "pointer", padding: "8px 0",
            listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
            <ChevronRight size={14} /> Outfit summary so far
          </summary>
          <div style={{ marginTop: 8 }}>
            {occasions.map((dayOccs, di) => {
              const anyFilled = dayOccs.some(o => Object.values(o.slots).some(v => v));
              if (!anyFilled) return null;
              return (
                <div key={di} style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, color: C.copper,
                    textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                    {DAY_EMOJIS[di % DAY_EMOJIS.length]} {di === 0 ? "Travel" : di === totalDays - 1 ? "Last Day" : `Day ${di + 1}`}
                  </div>
                  {dayOccs.map((occ, oi) => {
                    const filled = Object.entries(occ.slots).filter(([, v]) => v);
                    if (!filled.length) return null;
                    return (
                      <div key={occ.id} style={{ background: C.warmWhite, borderRadius: 10, padding: "8px 12px",
                        border: `1px solid ${C.borderLight}`, marginBottom: 4 }}>
                        <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, marginBottom: 4 }}>
                          {OCCASION_TYPES.find(t => t.id === occ.type)?.icon} {occ.label}
                        </div>
                        {filled.map(([slotId, val]) => (
                          <div key={slotId} style={{ fontFamily: F.body, fontSize: 12, color: C.charcoal, padding: "1px 0" }}>
                            {OUTFIT_SLOTS.find(s => s.id === slotId)?.emoji} {val}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </details>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════
export default function PackPal() {
  const [trips, setTrips] = usePersist("trips", []);
  const [view, setView] = useState("home");
  const [activeTrip, setActiveTrip] = useState(null);
  const [guidedMode, setGuidedMode] = useState(false);
  const [freakOut, setFreakOut] = useState(false);
  const [refillMode, setRefillMode] = useState(false);
  const [showRecs, setShowRecs] = useState(false);
  const [outfitMode, setOutfitMode] = useState(false);
  const [wardrobe, setWardrobe] = usePersist("wardrobe", {});
  const [searchQ, setSearchQ] = useState("");
  const [catFilter, setCatFilter] = useState(null);
  const [histTrip, setHistTrip] = useState(null);

  // Wizard
  const [wStep, setWStep] = useState(0);
  const [nTrip, setNTrip] = useState({ destination: "", tripType: [], days: 4, weather: "warm", startDate: "", tempRange: "" });
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // ── Weather Fetch ──
  const doFetchWeather = async (loc) => {
    if (!loc) return;
    setWeatherLoading(true);
    const data = await fetchWeather(loc);
    setWeatherData(data);
    if (data?.forecast?.length) {
      const avgMax = Math.round(data.forecast.reduce((s, d) => s + d.maxF, 0) / data.forecast.length);
      setNTrip(prev => ({ ...prev, tempRange: tempToRange(avgMax) }));
    }
    setWeatherLoading(false);
  };

  // ── CRUD ──
  const createTrip = () => {
    const items = genList(nTrip.tripType, nTrip.days);
    const trip = { id: id(), ...nTrip, items, createdAt: new Date().toISOString(),
      icon: TRIP_TYPES.find(t => t.id === nTrip.tripType[0])?.icon || "✈️", weatherData };
    setTrips(p => [trip, ...p]);
    setActiveTrip(trip);
    setView("trip");
    setNTrip({ destination: "", tripType: [], days: 4, weather: "warm", startDate: "", tempRange: "" });
    setWStep(0); setWeatherData(null);
  };

  const toggle = (tid, iid) => {
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, packed: !i.packed } : i) } : t));
    if (activeTrip?.id === tid) setActiveTrip(p => ({ ...p, items: p.items.map(i => i.id === iid ? { ...i, packed: !i.packed } : i) }));
  };
  const toggleRefill = (tid, iid) => {
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.map(i => i.id === iid ? { ...i, needsRefill: !i.needsRefill } : i) } : t));
    if (activeTrip?.id === tid) setActiveTrip(p => ({ ...p, items: p.items.map(i => i.id === iid ? { ...i, needsRefill: !i.needsRefill } : i) }));
  };
  const addItem = (tid, sec, cat, name) => {
    const ni = { id: id(), name, section: sec, category: cat, packed: false, essential: false, ff: false, freq: 0, needsRefill: false };
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: [...t.items, ni] } : t));
    if (activeTrip?.id === tid) setActiveTrip(p => ({ ...p, items: [...p.items, ni] }));
  };
  const addRecItem = (name) => {
    if (!activeTrip) return;
    const ni = { id: id(), name, section: "Smart Recommendations", category: "necessities", packed: false, essential: false, ff: false, freq: 0, needsRefill: false };
    setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, items: [...t.items, ni] } : t));
    setActiveTrip(p => ({ ...p, items: [...p.items, ni] }));
  };
  const removeItem = (tid, iid) => {
    setTrips(p => p.map(t => t.id === tid ? { ...t, items: t.items.filter(i => i.id !== iid) } : t));
    if (activeTrip?.id === tid) setActiveTrip(p => ({ ...p, items: p.items.filter(i => i.id !== iid) }));
  };
  const deleteTrip = (tid) => {
    setTrips(p => p.filter(t => t.id !== tid));
    if (activeTrip?.id === tid) { setActiveTrip(null); setView("home"); }
  };
  const dupTrip = (trip) => {
    const ni = trip.items.map(i => ({ ...i, id: id(), packed: false, needsRefill: false }));
    const d = { ...trip, id: id(), items: ni, createdAt: new Date().toISOString(), destination: `${trip.destination} (copy)` };
    setTrips(p => [d, ...p]); setActiveTrip(d); setView("trip");
  };

  const stats = (t) => {
    if (!t?.items) return { pk: 0, tot: 0, pct: 0 };
    const pk = t.items.filter(i => i.packed).length, tot = t.items.length;
    return { pk, tot, pct: tot > 0 ? Math.round(pk / tot * 100) : 0 };
  };

  const groupItems = (items) => {
    const g = {};
    items.forEach(i => { if (!g[i.category]) g[i.category] = {}; if (!g[i.category][i.section]) g[i.category][i.section] = []; g[i.category][i.section].push(i); });
    return g;
  };

  // ═══ FREAK OUT MODE ═══
  if (freakOut) {
    return <FreakOutMode onExit={() => setFreakOut(false)}
      onStartPacking={() => { setFreakOut(false); if (activeTrip) setGuidedMode(true); }} />;
  }

  // ═══ GUIDED PACK ═══
  if (guidedMode && activeTrip) {
    return <GuidedPack items={activeTrip.items} onToggle={iid => toggle(activeTrip.id, iid)}
      onExit={() => setGuidedMode(false)} tripName={activeTrip.destination} />;
  }

  // ═══ SMART RECS ═══
  if (showRecs && activeTrip) {
    return <SmartRecsView tripTypes={activeTrip.tripType} tempRange={activeTrip.tempRange}
      onAdd={addRecItem} onClose={() => setShowRecs(false)} />;
  }

  // ═══ OUTFIT BUILDER ═══
  if (outfitMode && activeTrip) {
    return <OutfitBuilder trip={activeTrip} wardrobe={wardrobe} setWardrobe={setWardrobe}
      onExit={() => setOutfitMode(false)}
      onComplete={(outfitItems, occasions) => {
        // Add unique outfit items to packing list under "outfits" category
        const existing = new Set(activeTrip.items.map(i => i.name.toLowerCase()));
        const newItems = outfitItems
          .filter(item => !existing.has(item.name.toLowerCase()))
          .map(item => ({
            id: id(), name: item.name, category: "outfits", section: item.section,
            packed: false, essential: false, ff: false, freq: 0, needsRefill: false
          }));
        if (newItems.length > 0) {
          const updatedItems = [...activeTrip.items, ...newItems];
          setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, items: updatedItems, outfitPlan: occasions } : t));
          setActiveTrip(p => ({ ...p, items: updatedItems, outfitPlan: occasions }));
        } else {
          setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, outfitPlan: occasions } : t));
          setActiveTrip(p => ({ ...p, outfitPlan: occasions }));
        }
        setOutfitMode(false);
      }} />;
  }

  // ═══ HISTORICAL TRIP DETAIL ═══
  if (view === "hist-detail" && histTrip) {
    return (
      <div style={{ minHeight: "100vh", background: C.cream }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid ${C.borderLight}` }}>
          <button onClick={() => { setView("history"); setHistTrip(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ArrowLeft size={20} color={C.warmGray} />
          </button>
          <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>
            {histTrip.icon} {histTrip.dest}
          </span>
        </div>
        <div style={{ padding: "24px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <span style={{ fontSize: 48 }}>{histTrip.icon}</span>
            <div>
              <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, margin: 0 }}>
                {histTrip.dest}
              </h2>
              <div style={{ fontFamily: F.body, fontSize: 13, color: C.warmGray, marginTop: 4 }}>
                {histTrip.dates} · {histTrip.days} days · {histTrip.type}
              </div>
            </div>
          </div>

          <div style={{ background: C.copperSubtle, borderRadius: 12, padding: "10px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 8 }}>
            <Eye size={14} color={C.copper} />
            <span style={{ fontFamily: F.body, fontSize: 13, color: C.copper }}>
              Read-only — this is your historical packing data
            </span>
          </div>

          {Object.entries(histTrip.sections).map(([sec, items]) => (
            <div key={sec} style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: ".08em", color: C.warmGray, padding: "8px 4px" }}>{sec}</div>
              <div style={{ background: C.warmWhite, borderRadius: 14, border: `1px solid ${C.borderLight}`, padding: "8px 0" }}>
                {items.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                      background: `linear-gradient(135deg,${C.sage},${C.sageLight})` }}>
                      <Check size={12} color="#fff" strokeWidth={3} />
                    </div>
                    <span style={{ fontFamily: F.body, fontSize: 14, color: C.charcoal }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Btn v="primary" sz="md" onClick={() => {
            setNTrip({ destination: histTrip.dest, tripType: [histTrip.type], days: histTrip.days, weather: "warm", startDate: "", tempRange: "" });
            setWStep(1); setView("new-trip");
          }} style={{ width: "100%", marginTop: 12 }}>
            <Copy size={15} /> Pack for {histTrip.dest} again
          </Btn>
        </div>
      </div>
    );
  }

  // ═══ NEW TRIP WIZARD ═══
  if (view === "new-trip") {
    const steps = ["Where", "Trip type", "Details", "Weather", "Review"];
    return (
      <div style={{ minHeight: "100vh", background: C.cream, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid ${C.borderLight}`, background: "rgba(253,248,240,.95)" }}>
          <button onClick={() => { setView("home"); setWStep(0); setWeatherData(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ArrowLeft size={20} color={C.warmGray} />
          </button>
          <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>New Trip</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "24px 0 8px" }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === wStep ? 24 : 8, height: 8, borderRadius: 4,
              background: i <= wStep ? C.copper : C.creamDark, transition: "all .3s" }} />
          ))}
        </div>

        <div style={{ flex: 1, padding: "24px 28px", maxWidth: 500, margin: "0 auto", width: "100%" }}>
          {/* Step 0: Where */}
          {wStep === 0 && (<div>
            <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400, marginBottom: 8 }}>Where are you headed?</h2>
            <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 32 }}>PackPal will personalize your list.</p>
            <input value={nTrip.destination} onChange={e => setNTrip({ ...nTrip, destination: e.target.value })}
              placeholder="e.g. Tokyo, Tulum, 90210..." autoFocus
              style={{ width: "100%", fontFamily: F.display, fontSize: 28, padding: "16px 0", border: "none",
                borderBottom: `2px solid ${C.borderMedium}`, background: "transparent", outline: "none",
                color: C.charcoal, fontWeight: 400 }}
              onFocus={e => e.target.style.borderBottomColor = C.copper}
              onBlur={e => e.target.style.borderBottomColor = C.borderMedium} />
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, textTransform: "uppercase",
                letterSpacing: ".06em", marginBottom: 12 }}>Quick picks from your history</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["New York", "San Francisco", "Thailand", "Bora Bora", "Morocco", "Mammoth"].map(d => (
                  <button key={d} onClick={() => setNTrip({ ...nTrip, destination: d })}
                    style={{ padding: "8px 16px", borderRadius: 20, border: `1px solid ${C.borderLight}`,
                      background: nTrip.destination === d ? C.copperGlow : C.warmWhite,
                      fontFamily: F.body, fontSize: 13, color: C.charcoal, cursor: "pointer" }}>
                    {HIST_TRIPS.find(t => t.dest === d)?.icon} {d}
                  </button>
                ))}
              </div>
            </div>
          </div>)}

          {/* Step 1: Trip Type */}
          {wStep === 1 && (<div>
            <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400, marginBottom: 8 }}>What kind of trip?</h2>
            <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 28 }}>Select all that apply.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
              {TRIP_TYPES.map(t => {
                const sel = nTrip.tripType.includes(t.id);
                return (<button key={t.id} onClick={() => setNTrip({ ...nTrip, tripType: sel ? nTrip.tripType.filter(x => x !== t.id) : [...nTrip.tripType, t.id] })}
                  style={{ padding: "18px 16px", borderRadius: 16, border: `1.5px solid ${sel ? t.color : C.borderLight}`,
                    background: sel ? `${t.color}10` : C.warmWhite, cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{t.icon}</span>
                  <span style={{ fontFamily: F.body, fontSize: 14, fontWeight: sel ? 600 : 400, color: C.charcoal }}>{t.label}</span>
                </button>);
              })}
            </div>
          </div>)}

          {/* Step 2: Details */}
          {wStep === 2 && (<div>
            <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400, marginBottom: 8 }}>Trip details</h2>
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: ".06em", color: C.warmGray, display: "block", marginBottom: 10 }}>How many days?</label>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button onClick={() => setNTrip({ ...nTrip, days: Math.max(1, nTrip.days - 1) })}
                  style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${C.borderMedium}`,
                    background: C.warmWhite, cursor: "pointer", fontSize: 20, color: C.charcoal,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 400, minWidth: 50, textAlign: "center" }}>{nTrip.days}</span>
                <button onClick={() => setNTrip({ ...nTrip, days: Math.min(30, nTrip.days + 1) })}
                  style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${C.borderMedium}`,
                    background: C.warmWhite, cursor: "pointer", fontSize: 20, color: C.charcoal,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                <span style={{ fontFamily: F.body, fontSize: 14, color: C.softGray }}>days</span>
              </div>
            </div>
            <div>
              <label style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: ".06em", color: C.warmGray, display: "block", marginBottom: 10 }}>Start date (optional)</label>
              <input type="date" value={nTrip.startDate} onChange={e => setNTrip({ ...nTrip, startDate: e.target.value })}
                style={{ fontFamily: F.body, fontSize: 15, padding: "12px 16px", border: `1.5px solid ${C.borderMedium}`,
                  borderRadius: 12, background: C.warmWhite, color: C.charcoal, outline: "none", width: "100%" }} />
            </div>
          </div>)}

          {/* Step 3: Weather / Temperature */}
          {wStep === 3 && (<div>
            <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400, marginBottom: 8 }}>Weather check</h2>
            <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 24 }}>
              We'll try to look up the forecast, or you can pick a temperature range.
            </p>

            {/* Auto-fetch */}
            <div style={{ marginBottom: 24 }}>
              <Btn v="teal" sz="md" onClick={() => doFetchWeather(nTrip.destination)} disabled={weatherLoading || !nTrip.destination}>
                {weatherLoading ? <><Loader size={15} className="spin" /> Checking weather...</> : <><CloudRain size={15} /> Look up forecast for {nTrip.destination || "..."}</>}
              </Btn>
            </div>

            {weatherData && (
              <div style={{ background: C.tealGlow, borderRadius: 16, padding: 20, marginBottom: 24,
                border: `1px solid rgba(78,173,197,.2)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Thermometer size={16} color={C.teal} />
                  <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.teal }}>Current: {weatherData.current.tempF}°F — {weatherData.current.desc}</span>
                </div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {weatherData.forecast.slice(0, 7).map((d, i) => (
                    <div key={i} style={{ minWidth: 70, textAlign: "center", padding: "8px 6px",
                      background: C.warmWhite, borderRadius: 10, border: `1px solid ${C.borderLight}` }}>
                      <div style={{ fontFamily: F.body, fontSize: 10, color: C.softGray }}>
                        {new Date(d.date).toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 600, color: C.charcoal, marginTop: 2 }}>
                        {d.maxF}°
                      </div>
                      <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{d.minF}°</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.teal, marginTop: 10 }}>
                  Auto-detected: <strong>{TEMP_RANGES.find(t => t.id === nTrip.tempRange)?.label}</strong> weather
                </div>
              </div>
            )}

            <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: ".06em", color: C.warmGray, marginBottom: 12 }}>
              {weatherData ? "Or override:" : "Or pick manually:"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {TEMP_RANGES.map(t => (
                <button key={t.id} onClick={() => setNTrip({ ...nTrip, tempRange: t.id })}
                  style={{ padding: "14px 16px", borderRadius: 14, textAlign: "left",
                    border: `1.5px solid ${nTrip.tempRange === t.id ? t.color : C.borderLight}`,
                    background: nTrip.tempRange === t.id ? `${t.color}12` : C.warmWhite,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: nTrip.tempRange === t.id ? 600 : 400, color: C.charcoal }}>{t.label}</div>
                    <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{t.range}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>)}

          {/* Step 4: Review */}
          {wStep === 4 && (<div>
            <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400, marginBottom: 8 }}>Looking good</h2>
            <div style={{ background: C.warmWhite, borderRadius: 20, padding: 28, border: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{TRIP_TYPES.find(t => t.id === nTrip.tripType[0])?.icon || "✈️"}</div>
              <h3 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>
                {nTrip.destination || "Untitled Trip"}
              </h3>
              <div style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 16 }}>
                {nTrip.days} days
                {nTrip.tempRange && ` · ${TEMP_RANGES.find(t => t.id === nTrip.tempRange)?.icon} ${TEMP_RANGES.find(t => t.id === nTrip.tempRange)?.label}`}
                {nTrip.startDate && ` · ${new Date(nTrip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {nTrip.tripType.map(t => {
                  const tt = TRIP_TYPES.find(x => x.id === t);
                  return <span key={t} style={{ padding: "6px 14px", borderRadius: 10, background: `${tt.color}12`,
                    border: `1px solid ${tt.color}30`, fontFamily: F.body, fontSize: 12, fontWeight: 500, color: tt.color }}>
                    {tt.icon} {tt.label}</span>;
                })}
              </div>
            </div>
            <div style={{ marginTop: 20, padding: 16, background: C.sageGlow, borderRadius: 14,
              display: "flex", alignItems: "center", gap: 12 }}>
              <Sparkles size={18} color={C.sage} />
              <span style={{ fontFamily: F.body, fontSize: 13, color: C.sageDark, lineHeight: 1.4 }}>
                Your list will include smart recs for your trip type + weather, with "don't forget" reminders for your blind spots.
              </span>
            </div>
          </div>)}
        </div>

        <div style={{ padding: "16px 28px 28px", display: "flex", gap: 12, maxWidth: 500, margin: "0 auto", width: "100%" }}>
          {wStep > 0 && <Btn v="secondary" sz="lg" onClick={() => setWStep(s => s - 1)} style={{ flex: 1 }}>Back</Btn>}
          {wStep < 4 ? (
            <Btn v="primary" sz="lg" disabled={(wStep === 0 && !nTrip.destination.trim()) || (wStep === 1 && nTrip.tripType.length === 0)}
              onClick={() => setWStep(s => s + 1)} style={{ flex: 1 }}>Continue <ChevronRight size={18} /></Btn>
          ) : (
            <Btn v="sage" sz="lg" onClick={createTrip} style={{ flex: 1 }}>
              <Sparkles size={18} /> Generate my list
            </Btn>
          )}
        </div>
      </div>
    );
  }

  // ═══ TRIP VIEW ═══
  if (view === "trip" && activeTrip) {
    const st = stats(activeTrip);
    let fitems = activeTrip.items;
    if (searchQ) { const q = searchQ.toLowerCase(); fitems = fitems.filter(i => i.name.toLowerCase().includes(q) || i.section.toLowerCase().includes(q)); }
    if (catFilter) fitems = fitems.filter(i => i.category === catFilter);
    const grouped = groupItems(fitems);
    const refillCount = activeTrip.items.filter(i => i.needsRefill).length;

    return (
      <div style={{ minHeight: "100vh", background: C.cream }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,${C.warmWhite},${C.cream})`, padding: "20px 24px 24px",
          borderBottom: `1px solid ${C.borderLight}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => { setView("home"); setSearchQ(""); setCatFilter(null); setRefillMode(false); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <ArrowLeft size={20} color={C.warmGray} />
            </button>
            <div style={{ flex: 1 }} />
            <Btn v="ghost" sz="sm" onClick={() => dupTrip(activeTrip)}><Copy size={14} /></Btn>
            <Btn v="ghost" sz="sm" onClick={() => { if (confirm("Delete this trip?")) deleteTrip(activeTrip.id); }}
              style={{ color: C.danger }}><Trash2 size={14} /></Btn>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ProgressRing pct={st.pct} size={80} sw={5}>
              <span style={{ fontFamily: F.display, fontSize: 22, color: C.charcoal, fontWeight: 500 }}>{st.pct}%</span>
            </ProgressRing>
            <div>
              <h1 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, margin: 0, lineHeight: 1.2 }}>
                {activeTrip.icon} {activeTrip.destination}
              </h1>
              <div style={{ fontFamily: F.body, fontSize: 13, color: C.warmGray, marginTop: 4 }}>
                {activeTrip.days} days · {st.pk} of {st.tot} packed
                {activeTrip.tempRange && ` · ${TEMP_RANGES.find(t => t.id === activeTrip.tempRange)?.icon}`}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
            <Btn v="primary" sz="sm" onClick={() => setOutfitMode(true)} style={{ flex: 1 }}>
              <Shirt size={15} /> Build Outfits
            </Btn>
            <Btn v="secondary" sz="sm" onClick={() => setGuidedMode(true)} style={{ flex: 1 }}>
              <Zap size={15} /> Focus Pack
            </Btn>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Btn v="lavender" sz="sm" onClick={() => setFreakOut(true)} style={{ flex: 1 }}>
              <Brain size={15} /> Freak Out
            </Btn>
            <Btn v="teal" sz="sm" onClick={() => setShowRecs(true)} style={{ flex: 1 }}>
              <Sparkles size={14} /> Smart Recs
            </Btn>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Btn v={refillMode ? "sage" : "secondary"} sz="sm" onClick={() => setRefillMode(!refillMode)} style={{ flex: 1 }}>
              <RefreshCw size={14} /> {refillMode ? `Done (${refillCount} refills)` : "Check Refills"}
            </Btn>
            <Btn v="secondary" sz="sm" onClick={() => {
              setTrips(p => p.map(t => t.id === activeTrip.id ? { ...t, items: t.items.map(i => ({ ...i, packed: false })) } : t));
              setActiveTrip(p => ({ ...p, items: p.items.map(i => ({ ...i, packed: false })) }));
            }}><RotateCcw size={14} /></Btn>
          </div>

          {refillMode && (
            <div style={{ marginTop: 12, background: C.amberGlow, borderRadius: 12, padding: "10px 16px",
              display: "flex", alignItems: "center", gap: 8, border: `1px solid rgba(212,160,74,.15)` }}>
              <RefreshCw size={14} color={C.amber} />
              <span style={{ fontFamily: F.body, fontSize: 13, color: C.amber }}>
                Refill mode: tap items you need to restock before your trip
              </span>
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div style={{ padding: "16px 24px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
            background: C.warmWhite, borderRadius: 14, border: `1px solid ${C.borderLight}` }}>
            <Search size={16} color={C.softGray} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search items..."
              style={{ flex: 1, border: "none", background: "none", outline: "none",
                fontFamily: F.body, fontSize: 14, color: C.charcoal }} />
            {searchQ && <button onClick={() => setSearchQ("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
              <X size={14} color={C.softGray} /></button>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto", paddingBottom: 4 }}>
            <button onClick={() => setCatFilter(null)} style={{ padding: "6px 14px", borderRadius: 10, whiteSpace: "nowrap",
              border: `1px solid ${!catFilter ? C.copper : C.borderLight}`,
              background: !catFilter ? C.copperGlow : "transparent",
              fontFamily: F.body, fontSize: 12, fontWeight: 500, color: !catFilter ? C.copper : C.warmGray, cursor: "pointer" }}>All</button>
            {CATEGORIES.map(cat => {
              const ci = activeTrip.items.filter(i => i.category === cat.id);
              if (!ci.length) return null;
              const cp = ci.filter(i => i.packed).length, active = catFilter === cat.id;
              return (<button key={cat.id} onClick={() => setCatFilter(active ? null : cat.id)}
                style={{ padding: "6px 14px", borderRadius: 10, whiteSpace: "nowrap",
                  border: `1px solid ${active ? cat.color : C.borderLight}`,
                  background: active ? `${cat.color}15` : "transparent",
                  fontFamily: F.body, fontSize: 12, fontWeight: 500, color: active ? cat.color : C.warmGray,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {cat.icon} {cat.label} <span style={{ opacity: .6 }}>{cp}/{ci.length}</span>
              </button>);
            })}
          </div>
        </div>

        {/* Items */}
        <div style={{ padding: "8px 16px 100px" }}>
          {CATEGORIES.map(cat => {
            const cs = grouped[cat.id]; if (!cs) return null;
            const ci = activeTrip.items.filter(i => i.category === cat.id);
            const cp = ci.filter(i => i.packed).length, allDone = cp === ci.length;
            return (
              <div key={cat.id} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 8px 4px" }}>
                  <span style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span style={{ fontFamily: F.display, fontSize: 20, color: C.charcoal, fontWeight: 500 }}>{cat.label}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: allDone ? C.sage : C.softGray }}>
                    {allDone ? "✓ Complete" : `${cp}/${ci.length}`}
                  </span>
                </div>
                <div style={{ background: C.warmWhite, borderRadius: 16, border: `1px solid ${C.borderLight}`, padding: "4px 0" }}>
                  {Object.entries(cs).map(([sec, items]) => (
                    <PackSection key={sec} title={sec} items={items}
                      onToggle={iid => toggle(activeTrip.id, iid)} onRemove={iid => removeItem(activeTrip.id, iid)}
                      onAddItem={name => addItem(activeTrip.id, sec, cat.id, name)}
                      readOnly={false} refillMode={refillMode}
                      onToggleRefill={iid => toggleRefill(activeTrip.id, iid)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══ INSIGHTS ═══
  if (view === "insights") {
    return (
      <div style={{ minHeight: "100vh", background: C.cream }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid ${C.borderLight}` }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ArrowLeft size={20} color={C.warmGray} />
          </button>
          <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>Insights</span>
        </div>
        <div style={{ padding: "24px 20px" }}>
          <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>Your packing intelligence</h2>
          <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 28 }}>Built from 22 trips of personal data.</p>
          <Insights trips={trips} />
        </div>
      </div>
    );
  }

  // ═══ HISTORY ═══
  if (view === "history") {
    return (
      <div style={{ minHeight: "100vh", background: C.cream }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid ${C.borderLight}` }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ArrowLeft size={20} color={C.warmGray} />
          </button>
          <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>Trip History</span>
        </div>
        <div style={{ padding: "24px 20px" }}>
          <h2 style={{ fontFamily: F.display, fontSize: 28, color: C.charcoal, fontWeight: 400, marginBottom: 4 }}>Past adventures</h2>
          <p style={{ fontFamily: F.body, fontSize: 14, color: C.warmGray, marginBottom: 24 }}>Tap any trip to see what you packed.</p>
          <div style={{ display: "grid", gap: 10 }}>
            {HIST_TRIPS.map(t => (
              <button key={t.dest} onClick={() => { setHistTrip(t); setView("hist-detail"); }}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 16,
                  background: C.warmWhite, border: `1px solid ${C.borderLight}`, cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "all .2s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${C.shadowMed}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <span style={{ fontSize: 28 }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F.body, fontSize: 15, fontWeight: 500, color: C.charcoal }}>{t.dest}</div>
                  <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>{t.dates} · {t.days} days</div>
                </div>
                <div style={{ padding: "4px 12px", borderRadius: 8, background: C.copperSubtle,
                  fontFamily: F.body, fontSize: 11, fontWeight: 500, color: C.warmGray, textTransform: "capitalize" }}>{t.type}</div>
                <ChevronRight size={16} color={C.softGray} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ═══ HOME ═══
  return (
    <div style={{ minHeight: "100vh", background: C.cream }}>
      <div style={{ padding: "48px 28px 32px",
        background: `linear-gradient(160deg,${C.warmWhite} 0%,${C.cream} 60%,rgba(193,127,89,.05) 100%)` }}>
        <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".12em", color: C.copper, marginBottom: 8 }}>PackPal</div>
        <h1 style={{ fontFamily: F.display, fontSize: 40, color: C.charcoal, fontWeight: 400, margin: 0, lineHeight: 1.15 }}>
          Pack smarter,<br />not harder.
        </h1>
        <p style={{ fontFamily: F.body, fontSize: 15, color: C.warmGray, marginTop: 12, lineHeight: 1.5, maxWidth: 340 }}>
          Your personal packing assistant, trained on 22 of your real trips.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <Btn v="primary" sz="lg" onClick={() => setView("new-trip")}><Plus size={18} /> New Trip</Btn>
          <Btn v="lavender" sz="lg" onClick={() => setFreakOut(true)}><Brain size={18} /> Freak Out</Btn>
        </div>
      </div>

      {/* Active trips */}
      {trips.length > 0 && (
        <div style={{ padding: "0 20px 24px" }}>
          <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: ".08em", color: C.warmGray, padding: "20px 8px 12px" }}>Your trips</div>
          <div style={{ display: "grid", gap: 12 }}>
            {trips.map(trip => {
              const st = stats(trip);
              return (
                <button key={trip.id} onClick={() => { setActiveTrip(trip); setView("trip"); }}
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: 18,
                    background: C.warmWhite, border: `1px solid ${C.borderLight}`, cursor: "pointer",
                    textAlign: "left", width: "100%", transition: "all .2s", boxShadow: `0 2px 8px ${C.shadow}` }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 16px ${C.shadowMed}`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 2px 8px ${C.shadow}`; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <ProgressRing pct={st.pct} size={52} sw={4}>
                    <span style={{ fontSize: 20 }}>{trip.icon}</span>
                  </ProgressRing>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.body, fontSize: 16, fontWeight: 500, color: C.charcoal }}>{trip.destination}</div>
                    <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>
                      {trip.days} days · {st.pk}/{st.tot} packed
                    </div>
                  </div>
                  <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 500,
                    color: st.pct === 100 ? C.sage : C.copper }}>{st.pct}%</div>
                  <ChevronRight size={18} color={C.softGray} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ padding: "0 20px 32px" }}>
        <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".08em", color: C.warmGray, padding: "8px 8px 12px" }}>Explore</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          {[
            { label: "Trip History", sub: "22 past trips", icon: <Clock size={20} />, act: () => setView("history"), col: C.copper },
            { label: "Insights", sub: "Patterns & tips", icon: <BarChart3 size={20} />, act: () => setView("insights"), col: C.sage },
            { label: "Freak Out Mode", sub: "ADHD support", icon: <Brain size={20} />, act: () => setFreakOut(true), col: C.lavender },
            { label: "Quick Pack", sub: "Weekend getaway", icon: <Timer size={20} />, act: () => {
              setNTrip({ destination: "", tripType: ["city"], days: 3, weather: "warm", startDate: "", tempRange: "warm" });
              setView("new-trip");
            }, col: "#C47EAA" },
          ].map(({ label, sub, icon, act, col }) => (
            <button key={label} onClick={act} style={{ padding: "22px 18px", borderRadius: 18, textAlign: "left",
              background: C.warmWhite, border: `1px solid ${C.borderLight}`, cursor: "pointer",
              transition: "all .2s", boxShadow: `0 1px 4px ${C.shadow}` }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 16px ${C.shadowMed}`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 1px 4px ${C.shadow}`; }}>
              <div style={{ color: col, marginBottom: 12 }}>{icon}</div>
              <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.charcoal }}>{label}</div>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, marginTop: 2 }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 28px 40px", textAlign: "center", borderTop: `1px solid ${C.borderLight}` }}>
        <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, letterSpacing: ".04em" }}>
          Built for Elizabeth · Powered by 22 trips of real data
        </div>
      </div>
    </div>
  );
}
