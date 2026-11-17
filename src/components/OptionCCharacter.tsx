type OptionCPose = 'idle' | 'sit' | 'sleep';
type Props = { className?: string; pose: OptionCPose };

const optionCImages: Record<OptionCPose, string> = {
  idle: '/assets/costume/option-c/poses-v2/idle.png',
  sit: '/assets/costume/option-c/poses-v2/sit.png',
  sleep: '/assets/costume/option-c/poses-v2/sleep.png',
};

const fallbackImages: Record<OptionCPose, string> = {
  idle: '/assets/elise/poses/idle_front.png',
  sit: '/assets/elise/poses/sit_shy.png',
  sleep: '/assets/elise/poses/sleep.png',
};

export function OptionCCharacter({ className = '', pose }: Props) {
  return (
    <img
      className={className}
      src={optionCImages[pose]}
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
