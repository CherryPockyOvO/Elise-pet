export const MODELS = {
  'deepseek-flash': 'DeepSeek V4.1 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
};
export const EFFORTS = { low: '低', high: '高', max: '最高' };

const PREFERENCES_KEY = 'shizuku-pet.deepseek.preferences';

export type Preferences = {
  model: keyof typeof MODELS;
  thinking: boolean;
  effort: keyof typeof EFFORTS;
};

export function loadPreferences(): Preferences {
  const defaults: Preferences = { model: 'deepseek-flash', thinking: true, effort: 'high' };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}');
    return {
      model: typeof saved.model === 'string' && Object.prototype.hasOwnProperty.call(MODELS, saved.model)
        ? saved.model : defaults.model,
      thinking: typeof saved.thinking === 'boolean' ? saved.thinking : defaults.thinking,
      effort: typeof saved.effort === 'string' && Object.prototype.hasOwnProperty.call(EFFORTS, saved.effort)
        ? saved.effort : defaults.effort,
    };
  } catch {
    return defaults;
  }
}

export function storePreferences(preferences: Preferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}
