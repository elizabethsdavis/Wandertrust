# Upload plan — Outfits

Local `c6d1f3a` is 4 commit(s) ahead of `origin/main` (`a79056a`). 24 file(s) to upload, 0 to delete, 7 step(s). Do them **in this order** so every intermediate Vercel build stays green.

Each step: open the URL, drag the listed files in from the bundle folder (the uploader drops them into the folder you are viewing), paste the commit message as the title, choose *Commit directly to the main branch*, click *Commit changes*. Summaries are filled in.

1. **scripts** → `https://github.com/elizabethsdavis/wandertrust/upload/main/scripts` — from `PackPal-github-upload/scripts/`: `browser-checks.py`, `cloud-checks.py`, `upload-plan.py`
   ```
   Check the outfit closet, builder tabs, photos and past-trip import in both harnesses; add the upload-plan script - Outfits 1/7
   ```
2. **scripts/cloud-sim** → `https://github.com/elizabethsdavis/wandertrust/upload/main/scripts/cloud-sim` — from `PackPal-github-upload/scripts/cloud-sim/`: `fake-firebase.js`, `vite.config.js`
   ```
   Fake firebase/storage in the cloud-sim so photo uploads run in the harness - Outfits 2/7
   ```
3. **Root** → `https://github.com/elizabethsdavis/wandertrust/upload/main` — from `PackPal-github-upload/`: `ARCHITECTURE.md`, `GITHUB_UPLOAD.md`, `HANDOFF.md`, `SETUP.md`, `TECH_STACK.md`, `firebase.json`, `storage.rules`
   ```
   Add storage.rules for outfit photos and document the Outfits batch and the web-upload playbook - Outfits 3/7
   ```
4. **src/data** → `https://github.com/elizabethsdavis/wandertrust/upload/main/src/data` — from `PackPal-github-upload/src/data/`: `outfitSlots.js`
   ```
   Add the nine outfit slot definitions as pure data - Outfits 4/7
   ```
5. **src/lib** → `https://github.com/elizabethsdavis/wandertrust/upload/main/src/lib` — from `PackPal-github-upload/src/lib/`: `localMirror.js`, `merge.js`, `outfits.js`, `photos.js`
   ```
   Add the saved-outfits logic and photo resize/upload; mirror and merge savedOutfits - Outfits 5/7
   ```
6. **src/components** → `https://github.com/elizabethsdavis/wandertrust/upload/main/src/components` — from `PackPal-github-upload/src/components/`: `Closet.jsx`, `Onboarding.jsx`, `OutfitBuilder.jsx`, `OutfitCard.jsx`, `OutfitEditor.jsx`, `WardrobeCarousel.jsx`
   ```
   Add the closet, the two-tab Outfit Builder, the extracted outfit editor and cards; import savedOutfits in onboarding - Outfits 6/7
   ```
7. **src** → `https://github.com/elizabethsdavis/wandertrust/upload/main/src` — from `PackPal-github-upload/src/`: `PackPal.jsx`
   ```
   Wire the closet and the new Outfit Builder into the app and sync every shortlisted outfit - Outfits 7/7
   ```

Before or after the uploads (photos only): Firebase console → Build → Storage → Get started (production, us-west2), then `firebase deploy --only storage` in Terminal.

After Elizabeth says it is uploaded, run the verification in GITHUB_UPLOAD.md § 5.
