// Editor for the global Out-the-Door defaults (Home → Out the Door).
import { useState, useEffect, useRef } from "react";
import { Plus, ArrowLeft, X } from "lucide-react";
import { C, F } from "../lib/theme";
import { haptic } from "../lib/utils";
import { Btn } from "./ui";
import { DEFAULT_OTD_ITEMS } from "../data/otdDefaults";

// ── Global OTD Editor ──
export function GlobalOtdEditor({ items, setItems, onExit }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const addRef = useRef(null);
  useEffect(() => { if (adding && addRef.current) addRef.current.focus(); }, [adding]);

  const doAdd = () => {
    if (newName.trim()) {
      setItems(prev => [...prev, { name: newName.trim(), emoji: newEmoji || "📌" }]);
      setNewName(""); setNewEmoji(""); setAdding(false);
      haptic("success");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #FFF8F2 0%, ${C.cream} 100%)` }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${C.borderLight}`, background: "rgba(255,248,242,.95)", backdropFilter: "blur(10px)" }}>
        <button onClick={onExit} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ArrowLeft size={20} color={C.warmGray} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F.body, fontSize: 15, fontWeight: 600, color: C.charcoal }}>Out the Door Defaults</div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.softGray }}>{items.length} items · Starting list for every new trip</div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 120px" }}>
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.warmGray, marginBottom: 16, padding: "0 4px", lineHeight: 1.5 }}>
          This is your global out-the-door checklist. New trips start with a copy of this list — you can then customize it per trip.
        </p>

        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 4,
            borderRadius: 12, background: C.warmWhite, border: `1px solid ${C.borderLight}` }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{item.emoji}</span>
            <span style={{ flex: 1, fontFamily: F.body, fontSize: 14, color: C.charcoal }}>{item.name}</span>
            <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6,
                display: "flex", color: C.softGray, transition: "color .15s" }}
              onMouseEnter={e => e.currentTarget.style.color = C.danger}
              onMouseLeave={e => e.currentTarget.style.color = C.softGray}>
              <X size={16} />
            </button>
          </div>
        ))}

        {adding ? (
          <form onSubmit={e => { e.preventDefault(); doAdd(); }}
            style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <button onClick={() => {
              const emojis = ["📌","🔑","📱","💳","🎒","💊","🎧","🧴","📄","🧥","☂️","🔌","💻","📷","🪥","✈️"];
              setNewEmoji(emojis[Math.floor(Math.random() * emojis.length)]);
            }} type="button"
              style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                border: `1.5px solid ${C.borderMedium}`, background: C.cream, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>
              {newEmoji || "📌"}
            </button>
            <input ref={addRef} value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Laptop charger, Travel pillow..."
              onBlur={() => { if (!newName.trim()) setTimeout(() => setAdding(false), 150); }}
              style={{ flex: 1, fontFamily: F.body, fontSize: 14, padding: "10px 14px",
                border: `1.5px solid ${C.borderMedium}`, borderRadius: 10,
                background: C.warmWhite, outline: "none", color: C.charcoal }}
              onFocus={e => e.target.style.borderColor = C.copper} />
            <Btn v="primary" sz="sm" onClick={doAdd}>Add</Btn>
          </form>
        ) : (
          <button onClick={() => setAdding(true)}
            style={{ width: "100%", padding: "14px 16px", borderRadius: 14, marginTop: 8,
              border: `2px dashed ${C.borderMedium}`, background: "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: F.body, fontSize: 14, color: C.copper, transition: "all .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = C.copperSubtle}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <Plus size={16} /> Add item
          </button>
        )}

        <button onClick={() => { if (confirm("Reset to factory defaults? Your customizations will be lost.")) { setItems(DEFAULT_OTD_ITEMS); } }}
          style={{ width: "100%", padding: "12px", borderRadius: 10, marginTop: 16,
            border: "none", background: "transparent", cursor: "pointer",
            fontFamily: F.body, fontSize: 12, color: C.softGray, textAlign: "center" }}>
          Reset to factory defaults
        </button>
      </div>
    </div>
  );
}
