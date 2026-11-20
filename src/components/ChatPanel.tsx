import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AVATAR } from '../lib/assets';
import { Icon } from './Icon';
import character from '../../character/profile.json';

export type Message = { id: number; from: 'shizuku' | 'you'; text: string };

type Props = {
  messages: Message[];
  typing: boolean;
  model: string;
  error: string;
  active: boolean;
  onSend: (text: string) => Promise<boolean>;
  onSettings: () => void;
  onClose: () => void;
};

export function ChatPanel({ messages, typing, model, error, active, onSend, onSettings, onClose }: Props) {
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (active) inputRef.current?.focus({ preventScroll: true }); }, [active]);
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, typing, error, active]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value || typing) return;
    setInput('');
    if (!await onSend(value)) setInput(draft => draft || value);
  }

  return (
    <section className="chat" aria-label={`與${character.name}對話`} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <header>
        <span className="avatar" style={{ backgroundImage: `url(${AVATAR})` }} />
        <div className="chat-title">
          <strong>{character.name}</strong>
          <span>{typing ? 'DeepSeek 回覆中…' : model}</span>
        </div>
        <button type="button" className="icon-button" aria-label="DeepSeek API 管理" onClick={onSettings}>
          <Icon name="settings" size={16} />
        </button>
        <button type="button" className="icon-button" aria-label="關閉聊天" onClick={onClose}>
          <Icon name="close" size={12} />
        </button>
      </header>

      <div className="log" ref={logRef} aria-live="polite">
        {messages.map(message => (
          <p className={message.from} key={message.id}>{message.text}</p>
        ))}
        {typing && (
          <p className="shizuku typing" aria-label={`${character.name}正在輸入`}>
            <span /><span /><span />
          </p>
        )}
        {error && <p className="chat-error" role="alert">{error}</p>}
      </div>

      <form onSubmit={submit}>
        <input
          ref={inputRef}
          aria-label="輸入訊息"
          placeholder={`跟${character.name}說點什麼…`}
          value={input}
          maxLength={2000}
          onChange={event => setInput(event.target.value)}
        />
        <button type="submit" aria-label="送出" disabled={typing || !input.trim()}>
          <Icon name="chat_heart" size={20} />
        </button>
      </form>
    </section>
  );
}
