import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow, PhysicalPosition, type Monitor } from '@tauri-apps/api/window';
import { POSE_FRAMES } from '../lib/assets';
import { preloadImportedAction, type ImportedAction } from '../lib/actionLibrary';
import { betweenHeadings, HEADING_STILLS, type Heading, type Side, type TurnFrame } from '../lib/turns';
import { STAGE_WIDTH } from './usePetDisplay';

/** Width of the pet window / stage. Shizuku's body is centred in it. */
const PET_CENTER = STAGE_WIDTH / 2;

const WALK_SPEED = 0.145; // Logical pixels per millisecond at the default character size.

const MIN_STROLL_DISTANCE = 70;
const SCREEN_EDGE_MARGIN = 56;
const EASE_DISTANCE = 45;

export type WalkPhase = 'off' | 'walk' | 'turn' | 'look' | 'settle' | 'perform';
type TurnPhase = Exclude<WalkPhase, 'off' | 'walk'>;
type Facing = 1 | -1;
export type ConfiguredWalkAction = ImportedAction & { ending?: Heading };
const sideOf = (facing: Facing): Side => facing < 0 ? 'left' : 'right';
const randomLegLength = () => 120 + Math.random() * 240;
const randomPace = () => 0.78 + Math.random() * 0.3;

function pickLeg(x: number, min: number, max: number, distance: number, minTravel: number, previous?: Facing, preferred?: Side) {
  const roomLeft = x - min;
  const roomRight = max - x;
  // Prefer an inward heading near the boundary and occasional reversals in open space.
  const leftWeight = preferred !== 'right' && roomLeft >= minTravel ? Math.min(roomLeft, distance) * (previous === 1 ? 3 : 1) : 0;
  const rightWeight = preferred !== 'left' && roomRight >= minTravel ? Math.min(roomRight, distance) * (previous === -1 ? 3 : 1) : 0;
  const total = leftWeight + rightWeight;
  if (!total) return;
  const facing: Facing = Math.random() * total < leftWeight ? -1 : 1;
  const room = facing < 0 ? roomLeft : roomRight;
  return { facing, destination: x + facing * Math.min(distance, room) };
}

function walkClip(actions: readonly ConfiguredWalkAction[], facing: Facing) {
  const matches = actions.filter(action => action.heading === sideOf(facing));
  const selected = matches.length > 1 ? matches[Math.floor(Math.random() * matches.length)] : matches[0];
  if (selected) preloadImportedAction(selected);
  return selected;
}

export type WalkerRefs = {
  stage: RefObject<HTMLDivElement | null>;
  sprite: RefObject<HTMLImageElement | null>;
  scale: RefObject<number>;
  monitor: RefObject<Monitor | null>;
  walkActions: RefObject<readonly ConfiguredWalkAction[]>;
  actionFps: RefObject<Readonly<Record<string, number>>>;
};

/**
 * Drives the walk with requestAnimationFrame. Per-frame values are written
 * straight to the DOM; React state only changes on phase/facing transitions.
 * In Tauri the native window moves across the monitor; in a browser preview
 * the stage moves inside the page.
 */
export function useWalker(refs: WalkerRefs) {
  const [phase, setPhase] = useState<WalkPhase>('off');
  const [heading, setHeading] = useState<Heading>('front');
  const [paused, setPausedState] = useState(false);
  const native = useRef(isTauri());
  const sim = useRef({
    phase: 'off' as WalkPhase,
    facing: 1 as Facing,
    heading: 'front' as Heading,
    paused: false,
    x: PET_CENTER,
    min: PET_CENTER,
    max: PET_CENTER,
    windowY: 0,
    dpi: 1,
    segmentStart: PET_CENTER,
    destination: PET_CENTER,
    continuous: false,
    walkEnding: 'front' as Heading,
    walkFallbackEnding: 'front' as Heading,
    minTravel: MIN_STROLL_DISTANCE,
    pace: 1,
    frame: 0,
    frameTime: 0,
    walkClip: undefined as ImportedAction | undefined,
    turnIndex: 0,
    turnTime: 0,
    turnFrames: [] as TurnFrame[],
    turnEnding: 'front' as Heading,
    raf: 0,
    last: 0,
    sending: false,
    sentX: Number.NaN,
    flushPosition: false,
    token: 0,
  });

  const applySprite = useCallback(() => {
    const s = sim.current;
    const sprite = refs.sprite.current;
    if (!sprite || s.phase === 'off') return;
    const turn = s.phase === 'walk' ? undefined
      : s.turnFrames[Math.min(s.turnIndex, s.turnFrames.length - 1)];
    const still = s.heading === 'front' ? undefined : HEADING_STILLS[s.heading];
    const frame = s.phase === 'walk'
      ? { source: (s.walkClip?.frames ?? POSE_FRAMES.walk)[s.frame], mirrored: !s.walkClip && s.facing < 0 }
      : turn ?? still ?? { source: POSE_FRAMES.standby[0], mirrored: false };
    const { source, mirrored } = frame;
    if (sprite.getAttribute('src') !== source) sprite.src = source;
    sprite.style.transform = mirrored ? 'scaleX(-1)' : '';
  }, [refs.sprite]);

  const updateHeading = useCallback((next: Heading) => {
    sim.current.heading = next;
    setHeading(next);
  }, []);

  const beginTurn = useCallback((next: TurnPhase, frames: TurnFrame[], ending: Heading) => {
    const s = sim.current;
    s.turnIndex = 0;
    s.turnTime = 0;
    s.turnFrames = frames;
    s.turnEnding = ending;
    s.phase = next;
    setPhase(next);
  }, []);

  const apply = useCallback(() => {
    const s = sim.current;
    applySprite();

    if (native.current) {
      const left = Math.round((s.x - PET_CENTER) * s.dpi);
      if ((s.phase === 'walk' || s.flushPosition) && left !== s.sentX && !s.sending) {
        s.sending = true;
        s.sentX = left;
        void getCurrentWindow()
          .setPosition(new PhysicalPosition(left, s.windowY))
          .catch(() => undefined)
          .finally(() => { s.sending = false; });
      }
      if (left === s.sentX) s.flushPosition = false;
    } else if (refs.stage.current) {
      refs.stage.current.style.left = `${Math.round(s.x - PET_CENTER)}px`;
      s.flushPosition = false;
    }
  }, [applySprite, refs.stage]);

  const tick = useCallback((now: number) => {
    const s = sim.current;
    if (s.paused && s.phase !== 'off') {
      s.raf = 0;
      return;
    }
    const dt = Math.min(now - s.last, 50);
    s.last = now;

    if (s.phase === 'walk') {
      const end = s.destination;
      const remaining = Math.max(0, (end - s.x) * s.facing);
      const ramp = Math.min(1, Math.abs(s.x - s.segmentStart) / EASE_DISTANCE, remaining / EASE_DISTANCE);
      // Ease both the animation clock and travel with the same pace.
      const stride = dt * s.pace * (0.55 + 0.45 * ramp);
      const travel = WALK_SPEED * refs.scale.current * stride;
      const reachedEnd = travel >= remaining;
      s.x = reachedEnd ? end : s.x + s.facing * travel;
      s.frameTime += stride;
      const frameMs = 1000 / (s.walkClip?.fps ?? refs.actionFps.current.walk ?? 20);
      const passedFrames = Math.floor(s.frameTime / frameMs);
      s.frameTime %= frameMs;
      s.frame = (s.frame + passedFrames) % (s.walkClip?.frames.length ?? POSE_FRAMES.walk.length);
      if (reachedEnd) {
        s.flushPosition = true;
        const next = s.continuous ? pickLeg(s.x, s.min, s.max, randomLegLength(), s.minTravel, s.facing) : undefined;
        if (!next) {
          beginTurn('settle', betweenHeadings(s.heading, s.walkEnding, refs.actionFps.current), s.walkEnding);
        } else {
          const reversing = next.facing !== s.facing;
          s.facing = next.facing;
          s.destination = next.destination;
          s.segmentStart = s.x;
          s.pace = randomPace();
          const clip = walkClip(refs.walkActions.current, s.facing);
          s.walkEnding = clip?.ending ?? s.walkFallbackEnding;
          if (clip?.id !== s.walkClip?.id) {
            s.walkClip = clip;
            s.frame = 0;
            s.frameTime = 0;
          }
          if (reversing) {
            const side = sideOf(s.facing);
            beginTurn('turn', betweenHeadings(s.heading, side, refs.actionFps.current), side);
          }
        }
      }
    } else if (s.phase !== 'off') {
      s.turnTime += dt;
      while (s.turnIndex < s.turnFrames.length && s.turnTime >= s.turnFrames[s.turnIndex].duration) {
        s.turnTime -= s.turnFrames[s.turnIndex].duration;
        s.turnIndex += 1;
      }
    }

    if (s.phase !== 'walk' && s.phase !== 'off' && s.turnIndex === s.turnFrames.length) {
      if (s.phase !== 'turn') {
        updateHeading(s.turnEnding);
        s.phase = 'off';
        setPhase('off');
      } else {
        updateHeading(s.turnEnding);
        s.segmentStart = s.x;
        s.frame = 0;
        s.frameTime = 0;
        s.phase = 'walk';
        setPhase('walk');
      }
    }

    apply();
    s.raf = s.phase !== 'off' || s.flushPosition ? requestAnimationFrame(tick) : 0;
  }, [apply, beginTurn, updateHeading, refs.actionFps, refs.scale, refs.walkActions]);

  const ensureLoop = useCallback(() => {
    const s = sim.current;
    if (s.raf) return;
    s.last = performance.now();
    s.raf = requestAnimationFrame(tick);
  }, [tick]);

  const start = useCallback(async (distance?: number, options?: { ending?: Heading; preferred?: Side; builtIn?: boolean }) => {
    const s = sim.current;
    const token = ++s.token;
    let { x, windowY, dpi } = s;
    let min = PET_CENTER;
    let max = window.innerWidth - PET_CENTER;
    if (native.current) {
      try {
        const win = getCurrentWindow();
        const monitor = refs.monitor.current;
        if (!monitor) return;
        const position = await win.outerPosition();
        const area = monitor.workArea;
        dpi = monitor.scaleFactor;
        x = position.x / dpi + PET_CENTER;
        windowY = position.y;
        min = area.position.x / dpi + PET_CENTER;
        max = (area.position.x + area.size.width) / dpi - PET_CENTER;
      } catch {
        return;
      }
    }
    if (token !== s.token || max <= min) return;
    const continuous = distance === undefined;
    const margin = Math.min(SCREEN_EDGE_MARGIN, Math.max(0, (max - min) / 2 - MIN_STROLL_DISTANCE));
    min += margin;
    max -= margin;
    const minTravel = Math.min(MIN_STROLL_DISTANCE, (max - min) / 2);
    const length = distance ?? randomLegLength();
    const preferred = options?.preferred ?? (s.heading === 'left' || s.heading === 'right' ? s.heading : undefined);
    const leg = pickLeg(x, min, max, length, minTravel, undefined, preferred)
      ?? (preferred && pickLeg(x, min, max, length, minTravel));
    if (!leg) return;

    s.x = s.segmentStart = x;
    s.windowY = windowY;
    s.dpi = dpi;
    s.min = min;
    s.max = max;
    s.facing = leg.facing;
    s.destination = leg.destination;
    s.continuous = continuous;
    s.walkFallbackEnding = options?.ending ?? 'front';
    s.minTravel = minTravel;
    s.pace = randomPace();
    s.flushPosition = false;
    s.sentX = Math.round((x - PET_CENTER) * dpi);
    s.frame = 0;
    s.frameTime = 0;
    const configuredClip = options?.builtIn ? undefined : walkClip(refs.walkActions.current, s.facing);
    s.walkEnding = configuredClip?.ending ?? s.walkFallbackEnding;
    s.walkClip = configuredClip;
    const side = sideOf(leg.facing);
    beginTurn('turn', betweenHeadings(s.heading, side, refs.actionFps.current), side);
    ensureLoop();
  }, [beginTurn, ensureLoop, refs.actionFps, refs.monitor, refs.walkActions]);

  const turnTo = useCallback((ending: Heading, step?: { from: Heading; to: Heading }) => {
    const s = sim.current;
    if (s.phase !== 'off') return;
    const fps = refs.actionFps.current;
    const frames = step ? [
      ...betweenHeadings(s.heading, step.from, fps),
      ...betweenHeadings(step.from, step.to, fps),
      ...betweenHeadings(step.to, ending, fps),
    ] : betweenHeadings(s.heading, ending, fps);
    if (!frames.length) return;
    beginTurn('look', frames, ending);
    ensureLoop();
  }, [beginTurn, ensureLoop, refs.actionFps]);

  const perform = useCallback((action: Pick<ImportedAction, 'frames' | 'heading' | 'fps'>, ending: Heading, artworkEnding = ending) => {
    const s = sim.current;
    if (s.phase !== 'off') return;
    preloadImportedAction(action);
    const approach = betweenHeadings(s.heading, action.heading, refs.actionFps.current);
    const frames = action.frames.map(source => ({
      source, mirrored: false, duration: 1000 / action.fps,
    }));
    const departure = betweenHeadings(artworkEnding, ending, refs.actionFps.current);
    beginTurn('perform', [...approach, ...frames, ...departure], ending);
    ensureLoop();
  }, [beginTurn, ensureLoop, refs.actionFps]);

  const stop = useCallback((mode: 'keep' | 'front' | 'finish-walk' = 'keep') => {
    const s = sim.current;
    s.token += 1;
    s.flushPosition = false;
    if (mode === 'front') updateHeading('front');
    if (mode === 'finish-walk' && s.heading !== s.walkEnding) {
      beginTurn('settle', betweenHeadings(s.heading, s.walkEnding, refs.actionFps.current), s.walkEnding);
    } else {
      s.phase = 'off';
      setPhase('off');
    }
    ensureLoop();
  }, [beginTurn, ensureLoop, refs.actionFps, updateHeading]);

  const setPaused = useCallback((value: boolean) => {
    const s = sim.current;
    if (s.paused === value) return;
    s.paused = value;
    setPausedState(value);
    if (!value && s.phase !== 'off') ensureLoop();
  }, [ensureLoop]);

  useEffect(() => () => {
    const s = sim.current;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
    s.token += 1;
  }, []);

  /** Ref callback for the walk sprite so it is correct on its very first paint. */
  const spriteRef = useCallback((element: HTMLImageElement | null) => {
    refs.sprite.current = element;
    if (element) applySprite();
  }, [applySprite, refs.sprite]);

  return { phase, heading, paused, start, stop, setPaused, turnTo, perform, spriteRef };
}
