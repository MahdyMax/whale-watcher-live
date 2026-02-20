import { Brain } from 'lucide-react';
import type { WhaleScore } from '@/hooks/useWhaleTransactions';

interface WhaleScoreCardProps {
  score: WhaleScore;
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

  return (
    <div className="px-4 py-2 border-b border-border">
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
      <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-700`}
          style={{ width: `${score.score}%` }}
        />
      </div>
    </div>
  );
}
