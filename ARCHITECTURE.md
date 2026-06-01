# PackPal — Architecture

This document is the map of the codebase: how it's layered, how data flows, the
conventions to follow, and step-by-step recipes for extending it. If you're new
here, read this first.

## Philosophy

PackPal is a single-page React app (Vite + Vercel) that works **offline-first**
and **lights up cloud features when configured**. The guiding principles:

- **Layered, one-directional dependencies.** UI depends on logic depends on
  data. Data never imports UI; logic never imports components.
- **One source of truth per concern.** Design tokens, domain data, and pure
  logic each live in exactly one place.
- **The backend is swappable.** The entire app talks to three abstractions —
  `useAuth()`, `usePersist()`, and the passkey helpers — so the provider behind
  them (currently Firebase) can change without touching UI code.
- **Degrade gracefully.** With no backend configured, everything still runs on
  `localStorage` exactly as it did before accounts existed.

## Layers

```
                       ┌─────────────────────────────┐
   app shell           │  main.jsx                   │  providers + routing gate
                       │  PackPal.jsx                │  views, CRUD, orchestration
                       └──────────────┬──────────────┘
                                      │ imports
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
  components/                      lib/  (logic)                  data/  (facts)
  AuthGate, Account,        theme, utils, weather,        taxonomy, catalog,
  Onboarding                packing, auth, store,         recommendations,
                            passkey, firebase,            content, history
                            importHist
                                      │
                                      ▼
                            Firebase (Auth · Firestore · Functions)
                            functions/  +  firestore.rules
```

Dependencies only ever point downward. ESLint's `no-undef` plus the layering
keep the graph honest.

## Directory map

### `src/data/` — pure facts, no logic, no UI
| File | Holds |
|------|-------|
| `taxonomy.js` | `TRIP_TYPES`, `TEMP_RANGES`, `CATEGORIES` — the controlled vocabularies (imports color tokens from `theme`). |
| `catalog.js` | `CORE` (the 22-trip packing catalog with frequency/essential/forgotten flags) + `COND_ITEMS` (trip-type add-ons). |
| `recommendations.js` | `TEMP_RECS` (by temperature band) + `SMART_RECS` (by trip type). |
| `content.js` | `UNFREEZE_STEPS` + `AFFIRMATIONS` — Freak Out mode copy. |
| `history.js` | `HIST_TRIPS` — the 22 historical trips (also the onboarding starter import). |

### `src/lib/` — pure logic + infrastructure
| File | Responsibility |
|------|----------------|
| `theme.js` | Design tokens: `C` (palette), `F` (fonts), `COUNTRY_CODES`. **Single source** — never redefine colors inline. |
| `utils.js` | `id()`, `haptic()`. |
| `weather.js` | `fetchWeather()` — normalized lookup, returns `null` on failure. |
| `packing.js` | `genList()`, `genTripOtd()`, `tempToRange()` — the list-generation domain logic. |
| `firebase.js` | Initializes the Firebase app + exports `auth`/`db`/`functions` and `LOCAL_MODE`. |
| `auth.jsx` | `AuthProvider` / `useAuth()` — phone OTP, session, profile. |
| `store.jsx` | `StoreProvider` + `usePersist()` — cloud-synced state with a localStorage mirror. |
| `passkey.js` | WebAuthn register/login client. |
| `importHist.js` | Converts `HIST_TRIPS` → editable trips for onboarding import. |

### `src/components/` — presentational + flow screens
`AuthGate.jsx` (phone → OTP → passkey sign-in), `Account.jsx` (account sheet),
`Onboarding.jsx` (one-time setup + import).

### `src/PackPal.jsx` — the application
State, CRUD, view routing, and the in-file view components (trip view, wizard,
Guided Pack, Insights, Outfit Builder, etc.). This is the one file still large
enough to warrant further decomposition — see "What's next."

### Backend
`functions/index.js` (callable Cloud Functions for passkeys), `firestore.rules`
(per-user access), `firebase.json`. Provisioning is documented in `SETUP.md`.

## Runtime data flow

1. **`main.jsx`** wraps everything in `<AuthProvider>` and renders `<Gate>`.
2. **`Gate`** decides what to show:
   `loading → splash`, `not signed in → AuthGate`, otherwise
   `<StoreProvider>` wrapping either `Onboarding` (first run) or `PackPal`.
3. **`StoreProvider`** loads the user's state on login and exposes it through
   `usePersist(key, default)`, which has the *exact* signature of the old
   localStorage hook — so view code never knows whether it's online.
4. **Writes** flow `usePersist setter → debounced Firestore write + localStorage
   mirror`. Reads prefer the cloud, fall back to the mirror when offline.

### Two modes (automatic)
- **Local** — no `VITE_FIREBASE_*` env vars: no login, pure `localStorage`.
- **Cloud** — env present: phone OTP, passkeys, multi-device sync.

`LOCAL_MODE` (from `firebase.js`) is the single switch; every infra module
checks it and falls back cleanly.

## Conventions

- **Colors/fonts:** import `C` / `F` from `lib/theme`. Never hard-code a hex
  that already has a token; never redefine the palette.
- **IDs:** `id()` from `lib/utils` for any client-created entity.
- **Persisted state:** add it via `usePersist("yourKey", default)`. It will sync
  automatically; no other wiring is needed.
- **Data vs. logic vs. UI:** a new constant table goes in `data/`; a new pure
  function in `lib/`; anything with JSX in `components/` or `PackPal.jsx`.
- **Linting:** `npm run lint` must pass clean before committing. `no-undef` is an
  error on purpose — it catches the "moved a symbol, forgot the import" bug.

## How to extend

**Add a trip type** → add an entry to `TRIP_TYPES` in `data/taxonomy.js`
(`id`, `label`, `icon`, `color`). Optionally add matching `SMART_RECS` and
`COND_ITEMS` keyed by that `id`. No UI changes required — the wizard and filters
map over the data.

**Add a packing category** → add to `CATEGORIES` in `data/taxonomy.js`, then add
items under that category id in `CORE` (`data/catalog.js`).

**Add catalog items** → edit `CORE` in `data/catalog.js`. Set `f` (0–1
frequency), `e` (essential), `ff` (frequently forgotten), `cond` (trip types).
`genList()` picks them up automatically.

**Add a recommendation** → add to `TEMP_RECS` (by temp band) or `SMART_RECS` (by
trip type) in `data/recommendations.js`.

**Add a persisted setting** → call `usePersist("newKey", default)` anywhere in
the tree under `StoreProvider`. It syncs with zero extra code.

**Swap the backend** → reimplement `lib/firebase.js`, `lib/auth.jsx`,
`lib/store.jsx`, and `lib/passkey.js` against the new provider, keeping their
exported shapes. Nothing else should need to change (this is exactly how the
Supabase → Firebase migration was done).

## Tooling

| Command | Does |
|---------|------|
| `npm run dev` | Vite dev server. |
| `npm run build` | Production build. |
| `npm run lint` | ESLint over `src` (flat config in `eslint.config.js`). |
| `npm run format` | Prettier write. |

## What's next (intentional debt)

`src/PackPal.jsx` (~3.5k lines) still contains the view components and the main
orchestrator. The safe, recommended next step is to extract those components into
`src/components/` **incrementally, with the dev server running**, so UI
regressions are caught by eye — something a static build/lint pass cannot do.
Good first candidates (self-contained, clear props): `ProgressRing`, `Btn`,
`PackItem`/`PackSection`, the celebration subsystem (`ConfettiBurst`,
`CelebrationToast`, `useCelebration`), then the larger mode screens
(`GuidedPack`, `FreakOutMode`, `Insights`, `OutfitBuilder`).
