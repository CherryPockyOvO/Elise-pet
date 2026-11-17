import type { CSSProperties } from 'react';
import { ICON_FILL, icon } from './assets';

/** Draws a UI icon so its visible artwork is `size` px, whatever its padding. */
export function Icon({ name, size }: { name: string; size: number }) {
  const canvas = Math.round(size * (ICON_FILL[name] ?? 2.2));
  const style: CSSProperties = { width: size, height: size };
  return (
    <span className="icon" style={style} aria-hidden="true">
      <img src={icon(name)} alt="" draggable={false} style={{ width: canvas, height: canvas }} />
    </span>
  );
}
