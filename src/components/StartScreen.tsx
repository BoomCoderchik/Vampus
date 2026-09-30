import { useState } from 'react';
import HighScoreTable from './HighScoreTable';
import type { ScoreEntry } from '../game/highscores';

interface Props {
  onStart: () => void;
  scores: ScoreEntry[];
  isTouch: boolean;
  muted: boolean;
  onToggleMute: () => void;
}

export default function StartScreen({ onStart, scores, isTouch, muted, onToggleMute }: Props) {
  const [tab, setTab] = useState<'how' | 'scores'>('how');
  const best = scores[0]?.score ?? 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 select-none-all overflow-y-auto">
      <div className="panel rounded-3xl w-full max-w-lg p-6 sm:p-8 text-center relative my-auto">
        <button
          onClick={onToggleMute}
          className="btn-ghost absolute top-3 right-3 w-10 h-10 rounded-full text-lg"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        <div className="fade-up">
          <div className="text-4xl mb-1 bat-float inline-block">🦇</div>
          <h1 className="font-gothic font-black text-5xl sm:text-6xl tracking-wider text-[#ff3b4a] flicker leading-none">
            FANG RUSH
          </h1>
          <div className="flex justify-center gap-6 mt-1 h-4">
            <span className="drip text-[#c4162b] text-xs">▼</span>
            <span className="drip text-[#c4162b] text-xs" style={{ animationDelay: '0.8s' }}>▼</span>
            <span className="drip text-[#c4162b] text-xs" style={{ animationDelay: '1.5s' }}>▼</span>
          </div>
          <p className="font-gothic text-[#e9e0f2]/80 mt-2 text-sm sm:text-base tracking-wide">
            You have <span className="text-white font-bold">60 seconds</span> to live.
            <br />
            Every bite buys <span className="text-[#7CFF9C] font-bold">+3 s</span>. Feast.
          </p>
        </div>

        <div className="fade-up delay-1 mt-5">
          <button
            onClick={onStart}
            className="btn-blood font-gothic font-black text-2xl sm:text-3xl tracking-[0.2em] text-white rounded-2xl px-10 py-4 w-full"
          >
            HUNT
          </button>
          <p className="text-[11px] text-white/40 mt-2 tracking-widest uppercase">
            {isTouch ? 'tap to begin' : 'press Enter or Space'}
          </p>
        </div>

        <div className="fade-up delay-2 mt-5 flex justify-center gap-2 text-xs font-gothic tracking-widest">
          <button
            onClick={() => setTab('how')}
            className={`px-4 py-1.5 rounded-full ${tab === 'how' ? 'bg-[#c4162b] text-white' : 'btn-ghost text-white/60'}`}
          >
            HOW TO PLAY
          </button>
          <button
            onClick={() => setTab('scores')}
            className={`px-4 py-1.5 rounded-full ${tab === 'scores' ? 'bg-[#c4162b] text-white' : 'btn-ghost text-white/60'}`}
          >
            HALL OF BLOOD
          </button>
        </div>

        <div className="fade-up delay-3 mt-4 text-left min-h-[180px]">
          {tab === 'how' ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Move</div>
                  <div className="font-bold">{isTouch ? 'Drag anywhere' : 'WASD / Arrows'}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Lunge</div>
                  <div className="font-bold">{isTouch ? 'Fang button / 2nd finger' : 'Space / Shift'}</div>
                </div>
              </div>
              <ul className="space-y-1.5 text-white/80">
                <li className="flex items-center gap-2">
                  <Dot color="#5b7ea8" /> <b>Peasant</b> — +3 s · 100 pts
                </li>
                <li className="flex items-center gap-2">
                  <Dot color="#5fae6c" /> <b>Sprinter</b> — fast! +3 s · 250 pts
                </li>
                <li className="flex items-center gap-2">
                  <Dot color="#8a4fbf" /> <b>Noble</b> — rare. +5 s · 500 pts
                </li>
                <li className="flex items-center gap-2">
                  <Dot color="#6b4a2f" ring /> <b>Hunter</b> — garlic! touching costs <span className="text-[#ff5a5a]">−5 s</span>.
                  <span className="text-[#ffd166]">Lunge</span> into him to slay: +5 s · 400 pts
                </li>
              </ul>
              <p className="text-xs text-white/50">
                Chain bites within 2.6 s to build a combo multiplier up to <b className="text-[#ffd166]">×10</b>.
                {!isTouch && ' P / Esc to pause.'}
              </p>
            </div>
          ) : (
            <HighScoreTable scores={scores} />
          )}
        </div>

        {best > 0 && (
          <div className="fade-up delay-4 mt-4 text-xs font-gothic tracking-widest text-white/50">
            BEST: <span className="text-[#ffd166] font-black">{best.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Dot({ color, ring }: { color: string; ring?: boolean }) {
  return (
    <span
      className="inline-block w-3.5 h-3.5 rounded-full shrink-0"
      style={{
        background: color,
        boxShadow: ring ? '0 0 0 2px #d9f0a3' : '0 0 0 1px rgba(255,255,255,0.2)',
      }}
    />
  );
}
