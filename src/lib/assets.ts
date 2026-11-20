export type Expression = 'neutral' | 'happy' | 'speaking' | 'shy' | 'thinking';

declare const __POSE_FRAMES__: Record<'walk' | 'stand' | 'standby' | 'front2left' | 'left2back', string[]>;
export const POSE_FRAMES = __POSE_FRAMES__;

export const expression = (name: Expression) => `/assets/shizuku/expressions/${name}.png`;
export const icon = (name: string) => `/assets/icons/${name}.png`;

export const PRELOAD = Object.values(POSE_FRAMES).flat();

/**
 * The icon PNGs have very different amounts of empty padding. This is how much
 * larger than its visible artwork each 256px canvas is, so icons can be drawn
 * at the same visual size.
 */
export const ICON_FILL: Record<string, number> = {
  chat_heart: 2.53, play: 2.17, pause: 2.17, sparkles: 2.13, star: 2.84, heart: 1.75,
  close_round: 2.17, close: 3.71, alert: 2.39, settings: 2.88, thought_bubble: 1.35, bookmark: 3.41,
};
