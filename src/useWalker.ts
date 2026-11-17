import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { currentMonitor, getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window';
import { CAT_WALK_IMAGES as CAT_WALK_FRAMES } from './assets';

/** Width of the pet window / stage. Elise's body is centred in it. */
export const STAGE_WIDTH = 420;
const ELISE_CENTER = STAGE_WIDTH / 2;

/** Walk frames are 512px canvases drawn into a 290px box. */
const SPRITE_SCALE = 290 / 512;
export const WALK_FRAME_COUNT = 8;
/**
 * How far (in 512px canvas units) the planted foot slides backwards while each
 * frame is on screen, measured from walk_side_01..08. Moving the body by exactly
 * this much per frame keeps the feet glued to the ground instead of sliding.
 */
const FOOT_TRAVEL = [22, 43, 59, 34, 30, 18, 61, 39];
const MEAN_TRAVEL = FOOT_TRAVEL.reduce((sum, value) => sum + value, 0) / FOOT_TRAVEL.length;
const BASE_FRAME_MS = 150;
/** Long strides are held a little longer so speed stays even across the cycle. */
const FRAME_MS = FOOT_TRAVEL.map(travel => BASE_FRAME_MS * (0.5 + 0.5 * travel / MEAN_TRAVEL));
const FRAME_SPEED = FOOT_TRAVEL.map((travel, index) => travel * SPRITE_SCALE / FRAME_MS[index]);
/** Small vertical body bob (px): low on the down step, high on the up step. */
const BOB = [0, 1, 0, -1, 0, 1, 0, -1];

const TURN_MS = 520;
/** Cat offset from its CSS spot when it has to walk on Elise's left side. */
const CAT_LEFT_DX = -166;
const CAT_SPEED = 0.42;
const CAT_FRAME_MS = 150;

export type WalkPhase = 'off' | 'walk' | 'turn';
type Facing = 1 | -1;

export type WalkerRefs = {
  stage: RefObject<HTMLDivElement | null>;
  sprite: RefObject<HTMLSpanElement | null>;
  cat: RefObject<HTMLButtonElement | null>;
  catImage: RefObject<HTMLImageElement | null>;
};

function spritePosition(frame: number) {
  return `${(frame % 4) * (100 / 3)}% ${Math.floor(frame / 4) * 100}%`;
}

/**
 * Drives the walk with requestAnimationFrame. Per-frame values are written
 * straight to the DOM; React state only changes on phase/facing transitions.
 * In Tauri the native window moves across the monitor; in a browser preview
 * the stage moves inside the page.
 */
export function useWalker(refs: WalkerRefs) {
  const [phase, setPhase] = useState<WalkPhase>('off');
  const [facing, setFacing] = useState<Facing>(1);
  const [catMoving, setCatMoving] = useState(false);
  const native = useRef(isTauri());
  const sim = useRef({
    phase: 'off' as WalkPhase,
    facing: 1 as Facing,
    x: ELISE_CENTER,
    min: ELISE_CENTER,
    max: ELISE_CENTER,
    windowY: 0,
    frame: 0,
    frameTime: 0,
    turnTime: 0,
    catDx: 0,
    catFacing: 1 as Facing,
    catFrame: 0,
    catTime: 0,
    catMoving: false,
    raf: 0,
    last: 0,
    sending: false,
    sentX: Number.NaN,
    token: 0,
  });

  const applySprite = useCallback(() => {
    const s = sim.current;
    const sprite = refs.sprite.current;
    if (!sprite) return;
    sprite.style.backgroundPosition = spritePosition(s.frame);
    sprite.style.transform = `translateY(${BOB[s.frame]}px) scaleX(${s.facing})`;
  }, [refs.sprite]);

  const apply = useCallback(() => {
    const s = sim.current;
    applySprite();

    const cat = refs.cat.current;
    if (cat) cat.style.transform = s.catDx ? `translateX(${s.catDx}px)` : '';
    const catImage = refs.catImage.current;
    if (catImage) {
      if (s.catMoving) {
        const source = CAT_WALK_FRAMES[s.catFrame];
        if (!catImage.src.endsWith(source)) catImage.src = source;
        catImage.style.transform = `scaleX(${s.catFacing})`;
      } else {
        catImage.style.transform = '';
      }
    }

    const left = Math.round(s.x - ELISE_CENTER);
    if (native.current) {
      if (s.phase !== 'off' && left !== s.sentX && !s.sending) {
        s.sending = true;
        s.sentX = left;
        void getCurrentWindow()
          .setPosition(new LogicalPosition(left, s.windowY))
          .catch(() => undefined)
          .finally(() => { s.sending = false; });
      }
    } else if (refs.stage.current) {
      refs.stage.current.style.left = `${left}px`;
    }
  }, [applySprite, refs.cat, refs.catImage, refs.stage]);

  const tick = useCallback((now: number) => {
    const s = sim.current;
    const dt = Math.min(now - s.last, 50);
    s.last = now;

    if (s.phase === 'walk') {
      let left = dt;
      while (left > 0) {
        const step = Math.min(left, FRAME_MS[s.frame] - s.frameTime);
        s.x += s.facing * FRAME_SPEED[s.frame] * step;
        s.frameTime += step;
        left -= step;
        if (s.frameTime >= FRAME_MS[s.frame] - 1e-6) {
          s.frameTime = 0;
          s.frame = (s.frame + 1) % WALK_FRAME_COUNT;
        }
      }
      if ((s.facing > 0 && s.x >= s.max) || (s.facing < 0 && s.x <= s.min)) {
        s.x = Math.max(s.min, Math.min(s.max, s.x));
        s.phase = 'turn';
        s.turnTime = 0;
        setPhase('turn');
      }
    } else if (s.phase === 'turn') {
      s.turnTime += dt;
    }

    // The cat always walks on the side Elise is heading towards.
    const heading: Facing = s.phase === 'turn' ? (s.facing > 0 ? -1 : 1) : s.facing;
    const catTarget = s.phase !== 'off' && heading < 0 ? CAT_LEFT_DX : 0;
    const diff = catTarget - s.catDx;
    const reach = CAT_SPEED * dt;
    s.catDx = Math.abs(diff) <= reach ? catTarget : s.catDx + Math.sign(diff) * reach;
    const repositioning = diff !== 0;
    s.catFacing = repositioning ? (diff > 0 ? 1 : -1) : s.facing;
    const catMoving = s.phase === 'walk' || repositioning;
    if (catMoving) {
      s.catTime += dt;
      if (s.catTime >= CAT_FRAME_MS) {
        s.catTime = 0;
        s.catFrame = (s.catFrame + 1) % CAT_WALK_FRAMES.length;
      }
    }
    if (catMoving !== s.catMoving) {
      s.catMoving = catMoving;
      setCatMoving(catMoving);
    }

    if (s.phase === 'turn' && s.turnTime >= TURN_MS && s.catDx === catTarget) {
      s.facing = heading;
      s.frame = 0;
      s.frameTime = 0;
      s.phase = 'walk';
      setFacing(heading);
      setPhase('walk');
    }

    apply();
    s.raf = s.phase !== 'off' || s.catMoving ? requestAnimationFrame(tick) : 0;
  }, [apply]);

  const ensureLoop = useCallback(() => {
    const s = sim.current;
    if (s.raf) return;
    s.last = performance.now();
    s.raf = requestAnimationFrame(tick);
  }, [tick]);

  const start = useCallback(async () => {
    const s = sim.current;
    const token = ++s.token;
    if (native.current) {
      try {
        const win = getCurrentWindow();
        const position = (await win.outerPosition()).toLogical(await win.scaleFactor());
        const monitor = await currentMonitor();
        s.x = position.x + ELISE_CENTER;
        s.windowY = position.y;
        if (monitor) {
          const area = monitor.workArea;
          const scale = monitor.scaleFactor;
          s.min = area.position.x / scale + ELISE_CENTER;
          s.max = (area.position.x + area.size.width) / scale - ELISE_CENTER;
        } else {
          s.min = s.max = s.x;
        }
      } catch {
        return;
      }
    } else {
      s.min = ELISE_CENTER;
      s.max = Math.max(ELISE_CENTER, window.innerWidth - ELISE_CENTER);
    }
    if (token !== s.token) return;
    s.sentX = Number.NaN;
    s.frame = 0;
    s.frameTime = 0;
    s.phase = 'walk';
    setPhase('walk');
    setFacing(s.facing);
    ensureLoop();
  }, [ensureLoop]);

  const stop = useCallback(() => {
    const s = sim.current;
    s.token += 1;
    if (s.phase === 'off') return;
    s.phase = 'off';
    setPhase('off');
    ensureLoop();
  }, [ensureLoop]);

  useEffect(() => () => {
    const s = sim.current;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
  }, []);

  /** Ref callback for the walk sprite so it is correct on its very first paint. */
  const spriteRef = useCallback((element: HTMLSpanElement | null) => {
    refs.sprite.current = element;
    if (element) applySprite();
  }, [applySprite, refs.sprite]);

  return { phase, facing, catMoving, start, stop, spriteRef };
}
