import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import {
  availableMonitors, currentMonitor, getCurrentWindow, PhysicalPosition, PhysicalSize, primaryMonitor,
  type Monitor,
} from '@tauri-apps/api/window';

export const STAGE_WIDTH = 420;
const STAGE_HEIGHT = 640;
const DISPLAY_KEY = 'shizuku-pet.display';

export function displayId(monitor: Monitor) {
  return `${monitor.name ?? ''}@${monitor.position.x},${monitor.position.y}`;
}

function dimensions(monitor: Monitor) {
  const dpi = monitor.scaleFactor;
  return {
    width: Math.min(STAGE_WIDTH, Math.floor(monitor.workArea.size.width / dpi)),
    height: Math.min(STAGE_HEIGHT, Math.floor(monitor.workArea.size.height / dpi)),
  };
}

// Match the sprite's 290px canvas and its scale origin in .pet-group.
function artworkTop(height: number, scale: number) {
  return height - 34 - 273 * scale;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(min, max), Math.max(min, value));

export function placePet(monitor: Monitor, scale: number, left: number, petTop: number) {
  const { width, height } = dimensions(monitor);
  const area = monitor.workArea;
  const dpi = monitor.scaleFactor;
  const top = artworkTop(height, scale);
  const fittedTop = clamp(petTop, area.position.y, area.position.y + area.size.height - 290 * scale * dpi);
  const position = new PhysicalPosition(
    Math.round(clamp(left, area.position.x, area.position.x + area.size.width - width * dpi)),
    Math.round(clamp(fittedTop - top * dpi, area.position.y, area.position.y + area.size.height - height * dpi)),
  );
  return { position, offset: (fittedTop - position.y) / dpi - top };
}

function geometry(monitor: Monitor) {
  const { position, size } = monitor.workArea;
  return [displayId(monitor), monitor.scaleFactor, monitor.size.width, monitor.size.height,
    position.x, position.y, size.width, size.height].join(':');
}

function loadDisplayId() {
  try { return localStorage.getItem(DISPLAY_KEY); } catch { return null; }
}

export function usePetDisplay(monitor: RefObject<Monitor | null>, scale: RefObject<number>, onRelocate: () => void) {
  const [displays, setDisplays] = useState<Monitor[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  const busy = useRef(false);
  const queuedSelection = useRef<string | undefined>(undefined);

  const movePet = useCallback(async (display: Monitor, left: number, top: number) => {
    const target = placePet(display, scale.current, left, top);
    await getCurrentWindow().setPosition(target.position);
    offsetRef.current = target.offset;
    setOffset(target.offset);
  }, [scale]);

  const petTop = useCallback((display: Monitor, windowY: number) =>
    windowY + (artworkTop(dimensions(display).height, scale.current) + offsetRef.current) * display.scaleFactor, [scale]);

  const refresh = useCallback(async function refreshDisplays(selectId?: string) {
    if (!isTauri()) return;
    if (busy.current) {
      if (selectId) queuedSelection.current = selectId;
      return;
    }
    busy.current = true;
    try {
      const [connected, primary, current] = await Promise.all([
        availableMonitors().catch(() => []), primaryMonitor().catch(() => null), currentMonitor().catch(() => null),
      ]);
      const options = connected.length ? connected : current ? [current] : primary ? [primary] : [];
      if (!options.length) throw new Error('No connected displays');
      setDisplays(existing => existing.length === options.length
        && existing.every((item, index) => geometry(item) === geometry(options[index])) ? existing : options);
      const previous = monitor.current;
      const requested = selectId ?? (previous ? displayId(previous) : loadDisplayId());
      const requestedName = requested?.slice(0, requested.lastIndexOf('@'));
      const namedMatches = requestedName ? options.filter(option => option.name === requestedName) : [];
      const fallback = (requested ? primary : current) ?? primary ?? current;
      const next = options.find(display => displayId(display) === requested)
        ?? (namedMatches.length === 1 ? namedMatches[0] : undefined)
        ?? options.find(display => fallback && displayId(display) === displayId(fallback)) ?? options[0];
      if (previous && geometry(previous) === geometry(next)) { setError(''); return; }

      onRelocate();
      const win = getCurrentWindow();
      const { width, height } = dimensions(next);
      const dpi = next.scaleFactor;
      const area = next.workArea;
      const origin = await win.outerPosition();
      const oldDisplay = previous ?? current;
      const sameDisplay = oldDisplay && displayId(oldDisplay) === displayId(next);
      const left = sameDisplay ? origin.x : area.position.x + (area.size.width - width * dpi) / 2;
      const top = sameDisplay ? petTop(oldDisplay, origin.y)
        : area.position.y + area.size.height - (34 + 273 * scale.current) * dpi;
      const placement = placePet(next, scale.current, left, top);
      if (placement.position.x !== origin.x || placement.position.y !== origin.y || placement.offset !== offsetRef.current) {
        await movePet(next, left, top);
      }
      const expected = new PhysicalSize(Math.round(width * dpi), Math.round(height * dpi));
      const actual = await win.innerSize().catch(() => null);
      if (actual && (actual.width !== expected.width || actual.height !== expected.height)) {
        await win.setSize(expected);
        await movePet(next, left, top);
      }
      monitor.current = next;
      setSelected(displayId(next));
      setError('');
      try { localStorage.setItem(DISPLAY_KEY, displayId(next)); } catch { /* Selection still applies. */ }
    } catch {
      setError('無法讀取或切換螢幕。');
    } finally {
      busy.current = false;
      const nextSelection = queuedSelection.current;
      queuedSelection.current = undefined;
      if (nextSelection) void refreshDisplays(nextSelection);
    }
  }, [monitor, movePet, onRelocate, petTop, scale]);

  useEffect(() => {
    if (!isTauri()) return;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { displays, selected, error, offset, refresh, movePet, petTop };
}
