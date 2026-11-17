import { useEffect, useState } from 'react';

type OptionCPose = 'idle' | 'sit' | 'sleep';
type Props = { className?: string; pose: OptionCPose };

const optionCImages: Record<OptionCPose | 'blink', string> = {
  idle: '/assets/costume/option-c/poses/idle.png',
  blink: '/assets/costume/option-c/poses/blink.png',
  sit: '/assets/costume/option-c/poses/sit.png',
  sleep: '/assets/costume/option-c/poses/sleep.png',
};

const fallbackImages: Record<OptionCPose, string> = {
  idle: '/assets/elise/poses/idle_front.png',
  sit: '/assets/elise/poses/sit_shy.png',
  sleep: '/assets/elise/poses/sleep.png',
};

export function OptionCCharacter({ className = '', pose }: Props) {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (pose !== 'idle') {
      setBlinking(false);
      return;
    }

    let blinkTimer = 0;
    let reopenTimer = 0;
    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(() => {
        setBlinking(true);
        reopenTimer = window.setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, 150);
      }, 2800 + Math.random() * 3200);
    };
    scheduleBlink();
    return () => {
      window.clearTimeout(blinkTimer);
      window.clearTimeout(reopenTimer);
    };
  }, [pose]);

  const image = pose === 'idle' && blinking ? optionCImages.blink : optionCImages[pose];

  return (
    <img
      className={className}
      src={image}
      alt="Elise 猫娘形态"
      draggable={false}
      onError={event => {
        const fallback = fallbackImages[pose];
        if (!event.currentTarget.src.endsWith(fallback)) {
          event.currentTarget.src = fallback;
        }
      }}
    />
  );
}
