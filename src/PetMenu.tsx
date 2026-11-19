import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { expression, type Expression } from './assets';
import { Icon } from './Icon';
import { DEFAULT_SIZES, SIZE_LIMITS, type PetSizes } from './petSizes';

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
  /** Distance from the stage bottom: the menu sits just above Elise's head. */
  bottom: number;
  status: string;
  mood: Expression;
  sections: MenuSection[];
  sizes: PetSizes;
  onSizes: (sizes: PetSizes) => void;
  onActions: () => void;
  onDeepSeek: () => void;
  onExit: () => void;
  onClose: () => void;
};

export const MENU_WIDTH = 276;

export function PetMenu({ bottom, status, mood, sections, sizes, onSizes, onActions, onDeepSeek, onExit, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [sizesOpen, setSizesOpen] = useState(false);

  useEffect(() => {
    const target = sizesOpen ? 'input[type="range"]' : '.menu-tile:not(:disabled)';
    ref.current?.querySelector<HTMLElement>(target)?.focus({ preventScroll: true });
  }, [sizesOpen]);

  const style: CSSProperties = {
    ...(sizesOpen ? { top: 78 } : { bottom }),
    width: MENU_WIDTH,
    marginLeft: -MENU_WIDTH / 2,
  };

  return (
    <div
      ref={ref}
      className="pet-menu"
      role={sizesOpen ? 'dialog' : 'menu'}
      aria-label={sizesOpen ? '角色大小' : 'Elise 選單'}
      style={style}
      onContextMenu={event => event.preventDefault()}
      onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
    >
      <header className="menu-header">
        <span className="avatar" style={{ backgroundImage: `url(${expression(mood)})` }} />
        <div>
          <div className="menu-name">Elise <span aria-hidden="true">♡</span></div>
          <div className="menu-status">{status}</div>
        </div>
      </header>

      {sizesOpen ? (
        <div className="pet-sizes">
          <SizeSlider label="Elise 大小" value={sizes.eliseSize} limits={SIZE_LIMITS.eliseSize}
            onChange={eliseSize => onSizes({ ...sizes, eliseSize })} />
          <SizeSlider label="小貓相對大小" value={sizes.catSize} limits={SIZE_LIMITS.catSize}
            onChange={catSize => onSizes({ ...sizes, catSize })} />
          <div className="pet-size-actions">
            <button type="button" onClick={() => onSizes(DEFAULT_SIZES)}>恢復預設</button>
            <button type="button" onClick={() => setSizesOpen(false)}>返回選單</button>
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
            <button type="button" role="menuitem" aria-haspopup="dialog" onClick={() => setSizesOpen(true)}>
              <Icon name="maximize" size={14} />大小
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
