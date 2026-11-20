import { readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frameOrder = new Intl.Collator('en', { numeric: true });
// Required poses must have at least two frames. Optional ones may stay empty while their art is in progress.
const requiredPoses = [
  'walk', 'front2left', 'front2right', 'left2back', 'right2back',
  'standby_front', 'standby_left', 'standby_right', 'standby_back',
] as const;
const optionalPoses = ['stand'] as const;

function readFrames(action: string, required: boolean) {
  const directory = new URL(`./public/assets/shizuku/poses/${action}/`, import.meta.url);
  let names: string[] = [];
  try {
    names = readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isFile() && /\.png$/i.test(entry.name))
      .map(entry => entry.name)
      .sort(frameOrder.compare);
  } catch {
    // A missing optional folder is treated like an empty one.
  }
  if (names.length < 2) {
    if (required) throw new Error(`Expected at least two PNG frames in ${directory.pathname}`);
    console.warn(`[poses] ${action}: fewer than two PNG frames, skipping it.`);
    return [];
  }
  return names.map(name => `/assets/shizuku/poses/${action}/${encodeURIComponent(name)}`);
}

const poseFrames = Object.fromEntries([
  ...requiredPoses.map(action => [action, readFrames(action, true)]),
  ...optionalPoses.map(action => [action, readFrames(action, false)]),
]);

export default defineConfig({
  plugins: [react()],
  define: {
    __POSE_FRAMES__: JSON.stringify(poseFrames),
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
