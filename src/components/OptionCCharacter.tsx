import { useEffect, useState } from 'react';

/**
 * Option C visual-part layers. All PNGs share the same 1024 x 1536 canvas
 * and must be rendered at exactly the same origin/size.
 *
 * These visible-pixel masks compose perfectly into the v2 static artwork.
 * Layers do not yet contain occluded pixels needed for large rig rotations.
 */
const root = '/assets/costume/option-c/v2/';
const layers = [
  '00_rear_tail.png',
  '01_rear_twin_tail_left.png',
  '02_rear_twin_tail_right.png',
  '03_tail_ribbon_bell.png',
  '04_elise_body_face.png',
  '05_hood_base.png',
  '06_hood_bow_paw_pin.png',
  '07_hood_pompom.png',
  '08_paw_cuff_left.png',
  '09_paw_cuff_right.png',
] as const;

type Props = { className?: string };

export function OptionCCharacter({ className = '' }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const preload = layers.map(name =>
      new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(name));
        image.src = root + name;
      })
    );

    Promise.all(preload)
      .then(() => { if (mounted) setReady(true); })
      .catch(() => { if (mounted) setReady(false); });

    return () => { mounted = false; };
  }, []);

  if (!ready) {
    // Allows GitHub source changes to load before the PNG ZIP is installed.
    return (
      <img
        className={`option-c-fallback ${className}`}
        src="/assets/elise/poses/idle_front.png"
        alt="Elise（尚未安裝方案 C 分層 PNG）"
        draggable={false}
      />
    );
  }

  return (
    <span className={`option-c-stack ${className}`} aria-hidden="true">
      {layers.map((name, index) => (
        <img
          className={`option-c-layer layer-${index}`}
          key={name}
          src={root + name}
          alt=""
          draggable={false}
        />
      ))}
    </span>
  );
}
