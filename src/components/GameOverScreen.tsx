import { useEffect, useRef } from 'react';
import HighScoreTable from './HighScoreTable';
import type { ScoreEntry } from '../game/highscores';
import type { GameResult } from '../game/engine';

interface Props {
  result: GameResult;
  scores: ScoreEntry[];
  entryId: string | null;
  rank: number;
  name: string;
  onNameChange: (n: string) => void;
  onRestart: () => void;
  onMenu: () => void;
  isTouch: boolean;
}

export default function GameOverScreen({ result, scores, entryId, rank, name, onNameChange, onRestart, onMenu, isTouch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isTop = rank === 1;
  const placed = rank > 0;

  useEffect(() => {
    // Don't steal focus on touch devices (keyboard would cover the screen)
    if (placed && !isTouch) inputRef.current?.select();
  }, [placed, isTouch]);

  const mm = Math.floor(result.survived / 60);
  const ss = Math.floor(result.survived % 60)
    .toString()
    .padStart(2, '0');

  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 bg-black/50 select-none-all overflow-y-auto">
      <div className="panel rounded-3xl w-full max-w-md p-5 sm:p-7 text-center my-auto">
        <div className="fade-up">
          <div className="text-3xl">☀️</div>
          <h2 className="font-gothic font-black text-3xl sm:text-4xl tracking-[0.15em] text-[#ff3b4a] leading-tight">
            THE SUN RISES
          </h2>
          <p className="text-white/50 text-xs tracking-widest uppercase mt-1">you starved in the dawn light</p>
        </div>

        <div className="fade-up delay-1 mt-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">Score</div>
          <div className={`font-gothic font-black text-5xl sm:text-6xl tabular-nums leading-none ${isTop ? 'shimmer' : 'text-white'}`}>
            {result.score.toLocaleString()}
          </div>
          {placed ? (
            <div className="mt-2 inline-block px-3 py-1 rounded-full bg-[rgba(255,209,102,0.15)] border border-[rgba(255,209,102,0.4)] text-[#ffd166] text-xs font-gothic font-bold tracking-widest pop">
              {isTop ? '♛ NEW HIGH SCORE!' : `#${rank} IN THE HALL OF BLOOD`}
            </div>
          ) : (
            <div className="mt-2 text-xs text-white/40 tracking-widest uppercase">not enough to be remembered…</div>
          )}
        </div>

        <div className="fade-up delay-2 grid grid-cols-3 gap-2 mt-4 text-center">
          <Stat label="Bites" value={result.bites.toString()} icon="🩸" />
          <Stat label="Best Combo" value={`×${Math.min(result.maxCombo, 10)}${result.maxCombo > 10 ? '+' : ''}`} icon="🔥" />
          <Stat label="Survived" value={`${mm}:${ss}`} icon="⏳" />
        </div>

        {placed && (
          <div className="fade-up delay-3 mt-4 flex items-center gap-2 bg-white/5 rounded-xl p-2">
            <span className="text-[10px] uppercase tracking-widest text-white/40 pl-2">Name</span>
            <input
              ref={inputRef}
              value={name}
              maxLength={12}
              onChange={(e) => onNameChange(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onRestart();
                }
                e.stopPropagation();
              }}
              className="flex-1 bg-transparent outline-none font-gothic font-bold tracking-widest text-white text-center border-b border-white/20 focus:border-[#ff3b4a] py-1 min-w-0"
              placeholder="NOSFERATU"
            />
          </div>
        )}

        <div className="fade-up delay-3 mt-4 space-y-2">
          <button
            onClick={onRestart}
            className="btn-blood w-full rounded-xl py-3.5 font-gothic font-black tracking-[0.25em] text-white text-xl"
          >
            BITE AGAIN
          </button>
          <button onClick={onMenu} className="btn-ghost w-full rounded-xl py-2.5 font-gothic font-bold tracking-[0.2em] text-white/70 text-sm">
            MENU
          </button>
          {!isTouch && <p className="text-[11px] text-white/35 tracking-widest uppercase">Enter / R to restart instantly</p>}
        </div>

        <div className="fade-up delay-4 mt-4 text-left">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 text-center mb-2 font-gothic">Hall of Blood</div>
          <HighScoreTable scores={scores} highlightId={entryId} compact />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white/5 rounded-xl py-2 px-1">
      <div className="text-base leading-none">{icon}</div>
      <div className="font-gothic font-black text-lg tabular-nums text-white leading-tight mt-1">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-white/40">{label}</div>
    </div>
  );
}
