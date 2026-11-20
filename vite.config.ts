import { cpSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frameOrder = new Intl.Collator('en', { numeric: true });
const eliseActions = ['walk', 'stand', 'standby', 'front2left', 'left2back'] as const;
const publicDirectory = fileURLToPath(new URL('./public', import.meta.url));
const posesDirectory = join(publicDirectory, 'assets', 'elise', 'poses');
const builtInDirectories = new Set<string>(eliseActions);

function readFrames(action: typeof eliseActions[number]) {
  const directory = new URL(`./public/assets/elise/poses/${action}/`, import.meta.url);
  const frames = readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.png$/i.test(entry.name))
    .map(entry => entry.name)
    .sort(frameOrder.compare);
  if (frames.length < 2) throw new Error(`Expected at least two PNG frames in ${directory.pathname}`);
  return frames.map(name => `/assets/elise/poses/${action}/${encodeURIComponent(name)}`);
}

export default defineConfig({
  plugins: [react(), {
    name: 'bundle-pet-assets',
    apply: 'build',
    writeBundle({ dir }) {
      if (!dir) return;
      // Custom poses are imported from disk. Only ship the built-in poses with the app.
      cpSync(publicDirectory, dir, {
        recursive: true,
        filter: source => dirname(source) !== posesDirectory || builtInDirectories.has(basename(source)),
      });
    },
  }],
  build: { copyPublicDir: false },
  define: {
    __ELISE_FRAMES__: JSON.stringify(Object.fromEntries(eliseActions.map(action => [action, readFrames(action)]))),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
    watch: {
      ignored: ['**/src-tauri/target/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
});
