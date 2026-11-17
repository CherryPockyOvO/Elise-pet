import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { expression, type Expression } from './assets';
import { Icon } from './Icon';
import { SIZE_LIMITS, type Autonomy, type Settings } from './settings';

export type MenuItem = {
  id: string;
  label: string;
  icon: string;
  onSelect: () => void;
  active?: boolean;
  disabled?: boolean;
};

export type MenuSection = { title: string; items: MenuItem[] };

type Props = {
  /** Preferred distance from the stage bottom: just above Elise's head. */
  bottom: number;
  status: string;
  mood: Expression;
  sections: MenuSection[];
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
  onResetSettings: () => void;
  onExit: () => void;
  onClose: () => void;
};

export const MENU_WIDTH = 276;

const AUTONOMY_OPTIONS: { value: Autonomy; label: string }[] = [
  { value: 'off', label: '關閉' },
  { value: 'low', label: '偶爾' },
  { value: 'normal', label: '適中' },
  { value: 'high', label: '活潑' },
];

export function PetMenu(props: Props) {
  const { bottom, status, mood, sections, settings, onSettings, onResetSettings, onExit, onClose } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [offset, setOffset] = useState(bottom);

  // Sit above her head, but never past the top of the window.
  useLayoutEffect(() => {
    const menu = ref.current;
    const stage = menu?.parentElement;
    if (!menu || !stage) return;
    setOffset(Math.max(8, Math.min(bottom, stage.clientHeight - menu.offsetHeight - 8)));
  }, [bottom, view]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('.menu-tile:not(:disabled), input')?.focus({ preventScroll: true });
  }, [view]);

  const style: CSSProperties = { bottom: offset, width: MENU_WIDTH, marginLeft: -MENU_WIDTH / 2 };

  return (
    <div
      ref={ref}
      className="pet-menu"
      role="menu"
      aria-label="Elise 選單"
      style={style}
      onContextMenu={event => event.preventDefault()}
      onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
    >
      <header className="menu-header">
        <span className="avatar" style={{ backgroundImage: `url(${expression(mood)})` }} />
        <div className="menu-heading">
          <div className="menu-name">Elise <span aria-hidden="true">♡</span></div>
          <div className="menu-status">{view === 'main' ? status : '外觀與行為設定'}</div>
        </div>
        <button
          type="button"
          className={`icon-button ${view === 'settings' ? 'active' : ''}`}
          aria-label={view === 'main' ? '設定' : '返回'}
          aria-pressed={view === 'settings'}
          onClick={() => setView(view === 'main' ? 'settings' : 'main')}
        >
          <Icon name={view === 'main' ? 'settings' : 'close'} size={view === 'main' ? 18 : 12} />
        </button>
      </header>

      {view === 'main' ? (
        sections.map(section => (
          <section key={section.title} className="menu-section">
            <h2>{section.title}</h2>
            <div className="menu-grid">
              {section.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={`menu-tile ${item.active ? 'active' : ''}`}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                >
                  <Icon name={item.icon} size={22} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="settings">
          <SizeSlider
            label="Elise 大小"
            value={settings.eliseSize}
            limits={SIZE_LIMITS.elise}
            onChange={eliseSize => onSettings({ eliseSize })}
          />
          <SizeSlider
            label="小貓大小"
            value={settings.catSize}
            limits={SIZE_LIMITS.cat}
            onChange={catSize => onSettings({ catSize })}
          />

          <div className="setting">
            <span className="setting-label">自由活動</span>
            <div className="segmented" role="radiogroup" aria-label="自由活動頻率">
              {AUTONOMY_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={settings.autonomy === option.value}
                  className={settings.autonomy === option.value ? 'active' : ''}
                  onClick={() => onSettings({ autonomy: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="setting-hint">她和小貓會自己換姿勢、做小動作、冒出心情泡泡。</p>
          </div>

          <label className="setting toggle">
            <span>
              <span className="setting-label">自己去散步</span>
              <span className="setting-hint">自由活動時偶爾在螢幕上走一走</span>
            </span>
            <input
              type="checkbox"
              checked={settings.wander}
              disabled={settings.autonomy === 'off'}
              onChange={event => onSettings({ wander: event.target.checked })}
            />
          </label>

          <button type="button" className="text-button" onClick={onResetSettings}>
            恢復預設
          </button>
        </div>
      )}

      <button type="button" role="menuitem" className="menu-exit" onClick={onExit}>
        <Icon name="close_round" size={14} />
        退出桌寵
      </button>
    </div>
  );
}

function SizeSlider({ label, value, limits, onChange }: {
  label: string;
  value: number;
  limits: { min: number; max: number };
  onChange: (value: number) => void;
}) {
  return (
    <label className="setting">
      <span className="setting-row">
        <span className="setting-label">{label}</span>
        <output>{Math.round(value * 100)}%</output>
      </span>
      <input
        type="range"
        min={limits.min}
        max={limits.max}
        step={0.05}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
    </label>
  );
}
