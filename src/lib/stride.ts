/**
 * Measures how far the planted foot travels per frame in an in-place walk cycle,
 * so the window can move at that pace and the feet do not slide, and which frames
 * have the feet together, so walks can start and stop there.
 *
 * For each pair of consecutive frames we compare the few rows just above the
 * lowest opaque pixel (the shoes) and find the horizontal shift that lines them
 * up best. The planted shoe dominates that match. The result is a fraction of
 * the canvas width, so it holds at any display size.
 */

/** Used until a clip has been measured, or when measuring fails. */
export const DEFAULT_STRIDE = 0.0125;

const BAND_ROWS = 12;
const MAX_SHIFT = 40;
const cache = new Map<string, Promise<Gait>>();

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

/** Opaque mask of the rows just above the lowest opaque row. */
function groundBand(image: HTMLImageElement) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(image, 0, 0);
  const alpha = context.getImageData(0, 0, width, height).data;
  let bottom = -1;
  for (let y = height - 1; y >= 0 && bottom < 0; y--) {
    for (let x = 0; x < width; x++) {
      if (alpha[(y * width + x) * 4 + 3] > 128) { bottom = y; break; }
    }
  }
  const band = new Uint8Array(width * BAND_ROWS);
  for (let row = 0; row < BAND_ROWS; row++) {
    const y = bottom - BAND_ROWS + 1 + row;
    if (y < 0) continue;
    for (let x = 0; x < width; x++) band[row * width + x] = alpha[(y * width + x) * 4 + 3] > 128 ? 1 : 0;
  }
  return { width, band };
}

/** Best backwards shift (in pixels, ≥ 1) of the ground from one frame to the next. */
function groundShift(a: Uint8Array, b: Uint8Array, width: number, direction: 1 | -1) {
  let best = 0;
  let bestShift = 0;
  for (let shift = 1; shift <= MAX_SHIFT; shift++) {
    // A figure facing right pushes the ground to the left, and vice versa.
    const dx = -direction * shift;
    let overlap = 0;
    for (let row = 0; row < BAND_ROWS; row++) {
      const offset = row * width;
      for (let x = Math.max(0, dx); x < Math.min(width, width + dx); x++) {
        if (b[offset + x] && a[offset + x - dx]) overlap++;
      }
    }
    if (overlap > best) { best = overlap; bestShift = shift; }
  }
  return bestShift;
}

/** Width of the shoes' footprint on the ground: smallest when the feet are together. */
function footSpread(band: Uint8Array, width: number) {
  let left = width;
  let right = -1;
  for (let row = 0; row < BAND_ROWS; row++) {
    for (let x = 0; x < width; x++) {
      if (band[row * width + x]) { left = Math.min(left, x); right = Math.max(right, x); }
    }
  }
  return right < left ? Infinity : right - left;
}

export type Gait = {
  /** Ground travel per frame, as a fraction of the canvas width. */
  stride: number;
  /** Frames where the feet are together, the natural places to start or stop. */
  rest: readonly number[];
};

export const DEFAULT_GAIT: Gait = { stride: DEFAULT_STRIDE, rest: [0] };

async function measure(frames: readonly string[], direction: 1 | -1): Promise<Gait> {
  const images = await Promise.all(frames.map(loadImage));
  const bands = images.map(groundBand);
  const width = bands[0].width;
  if (bands.some(band => band.width !== width)) return DEFAULT_GAIT;
  const shifts = bands.map((band, index) =>
    groundShift(band.band, bands[(index + 1) % bands.length].band, width, direction)).sort((a, b) => a - b);
  // Drop the extremes: frames where a foot lifts or lands can match the wrong shoe.
  const trim = Math.floor(shifts.length * 0.1);
  const kept = shifts.slice(trim, shifts.length - trim);
  const mean = kept.reduce((total, shift) => total + shift, 0) / kept.length;
  const spreads = bands.map(band => footSpread(band.band, width));
  const narrowest = Math.min(...spreads);
  const rest = spreads.flatMap((spread, index) => spread <= narrowest * 1.15 ? [index] : []);
  return { stride: mean > 0 ? mean / width : DEFAULT_STRIDE, rest: rest.length ? rest : [0] };
}

/**
 * Stride and rest frames of a walk cycle. `direction` is the screen direction the
 * artwork faces (+1 = right). Results are cached per clip.
 */
export function walkGait(frames: readonly string[], direction: 1 | -1) {
  const key = gaitKey(frames, direction);
  let result = cache.get(key);
  if (!result) {
    result = (frames.length >= 2 ? measure(frames, direction).catch(() => DEFAULT_GAIT) : Promise.resolve(DEFAULT_GAIT))
      .then(gait => { measured.set(key, gait); return gait; });
    cache.set(key, result);
  }
  return result;
}

/** The gait if this clip has already been measured. */
export function measuredGait(frames: readonly string[], direction: 1 | -1) {
  return measured.get(gaitKey(frames, direction));
}

const measured = new Map<string, Gait>();
const gaitKey = (frames: readonly string[], direction: number) => `${direction}:${frames[0]}:${frames.length}`;
