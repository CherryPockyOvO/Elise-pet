import { useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { importActionFolder, type ActionKind, type ImportedAction } from '../lib/actionLibrary';
import {
  actionsForHeading, FULL_CHANCE, HEADINGS, isWalkingAction, WALK_ACTIVITY, withActionChance, withActionEnding,
  withActionFps, withActionKind, withEvenActionChances, type ActionRow, type ActionSettings, type WalkActivity,
} from '../lib/actionSettings';
import type { Heading } from '../lib/turns';
import { Icon } from './Icon';

export function ActionPanel({ actions, disabled, loading, storageError, settings, onSettings, onAdd, onToggle, onDelete, onPreview, onClose }: {
  actions: ImportedAction[];
  disabled: string[];
  loading: boolean;
  storageError: string;
  settings: ActionSettings;
  onSettings: (settings: ActionSettings) => void;
  onAdd: (action: ImportedAction) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (action: ImportedAction) => Promise<void>;
  onPreview: (action: ActionRow, heading: Heading) => void;
  onClose: () => void;
}) {
  const [heading, setHeading] = useState<Heading>('front');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [operation, setOperation] = useState<'import' | 'delete' | null>(null);
  const working = operation !== null;
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const firstDirection = useRef<HTMLButtonElement>(null);
  const native = isTauri();
  const side = heading === 'left' || heading === 'right';
  const group = actionsForHeading(heading, actions);
  const randomActions = group.filter(row => !isWalkingAction(row));
  const enabledRandomActions = randomActions.filter(row => row.source === 'built-in' || !disabled.includes(row.id));
  const chanceTotal = randomActions.reduce((total, row) => total + (settings.chances[heading][row.id] ?? 0), 0);

  useEffect(() => { firstDirection.current?.focus({ preventScroll: true }); }, []);

  function changeHeading(direction: Heading) {
    setHeading(direction);
    setNotice(null);
    setPendingDelete(null);
  }

  async function importFolder() {
    if (working || !native) return;
    setNotice(null);
    setPendingDelete(null);
    setOperation('import');
    try {
      const result = await importActionFolder(heading);
      if (result) {
        onAdd(result);
        setNotice({ text: `已匯入「${result.name}」的 ${result.frameCount} 幀。` });
      }
    } catch (error) {
      setNotice({ text: String(error), error: true });
    } finally {
      setOperation(null);
    }
  }

  async function removeAction(action: ImportedAction) {
    setNotice(null);
    setOperation('delete');
    try {
      await onDelete(action);
      setPendingDelete(null);
      setNotice({ text: `已刪除「${action.name}」。` });
    } catch (error) {
      setNotice({ text: String(error), error: true });
    } finally {
      setOperation(null);
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
      if (event.key === 'Escape' && !working) {
        if (pendingDelete) setPendingDelete(null);
        else onClose();
      }
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
        <button type="button" className="action-preview" disabled={working || loading || enabledRandomActions.length === 0}
          title="將這個朝向已啟用的隨機動作平均分配至 100%"
          onClick={() => applySettings(() => withEvenActionChances(settings, heading, enabledRandomActions))}>
          平均分配
        </button>
      </div>
      {notice && <p className={notice.error ? 'deepseek-error' : 'deepseek-hint'} role={notice.error ? 'alert' : 'status'}>
        {notice.text}
      </p>}
      {storageError && <p className="deepseek-error" role="alert">{storageError}</p>}
      <div className="deepseek-content">
        <fieldset className="walk-activity">
          <legend>散步活潑程度</legend>
          <div className="deepseek-tabs" role="group" aria-label="散步活潑程度">
            {Object.entries(WALK_ACTIVITY).map(([level, { label, chance }]) => (
              <button key={level} type="button" aria-pressed={settings.walkActivity === level}
                disabled={working} onClick={() => applySettings(() => ({ ...settings, walkActivity: level as WalkActivity }))}>
                {label} {chance}%
              </button>
            ))}
          </div>
          <p className="deepseek-hint">每輪空閒時檢查。若觸發站立小動作，本輪先播放該動作。</p>
        </fieldset>
        <div className="deepseek-actions action-import">
          <button type="button" disabled={!native || working || loading} onClick={() => void importFolder()}>
            <Icon name="bookmark" size={15} />{operation === 'import' ? '正在匯入…' : '匯入 PNG 資料夾'}
          </button>
        </div>
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
                    <span>{row.source === 'built-in' ? '內建 · 固定啟用' : `匯入 · ${row.action.frameCount} 幀`}</span>
                  </div>
                  <button type="button" className="action-preview" disabled={working} onClick={() => onPreview(row, heading)}>
                    <Icon name="play" size={13} />試播
                  </button>
                  {row.source === 'imported' && <>
                    <label className="action-enabled">
                    <input type="checkbox" checked={!disabled.includes(row.id)} disabled={working}
                      onChange={event => {
                        try {
                          onToggle(row.id, event.target.checked);
                        } catch {
                          setNotice({ text: '無法儲存動作設定。', error: true });
                        }
                      }} />
                    啟用
                    </label>
                    <button type="button" className="action-delete" aria-label={`刪除 ${row.name}`}
                      disabled={working} onClick={() => setPendingDelete(row.id)}>刪除</button>
                  </>}
                  </div>
                  {row.source === 'imported' && pendingDelete === row.id && (
                    <div className="action-delete-confirm" role="group" aria-label={`確認刪除 ${row.name}`}>
                      <span>刪除這個匯入動作？</span>
                      <button type="button" className="action-delete" disabled={working}
                        onClick={() => void removeAction(row.action)}>{operation === 'delete' ? '正在刪除…' : '確認刪除'}</button>
                      <button type="button" className="action-preview" disabled={working}
                        onClick={() => setPendingDelete(null)}>取消</button>
                    </div>
                  )}
                  <div className="action-row-fields">
                    <label>
                      FPS
                      <input key={actionFps} type="number" min={1} max={30} step={1} defaultValue={actionFps}
                          aria-label={`${row.name} FPS`} disabled={working}
                          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                          onBlur={event => {
                            const input = event.currentTarget;
                            if (input.valueAsNumber === actionFps) return;
                            if (!applySettings(() => withActionFps(settings, row.id, input.valueAsNumber))) input.value = String(actionFps);
                          }} />
                    </label>
                    {isWalkingAction(row) ? (
                      <span className="action-walk-pool">機率<span>依活潑程度</span></span>
                    ) : <label>
                      機率（%）
                      <input key={chance} type="number" min={0} max={100} step={0.01} defaultValue={chance}
                        aria-label={`${row.name} 機率`} disabled={working}
                        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                        onBlur={event => {
                          const input = event.currentTarget;
                          if (input.valueAsNumber === chance) return;
                          if (!applySettings(() => withActionChance(settings, heading, randomActions, row.id, input.valueAsNumber))) input.value = String(chance);
                        }} />
                    </label>}
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
                    {row.source === 'imported' && side && (
                      <label>
                        動作類型
                        <select value={row.action.kind} disabled={working} aria-label={`${row.name} 動作類型`}
                          onChange={event => {
                            const kind = event.target.value as ActionKind;
                            applySettings(() => withActionKind(settings, row.id, kind));
                          }}>
                          <option value="gesture">原地動作</option>
                          <option value="walk">散步幀</option>
                        </select>
                      </label>
                    )}
                  </div>
                </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
