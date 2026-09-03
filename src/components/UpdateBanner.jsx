// "A newer version is ready" banner. Shown on any screen once lib/version.js
// notices that /version.json no longer matches the running build — the Home
// Screen "app" on iOS has no address bar, so this is how a deploy gets picked
// up without force-quitting. Reload flushes unsaved edits first.
import { useState } from "react";
import { RefreshCw, X, Loader } from "lucide-react";
import { C, F } from "../lib/theme";
import { useStoreMeta } from "../lib/store";
import { reloadApp, useUpdateAvailable } from "../lib/version";

export default function UpdateBanner() {
  const { updateAvailable, dismiss } = useUpdateAvailable();
  const { flush } = useStoreMeta();
  const [busy, setBusy] = useState(false);
  if (!updateAvailable) return null;

  const reload = async () => {
    setBusy(true);
    await reloadApp(flush);
  };

  return (
    <div role="status" aria-live="polite"
      style={{ position: "fixed", left: 16, right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 1200,
        display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, maxWidth: 460, width: "100%",
        padding: "10px 10px 10px 16px", borderRadius: 16, background: C.charcoal, color: "#fff",
        boxShadow: `0 10px 30px ${C.shadowMed}`, animation: "fadeIn .25s ease" }}>
        <span style={{ flex: 1, fontFamily: F.body, fontSize: 13.5, lineHeight: 1.35 }}>
          A newer version of PackPal is ready.
        </span>
        <button onClick={reload} disabled={busy}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg,${C.copper},${C.copperLight})`, color: "#fff", fontFamily: F.body, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          {busy ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />} Reload
        </button>
        <button onClick={dismiss} aria-label="Not now"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "rgba(255,255,255,.7)", display: "flex" }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
