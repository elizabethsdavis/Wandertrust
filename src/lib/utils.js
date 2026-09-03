// Small, dependency-free helpers shared across the whole app.

/** Short, collision-resistant id for client-created entities (trips, items). */
export const id = () => Math.random().toString(36).substr(2, 9);

/**
 * Last user-perceived character (grapheme cluster) of a string. Used by the
 * emoji inputs to keep only the most recently typed emoji: flags, skin tones
 * and ZWJ sequences span several UTF-16 units, so a naive `.slice(-2)` tears
 * them apart. Falls back to code points where Intl.Segmenter is unavailable.
 */
export const lastGrapheme = (str) => {
  const s = str || "";
  if (!s) return "";
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    let last = "";
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)) last = segment;
    return last;
  }
  return Array.from(s).slice(-1)[0] || "";
};

/** Fire a haptic pulse on supported devices; a silent no-op everywhere else. */
export const haptic = (style = "light") => {
  try {
    if (navigator.vibrate) {
      if (style === "light") navigator.vibrate(10);
      else if (style === "medium") navigator.vibrate(20);
      else if (style === "success") navigator.vibrate([12, 60, 12]);
      else if (style === "celebration") navigator.vibrate([15, 40, 15, 40, 25]);
    }
  } catch {
    /* vibration unsupported on this device — ignore */
  }
};
