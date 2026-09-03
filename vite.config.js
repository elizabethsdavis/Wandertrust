import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { versionStamp } from './scripts/version-stamp.js'

export default defineConfig({
  plugins: [react(), versionStamp()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
