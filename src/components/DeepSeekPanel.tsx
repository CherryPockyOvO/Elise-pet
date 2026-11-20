import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { EFFORTS, MODELS, storePreferences, type Preferences } from '../lib/deepseekPreferences';
import { Icon } from './Icon';

const TABS = [
  { id: 'key', label: 'API Key', icon: 'settings' },
  { id: 'balance', label: '帳戶餘額', icon: 'star' },
  { id: 'model', label: '模型與思考', icon: 'thought_bubble' },
] as const;

type Tab = typeof TABS[number]['id'];
type Balance = {
  is_available: boolean;
  balance_infos: {
    currency: string;
    total_balance: string;
    granted_balance: string;
    topped_up_balance: string;
  }[];
};
type Feedback = { tab: Tab; text: string; error?: boolean };

export function DeepSeekPanel({ preferences: savedPreferences, onPreferences, onClose }: {
  preferences: Preferences;
  onPreferences: (preferences: Preferences) => void;
  onClose: () => void;
}) {
  const native = isTauri();
  const [tab, setTab] = useState<Tab>('key');
  const [savedKey, setSavedKey] = useState<boolean | null>(null);
  const [key, setKey] = useState('');
  const [preferences, setPreferences] = useState(savedPreferences);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [pending, setPending] = useState<'key' | 'balance' | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const firstTab = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstTab.current?.focus({ preventScroll: true });
    if (!native) return;
    let active = true;
    void invoke<boolean>('deepseek_has_key').then(result => {
      if (active) setSavedKey(result);
    }).catch(error => {
      if (active) {
        setSavedKey(false);
        setFeedback({ tab: 'key', text: String(error), error: true });
      }
    });
    return () => { active = false; };
  }, [native]);

  async function updateKey(remove = false) {
    setPending('key');
    setFeedback(null);
    try {
      if (remove) await invoke('deepseek_remove_key');
      else await invoke('deepseek_save_key', { key });
      setSavedKey(!remove);
      setKey('');
      setBalance(null);
      setFeedback({ tab: 'key', text: remove ? '已移除 API Key。' : '已儲存 API Key。' });
    } catch (error) {
      setFeedback({ tab: 'key', text: String(error), error: true });
    } finally {
      setPending(null);
    }
  }

  async function queryBalance() {
    setPending('balance');
    setFeedback(null);
    setBalance(null);
    try {
      setBalance(await invoke<Balance>('deepseek_balance'));
    } catch (error) {
      setFeedback({ tab: 'balance', text: String(error), error: true });
    } finally {
      setPending(null);
    }
  }

  function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      storePreferences(preferences);
      onPreferences(preferences);
      setFeedback({ tab: 'model', text: '已儲存模型設定。' });
    } catch {
      setFeedback({ tab: 'model', text: '無法儲存模型設定。', error: true });
    }
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = TABS.length - 1;
    const destinations: Partial<Record<string, number>> = {
      ArrowLeft: (index + last) % TABS.length,
      ArrowRight: (index + 1) % TABS.length,
      Home: 0,
      End: last,
    };
    const next = destinations[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setTab(TABS[next].id);
    event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus();
  }

  const keyDisabled = !native || savedKey === null || pending !== null;
  const activeFeedback = feedback?.tab === tab ? feedback : null;

  return (
    <section className="deepseek-panel" aria-labelledby="deepseek-title" onKeyDown={event => {
      if (event.key === 'Escape') onClose();
    }}>
      <header className="deepseek-header">
        <span className="deepseek-mark"><Icon name="sparkles" size={24} /></span>
        <h2 id="deepseek-title">DeepSeek API 管理</h2>
        <button type="button" className="icon-button" aria-label="關閉 API 管理" onClick={onClose}>
          <Icon name="close" size={12} />
        </button>
      </header>
      <div className="deepseek-tabs" role="tablist" aria-label="DeepSeek 設定">
        {TABS.map(({ id, label, icon }, index) => (
          <button
            key={id}
            ref={index === 0 ? firstTab : undefined}
            id={`deepseek-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={id === tab}
            aria-controls="deepseek-content"
            tabIndex={id === tab ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={event => navigateTabs(event, index)}
          >
            <Icon name={icon} size={16} />
            {label}
          </button>
        ))}
      </div>
      <div id="deepseek-content" className="deepseek-content" role="tabpanel" aria-labelledby={`deepseek-tab-${tab}`}>
        {tab === 'key' && (
          <form onSubmit={event => {
            event.preventDefault();
            if (!keyDisabled && key.trim()) void updateKey();
          }}>
            <p className={savedKey ? 'deepseek-state ready' : 'deepseek-state'}>
              <Icon name={savedKey ? 'heart' : 'alert'} size={16} />
              {!native ? '請在桌面版管理 API Key。'
                : savedKey ? 'API Key 已儲存在系統憑證中。'
                  : savedKey === null ? '正在讀取系統憑證…' : '尚未儲存 API Key。'}
            </p>
            <label>
              API Key
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={key}
                maxLength={512}
                placeholder={savedKey ? '輸入新的 API Key 以更換' : 'sk-…'}
                onChange={event => setKey(event.target.value)}
                disabled={keyDisabled}
                required
              />
            </label>
            <div className="deepseek-actions">
              <button type="submit" disabled={keyDisabled || !key.trim()}>
                <Icon name="bookmark" size={15} />
                {pending === 'key' ? '處理中…' : '儲存 API Key'}
              </button>
              {savedKey && <button type="button" disabled={keyDisabled} onClick={() => void updateKey(true)}>移除</button>}
            </div>
          </form>
        )}
        {tab === 'balance' && (
          <div className="deepseek-balance">
            <div className="deepseek-actions balance-actions">
              <span className="deepseek-hint">即時查詢 API 帳戶</span>
              <button type="button" disabled={keyDisabled || !savedKey} onClick={() => void queryBalance()}>
                <Icon name="refresh" size={15} />
                {pending === 'balance' ? '查詢中…' : '查詢餘額'}
              </button>
            </div>
            {!savedKey && <p className="deepseek-hint">請先在 API Key 分頁儲存金鑰。</p>}
            {balance && (
              <div className="deepseek-balances" aria-live="polite">
                <p className={balance.is_available ? 'deepseek-state ready' : 'deepseek-state'}>
                  <Icon name={balance.is_available ? 'star' : 'alert'} size={16} />
                  {balance.is_available ? '餘額可用於 API 呼叫。' : '餘額不足以呼叫 API。'}
                </p>
                {balance.balance_infos.map(info => (
                  <dl key={info.currency}>
                    <dt>總餘額</dt><dd><strong>{info.total_balance} {info.currency}</strong></dd>
                    <dt>儲值餘額</dt><dd>{info.topped_up_balance}</dd>
                    <dt>贈送餘額</dt><dd>{info.granted_balance}</dd>
                  </dl>
                ))}
                {balance.balance_infos.length === 0 && <p className="deepseek-hint">目前沒有餘額明細。</p>}
              </div>
            )}
          </div>
        )}
        {tab === 'model' && (
          <form onSubmit={savePreferences} onChange={() => setFeedback(null)}>
            <label>
              <span className="deepseek-field"><Icon name="sparkles" size={15} />模型</span>
              <select value={preferences.model} onChange={event => setPreferences({
                ...preferences, model: event.target.value as Preferences['model'],
              })}>
                {Object.entries(MODELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="deepseek-check">
              <input type="checkbox" checked={preferences.thinking} onChange={event => setPreferences({
                ...preferences, thinking: event.target.checked,
              })} />
              啟用思考模式
            </label>
            <label>
              <span className="deepseek-field"><Icon name="thought_bubble" size={15} />思考力度</span>
              <select disabled={!preferences.thinking} value={preferences.effort} onChange={event => setPreferences({
                ...preferences, effort: event.target.value as Preferences['effort'],
              })}>
                {Object.entries(EFFORTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <div className="deepseek-actions">
              <button type="submit"><Icon name="bookmark" size={15} />儲存模型設定</button>
            </div>
          </form>
        )}
        {activeFeedback && (
          <p className={activeFeedback.error ? 'deepseek-error' : 'deepseek-hint'} role={activeFeedback.error ? 'alert' : 'status'}>
            {activeFeedback.text}
          </p>
        )}
      </div>
    </section>
  );
}
