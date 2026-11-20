import { useEffect, useRef } from 'react';
import { POSE_FRAMES } from '../lib/assets';
import character from '../../character/profile.json';

export function Standby({ fps }: { fps: number }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    const frames = POSE_FRAMES.standby;
    if (!element) return;

    let frame = frames.indexOf(element.getAttribute('src') ?? frames[0]);
    const timer = window.setInterval(() => {
      frame = (frame + 1) % frames.length;
      element.src = frames[frame];
    }, 1000 / fps);
    return () => window.clearInterval(timer);
  }, [fps]);

  return <img ref={image} src={POSE_FRAMES.standby[0]} alt={character.name} draggable={false} />;
}
