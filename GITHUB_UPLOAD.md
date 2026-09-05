# Shipping PackPal through GitHub's web uploader

**Who this is for:** an agent (or Elizabeth) shipping a batch of PackPal changes
when `git push` isn't available. Read it end to end once; then follow §2–§6 for
every batch. `scripts/upload-plan.py` does the mechanical part.

## 1. Why we do it this way

- The repo lives at `~/Documents/Claude/Projects/PackPal` on Elizabeth's Mac.
  Pushing needs `git pushpp` (an alias that only works in her own Terminal —
  the Mac has two GitHub identities, and a plain `git push` is denied). The
  Cowork device VM cannot push at all: it has no `gh`, no GitHub credentials.
- GitHub repo **`elizabethsdavis/wandertrust`** is public. Vercel project
  `prj_gBjXgMnzGIdgQs1ST6tJ03R08Uec` (team `team_WEizNhF8qWNse8CYAUdb9exr`) is
  Git-linked: **every commit to `main` auto-deploys production** at
  `wandertrust.vercel.app` in about a minute.
- So the loop is: commit locally → build an upload bundle → Elizabeth drags
  the files into GitHub's *Upload files* page one folder at a time (Safari
  can't drag folders) → each upload becomes a commit → verify → reconcile the
  local clone with `origin/main`.

Elizabeth likes this workflow and has done it many times. What she wants from
the agent each time: **an exact bundle folder** containing only the changed
files in their real structure, and **a numbered list of uploads with a
ready-to-paste commit message for each**.

## 2. Before building the bundle

1. All work is **committed locally** on `main`. Never bundle from a dirty
   working tree — the bundle is built from `HEAD`.
2. Run `git --no-optional-locks fetch origin` and make sure `origin/main` has
   nothing the local clone lacks (`git rev-list --count HEAD..origin/main`
   must be `0`). If it isn't, something was committed on GitHub directly —
   stop and reconcile before anything else (§6).
3. In the device VM always call git as **`git --no-optional-locks …`** for
   `status` / `diff` / `log`. Plain `git status` writes `.git/index.lock` on the
   mounted folder and the VM can't remove it, which then blocks Elizabeth's
   next git command.
4. It is normal for local `main` to be **one HANDOFF-only commit ahead** of
   `origin/main` from the previous round (the status note written after a
   deploy). It simply rides along with the next batch.

## 3. Build the bundle and the plan

```
cd ~/Documents/Claude/Projects/PackPal        # $HOME/mnt/Projects/PackPal in the VM
python3 scripts/upload-plan.py "Batch name"   # e.g. "Home Screen", "Renames & Icon"
```

This writes `../PackPal-github-upload/` (next to the repo, never inside it) with
byte-for-byte copies of every added / modified file, plus `UPLOAD_PLAN.md`
listing the steps. `--check` prints the plan without writing anything.

The plan orders folders so that **every intermediate Vercel build stays
green** (each upload deploys on its own, so a file that imports a not-yet-
uploaded file would break a build — harmless, the previous deploy stays live,
but avoid it):

1. `scripts/` — build-time helpers that `vite.config.js` may import
2. `scripts/<sub>/`
3. **Root** — `package.json` / `package-lock.json` (new deps), `vite.config.js`,
   `index.html`, docs
4. Static and independent folders — `public/`, `functions/`
5. `src/data/` → 6. `src/lib/` → 7. `src/components/` → 8. other `src/<sub>/`
9. `src/` itself — `PackPal.jsx`, `main.jsx` last, since they import everything
10. Deletions, one per step (§4)

If a file must break that order (rare), say so in the plan.

## 4. Commit messages and hand-off

Every upload is one commit. Elizabeth's format, which she asked for explicitly:

```
<Verb-first summary> - <Batch name> N/M
```

- Start with a verb: *Add*, *Drop*, *Wire*, *Rename*, *Stop generating*, …
  Present tense, no trailing period, one line.
- End with the shared batch tag and the step counter. `M` counts **every**
  step including deletions.
- Examples from real batches:
  - `Drop the SVG favicon, cache-bust the touch icon (index.html + docs) - Renames & Icon 5/6`
  - `Wire category overrides through the trip view and add the trip emoji picker - Renames & Icon 4/6`
  - `Remove favicon.svg - Renames & Icon 6/6`

`upload-plan.py` leaves `<summary>` placeholders — fill them in from the real
diff of each folder (`git --no-optional-locks diff origin/main HEAD -- <folder>`),
then give Elizabeth the finished list in the chat, in this shape:

```
1. **scripts** → https://github.com/elizabethsdavis/wandertrust/upload/main/scripts — `make-icons.py`, `browser-checks.py`
   ```
   Stop generating favicon.svg; check the icon fix and renames in the harness - Renames & Icon 1/6
   ```
```

Special cases:

- **New folder** (e.g. `public/` didn't exist yet): the upload URL for a
  folder that doesn't exist yet worked for her
  (`…/upload/main/public`). Fallback if GitHub refuses the page: *Add file →
  Create new file*, type `public/manifest.webmanifest` as the name (the slash
  creates the folder), paste the text file's content, commit; then upload the
  rest into the now-existing folder.
- **Deleted file**: can't be done from the uploader. Open the file on GitHub
  (`https://github.com/elizabethsdavis/wandertrust/blob/main/<path>`), tap the
  trash icon at the top right of the file view, commit with
  `Remove <file> - <Batch> N/M`.
- **Binary files** (PNGs, fonts): drag-upload only — *Create new file* can't
  take them.
- **`node_modules`**: never in the bundle. If a batch added an npm dependency,
  `package.json` + `package-lock.json` go in the root upload and Vercel
  installs it; for Elizabeth's local dev, pure-JS packages can be copied into
  her `node_modules` from a cloud install (never run `npm install` in the VM —
  it writes Linux binaries into her Mac's `node_modules`).
- **Many files in one folder**: GitHub's uploader takes up to 100 files per
  upload; split by sub-folder if a single upload would exceed that.

What Elizabeth does per step (for reference, she knows it): open the URL →
drag the listed files from the bundle folder in Finder onto the page (the
uploader drops them into the folder shown in the breadcrumb) → paste the
message into the first commit box → keep *Commit directly to the main branch*
→ *Commit changes*. Each step takes Vercel ~40–60 s to deploy; she doesn't
need to wait between steps.

## 5. Verify after she says "uploaded"

1. `git --no-optional-locks fetch origin` then
   `git --no-optional-locks diff --stat HEAD origin/main` — **must print
   nothing**. If it doesn't, list what differs (a skipped file, a file dropped
   into the wrong folder, a stale version) and tell her exactly which step to
   redo; don't reconcile until it's empty.
2. `git --no-optional-locks log --oneline origin/main -<N>` — one commit per
   step, in her message format.
3. Vercel: `list_deployments` for the project — every new deployment `READY`,
   the newest one `production` with the last commit's SHA. If one is `ERROR`,
   `get_deployment_build_logs` on it; it almost always means an out-of-order
   upload, and the next step's deploy fixes it.
4. Live site: `web_fetch_vercel_url` on
   `https://wandertrust.vercel.app/version.json` — `version` equals the short
   SHA of the newest commit (the build stamps it). Spot-check any new static
   file the batch added (`/manifest.webmanifest`, an icon) and, for a deleted
   static file, that its URL now falls through to `index.html`.

## 6. Reconcile

Only when §5 step 1 is empty:

```
git --no-optional-locks reset --hard origin/main
```

That is safe precisely because the trees are identical — it only swaps the
local commits for GitHub's equivalents. Then:

1. Update the status line for the batch in `HANDOFF.md` ("✅ ON GITHUB +
   DEPLOYED (date): `<first>`…`<last>` (web-uploaded in N commits …)") and
   commit it locally — this is the one-ahead commit mentioned in §2.
2. Delete `../PackPal-github-upload/` (in the VM this needs the delete
   permission once per session; if it's refused, move it to
   `../_to_delete/` and say so).
3. Tell Elizabeth what's live and the one or two manual checks worth doing on
   her phone (she runs PackPal as a Home Screen app).

## 7. Quick reference

| Thing | Value |
|-------|-------|
| Repo on the Mac | `~/Documents/Claude/Projects/PackPal` (VM: `$HOME/mnt/Projects/PackPal`) |
| Bundle folder | `~/Documents/Claude/Projects/PackPal-github-upload/` |
| Upload URL | `https://github.com/elizabethsdavis/wandertrust/upload/main/<folder>` (root: no `<folder>`) |
| Delete URL | `https://github.com/elizabethsdavis/wandertrust/blob/main/<path>` → trash icon |
| Vercel | project `prj_gBjXgMnzGIdgQs1ST6tJ03R08Uec`, team `team_WEizNhF8qWNse8CYAUdb9exr`, prod `https://wandertrust.vercel.app` |
| Message format | `<Verb-first summary> - <Batch name> N/M` |
| Build the plan | `python3 scripts/upload-plan.py "<Batch name>"` (`--check` to preview) |
| Verify | fetch → `diff --stat HEAD origin/main` empty → deployments READY → `/version.json` = newest SHA |
| Reconcile | `reset --hard origin/main` → HANDOFF status line → delete the bundle |
