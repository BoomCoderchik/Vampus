import type { RefObject } from 'react';

export interface HudRefs {
  time: RefObject<HTMLDivElement | null>;
  score: RefObject<HTMLDivElement | null>;
  bites: RefObject<HTMLSpanElement | null>;
  comboWrap: RefObject<HTMLDivElement | null>;
  comboBar: RefObject<HTMLDivElement | null>;
  mult: RefObject<HTMLDivElement | null>;
  lungeBtn: RefObject<HTMLButtonElement | null>;
}

interface Props {
  refs: HudRefs;
  isTouch: boolean;
  onPause: () => void;
  onLunge: () => void;
}

export default function Hud({ refs, isTouch, onPause, onLunge }: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none select-none-all" style={{ padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }}>
      {/* Timer */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="text-[9px] uppercase tracking-[0.35em] text-white/50 font-gothic">Time left</div>
        <div
          ref={refs.time}
          className="font-gothic font-black text-4xl sm:text-5xl tabular-nums text-white leading-none"
          style={{ textShadow: '0 2px 0 #4a0810, 0 0 18px rgba(255,59,74,0.35)' }}
        >
          60.0
        </div>
      </div>

      {/* Score */}
      <div className="absolute top-3 left-3 sm:left-5">
        <div className="text-[9px] uppercase tracking-[0.35em] text-white/50 font-gothic">Score</div>
        <div
          ref={refs.score}
          className="font-gothic font-black text-2xl sm:text-3xl tabular-nums text-[#ffd166] leading-none origin-left"
          style={{ textShadow: '0 2px 0 #3d2a00' }}
        >
          0
        </div>
        <div className="text-xs text-white/60 mt-1 font-gothic tracking-widest">
          🩸 <span ref={refs.bites}>0</span>
        </div>
      </div>

      {/* Pause */}
      <button
        onClick={onPause}
        className="btn-ghost pointer-events-auto absolute top-3 right-3 sm:right-5 w-10 h-10 rounded-full text-white/80 flex items-center justify-center"
        aria-label="Pause"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <rect x="2" y="1" width="3.5" height="12" rx="1" />
          <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
        </svg>
      </button>

      {/* Combo */}
      <div ref={refs.comboWrap} className="absolute top-20 sm:top-24 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-0 transition-opacity duration-150">
        <div
          ref={refs.mult}
          className="font-gothic font-black text-3xl sm:text-4xl text-white leading-none"
          style={{ textShadow: '0 0 14px rgba(255,59,74,0.8), 0 2px 0 #4a0810' }}
        >
          ×2
        </div>
        <div className="w-28 h-1.5 rounded-full bg-white/15 mt-1 overflow-hidden">
          <div ref={refs.comboBar} className="h-full bg-gradient-to-r from-[#ff3b4a] to-[#ffd166] origin-left" style={{ transform: 'scaleX(1)' }} />
        </div>
        <div className="text-[9px] uppercase tracking-[0.35em] text-white/60 font-gothic mt-1">combo</div>
      </div>

      {/* Lunge button (touch) */}
      {isTouch && (
        <button
          ref={refs.lungeBtn}
          onPointerDown={(e) => {
            e.preventDefault();
            onLunge();
          }}
          onContextMenu={(e) => e.preventDefault()}
          className="lunge-btn pointer-events-auto absolute right-6 bottom-8 w-24 h-24 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,59,74,0.35)]"
          style={{ ['--fill' as string]: 1, marginBottom: 'env(safe-area-inset-bottom)', touchAction: 'none' }}
          aria-label="Lunge"
        >
          <span className="w-[76px] h-[76px] rounded-full bg-[#160812] flex flex-col items-center justify-center border border-white/10">
            <span className="text-2xl leading-none">🧛</span>
            <span className="text-[9px] font-gothic tracking-[0.3em] text-white/70 mt-1">LUNGE</span>
          </span>
        </button>
      )}

      {!isTouch && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/30 font-gothic whitespace-nowrap">
          WASD move · Space lunge · Esc pause
        </div>
      )}
    </div>
  );
}
