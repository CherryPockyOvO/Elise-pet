import { useEffect, useRef, type CSSProperties } from 'react';
import { expression, type Expression } from './assets';
import { Icon } from './Icon';

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
  onExit: () => void;
  onClose: () => void;
};

export const MENU_WIDTH = 276;

export function PetMenu({ bottom, status, mood, sections, onExit, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('.menu-tile:not(:disabled)')?.focus({ preventScroll: true });
  }, []);

  const style: CSSProperties = { bottom, width: MENU_WIDTH, marginLeft: -MENU_WIDTH / 2 };

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
        <div>
          <div className="menu-name">Elise <span aria-hidden="true">♡</span></div>
          <div className="menu-status">{status}</div>
        </div>
      </header>

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

      <button type="button" role="menuitem" className="menu-exit" onClick={onExit}>
        <Icon name="close_round" size={14} />
        退出桌寵
      </button>
    </div>
  );
}
