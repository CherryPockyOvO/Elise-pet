export const SIZE_LIMITS = {
  eliseSize: { min: 0.6, max: 1.3 },
  catSize: { min: 0.6, max: 1.5 },
};

export type PetSizes = { eliseSize: number; catSize: number };
export const DEFAULT_SIZES: PetSizes = { eliseSize: 1, catSize: 1 };
const STORAGE_KEY = 'elise-pet.settings';

function readSettings(): Partial<PetSizes> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {};
}

function clamp(value: unknown, { min, max }: { min: number; max: number }) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 1;
}

export function loadPetSizes(): PetSizes {
  try {
    const settings = readSettings();
    return {
      eliseSize: clamp(settings.eliseSize, SIZE_LIMITS.eliseSize),
      catSize: clamp(settings.catSize, SIZE_LIMITS.catSize),
    };
  } catch {
    return DEFAULT_SIZES;
  }
}

export function storePetSizes(sizes: PetSizes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSettings(), ...sizes }));
  } catch {
    // The new sizes still apply in the current window if storage is unavailable.
  }
}
