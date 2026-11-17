import { useState, type FormEvent, type MouseEvent } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

type Message = { from: 'elise' | 'you'; text: string };
type ElisePose = 'idle' | 'sit' | 'sleep';
type CatPose = 'sit' | 'happy' | 'sleep' | 'stretch';

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

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message) return;
    setMessages(previous => [
      ...previous,
      { from: 'you', text: message },
      { from: 'elise', text: '我聽到了～目前還是本地示範回覆，接下來會加入真正的 AI API。' },
    ]);
    setInput('');
  }

  async function startDrag(event: MouseEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    try {
      await getCurrentWindow().startDragging();
    } catch {
      // In a browser preview, native window dragging is not available.
    }
  }

  function petCat() {
    setCatPose(previous => previous === 'happy' ? 'sit' : 'happy');
    setMessages(previous => [
      ...previous,
      { from: 'elise', text: '小貓很喜歡你摸摸牠～ 🐱' },
    ]);
  }

  return (
    <main className="desktop">
      <div className="toolbar">
        <button className="grip" onMouseDown={startDrag} title="拖動視窗">⠿ 拖動</button>
        <button onClick={() => { setPose(current => current === 'sleep' ? 'idle' : 'sleep'); setCatPose(current => current === 'sleep' ? 'sit' : 'sleep'); }} title="切換睡眠">☾</button>
        <button onClick={() => setPose(current => current === 'sit' ? 'idle' : 'sit')} title="坐下 / 站立">♧</button>
        <button onClick={() => setChatOpen(open => !open)} title="聊天">☏</button>
        <button onClick={() => getCurrentWindow().close()} title="退出">×</button>
      </div>

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

      <button
        className={`character ${pose}`}
        onClick={() => setChatOpen(open => !open)}
        title="點擊 Elise 開啟聊天"
        aria-label="Elise"
      >
        <img src={eliseImages[pose]} alt="Elise Q 版角色" draggable={false} />
        {pose === 'sleep' && <span className="zzz">Zzz</span>}
      </button>

      <button
        className={`cat ${catPose}`}
        onClick={petCat}
        onContextMenu={event => { event.preventDefault(); setCatPose(current => current === 'stretch' ? 'sit' : 'stretch'); }}
        title="左鍵摸貓，右鍵伸懶腰"
        aria-label="灰白貓咪"
      >
        <img src={catImages[catPose]} alt="灰白貓咪" draggable={false} />
      </button>
    </main>
  );
}
