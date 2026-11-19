import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { importActionFolder, type ActionKind, type ImportedAction } from './actionLibrary';
import {
  actionsForHeading, FULL_CHANCE, HEADINGS, withActionChance, withActionEnding, withActionFps,
  type ActionRow, type ActionSettings,
} from './actionSettings';
import type { Heading } from './eliseTurns';
import { Icon } from './Icon';

export function ActionPanel({ actions, disabled, loading, storageError, settings, onSettings, onAdd, onToggle, onPreview, onClose }: {
  actions: ImportedAction[];
  disabled: string[];
  loading: boolean;
  storageError: string;
  settings: ActionSettings;
  onSettings: (settings: ActionSettings) => void;
  onAdd: (action: ImportedAction) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onPreview: (action: ActionRow, heading: Heading) => void;
  onClose: () => void;
}) {
  const [heading, setHeading] = useState<Heading>('front');
  const [kind, setKind] = useState<ActionKind>('gesture');
  const [fps, setFps] = useState(10);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const firstDirection = useRef<HTMLButtonElement>(null);
  const native = isTauri();
  const side = heading === 'left' || heading === 'right';
  const group = actionsForHeading(heading, actions);
  const chanceTotal = group.reduce((total, row) => total + (settings.chances[heading][row.id] ?? 0), 0);

  useEffect(() => { firstDirection.current?.focus({ preventScroll: true }); }, []);

  function changeHeading(direction: Heading) {
    setHeading(direction);
    setNotice(null);
    if ((direction === 'front' || direction === 'back') && kind === 'walk') {
      setKind('gesture');
      setFps(10);
    }
  }

  async function importFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || !native) return;
    setNotice(null);
    setWorking(true);
    try {
      const result = await importActionFolder(heading, kind, fps);
      if (result) {
        onAdd(result);
        setNotice({ text: `已匯入「${result.name}」的 ${result.frameCount} 幀。` });
      }
    } catch (error) {
      setNotice({ text: String(error), error: true });
    } finally {
      setWorking(false);
    }
  }

  function applySettings(change: () => ActionSettings) {
    try {
      onSettings(change());
      setNotice(null);
      return true;
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : '無法儲存動作設定。', error: true });
      return false;
    }
  }

  return (
    <section className="deepseek-panel action-panel" aria-labelledby="action-title" onKeyDown={event => {
      if (event.key === 'Escape' && !working) onClose();
    }}>
      <header className="deepseek-header">
        <span className="deepseek-mark"><Icon name="play" size={21} /></span>
        <h2 id="action-title">動作管理</h2>
        <button type="button" className="icon-button" aria-label="關閉動作管理" disabled={working} onClick={onClose}>
          <Icon name="close" size={12} />
        </button>
      </header>
      <div className="deepseek-tabs action-directions" role="group" aria-label="角色朝向">
        {Object.entries(HEADINGS).map(([direction, label], index) => (
          <button key={direction} type="button" ref={index === 0 ? firstDirection : undefined}
            aria-pressed={heading === direction} disabled={working} onClick={() => changeHeading(direction as Heading)}>
            {label}
          </button>
        ))}
      </div>
      <div className="action-probability-total">
        <strong>已配置 {chanceTotal / 100}%</strong>
        <span>未配置 {(FULL_CHANCE - chanceTotal) / 100}%</span>
      </div>
      {notice && <p className={notice.error ? 'deepseek-error' : 'deepseek-hint'} role={notice.error ? 'alert' : 'status'}>
        {notice.text}
      </p>}
      {storageError && <p className="deepseek-error" role="alert">{storageError}</p>}
      <div className="deepseek-content">
        <details className="action-import-section">
          <summary>匯入動作</summary>
        <form className="action-import" onSubmit={importFolder}>
          <div className="action-import-fields">
            <label>
              動作類型
              <select value={kind} disabled={working} onChange={event => {
                const selection = event.target.value as ActionKind;
                setKind(selection);
                setFps(selection === 'walk' ? 20 : 10);
              }}>
                <option value="gesture">原地動作</option>
                {side && <option value="walk">散步幀</option>}
              </select>
            </label>
            <label>
              幀率（FPS）
              <input type="number" value={Number.isNaN(fps) ? '' : fps}
                required min={1} max={30} step={1} disabled={working}
                onChange={event => setFps(event.target.valueAsNumber)} />
            </label>
          </div>
          <p className="deepseek-hint">
            {native ? 'PNG 首幀應符合這一組的朝向。匯入後可設定末幀朝向，散步幀的首尾要能連續循環。' : '請在 Elise 桌面版匯入動作。'}
          </p>
          <div className="deepseek-actions">
            <button type="submit" disabled={!native || working}>
              <Icon name="bookmark" size={15} />{working ? '正在匯入…' : '匯入 PNG 資料夾'}
            </button>
          </div>
        </form>
        </details>
        {loading && <p className="deepseek-hint">正在讀取匯入動作…</p>}
        <ul className="action-list">
          {group.map(row => {
            const actionFps = settings.fps[row.id] ?? row.defaultFps;
            const chance = (settings.chances[heading][row.id] ?? 0) / 100;
            return (
                <li key={`${heading}:${row.id}`}>
                  <div className="action-row-heading">
                  <div className="action-name">
                    <strong title={row.name}>{row.name}</strong>
                    <span>{row.source === 'built-in' ? '內建 · 固定啟用'
                      : `匯入 · ${row.action.kind === 'walk' ? '散步幀' : '原地動作'} · ${row.action.frameCount} 幀`}</span>
                  </div>
                  <button type="button" className="action-preview" disabled={working} onClick={() => onPreview(row, heading)}>
                    <Icon name="play" size={13} />試播
                  </button>
                  {row.source === 'imported' && <label className="action-enabled">
                    <input type="checkbox" checked={!disabled.includes(row.id)} disabled={working}
                      onChange={event => {
                        try {
                          onToggle(row.id, event.target.checked);
                        } catch {
                          setNotice({ text: '無法儲存動作設定。', error: true });
                        }
                      }} />
                    啟用
                  </label>}
                  </div>
                  <div className="action-row-fields">
                    <label>
                      {row.id === 'front2left' || row.id === 'left2back' ? '共用 FPS' : 'FPS'}
                      {actionFps === undefined ? <span className="action-static">單幀</span>
                        : <input key={actionFps} type="number" min={1} max={30} step={1} defaultValue={actionFps}
                          aria-label={`${row.name} FPS`} disabled={working}
                          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                          onBlur={event => {
                            const input = event.currentTarget;
                            if (input.valueAsNumber === actionFps) return;
                            if (!applySettings(() => withActionFps(settings, row.id, input.valueAsNumber))) input.value = String(actionFps);
                          }} />}
                    </label>
                    <label>
                      機率（%）
                      <input key={chance} type="number" min={0} max={100} step={0.01} defaultValue={chance}
                        aria-label={`${row.name} 機率`} disabled={working}
                        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                        onBlur={event => {
                          const input = event.currentTarget;
                          if (input.valueAsNumber === chance) return;
                          if (!applySettings(() => withActionChance(settings, heading, group, row.id, input.valueAsNumber))) input.value = String(chance);
                        }} />
                    </label>
                    <label>
                      結束朝向
                      <select value={settings.endings[heading][row.id] ?? ''} disabled={working}
                        aria-label={`${row.name} 結束朝向`}
                        onChange={event => {
                          const end = event.target.value as Heading | '';
                          applySettings(() => withActionEnding(settings, heading, row.id, end));
                        }}>
                        <option value="">依素材</option>
                        {Object.entries(HEADINGS).map(([direction, label]) => (
                          <option key={direction} value={direction}>{label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
