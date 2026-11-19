import { useEffect, useRef } from 'react';
import { ELISE_FRAMES } from './assets';

export function EliseStanding({ fps, onComplete }: { fps: number; onComplete: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    const frames = ELISE_FRAMES.stand;
    if (!element) return;

    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      if (frame === frames.length) {
        window.clearInterval(timer);
        onComplete();
        return;
      }
      element.src = frames[frame];
    }, 1000 / fps);
    return () => window.clearInterval(timer);
  }, [fps, onComplete]);

  return <img ref={image} className="elise-cycle stand-sprite" src={ELISE_FRAMES.stand[0]} alt="Elise" draggable={false} />;
}
