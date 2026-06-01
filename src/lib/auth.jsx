import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  RecaptchaVerifier,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, LOCAL_MODE } from "./firebase";

// ─────────────────────────────────────────────────────────────
// Auth layer — phone OTP via Firebase Authentication, with a synthetic
// always-authed "local user" when no backend is configured (LOCAL_MODE), so
// the app keeps working offline on localStorage exactly as it did before.
//
// Firebase phone auth needs an (invisible) reCAPTCHA verifier; we create its
// container programmatically so AuthGate stays presentation-only.
// ─────────────────────────────────────────────────────────────

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const LOCAL_USER = { id: "local-user", phone: null, isLocal: true };
const LOCAL_PROFILE = { id: "local-user", onboarded: true, phone: null };

function normalizeUser(fb) {
  if (!fb) return null;
  // Expose `.id` (StoreProvider) and `.phone` (Account) regardless of Firebase's field names.
  return { id: fb.uid, phone: fb.phoneNumber || null, raw: fb };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(LOCAL_MODE ? LOCAL_USER : null);
  const [profile, setProfile] = useState(LOCAL_MODE ? LOCAL_PROFILE : null);
  const [loading, setLoading] = useState(!LOCAL_MODE);

  const confirmationRef = useRef(null);
  const verifierRef = useRef(null);

  const loadProfile = useCallback(async (fbUser) => {
    if (!db || !fbUser) return null;
    const ref = doc(db, "users", fbUser.uid);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const p = {
          id: fbUser.uid,
          onboarded: !!data.onboarded,
          phone: data.phone ?? fbUser.phoneNumber ?? null,
        };
        setProfile(p);
        return p;
      }
      // First sign-in → create the profile doc (not yet onboarded).
      const fresh = { phone: fbUser.phoneNumber ?? null, onboarded: false, createdAt: Date.now() };
      await setDoc(ref, fresh, { merge: true });
      const p = { id: fbUser.uid, onboarded: false, phone: fresh.phone };
      setProfile(p);
      return p;
    } catch (e) {
      // Most likely the Firestore rules / database aren't set up yet. Don't
      // hard-block — assume onboarded so the app still works on localStorage.
      console.warn("[PackPal] Could not load/create profile (check Firestore rules):", e?.message || e);
      const fallback = { id: fbUser.uid, onboarded: true, _profileError: true };
      setProfile(fallback);
      return fallback;
    }
  }, []);

  // Bootstrap + subscribe to auth changes (cloud mode only).
  useEffect(() => {
    if (LOCAL_MODE) return;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(normalizeUser(fbUser));
      if (fbUser) await loadProfile(fbUser);
      else setProfile(null);
      setLoading(false);
    });
    return () => unsub();
  }, [loadProfile]);

  // Fresh invisible-reCAPTCHA verifier per send (its token is single-use).
  const ensureVerifier = useCallback(() => {
    if (verifierRef.current) {
      try {
        verifierRef.current.clear();
      } catch {
        /* ignore */
      }
      verifierRef.current = null;
    }
    const old = document.getElementById("pp-recaptcha");
    if (old?.parentNode) old.parentNode.removeChild(old);
    const el = document.createElement("div");
    el.id = "pp-recaptcha";
    document.body.appendChild(el);
    verifierRef.current = new RecaptchaVerifier(auth, el, { size: "invisible" });
    return verifierRef.current;
  }, []);

  // ── Phone OTP ──
  const sendOtp = useCallback(
    async (phone) => {
      if (!auth) return { error: new Error("Cloud mode is not configured.") };
      try {
        const verifier = ensureVerifier();
        confirmationRef.current = await signInWithPhoneNumber(auth, phone, verifier);
        return { error: null };
      } catch (e) {
        try {
          verifierRef.current?.clear();
        } catch {
          /* ignore */
        }
        verifierRef.current = null;
        return { error: e };
      }
    },
    [ensureVerifier]
  );

  const verifyOtp = useCallback(async (_phone, token) => {
    if (!auth) return { error: new Error("Cloud mode is not configured.") };
    if (!confirmationRef.current) return { error: new Error("Request a code first.") };
    try {
      await confirmationRef.current.confirm(token);
      // onAuthStateChanged sets user + profile.
      return { error: null };
    } catch (e) {
      return { error: e };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    await fbSignOut(auth);
    setUser(null);
    setProfile(null);
  }, []);

  const markOnboarded = useCallback(async () => {
    setProfile((p) => ({ ...(p || {}), onboarded: true }));
    if (!db || !user?.id) return;
    try {
      await setDoc(doc(db, "users", user.id), { onboarded: true }, { merge: true });
    } catch (e) {
      console.warn("[PackPal] Could not persist onboarded flag:", e?.message || e);
    }
  }, [user]);

  const value = {
    user,
    profile,
    loading,
    isAuthed: LOCAL_MODE || !!user,
    isLocal: LOCAL_MODE,
    sendOtp,
    verifyOtp,
    signOut,
    markOnboarded,
    reloadProfile: () => (auth?.currentUser ? loadProfile(auth.currentUser) : null),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
