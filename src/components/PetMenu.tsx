import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { expression, type Expression } from '../lib/assets';
import { Icon } from './Icon';
import { DEFAULT_SIZES, SIZE_LIMITS, type PetSizes } from '../lib/petSizes';
import { displayId, type usePetDisplay } from '../hooks/usePetDisplay';
import character from '../../character/profile.json';

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
  /** Distance from the stage bottom: the menu sits just above Shizuku's head. */
  bottom: number;
  status: string;
  mood: Expression;
  sections: MenuSection[];
  sizes: PetSizes;
  onSizes: (sizes: PetSizes) => void;
  display: Pick<ReturnType<typeof usePetDisplay>, 'displays' | 'selected' | 'error' | 'refresh'>;
  onActions: () => void;
  onDeepSeek: () => void;
  onExit: () => void;
  onClose: () => void;
};

export const MENU_WIDTH = 276;

export function PetMenu({ bottom, status, mood, sections, sizes, onSizes, display, onActions, onDeepSeek, onExit, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<'menu' | 'size' | 'display'>('menu');

  useEffect(() => {
    const target = page === 'size' ? 'input[type="range"]' : page === 'display' ? 'select' : '.menu-tile:not(:disabled)';
    ref.current?.querySelector<HTMLElement>(target)?.focus({ preventScroll: true });
  }, [page]);

  const menuBottom = `clamp(8px, ${bottom}px, max(8px, 100% - 312px))`;
  const style: CSSProperties = {
    ...(page === 'menu' ? { bottom: menuBottom, maxHeight: `calc(100% - ${menuBottom} - 12px)` } : { top: 12 }),
    width: MENU_WIDTH,
    marginLeft: -MENU_WIDTH / 2,
  };

  return (
    <div
      ref={ref}
      className="pet-menu"
      role={page === 'menu' ? 'menu' : 'dialog'}
      aria-label={page === 'size' ? '角色大小' : page === 'display' ? '螢幕設定' : `${character.name}選單`}
      style={style}
      onContextMenu={event => event.preventDefault()}
      onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
    >
      <header className="menu-header">
        <span className="avatar" style={{ backgroundImage: `url(${expression(mood)})` }} />
        <div>
          <div className="menu-name">{character.name} <span aria-hidden="true">♡</span></div>
          <div className="menu-status">{status}</div>
        </div>
      </header>

      {page === 'size' ? (
        <div className="pet-sizes">
          <SizeSlider label="角色大小" value={sizes.scale} limits={SIZE_LIMITS.scale}
            onChange={scale => onSizes({ ...sizes, scale })} />
          <div className="pet-size-actions">
            <button type="button" onClick={() => onSizes(DEFAULT_SIZES)}>恢復預設</button>
            <button type="button" onClick={() => setPage('menu')}>返回選單</button>
          </div>
        </div>
      ) : page === 'display' ? (
        <div className="pet-sizes pet-display">
          <label>
            顯示螢幕
            <select value={display.selected} disabled={!display.displays.length}
              onChange={event => void display.refresh(event.target.value)}>
              {!display.selected && <option value="">選擇螢幕</option>}
              {display.displays.map((screen, index) => (
                <option key={displayId(screen)} value={displayId(screen)}>
                  {screen.name?.split('\\').pop() || `螢幕 ${index + 1}`} · {screen.size.width} × {screen.size.height}
                </option>
              ))}
            </select>
          </label>
          {display.error && <p className="deepseek-error" role="alert">{display.error}</p>}
          <div className="pet-size-actions">
            <button type="button" onClick={() => setPage('menu')}>返回選單</button>
          </div>
        </div>
      ) : (
        <>
          {sections.map(section => (
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
          ))}
          <footer className="menu-footer">
            <button type="button" role="menuitem" aria-haspopup="dialog" onClick={() => setPage('size')}>
              <Icon name="maximize" size={14} />大小
            </button>
            <button type="button" role="menuitem" aria-haspopup="dialog" onClick={() => { setPage('display'); void display.refresh(); }}>
              <Icon name="fullscreen" size={14} />螢幕
            </button>
            <button type="button" role="menuitem" onClick={onActions}>
              <Icon name="settings" size={14} />動作管理
            </button>
            <button type="button" role="menuitem" onClick={onDeepSeek}>
              <Icon name="sparkles" size={14} />DeepSeek API
            </button>
            <button type="button" role="menuitem" className="menu-exit" onClick={onExit}>
              <Icon name="close_round" size={14} />退出桌寵
            </button>
          </footer>
        </>
      )}
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
    <label className="pet-size-slider">
      <span>{label} <output>{Math.round(value * 100)}%</output></span>
      <input type="range" aria-label={label} aria-valuetext={`${Math.round(value * 100)}%`}
        min={limits.min} max={limits.max} step={0.05} value={value}
        onChange={event => onChange(event.target.valueAsNumber)} />
    </label>
  );
}
