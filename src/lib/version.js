// Build version + "is there a newer deploy?" check + reload helper.
//
// Every build is stamped by scripts/version-stamp.js: the version lands in the
// bundle (import.meta.env.VITE_APP_VERSION) and in /version.json next to it.
// When the app comes back to the foreground it fetches version.json; a
// different value means a newer build has been deployed since this page
// loaded. That matters most on the iPhone Home Screen "app", which has no
// address bar to refresh from.
import { useCallback, useEffect, useRef, useState } from "react";

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "dev";
export const APP_BUILT_AT = import.meta.env.VITE_APP_BUILT_AT || "";

/** "abc1234 · Sep 3, 2026" for the Account sheet; never throws. */
export function versionLabel() {
  let when = "";
  try {
    if (APP_BUILT_AT) when = new Date(APP_BUILT_AT).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { /* leave blank */ }
  return when ? `${APP_VERSION} · ${when}` : APP_VERSION;
}

/** The version currently deployed, or null when it can't be read (offline, dev server, …). */
export async function fetchDeployedVersion() {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.version === "string" ? j.version : null;
  } catch {
    return null;
  }
}

/**
 * Flush unsaved changes (when a flush function is given), then reload the page.
 * Works in Safari's standalone (Home Screen) mode, where there is no address bar.
 */
export async function reloadApp(flush) {
  try { if (flush) await flush(); } catch { /* reload anyway — the local mirror has the edits */ }
  window.location.reload();
}

const MIN_GAP_MS = 60_000; // don't hit version.json more than once a minute

/**
 * useUpdateAvailable() → { updateAvailable, dismiss }
 * Checks shortly after load, then every time the tab/app becomes visible again
 * (throttled). Dismissing hides the banner until yet another version appears.
 */
export function useUpdateAvailable() {
  const [deployed, setDeployed] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const lastCheck = useRef(0);

  const check = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastCheck.current < MIN_GAP_MS) return;
    lastCheck.current = now;
    const v = await fetchDeployedVersion();
    if (v) setDeployed(v);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => check(true), 4000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, [check]);

  const updateAvailable = !!deployed && deployed !== APP_VERSION && deployed !== dismissed;
  return { updateAvailable, deployedVersion: deployed, dismiss: () => setDismissed(deployed), check };
}
