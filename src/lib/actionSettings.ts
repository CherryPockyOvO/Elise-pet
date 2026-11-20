import type { ActionKind, ImportedAction } from './actionLibrary';
import { POSE_FRAMES } from './assets';
import type { Heading } from './turns';

export const HEADINGS: Record<Heading, string> = { front: '正面', left: '左側', back: '背面', right: '右側' };
export const FULL_CHANCE = 10_000; // Hundredths of one percent.
export const WALK_ACTIVITY = {
  relaxed: { label: '懶散', chance: 10 },
  normal: { label: '正常', chance: 25 },
  lively: { label: '活潑', chance: 45 },
} as const;
export type WalkActivity = keyof typeof WALK_ACTIVITY;

export type TurnId = 'front2left' | 'front2right' | 'left2back' | 'right2back';
export type StandbyId = `standby_${Heading}`;
type BuiltInId = StandbyId | TurnId | 'stand' | 'walk';

type BuiltInAction = {
  id: BuiltInId;
  name: string;
  priority: number;
  defaultFps: number;
  headings: readonly Heading[];
};

export const STANDBY_FPS = 10;
/** The two headings each turn sequence connects; it plays forwards from the first. */
export const TURN_ENDS: Record<TurnId, readonly [Heading, Heading]> = {
  front2left: ['front', 'left'],
  front2right: ['front', 'right'],
  left2back: ['left', 'back'],
  right2back: ['right', 'back'],
};

const BUILT_IN_ACTIONS: readonly BuiltInAction[] = ([
  { id: 'stand', name: '站立小動作', priority: 1, defaultFps: 10, headings: ['front'] },
  { id: 'walk', name: '散步', priority: 2, defaultFps: 20, headings: ['left', 'right'] },
  { id: 'front2left', name: '正面 ↔ 左側', priority: 2, defaultFps: 30, headings: TURN_ENDS.front2left },
  { id: 'front2right', name: '正面 ↔ 右側', priority: 2, defaultFps: 30, headings: TURN_ENDS.front2right },
  { id: 'left2back', name: '左側 ↔ 背面', priority: 2, defaultFps: 30, headings: TURN_ENDS.left2back },
  { id: 'right2back', name: '右側 ↔ 背面', priority: 2, defaultFps: 30, headings: TURN_ENDS.right2back },
  { id: 'standby_front', name: '正面待機', priority: 3, defaultFps: STANDBY_FPS, headings: ['front'] },
  { id: 'standby_left', name: '左側待機', priority: 3, defaultFps: STANDBY_FPS, headings: ['left'] },
  { id: 'standby_right', name: '右側待機', priority: 3, defaultFps: STANDBY_FPS, headings: ['right'] },
  { id: 'standby_back', name: '背面待機', priority: 3, defaultFps: STANDBY_FPS, headings: ['back'] },
] satisfies readonly BuiltInAction[])
  // The optional stand gesture appears only once its frames exist.
  .filter(action => action.id === 'walk' || POSE_FRAMES[action.id].length >= 2);

/** The standby loop for a heading. */
export const standbyFrames = (heading: Heading) => POSE_FRAMES[`standby_${heading}`];

export type ActionRow = (BuiltInAction & { source: 'built-in' }) | {
  source: 'imported';
  id: string;
  name: string;
  priority: number;
  defaultFps: number;
  action: ImportedAction;
};

export type ActionSettings = {
  walkActivity: WalkActivity;
  fps: Record<string, number>;
  chances: Record<Heading, Record<string, number>>;
  endings: Record<Heading, Record<string, Heading>>;
  kinds: Record<string, ActionKind>;
};

const DEFAULTS: ActionSettings = {
  walkActivity: 'normal',
  fps: {},
  kinds: {},
  endings: { front: {}, left: {}, back: {}, right: {} },
  chances: {
    front: { stand: 3000, front2left: 650, front2right: 650 },
    left: { front2left: 2500, left2back: 2200 },
    back: { left2back: 3400, right2back: 3400 },
    right: { front2right: 2500, right2back: 2200 },
  },
};
const SETTINGS_KEY = 'shizuku-pet.actions.settings.v2';

export function actionsForHeading(heading: Heading, imports: readonly ImportedAction[]): ActionRow[] {
  const builtIn = BUILT_IN_ACTIONS.filter(action => action.headings.includes(heading));
  return [
    ...builtIn.map(action => ({
      ...action,
      source: 'built-in' as const,
    })),
    ...imports.filter(action => action.heading === heading && action.frameCount >= 2).map(action => ({
      source: 'imported' as const, id: action.id, name: action.name, priority: action.kind === 'walk' ? 2 : 3,
      defaultFps: action.fps, action,
    })),
  ].sort((a, b) => a.priority - b.priority);
}

export function isWalkingAction(row: ActionRow) {
  return row.source === 'built-in' ? row.id === 'walk' : row.action.kind === 'walk';
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
        const group = Object.fromEntries(Object.entries(boundedEntries(savedChances, 0, FULL_CHANCE))
          .filter(([id]) => id.startsWith('action-') || BUILT_IN_ACTIONS.some(action => action.id === id && action.id !== 'walk' && action.headings.includes(heading))));
        if (sum(group) <= FULL_CHANCE) chances[heading] = group;
      }
      const groupEndings = stored.endings?.[heading];
      if (groupEndings && typeof groupEndings === 'object') {
        endings[heading] = Object.fromEntries(Object.entries(groupEndings)
          .filter((entry): entry is [string, Heading] => isHeading(entry[1])));
      }
    }
    const kinds = Object.fromEntries(Object.entries(stored.kinds ?? {})
      .filter((entry): entry is [string, ActionKind] => entry[1] === 'walk' || entry[1] === 'gesture'));
    const walkActivity = Object.keys(WALK_ACTIVITY).find(level => level === stored.walkActivity) as WalkActivity | undefined;
    return { walkActivity: walkActivity ?? DEFAULTS.walkActivity, fps: boundedEntries(stored.fps, 1, 30), chances, endings, kinds };
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

export function withActionKind(settings: ActionSettings, id: string, kind: ActionKind): ActionSettings {
  return { ...settings, kinds: { ...settings.kinds, [id]: kind } };
}

export function withoutAction(settings: ActionSettings, { id, heading }: ImportedAction): ActionSettings {
  const { [id]: removedFps, ...fps } = settings.fps;
  const { [id]: removedKind, ...kinds } = settings.kinds;
  const { [id]: removedChance, ...chances } = settings.chances[heading];
  const { [id]: removedEnding, ...endings } = settings.endings[heading];
  return { ...settings, fps, kinds, chances: { ...settings.chances, [heading]: chances },
    endings: { ...settings.endings, [heading]: endings } };
}

export function withActionChance(settings: ActionSettings, heading: Heading, rows: ActionRow[], id: string, percent: number): ActionSettings {
  const chance = Math.round(percent * 100);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('機率需介於 0% 到 100%。');
  const group = Object.fromEntries(rows.map(row => [row.id, settings.chances[heading][row.id] ?? 0]));
  group[id] = chance;
  if (sum(group) > FULL_CHANCE) throw new Error('同一朝向的機率總和不能超過 100%。');
  return { ...settings, chances: { ...settings.chances, [heading]: group } };
}

export function withEvenActionChances(settings: ActionSettings, heading: Heading, rows: readonly ActionRow[]): ActionSettings {
  if (rows.length === 0) return settings;
  const share = Math.floor(FULL_CHANCE / rows.length);
  const remainder = FULL_CHANCE % rows.length;
  const group = Object.fromEntries(rows.map((row, index) => [row.id, share + Number(index < remainder)]));
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
