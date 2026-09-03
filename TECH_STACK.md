# PackPal — Tech Stack & Build Playbook

A guide to how PackPal's cloud stack is structured, written so another engineer
(or agent) can rebuild or extend it without re-learning the hard parts. It pairs
with [`ARCHITECTURE.md`](ARCHITECTURE.md) (app internals) and
[`SETUP.md`](SETUP.md) (click-by-click provisioning). This doc is the *why* and
the *gotchas*.

---

## 1. Stack at a glance

| Concern | Choice | Notes |
|---|---|---|
| Frontend | **Vite + React** (single-page app) | Plain client app, no SSR. |
| Hosting | **Vercel** | Static build + SPA rewrite (`vercel.json`). |
| Auth | **Firebase Authentication** | Phone OTP (SMS) primary; **passkeys** (WebAuthn) for fast re-login. |
| Database / storage | **Cloud Firestore** | One JSON blob per user (whole app state). |
| Serverless | **Firebase Cloud Functions** (2nd gen, *callable*) | Only used for passkeys (WebAuthn verify + session minting). |
| Client auth lib | `firebase` (modular SDK) | `firebase/app`, `/auth`, `/firestore`, `/functions`. |
| WebAuthn | `@simplewebauthn/browser` (client) + `@simplewebauthn/server` (functions) | Pin matching majors. |

**Why this combo over alternatives (e.g. Supabase, which this was migrated from):**
- Firebase **sends SMS itself** — no Twilio/MessageBird wiring.
- Firebase has **first-class custom-token minting** (`createCustomToken`), which makes passkey login clean (no synthetic-email/magic-link workaround).
- Generous free tier; trivial data model for a personal app.

---

## 2. The one architectural idea that matters most

**Everything in the UI talks to three abstractions — never to Firebase directly:**

1. `useAuth()` — who's signed in, sign-in/out, profile.
2. `usePersist(key, default)` — read/write persisted state (same shape as a `localStorage` hook).
3. The passkey helpers — `registerPasskey()`, `loginWithPasskey()`.

Because the backend is hidden behind these, **the provider is swappable**. This
codebase was migrated Supabase → Firebase by rewriting only `src/lib/*` — zero
changes to the ~2,000 lines of UI. If you build this fresh, preserve that
boundary: no component should `import` from `firebase/*`.

**Second idea: `LOCAL_MODE`.** A single flag (env vars present?) decides whether
the app runs against the cloud or falls back to pure `localStorage` with no
login. This means the app **builds and runs from a fresh clone with zero setup**,
and degrades gracefully if the backend is unreachable. Wire this first — it makes
every later step testable in isolation.

```js
// src/lib/firebase.js
export const LOCAL_MODE = !cfg.apiKey || !cfg.projectId;
export const auth = LOCAL_MODE ? null : getAuth(app);
export const db   = LOCAL_MODE ? null : getFirestore(app);
```

Layering (dependencies point downward only): `data/` (pure facts) ← `lib/`
(logic + infra) ← `components/` ← app shell. See `ARCHITECTURE.md`.

---

## 3. Auth flow (the part to copy)

### Provider tree / gate
```
main.jsx
└─ <AuthProvider>            // session + profile, exposes useAuth()
   └─ <Gate>
      ├─ loading            → splash
      ├─ not signed in      → <AuthGate>            (phone → OTP → passkey)
      └─ signed in
         └─ <StoreProvider> // loads cloud state, exposes usePersist()
            ├─ !profile.onboarded → <Onboarding>    (one-time setup)
            └─ else               → <App>
```

### Phone OTP (primary sign-in)
Firebase web phone auth requires an **invisible reCAPTCHA verifier**. Create its
container programmatically so the UI stays presentation-only:

```js
const verifier = new RecaptchaVerifier(auth, containerEl, { size: "invisible" });
const confirmation = await signInWithPhoneNumber(auth, e164Phone, verifier);
// ...user enters code...
await confirmation.confirm(code);   // onAuthStateChanged then fires
```
Keep `sendOtp(phone)` / `verifyOtp(phone, code)` as the exposed API; stash the
`confirmationResult` internally. Recreate the verifier per send (its token is
single-use).

### Profile
On first sign-in, create `users/{uid}` = `{ phone, onboarded: false, createdAt }`.
`onboarded` gates the one-time onboarding screen. Load it in `useAuth`; treat a
load failure as "onboarded = true" so a missing schema never hard-blocks the app.

### Passkeys (the elegant bit)
- **Register** (after OTP login): client does `startRegistration()` with options
  from a callable function, posts the attestation back; the function verifies and
  stores the credential's public key.
- **Login** (no session yet): client does `startAuthentication()`, posts the
  assertion to a callable function. The function verifies it **and mints a
  session**:

```js
// in the callable function, after verifyAuthenticationResponse() passes:
const token = await admin.auth().createCustomToken(uid);
return { token };
// client:
await signInWithCustomToken(auth, token);   // onAuthStateChanged fires → done
```

`createCustomToken` → `signInWithCustomToken` is the canonical way to bridge
third-party verification into a Firebase session. (On Supabase this required a
synthetic-email + generated-magic-link hack — a big reason Firebase is cleaner
here.)

> Passkeys are **bound to one RP ID** (a domain). A passkey registered on
> `localhost` will not work on `your-app.vercel.app` and vice-versa — that's
> expected, not a bug.

---

## 4. Storage & sync

The whole app state (trips, wardrobe, settings, …) is stored as **one JSON
blob per user**, mirroring how the app already treated `localStorage`. That keeps
`usePersist` a drop-in for a localStorage hook:

```js
const [trips, setTrips] = usePersist("trips", []);   // unchanged call sites
```

- `StoreProvider` loads the blob on login, holds it in one state object,
  **debounce-saves** on change, and mirrors to `localStorage` for offline reads.
- **Cloud is the source of truth** on load; the `localStorage` mirror is the
  offline fallback.
- Store the blob as a **JSON string** in Firestore (`{ state: "...", updatedAt }`).
  This sidesteps Firestore's no-nested-arrays and no-`undefined` constraints
  entirely. Mind the **1 MiB per-document limit** for heavy users (shard per-entity if you outgrow it).

---

## 5. Data model + security rules

```
users/{uid}        { phone, onboarded, createdAt }      // client rw (own)
state/{uid}        { state: "<json string>", updatedAt } // client rw (own)
credentials/{auto} { uid, credentialId, publicKey, counter, ... } // server only
challenges/{auto}  { uid?, challenge, kind, createdAt }  // server only, short-lived
```

Rules: a signed-in user reads/writes only their own `users` + `state` docs.
`credentials` and `challenges` are **denied to all clients** — only Cloud
Functions touch them (the Admin SDK bypasses rules). See `firestore.rules`.

---

## 6. Provisioning gotchas (this is the time-saver)

These cost real hours. Do them up front.

**Billing**
- Firebase **phone auth** and **Cloud Functions** both effectively require the
  **Blaze (pay-as-you-go) plan** — a billing account must be attached even though
  the free allotments cover a personal app. Enable it early or you'll hit
  `auth/billing-not-enabled` and function-deploy failures.

**Cloud Functions (2nd gen) IAM — three grants on the default compute service account** (`<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`):
1. `roles/cloudbuild.builds.builder` — else the build fails with *"missing
   permission on the build service account."*
2. `roles/iam.serviceAccountTokenCreator` — else `createCustomToken` throws and
   the client sees a generic **`internal`** error.
3. **`allUsers` → Cloud Run Invoker** on any function called *before* login (the
   passkey-login function). Without it, the unauthenticated call is 403'd at the
   gateway, which surfaces in the browser as a misleading **CORS** error
   ("No 'Access-Control-Allow-Origin' header"). The post-login function (register)
   doesn't need this because its successful first deploy set the invoker.

**Phone OTP**
- On **`localhost`**, web phone auth often throws **`auth/invalid-app-credential`**
  (a known reCAPTCHA-on-localhost issue). Use **test phone numbers**
  (Auth → Sign-in method → Phone → test numbers) for local dev; **real SMS works
  on the deployed HTTPS domain**.
- **SMS region policy**: you must allow the destination country
  (Auth → Settings → SMS region policy) or you get
  `auth/operation-not-allowed: SMS unable to be sent ... region`.
- Add the deployed domain under **Auth → Settings → Authorized domains** or
  reCAPTCHA/OTP won't run there.

**WebAuthn / passkeys**
- `WEBAUTHN_RP_ID` = the **bare domain** (no scheme/port), e.g. `your-app.vercel.app`.
  `WEBAUTHN_ORIGIN` = the **full origin** and must match the browser exactly,
  including port. `*.vercel.app` subdomains are valid RP IDs (use the full
  subdomain, not the public-suffix parent `vercel.app`).
- Pin `@simplewebauthn/*` and code to that major — its result field names shift
  between majors.

**Vite + Vercel**
- `VITE_*` env vars are **build-time** (Vite inlines them). Changing a Vercel env
  var has **no effect until you redeploy**. Missing vars → the app silently runs
  in `LOCAL_MODE` (no login) on the live site.
- Use the project's **stable production domain** (`your-app.vercel.app`) for
  RP_ID / authorized domains — **not** the per-deployment hashed URL
  (`your-app-ab12cd-….vercel.app`), which changes every deploy.

---

## 7. Recommended build order

1. **Abstraction + LOCAL_MODE first.** `firebase.js` (with the env switch),
   `useAuth`, `usePersist`. App runs offline immediately.
2. **Build the UI** against those hooks. No Firebase imports in components.
3. **Provision Firebase**: project → Firestore (+ rules) → enable Phone auth →
   upgrade to Blaze.
4. **Wire env vars**, test OTP locally with **test numbers**.
5. **Add passkeys**: deploy the two callable functions, then apply the **three IAM
   grants** above.
6. **Deploy to Vercel**: set `VITE_*` env vars → redeploy → wire the prod domain
   into Firebase (authorized domains + `WEBAUTHN_RP_ID`/`ORIGIN`) → redeploy
   functions.

---

## 8. Setup walkthrough — the three milestones

This is the order it was actually provisioned. `SETUP.md` has the click-by-click;
this is the shape so you know where you are.

**Milestone 1 — Accounts + cloud sync.** Create the Firebase project + a Web app
→ copy the `firebaseConfig` into the six `VITE_FIREBASE_*` vars. Enable the
**Phone** sign-in provider (add a test number). Create **Firestore** and publish
`firestore.rules`. Put the env vars in `.env.local`, restart `npm run dev`. ✅ You
now get the sign-in screen and trips sync.

**Milestone 2 — Passkeys.** Upgrade to **Blaze**. Install the Firebase CLI →
`firebase login` → `firebase use --add` (do **not** `firebase init`; the configs
exist). Set `functions/.env` (`WEBAUTHN_*`), `cd functions && npm install`,
`firebase deploy --only functions`. Apply the **three IAM grants** from §6. Test
register + Face ID locally (with `RP_ID=localhost` and a test number). ✅ Passkeys
work.

**Milestone 3 — Production on Vercel.** `vercel login` → `vercel link` (link the
*existing* project if one exists). Push the six `VITE_FIREBASE_*` vars to Vercel
(Production). Deploy (`vercel --prod`, or push to `main` if the repo is
Git-linked — env changes need a redeploy to take effect). Then wire the **stable**
prod domain into Firebase: Authorized domains + `WEBAUTHN_RP_ID`/`ORIGIN` →
`firebase deploy --only functions`. ✅ Real-phone OTP works on HTTPS; register a
fresh passkey on the live domain.

---

## 9. Debugging playbook — errors in the order you'll hit them

**First rule:** when a callable function fails, the browser only shows a useless
`internal` or `CORS` error. The *real* cause is in the logs:
`firebase functions:log --only <functionName>`. Always look there first.

| Where | Symptom / error | Cause | Fix |
|---|---|---|---|
| Enable phone auth | a "SIM-less test mode / GMS beta / Phone Number Verification" screen | That's **Firebase PNV**, a separate *Android/iOS* product — not web Auth | Ignore it; use **Authentication → Sign-in method → Phone** |
| Create Firestore | "Standard vs Enterprise?" | — | Pick **Standard** (Enterprise = advanced query/scale you don't need) |
| Phone OTP | `auth/operation-not-allowed: SMS unable to be sent … region` | Destination country not allowed | Auth → Settings → **SMS region policy** → allow it (or use a test number) |
| Phone OTP on **localhost** | `auth/invalid-app-credential` | Known reCAPTCHA-on-localhost issue | Use **test phone numbers** locally; real SMS works on the deployed HTTPS domain |
| `firebase deploy --only functions` | "must be on the **Blaze** plan … can't enable API" | Functions require pay-as-you-go | Upgrade to Blaze |
| functions build | "Build failed … **missing permission on the build service account**" | Default compute SA lacks the builder role | Grant `roles/cloudbuild.builds.builder` to `<projectNumber>-compute@developer.gserviceaccount.com` |
| functions deploy | "No cleanup policy … how many days to keep images?" | Benign Artifact Registry prompt | Answer `1` |
| Passkey **login** | generic **`internal`** error (see function logs) | `createCustomToken` needs `iam.serviceAccounts.signBlob` | Grant `roles/iam.serviceAccountTokenCreator` to the same compute SA |
| Passkey **login** | browser **CORS** "No 'Access-Control-Allow-Origin'" on the function URL | The function 403s unauthenticated calls (no CORS headers on a 403) | Grant **`allUsers` → Cloud Run Invoker** on the login function — it runs *before* sign-in |
| Passkey **register** | 500; logs: "Unexpected registration response origin '…:5174', expected '…:5173'" | `WEBAUTHN_ORIGIN` / port mismatch | Run dev on the expected port, or add the real origin to `WEBAUTHN_ORIGIN` and redeploy |
| Live site | no sign-in screen (drops straight into the app) | `VITE_*` env missing at build → `LOCAL_MODE` | Set the six env vars on Vercel (Production) and **redeploy** (Vite inlines env at build time) |
| Firebase wiring | which URL do I use? | per-deploy hashed URLs change every time | Use the **stable** production domain for `RP_ID` + authorized domains |
| `git push` (deploy step) | "Permission to …/repo.git denied to `<other-account>`" | Wrong GitHub account authenticating — multi-account, and/or a global `insteadOf` rule rewriting HTTPS→SSH with the wrong key | `gh auth status` + `git config --get-regexp '^url\.'`; switch the active account / route this repo through the right credential |

---

## 10. How to walk a user through setup (coaching playbook)

Most of this happens in the Firebase/Vercel consoles and on the user's own
machine, so the agent's job is **coaching**, not doing. A handful of spots trip
everyone — get ahead of them instead of reacting.

**How to pace it**
- **One milestone at a time.** End each with a concrete checkpoint: *"open X — do
  you see Y? Tell me when it works, or paste the error."* Don't dump all three
  milestones at once.
- **Pre-fill everything you can.** Write the user's `.env.local` and
  `functions/.env` for them; hand over exact commands *with their real values*
  already substituted; give the exact console path or a direct deep-link URL.
- **Be explicit about who does what.** The agent handles file edits + command
  text; the user does the browser console, billing, IAM clicks, and anything
  needing their login. Say so, so they're not waiting on you (or you on them).
- **When a Cloud Function errors, don't guess from the browser.** It only shows
  `internal` / `CORS`. Immediately have them run
  `firebase functions:log --only <fn>` and diagnose from the real stack trace.
- **Verify, don't assume.** Open the live URL, run `gh auth status`, re-read the
  *exact* error string — each is cheaper than a wrong guess.

**Get ahead of these (they bite in this order)**
- **Enabling Phone auth:** warn that a "SIM-less test mode / GMS beta / Phone
  Number Verification" screen may appear — it's the wrong product (Android PNV);
  use **Sign-in method → Phone**.
- **Before the first OTP test:** set **SMS region policy** to allow the country,
  and on **localhost use a test number** — real SMS won't send there and you'll
  get `auth/invalid-app-credential`. Real numbers only work on the HTTPS domain.
- **Firestore:** publish the rules, or sync silently falls back to local and the
  user thinks it's broken.
- **Before deploying functions:** enable **Blaze first** (otherwise the deploy
  dies mid-way and has to be re-run).
- **Right after the first functions deploy:** apply **all three IAM grants in one
  go** (build-builder, token-creator, `allUsers` invoker). Warn that the symptoms
  are cryptic — a generic `internal` and a fake-looking CORS error — so they don't
  rabbit-hole down the wrong path.
- **Passkeys:** keep the dev server on a **fixed port**; the browser origin must
  match `WEBAUTHN_ORIGIN` exactly or registration 500s.
- **Vercel:** set env vars **then redeploy** (Vite bakes them in at build time);
  then confirm the live site shows the **sign-in screen**, not the local-mode app.
  Use the **stable** domain (not the per-deploy hashed URL) for Firebase wiring.
- **Pushing (multi-account git):** check `gh auth status` *before* the first push;
  a wrong active account or an `insteadOf` SSH rewrite causes a baffling
  "permission denied to <other-account>".

**Set data expectations early.** Tell the user up front: anything created *before*
cloud setup lives in per-origin `localStorage` and will **not** auto-appear on a
new account or a new domain. It isn't lost — it's stranded on that origin. This
prevents a "where did my trip go?!" panic, and it's why you plan a deliberate
import rather than relying on magic.

---

## 11. Design lessons (what to do differently)

- **localStorage → cloud migration is fragile.** `localStorage` is *origin-scoped*
  (localhost ≠ prod domain) and this app overwrites the local mirror with cloud
  data on sign-in. A one-time "import your local trips during onboarding" read is
  not enough — build a **deliberate, idempotent import/restore path** (e.g. an
  explicit "import from this device" action, or a server-side migration) so user
  data created pre-cloud isn't stranded or clobbered.
- **Don't auto-import seed/demo data as live user data.** Bundled example content
  (here: 22 historical trips) should live in a read-only area, with import being
  an obvious, opt-in action — not something that fills a new user's workspace.
- **Any callable function invoked before authentication needs public invoker.**
  Bake the IAM grant into your deploy/setup script so it's not discovered via a
  confusing CORS error.

---

## 12. Key files

```
src/lib/firebase.js     env-driven client + LOCAL_MODE switch
src/lib/auth.jsx        AuthProvider / useAuth — phone OTP + reCAPTCHA + profile
src/lib/store.jsx       StoreProvider + usePersist (Firestore JSON blob + LS mirror)
src/lib/passkey.js      WebAuthn client → callable functions → signInWithCustomToken
src/components/AuthGate.jsx    phone → OTP → passkey screen
src/components/Onboarding.jsx  one-time setup gate
functions/index.js      passkeyRegister / passkeyAuth (callable, gen 2)
firestore.rules         per-user access; server-only passkey collections
firebase.json           Firestore + Functions deploy config
```
