import { readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frameOrder = new Intl.Collator('en', { numeric: true });
const eliseActions = ['walk', 'stand', 'front2left', 'left2back'] as const;

function readFrames(action: typeof eliseActions[number]) {
  const directory = new URL(`./public/assets/elise/poses/${action}/`, import.meta.url);
  const frames = readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.png$/i.test(entry.name))
    .map(entry => entry.name)
    .sort(frameOrder.compare);
  if (!frames.length) throw new Error(`No PNG frames found in ${directory.pathname}`);
  return frames.map(name => `/assets/elise/poses/${action}/${encodeURIComponent(name)}`);
}

export default defineConfig({
  plugins: [react()],
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
