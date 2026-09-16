import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single source of truth for the app (release) version — declared in package.json.
// The FRD "Spec Version" is a separate numbering stream (see FRD §1.5).
const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string }

// Short commit SHA when built in GitHub Actions; empty for local dev builds.
const buildSha = (process.env.GITHUB_SHA ?? '').slice(0, 7)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(buildSha),
  },
})
