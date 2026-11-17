import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { OptionCCharacter } from './components/OptionCCharacter';

type Message = { from: 'elise' | 'you'; text: string };
type ElisePose = 'idle' | 'sit' | 'sleep';
type CatPose = 'sit' | 'happy' | 'sleep' | 'stretch';
type CompanionMode = 'cat' | 'costume';
type MenuPosition = { x: number; y: number };

const eliseImages: Record<ElisePose, string> = {
  idle: '/assets/elise/poses/idle_front.png',
  sit: '/assets/elise/poses/sit_shy.png',
  sleep: '/assets/elise/poses/sleep.png',
};
const catImages: Record<CatPose, string> = {
  sit: '/assets/cat/poses/sit_neutral.png',
  happy: '/assets/cat/poses/sit_happy.png',
  sleep: '/assets/cat/poses/sleep.png',
  stretch: '/assets/cat/poses/stretch.png',
};

export function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { from: 'elise', text: '你好，我是 Elise。今天也和小貓一起陪著你。🐾' },
  ]);
  const [input, setInput] = useState('');
  const [pose, setPose] = useState<ElisePose>('idle');
  const [catPose, setCatPose] = useState<CatPose>('sit');
  const [companionMode, setCompanionMode] = useState<CompanionMode>('cat');
  const [menu, setMenu] = useState<MenuPosition | null>(null);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setMessages(previous => [
      ...previous,
      { from: 'you', text: value },
      { from: 'elise', text: '我聽到了～目前還是本地示範回覆，接下來會加入真正的 AI API。' },
    ]);
    setInput('');
  }

  async function dragElise(event: MouseEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    setMenu(null);
    try {
      await getCurrentWindow().startDragging();
    } catch {
      // Browser-only preview does not support native window dragging.
    }
  }

  function openMenu(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    const menuWidth = 178;
    const menuHeight = 260;
    setMenu({
      x: Math.max(8, Math.min(event.clientX - bounds.left, bounds.width - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY - bounds.top, bounds.height - menuHeight - 8)),
    });
  }

  function withMenuClosed(action: () => void) {
    setMenu(null);
    action();
  }

  function toggleCompanionMode() {
    const next: CompanionMode = companionMode === 'cat' ? 'costume' : 'cat';
    setCompanionMode(next);
    setPose('idle'); // Option C currently has only a registered front idle artwork.
    setCatPose('sit');
    setMessages(previous => [
      ...previous,
      {
        from: 'elise',
        text: next === 'costume'
          ? '小貓變成我的貓耳帽和尾巴啦……喵？'
          : '貓咪回來了！又可以摸摸牠了。🐾',
      },
    ]);
  }

  function toggleSleep() {
    const sleeping = pose !== 'sleep';
    setPose(sleeping ? 'sleep' : 'idle');
    if (companionMode === 'cat') setCatPose(sleeping ? 'sleep' : 'sit');
  }

  function petCat() {
    setMenu(null);
    setCatPose(previous => previous === 'happy' ? 'sit' : 'happy');
    setMessages(previous => [
      ...previous,
      { from: 'elise', text: '小貓很喜歡你摸摸牠～ 🐱' },
    ]);
  }

  return (
    <main
      className="desktop"
      onMouseDown={event => {
        if (!(event.target as Element).closest('.pet-menu')) setMenu(null);
      }}
    >
      <div className={`elise-shell mode-${companionMode} pose-${pose}`}>
        <button
          className={`character ${pose}`}
          onMouseDown={dragElise}
          onContextMenu={openMenu}
          title="左鍵拖動 Elise · 右鍵開啟選單"
          aria-label="Elise：左鍵拖動，右鍵開啟選單"
        >
          {companionMode === 'costume' ? (
            <OptionCCharacter />
          ) : (
            <img src={eliseImages[pose]} alt="Elise Q 版角色" draggable={false} />
          )}
          {companionMode === 'cat' && pose === 'sleep' && <span className="zzz">Zzz</span>}
        </button>
      </div>

      {companionMode === 'cat' && (
        <button
          className={`cat ${catPose}`}
          onClick={petCat}
          onContextMenu={event => {
            event.preventDefault();
            setCatPose(current => current === 'stretch' ? 'sit' : 'stretch');
          }}
          title="左鍵摸貓，右鍵伸懶腰"
          aria-label="灰白貓咪"
        >
          <img src={catImages[catPose]} alt="灰白貓咪" draggable={false} />
        </button>
      )}

      {menu && (
        <div
          className="pet-menu"
          role="menu"
          aria-label="Elise 選單"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={event => event.preventDefault()}
        >
          <div className="menu-title">Elise ♡</div>
          <button role="menuitem" onClick={() => withMenuClosed(() => setChatOpen(true))}>
            <span>💬</span> 開啟聊天
          </button>
          <button role="menuitem" onClick={() => withMenuClosed(toggleCompanionMode)}>
            <span>🐱</span> {companionMode === 'cat' ? '變身貓娘' : '解除貓咪套裝'}
          </button>
          <button
            role="menuitem"
            disabled={companionMode === 'costume'}
            title={companionMode === 'costume' ? '方案 C 的坐姿分層素材尚未完成' : undefined}
            onClick={() => withMenuClosed(() => setPose(current => current === 'sit' ? 'idle' : 'sit'))}
          >
            <span>🌸</span> {pose === 'sit' ? '站起來' : '坐下'}
          </button>
          <button
            role="menuitem"
            disabled={companionMode === 'costume'}
            title={companionMode === 'costume' ? '方案 C 的睡姿分層素材尚未完成' : undefined}
            onClick={() => withMenuClosed(toggleSleep)}
          >
            <span>🌙</span> {pose === 'sleep' ? '醒來' : '睡覺'}
          </button>
          <div className="menu-divider" />
          <button role="menuitem" className="menu-exit" onClick={() => withMenuClosed(() => { void getCurrentWindow().close(); })}>
            <span>×</span> 退出桌寵
          </button>
        </div>
      )}

      {chatOpen && (
        <section className="chat">
          <header>
            <span>Elise · 對話</span>
            <button aria-label="關閉聊天" onClick={() => setChatOpen(false)}>×</button>
          </header>
          <div className="log" aria-live="polite">
            {messages.map((message, index) => (
              <p className={message.from} key={index}>{message.text}</p>
            ))}
          </div>
          <form onSubmit={send}>
            <input
              aria-label="輸入訊息"
              placeholder="跟 Elise 說點什麼…"
              value={input}
              onChange={event => setInput(event.target.value)}
            />
            <button type="submit">送出</button>
          </form>
        </section>
      )}
    </main>
  );
}
