import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth, functions, LOCAL_MODE } from "./firebase";

// ─────────────────────────────────────────────────────────────
// Passkeys (WebAuthn / Face ID / Touch ID)
//
// Flow:
//   • Register — after the user has signed in via OTP, create a platform
//     passkey and store its public key against the user (passkeyRegister fn).
//   • Login    — on the sign-in screen, do a WebAuthn assertion; the
//     passkeyAuth fn verifies it and returns a Firebase custom token, which we
//     exchange via signInWithCustomToken() to establish a session.
//
// Uses Firebase *callable* functions, so auth + CORS are handled by the SDK.
// Requires cloud mode + the two functions deployed; otherwise the UI hides the
// passkey buttons.
// ─────────────────────────────────────────────────────────────

const HINT_KEY = "pp_has_passkey";

export function browserSupportsPasskeys() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export async function platformAuthenticatorAvailable() {
  try {
    if (!browserSupportsPasskeys()) return false;
    if (!window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function passkeysConfigured() {
  return !LOCAL_MODE && !!functions && browserSupportsPasskeys();
}

// Local breadcrumb so the login screen can lead with "Sign in with Face ID".
export function hasPasskeyHint() {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}
export function setPasskeyHint(on) {
  try {
    if (on) localStorage.setItem(HINT_KEY, "1");
    else localStorage.removeItem(HINT_KEY);
  } catch {
    /* ignore */
  }
}

async function callRegister(payload) {
  const res = await httpsCallable(functions, "passkeyRegister")(payload);
  return res.data;
}
async function callAuth(payload) {
  const res = await httpsCallable(functions, "passkeyAuth")(payload);
  return res.data;
}

// Register a new passkey for the currently signed-in user.
export async function registerPasskey() {
  if (!passkeysConfigured()) throw new Error("Passkeys aren't configured on this deployment.");
  if (!auth?.currentUser) throw new Error("You need to be signed in to add a passkey.");

  const { options, challengeId } = await callRegister({ action: "options" });
  const attResp = await startRegistration(options);
  const result = await callRegister({ action: "verify", challengeId, attResp });
  if (result?.verified) setPasskeyHint(true);
  return result;
}

// Sign in with a passkey. `phone` is optional — when omitted we rely on a
// discoverable credential (the platform shows the user's saved passkeys).
// The function returns a Firebase custom token; we exchange it for a session,
// which fires onAuthStateChanged and swaps the login screen out.
export async function loginWithPasskey(phone) {
  if (!passkeysConfigured()) throw new Error("Passkeys aren't configured on this deployment.");

  const { options, challengeId } = await callAuth({ action: "options", phone: phone || null });
  const asseResp = await startAuthentication(options);
  const { token } = await callAuth({ action: "verify", challengeId, asseResp });
  if (!token) throw new Error("Passkey sign-in failed.");

  const cred = await signInWithCustomToken(auth, token);
  setPasskeyHint(true);
  return cred?.user ?? null;
}
