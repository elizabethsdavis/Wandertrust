// "Not saved to the cloud yet" banner (Sync Fix batch). The sync dot on the
// Account button was the only sign that a save had failed, and on the phone
// it is easy to miss; edits that never reach the cloud vanish on the next
// reload of the other tab. Shown on any screen once a save has been failing
// for a few seconds; the engine keeps retrying in the background (the banner
// stays up through those attempts), Retry pushes now. The "too much data"
// case has its own wording (see Account for details).
import { useEffect, useRef, useState } from "react";
import { CloudOff, RotateCw, Loader, AlertTriangle } from "lucide-react";
import { C, F } from "../lib/theme";
import { useStoreMeta } from "../lib/store";

const SHOW_AFTER_MS = 4000; // a single blip (e.g. a train tunnel) never shows the banner

export default function SyncBanner() {
  const { syncState, flush, dirty } = useStoreMeta();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const failing = dirty && (syncState === "error" || syncState === "full");
  const recovered = !dirty || syncState === "idle" || syncState === "local";

  useEffect(() => {
    if (recovered) {
      clearTimeout(timer.current);
      timer.current = null;
      setVisible(false);
      return;
    }
    if (failing && !timer.current) {
      // "saving" in between two failed attempts leaves the banner as it is.
      timer.current = setTimeout(() => setVisible(true), syncState === "full" ? 0 : SHOW_AFTER_MS);
    }
  }, [failing, recovered, syncState]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!visible || recovered) return null;
  const full = syncState === "full";

  const retry = async () => {
    setBusy(true);
    try {
      await flush();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="status" aria-live="polite"
      style={{ position: "fixed", left: 16, right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 1190,
        display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, maxWidth: 460, width: "100%",
        padding: "10px 10px 10px 14px", borderRadius: 16, background: full ? C.danger : C.charcoal, color: "#fff",
        boxShadow: `0 10px 30px ${C.shadowMed}`, animation: "fadeIn .25s ease" }}>
        {full ? <AlertTriangle size={16} style={{ flexShrink: 0 }} /> : <CloudOff size={16} style={{ flexShrink: 0 }} />}
        <span style={{ flex: 1, fontFamily: F.body, fontSize: 13, lineHeight: 1.35 }}>
          {full ? "Too much data for the cloud — recent changes are only on this device." : "Changes aren't saved to the cloud yet — kept on this device, retrying."}
        </span>
        {!full && (
          <button onClick={retry} disabled={busy} aria-label="Retry sync"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg,${C.copper},${C.copperLight})`, color: "#fff", fontFamily: F.body, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            {busy || syncState === "saving" ? <Loader size={14} className="spin" /> : <RotateCw size={14} />} Retry
          </button>
        )}
      </div>
    </div>
  );
}
