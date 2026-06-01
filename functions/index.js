// ════════════════════════════════════════════════════════════════════
// PackPal passkey (WebAuthn) Cloud Functions — callable (gen 2).
//
//   passkeyRegister  (auth required)  { action: "options" | "verify", ... }
//   passkeyAuth      (no auth)        { action: "options" | "verify", ... }
//
// passkeyAuth verifies a WebAuthn assertion and returns a Firebase custom
// token; the client exchanges it via signInWithCustomToken() — Firebase's
// first-class way to mint a session from third-party verification.
//
// Callable functions handle CORS + auth-token passing automatically, so the
// client just uses httpsCallable().
// ════════════════════════════════════════════════════════════════════

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

initializeApp();
const db = getFirestore();

// These come from functions/.env (see functions/.env.example).
//   WEBAUTHN_RP_ID    — bare domain, e.g. "packpal.vercel.app" (no scheme/port)
//   WEBAUTHN_RP_NAME  — label shown in the OS prompt
//   WEBAUTHN_ORIGIN   — full origin(s), comma-separated
const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const rpName = process.env.WEBAUTHN_RP_NAME || "PackPal";
const expectedOrigins = (process.env.WEBAUTHN_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// ── base64url helpers (tolerant of string-or-bytes across lib versions) ──
const b64urlFromBytes = (bytes) => Buffer.from(bytes).toString("base64url");
const bytesFromB64url = (s) => new Uint8Array(Buffer.from(s, "base64url"));
function asB64url(v) {
  if (typeof v === "string") return v;
  if (v instanceof Uint8Array) return b64urlFromBytes(v);
  if (v?.buffer) return b64urlFromBytes(new Uint8Array(v.buffer));
  throw new Error("Cannot encode credential value");
}
function asBytes(v) {
  if (v instanceof Uint8Array) return v;
  if (typeof v === "string") return bytesFromB64url(v);
  if (v?.buffer) return new Uint8Array(v.buffer);
  throw new Error("Cannot decode credential value");
}

// ════════════════════════════════════════════════════════════════════
export const passkeyRegister = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in before adding a passkey.");
  const { action } = request.data || {};

  if (action === "options") {
    const credsSnap = await db.collection("credentials").where("uid", "==", uid).get();
    const excludeCredentials = credsSnap.docs.map((d) => ({
      id: d.data().credentialId,
      transports: d.data().transports || undefined,
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(uid),
      userName: request.auth.token?.phone_number || uid,
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        requireResidentKey: false,
        userVerification: "preferred",
      },
    });

    const ref = await db.collection("challenges").add({
      uid,
      challenge: options.challenge,
      kind: "register",
      createdAt: Date.now(),
    });
    return { options, challengeId: ref.id };
  }

  if (action === "verify") {
    const { challengeId, attResp } = request.data;
    if (!challengeId || !attResp) throw new HttpsError("invalid-argument", "Missing challengeId/attResp");

    const chRef = db.collection("challenges").doc(challengeId);
    const chSnap = await chRef.get();
    if (!chSnap.exists) throw new HttpsError("failed-precondition", "Challenge not found");
    const ch = chSnap.data();
    await chRef.delete();
    if (ch.uid !== uid || ch.kind !== "register") throw new HttpsError("failed-precondition", "Challenge mismatch");
    if (Date.now() - ch.createdAt > CHALLENGE_TTL_MS) throw new HttpsError("deadline-exceeded", "Challenge expired");

    const verification = await verifyRegistrationResponse({
      response: attResp,
      expectedChallenge: ch.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    const info = verification.registrationInfo;
    if (!verification.verified || !info) throw new HttpsError("invalid-argument", "Verification failed");

    // Field names vary slightly across simplewebauthn versions — normalize.
    const credentialID = info.credentialID ?? info.credential?.id;
    const credentialPublicKey = info.credentialPublicKey ?? info.credential?.publicKey;
    const counter = info.counter ?? info.credential?.counter ?? 0;
    const cid = asB64url(credentialID);

    await db.collection("credentials").add({
      uid,
      credentialId: cid,
      publicKey: asB64url(credentialPublicKey),
      counter,
      transports: attResp?.response?.transports || null,
      deviceType: info.credentialDeviceType || null,
      backedUp: info.credentialBackedUp ?? null,
      createdAt: Date.now(),
    });

    return { verified: true };
  }

  throw new HttpsError("invalid-argument", "Unknown action");
});

// ════════════════════════════════════════════════════════════════════
export const passkeyAuth = onCall(async (request) => {
  const { action } = request.data || {};

  if (action === "options") {
    const { phone } = request.data;
    let allowCredentials;
    if (phone) {
      const usersSnap = await db.collection("users").where("phone", "==", phone).limit(1).get();
      if (!usersSnap.empty) {
        const uid = usersSnap.docs[0].id;
        const credsSnap = await db.collection("credentials").where("uid", "==", uid).get();
        allowCredentials = credsSnap.docs.map((d) => ({
          id: d.data().credentialId,
          transports: d.data().transports || undefined,
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials,
    });

    const ref = await db.collection("challenges").add({
      challenge: options.challenge,
      kind: "auth",
      createdAt: Date.now(),
    });
    return { options, challengeId: ref.id };
  }

  if (action === "verify") {
    const { challengeId, asseResp } = request.data;
    if (!challengeId || !asseResp) throw new HttpsError("invalid-argument", "Missing challengeId/asseResp");

    const chRef = db.collection("challenges").doc(challengeId);
    const chSnap = await chRef.get();
    if (!chSnap.exists) throw new HttpsError("failed-precondition", "Challenge not found");
    const ch = chSnap.data();
    await chRef.delete();
    if (ch.kind !== "auth") throw new HttpsError("failed-precondition", "Challenge mismatch");
    if (Date.now() - ch.createdAt > CHALLENGE_TTL_MS) throw new HttpsError("deadline-exceeded", "Challenge expired");

    const credQ = await db
      .collection("credentials")
      .where("credentialId", "==", asseResp.id)
      .limit(1)
      .get();
    if (credQ.empty) throw new HttpsError("not-found", "Unknown passkey");
    const credDoc = credQ.docs[0];
    const cred = credDoc.data();

    const verification = await verifyAuthenticationResponse({
      response: asseResp,
      expectedChallenge: ch.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      requireUserVerification: false,
      authenticator: {
        credentialID: asBytes(cred.credentialId),
        credentialPublicKey: asBytes(cred.publicKey),
        counter: Number(cred.counter) || 0,
        transports: cred.transports || undefined,
      },
    });

    if (!verification.verified) throw new HttpsError("unauthenticated", "Verification failed");

    await credDoc.ref.update({
      counter: verification.authenticationInfo?.newCounter ?? cred.counter,
      lastUsedAt: Date.now(),
    });

    // Mint a Firebase session for this user.
    const token = await getAuth().createCustomToken(cred.uid);
    return { token };
  }

  throw new HttpsError("invalid-argument", "Unknown action");
});
