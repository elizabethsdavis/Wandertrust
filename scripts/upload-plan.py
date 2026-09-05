#!/usr/bin/env python3
"""Build the GitHub web-upload bundle + a step-by-step upload plan.

PackPal ships by uploading changed files through GitHub's web UI (see
GITHUB_UPLOAD.md for why and for the click-by-click). This script does the
mechanical part so nothing is forgotten:

  1. compares local HEAD with origin/main (after `git fetch origin`)
  2. copies every added / modified file, byte-for-byte from HEAD, into
     ../PackPal-github-upload/ with the same folder structure
  3. groups them by folder in an order that keeps every intermediate Vercel
     build green (scripts → root → static folders → src/data → src/lib →
     src/components → src), lists deleted files as separate steps, and writes
     ../PackPal-github-upload/UPLOAD_PLAN.md with the upload URL for each step
     and a commit-message line in Elizabeth's format:

        <Verb-first summary> - <Batch name> N/M

     The summaries are left as <summary> placeholders — the agent fills them in
     from the actual diff (`git diff origin/main HEAD -- <folder>`).

Usage (from the repo root; works on the Mac and in the Cowork device VM):

    python3 scripts/upload-plan.py "Renames & Icon"
    python3 scripts/upload-plan.py "Renames & Icon" --dest ../some-other-folder
    python3 scripts/upload-plan.py --check          # just print the plan, no files

Git is always run with --no-optional-locks so it never leaves .git/index.lock
behind on the mounted folder.
"""
import argparse, os, shutil, subprocess, sys
from collections import OrderedDict

REPO = "elizabethsdavis/wandertrust"
BRANCH = "main"
UPLOAD_BASE = f"https://github.com/{REPO}/upload/{BRANCH}"
BLOB_BASE = f"https://github.com/{REPO}/blob/{BRANCH}"


def git(*args, check=True):
    r = subprocess.run(["git", "--no-optional-locks", *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit(f"git {' '.join(args)} failed:\n{r.stderr.strip()}")
    return r.stdout


def folder_rank(folder):
    """Upload order. Lower first. Root after scripts (vite.config.js may import scripts/*),
    before src (package.json may add deps that src uses)."""
    if folder == "scripts":
        return (0, folder)
    if folder.startswith("scripts/"):
        return (1, folder)
    if folder == "":
        return (2, folder)
    if folder.startswith("src/data"):
        return (5, folder)
    if folder.startswith("src/lib"):
        return (6, folder)
    if folder.startswith("src/components"):
        return (7, folder)
    if folder == "src":
        return (9, folder)
    if folder.startswith("src/"):
        return (8, folder)
    return (3, folder)  # public/, functions/, any other static or independent folder


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("batch", nargs="?", default="<Batch name>", help='e.g. "Renames & Icon"')
    ap.add_argument("--dest", default=os.path.join("..", "PackPal-github-upload"))
    ap.add_argument("--check", action="store_true", help="print the plan only; do not write the bundle")
    ap.add_argument("--no-fetch", action="store_true")
    args = ap.parse_args()

    root = git("rev-parse", "--show-toplevel").strip()
    os.chdir(root)
    if not args.no_fetch:
        subprocess.run(["git", "--no-optional-locks", "fetch", "origin", "-q"], check=False)

    ahead = git("rev-list", "--count", f"origin/{BRANCH}..HEAD").strip()
    behind = git("rev-list", "--count", f"HEAD..origin/{BRANCH}").strip()
    dirty = git("status", "--porcelain", "--untracked-files=no").strip()
    if behind != "0":
        sys.exit(f"origin/{BRANCH} has {behind} commit(s) this checkout lacks — reconcile first (see GITHUB_UPLOAD.md).")
    if dirty:
        print("WARNING: uncommitted tracked changes — the bundle is built from HEAD, not the working tree:\n" + dirty + "\n", file=sys.stderr)

    changed = [l for l in git("diff", "--diff-filter=ACMR", "--name-only", f"origin/{BRANCH}", "HEAD").splitlines() if l.strip()]
    deleted = [l for l in git("diff", "--diff-filter=D", "--name-only", f"origin/{BRANCH}", "HEAD").splitlines() if l.strip()]
    if not changed and not deleted:
        print(f"Nothing to upload: HEAD == origin/{BRANCH}.")
        return

    groups = OrderedDict()
    for f in sorted(changed):
        folder = os.path.dirname(f)
        groups.setdefault(folder, []).append(os.path.basename(f))
    ordered = sorted(groups.items(), key=lambda kv: folder_rank(kv[0]))
    total = len(ordered) + len(deleted)

    lines = [f"# Upload plan — {args.batch}", "",
             f"Local `{git('rev-parse', '--short', 'HEAD').strip()}` is {ahead} commit(s) ahead of `origin/{BRANCH}` "
             f"(`{git('rev-parse', '--short', f'origin/{BRANCH}').strip()}`). {len(changed)} file(s) to upload, {len(deleted)} to delete, "
             f"{total} step(s). Do them **in this order** so every intermediate Vercel build stays green.",
             "", "Each step: open the URL, drag the listed files in from the bundle folder (the uploader drops them into the folder you are viewing), "
             "paste the commit message as the title, choose *Commit directly to the main branch*, click *Commit changes*. "
             "Fill in each `<summary>` from the diff before handing this to Elizabeth: a verb-first phrase, no trailing period.", ""]
    n = 0
    for folder, files in ordered:
        n += 1
        url = UPLOAD_BASE + (f"/{folder}" if folder else "")
        label = "**Root**" if folder == "" else f"**{folder}**"
        # Root files sit under ROOT/ in the bundle, so UPLOAD_PLAN.md is the only file at its top level
        # (once dragged into the repo by mistake alongside the root files).
        bundle_dir = os.path.join(os.path.basename(os.path.normpath(args.dest)), folder if folder else "ROOT")
        lines.append(f"{n}. {label} → `{url}` — from `{bundle_dir}/`: " + ", ".join(f"`{x}`" for x in files))
        lines.append("   ```")
        lines.append(f"   <summary> - {args.batch} {n}/{total}")
        lines.append("   ```")
    for f in deleted:
        n += 1
        lines.append(f"{n}. **Delete** `{f}` → open `{BLOB_BASE}/{f}`, tap the trash icon (top right of the file view), commit with")
        lines.append("   ```")
        lines.append(f"   Remove {os.path.basename(f)} - {args.batch} {n}/{total}")
        lines.append("   ```")
    lines += ["", "After Elizabeth says it is uploaded, run the verification in GITHUB_UPLOAD.md § 5.", ""]
    plan = "\n".join(lines)

    if args.check:
        print(plan)
        return

    dest = os.path.abspath(args.dest)
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    os.makedirs(dest)
    # Byte-for-byte copies of the committed files (git archive → tar), never the working tree.
    archive = subprocess.run(["git", "--no-optional-locks", "archive", "HEAD", "--", *changed], capture_output=True, check=True)
    subprocess.run(["tar", "-x", "-C", dest], input=archive.stdout, check=True)
    root_files = [f for f in changed if os.path.dirname(f) == ""]
    if root_files:
        os.makedirs(os.path.join(dest, "ROOT"), exist_ok=True)
        for f in root_files:
            shutil.move(os.path.join(dest, f), os.path.join(dest, "ROOT", f))
    with open(os.path.join(dest, "UPLOAD_PLAN.md"), "w", encoding="utf-8") as fh:
        fh.write(plan)
    print(plan)
    print(f"Bundle written to {dest} ({len(changed)} files + UPLOAD_PLAN.md).")


if __name__ == "__main__":
    main()
