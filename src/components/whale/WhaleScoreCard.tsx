import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { WhaleScore, WhaleScoreBreakdown } from '@/hooks/useWhaleTransactions';

interface WhaleScoreCardProps {
  score: WhaleScore;
}

function FactorBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 70 ? 'bg-buy' : pct > 40 ? 'bg-liquidation' : 'bg-muted-foreground';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-muted-foreground w-[6rem] shrink-0 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground w-[1.3rem] text-right">{value.toFixed(0)}</span>
    </div>
  );
}

export function WhaleScoreCard({ score }: WhaleScoreCardProps) {
  const sentimentColor =
    score.sentiment === 'Bullish'
      ? 'text-buy'
      : score.sentiment === 'Bearish'
      ? 'text-sell'
      : 'text-muted-foreground';

  const barColor =
    score.sentiment === 'Bullish'
      ? 'bg-buy'
      : score.sentiment === 'Bearish'
      ? 'bg-sell'
      : 'bg-muted-foreground';

  const WpiIcon = score.wpiTrend === 'rising' ? TrendingUp : score.wpiTrend === 'falling' ? TrendingDown : Minus;
  const wpiColor = score.wpiTrend === 'rising' ? 'text-buy' : score.wpiTrend === 'falling' ? 'text-sell' : 'text-muted-foreground';

  return (
    <div className="px-4 py-2 border-b border-border space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Brain className={`h-3.5 w-3.5 ${sentimentColor}`} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Whale Score
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-mono font-bold ${sentimentColor}`}>
            {score.score}/100
          </span>
          <span className={`text-[10px] font-semibold uppercase ${sentimentColor}`}>
            ({score.sentiment})
          </span>
        </div>
      </div>

      {/* Main bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-700`}
          style={{ width: `${score.score}%` }}
        />
      </div>

      {/* Breakdown factors */}
      <div className="space-y-1">
        <FactorBar label="Vol Intensity" value={score.breakdown.volumeIntensity} max={20} />
        <FactorBar label="Trade Velocity" value={score.breakdown.tradeVelocity} max={20} />
        <FactorBar label="Aggression" value={score.breakdown.aggressionFactor} max={20} />
        <FactorBar label="Exch Diversity" value={score.breakdown.exchangeDiversity} max={20} />
        <FactorBar label="Liq Correlation" value={score.breakdown.liquidationCorrelation} max={20} />
      </div>

      {/* WPI Trend */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">WPI:</span>
        <WpiIcon className={`h-3 w-3 ${wpiColor}`} />
        <span className={`text-[10px] font-mono font-semibold ${wpiColor} uppercase`}>
          {score.wpiTrend}
        </span>
      </div>
    </div>
  );
}
