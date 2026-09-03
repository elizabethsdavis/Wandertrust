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
                            passkey, firebase,            content, history,
                            importHist, localMirror,      otdDefaults
                            merge, migrations, template,
                            reorder, exportList, wardrobe
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
| `catalog.js` | `CORE` (the 22-trip packing catalog with frequency/essential/forgotten flags; categories `activewear`, `necessities`, `health`, `tech`, `toiletries`, `checkout`) + `COND_ITEMS` (trip-type add-ons). |
| `recommendations.js` | `TEMP_RECS` (by temperature band) + `SMART_RECS` (by trip type). |
| `content.js` | `UNFREEZE_STEPS` + `AFFIRMATIONS` — Freak Out mode copy. |
| `history.js` | `HIST_TRIPS` — the 22 historical trips (also the onboarding starter import). |
| `otdDefaults.js` | `DEFAULT_OTD_ITEMS` — the default Out-the-Door checklist. |

### `src/lib/` — pure logic + infrastructure
| File | Responsibility |
|------|----------------|
| `theme.js` | Design tokens: `C` (palette), `F` (fonts), `COUNTRY_CODES`. **Single source** — never redefine colors inline. |
| `utils.js` | `id()`, `haptic()`. |
| `weather.js` | `fetchWeather()` — normalized lookup, returns `null` on failure. |
| `packing.js` | `genList(types, days, template, { addins, tempRange, conditions })`, `genTripOtd()`, `tempToRange()` — the list-generation domain logic. |
| `firebase.js` | Initializes the Firebase app + exports `auth`/`db`/`functions` and `LOCAL_MODE`. |
| `auth.jsx` | `AuthProvider` / `useAuth()` — phone OTP, session, profile. |
| `store.jsx` | `StoreProvider` + `usePersist()` — cloud-synced state with a localStorage mirror. |
| `passkey.js` | WebAuthn register/login client. |
| `importHist.js` | Converts `HIST_TRIPS` → editable trips for onboarding import. |
| `localMirror.js` | The `pp2_*` localStorage mirror: read/write/clear + the `pp2_owner` uid tag. |
| `merge.js` | `mergeState(base, local, remote)` — pure three-way merge used for multi-device sync. |
| `migrations.js` | `migrateTrip()` / `migrateTemplate()` — idempotent load-time migrations of persisted data (checkout → OTD, necessities → health, Clothing → Tops/Bottoms via `slotToSection()`). |
| `template.js` | The packing template's pure logic: `templateBase()`, `expectedTemplateItems()`, `diffTripAgainstTemplate()`, `applyTemplateChanges()`, the `FLAGS` (refill / charge / laundry). |
| `reorder.js` | `moveSection()` / `moveItem()` — rebuild `trip.items` for Arrange mode (order *is* array order). |
| `exportList.js` | `tripToMarkdown()` / `markdownFileName()` — the shareable Markdown checklist. |
| `wardrobe.js` | `parseItemMeta()` (colour family + shade + two-tone, pattern, brand from capitalization / known brands), `swatchBackground()`, `colorToHex()`; manual overrides come from the `wardrobeMeta` key. |
| `addins.js` | Trip-type / weather add-ins (the `addins` key; defaults = `COND_ITEMS`): `addinItemsFor()` for `genList`, `detectConditions()` (rain / snow from forecast text), `WEATHER_KEYS` / `TYPE_KEYS` for the editor. |
| `tripStatus.js` | `isPastTrip()` / `tripEndDate()` / `endedLabel()` — derived (never stored) "this trip is over" status for the read-only lock and the Home grouping. |
| `version.js` | `APP_VERSION` (build stamp), `fetchDeployedVersion()`, `reloadApp(flush)`, `useUpdateAvailable()` — the reload button and the "newer version" banner. |

### `src/components/` — presentational + flow screens
Flow screens: `AuthGate.jsx` (phone → OTP → passkey sign-in), `Account.jsx`
(account sheet: sync status, storage, passkey, sign out), `Onboarding.jsx`
(one-time setup + import), `TemplateEditor.jsx` (two tabs — the packing
template and its trip-type / weather add-ins — with per-item refill / charge /
laundry toggles and drag-and-drop ordering), `TemplateSync.jsx` ("Save to
template": diff the open trip against the template, tick, apply).

Props-only leaf components (no store access; extracted from `PackPal.jsx`):
`ui.jsx` (`ProgressRing`, `Btn`, `MiniBar`), `PackList.jsx` (`PackItem`,
`PackSection`), `celebration.jsx` (`useCelebration` → confetti + toast),
`FreakOutMode.jsx`, `GuidedPack.jsx` (Focus Pack), `FocusRefill.jsx`,
`FocusCharge.jsx`, `FocusLaundry.jsx`, `SmartRecsView.jsx`, `Insights.jsx`,
`GlobalOtdEditor.jsx`, `ShareSheet.jsx` (copy / native share / download the
Markdown export), `ArrangeList.jsx` (dnd-kit drag-and-drop of sections and
items), `WardrobeMetaPicker.jsx` (fix a wardrobe item's colour / brand),
`UpdateBanner.jsx` (mounted in `main.jsx`; "a newer version is ready"),
`dnd.jsx` (shared dnd-kit sensors + grip handle for Arrange mode and the
template editor).

### `src/PackPal.jsx` — the application
State, CRUD, view routing, and the views that are wired tightly into trip state:
Home, the new-trip wizard, the trip view, and the two in-file components
`OutTheDoor` and `OutfitBuilder` (~2.3k lines). The open trip is *derived*
(`activeTripId` + a lookup into `trips`), so every mutation goes through
`setTrips` exactly once. See "What's next" for the remaining decomposition.

### `public/` — static files served as-is
The Home Screen / PWA bits: `apple-touch-icon.png`, `icon-192.png`,
`icon-512.png`, `favicon.svg`, `favicon-32.png` (all generated by
`scripts/make-icons.py` from `scripts/icon-src/`) and `manifest.webmanifest`.
`version.json` is *not* here — `scripts/version-stamp.js` (a tiny Vite plugin
used by both Vite configs) emits it at build time next to the bundle, stamped
with the Vercel commit SHA (or `local-<timestamp>`), and exposes the same value
as `import.meta.env.VITE_APP_VERSION`.

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
4. **Writes** flow `usePersist setter → debounced, transactional Firestore write +
   localStorage mirror`. Reads prefer the cloud, fall back to the mirror when offline.
5. **Multi-device:** after the initial load the store listens with `onSnapshot`.
   A change from another device is applied live when this device is clean, or
   three-way merged (`lib/merge.js`) when it holds unsaved edits; the write
   transaction merges the same way if the doc moved under it. Save failures and
   the 1 MiB document limit are surfaced in the Account sheet (never silent).

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
`COND_ITEMS` keyed by that `id` (the latter are the built-in add-ins the editor's
Add-ins tab starts from). No UI changes required — the wizard, filters and the
editor map over the data.

**Add a packing category** → add to `CATEGORIES` in `data/taxonomy.js`, then add
items under that category id in `CORE` (`data/catalog.js`). Moving *existing*
sections between categories is a persisted-data change: add a step to
`lib/migrations.js` (as the `health` split did) so old trips and a stored
template follow.

**Add catalog items** → edit `CORE` in `data/catalog.js`. Set `f` (0–1
frequency), `e` (essential), `ff` (frequently forgotten), `cond` (trip types).
`genList()` picks them up automatically.

**Add a recommendation** → add to `TEMP_RECS` (by temp band) or `SMART_RECS` (by
trip type) in `data/recommendations.js`.

**Add a persisted setting** → call `usePersist("newKey", default)` anywhere in
the tree under `StoreProvider`, and add the key to `KNOWN_KEYS` in
`lib/localMirror.js` so the offline mirror keeps it too.

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

The props-only leaf components are out of `src/PackPal.jsx` (3.5k → 2.3k lines).
What remains in-file is deliberate: `OutTheDoor` and `OutfitBuilder` reach into
trip state and callbacks in ways the leaf components don't, and the audit flagged
them as the risky extractions. Move them one at a time, and after each move run
**both** harnesses — `scripts/browser-checks.py` (local mode, 86 checks, with
screenshots you can pixel-diff against the previous run) and
`scripts/cloud-checks.py` (cloud mode, 40 checks). Smaller nits still open:
a few lists keyed by array index, and recurring inline hexes that could become
`theme.js` tokens.
