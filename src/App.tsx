import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  CAT_WALK_IMAGES, PRELOAD, catImages, eliseImages,
  type CatAct, type CatPose, type EliseAct, type ElisePose, type Expression,
} from './assets';
import { ChatPanel, type Message } from './ChatPanel';
import { Icon } from './Icon';
import { PetMenu, type MenuSection } from './PetMenu';
import { useClickThrough } from './useClickThrough';
import { STAGE_WIDTH, useWalker } from './useWalker';
import { AUTONOMY_DELAY, useSettings } from './settings';

type Bubble = { id: number; text: string; icon?: string; mood?: Expression };
type Emote = { icon: string; text?: string; mood: Expression };

const DRAG_THRESHOLD = 4;
/** Height of the top of Elise's head above the stage bottom, per layout. */
const HEAD_HEIGHT: Record<ElisePose, number> = { idle: 266, sit: 229, sleep: 119 };
const CAT_TRICK_MS: Record<CatAct, number> = {
  happy: 900, stretch: 1800, roll: 2600, wave: 1800, surprised: 1200,
};
const POKE_LINES = ['哇！嚇我一跳…', '欸？！怎、怎麼了嗎？', '呀…別突然戳我啦。'];
const REPLIES = [
  '嗯嗯，我在聽喔～',
  '原來是這樣呀。小貓也在旁邊點頭呢。',
  '我記下來了！不過現在還是本地示範回覆，之後會接上真正的 AI。',
  '要不要休息一下？我陪你。',
];

/** Mood bubbles she pops up on her own. Icon-only ones are quick reactions. */
const EMOTES: Emote[] = [
  { icon: 'music_note', text: '哼哼～♪', mood: 'happy' },
  { icon: 'heart', mood: 'happy' },
  { icon: 'sparkles', mood: 'happy' },
  { icon: 'question', mood: 'thinking' },
  { icon: 'blush_lines', mood: 'shy' },
  { icon: 'sweat_drop', text: '有點睏了…', mood: 'sleepy' },
  { icon: 'thought_bubble', text: '晚餐要吃什麼呢…', mood: 'thinking' },
  { icon: 'star', text: '今天也要加油喔！', mood: 'happy' },
  { icon: 'chat_heart', text: '要記得喝水喔。', mood: 'speaking' },
  { icon: 'heart_sparkle', text: '小貓好可愛～', mood: 'happy' },
];
const NIGHT_EMOTE: Emote = { icon: 'sleep_zzz', text: '已經很晚了，早點休息吧。', mood: 'sleepy' };
const SLEEP_EMOTE: Emote = { icon: 'sleep_zzz', mood: 'sleepy' };
/** Elise's feet sit this far above the stage bottom; scaling is anchored there. */
const FEET_HEIGHT = 34;

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
/** Runs one option, chosen with probability proportional to its weight. */
function weighted(options: [number, () => void][]) {
  const total = options.reduce((sum, [weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [weight, run] of options) {
    roll -= weight;
    if (roll < 0) { run(); return; }
  }
}
let nextId = 1;

export function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: nextId++, from: 'elise', text: '你好，我是 Elise。今天也和小貓一起陪著你。' },
  ]);
  const [typing, setTyping] = useState(false);
  const [pose, setPose] = useState<ElisePose>('idle');
  const [act, setAct] = useState<EliseAct | null>(null);
  const [catPose, setCatPose] = useState<CatPose>('sit');
  const [catAct, setCatAct] = useState<CatAct | null>(null);
  const [menu, setMenu] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [lifeTick, setLifeTick] = useState(0);
  const { settings, update: updateSettings, reset: resetSettings } = useSettings();

  const stageRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLSpanElement>(null);
  const catRef = useRef<HTMLButtonElement>(null);
  const catImageRef = useRef<HTMLImageElement>(null);
  const timers = useRef<Record<string, number>>({});
  const scaleRef = useRef(settings.eliseSize);
  scaleRef.current = settings.eliseSize;
  /** Who started the current walk: random walks end on their own. */
  const walkOrigin = useRef<'user' | 'auto'>('user');
  const walker = useWalker({ stage: stageRef, sprite: spriteRef, cat: catRef, catImage: catImageRef, scale: scaleRef });
  const walking = walker.phase !== 'off';
  const striding = walker.phase === 'walk';
  const { setPaused } = walker;

  // The menu and chat live in the pet window, which moves while walking.
  // Stand still while they are open so they don't slide away from the cursor.
  useEffect(() => {
    setPaused(menu || chatOpen);
  }, [menu, chatOpen, walker.phase, setPaused]);

  useClickThrough();

  const later = useCallback((key: string, ms: number, run: () => void) => {
    window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(run, ms);
  }, []);
  const cancel = useCallback((key: string) => window.clearTimeout(timers.current[key]), []);

  useEffect(() => {
    PRELOAD.forEach(source => { new Image().src = source; });
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onEscape);
    const pending = timers.current;
    return () => {
      window.removeEventListener('keydown', onEscape);
      Object.values(pending).forEach(id => window.clearTimeout(id));
    };
  }, []);

  const say = useCallback((text: string, bubbleIcon?: string, ms = 3200, mood?: Expression) => {
    setBubble({ id: nextId++, text, icon: bubbleIcon, mood });
    later('bubble', ms, () => setBubble(null));
  }, [later]);

  const playElise = useCallback((next: EliseAct, ms: number, after?: () => void) => {
    setAct(next);
    later('elise', ms, () => { setAct(null); after?.(); });
  }, [later]);

  const playCat = useCallback((next: CatAct) => {
    setCatAct(next);
    later('cat', CAT_TRICK_MS[next], () => setCatAct(null));
  }, [later]);

  const resetActs = useCallback(() => {
    cancel('elise');
    cancel('cat');
    setAct(null);
    setCatAct(null);
  }, [cancel]);

  function emote(choice?: Emote) {
    const hour = new Date().getHours();
    const lateNight = hour >= 23 || hour < 6;
    const chosen = choice ?? (lateNight && Math.random() < 0.3 ? NIGHT_EMOTE : pick(EMOTES));
    say(chosen.text ?? '', chosen.icon, chosen.text ? 3200 : 1800, chosen.mood);
  }

  function randomCatAct() {
    if (catPose === 'loaf') {
      weighted([[2, () => setCatPose('sit')], [1, () => playCat('stretch')]]);
      return;
    }
    weighted([
      [2, () => playCat('stretch')],
      [2, () => playCat('wave')],
      [1, () => playCat('roll')],
      [1.5, () => setCatPose('loaf')],
      [0.8, () => playCat('happy')],
    ]);
  }

  function wanderAround() {
    walkOrigin.current = 'auto';
    setPose('idle');
    setCatPose('sit');
    void walker.start();
    later('autowalk', 6000 + Math.random() * 9000, () => {
      if (walkOrigin.current === 'auto') walker.stop();
    });
  }

  /** One random behaviour, picked to suit what she is doing right now. */
  function liveALittle() {
    if (walking) {
      emote();
    } else if (pose === 'sleep') {
      weighted([
        [3, () => emote(SLEEP_EMOTE)],
        [settings.autonomy === 'low' ? 0.3 : 1, () => { setPose('idle'); setCatPose('sit'); say('嗯～睡飽了。', 'sparkles', 2400, 'happy'); }],
      ]);
    } else if (pose === 'sit') {
      weighted([
        [3, () => emote()],
        [2, randomCatAct],
        [1.5, () => setPose('idle')],
        [0.6, () => { setPose('sleep'); setCatPose('sleep'); }],
      ]);
    } else {
      weighted([
        [3, () => emote()],
        [2, () => playElise('idleAlt', 2600)],
        [3, randomCatAct],
        [1, petCat],
        [1.2, () => setPose('sit')],
        [settings.wander ? 1.2 : 0, wanderAround],
        [0.3, () => { setPose('sleep'); setCatPose('sleep'); }],
      ]);
    }
    setLifeTick(tick => tick + 1);
  }
  const liveRef = useRef(liveALittle);
  liveRef.current = liveALittle;

  // Random life: wait a while, then do something, then wait again.
  const busy = menu || chatOpen || act !== null || catAct !== null;
  useEffect(() => {
    if (settings.autonomy === 'off' || busy) return;
    const [min, max] = AUTONOMY_DELAY[settings.autonomy];
    const id = window.setTimeout(() => liveRef.current(), (min + Math.random() * (max - min)) * 1000);
    return () => window.clearTimeout(id);
  }, [settings.autonomy, busy, pose, catPose, walking, lifeTick]);

  function poke() {
    if (act === 'petCat') return;
    walker.stop();
    resetActs();
    if (pose === 'sleep') {
      setPose('idle');
      setCatPose('sit');
      say('嗯…？我醒了…', 'question');
      return;
    }
    playElise('surprised', 1400);
    playCat('surprised');
    say(pick(POKE_LINES), 'exclamation', 2200);
  }

  function petCat() {
    walker.stop();
    resetActs();
    setPose('idle');
    setCatPose('sit');
    say('乖～乖～', 'heart', 3000);
    playElise('petCat', 3200, () => playCat('happy'));
  }

  function toggleWalking() {
    resetActs();
    setPose('idle');
    setCatPose('sit');
    cancel('autowalk');
    walkOrigin.current = 'user';
    if (walking) {
      walker.stop();
    } else {
      void walker.start();
      say('我們出發吧～', 'paw_print', 2000);
    }
  }

  function toggleSit() {
    walker.stop();
    resetActs();
    setPose(current => (current === 'sit' ? 'idle' : 'sit'));
    setCatPose(current => (current === 'sleep' ? 'sit' : current));
  }

  function toggleSleep() {
    walker.stop();
    resetActs();
    const sleeping = pose !== 'sleep';
    setPose(sleeping ? 'sleep' : 'idle');
    setCatPose(sleeping ? 'sleep' : 'sit');
    if (sleeping) say('晚安…', 'sleep_zzz', 2400);
    else say('早安～睡得好飽。', 'sparkles', 2400);
  }

  function catTrick(trick: CatAct) {
    if (walking) return;
    if (act === 'petCat') resetActs();
    setCatPose(current => (current === 'sleep' && pose !== 'sleep' ? 'sit' : current));
    playCat(trick);
  }

  function toggleLoaf() {
    if (walking) return;
    cancel('cat');
    setCatAct(null);
    setCatPose(current => (current === 'loaf' ? 'sit' : 'loaf'));
  }

  function sendMessage(text: string) {
    setMessages(previous => [...previous, { id: nextId++, from: 'you', text }]);
    setTyping(true);
    later('reply', 700 + Math.random() * 600, () => {
      setTyping(false);
      setMessages(previous => [...previous, { id: nextId++, from: 'elise', text: pick(REPLIES) }]);
    });
  }

  function pressElise(event: ReactMouseEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    setMenu(false);
    const startX = event.screenX;
    const startY = event.screenY;
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    const onMove = (move: MouseEvent) => {
      if (Math.hypot(move.screenX - startX, move.screenY - startY) < DRAG_THRESHOLD) return;
      cleanup();
      // Dragging and walking both move the window; dragging wins.
      walker.stop();
      getCurrentWindow().startDragging().catch(() => {
        // Browser-only preview does not support native window dragging.
      });
    };
    const onUp = () => {
      cleanup();
      poke();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function openMenu(event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setMenu(true);
  }

  function choose(action: () => void) {
    return () => {
      setMenu(false);
      action();
    };
  }

  const mood: Expression = bubble?.mood ?? (
    act === 'surprised' ? 'surprised'
      : act === 'petCat' || walking ? 'happy'
        : pose === 'sleep' ? 'sleepy'
          : pose === 'sit' ? 'shy'
            : typing ? 'speaking' : 'neutral');

  const status =
    walker.phase === 'pause' ? '散步中，先停下來陪你'
      : walking ? '和小貓散步中…'
      : act === 'petCat' ? '正在摸摸小貓'
        : pose === 'sleep' ? '睡著了 Zzz'
          : pose === 'sit' ? '安靜地坐著'
            : '陪在你身邊';

  const sections: MenuSection[] = [
    {
      title: 'Elise',
      items: [
        { id: 'chat', label: '聊天', icon: 'chat_heart', active: chatOpen, onSelect: choose(() => setChatOpen(true)) },
        { id: 'walk', label: walking ? '停下' : '散步', icon: walking ? 'pause' : 'play', active: walking, onSelect: choose(toggleWalking) },
        { id: 'sit', label: pose === 'sit' ? '站起來' : '坐下', icon: pose === 'sit' ? 'chevrons_up' : 'home', active: pose === 'sit', onSelect: choose(toggleSit) },
        { id: 'sleep', label: pose === 'sleep' ? '醒來' : '睡覺', icon: pose === 'sleep' ? 'sparkles' : 'sleep_zzz', active: pose === 'sleep', onSelect: choose(toggleSleep) },
        { id: 'poke', label: '戳一下', icon: 'exclamation', disabled: act === 'petCat', onSelect: choose(poke) },
      ],
    },
    {
      title: '小貓',
      items: [
        { id: 'pet', label: '摸摸', icon: 'paw_print', onSelect: choose(petCat) },
        { id: 'roll', label: '打滾', icon: 'spiral', disabled: walking, onSelect: choose(() => catTrick('roll')) },
        { id: 'wave', label: '揮手', icon: 'heart_sparkle', disabled: walking, onSelect: choose(() => catTrick('wave')) },
        { id: 'stretch', label: '伸懶腰', icon: 'star', disabled: walking, onSelect: choose(() => catTrick('stretch')) },
        { id: 'loaf', label: catPose === 'loaf' ? '坐好' : '趴下', icon: 'heart', active: catPose === 'loaf', disabled: walking, onSelect: choose(toggleLoaf) },
      ],
    },
  ];

  const eliseImage = walking ? eliseImages.idle : eliseImages[act ?? pose];
  const layout = walking || act ? 'idle' : pose;
  const catState = walker.catMoving ? 'walk' : catAct ?? (pose === 'sleep' ? 'sleep' : catPose);
  const catHidden = act === 'petCat';
  const scale = settings.eliseSize;
  const headHeight = FEET_HEIGHT + (HEAD_HEIGHT[layout] - FEET_HEIGHT) * scale;
  const stageStyle = {
    width: STAGE_WIDTH,
    '--elise-scale': scale,
    '--cat-scale': settings.catSize,
  } as CSSProperties;
  const bubbleStyle: CSSProperties = {
    bottom: headHeight + 18,
    left: layout === 'sleep' ? STAGE_WIDTH / 2 - 30 * scale : STAGE_WIDTH / 2,
  };

  return (
    <main
      className="desktop"
      onMouseDown={event => {
        if (!(event.target as Element).closest('.pet-menu')) setMenu(false);
      }}
    >
      <div className="stage" ref={stageRef} style={stageStyle}>
        {chatOpen && (
          <ChatPanel
            messages={messages}
            typing={typing}
            mood={mood}
            onSend={sendMessage}
            onClose={() => setChatOpen(false)}
          />
        )}

        {bubble && !chatOpen && !menu && (
          <div className={`bubble ${bubble.text ? '' : 'emote'}`} key={bubble.id} role="status" style={bubbleStyle}>
            {bubble.icon && <Icon name={bubble.icon} size={bubble.text ? 18 : 24} />}
            {bubble.text && <span>{bubble.text}</span>}
          </div>
        )}

        <div className={`pet-group pose-${layout} ${walking ? 'walking' : ''}`}>
          <div className="elise-shell">
            <button
              className={`character ${walking ? 'walk' : act ?? pose}`}
              onMouseDown={pressElise}
              onContextMenu={openMenu}
              title="點一下戳戳 Elise · 按住拖動 · 右鍵開啟選單"
              aria-label="Elise：點擊互動，按住拖動，右鍵開啟選單"
            >
              {striding ? (
                <span className="walk-sprite" aria-hidden="true" ref={walker.spriteRef} />
              ) : (
                <img key={eliseImage} src={eliseImage} alt="Elise Q 版角色" draggable={false} />
              )}
              {!walking && pose === 'sleep' && !act && <span className="zzz" aria-hidden="true">Z<small>z</small><small>z</small></span>}
            </button>
          </div>

          <button
            ref={catRef}
            className={`cat ${catState} ${catHidden ? 'hidden' : ''}`}
            onClick={() => {
              if (walking || catHidden) return;
              playCat('happy');
              say('小貓很喜歡你摸摸牠～', 'paw_print', 2400);
            }}
            onContextMenu={openMenu}
            title="左鍵摸貓 · 右鍵開啟選單"
            aria-label="灰白貓咪"
            aria-hidden={catHidden}
            tabIndex={catHidden ? -1 : 0}
          >
            <img
              ref={catImageRef}
              src={walker.catMoving ? CAT_WALK_IMAGES[0] : catImages[catState as CatPose | CatAct]}
              alt="灰白貓咪"
              draggable={false}
            />
          </button>
        </div>

        {menu && (
          <PetMenu
            bottom={headHeight + 12}
            status={status}
            mood={mood}
            sections={sections}
            settings={settings}
            onSettings={updateSettings}
            onResetSettings={resetSettings}
            onClose={() => setMenu(false)}
            onExit={choose(() => { void getCurrentWindow().close(); })}
          />
        )}
      </div>
    </main>
  );
}
