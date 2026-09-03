// Vite plugin: stamp every build with a version and publish it as /version.json,
// so the running app can tell when a newer deploy exists (see src/lib/version.js).
//
//   version  = the Vercel commit SHA (short) when building on Vercel, otherwise
//              "local-<timestamp>" so dev / test builds never look "outdated"
//              to themselves.
//   The same value reaches the bundle as import.meta.env.VITE_APP_VERSION.
export function versionStamp() {
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
  const builtAt = new Date().toISOString();
  const version = sha || `local-${builtAt.replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  return {
    name: "packpal-version-stamp",
    config: () => ({
      define: {
        "import.meta.env.VITE_APP_VERSION": JSON.stringify(version),
        "import.meta.env.VITE_APP_BUILT_AT": JSON.stringify(builtAt),
      },
    }),
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version, builtAt }) });
    },
  };
}
