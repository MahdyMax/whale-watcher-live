import { Slider } from '@/components/ui/slider';

interface ThresholdSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const STEPS = [1, 10, 50, 100, 500, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000];

function formatThreshold(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function ThresholdSlider({ value, onChange }: ThresholdSliderProps) {
  const currentIndex = STEPS.findIndex((s) => s >= value) ?? STEPS.length - 1;

  return (
    <div className="px-4 py-2 flex items-center gap-3 flex-1">
      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider shrink-0">
        Min
      </span>
      <Slider
        min={0}
        max={STEPS.length - 1}
        step={1}
        value={[currentIndex]}
        onValueChange={([i]) => onChange(STEPS[i])}
        className="flex-1"
      />
      <span className="text-xs font-mono font-semibold text-foreground w-12 text-right">
        {formatThreshold(value)}
      </span>
    </div>
  );
}
