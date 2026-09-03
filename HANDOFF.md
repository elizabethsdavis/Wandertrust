# PackPal — Handoff / Start Here

Read this first if you're picking up PackPal in a new session. It captures the
current state, the hard constraints, the audit findings, and the exact next
steps. The deeper docs are indexed below.

## How to resume in a new chat
1. Connect the PackPal folder so the agent can read the repo.
2. Point it at this file: *"Read HANDOFF.md and the docs it links, then continue."*
3. The docs below carry the architecture, stack, auth design, and setup — a fresh
   agent can rebuild full context from them.

## Doc index
- **ARCHITECTURE.md** — module layering (data / lib / components / app shell), data flow, how to extend.
- **TECH_STACK.md** — the Vercel + Firebase stack, setup walkthrough, the debugging playbook (every error we hit → fix), and how to coach a user through setup.
- **AUTH_AND_PROFILE.md** — deep-dive on the sign-in flow + user profile (UX + backend).
- **SETUP.md** — click-by-click Firebase/Vercel provisioning.
- **README.md** — run instructions.
- **scripts/browser-checks.py** — Playwright regression run for every audit fix (B1–B5, B7–B9): builds nothing itself; serve `dist/` with `vite preview` in LOCAL_MODE and run it. 36/36 on 2026-09-03 (Tier 3 build). Re-run after each tier.

## Current state (as of this handoff)
- **Live in production.** Firebase project `packpal-6f1a8`; deployed on Vercel at `wandertrust.vercel.app` (GitHub repo `elizabethsdavis/wandertrust`, branch `main`).
- Working: phone-OTP sign-in, passkeys (Face ID), Firestore cloud sync, onboarding.
- Firebase project number `174082655683`; Vercel project `prj_gBjXgMnzGIdgQs1ST6tJ03R08Uec`, team `team_WEizNhF8qWNse8CYAUdb9exr`.
- **Added this session (built, DB-safe, not yet audited-clean):**
  - Auto-collapse of completed sub-sections *and* completed categories in the trip view (pure UI state).
  - Editable **packing template** (`TemplateEditor.jsx` + new additive `catalogTemplate` key; `genList` uses it via a `coreOverride` param). The Out-the-Door checklist editor already existed.
- **Tier 1 audit fixes applied (2026-09-03):** B2, B3, B4, B5 — see the ✅ rows in the bug table. Lint clean (0/0), `vite build` passes. No persisted-shape change.
- **On GitHub + deployed (2026-09-03):** the template/collapse features, these docs, and the Tier 1 fixes are on `origin/main` (`46056ba`…`fd7636a`, uploaded via the GitHub web UI) and live on Vercel.
- **Tier 2 on GitHub + deployed (2026-09-03):** `34da6d3`…`4c5708e` (web-uploaded in three commits) — live on Vercel. Local `main` == `origin/main`.
- **Tier 3 committed locally (2026-09-03), not yet on GitHub:** B10, the `activeTrip` derivation refactor (which also fixed a live bug — packing an outfit item just synced from the Outfit Builder was never persisted), and B6 (verified a false positive; hardened anyway). Files: `src/PackPal.jsx`, `src/lib/store.jsx`, `src/lib/auth.jsx`, `src/lib/localMirror.js` (new), `src/components/Account.jsx`, `scripts/browser-checks.py` (new), `HANDOFF.md`.

## HARD CONSTRAINTS (do not skip)
- The app is **live with real Firestore data**. **No change to the persisted data shape without a backward-compatible migration + fallback.** There is no schema version and no read-time normalizer, so every field name in the state blob is a frozen contract.
- Persisted shape (from the DB audit):
  - `state/{uid}` = `{ state: "<JSON string>", updatedAt }`. The parsed string holds the `usePersist` keys: `trips[]`, `wardrobe{}`, `customOccasions[]`, `otdItems[]`, `catalogTemplate|null`.
    - `trip` = `{ id, destination, tripType[], days, weather, startDate, tempRange, items[], otdItems[], otdChecked{index:bool}, createdAt, icon, weatherData }`.
    - `item` = `{ id, name, category, section, packed, essential, ff, freq, needsRefill, needsCharge, refilled?, charged? }`; `category ∈ outfits|activewear|necessities|tech|toiletries|checkout`.
  - `users/{uid}` = `{ phone, onboarded, createdAt }`.
  - `credentials/{autoId}`, `challenges/{autoId}` — passkeys, server-only.
  - localStorage mirror keys: `pp2_trips|pp2_wardrobe|pp2_customOccasions|pp2_otdItems|pp2_catalogTemplate`, plus `pp2_owner` = the uid the cached data belongs to (since Tier 3; absent for local-mode / pre-cloud data so onboarding can still import it). Helpers live in `src/lib/localMirror.js`.

---

## AUDIT (3 evaluator subagents, this session)

Overall: **B+ — "a senior engineer built this, but the main file is mid-refactor and has a few real bugs."** ESLint is clean; the build passes. `src/PackPal.jsx` is still ~3,500 lines holding ~20 view components + the orchestrator.

> ⚠️ The production-runtime-error check (`get_runtime_errors`) was interrupted (permission) and still needs running.

### Confirmed bugs
| # | Bug | File | Fix | Risk |
|---|-----|------|-----|------|
| B1 | ✅ **FIXED** — **Conditional items leak into every trip** — `genList` guard `it.cond && !some && it.f < 0.5` lets any `cond` item with `f≥0.5` (Passport, Corporate badge, Boarding Passes) onto *all* trips regardless of type. | `src/lib/packing.js:17-18` | Gate purely on the condition: `if (it.cond && !it.cond.some(t=>ts.includes(t))) return;` | Low, behavioral — test |
| B2 | ✅ **FIXED** — **`catalogTemplate` dropped in local/offline mode** — new key missing from `KNOWN_KEYS`, so the user's template isn't mirrored to localStorage (fine in cloud mode, lost in LOCAL_MODE / offline fallback). *(Defect in this session's feature.)* | `src/lib/store.jsx:23` | Add `"catalogTemplate"` to `KNOWN_KEYS`. | **None (additive)** |
| B3 | ✅ **FIXED** — **Undefined color token** — `C.sageDeep` doesn't exist → broken gradient on the refilled checkbox. | `src/PackPal.jsx` (FocusRefill) | `sageDeep` → `sageDark`. | None |
| B4 | ✅ **FIXED** — **Stale "Supabase" copy** — offline users are told to add "Supabase keys"; app is Firebase now. | `src/components/Account.jsx:92-93`, `PackPal.jsx:129` (comment) | Update to Firebase / SETUP.md. | None |
| B5 | ✅ **FIXED** — **`catOverride` (category collapse) not reset across trips** — expand a done category in trip A, open trip B, its match starts expanded. *(This session's feature.)* | `src/PackPal.jsx` (trip view) | Keyed the override by `${trip.id}:${cat.id}`; also keyed the items container by `activeTrip.id` so `PackSection`'s local collapse state remounts on a direct trip→trip switch (Duplicate from inside a trip). | Low |
| B6 | ✅ **NOT A BUG (verified) + hardened** — **One-shot migration runs stale in cloud mode** — checkout→OTD `useEffect([])` reads empty `trips` before the async Firestore load, so it never runs for cloud users (and would write from a stale base if it did). | `src/PackPal.jsx` (migration effect) | `StoreProvider` renders a splash until the blob has loaded, so `PackPal` never mounts with empty `trips` — the effect always ran on loaded data. Made the invariant explicit: effect now gated on `useStoreMeta().ready`. Browser check seeds a legacy trip and confirms the migration runs. | None |
| B7 | ✅ **FIXED** — **`dupTrip` carries `otdChecked` + stale `outfitPlan` item ids.** | `src/PackPal.jsx` (dupTrip) | `otdChecked:{}`; items also clear `refilled`/`charged`; `outfitPlan` kept but deep-copied with fresh occasion ids (`outfitDayNames`/`dayEmojis` copied too). | Low |
| B8 | ✅ **FIXED** — **Phantom `jewelry` slot** — a local `OUTFIT_SLOTS` shadow with a non-existent slot under-counts the outfit-complete celebration. | `src/PackPal.jsx` (handleDoneOutfit) | Delete the shadow; use module `OUTFIT_SLOTS`. | Low |
| B9 | ✅ **FIXED** — **Emoji `.slice(-2)`** corrupts multi-codepoint emoji (flags/ZWJ). | `src/PackPal.jsx` (day/occasion/new-type emoji inputs) | New `lastGrapheme()` in `lib/utils.js` (Intl.Segmenter grapheme clusters, code-point fallback) — `Array.from().slice(-1)` alone still splits flags. | Low |
| B10 | ✅ **FIXED** — **`signOut` doesn't clear the localStorage mirror** — a second user on the same device can transiently see the previous user's trips. | `src/lib/localMirror.js` (new), `store.jsx`, `auth.jsx`, `Account.jsx` | Mirror is now owned by a uid (`pp2_owner`): a *different* uid signing in wipes it before Onboarding can offer it; sign-out flushes pending saves (new `flush()` on the store, warns via `confirm` if the cloud write fails) then `clearLocal()`. Local-mode / pre-cloud data (no owner) is never wiped. | Low |

### DB-safety (data-layer audit)
- **P0 — multi-device data loss:** single JSON blob, loaded once at login, `setDoc` last-write-wins (no `onSnapshot`; `updatedAt` written but never read). Two devices/tabs → last save clobbers the other. Inherent to the single-blob design; needs an `onSnapshot` listener and/or conflict detection to fix.
- **P1 — 1 MiB doc limit:** everything in one doc, trips never pruned, `weatherData` stored per trip. Near the ceiling `setDoc` throws and is only `console.warn`-ed → silent cloud-save failure. Add a size guard + surface the error.
- **P1 — empty-blob clobber path:** a successful read of a momentarily-missing doc is treated as "new user (empty)"; guard against pushing an empty/smaller blob over a previously-non-empty one.
- **Confirmed additive/non-breaking:** `catalogTemplate` (except the `KNOWN_KEYS` gap, B2) and the collapse feature (pure UI, nothing persisted).

### Structure / quality (architecture audit)
- **Decompose `PackPal.jsx` — SAFE leaf components to extract first** (props-only, deps already in lib/data): `ProgressRing`, `Btn`, `MiniBar`, `PackItem`, `PackSection`, the celebration subsystem (`ConfettiBurst`/`CelebrationToast`/`useCelebration`), `FreakOutMode`, `FocusRefill`, `FocusCharge`, `SmartRecsView`, `Insights`, `GlobalOtdEditor`. **Do it with the dev server running** (visual regressions a build can't catch). **RISKIER:** `OutfitBuilder`, `OutTheDoor` — extract later, carefully.
- ✅ **DONE (Tier 3):** `activeTrip` is now derived — `activeTripId` state + `useMemo(() => trips.find(...))`; all ~12 paired `setActiveTrip` writes removed, every mutation goes through `setTrips` once. This fixed a **real live bug**: the Outfit Builder's sync minted *different* item ids in the two copies, so packing a freshly synced outfit item was never persisted (reproduced by `scripts/browser-checks.py` against `4c5708e`, fixed after).
- Nits: `id()` uses deprecated `substr` (+ a duplicate `rid()` in `importHist.js`); several lists keyed by array index; recurring inline hexes should become `theme.js` tokens; `theme.js` has a stale "mirror" comment.

---

## Recommended next steps (pending user approval — "audit, then approve")
**Tier 1 — ✅ DONE (2026-09-03):** B2, B3, B4, B5. Verified with `npm run lint` + `vite build`, and browser-verified 2026-09-03 via `scripts/browser-checks.py` (Playwright, LOCAL_MODE).
**Tier 2 — ✅ DONE (2026-09-03):** B1, B7, B8, B9. Lint clean, build passes, 28 node-level checks on `genList` / `lastGrapheme` / the dup logic, plus the browser run below (31/31).
  - B1 effect, measured against the real catalog: only two items change — **Passport** no longer appears on trips that aren't `international`/`beach`, and **Corporate badge** only on `business`. Nothing is added; existing trips are untouched (items are persisted per trip). Note: *Boarding Passes* has no `cond` and still appears everywhere (the original audit line was slightly off). Data question for Elizabeth: Passport's `cond` doesn't include `safari` — tag safari trips as International too, or add `safari` to its `cond` in `data/catalog.js`.
**Tier 3 — ✅ DONE (2026-09-03):** B10, `activeTrip` derivation, B6 (false positive, hardened). Lint clean, build passes, browser harness 36/36 (incl. new T3 + B6 checks), node checks for the mirror owner logic. **B10 cannot be exercised in LOCAL_MODE** — worth one manual pass on the live site after deploy: sign out → sign back in → trips still there; Account → Sign out shows a spinner and no `pp2_*` keys remain in DevTools → Application → Local Storage.
**Tier 4 — larger, staged:** extract the SAFE leaf components from `PackPal.jsx` (dev server running); design DB hardening (onSnapshot / size guard) — the multi-device + 1 MiB items are real but architectural.

Also outstanding: run `get_runtime_errors` on the Vercel project; commit + push this session's work.

## Git note
This repo pushes through a per-repo alias because the machine has two GitHub accounts + an `insteadOf` SSH rewrite. Use **`git pushpp`** (defined in `.git/config`) to push as `elizabethsdavis`. Plain `git push` fails with "denied to elizabeth-davis-dd."

**Fallback when pushing isn't possible:** the repo is public and the Vercel project is Git-linked, so uploading changed files through GitHub's web UI (`Add file → Upload files`, one folder at a time — the uploader drops files into whatever folder you're viewing; Safari can't drag folders) commits to `main` and auto-deploys. Afterwards reconcile the local clone with `git fetch origin && git reset --hard origin/main` (safe only when the trees are identical — verify with `git diff --stat HEAD origin/main` first). Note `pushpp` pushes to a URL, so `origin/main` is NOT updated by it; run `git fetch origin` to refresh the ahead/behind count.
