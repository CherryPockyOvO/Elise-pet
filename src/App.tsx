import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  CAT_WALK_IMAGES, ELISE_FRAMES, PRELOAD, catImages, eliseImages,
  type CatAct, type CatPose, type EliseAct, type ElisePose, type Expression,
} from './assets';
import { ChatPanel, type Message } from './ChatPanel';
import { ActionPanel } from './ActionPanel';
import { loadActionLibrary, loadDisabledActions, saveDisabledActions, type ImportedAction } from './actionLibrary';
import { actionsForHeading, chooseAction, loadActionSettings, saveActionSettings, type ActionRow, type ActionSettings } from './actionSettings';
import { DeepSeekPanel } from './DeepSeekPanel';
import { EliseStanding } from './EliseStanding';
import { loadPreferences, MODELS } from './deepseekPreferences';
import { Icon } from './Icon';
import { PetMenu, type MenuSection } from './PetMenu';
import { loadPetSizes, storePetSizes, type PetSizes } from './petSizes';
import { HEADING_STILLS, type Heading } from './eliseTurns';
import { useClickThrough } from './useClickThrough';
import { STAGE_WIDTH, useWalker, type ConfiguredWalkAction } from './useWalker';

type Bubble = { id: number; text: string; icon?: string };

const DRAG_THRESHOLD = 4;
/** Height of the top of Elise's head above the stage bottom, per layout. */
const HEAD_HEIGHT: Record<ElisePose, number> = { idle: 266, sit: 229, sleep: 119 };
const BUBBLE_HEIGHT: Record<ElisePose, number> = { idle: 284, sit: 248, sleep: 140 };
const SCALE_PIVOT_HEIGHT = 34;
// The widest cat PNG extends about 50 CSS pixels right of its sprite centre.
const CAT_ART_RADIUS = 50;
const CAT_TRICK_MS: Record<CatAct, number> = {
  happy: 900, stretch: 1800, roll: 2600, wave: 1800, surprised: 1200,
};
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const CAT_ACTIVITIES = ['stretch', 'wave', 'roll', 'loaf'];
const POKE_LINES = ['哇！嚇我一跳…', '欸？！怎、怎麼了嗎？', '呀…別突然戳我啦。'];
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
let nextId = 1;

export function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [deepSeekOpen, setDeepSeekOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [importedActions, setImportedActions] = useState<ImportedAction[]>([]);
  const [disabledActions, setDisabledActions] = useState(loadDisabledActions);
  const [actionSettings, setActionSettings] = useState(loadActionSettings);
  const [actionsLoading, setActionsLoading] = useState(isTauri);
  const [actionStorageError, setActionStorageError] = useState('');
  const [preferences, setPreferences] = useState(loadPreferences);
  const [sizes, setSizes] = useState(loadPetSizes);
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: nextId++, from: 'elise', text: '嗨，我是 Elise Grace，叫我 Elise 就好。旁邊這隻是麻糬，牠正在假裝沒看到我們。' },
  ]);
  const [typing, setTyping] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chosenPose, setPose] = useState<ElisePose>('idle');
  const [rest, setRest] = useState<'sit' | 'sleep' | null>(null);
  const [act, setAct] = useState<EliseAct | null>(null);
  const [catPose, setCatPose] = useState<CatPose>('sit');
  const [catAct, setCatAct] = useState<CatAct | null>(null);
  const [menu, setMenu] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [pressingElise, setPressingElise] = useState(false);
  const [activityRound, setActivityRound] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLImageElement>(null);
  const catRef = useRef<HTMLButtonElement>(null);
  const catImageRef = useRef<HTMLImageElement>(null);
  const timers = useRef<Record<string, number>>({});
  const scale = useRef(sizes.eliseSize);
  const requestPending = useRef(false);
  const gestureCleanup = useRef<(() => void) | null>(null);
  const standEnding = useRef<Heading | undefined>(undefined);
  const restEnding = useRef<Heading | undefined>(undefined);
  const actionFps = useRef(actionSettings.fps);
  const walkActions = useRef<readonly ConfiguredWalkAction[]>([]);
  const walker = useWalker({ stage: stageRef, sprite: spriteRef, cat: catRef, catImage: catImageRef, scale, walkActions, actionFps });
  const { start: startWalk, stop: stopWalk, setPaused, turnTo, perform, heading } = walker;
  const animated = walker.phase !== 'off';
  const walking = walker.phase === 'walk' || walker.phase === 'turn';
  const catWalking = walker.catMoving && !(animated && walker.paused);
  const pose = rest ?? chosenPose;
  const interacting = menu || chatOpen || deepSeekOpen || actionsOpen || pressingElise;

  useEffect(() => { setPaused(interacting); }, [interacting, setPaused]);
  useEffect(() => {
    actionFps.current = actionSettings.fps;
    walkActions.current = importedActions
      .filter(action => action.kind === 'walk' && !disabledActions.includes(action.id))
      .map(action => ({ ...action, fps: actionSettings.fps[action.id] ?? action.fps,
        ending: actionSettings.endings[action.heading][action.id] }));
  }, [importedActions, disabledActions, actionSettings.fps, actionSettings.endings]);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    void loadActionLibrary().then(saved => {
      if (!active) return;
      setImportedActions(current => [...saved, ...current.filter(action => !saved.some(item => item.id === action.id))]);
    }).catch(error => {
      if (active) setActionStorageError(String(error));
    }).finally(() => {
      if (active) setActionsLoading(false);
    });
    return () => { active = false; };
  }, []);

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
      gestureCleanup.current?.();
    };
  }, []);

  const say = useCallback((text: string, bubbleIcon?: string, ms = 3200) => {
    setBubble({ id: nextId++, text, icon: bubbleIcon });
    later('bubble', ms, () => setBubble(null));
  }, [later]);

  const playElise = useCallback((next: EliseAct, ms: number, after?: () => void) => {
    setAct(next);
    later('elise', ms, () => { setAct(null); after?.(); });
  }, [later]);

  const playCat = useCallback((next: CatAct, after?: () => void) => {
    setCatAct(next);
    later('cat', CAT_TRICK_MS[next], () => { setCatAct(null); after?.(); });
  }, [later]);

  const finishStanding = useCallback(() => {
    setAct(null);
    if (standEnding.current) turnTo(standEnding.current);
    standEnding.current = undefined;
  }, [turnTo]);

  const resetActs = useCallback(() => {
    cancel('elise');
    cancel('cat');
    standEnding.current = undefined;
    restEnding.current = undefined;
    setAct(null);
    setCatAct(null);
  }, [cancel]);

  // Voluntary rests are temporary. User-selected sitting and sleeping stay in place.
  useEffect(() => {
    if (!rest || interacting) return;
    const delay = rest === 'sit' ? randomBetween(7_000, 13_000) : randomBetween(15_000, 25_000);
    const id = window.setTimeout(() => {
      setRest(null);
      if (restEnding.current) turnTo(restEnding.current);
      restEnding.current = undefined;
    }, delay);
    return () => window.clearTimeout(id);
  }, [rest, interacting, turnTo]);

  const runAction = useCallback((row: ActionRow, from: Heading, preview = false) => {
    const end = actionSettings.endings[from][row.id];
    const finish = () => { if (end) turnTo(end); };
    if (row.source === 'imported') {
      const action = { ...row.action, fps: actionSettings.fps[row.id] ?? row.action.fps };
      if (action.kind === 'walk' && !preview && (from === 'left' || from === 'right')) {
        void startWalk(randomBetween(75, 390), { action, ending: end, preferred: from });
      } else {
        // The imported artwork itself ends in the configured orientation.
        perform(action, end ?? action.heading);
      }
      return;
    }
    switch (row.id) {
      case 'stand':
        standEnding.current = end;
        setAct('stand');
        break;
      case 'walk':
        void startWalk(randomBetween(75, 390), { ending: end,
          preferred: preview && (from === 'left' || from === 'right') ? from : undefined });
        break;
      case 'front2left': {
        const side = end === 'left' || end === 'right' ? end : Math.random() < 0.5 ? 'left' : 'right';
        const to = from === 'front' ? side : 'front';
        turnTo(end ?? to, { from, to });
        break;
      }
      case 'left2back': {
        const side = end === 'left' || end === 'right' ? end : Math.random() < 0.5 ? 'left' : 'right';
        const to = from === 'back' ? side : 'back';
        turnTo(end ?? to, { from, to });
        break;
      }
      case 'sit':
      case 'sleep':
        restEnding.current = end;
        setRest(row.id);
        break;
      case 'petCat': playElise('petCat', 2800, () => { playCat('happy'); finish(); }); break;
      case 'surprised': playElise('surprised', 1400, finish); break;
      case 'loaf':
        setCatPose(current => current === 'loaf' ? 'sit' : 'loaf');
        finish();
        break;
      default: playCat(row.id, finish);
    }
  }, [actionSettings, perform, playCat, playElise, startWalk, turnTo]);

  const calm = !interacting && !animated && !catWalking && !rest && !act && !catAct && !bubble && pose !== 'sleep';
  useEffect(() => {
    if (!calm) return;
    const rows = actionsForHeading(heading, importedActions);
    const delay = pose === 'sit' ? randomBetween(18_000, 32_000) : randomBetween(8_000, 16_000);
    const id = window.setTimeout(() => {
      const row = chooseAction(rows, actionSettings.chances[heading], Math.random());
      // Disabled imports and explicit seated poses leave their allocated slots idle.
      if (row && (row.source === 'built-in' || !disabledActions.includes(row.id)) &&
        (pose !== 'sit' || row.source === 'built-in' && CAT_ACTIVITIES.includes(row.id))) {
        runAction(row, heading);
      }
      setActivityRound(round => round + 1);
    }, delay);
    return () => window.clearTimeout(id);
  }, [activityRound, calm, pose, heading, actionSettings.chances, disabledActions, importedActions, runAction]);

  function poke() {
    if (act === 'petCat') return;
    stopWalk('front');
    setRest(null);
    resetActs();
    if (pose === 'sleep') {
      setPose('idle');
      setCatPose('sit');
      say('嗯…？我醒了…', 'question');
      if (actionSettings.endings.front.sleep) turnTo(actionSettings.endings.front.sleep);
      return;
    }
    playElise('surprised', 1400, () => {
      if (actionSettings.endings.front.surprised) turnTo(actionSettings.endings.front.surprised);
    });
    playCat('surprised');
    say(pick(POKE_LINES), 'exclamation', 2200);
  }

  function petCat() {
    stopWalk('front');
    setRest(null);
    resetActs();
    setPose('idle');
    setCatPose('sit');
    say('乖～乖～', 'heart', 3000);
    playElise('petCat', 3200, () => {
      playCat('happy');
      if (actionSettings.endings.front.petCat) turnTo(actionSettings.endings.front.petCat);
    });
  }

  function toggleWalking() {
    resetActs();
    setRest(null);
    setPose('idle');
    setCatPose('sit');
    if (walking) {
      stopWalk('finish-walk');
    } else {
      void startWalk(undefined, { ending: actionSettings.endings[heading].walk });
      say('我們出發吧～', 'paw_print', 2000);
    }
  }

  function toggleSit() {
    stopWalk('front');
    setRest(null);
    resetActs();
    setPose(pose === 'sit' ? 'idle' : 'sit');
    setCatPose(current => (current === 'sleep' ? 'sit' : current));
    if (pose === 'sit' && actionSettings.endings.front.sit) turnTo(actionSettings.endings.front.sit);
  }

  function toggleSleep() {
    stopWalk('front');
    setRest(null);
    resetActs();
    const sleeping = pose !== 'sleep';
    setPose(sleeping ? 'sleep' : 'idle');
    setCatPose(sleeping ? 'sleep' : 'sit');
    if (sleeping) say('晚安…', 'sleep_zzz', 2400);
    else {
      say('早安～睡得好飽。', 'sparkles', 2400);
      if (actionSettings.endings.front.sleep) turnTo(actionSettings.endings.front.sleep);
    }
  }

  function catTrick(trick: CatAct) {
    if (walking) return;
    if (act === 'petCat') resetActs();
    setCatPose(current => (current === 'sleep' && pose !== 'sleep' ? 'sit' : current));
    playCat(trick, () => {
      const ending = actionSettings.endings[heading][trick];
      if (ending && pose === 'idle') turnTo(ending);
    });
  }

  function toggleLoaf() {
    if (walking) return;
    cancel('cat');
    setCatAct(null);
    setCatPose(current => (current === 'loaf' ? 'sit' : 'loaf'));
    const ending = actionSettings.endings[heading].loaf;
    if (ending && pose === 'idle') turnTo(ending);
  }

  async function sendMessage(text: string) {
    if (requestPending.current) return false;
    if (!isTauri()) {
      setChatError('請在 Elise 桌面版使用 DeepSeek 聊天。');
      return false;
    }

    const outgoing: Message = { id: nextId++, from: 'you', text };
    const context = [...messages.slice(1).slice(-24), outgoing].map(message => ({
      role: message.from === 'you' ? 'user' : 'assistant',
      content: message.text,
    }));
    requestPending.current = true;
    setChatError('');
    setMessages(previous => [...previous, outgoing]);
    setTyping(true);
    try {
      const reply = await invoke<string>('deepseek_chat', { ...preferences, messages: context });
      const incoming: Message = { id: nextId++, from: 'elise', text: reply };
      setMessages(previous => [...previous, incoming]);
      return true;
    } catch (error) {
      setMessages(previous => previous.filter(message => message.id !== outgoing.id));
      setChatError(typeof error === 'string' ? error : '無法取得 DeepSeek 回覆，請再試一次。');
      return false;
    } finally {
      requestPending.current = false;
      setTyping(false);
    }
  }

  function openDeepSeek() {
    setMenu(false);
    setDeepSeekOpen(true);
  }

  function openActions() {
    setMenu(false);
    setActionsOpen(true);
  }

  function toggleImportedAction(id: string, enabled: boolean) {
    const next = enabled ? disabledActions.filter(item => item !== id) : [...disabledActions, id];
    saveDisabledActions(next);
    setDisabledActions(next);
  }

  function previewAction(action: ActionRow, from: Heading) {
    stopWalk(action.source === 'built-in' && ['stand', 'sit', 'sleep', 'petCat', 'surprised'].includes(action.id)
      ? 'front' : 'keep');
    resetActs();
    setRest(null);
    setPose('idle');
    setCatPose(current => current === 'sleep' ? 'sit' : current);
    setActionsOpen(false);
    runAction(action, from, true);
  }

  function updateActionSettings(next: ActionSettings) {
    saveActionSettings(next);
    setActionSettings(next);
  }

  function updateSizes(next: PetSizes) {
    scale.current = next.eliseSize;
    setSizes(next);
    storePetSizes(next);
  }

  function pressElise(event: ReactMouseEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    gestureCleanup.current?.();
    setPressingElise(true);
    setMenu(false);
    const startX = event.screenX;
    const startY = event.screenY;
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', cleanup);
      gestureCleanup.current = null;
      setPressingElise(false);
    };
    const onMove = (move: MouseEvent) => {
      if (Math.hypot(move.screenX - startX, move.screenY - startY) < DRAG_THRESHOLD) return;
      cleanup();
      // Dragging and walking both move the window; dragging wins.
      stopWalk();
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
    window.addEventListener('blur', cleanup);
    gestureCleanup.current = cleanup;
  }

  function openMenu(event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!deepSeekOpen && !actionsOpen) setMenu(true);
  }

  function choose(action: () => void) {
    return () => {
      setMenu(false);
      action();
    };
  }

  const mood: Expression =
    act === 'surprised' ? 'surprised'
      : act === 'petCat' || walking ? 'happy'
        : pose === 'sleep' ? 'sleepy'
          : pose === 'sit' ? 'shy'
            : typing ? 'speaking' : 'neutral';

  const status =
    walking ? (walker.paused ? '散步暫停中' : walker.phase === 'turn' ? '先轉個身…' : '和小貓散步中…')
      : walker.phase === 'look' ? '正在四處看看…'
        : walker.phase === 'perform' ? '正在做動作…'
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

  const stillPose = act ?? pose;
  const facingStill = stillPose === 'idle' && heading !== 'front' ? HEADING_STILLS[heading] : null;
  const layout = animated || act ? 'idle' : pose;
  const catState = catWalking ? 'walk' : catAct ?? (pose === 'sleep' ? 'sleep' : catPose);
  const catHidden = act === 'petCat';
  const pivot = layout === 'sleep' ? 42 : SCALE_PIVOT_HEIGHT;
  const catCenterOffset = layout === 'sleep' ? 147.5 : 91.5;
  const rightmostCatPixel = STAGE_WIDTH / 2 + (catCenterOffset + CAT_ART_RADIUS * sizes.catSize) * sizes.eliseSize;
  const shiftLeft = Math.max(0, rightmostCatPixel - (STAGE_WIDTH - 8));
  const menuBottom = pivot + (HEAD_HEIGHT[layout] - pivot) * sizes.eliseSize + 12;
  const bubbleStyle = {
    bottom: pivot + (BUBBLE_HEIGHT[layout] - pivot) * sizes.eliseSize,
    left: STAGE_WIDTH / 2 - shiftLeft - (layout === 'sleep' ? 30 * sizes.eliseSize : 0),
  };
  const petStyle = {
    left: 65 - shiftLeft,
    '--elise-scale': sizes.eliseSize,
    '--cat-scale': sizes.catSize,
  } as CSSProperties;

  return (
    <main
      className="desktop"
      onMouseDown={event => {
        if (!(event.target as Element).closest('.pet-menu')) setMenu(false);
      }}
    >
      <div className="stage" ref={stageRef} style={{ width: STAGE_WIDTH }}>
        {deepSeekOpen && (
          <DeepSeekPanel preferences={preferences} onPreferences={setPreferences}
            onClose={() => setDeepSeekOpen(false)} />
        )}
        {actionsOpen && (
          <ActionPanel actions={importedActions} disabled={disabledActions} loading={actionsLoading}
            storageError={actionStorageError} settings={actionSettings} onSettings={updateActionSettings}
            onAdd={action => setImportedActions(current => current.some(item => item.id === action.id)
              ? current : [...current, action])}
            onToggle={toggleImportedAction} onPreview={previewAction} onClose={() => setActionsOpen(false)} />
        )}
        {chatOpen && (
          <div hidden={deepSeekOpen || actionsOpen}>
            <ChatPanel
              messages={messages}
              typing={typing}
              mood={mood}
              model={MODELS[preferences.model]}
              error={chatError}
              active={!deepSeekOpen && !actionsOpen}
              onSettings={openDeepSeek}
              onSend={sendMessage}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}

        {bubble && !chatOpen && !menu && !deepSeekOpen && !actionsOpen && (
          <div className="bubble" style={bubbleStyle} key={bubble.id} role="status">
            {bubble.icon && <Icon name={bubble.icon} size={18} />}
            <span>{bubble.text}</span>
          </div>
        )}

        <div className={`pet-group pose-${layout} ${walking ? 'walking' : ''}`} style={petStyle}>
          <div className="elise-shell">
            <button
              className={`character ${walking ? 'walk' : act ?? pose}`}
              data-heading={heading}
              onMouseDown={pressElise}
              onContextMenu={openMenu}
              title="點一下戳戳 Elise · 按住拖動 · 右鍵開啟選單"
              aria-label="Elise：點擊互動，按住拖動，右鍵開啟選單"
            >
              {animated ? (
                <img className={`elise-cycle ${walker.phase === 'walk' ? 'walk-sprite' : 'turn-sprite'}`}
                  ref={walker.spriteRef} crossOrigin="anonymous" src={ELISE_FRAMES.front2left[0]} alt="Elise" draggable={false} />
              ) : stillPose === 'stand' ? (
                <EliseStanding fps={actionSettings.fps.stand ?? 10} onComplete={finishStanding} />
              ) : (
                <img key={stillPose} src={facingStill?.source ?? eliseImages[stillPose]}
                  style={facingStill ? { transform: `translateY(${facingStill.footOffset}px) scaleX(${facingStill.mirrored ? -1 : 1})` } : undefined}
                  alt="Elise Q 版角色" draggable={false} />
              )}
              {!walking && pose === 'sleep' && !act && <span className="zzz" aria-hidden="true">Z<small>z</small><small>z</small></span>}
            </button>
          </div>

          <button
            ref={catRef}
            className={`cat ${catState} ${catHidden ? 'hidden' : ''}`}
            onClick={() => {
              if (catHidden) return;
              stopWalk();
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
              src={catWalking ? CAT_WALK_IMAGES[0] : catImages[catState as CatPose | CatAct]}
              alt="灰白貓咪"
              draggable={false}
            />
          </button>
        </div>

        {menu && (
          <PetMenu
            bottom={menuBottom}
            status={status}
            mood={mood}
            sections={sections}
            onClose={() => setMenu(false)}
            sizes={sizes}
            onSizes={updateSizes}
            onActions={openActions}
            onDeepSeek={openDeepSeek}
            onExit={choose(() => { void getCurrentWindow().close(); })}
          />
        )}
      </div>
    </main>
  );
}
