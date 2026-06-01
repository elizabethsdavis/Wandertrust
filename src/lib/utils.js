// Small, dependency-free helpers shared across the whole app.

/** Short, collision-resistant id for client-created entities (trips, items). */
export const id = () => Math.random().toString(36).substr(2, 9);

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
