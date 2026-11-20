/**
 * Finds the "home" frames of a standby loop: the frames that look like its first frame.
 * Turns are drawn to join the first frame, so an action that interrupts the loop first
 * plays back to the nearest home frame instead of jumping from mid-loop.
 */

/** Frames are compared at this size; enough to tell poses apart, cheap to read. */
const SAMPLE = 128;
const cache = new Map<string, Promise<readonly number[]>>();

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function measure(frames: readonly string[]) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SAMPLE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [0];
  const pixels: Uint8ClampedArray[] = [];
  for (const image of await Promise.all(frames.map(loadImage))) {
    context.clearRect(0, 0, SAMPLE, SAMPLE);
    context.drawImage(image, 0, 0, SAMPLE, SAMPLE);
    pixels.push(context.getImageData(0, 0, SAMPLE, SAMPLE).data);
  }
  const first = pixels[0];
  const drift = pixels.map(data => {
    let total = 0;
    for (let i = 0; i < data.length; i++) total += Math.abs(data[i] - first[i]);
    return total / 255 / data.length * 100;
  });
  // Close to the first frame relative to how far this loop moves at its widest.
  const limit = Math.max(0.8, Math.max(...drift) * 0.15);
  return drift.flatMap((value, index) => value <= limit ? [index] : []);
}

/** Indices of the frames that can hand over to a turn without a visible jump. */
export function homeFrames(frames: readonly string[]) {
  const key = `${frames[0]}:${frames.length}`;
  let result = cache.get(key);
  if (!result) {
    result = measure(frames).catch(() => [0]);
    cache.set(key, result);
  }
  return result;
}
