import { useEffect, useRef, useState } from "react";
import { Phone, ArrowLeft, ArrowRight, Loader, KeyRound, AlertCircle, Fingerprint, Check } from "lucide-react";
import { useAuth } from "../lib/auth";
import { C, F, COUNTRY_CODES } from "../lib/theme";
import {
  passkeysConfigured,
  platformAuthenticatorAvailable,
  hasPasskeyHint,
  loginWithPasskey,
} from "../lib/passkey";

export default function AuthGate() {
  const { sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState("phone"); // phone | code
  const [cc, setCc] = useState("+1");
  const [national, setNational] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [canPasskey, setCanPasskey] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const codeRef = useRef(null);

  const phone = cc + national.replace(/\D/g, "");
  const phoneValid = national.replace(/\D/g, "").length >= 6;
  const otpValid = otp.replace(/\D/g, "").length >= 4;

  useEffect(() => {
    if (!passkeysConfigured()) return;
    platformAuthenticatorAvailable().then(setCanPasskey);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const doSend = async () => {
    setError("");
    setBusy(true);
    const { error } = await sendOtp(phone);
    setBusy(false);
    if (error) {
      setError(error.message || "Couldn't send the code. Check the number and try again.");
      return;
    }
    setStep("code");
    setCooldown(30);
    setTimeout(() => codeRef.current?.focus(), 60);
  };

  const doVerify = async () => {
    setError("");
    setBusy(true);
    const { error } = await verifyOtp(phone, otp.replace(/\D/g, ""));
    setBusy(false);
    if (error) setError(error.message || "That code didn't match. Try again.");
    // On success the auth listener swaps this screen out.
  };

  const doPasskey = async () => {
    setError("");
    setPasskeyBusy(true);
    try {
      // Discoverable credential — no phone needed. On success the auth
      // listener swaps this screen out automatically.
      await loginWithPasskey();
    } catch (e) {
      setError(e?.message || "Passkey sign-in was cancelled.");
    } finally {
      setPasskeyBusy(false);
    }
  };

  const inputBase = {
    fontFamily: F.body,
    fontSize: 16,
    color: C.charcoal,
    background: C.warmWhite,
    border: `1.5px solid ${C.borderMedium}`,
    borderRadius: 14,
    outline: "none",
    width: "100%",
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(170deg,${C.warmWhite} 0%,${C.cream} 55%,rgba(193,127,89,.06) 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 22px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: ".14em", color: C.copper, marginBottom: 10 }}>PackPal</div>
          <h1 style={{ fontFamily: F.display, fontSize: 38, color: C.charcoal, fontWeight: 400, lineHeight: 1.1, margin: 0 }}>
            {step === "phone" ? "Welcome in." : "Check your texts."}
          </h1>
          <p style={{ fontFamily: F.body, fontSize: 14.5, color: C.warmGray, marginTop: 12, lineHeight: 1.5 }}>
            {step === "phone"
              ? "Sign in with your phone number. Your trips sync to every device."
              : <>We sent a 6-digit code to <strong style={{ color: C.charcoal }}>{phone}</strong>.</>}
          </p>
        </div>

        <div style={{ background: C.warmWhite, borderRadius: 24, border: `1px solid ${C.borderLight}`,
          boxShadow: `0 8px 32px ${C.shadowMed}`, padding: 24 }}>

          {/* Passkey shortcut (phone step only) */}
          {step === "phone" && canPasskey && (
            <>
              <button onClick={doPasskey} disabled={passkeyBusy}
                style={{ width: "100%", minHeight: 54, borderRadius: 14, cursor: passkeyBusy ? "default" : "pointer",
                  border: `1.5px solid ${C.borderMedium}`, background: C.copperSubtle,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  fontFamily: F.body, fontSize: 15, fontWeight: 600, color: C.copper, marginBottom: 18 }}>
                {passkeyBusy ? <Loader size={18} className="spin" /> : <Fingerprint size={19} />}
                {hasPasskeyHint() ? "Sign in with Face ID" : "Use a passkey"}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div style={{ flex: 1, height: 1, background: C.borderLight }} />
                <span style={{ fontFamily: F.body, fontSize: 11, color: C.softGray, textTransform: "uppercase", letterSpacing: ".08em" }}>or</span>
                <div style={{ flex: 1, height: 1, background: C.borderLight }} />
              </div>
            </>
          )}

          {step === "phone" ? (
            <form onSubmit={(e) => { e.preventDefault(); if (phoneValid && !busy) doSend(); }}>
              <label style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: ".06em", color: C.warmGray, display: "block", marginBottom: 10 }}>
                Phone number
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={cc} onChange={(e) => setCc(e.target.value)}
                  style={{ ...inputBase, width: 104, padding: "0 8px", height: 54, appearance: "auto" }}>
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <div style={{ position: "relative", flex: 1 }}>
                  <Phone size={16} color={C.softGray}
                    style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                  <input value={national} onChange={(e) => setNational(e.target.value)}
                    type="tel" inputMode="tel" autoComplete="tel-national" autoFocus
                    placeholder="555 123 4567"
                    style={{ ...inputBase, height: 54, padding: "0 14px 0 40px" }}
                    onFocus={(e) => (e.target.style.borderColor = C.copper)}
                    onBlur={(e) => (e.target.style.borderColor = C.borderMedium)} />
                </div>
              </div>

              {error && <ErrorRow text={error} />}

              <button type="submit" disabled={!phoneValid || busy}
                style={{ ...primaryBtn(!phoneValid || busy), marginTop: 18 }}>
                {busy ? <Loader size={18} className="spin" /> : <>Send code <ArrowRight size={17} /></>}
              </button>

              <p style={{ fontFamily: F.body, fontSize: 11.5, color: C.softGray, textAlign: "center",
                marginTop: 16, lineHeight: 1.5 }}>
                By continuing you agree to receive a one-time SMS code. Message &amp; data rates may apply.
              </p>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (otpValid && !busy) doVerify(); }}>
              <label style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: ".06em", color: C.warmGray, display: "block", marginBottom: 10 }}>
                Verification code
              </label>
              <input ref={codeRef} value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="• • • • • •"
                style={{ ...inputBase, height: 60, textAlign: "center", fontSize: 26, fontWeight: 600,
                  letterSpacing: ".4em", padding: "0 14px" }}
                onFocus={(e) => (e.target.style.borderColor = C.copper)}
                onBlur={(e) => (e.target.style.borderColor = C.borderMedium)} />

              {error && <ErrorRow text={error} />}

              <button type="submit" disabled={!otpValid || busy}
                style={{ ...primaryBtn(!otpValid || busy), marginTop: 18 }}>
                {busy ? <Loader size={18} className="spin" /> : <>Verify &amp; sign in <Check size={17} /></>}
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                <button type="button" onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                  style={ghostLink}>
                  <ArrowLeft size={14} /> Change number
                </button>
                <button type="button" disabled={cooldown > 0 || busy} onClick={doSend}
                  style={{ ...ghostLink, opacity: cooldown > 0 ? 0.5 : 1, cursor: cooldown > 0 ? "default" : "pointer" }}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 22, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 7 }}>
          <KeyRound size={13} color={C.softGray} />
          <span style={{ fontFamily: F.body, fontSize: 12, color: C.softGray }}>
            Passwordless &amp; encrypted — we never store a password.
          </span>
        </div>
      </div>
    </div>
  );
}

function ErrorRow({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 14px",
      background: C.dangerGlow, borderRadius: 12, border: `1px solid rgba(199,91,91,.2)` }}>
      <AlertCircle size={15} color={C.danger} style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: F.body, fontSize: 13, color: C.danger, lineHeight: 1.4 }}>{text}</span>
    </div>
  );
}

function primaryBtn(disabled) {
  return {
    width: "100%",
    minHeight: 54,
    borderRadius: 14,
    border: "none",
    cursor: disabled ? "default" : "pointer",
    background: disabled ? C.creamDark : `linear-gradient(135deg,${C.copper},${C.copperLight})`,
    color: disabled ? C.softGray : "#fff",
    boxShadow: disabled ? "none" : "0 2px 12px rgba(193,127,89,.3)",
    fontFamily: F.body,
    fontSize: 16,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    transition: "all .15s",
  };
}

const ghostLink = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: F.body,
  fontSize: 13,
  fontWeight: 500,
  color: C.copper,
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: 4,
};
