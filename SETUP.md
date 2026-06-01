# PackPal — Cloud Accounts Setup (Firebase)

PackPal supports **accounts, phone-number sign-in (SMS OTP), passkeys (Face ID / Touch ID), and multi-device cloud sync**, backed by [Firebase](https://firebase.google.com).

It runs in **two modes**, decided automatically by whether the Firebase env vars are present:

| Mode | When | Behavior |
|------|------|----------|
| **Local** | No `VITE_FIREBASE_*` vars | No login. All data in `localStorage` — exactly like before cloud sync. The app builds & runs with zero setup. |
| **Cloud** | Config present | Phone-OTP login, passkeys, and per-user cloud sync are active. New accounts start empty with an optional one-time import of the 22 built-in lists + any trips already on the device. |

So you can develop locally today and turn on the cloud whenever you finish the steps below.

> **What's automated vs. what needs you:** all the *code* is written — client, Firestore rules, and the two passkey Cloud Functions. The remaining work is provisioning that only you can do: creating the Firebase project, enabling phone auth, deploying rules + functions, and setting env vars. Each step is copy-paste below.

---

## 1. Install dependencies

```bash
npm install
```

Pulls in `firebase` and `@simplewebauthn/browser`. Run it with no backend to confirm Local mode still works:

```bash
npm run dev
```

---

## 2. Create a Firebase project

1. Go to <https://console.firebase.google.com> → **Add project**. Name it, finish the wizard (Analytics optional).
2. In the project, click the **Web** icon (`</>`) to register a web app. Copy the `firebaseConfig` object it shows — you'll need those values in step 5.

## 3. Enable phone (SMS) sign-in

1. **Build → Authentication → Get started**.
2. **Sign-in method → Add new provider → Phone → Enable → Save.**
3. Firebase sends the SMS itself — **no Twilio needed.** The free tier covers 10,000 verifications/month, then ~$0.06 each (US).
4. (Recommended for dev) Under the Phone provider, expand **Phone numbers for testing** and add a number + fixed code (e.g. `+1 555-555-1234` → `123456`). You can then sign in without spending real SMS or owning that number.
5. **Authentication → Settings → Authorized domains** → make sure `localhost` is listed (it is by default) and add your Vercel domain later.

## 4. Create Firestore + deploy security rules

1. **Build → Firestore Database → Create database** → Production mode → pick a location.
2. Install the CLI and deploy the rules from this repo:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # pick your project, give it an alias like "default"
firebase deploy --only firestore:rules
```

The rules (`firestore.rules`) lock `users/{uid}` and `state/{uid}` to their owner; the passkey `credentials`/`challenges` collections are server-only.

## 5. Wire the env vars

Copy the example file and paste in the values from your `firebaseConfig` (step 2):

```bash
cp .env.example .env.local
```

```ini
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:abc123
```

Restart `npm run dev`. You should now see the **sign-in screen** → enter phone → get the code → onboarding (import the 22 lists / bring this device's trips / start fresh).

That's **accounts + OTP + cloud sync** done. Passkeys are last.

---

## 6. Passkeys (Face ID / Touch ID) — deploy the Cloud Functions

Passkeys use the two callable functions in `functions/`.

> ⚠️ **Cloud Functions require the Blaze (pay-as-you-go) plan.** Upgrade under **Project settings → Usage and billing → Modify plan** (a billing account is required, but the free monthly allotment easily covers an app this size).

Set the WebAuthn config. **`WEBAUTHN_RP_ID` must be your site's bare domain** (no `https://`, no port); **`WEBAUTHN_ORIGIN` must list full origins**, comma-separated:

```bash
cp functions/.env.example functions/.env
# edit functions/.env — for local dev the defaults (localhost / http://localhost:5173) work.
# For production set e.g.:
#   WEBAUTHN_RP_ID=packpal.vercel.app
#   WEBAUTHN_ORIGIN=https://packpal.vercel.app,http://localhost:5173
```

Install function deps and deploy:

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

This deploys `passkeyRegister` and `passkeyAuth` (default region `us-central1` — if you change it, also set `VITE_FIREBASE_FUNCTIONS_REGION` in `.env.local`). Once deployed, **"Add Face ID / passkey"** appears in onboarding + the Account sheet, and **"Sign in with Face ID"** on the login screen.

> **How passkey login mints a session:** after the assertion is verified, the function calls `admin.auth().createCustomToken(uid)` and the client exchanges it via `signInWithCustomToken()` — Firebase's first-class path for third-party verification. No email/SMTP workaround needed.

---

## 7. Deploy to Vercel

The app already has `vercel.json`. In your Vercel project:

1. **Settings → Environment Variables** → add all six `VITE_FIREBASE_*` values (same as `.env.local`).
2. Set `functions/.env`'s `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` to your Vercel domain and redeploy functions (step 6).
3. In Firebase **Authentication → Settings → Authorized domains**, add your Vercel domain.
4. Deploy. `npm run build` runs automatically.

---

## 8. Test checklist

- [ ] **Local mode:** unset env vars → app loads straight to the trips screen, no login.
- [ ] **Sign up:** enter phone → receive SMS code (or use a test number) → onboarding appears.
- [ ] **Import:** choose the 22 starter lists and/or "bring my trips from this device" → they appear under Your trips.
- [ ] **Sync:** add/check items on one device → sign in on another → changes are there.
- [ ] **Passkey register:** Account → "Add Face ID / passkey" → biometric prompt → success.
- [ ] **Passkey login:** sign out → "Sign in with Face ID" → straight in, no SMS.

---

## Troubleshooting

- **`auth/invalid-app-credential` or reCAPTCHA errors** → your domain isn't in **Authentication → Settings → Authorized domains**, or you're not on `https`/`localhost`.
- **`auth/billing-not-enabled`** → phone auth on a brand-new project sometimes needs the Blaze plan; upgrade (step 6).
- **"Could not load/create profile (check Firestore rules)"** in the console → deploy the rules (step 4) and confirm Firestore is created.
- **Passkey buttons don't show** → they appear only in Cloud mode, on HTTPS (or `localhost`), on a device with a platform authenticator, and after the functions are deployed.
- **Passkey "RP ID mismatch" / origin errors** → `WEBAUTHN_RP_ID` must be the bare domain and `WEBAUTHN_ORIGIN` must include the exact origin in the address bar; redeploy functions after changing `functions/.env`.
- **`@simplewebauthn` version note** → client is pinned to v10 and functions import a matching v10 server; if you bump a major, credential field names may change.

---

## What changed in the codebase

```
src/lib/firebase.js        Firebase app + auth/firestore/functions + LOCAL_MODE
src/lib/auth.jsx           AuthProvider/useAuth — phone OTP (reCAPTCHA), session, profile
src/lib/store.jsx          StoreProvider + cloud-aware usePersist (Firestore doc)
src/lib/passkey.js         WebAuthn client → callable functions + signInWithCustomToken
src/lib/importHist.js      Converts the 22 built-in lists → editable trips
src/lib/theme.js           Shared design tokens for the new screens
src/components/AuthGate.jsx   Phone → OTP → passkey sign-in screen
src/components/Account.jsx    In-app account sheet (sync status, passkey, sign out)
src/components/Onboarding.jsx One-time setup (import 22 lists / bring local / passkey)
src/main.jsx               Provider tree + auth/onboarding gating
src/PackPal.jsx            Unchanged logic; usePersist imported; AccountBadge added
firestore.rules            Per-user access; server-only passkey collections
firebase.json              Firestore + Functions deploy config
functions/index.js         passkeyRegister, passkeyAuth (callable, gen 2)
functions/.env.example     WEBAUTHN_RP_ID / RP_NAME / ORIGIN
```
