import type { ImportedAction } from './actionLibrary';
import type { Heading } from './eliseTurns';

export const HEADINGS: Record<Heading, string> = { front: '正面', left: '左側', back: '背面', right: '右側' };
export const FULL_CHANCE = 10_000; // Hundredths of one percent.

type BuiltInId = 'stand' | 'walk' | 'front2left' | 'left2back' | 'sit' | 'sleep' | 'petCat'
  | 'surprised' | 'stretch' | 'wave' | 'roll' | 'loaf';

type BuiltInAction = {
  id: BuiltInId;
  name: string;
  priority: number;
  defaultFps?: number;
  headings?: readonly Heading[];
};

const BUILT_IN_ACTIONS: readonly BuiltInAction[] = [
  { id: 'stand', name: '站立小動作', priority: 1, defaultFps: 10, headings: ['front'] },
  { id: 'walk', name: '散步', priority: 2, defaultFps: 20, headings: ['front', 'left', 'right'] },
  { id: 'front2left', name: '正面 ↔ 側面', priority: 2, defaultFps: 30, headings: ['front', 'left', 'right'] },
  { id: 'left2back', name: '側面 ↔ 背面', priority: 2, defaultFps: 30, headings: ['left', 'back', 'right'] },
  { id: 'sit', name: '小坐', priority: 3, headings: ['front'] },
  { id: 'sleep', name: '打盹', priority: 3, headings: ['front'] },
  { id: 'petCat', name: '摸小貓', priority: 3, headings: ['front'] },
  { id: 'surprised', name: '嚇一跳', priority: 3, headings: ['front'] },
  { id: 'stretch', name: '小貓伸懶腰', priority: 3 },
  { id: 'wave', name: '小貓揮手', priority: 3 },
  { id: 'roll', name: '小貓打滾', priority: 3 },
  { id: 'loaf', name: '小貓趴下', priority: 3 },
];

export type ActionRow = (BuiltInAction & { source: 'built-in' }) | {
  source: 'imported';
  id: string;
  name: string;
  priority: number;
  defaultFps: number;
  action: ImportedAction;
};

export type ActionSettings = {
  fps: Record<string, number>;
  chances: Record<Heading, Record<string, number>>;
  endings: Record<Heading, Record<string, Heading>>;
};

const DEFAULTS: ActionSettings = {
  fps: {},
  endings: { front: {}, left: {}, back: {}, right: {} },
  chances: {
    front: { stand: 3000, walk: 2200, front2left: 1300, sit: 500, sleep: 200, petCat: 700, stretch: 400, wave: 400, roll: 400 },
    left: { walk: 3000, front2left: 2500, left2back: 2200, stretch: 400, wave: 400, roll: 400 },
    back: { left2back: 6800, stretch: 500, wave: 400, roll: 400 },
    right: { walk: 3000, front2left: 2500, left2back: 2200, stretch: 400, wave: 400, roll: 400 },
  },
};
const SETTINGS_KEY = 'elise-pet.actions.settings';

export function actionsForHeading(heading: Heading, imports: readonly ImportedAction[]): ActionRow[] {
  const builtIn = BUILT_IN_ACTIONS.filter(action => !action.headings || action.headings.includes(heading));
  return [
    ...builtIn.map(action => ({
      ...action,
      name: action.id === 'walk' && heading === 'front' ? '散步（先轉側面）' : action.name,
      source: 'built-in' as const,
    })),
    ...imports.filter(action => action.heading === heading).map(action => ({
      source: 'imported' as const, id: action.id, name: action.name, priority: action.kind === 'walk' ? 2 : 3,
      defaultFps: action.fps, action,
    })),
  ].sort((a, b) => a.priority - b.priority);
}

function boundedEntries(value: unknown, min: number, max: number) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter(([, entry]) =>
    typeof entry === 'number' && Number.isInteger(entry) && entry >= min && entry <= max));
}

function sum(group: Readonly<Record<string, number>>) {
  return Object.values(group).reduce((total, chance) => total + chance, 0);
}

function isHeading(value: unknown): value is Heading {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HEADINGS, value);
}

export function loadActionSettings(): ActionSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    const chances = { ...DEFAULTS.chances };
    const endings = { ...DEFAULTS.endings };
    for (const heading of Object.keys(HEADINGS) as Heading[]) {
      const savedChances = stored.chances?.[heading];
      if (savedChances && typeof savedChances === 'object') {
        const group = boundedEntries(savedChances, 0, FULL_CHANCE);
        if (sum(group) <= FULL_CHANCE) chances[heading] = group;
      }
      const groupEndings = stored.endings?.[heading];
      if (groupEndings && typeof groupEndings === 'object') {
        endings[heading] = Object.fromEntries(Object.entries(groupEndings)
          .filter((entry): entry is [string, Heading] => isHeading(entry[1])));
      }
    }
    return { fps: boundedEntries(stored.fps, 1, 30), chances, endings };
  } catch {
    return DEFAULTS;
  }
}

export function saveActionSettings(settings: ActionSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function withActionFps(settings: ActionSettings, id: string, fps: number): ActionSettings {
  if (!Number.isInteger(fps) || fps < 1 || fps > 30) throw new Error('幀率需為 1 到 30 的整數。');
  return { ...settings, fps: { ...settings.fps, [id]: fps } };
}

export function withActionChance(settings: ActionSettings, heading: Heading, rows: ActionRow[], id: string, percent: number): ActionSettings {
  const chance = Math.round(percent * 100);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('機率需介於 0% 到 100%。');
  const group = Object.fromEntries(rows.map(row => [row.id, settings.chances[heading][row.id] ?? 0]));
  group[id] = chance;
  if (sum(group) > FULL_CHANCE) throw new Error('同一朝向的機率總和不能超過 100%。');
  return { ...settings, chances: { ...settings.chances, [heading]: group } };
}

export function withActionEnding(settings: ActionSettings, heading: Heading, id: string, ending: Heading | ''): ActionSettings {
  const group = { ...settings.endings[heading] };
  if (ending) group[id] = ending;
  else delete group[id];
  return { ...settings, endings: { ...settings.endings, [heading]: group } };
}

export function chooseAction(rows: ActionRow[], chances: Readonly<Record<string, number>>, roll: number) {
  let threshold = 0;
  for (const row of rows) {
    threshold += chances[row.id] ?? 0;
    if (roll * FULL_CHANCE < threshold) return row;
  }
}
