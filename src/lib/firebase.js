import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// ─────────────────────────────────────────────────────────────
// Firebase client
//
// Two modes, decided by whether the env vars are present:
//
//  • CLOUD MODE — VITE_FIREBASE_API_KEY + VITE_FIREBASE_PROJECT_ID set.
//    Accounts, phone OTP, passkeys, and multi-device cloud sync are active.
//
//  • LOCAL MODE — vars absent. The app runs exactly as it did before cloud
//    sync: no login, all data in localStorage. Builds & runs with zero setup.
// ─────────────────────────────────────────────────────────────

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Region your callable functions are deployed to (defaults to Firebase's default).
const FUNCTIONS_REGION = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1";

export const LOCAL_MODE = !cfg.apiKey || !cfg.projectId;

export const app = LOCAL_MODE ? null : initializeApp(cfg);
export const auth = LOCAL_MODE ? null : getAuth(app);
export const db = LOCAL_MODE ? null : getFirestore(app);
export const functions = LOCAL_MODE ? null : getFunctions(app, FUNCTIONS_REGION);
