import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow, PhysicalPosition, type Monitor } from '@tauri-apps/api/window';
import { POSE_FRAMES } from '../lib/assets';
import { preloadImportedAction, type ImportedAction } from '../lib/actionLibrary';
import { DEFAULT_GAIT, measuredGait, walkGait } from '../lib/stride';
import { betweenHeadings, HEADING_STILLS, screenDirection, sideFacing, type Heading, type Side, type TurnFrame } from '../lib/turns';
import { STAGE_WIDTH } from './usePetDisplay';

/** Width of the pet window / stage. Shizuku's body is centred in it. */
const PET_CENTER = STAGE_WIDTH / 2;
/** Size of the square box the sprite is drawn into at scale 1 (`.pet-group` in style.css). */
const SPRITE_BOX = 290;
/** The built-in walk cycle is drawn facing the right edge of the screen. */
const BUILT_IN_WALK_DIRECTION = 1;

const MIN_STROLL_DISTANCE = 70;
const SCREEN_EDGE_MARGIN = 56;
const EASE_DISTANCE = 45;

export type WalkPhase = 'off' | 'walk' | 'turn' | 'look' | 'settle' | 'perform';
type TurnPhase = Exclude<WalkPhase, 'off' | 'walk'>;
type Facing = 1 | -1;
export type ConfiguredWalkAction = ImportedAction & { ending?: Heading };
const sideOf = (facing: Facing): Side => sideFacing(facing);

/**
 * Frames that end a walk facing `ending`. When no turn is needed the walk would stop
 * mid-stride, so finish on that heading's standing pose instead.
 */
function settleFrames(from: Heading, ending: Heading, fps: Readonly<Record<string, number>>): TurnFrame[] {
  const frames = betweenHeadings(from, ending, fps);
  if (frames.length || ending === 'front') return frames;
  return [{ ...HEADING_STILLS[ending], duration: 1000 / (fps.walk ?? 20) }];
}
const randomPace = () => 0.85 + Math.random() * 0.2;

/** Which way to set off: towards the side with more room, unless a side is preferred. */
function pickDirection(x: number, min: number, max: number, minTravel: number, preferred?: Side): Facing | undefined {
  const roomLeft = x - min;
  const roomRight = max - x;
  const only = preferred && screenDirection(preferred);
  const leftWeight = only !== 1 && roomLeft >= minTravel ? roomLeft : 0;
  const rightWeight = only !== -1 && roomRight >= minTravel ? roomRight : 0;
  const total = leftWeight + rightWeight;
  if (!total) return;
  return Math.random() * total < leftWeight ? -1 : 1;
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
  /** Frames that bring the standby loop back to a pose the turns join, before an action. */
  idleLeadIn: RefObject<() => TurnFrame[]>;
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
    /** Ground travel per walk frame (fraction of the canvas width) and the feet-together frames. */
    gait: DEFAULT_GAIT,
    /** The walk frame to show on arrival, so a leg always ends with the feet together. */
    arrivalFrame: 0,
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
    const frame = s.phase === 'walk'
      ? { source: (s.walkClip?.frames ?? POSE_FRAMES.walk)[s.frame], mirrored: !s.walkClip && s.facing < 0 }
      : s.turnFrames[Math.min(s.turnIndex, s.turnFrames.length - 1)];
    // With no turn to play (already facing that way), keep the pose that is on screen.
    if (!frame) return;
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

  /** On-screen width of the sprite canvas, in logical pixels. */
  const spriteWidth = useCallback(() => {
    const box = SPRITE_BOX * refs.scale.current;
    const sprite = refs.sprite.current;
    // `object-fit: contain` narrows canvases that are taller than wide.
    return sprite && sprite.naturalHeight > sprite.naturalWidth && sprite.naturalWidth
      ? box * sprite.naturalWidth / sprite.naturalHeight : box;
  }, [refs.scale, refs.sprite]);

  /**
   * Sets the destination about `distance` ahead, adjusted so the walk cycle reaches a
   * feet-together frame exactly on arrival. Stays within `room` when it can.
   */
  const planLeg = useCallback((distance: number, room: number) => {
    const s = sim.current;
    const count = s.walkClip?.frames.length ?? POSE_FRAMES.walk.length;
    const frameMs = 1000 / (s.walkClip?.fps ?? refs.actionFps.current.walk ?? 20);
    const step = s.gait.stride * spriteWidth();
    // Travel and the frame clock advance together, so k frames from now is a known distance.
    const phase = s.frameTime / frameMs;
    const reach = (k: number) => (k - phase) * step;
    const rests = new Set(s.gait.rest);
    const lands = (k: number) => rests.has((s.frame + k) % count);
    const furthest = Math.floor(room / step + phase);
    const wanted = Math.max(1, Math.round(distance / step + phase));
    let frames = 0;
    for (let k = wanted; k <= furthest && !frames; k++) if (lands(k)) frames = k;
    for (let k = Math.min(wanted, furthest); k >= 1 && !frames; k--) if (lands(k)) frames = k;
    if (frames) {
      s.destination = s.x + s.facing * reach(frames);
      s.arrivalFrame = (s.frame + frames) % count;
    } else {
      s.destination = s.x + s.facing * Math.min(distance, room);
      s.arrivalFrame = -1;
    }
  }, [refs.actionFps, spriteWidth]);

  /** Room ahead before the screen-edge margin. */
  const roomAhead = useCallback(() => {
    const s = sim.current;
    return Math.max(0, s.facing > 0 ? s.max - s.x : s.x - s.min);
  }, []);

  /** Use the measured gait for a walk clip, measuring it in the background the first time. */
  const applyClipGait = useCallback((clip: ImportedAction | undefined) => {
    const s = sim.current;
    const frames = clip?.frames ?? POSE_FRAMES.walk;
    const direction = clip ? screenDirection(clip.heading as Side) : BUILT_IN_WALK_DIRECTION;
    s.gait = measuredGait(frames, direction) ?? DEFAULT_GAIT;
    void walkGait(frames, direction).then(gait => {
      if (s.walkClip !== clip || s.gait === gait) return;
      s.gait = gait;
      // Re-plan the current leg with the real stride so it still ends with the feet together.
      if (s.phase === 'walk') planLeg(Math.abs(s.destination - s.x), roomAhead());
    });
  }, [planLeg, roomAhead]);

  useEffect(() => { void walkGait(POSE_FRAMES.walk, BUILT_IN_WALK_DIRECTION); }, []);

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
      const frameCount = s.walkClip?.frames.length ?? POSE_FRAMES.walk.length;
      const frameMs = 1000 / (s.walkClip?.fps ?? refs.actionFps.current.walk ?? 20);
      const remaining = Math.max(0, (s.destination - s.x) * s.facing);
      const ramp = Math.min(1, Math.abs(s.x - s.segmentStart) / EASE_DISTANCE, remaining / EASE_DISTANCE);
      // Glide continuously, at the average pace the feet move in the artwork: one measured
      // stride per frame. Easing slows the animation clock and the travel together.
      const clock = dt * s.pace * (0.55 + 0.45 * ramp);
      const step = s.gait.stride * spriteWidth();
      const travel = clock / frameMs * step;
      const reachedEnd = travel >= remaining;
      s.x = reachedEnd ? s.destination : s.x + s.facing * travel;
      s.frameTime += clock;
      s.frame = (s.frame + Math.floor(s.frameTime / frameMs)) % frameCount;
      s.frameTime %= frameMs;
      if (reachedEnd) {
        s.flushPosition = true;
        // The leg was planned to end with the feet together; land on exactly that frame.
        if (s.arrivalFrame >= 0) {
          s.frame = s.arrivalFrame;
          s.frameTime = 0;
        }
        // Hold that pose for one frame before turning, so the stop reads clearly.
        const arrival: TurnFrame = {
          source: (s.walkClip?.frames ?? POSE_FRAMES.walk)[s.frame], mirrored: !s.walkClip && s.facing < 0, duration: frameMs,
        };
        s.facing = (-s.facing) as Facing;
        const roomBack = roomAhead();
        if (!s.continuous || roomBack < s.minTravel) {
          s.facing = (-s.facing) as Facing;
          beginTurn('settle', [arrival, ...settleFrames(s.heading, s.walkEnding, refs.actionFps.current)], s.walkEnding);
        } else {
          // Reached the edge of the screen: turn round and cross back.
          s.segmentStart = s.x;
          s.pace = randomPace();
          const clip = walkClip(refs.walkActions.current, s.facing);
          s.walkEnding = clip?.ending ?? s.walkFallbackEnding;
          s.walkClip = clip;
          applyClipGait(clip);
          s.frame = 0;
          s.frameTime = 0;
          planLeg(roomBack, roomBack);
          const side = sideOf(s.facing);
          beginTurn('turn', [arrival, ...betweenHeadings(s.heading, side, refs.actionFps.current)], side);
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
  }, [apply, applyClipGait, beginTurn, planLeg, roomAhead, spriteWidth, updateHeading, refs.actionFps, refs.walkActions]);

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
    const preferred = options?.preferred ?? (s.heading === 'left' || s.heading === 'right' ? s.heading : undefined);
    const facing = pickDirection(x, min, max, minTravel, preferred) ?? (preferred && pickDirection(x, min, max, minTravel));
    if (!facing) return;

    s.x = s.segmentStart = x;
    s.windowY = windowY;
    s.dpi = dpi;
    s.min = min;
    s.max = max;
    s.facing = facing;
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
    applyClipGait(configuredClip);
    // A stroll covers the given distance; the menu's walk crosses to the edge of the screen.
    const room = roomAhead();
    planLeg(Math.min(distance ?? room, room), room);
    const side = sideOf(facing);
    const leadIn = s.phase === 'off' ? refs.idleLeadIn.current() : [];
    beginTurn('turn', [...leadIn, ...betweenHeadings(s.heading, side, refs.actionFps.current)], side);
    ensureLoop();
  }, [applyClipGait, beginTurn, ensureLoop, planLeg, roomAhead, refs.actionFps, refs.idleLeadIn, refs.monitor, refs.walkActions]);

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
    beginTurn('look', [...refs.idleLeadIn.current(), ...frames], ending);
    ensureLoop();
  }, [beginTurn, ensureLoop, refs.actionFps, refs.idleLeadIn]);

  const perform = useCallback((action: Pick<ImportedAction, 'frames' | 'heading' | 'fps'>, ending: Heading, artworkEnding = ending) => {
    const s = sim.current;
    if (s.phase !== 'off') return;
    preloadImportedAction(action);
    const approach = betweenHeadings(s.heading, action.heading, refs.actionFps.current);
    const frames = action.frames.map(source => ({
      source, mirrored: false, duration: 1000 / action.fps,
    }));
    const departure = betweenHeadings(artworkEnding, ending, refs.actionFps.current);
    beginTurn('perform', [...refs.idleLeadIn.current(), ...approach, ...frames, ...departure], ending);
    ensureLoop();
  }, [beginTurn, ensureLoop, refs.actionFps, refs.idleLeadIn]);

  const stop = useCallback((mode: 'keep' | 'front' | 'finish-walk' = 'keep') => {
    const s = sim.current;
    s.token += 1;
    s.flushPosition = false;
    if (mode === 'front') updateHeading('front');
    if (mode === 'finish-walk' && s.phase === 'walk') {
      // Asked to stop mid-stride: walk on to the next feet-together frame and settle there.
      s.continuous = false;
      planLeg(0, roomAhead());
      ensureLoop();
      return;
    }
    // Stopped partway through a turn: play back what was shown, then turn from there.
    const unwind = s.phase === 'turn' ? s.turnFrames.slice(0, Math.min(s.turnIndex + 1, s.turnFrames.length)).reverse() : [];
    if (mode === 'finish-walk') {
      beginTurn('settle', [...unwind, ...settleFrames(s.heading, s.walkEnding, refs.actionFps.current)], s.walkEnding);
    } else {
      s.phase = 'off';
      setPhase('off');
    }
    ensureLoop();
  }, [beginTurn, ensureLoop, planLeg, roomAhead, refs.actionFps, updateHeading]);

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

  /** Whether the walker currently owns the sprite (reads live state, not the last render). */
  const isBusy = useCallback(() => sim.current.phase !== 'off', []);

  return { phase, heading, paused, start, stop, setPaused, turnTo, perform, spriteRef, isBusy };
}
