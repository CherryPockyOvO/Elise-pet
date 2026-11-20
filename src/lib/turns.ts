import { POSE_FRAMES } from './assets';

/**
 * Left and right are Shizuku's own sides, matching the art folder names:
 * after `front2left` she faces the right edge of the screen, after `front2right` the left edge.
 */
export type Side = 'left' | 'right';
export type Heading = Side | 'front' | 'back';

export type TurnFrame = { source: string; mirrored: boolean; duration: number };

/** The screen direction (+1 = towards the right edge) Shizuku faces when turned to a side. */
export const screenDirection = (side: Side): 1 | -1 => side === 'left' ? 1 : -1;
export const sideFacing = (direction: number): Side => direction > 0 ? 'left' : 'right';

type Clip = { frames: readonly string[]; fpsKey: 'front2left' | 'front2right' | 'left2back' | 'right2back' };

/**
 * One drawn sequence per quarter turn, played forwards or reversed but never mirrored,
 * so the lighting stays consistent. Each has its own FPS setting, keyed by its folder name.
 */
const CLIPS: Record<`front-${Side}` | `${Side}-back`, Clip> = {
  'front-left': { frames: POSE_FRAMES.front2left, fpsKey: 'front2left' },
  'front-right': { frames: POSE_FRAMES.front2right, fpsKey: 'front2right' },
  'left-back': { frames: POSE_FRAMES.left2back, fpsKey: 'left2back' },
  'right-back': { frames: POSE_FRAMES.right2back, fpsKey: 'right2back' },
};

/** Frames for one quarter turn between adjacent headings. */
function quarterTurn(from: Heading, to: Heading, fps: Readonly<Record<string, number>>): TurnFrame[] {
  const toFront = to === 'front';
  const viaFront = from === 'front' || toFront;
  const side = (viaFront ? (toFront ? from : to) : (from === 'back' ? to : from)) as Side;
  const clip = viaFront ? CLIPS[`front-${side}`] : CLIPS[`${side}-back`];
  const duration = 1000 / (fps[clip.fpsKey] ?? 30);
  const frames = clip.frames.map(source => ({ source, mirrored: false, duration }));
  // Each clip is drawn front→side or side→back; play it backwards for the opposite turn.
  if (viaFront ? toFront : from === 'back') frames.reverse();
  return frames;
}

export function turnFrames(path: readonly Heading[], fps: Readonly<Record<string, number>> = {}): TurnFrame[] {
  return path.slice(1).flatMap((to, segment) => {
    const frames = quarterTurn(path[segment], to, fps);
    // Consecutive quarter turns share their joining pose.
    return segment && frames.length > 1 ? frames.slice(1) : frames;
  });
}

export function betweenHeadings(from: Heading, to: Heading, fps: Readonly<Record<string, number>>): TurnFrame[] {
  if (from === to) return [];
  if (from === 'front' && to === 'back' || from === 'back' && to === 'front') {
    return turnFrames([from, Math.random() < 0.5 ? 'left' : 'right', to], fps);
  }
  if (from === 'left' && to === 'right' || from === 'right' && to === 'left') {
    return turnFrames([from, 'back', to], fps);
  }
  return turnFrames([from, to], fps);
}

export const HEADING_STILLS: Record<Side | 'back', TurnFrame> = {
  left: turnFrames(['front', 'left']).at(-1)!,
  right: turnFrames(['front', 'right']).at(-1)!,
  back: turnFrames(['left', 'back']).at(-1)!,
};
