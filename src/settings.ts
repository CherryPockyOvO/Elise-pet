import { useCallback, useState } from 'react';

export type Autonomy = 'off' | 'low' | 'normal' | 'high';

export type Settings = {
  /** Elise's size, 1 = original. */
  eliseSize: number;
  /** Cat size relative to Elise, 1 = original. */
  catSize: number;
  /** How often they do things on their own. */
  autonomy: Autonomy;
  /** Whether random behaviour may include going for a walk across the screen. */
  wander: boolean;
};

export const SIZE_LIMITS = {
  elise: { min: 0.6, max: 1.3 },
  cat: { min: 0.6, max: 1.5 },
};

/** Seconds between random behaviours, [min, max]. */
export const AUTONOMY_DELAY: Record<Exclude<Autonomy, 'off'>, [number, number]> = {
  low: [22, 45],
  normal: [9, 18],
  high: [4, 9],
};

const DEFAULTS: Settings = { eliseSize: 1, catSize: 1, autonomy: 'normal', wander: true };
const KEY = 'elise-pet.settings';

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      eliseSize: clamp(raw.eliseSize, SIZE_LIMITS.elise.min, SIZE_LIMITS.elise.max, DEFAULTS.eliseSize),
      catSize: clamp(raw.catSize, SIZE_LIMITS.cat.min, SIZE_LIMITS.cat.max, DEFAULTS.catSize),
      autonomy: ['off', 'low', 'normal', 'high'].includes(raw.autonomy as string) ? raw.autonomy as Autonomy : DEFAULTS.autonomy,
      wander: typeof raw.wander === 'boolean' ? raw.wander : DEFAULTS.wander,
    };
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(previous => {
      const next = { ...previous, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable: settings still apply for this session.
      }
      return next;
    });
  }, []);
  const reset = useCallback(() => update(DEFAULTS), [update]);
  return { settings, update, reset };
}
