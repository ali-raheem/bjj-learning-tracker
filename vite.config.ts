import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://shoryuken.me/bjj/ (see scripts/deploy.sh). Override with VITE_BASE=/ for
// root hosting.
const base = process.env.VITE_BASE ?? '/bjj/';

// Baked in at build time so the Backup screen can show exactly what is deployed. Falls back
// gracefully if built outside a git checkout (e.g. from a downloaded archive). A " (modified)"
// suffix means the working tree had uncommitted changes at build time, i.e. the hash below does
// not fully describe what was actually deployed — commit before building to avoid that.
function git(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}
const commitHash = git('git rev-parse --short HEAD') || 'unknown';
const commitDate = git('git log -1 --format=%cI');
const dirty = git('git status --porcelain') !== '';

export default defineConfig({
  base,
  define: {
    __APP_COMMIT__: JSON.stringify(dirty ? `${commitHash} (modified)` : commitHash),
    __APP_COMMIT_DATE__: JSON.stringify(commitDate),
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'BJJ Learning Tracker',
        short_name: 'BJJ Tracker',
        description: 'Track BJJ techniques: read, drilled, sparred.',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        start_url: base,
        scope: base,
        // Fixes the installed app's identity independent of start_url, so changing start_url
        // later (e.g. moving off /bjj/) updates existing installs instead of duplicating them.
        id: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
