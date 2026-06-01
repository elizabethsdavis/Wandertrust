import { useState } from "react";
import { User, LogOut, Fingerprint, Cloud, CloudOff, Check, Loader, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useStoreMeta } from "../lib/store";
import { C, F } from "../lib/theme";
import { passkeysConfigured, registerPasskey, hasPasskeyHint } from "../lib/passkey";

function syncMeta(syncState) {
  switch (syncState) {
    case "saving": return { label: "Syncing…", color: C.copper, Icon: Loader, spin: true };
    case "error": return { label: "Saved on this device", color: C.amber, Icon: CloudOff, spin: false };
    case "local": return { label: "On this device", color: C.softGray, Icon: CloudOff, spin: false };
    default: return { label: "Synced to cloud", color: C.sage, Icon: Cloud, spin: false };
  }
}

export default function AccountBadge() {
  const { user, isLocal, signOut } = useAuth();
  const { syncState } = useStoreMeta();
  const [open, setOpen] = useState(false);
  const [pkBusy, setPkBusy] = useState(false);
  const [pkMsg, setPkMsg] = useState("");
  const [pkDone, setPkDone] = useState(hasPasskeyHint());

  const meta = syncMeta(syncState);
  const dotColor = syncState === "idle" ? C.sage : syncState === "saving" ? C.copper : C.softGray;

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
                You're in offline mode. To create an account and sync across devices, add your Supabase
                keys to <code style={{ fontFamily: "monospace", color: C.copper }}>.env.local</code> — see <strong>SETUP.md</strong>.
              </div>
            ) : (
              <>
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
                <button onClick={signOut}
                  style={{ width: "100%", minHeight: 52, borderRadius: 14, cursor: "pointer",
                    border: `1px solid rgba(199,91,91,.25)`, background: C.dangerGlow,
                    display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
                    fontFamily: F.body, fontSize: 14.5, fontWeight: 600, color: C.danger }}>
                  <LogOut size={18} /> Sign out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
