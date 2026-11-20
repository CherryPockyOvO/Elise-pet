export const SIZE_LIMITS = {
  scale: { min: 0.6, max: 1.3 },
};

export type PetSizes = { scale: number };
export const DEFAULT_SIZES: PetSizes = { scale: 1 };
const STORAGE_KEY = 'shizuku-pet.settings';

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
      scale: clamp(settings.scale, SIZE_LIMITS.scale),
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
