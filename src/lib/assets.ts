type PoseName = 'walk' | 'stand' | 'front2left' | 'front2right' | 'left2back' | 'right2back'
  | 'standby_front' | 'standby_left' | 'standby_right' | 'standby_back';
/** Built-in pose frames. Only the optional stand gesture may be empty. */
declare const __POSE_FRAMES__: Record<PoseName, string[]>;
export const POSE_FRAMES = __POSE_FRAMES__;

/** Round avatars crop the face out of the first front-facing standby frame. */
export const AVATAR = POSE_FRAMES.standby_front[0];
export const icon = (name: string) => `/assets/icons/${name}.png`;

const preloaded: HTMLImageElement[] = [];

/**
 * Decode every built-in frame up front, in the same CORS mode as the sprite element,
 * and keep the images referenced so later frame swaps never wait on a load.
 */
export function preloadPoses() {
  if (preloaded.length) return;
  for (const source of Object.values(POSE_FRAMES).flat()) {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = source;
    preloaded.push(image);
  }
}

/**
 * The icon PNGs have very different amounts of empty padding. This is how much
 * larger than its visible artwork each 256px canvas is, so icons can be drawn
 * at the same visual size.
 */
export const ICON_FILL: Record<string, number> = {
  chat_heart: 2.53, play: 2.17, pause: 2.17, sparkles: 2.13, star: 2.84, heart: 1.75,
  close_round: 2.17, close: 3.71, alert: 2.39, settings: 2.88, thought_bubble: 1.35, bookmark: 3.41,
};
