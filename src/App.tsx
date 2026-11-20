import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { cursorPosition, getCurrentWindow, type Monitor } from '@tauri-apps/api/window';
import { ELISE_FRAMES, PRELOAD, type Expression } from './assets';
import { ChatPanel, type Message } from './ChatPanel';
import { CharacterProfile } from './CharacterProfile';
import character from './characterProfile.json';
import { ActionPanel } from './ActionPanel';
import { deleteImportedAction, loadActionLibrary, loadDisabledActions, saveDisabledActions, type ImportedAction } from './actionLibrary';
import { actionsForHeading, chooseAction, isWalkingAction, loadActionSettings, saveActionSettings, STANDBY_FPS, WALK_ACTIVITY, withoutAction, type ActionRow, type ActionSettings } from './actionSettings';
import { DeepSeekPanel } from './DeepSeekPanel';
import { EliseStandby } from './EliseStandby';
import { loadPreferences, MODELS } from './deepseekPreferences';
import { Icon } from './Icon';
import { PetMenu, type MenuSection } from './PetMenu';
import { loadPetSizes, storePetSizes, type PetSizes } from './petSizes';
import { HEADING_STILLS, type Heading } from './eliseTurns';
import { useClickThrough } from './useClickThrough';
import { useWalker, type ConfiguredWalkAction } from './useWalker';
import { STAGE_WIDTH, usePetDisplay } from './usePetDisplay';

type Bubble = { id: number; text: string; icon?: string };

const DRAG_THRESHOLD = 4;
const HEAD_HEIGHT = 266;
const BUBBLE_HEIGHT = 284;
const SCALE_PIVOT_HEIGHT = 34;
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
let nextId = 1;

export function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [deepSeekOpen, setDeepSeekOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [importedActions, setImportedActions] = useState<ImportedAction[]>([]);
  const [disabledActions, setDisabledActions] = useState(loadDisabledActions);
  const [actionSettings, setActionSettings] = useState(loadActionSettings);
  const [actionsLoading, setActionsLoading] = useState(isTauri);
  const [actionStorageError, setActionStorageError] = useState('');
  const [preferences, setPreferences] = useState(loadPreferences);
  const [sizes, setSizes] = useState(loadPetSizes);
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: nextId++, from: 'elise', text: `你好，我是${character.name}。叫我雫就好。今天過得還好嗎？` },
  ]);
  const [typing, setTyping] = useState(false);
  const [chatError, setChatError] = useState('');
  const [menu, setMenu] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [pressingElise, setPressingElise] = useState(false);
  const [activityRound, setActivityRound] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLImageElement>(null);
  const timers = useRef<Record<string, number>>({});
  const scale = useRef(sizes.eliseSize);
  const monitor = useRef<Monitor | null>(null);
  const requestPending = useRef(false);
  const gestureCleanup = useRef<(() => void) | null>(null);
  const actionFps = useRef(actionSettings.fps);
  const walkActions = useRef<readonly ConfiguredWalkAction[]>([]);
  const walker = useWalker({ stage: stageRef, sprite: spriteRef, scale, monitor, walkActions, actionFps });
  const { start: startWalk, stop: stopWalk, setPaused, turnTo, perform, heading } = walker;
  const stopMovement = useCallback(() => {
    gestureCleanup.current?.();
    stopWalk();
  }, [stopWalk]);
  const display = usePetDisplay(monitor, scale, stopMovement);
  const animated = walker.phase !== 'off';
  const walking = walker.phase === 'walk' || walker.phase === 'turn';
  const modalOpen = deepSeekOpen || actionsOpen || profileOpen;
  const interacting = menu || chatOpen || modalOpen || pressingElise;
  const configuredImports = useMemo(() => importedActions.map(action => ({
    ...action, kind: actionSettings.kinds[action.id] ?? action.kind,
  })), [importedActions, actionSettings.kinds]);

  useEffect(() => { setPaused(interacting); }, [interacting, setPaused]);
  useEffect(() => {
    actionFps.current = actionSettings.fps;
    walkActions.current = configuredImports
      .filter(action => action.frameCount >= 2 && action.kind === 'walk' && !disabledActions.includes(action.id))
      .map(action => ({ ...action, fps: actionSettings.fps[action.id] ?? action.fps,
        ending: actionSettings.endings[action.heading][action.id] }));
  }, [configuredImports, disabledActions, actionSettings.fps, actionSettings.endings]);

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

  const runAction = useCallback((row: ActionRow, from: Heading) => {
    const end = actionSettings.endings[from][row.id];
    if (row.source === 'imported') {
      const action = { ...row.action, fps: actionSettings.fps[row.id] ?? row.action.fps };
      // The imported artwork itself ends in the configured orientation.
      perform(action, end ?? action.heading);
      return;
    }
    switch (row.id) {
      case 'stand':
      case 'standby':
        perform({ frames: ELISE_FRAMES[row.id], heading: 'front', fps: actionSettings.fps[row.id] ?? row.defaultFps },
          end ?? 'front', 'front');
        break;
      case 'walk':
        void startWalk(randomBetween(75, 390), {
          ending: end, preferred: from === 'left' || from === 'right' ? from : undefined, builtIn: true,
        });
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
    }
  }, [actionSettings, perform, startWalk, turnTo]);

  const calm = !interacting && !animated && !bubble;
  useEffect(() => {
    if (!calm) return;
    const rows = actionsForHeading(heading, configuredImports).filter(row => !isWalkingAction(row));
    const walkChance = WALK_ACTIVITY[actionSettings.walkActivity].chance / 100;
    const delay = randomBetween(8_000, 16_000);
    const id = window.setTimeout(() => {
      const row = chooseAction(rows, actionSettings.chances[heading], Math.random());
      if (row?.source === 'built-in' && row.id === 'stand') {
        runAction(row, heading);
      } else if (Math.random() < walkChance) {
        void startWalk(randomBetween(75, 390), { ending: actionSettings.endings[heading].walk });
      } else if (row && (row.source === 'built-in' || !disabledActions.includes(row.id))) {
        runAction(row, heading);
      }
      setActivityRound(round => round + 1);
    }, delay);
    return () => window.clearTimeout(id);
  }, [activityRound, calm, heading, actionSettings.chances, actionSettings.endings, actionSettings.walkActivity,
    disabledActions, configuredImports, runAction, startWalk]);

  function toggleWalking() {
    if (walking) {
      stopWalk('finish-walk');
    } else {
      stopWalk();
      void startWalk(undefined, { ending: actionSettings.endings[heading].walk });
      say('出發散步吧～', 'play', 2000);
    }
  }

  async function sendMessage(text: string) {
    if (requestPending.current) return false;
    if (!isTauri()) {
      setChatError('請在桌面版使用 DeepSeek 聊天。');
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
    stopWalk();
    setActionsOpen(false);
    runAction(action, from);
  }

  function updateActionSettings(next: ActionSettings) {
    saveActionSettings(next);
    setActionSettings(next);
  }

  async function removeAction(action: ImportedAction) {
    await deleteImportedAction(action);
    setImportedActions(current => current.filter(item => item.id !== action.id));
    const settings = withoutAction(actionSettings, action);
    const disabled = disabledActions.filter(id => id !== action.id);
    setActionSettings(settings);
    setDisabledActions(disabled);
    try {
      saveActionSettings(settings);
      saveDisabledActions(disabled);
    } catch {
      setActionStorageError('動作已刪除，但無法儲存本機動作設定。');
    }
  }

  function updateSizes(next: PetSizes) {
    scale.current = next.eliseSize;
    setSizes(next);
    storePetSizes(next);
    const selected = monitor.current;
    if (selected) {
      void getCurrentWindow().outerPosition().then(origin => {
        if (monitor.current === selected && scale.current === next.eliseSize) {
          return display.movePet(selected, origin.x, display.petTop(selected, origin.y));
        }
      }).catch(() => undefined);
    }
  }

  function pressElise(event: ReactPointerEvent<HTMLButtonElement>) {
    const selected = monitor.current;
    if (event.button !== 0 || !event.isPrimary || !selected) return;
    event.preventDefault();
    gestureCleanup.current?.();
    setPressingElise(true);
    setMenu(false);
    const target = event.currentTarget;
    const pointer = event.pointerId;
    const { screenX, screenY, clientX, clientY } = event;
    const grabX = clientX * selected.scaleFactor;
    const grabFromPetTop = clientY * selected.scaleFactor - display.petTop(selected, 0);
    let dragging = false;
    let moving = false;
    let pending = false;
    let active = true;
    target.setPointerCapture(pointer);

    const cleanup = () => {
      active = false;
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('lostpointercapture', cleanup);
      window.removeEventListener('blur', cleanup);
      if (target.hasPointerCapture(pointer)) target.releasePointerCapture(pointer);
      gestureCleanup.current = null;
      setPressingElise(false);
    };
    const moveToCursor = async () => {
      if (moving) return;
      moving = true;
      try {
        while (active && pending) {
          pending = false;
          const cursor = await cursorPosition();
          if (active) await display.movePet(selected, cursor.x - grabX, cursor.y - grabFromPetTop);
        }
      } catch {
        cleanup();
      } finally {
        moving = false;
      }
    };
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== pointer) return;
      if (!dragging) {
        if (Math.hypot(move.screenX - screenX, move.screenY - screenY) < DRAG_THRESHOLD) return;
        dragging = true;
        stopWalk();
      }
      pending = true;
      void moveToCursor();
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('lostpointercapture', cleanup);
    window.addEventListener('blur', cleanup);
    gestureCleanup.current = cleanup;
  }

  function openMenu(event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!modalOpen) setMenu(true);
  }

  function choose(action: () => void) {
    return () => {
      setMenu(false);
      action();
    };
  }

  const mood: Expression = walking ? 'happy' : typing ? 'speaking' : 'neutral';

  const status =
    walking ? (walker.paused ? '散步暫停中' : walker.phase === 'turn' ? '先轉個身…' : '散步中…')
      : walker.phase === 'look' ? '正在四處看看…'
        : walker.phase === 'perform' ? '正在做動作…'
          : '陪在你身邊';

  const sections: MenuSection[] = [
    {
      title: character.name,
      items: [
        { id: 'chat', label: '聊天', icon: 'chat_heart', active: chatOpen, onSelect: choose(() => setChatOpen(true)) },
        { id: 'walk', label: walking ? '停下' : '散步', icon: walking ? 'pause' : 'play', active: walking, onSelect: choose(toggleWalking) },
        { id: 'profile', label: '角色設定檔', icon: 'bookmark', onSelect: choose(() => setProfileOpen(true)) },
      ],
    },
  ];

  const facingStill = heading !== 'front' ? HEADING_STILLS[heading] : null;
  const pivot = SCALE_PIVOT_HEIGHT;
  const menuBottom = pivot + (HEAD_HEIGHT - pivot) * sizes.eliseSize + 12 - display.offset;
  const bubbleStyle = {
    bottom: `min(${pivot + (BUBBLE_HEIGHT - pivot) * sizes.eliseSize - display.offset}px, max(8px, calc(100% - 85px)))`,
    left: STAGE_WIDTH / 2,
  };
  const petStyle = {
    '--elise-scale': sizes.eliseSize,
    '--pet-offset': `${display.offset}px`,
  } as CSSProperties;

  return (
    <main
      className="desktop"
      onMouseDown={event => {
        if (!(event.target as Element).closest('.pet-menu')) setMenu(false);
      }}
    >
      <div className="stage" ref={stageRef} style={{ width: STAGE_WIDTH }}>
        {profileOpen && <CharacterProfile onClose={() => setProfileOpen(false)} />}
        {deepSeekOpen && (
          <DeepSeekPanel preferences={preferences} onPreferences={setPreferences}
            onClose={() => setDeepSeekOpen(false)} />
        )}
        {actionsOpen && (
          <ActionPanel actions={configuredImports} disabled={disabledActions} loading={actionsLoading}
            storageError={actionStorageError} settings={actionSettings} onSettings={updateActionSettings}
            onAdd={action => setImportedActions(current => current.some(item => item.id === action.id)
              ? current : [...current, action])}
            onToggle={toggleImportedAction} onDelete={removeAction} onPreview={previewAction} onClose={() => setActionsOpen(false)} />
        )}
        {chatOpen && (
          <div hidden={modalOpen}>
            <ChatPanel
              messages={messages}
              typing={typing}
              mood={mood}
              model={MODELS[preferences.model]}
              error={chatError}
              active={!modalOpen}
              onSettings={openDeepSeek}
              onSend={sendMessage}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}

        {bubble && !chatOpen && !menu && !modalOpen && (
          <div className="bubble" style={bubbleStyle} key={bubble.id} role="status">
            {bubble.icon && <Icon name={bubble.icon} size={18} />}
            <span>{bubble.text}</span>
          </div>
        )}

        <div className="pet-group" style={petStyle}>
          <button
            className={`character ${walking ? 'walk' : walker.phase}`}
            data-heading={heading}
            onPointerDown={pressElise}
            onContextMenu={openMenu}
            title="按住拖動 · 右鍵開啟選單"
            aria-label={`${character.name}，按住拖動，右鍵開啟選單`}
          >
            {animated ? (
              <img className={`elise-cycle ${walker.phase === 'walk' ? 'walk-sprite' : 'turn-sprite'}`}
                ref={walker.spriteRef} crossOrigin="anonymous" src={ELISE_FRAMES.front2left[0]} alt={character.name} draggable={false} />
            ) : facingStill ? (
              <img src={facingStill.source} style={facingStill.mirrored ? { transform: 'scaleX(-1)' } : undefined}
                alt={character.name} draggable={false} />
            ) : (
              <EliseStandby fps={actionSettings.fps.standby ?? STANDBY_FPS} />
            )}
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
            display={display}
            onActions={openActions}
            onDeepSeek={openDeepSeek}
            onExit={choose(() => { void getCurrentWindow().close(); })}
          />
        )}
      </div>
    </main>
  );
}
