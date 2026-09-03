import { useState } from "react";
import { User, LogOut, Fingerprint, Cloud, CloudOff, Check, Loader, X, RefreshCw, AlertTriangle, RotateCw } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useStoreMeta } from "../lib/store";
import { C, F } from "../lib/theme";
import { passkeysConfigured, registerPasskey, hasPasskeyHint } from "../lib/passkey";
import { reloadApp, versionLabel } from "../lib/version";

function syncMeta(syncState) {
  switch (syncState) {
    case "saving": return { label: "Syncing…", color: C.copper, Icon: Loader, spin: true };
    case "error": return { label: "Not synced — changes are only on this device", color: C.amber, Icon: CloudOff, spin: false };
    case "full": return { label: "Not synced — too much data for the cloud", color: C.danger, Icon: AlertTriangle, spin: false };
    case "local": return { label: "On this device", color: C.softGray, Icon: CloudOff, spin: false };
    default: return { label: "Synced to cloud", color: C.sage, Icon: Cloud, spin: false };
  }
}

const fmtKB = (b) => `${Math.round(b / 1024).toLocaleString()} KB`;

export default function AccountBadge() {
  const { user, isLocal, signOut } = useAuth();
  const { syncState, flush, sizeBytes, sizeLimit, lastRemoteAt } = useStoreMeta();
  const [signingOut, setSigningOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const retrySync = async () => {
    setRetrying(true);
    try { await flush(); } finally { setRetrying(false); }
  };
  const sizePct = sizeLimit ? Math.round((sizeBytes / sizeLimit) * 100) : 0;

  // Sign-out wipes the local mirror, so push anything unsaved first and let the
  // user back out if the cloud can't be reached.
  const doSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const synced = await flush();
      if (!synced && !confirm("Some changes haven't synced to the cloud yet and will be lost if you sign out now. Sign out anyway?")) return;
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };
  const [open, setOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  // The Home Screen "app" has no address bar, so this is the way to refresh it.
  const doReload = async () => { setReloading(true); await reloadApp(flush); };
  const [pkBusy, setPkBusy] = useState(false);
  const [pkMsg, setPkMsg] = useState("");
  const [pkDone, setPkDone] = useState(hasPasskeyHint());

  const meta = syncMeta(syncState);
  const dotColor = syncState === "idle" ? C.sage : syncState === "saving" ? C.copper
    : syncState === "error" ? C.amber : syncState === "full" ? C.danger : C.softGray;

  const addPasskey = async () => {
    setPkMsg("");
    setPkBusy(true);
    try {
      await registerPasskey();
      setPkDone(true);
      setPkMsg("Passkey added — you can use Face ID next time.");
    } catch (e) {
      setPkMsg(e?.message || "Couldn't add a passkey.");
    } finally {
      setPkBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Account"
        style={{ position: "relative", width: 40, height: 40, borderRadius: "50%",
          border: `1px solid ${C.borderLight}`, background: C.warmWhite, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: `0 1px 4px ${C.shadow}` }}>
        <User size={18} color={C.warmGray} />
        <span style={{ position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: "50%",
          background: dotColor, border: `2px solid ${C.warmWhite}` }} />
      </button>

      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(45,41,38,.35)",
            backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 460, background: C.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
              padding: "8px 22px 30px", boxShadow: `0 -8px 40px ${C.shadowMed}`, animation: "fadeIn .2s ease" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: C.borderMedium, margin: "8px auto 18px" }} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ fontFamily: F.display, fontSize: 26, color: C.charcoal, fontWeight: 400, margin: 0 }}>Account</h3>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={20} color={C.softGray} />
              </button>
            </div>

            {/* Identity */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: C.warmWhite,
              borderRadius: 16, border: `1px solid ${C.borderLight}`, marginBottom: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg,${C.copper},${C.copperLight})`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={22} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.body, fontSize: 15, fontWeight: 600, color: C.charcoal }}>
                  {isLocal ? "Local profile" : (user?.phone || "Signed in")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <meta.Icon size={13} color={meta.color} className={meta.spin ? "spin" : ""} />
                  <span style={{ fontFamily: F.body, fontSize: 12.5, color: meta.color }}>{meta.label}</span>
                </div>
              </div>
            </div>

            {isLocal ? (
              <div style={{ padding: "14px 16px", background: C.copperSubtle, borderRadius: 14,
                fontFamily: F.body, fontSize: 13, color: C.warmGray, lineHeight: 1.5 }}>
                You're in offline mode. To create an account and sync across devices, add your Firebase
                keys to <code style={{ fontFamily: "monospace", color: C.copper }}>.env.local</code> — see <strong>SETUP.md</strong>.
              </div>
            ) : (
              <>
                {/* Sync problems — never silent */}
                {syncState === "error" && (
                  <div style={{ padding: "12px 14px", background: C.amberGlow, borderRadius: 14, marginBottom: 10,
                    border: "1px solid rgba(212,160,74,.25)", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.warmGray, lineHeight: 1.45 }}>
                      Your latest changes are saved on this device but haven't reached the cloud. They'll retry automatically when you're back online.
                    </div>
                    <button onClick={retrySync} disabled={retrying}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, flexShrink: 0,
                        border: "none", background: C.amber, color: "#fff", cursor: retrying ? "default" : "pointer",
                        fontFamily: F.body, fontSize: 12.5, fontWeight: 600 }}>
                      {retrying ? <Loader size={13} className="spin" /> : <RefreshCw size={13} />} Retry
                    </button>
                  </div>
                )}
                {syncState === "full" && (
                  <div style={{ padding: "12px 14px", background: C.dangerGlow, borderRadius: 14, marginBottom: 10,
                    border: "1px solid rgba(199,91,91,.25)", fontFamily: F.body, fontSize: 12.5, color: C.warmGray, lineHeight: 1.45 }}>
                    <strong style={{ color: C.danger }}>Cloud sync is paused:</strong> your data ({fmtKB(sizeBytes)}) is over the {fmtKB(sizeLimit)} limit
                    for a single account. Everything is still saved on this device. Deleting old trips frees space — trips with saved
                    weather forecasts are the largest.
                  </div>
                )}
                {lastRemoteAt && (
                  <div style={{ fontFamily: F.body, fontSize: 12, color: C.softGray, padding: "0 4px 10px", lineHeight: 1.4 }}>
                    Updated from another device {new Date(lastRemoteAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
                  </div>
                )}
                {syncState !== "full" && sizePct >= 50 && (
                  <div style={{ fontFamily: F.body, fontSize: 12, color: sizePct >= 80 ? C.amber : C.softGray, padding: "0 4px 10px", lineHeight: 1.4 }}>
                    Cloud storage {sizePct}% used ({fmtKB(sizeBytes)} of {fmtKB(sizeLimit)}). Deleting old trips frees space.
                  </div>
                )}

                {/* Passkey */}
                {passkeysConfigured() && (
                  <button onClick={addPasskey} disabled={pkBusy}
                    style={{ width: "100%", minHeight: 52, borderRadius: 14, cursor: pkBusy ? "default" : "pointer",
                      border: `1px solid ${C.borderLight}`, background: C.warmWhite, marginBottom: 10,
                      display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
                      fontFamily: F.body, fontSize: 14.5, fontWeight: 500, color: C.charcoal }}>
                    {pkBusy ? <Loader size={18} className="spin" color={C.copper} />
                      : pkDone ? <Check size={18} color={C.sage} /> : <Fingerprint size={18} color={C.copper} />}
                    {pkDone ? "Add another passkey" : "Add Face ID / passkey"}
                  </button>
                )}
                {pkMsg && (
                  <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.warmGray, padding: "0 4px 10px", lineHeight: 1.4 }}>
                    {pkMsg}
                  </div>
                )}

                {/* Sign out */}
                <button onClick={doSignOut} disabled={signingOut}
                  style={{ width: "100%", minHeight: 52, borderRadius: 14, cursor: signingOut ? "default" : "pointer",
                    border: `1px solid rgba(199,91,91,.25)`, background: C.dangerGlow,
                    display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
                    fontFamily: F.body, fontSize: 14.5, fontWeight: 600, color: C.danger }}>
                  {signingOut ? <Loader size={18} className="spin" /> : <LogOut size={18} />} {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            )}

            {/* Reload — the only way to refresh from the iPhone Home Screen "app" */}
            <button onClick={doReload} disabled={reloading}
              style={{ width: "100%", minHeight: 52, borderRadius: 14, cursor: reloading ? "default" : "pointer", marginTop: 10,
                border: `1px solid ${C.borderLight}`, background: C.warmWhite,
                display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
                fontFamily: F.body, fontSize: 14.5, fontWeight: 500, color: C.charcoal }}>
              {reloading ? <Loader size={18} className="spin" color={C.copper} /> : <RotateCw size={18} color={C.copper} />}
              {reloading ? "Reloading…" : "Reload app"}
            </button>
            <div style={{ fontFamily: F.body, fontSize: 11.5, color: C.softGray, textAlign: "center", marginTop: 12 }}>
              Version {versionLabel()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
