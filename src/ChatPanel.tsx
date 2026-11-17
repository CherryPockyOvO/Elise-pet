import { useEffect, useRef, useState, type FormEvent } from 'react';
import { expression, type Expression } from './assets';
import { Icon } from './Icon';

export type Message = { id: number; from: 'elise' | 'you'; text: string };

type Props = {
  messages: Message[];
  typing: boolean;
  mood: Expression;
  onSend: (text: string) => void;
  onClose: () => void;
};

export function ChatPanel({ messages, typing, mood, onSend, onClose }: Props) {
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, typing]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    onSend(value);
    setInput('');
  }

  return (
    <section className="chat" aria-label="與 Elise 對話" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <header>
        <span className="avatar" style={{ backgroundImage: `url(${expression(typing ? 'thinking' : mood)})` }} />
        <div className="chat-title">
          <strong>Elise</strong>
          <span>{typing ? '正在輸入…' : '本地示範 · 尚未接上 AI'}</span>
        </div>
        <button type="button" className="icon-button" aria-label="關閉聊天" onClick={onClose}>
          <Icon name="close" size={12} />
        </button>
      </header>

      <div className="log" ref={logRef} aria-live="polite">
        {messages.map(message => (
          <p className={message.from} key={message.id}>{message.text}</p>
        ))}
        {typing && (
          <p className="elise typing" aria-label="Elise 正在輸入">
            <span /><span /><span />
          </p>
        )}
      </div>

      <form onSubmit={submit}>
        <input
          ref={inputRef}
          aria-label="輸入訊息"
          placeholder="跟 Elise 說點什麼…"
          value={input}
          onChange={event => setInput(event.target.value)}
        />
        <button type="submit" aria-label="送出" disabled={!input.trim()}>
          <Icon name="chat_heart" size={20} />
        </button>
      </form>
    </section>
  );
}
