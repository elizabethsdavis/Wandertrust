// Shared drag-and-drop bits (dnd-kit) for Arrange mode and the template editor:
// sensors tuned so a phone swipe still scrolls (touch needs a short hold) and
// the grip handle every draggable row shows.
import { PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { C } from "../lib/theme";

export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

export function Grip({ attributes, listeners, label, size = 32 }) {
  return (
    <button type="button" {...attributes} {...listeners} aria-label={label} title="Drag to reorder"
      style={{ width: size, height: size, borderRadius: 8, border: "none", background: "transparent", cursor: "grab",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, touchAction: "none", color: C.softGray }}>
      <GripVertical size={size > 28 ? 18 : 16} />
    </button>
  );
}
