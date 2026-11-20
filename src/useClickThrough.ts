import { useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { cursorPosition, getCurrentWindow } from '@tauri-apps/api/window';

/**
 * The pet window is a transparent rectangle. Without this hook it swallows
 * every click over its empty area, so the desktop underneath is unusable.
 *
 * We poll the global cursor and hit-test the page ourselves: when the cursor
 * is over a visible pixel of Elise or over a panel, the window takes
 * mouse input; otherwise it lets clicks fall through to whatever is below.
 */
const POLL_MS = 60;
/** Elements that are always clickable when the cursor is over their box. */
const SOLID = '.pet-menu, .chat, .bubble, .deepseek-panel';

type AlphaMask = { width: number; height: number; alpha: Uint8Array };
const alphaCache = new Map<string, AlphaMask>();

function alphaData(image: HTMLImageElement) {
  const source = image.currentSrc;
  const cached = alphaCache.get(source);
  if (cached) return cached;
  if (!source || !image.complete || !image.naturalWidth) return;
  const canvas = document.createElement('canvas');
  const width = canvas.width = image.naturalWidth;
  const height = canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  const alpha = new Uint8Array(width * height);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) alpha[pixel] = pixels[pixel * 4 + 3];
  const mask = { width, height, alpha };
  alphaCache.set(source, mask);
  return mask;
}

/** Alpha around (u, v) in image pixels, with a few pixels of slack for thin edges. */
function opaqueNear(data: AlphaMask, u: number, v: number, radius: number) {
  for (let dy = -radius; dy <= radius; dy += radius || 1) {
    for (let dx = -radius; dx <= radius; dx += radius || 1) {
      const x = Math.round(u + dx);
      const y = Math.round(v + dy);
      if (x < 0 || y < 0 || x >= data.width || y >= data.height) continue;
      if (data.alpha[y * data.width + x] > 24) return true;
    }
  }
  return false;
}

function hitImage(image: HTMLImageElement, x: number, y: number) {
  const data = alphaData(image);
  if (!data) return true; // not decoded yet: be generous
  const box = image.getBoundingClientRect();
  const scale = Math.min(box.width / data.width, box.height / data.height);
  const left = box.left + (box.width - data.width * scale) / 2;
  const top = box.top + (box.height - data.height * scale) / 2;
  let u = (x - left) / scale;
  if (getComputedStyle(image).transform.startsWith('matrix(-1')) u = data.width - u;
  return opaqueNear(data, u, (y - top) / scale, 6);
}

function isInteractiveAt(x: number, y: number) {
  const element = document.elementFromPoint(x, y);
  if (!element) return false;
  if (element.closest(SOLID)) return true;
  const pet = element.closest('.character');
  if (!pet) return false;
  const image = pet.querySelector('img');
  return image ? hitImage(image, x, y) : true;
}

export function useClickThrough() {
  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    let ignoring: boolean | null = null;
    let buttonsDown = false;
    let busy = false;
    let disposed = false;

    const onDown = () => { buttonsDown = true; };
    const onUp = () => { buttonsDown = false; };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    window.addEventListener('blur', onUp);

    const poll = async () => {
      if (busy || disposed) return;
      busy = true;
      try {
        const [cursor, inner, scale] = await Promise.all([
          cursorPosition(), win.innerPosition(), win.scaleFactor(),
        ]);
        const x = (cursor.x - inner.x) / scale;
        const y = (cursor.y - inner.y) / scale;
        const inside = x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight;
        // Never switch to pass-through mid-press (e.g. while typing selection or dragging).
        const ignore = !buttonsDown && !(inside && isInteractiveAt(x, y));
        if (ignore !== ignoring && !disposed) {
          ignoring = ignore;
          await win.setIgnoreCursorEvents(ignore);
        }
      } catch {
        // Window is closing or the API is unavailable; try again next tick.
      } finally {
        busy = false;
      }
    };

    const timer = window.setInterval(() => { void poll(); }, POLL_MS);
    void poll();
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      window.removeEventListener('blur', onUp);
      void win.setIgnoreCursorEvents(false).catch(() => undefined);
    };
  }, []);
}
