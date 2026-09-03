# PackPal — Sign-in Flow & User Profile (UX + Backend)

How PackPal does passwordless sign-in, passkeys, and the user profile — the
deliberate choices on both the UI side and the backend, so another agent can
reproduce the feel rather than guess at it. Grounded in the actual code:
`src/components/AuthGate.jsx`, `src/lib/auth.jsx`, `src/lib/passkey.js`,
`src/components/Account.jsx`.

---

## North star

Auth should feel like **part of the product**, not a detour to a generic form.
Four rules drive every decision below:

1. **Passwordless, always.** Phone OTP + passkeys. There is no password field, and
   the screen says so out loud.
2. **Passkey-forward when possible.** If the device can do Face ID/Touch ID, lead
   with it.
3. **Two screens, one job each.** Phone → code. Nothing else competes for attention.
4. **It looks like the app.** Same fonts, palette, and editorial voice as the rest
   of PackPal — auth is brand surface, not boilerplate.

And one structural rule that makes it reusable: **the screen is presentation-only.**
All backend logic lives behind `useAuth()` + the passkey helpers, so you can
restyle the UI or swap the provider without touching the other.

---

## 1. The sign-in screen (AuthGate) — UX anatomy

A single component with a tiny state machine: `step ∈ { "phone", "code" }`.

**Frame.** Full-height warm gradient background
(`warmWhite → cream → faint copper`), one centered 420px column — so it feels
composed on any screen size, not stretched.

**Brand block.** A small uppercase letter-spaced eyebrow ("PackPal"), a large
**Cormorant Garamond** headline that *changes with the step* — "Welcome in." →
"Check your texts." — and a **DM Sans** subline that does real work:
- phone step: *"Sign in with your phone number. Your trips sync to every device."* (states the payoff)
- code step: *"We sent a 6-digit code to **+1 555…**."* (echoes the number back for confidence)

**The card.** One warm-white rounded card (radius 24, soft shadow) holds the form.

**Passkey shortcut** (phone step, only when available): a full-width copper-tinted
button with a fingerprint icon, label **"Sign in with Face ID"** if they've used a
passkey here before (a local hint), else **"Use a passkey"** — followed by a subtle
"or" divider above the phone form. Passkey is offered first, phone is the fallback.

**Phone step.** An uppercase field label, then a row of: a **country-code `<select>`**
(so the user only types their national number) + a phone `<input>` with an inset
phone icon. The input is `type="tel"`, `inputMode="tel"`,
`autoComplete="tel-national"`, and **autofocused**. A primary **"Send code →"**
button sits below, disabled until there are ≥6 digits. Quiet legal microcopy about
SMS rates closes it.

**Code step.** One **big centered 6-digit input** (26px, `.4em` letter-spacing,
`• • • • • •` placeholder) — `inputMode="numeric"` and crucially
**`autoComplete="one-time-code"`** so iOS/Android auto-fill the SMS code. It's
auto-focused when the step opens. Below: **"Verify & sign in ✓"**, then a row with
**"← Change number"** and **"Resend in Ns" / "Resend code"** on a 30-second cooldown.

**Footer.** A key icon + *"Passwordless & encrypted — we never store a password."*

**Buttons / states.** Primary button = copper gradient, **54px** min height (large
tap target), greys out when disabled, shows a spinner while busy. Errors render as
a soft danger-tinted row with an alert icon and human copy ("That code didn't
match. Try again."). Ghost links are copper text.

### The flow, precisely
- `doSend()` → `sendOtp(phone)`; on success: `step = "code"`, start 30s cooldown,
  focus the code field.
- `doVerify()` → `verifyOtp(phone, code)`; **on success it does nothing** — the auth
  listener unmounts the whole screen. The component never navigates manually.
- `doPasskey()` → `loginWithPasskey()` (discoverable, no phone typed); same deal,
  the listener swaps the screen on success.

That "do nothing on success, let the auth state drive navigation" pattern is what
keeps the component dumb and the flow robust.

---

## 2. Why it feels low-friction (the small stuff that matters)

- **Country-code picker** means the user types ~10 digits, not an E.164 string.
- **`autoComplete="one-time-code"`** = the code autofills from the SMS banner; most
  users never type it.
- **Autofocus** on each step's primary input; **Enter submits** (real `<form>`s).
- **Inline validation** gates the button (≥6 phone digits, ≥4 code digits) so users
  don't fire empty requests.
- **Resend cooldown + "Change number"** cover the two things that actually go wrong.
- **One concern per screen.** No "create account vs sign in" toggle — phone OTP is
  the same path for both, so there's no mode to choose.

---

## 3. Backend: the `useAuth()` contract

`AuthProvider` owns session + profile and exposes a deliberately tiny, stable API
via context:

```js
const {
  user,        // { id, phone } | null   (normalized — not a raw Firebase user)
  profile,     // { id, phone, onboarded } | null
  loading,     // true until the first auth state resolves (drives the splash)
  isAuthed,    // LOCAL_MODE || !!user
  isLocal,     // running with no backend configured
  sendOtp,     // (phone) => { error }
  verifyOtp,   // (phone, code) => { error }
  signOut,
  markOnboarded,
} = useAuth();
```

Everything in the app — gate, AuthGate, Account, Onboarding — uses only this. No
component imports `firebase/*`.

**Session source of truth = `onAuthStateChanged`.** The provider subscribes once;
`loading` stays true until the first callback, then `user`/`profile` are set. Sign-in
and sign-out never manually flip `user` — they let the listener do it. That's why
the UI "just swaps" after a successful verify.

**Phone OTP mechanics (kept out of the UI):**
- Create a **fresh invisible reCAPTCHA verifier per send** (its token is
  single-use) in a programmatically-created `#pp-recaptcha` div — so AuthGate never
  has to render a reCAPTCHA container.
- `sendOtp` → `signInWithPhoneNumber(auth, phone, verifier)` and stash the
  `confirmationResult`.
- `verifyOtp` → `confirmationResult.confirm(code)`; success triggers
  `onAuthStateChanged`.

**Identity normalization.** Firebase's user object is mapped to `{ id, phone }`
(`uid` → `id`, `phoneNumber` → `phone`). The rest of the app only ever sees
`.id`/`.phone`. This one indirection is what let the backend migrate
Supabase → Firebase as a `lib/`-only change.

---

## 4. User profile

The profile is intentionally **one tiny Firestore doc** — identity comes from auth;
the only app-specific state is whether they've finished onboarding.

```
users/{uid}  =  { phone, onboarded: boolean, createdAt }
```

- **Created lazily on first sign-in:** `loadProfile` reads `users/{uid}`; if it
  doesn't exist, it writes `{ phone, onboarded: false, createdAt }`.
- **Resilient by design:** if the read throws (rules not deployed yet, offline),
  it falls back to `{ onboarded: true }` and logs a warning — the app degrades to
  *working-but-unsynced* instead of a white screen. Auth problems should never
  brick the UI.
- **`onboarded` gates the one-time setup screen.** `markOnboarded()` does an
  optimistic local update + a Firestore write.

---

## 5. The gate (how routing falls out of auth + profile)

```jsx
function Gate() {
  const { isAuthed, loading, profile, isLocal } = useAuth();
  if (loading) return <Splash />;                       // first auth resolution
  if (!isAuthed) return <AuthGate />;                   // sign-in
  if (!isLocal && !profile) return <Splash />;          // profile still loading
  const needsOnboarding = !isLocal && profile?.onboarded === false;
  return (
    <StoreProvider>
      {needsOnboarding ? <Onboarding /> : <App />}
    </StoreProvider>
  );
}
```

Routing is a pure function of `loading / isAuthed / profile.onboarded` — no router,
no manual redirects. Add a state, add a branch.

---

## 6. Passkeys in the flow

- **Register** (after the user is signed in, from the Account sheet or onboarding):
  `registerPasskey()` → callable fn returns creation options → `startRegistration()`
  → callable fn verifies + stores the credential's public key → set a local **hint**
  so the sign-in screen next leads with "Sign in with Face ID."
- **Login** (no session yet): `loginWithPasskey()` → `startAuthentication()` (a
  *discoverable* credential, so no phone needed) → callable fn verifies the assertion
  and returns a **Firebase custom token** → `signInWithCustomToken(auth, token)` →
  `onAuthStateChanged` fires → in.
- **Feature-gated:** the passkey UI only appears when the backend is configured, the
  browser supports WebAuthn, and a platform authenticator is present.

(The server side of this — the callable functions and the IAM grants they need —
is in `TECH_STACK.md`.)

---

## 7. The profile surface in-app (Account)

- A **40px circular avatar button** in the Home header with a small **sync-status
  dot** — green "synced", copper "syncing", grey "offline/local". It's *ambient*
  feedback; there is no Save button (the store debounce-saves).
- Tapping opens a **bottom-sheet**: the phone number, the live sync-status line,
  **"Add Face ID / passkey"**, and **"Sign out."** In local mode it shows an
  offline explainer instead of account actions.

---

## 8. How to adapt this for your own app

Keep these and you'll keep the feel:
1. **Presentation/logic split** — the screen calls hooks, never the SDK.
2. **The two-step machine** (`phone → code`) with "success does nothing; the auth
   listener navigates."
3. **`LOCAL_MODE` bypass** — no backend → no gate, app still runs.
4. **Passkey-forward** with a local hint to relabel the button.
5. **Identity normalization** (`{ id, phone }`) so the UI is provider-agnostic.
6. **A minimal, resilient profile doc** with an `onboarded` flag driving a pure-function gate.

Then restyle freely through your design tokens, and swap providers by
reimplementing `lib/auth` + `lib/passkey` against the same `useAuth` contract.
