import { useEffect, useRef } from 'react';
import { ELISE_FRAMES } from './assets';
import character from './characterProfile.json';

export function EliseStandby({ fps }: { fps: number }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    const frames = ELISE_FRAMES.standby;
    if (!element) return;

    let frame = frames.indexOf(element.getAttribute('src') ?? frames[0]);
    const timer = window.setInterval(() => {
      frame = (frame + 1) % frames.length;
      element.src = frames[frame];
    }, 1000 / fps);
    return () => window.clearInterval(timer);
  }, [fps]);

  return <img ref={image} src={ELISE_FRAMES.standby[0]} alt={character.name} draggable={false} />;
}
