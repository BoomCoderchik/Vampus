import type { ScoreEntry } from '../game/highscores';

interface Props {
  scores: ScoreEntry[];
  highlightId?: string | null;
  compact?: boolean;
}

export default function HighScoreTable({ scores, highlightId, compact }: Props) {
  if (scores.length === 0) {
    return (
      <div className="text-center text-sm text-white/50 py-6 italic">
        No victims yet. The night is young…
      </div>
    );
  }
  const rows = compact ? scores.slice(0, 5) : scores;
  return (
    <div className="w-full">
      <div className="grid grid-cols-[2rem_1fr_auto_auto] gap-x-3 text-[10px] uppercase tracking-[0.2em] text-white/40 px-3 pb-1 font-gothic">
        <span>#</span>
        <span>Name</span>
        <span className="text-right">Bites</span>
        <span className="text-right">Score</span>
      </div>
      <ul className="space-y-1">
        {rows.map((s, i) => {
          const hl = s.id === highlightId;
          return (
            <li
              key={s.id}
              className={`grid grid-cols-[2rem_1fr_auto_auto] gap-x-3 items-center px-3 py-1.5 rounded-md text-sm font-gothic ${
                hl
                  ? 'bg-[rgba(255,59,74,0.18)] border border-[rgba(255,59,74,0.5)] text-white'
                  : i === 0
                    ? 'bg-white/5 text-[#ffd166]'
                    : 'text-white/80'
              }`}
            >
              <span className={`font-black ${i === 0 ? 'text-[#ffd166]' : 'text-white/50'}`}>
                {i === 0 ? '♛' : i + 1}
              </span>
              <span className="truncate font-bold tracking-wide">{s.name || '???'}</span>
              <span className="text-right tabular-nums text-white/60">{s.bites}</span>
              <span className="text-right tabular-nums font-black">{s.score.toLocaleString()}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
