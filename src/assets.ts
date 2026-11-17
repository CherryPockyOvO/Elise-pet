/** Persistent poses Elise stays in until told otherwise. */
export type ElisePose = 'idle' | 'sit' | 'sleep';
/** Short one-off actions that return to the current pose. */
export type EliseAct = 'petCat' | 'surprised' | 'idleAlt';
/** Cat states: `sit`/`loaf`/`sleep` persist, the rest are short tricks. */
export type CatPose = 'sit' | 'loaf' | 'sleep';
export type CatAct = 'happy' | 'stretch' | 'roll' | 'wave' | 'surprised';
export type Expression =
  | 'neutral' | 'happy' | 'speaking' | 'surprised' | 'sleepy' | 'shy' | 'thinking' | 'embarrassed';

const elise = (name: string) => `/assets/elise/poses/${name}.png`;
const cat = (name: string) => `/assets/cat/poses/${name}.png`;

export const eliseImages: Record<ElisePose | EliseAct, string> = {
  idle: elise('idle_front'),
  idleAlt: elise('idle_front_alt'),
  sit: elise('sit_shy'),
  sleep: elise('sleep'),
  petCat: elise('pet_cat'),
  surprised: elise('surprised'),
};

export const catImages: Record<CatPose | CatAct, string> = {
  sit: cat('sit_neutral'),
  happy: cat('sit_happy'),
  loaf: cat('loaf'),
  sleep: cat('sleep'),
  stretch: cat('stretch'),
  roll: cat('roll_belly'),
  wave: cat('wave'),
  surprised: cat('surprised'),
};

export const ELISE_WALK_SHEET = elise('walk_side_sheet');
export const CAT_WALK_IMAGES = [cat('walk_01'), cat('walk_02')];

export const expression = (name: Expression) => `/assets/elise/expressions/${name}.png`;
export const icon = (name: string) => `/assets/ui/icons/${name}.png`;

export const PRELOAD = [
  ...Object.values(eliseImages),
  ...Object.values(catImages),
  ELISE_WALK_SHEET,
  ...CAT_WALK_IMAGES,
];

/**
 * The icon PNGs have very different amounts of empty padding. This is how much
 * larger than its visible artwork each 256px canvas is, so icons can be drawn
 * at the same visual size.
 */
export const ICON_FILL: Record<string, number> = {
  chat_heart: 2.53, play: 2.17, pause: 2.17, paw_print: 1.79, home: 2.84,
  chevrons_up: 3.37, sleep_zzz: 2.13, sparkles: 2.13, spiral: 1.67,
  heart_sparkle: 1.78, star: 2.84, heart: 1.75, close_round: 2.17, close: 3.71,
  question: 1.97, exclamation: 1.91, double_exclamation: 2.08, alert: 2.39,
  settings: 2.94, music_note: 1.87, sweat_drop: 2.13, thought_bubble: 1.35,
  refresh: 2.21, chat_dots: 2.56, blush_lines: 1.45, bell: 2.91,
};
