// Insights — packing patterns across historical + current trips.
import { Plane, PackageCheck, Award, TrendingUp, Brain, BarChart3, Star } from "lucide-react";
import { C, F } from "../lib/theme";
import { TRIP_TYPES, CATEGORIES } from "../data/taxonomy";
import { HIST_TRIPS } from "../data/history";
import { MiniBar } from "./ui";

// ── Insights Component (Visual) ──
export function Insights({ trips }) {
  const total = trips.length + HIST_TRIPS.length;
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
