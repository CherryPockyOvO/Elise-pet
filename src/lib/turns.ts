import { POSE_FRAMES } from './assets';

export type Side = 'left' | 'right';
export type Heading = Side | 'front' | 'back';

export type TurnFrame = { source: string; mirrored: boolean; duration: number };

export function turnFrames(path: readonly Heading[], fps: Readonly<Record<string, number>> = {}): TurnFrame[] {
  return path.slice(1).flatMap((to, segment) => {
    const from = path[segment];
    const mirrored = from === 'left' || to === 'left';
    const back = from === 'back' || to === 'back';
    const reverse = back ? from === 'back' : to === 'front';
    const sources = back ? POSE_FRAMES.left2back : POSE_FRAMES.front2left;
    const frames = sources.map(source => ({
      source,
      mirrored,
      duration: 1000 / (fps[back ? 'left2back' : 'front2left'] ?? 30),
    }));
    if (reverse) frames.reverse();
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
  back: turnFrames(['right', 'back']).at(-1)!,
};
