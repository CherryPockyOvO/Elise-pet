const RED_LUMA = 0.2126;
const GREEN_LUMA = 0.7152;
const BLUE_LUMA = 0.0722;
const luma = (r, g, b) => RED_LUMA * r + GREEN_LUMA * g + BLUE_LUMA * b;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const neighbors = [];
for (let dy = -9; dy <= 9; dy++) {
  for (let dx = -9; dx <= 9; dx++) {
    const distance = dx * dx + dy * dy;
    if (distance > 0 && distance <= 81) neighbors.push([dx, dy, distance]);
  }
}
neighbors.sort((a, b) => a[2] - b[2]);

function sampleGreen(data, width, height) {
  const levels = [];
  const outer = Math.round((width * 8) / 1024);
  const inner = Math.round((width * 20) / 1024);
  for (let y = 0; y < height; y += 29) {
    for (const x of [outer, inner, width - inner - 1, width - outer - 1]) {
      const i = (y * width + x) * 4;
      if (data[i + 3] >= 248) levels.push(data[i + 1] - Math.max(data[i], data[i + 2]));
    }
  }
  levels.sort((a, b) => a - b);
  return levels[levels.length >> 1];
}

/** Key a tightly packed, straight-alpha RGBA frame in place. Compatible with Canvas ImageData. */
export function keyGreenScreen({ data, width, height }, { greenLevel, edgeStart = 0.03, clear = 0.89 } = {}) {
  if (!(data instanceof Uint8ClampedArray) || !Number.isInteger(width) || !Number.isInteger(height)
    || width <= 0 || height <= 0 || data.length !== width * height * 4) {
    throw new TypeError('Expected width × height × 4 RGBA bytes in a Uint8ClampedArray.');
  }
  if (!Number.isFinite(edgeStart) || !Number.isFinite(clear) || edgeStart < 0 || clear <= edgeStart || clear > 1) {
    throw new RangeError('Expected 0 <= edgeStart < clear <= 1.');
  }

  const screen = greenLevel ?? sampleGreen(data, width, height);
  if (!Number.isFinite(screen) || screen < 100 || screen > 255) {
    throw new RangeError('Expected a green screen at the frame sides or greenLevel between 100 and 255.');
  }

  const pixelCount = width * height;
  const source = data.slice();
  const alpha = new Uint8Array(pixelCount);
  const clean = new Uint8Array(pixelCount);
  const matteStart = screen * edgeStart;
  const matteClear = screen * clear;
  let removed = 0;
  let interior = 0;
  let corrected = 0;

  // Build a soft matte before touching color. Scan the whole frame, including gaps between hair strands.
  for (let p = 0; p < pixelCount; p++) {
    const i = p * 4;
    const r = source[i], g = source[i + 1], b = source[i + 2];
    const excess = g - Math.max(r, b);
    const keyed = clamp(Math.round((255 * (matteClear - excess)) / (matteClear - matteStart)), 0, 255);
    const coverage = Math.round(keyed * source[i + 3] / 255);
    alpha[p] = keyed < 4 ? 0 : coverage;
    clean[p] = Number(alpha[p] >= 248 && g <= (r + b) / 2 + 1);
    if (alpha[p] === 0) removed++;
    if (alpha[p] === 255) interior++;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const a = alpha[p];
      data[i + 3] = a;
      if (!a) {
        data[i] = data[i + 1] = data[i + 2] = 0;
        continue;
      }

      const r = source[i], g = source[i + 1], b = source[i + 2];
      const relativeGreen = g - (r + b) / 2;
      if (relativeGreen < -3 && (a >= 248 || a === source[i + 3])) continue;
      if (a >= 248) {
        let edge = false;
        for (const [dx, dy, distance] of neighbors) {
          if (distance > 5) break;
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < width && yy >= 0 && yy < height && alpha[yy * width + xx] < 235) {
            edge = true;
            break;
          }
        }
        if (!edge) continue;
      }

      let closest = null;
      let weight = 0;
      let cr = 0, cg = 0, cb = 0;
      for (const [dx, dy, distance] of neighbors) {
        if (closest !== null && distance > closest + 8) break;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height || !clean[yy * width + xx]) continue;
        closest ??= distance;
        const j = (yy * width + xx) * 4;
        const w = 1 / distance;
        cr += source[j] * w;
        cg += source[j + 1] * w;
        cb += source[j + 2] * w;
        weight += w;
      }

      if (weight) {
        cr /= weight;
        cg /= weight;
        cb /= weight;
        const spill = relativeGreen - (cg - (cr + cb) / 2);
        const strength = Math.max(Math.min(1, (255 - a) / 95), clamp((spill - 4) / 28, 0, 0.90));
        if (strength <= 0) continue;
        // Match nearby clean foreground brightness to avoid darkening fine edges during despill.
        const targetY = luma(cr, cg, cb);
        const measuredY = luma(r, Math.min(g, (r + b) / 2), b);
        const adjustment = clamp(measuredY - targetY, -8, 8) * (a / 255);
        data[i] = r + (cr + adjustment - r) * strength;
        data[i + 1] = g + (cg + adjustment - g) * strength;
        data[i + 2] = b + (cb + adjustment - b) * strength;
      } else if (relativeGreen > 0) {
        // No solid neighbor nearby. Estimate foreground from the channels with little screen color.
        const opacity = Math.max(a / 255, 0.30);
        data[i] = r / opacity;
        data[i + 2] = b / opacity;
        data[i + 1] = (data[i] + data[i + 2]) / 2;
      }

      const remaining = Math.max(0, data[i + 1] - (data[i] + data[i + 2]) / 2 - 1);
      // Reduce green dominance while approximating constant luma. The matte stays fixed.
      data[i] += remaining * GREEN_LUMA;
      data[i + 1] -= remaining * 0.2848;
      data[i + 2] += remaining * GREEN_LUMA;
      corrected++;
    }
  }

  return { screen, removed, interior, corrected };
}
