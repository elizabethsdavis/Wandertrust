// Smart Recs — temperature + trip-type recommendations to add to a trip.
import { useState } from "react";
import { Plus, Check, Sparkles, ArrowLeft, Thermometer } from "lucide-react";
import { C, F } from "../lib/theme";
import { TRIP_TYPES, TEMP_RANGES } from "../data/taxonomy";
import { TEMP_RECS, SMART_RECS } from "../data/recommendations";

// ── Smart Recommendations Step ──
export function SmartRecsView({ tripTypes, tempRange, onAdd, onClose }) {
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
