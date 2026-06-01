import { useEffect, useMemo, useState } from "react";
import { Sparkles, Check, Plane, Upload, Fingerprint, ArrowRight, Loader } from "lucide-react";
import { useAuth } from "../lib/auth";
import { usePersist } from "../lib/store";
import { C, F } from "../lib/theme";
import { buildStarterTrips, STARTER_COUNT } from "../lib/importHist";
import { passkeysConfigured, platformAuthenticatorAvailable, registerPasskey } from "../lib/passkey";

function OptionCard({ active, onToggle, icon, title, sub, accent = C.copper }) {
  return (
    <button onClick={onToggle}
      style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
        padding: "16px 16px", borderRadius: 18, cursor: "pointer", transition: "all .15s",
        background: active ? `${accent}10` : C.warmWhite,
        border: `1.5px solid ${active ? accent : C.borderLight}` }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: "flex",
        alignItems: "center", justifyContent: "center", background: active ? `${accent}1a` : C.creamDark }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F.body, fontSize: 15, fontWeight: 600, color: C.charcoal }}>{title}</div>
        <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.warmGray, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
      </div>
      <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center",
        justifyContent: "center", background: active ? accent : "transparent",
        border: `1.5px solid ${active ? accent : C.borderMedium}` }}>
        {active && <Check size={15} color="#fff" strokeWidth={3} />}
      </div>
    </button>
  );
}

export default function Onboarding() {
  const { markOnboarded } = useAuth();
  const [, setTrips] = usePersist("trips", []);
  const [, setWardrobe] = usePersist("wardrobe", {});
  const [, setCustomOccasions] = usePersist("customOccasions", []);
  const [, setOtdItems] = usePersist("otdItems", []);

  const [importStarters, setImportStarters] = useState(false);
  const [bringLocal, setBringLocal] = useState(true);
  const [setupPk, setSetupPk] = useState(false);
  const [canPk, setCanPk] = useState(false);
  const [busy, setBusy] = useState(false);

  // Everything this device has saved locally: trips (active + completed) plus
  // the outfits, custom occasions, and customized out-the-door list.
  const localData = useMemo(() => {
    const read = (k, fb) => {
      try {
        const v = JSON.parse(localStorage.getItem("pp2_" + k) || "null");
        return v ?? fb;
      } catch {
        return fb;
      }
    };
    const tripsRaw = read("trips", []);
    const trips = Array.isArray(tripsRaw) ? tripsRaw : [];
    const wardrobe = read("wardrobe", {}) || {};
    const coRaw = read("customOccasions", []);
    const customOccasions = Array.isArray(coRaw) ? coRaw : [];
    const otdRaw = read("otdItems", []);
    const otdItems = Array.isArray(otdRaw) ? otdRaw : [];
    const completed = trips.filter(
      (t) => Array.isArray(t.items) && t.items.length > 0 && t.items.every((i) => i.packed)
    ).length;
    return {
      trips,
      wardrobe,
      customOccasions,
      otdItems,
      completed,
      active: trips.length - completed,
      hasExtras:
        customOccasions.length > 0 || Object.keys(wardrobe).length > 0 || otdItems.length > 0,
    };
  }, []);
  const hasLocal = localData.trips.length > 0;

  const localSub = (() => {
    const parts = [`${localData.active} in progress`];
    if (localData.completed) parts.push(`${localData.completed} completed`);
    return parts.join(" · ") + (localData.hasExtras ? " · plus your outfits & preferences" : "");
  })();

  useEffect(() => {
    if (!passkeysConfigured()) return;
    platformAuthenticatorAvailable().then((ok) => {
      setCanPk(ok);
      setSetupPk(ok);
    });
  }, []);

  const finish = async () => {
    setBusy(true);
    try {
      const merged = [];
      if (bringLocal && hasLocal) {
        // Your own trips first, then any starter lists.
        merged.push(...localData.trips);
        // Bring the associated data so imported trips keep their outfits/settings.
        if (Object.keys(localData.wardrobe).length) setWardrobe(localData.wardrobe);
        if (localData.customOccasions.length) setCustomOccasions(localData.customOccasions);
        if (localData.otdItems.length) setOtdItems(localData.otdItems);
      }
      if (importStarters) merged.push(...buildStarterTrips());
      if (merged.length) setTrips(merged);
      if (setupPk && canPk) {
        try {
          await registerPasskey();
        } catch {
          /* non-fatal — they can add it later from Account */
        }
      }
      await markOnboarded();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(170deg,${C.warmWhite} 0%,${C.cream} 60%,rgba(193,127,89,.05) 100%)`,
      display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: "56px 24px 24px", maxWidth: 460, margin: "0 auto", width: "100%" }}>
        <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".14em", color: C.copper, marginBottom: 10 }}>You're in</div>
        <h1 style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 400, lineHeight: 1.12, margin: 0 }}>
          Let's set up<br />your packing.
        </h1>
        <p style={{ fontFamily: F.body, fontSize: 14.5, color: C.warmGray, marginTop: 12, marginBottom: 28, lineHeight: 1.5 }}>
          Start with a clean slate, or bring in some trips to begin with. You can change any of this later.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <OptionCard active={importStarters} onToggle={() => setImportStarters((v) => !v)}
            icon={<Sparkles size={20} color={importStarters ? C.copper : C.softGray} />}
            title={`Import the ${STARTER_COUNT} starter lists`}
            sub="Fully itemized trips — from Thailand to Bora Bora — to explore and reuse." />

          {hasLocal && (
            <OptionCard active={bringLocal} onToggle={() => setBringLocal((v) => !v)} accent={C.sage}
              icon={<Upload size={20} color={bringLocal ? C.sageDark : C.softGray} />}
              title={`Bring my ${localData.trips.length} trip${localData.trips.length === 1 ? "" : "s"} from this device`}
              sub={localSub} />
          )}

          {canPk && (
            <OptionCard active={setupPk} onToggle={() => setSetupPk((v) => !v)} accent={C.lavender}
              icon={<Fingerprint size={20} color={setupPk ? C.lavender : C.softGray} />}
              title="Set up Face ID / passkey"
              sub="Skip the texts next time and sign in with a glance." />
          )}
        </div>

        {!importStarters && !(bringLocal && hasLocal) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, padding: "12px 16px",
            background: C.sageGlow, borderRadius: 14 }}>
            <Plane size={16} color={C.sageDark} />
            <span style={{ fontFamily: F.body, fontSize: 13, color: C.sageDark, lineHeight: 1.4 }}>
              Starting fresh — your first trip is one tap away.
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: "16px 24px 32px", maxWidth: 460, margin: "0 auto", width: "100%" }}>
        <button onClick={finish} disabled={busy}
          style={{ width: "100%", minHeight: 56, borderRadius: 16, border: "none", cursor: busy ? "default" : "pointer",
            background: `linear-gradient(135deg,${C.copper},${C.copperLight})`, color: "#fff",
            boxShadow: "0 2px 14px rgba(193,127,89,.32)", fontFamily: F.body, fontSize: 16.5, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
          {busy ? <Loader size={19} className="spin" /> : <>Enter PackPal <ArrowRight size={18} /></>}
        </button>
      </div>
    </div>
  );
}
