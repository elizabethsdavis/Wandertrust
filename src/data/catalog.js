// The core packing catalog distilled from 22 historical trips. Each item has a
// frequency `f` (0–1, how often it was packed), `e` (essential), `ff`
// (frequently forgotten), and optional `cond` (trip types that warrant it).

export const CORE = {
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

// Conditional add-ons layered on top of CORE for specific trip types.
export const COND_ITEMS = {
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
