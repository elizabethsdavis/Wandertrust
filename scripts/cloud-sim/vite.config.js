// Builds PackPal in CLOUD mode against the in-memory Firebase stand-in, for
// scripts/cloud-checks.py. Never used for real deploys.
//
//   VITE_FIREBASE_API_KEY=fake VITE_FIREBASE_PROJECT_ID=fake \
//     npx vite build -c scripts/cloud-sim/vite.config.js
//   npx vite preview -c scripts/cloud-sim/vite.config.js --port 4174 --strictPort
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { versionStamp } from "../version-stamp.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

export default defineConfig({
  root,
  plugins: [react(), versionStamp()],
  resolve: {
    alias: [{ find: /^firebase\/(app|auth|firestore|functions)$/, replacement: path.join(here, "fake-firebase.js") }],
  },
  build: { outDir: path.join(root, "dist-cloudsim"), emptyOutDir: true, sourcemap: false },
});
