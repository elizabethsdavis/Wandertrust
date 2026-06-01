// The 22 historical trips that seed the app's intelligence and the read-only
// Trip History view. Also offered as a one-time import during onboarding.

export const HIST_TRIPS = [
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
