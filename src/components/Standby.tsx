import { useLayoutEffect, type RefObject } from 'react';
import { homeFrames } from '../lib/homeFrames';
import type { TurnFrame } from '../lib/turns';

type IdlePose = {
  /** The one sprite element shared with the walker, so poses swap without remounting. */
  sprite: RefObject<HTMLImageElement | null>;
  /** False while the walker is drawing a turn, walk or gesture into the sprite. */
  active: boolean;
  /** Reports whether the walker has taken over since the last render. */
  walkerBusy: () => boolean;
  /** The heading's standby loop. */
  frames: readonly string[];
  fps: number;
  /** Filled with a function that returns the frames leading back to a home pose. */
  leadIn: RefObject<() => TurnFrame[]>;
};

/** Lead-in frames play this many times faster than the loop, capped at 30 FPS. */
const LEAD_IN_SPEED = 3;

/**
 * Plays the heading's standby loop into the shared sprite. Writing into the same
 * element the walker uses means an action never starts with a freshly created image
 * that has not been decoded yet.
 */
export function useIdlePose({ sprite, active, walkerBusy, frames, fps, leadIn }: IdlePose) {
  useLayoutEffect(() => {
    const element = sprite.current;
    if (!active || !element || frames.length < 2) return;
    const show = (source: string) => {
      if (element.getAttribute('src') !== source) element.src = source;
      element.style.transform = '';
    };

    let frame = 0;
    let home: readonly number[] = [0];
    let cancelled = false;
    void homeFrames(frames).then(found => { if (!cancelled) home = found; });

    // Shortest way from the frame on screen to a home frame, forwards or backwards.
    leadIn.current = () => {
      const count = frames.length;
      const homes = new Set(home);
      if (homes.has(frame)) return [];
      let ahead = 1;
      while (ahead < count && !homes.has((frame + ahead) % count)) ahead++;
      let behind = 1;
      while (behind < count && !homes.has((frame - behind + count) % count)) behind++;
      const duration = 1000 / Math.min(30, fps * LEAD_IN_SPEED);
      const path = ahead <= behind
        ? Array.from({ length: ahead }, (_, step) => (frame + step + 1) % count)
        : Array.from({ length: behind }, (_, step) => (frame - step - 1 + count) % count);
      return path.map(index => ({ source: frames[index], mirrored: false, duration }));
    };

    if (!walkerBusy()) show(frames[0]);
    const timer = window.setInterval(() => {
      // Leave the sprite (and the frame the lead-in starts from) alone while the walker draws.
      if (walkerBusy()) return;
      frame = (frame + 1) % frames.length;
      show(frames[frame]);
    }, 1000 / fps);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      leadIn.current = () => [];
    };
  }, [sprite, active, walkerBusy, frames, fps, leadIn]);
}
