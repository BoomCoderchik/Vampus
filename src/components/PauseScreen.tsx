interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  muted: boolean;
  onToggleMute: () => void;
  isTouch: boolean;
}

export default function PauseScreen({ onResume, onRestart, onQuit, muted, onToggleMute, isTouch }: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/55 select-none-all">
      <div className="panel rounded-3xl w-full max-w-sm p-7 text-center fade-up">
        <h2 className="font-gothic font-black text-4xl tracking-[0.25em] text-[#e9e0f2]">PAUSED</h2>
        <p className="text-white/50 text-xs mt-1 tracking-widest uppercase">the night holds its breath</p>
        <div className="mt-6 space-y-3">
          <button onClick={onResume} className="btn-blood w-full rounded-xl py-3 font-gothic font-black tracking-[0.2em] text-white text-lg">
            RESUME
          </button>
          <button onClick={onRestart} className="btn-ghost w-full rounded-xl py-3 font-gothic font-bold tracking-[0.2em] text-white/90">
            RESTART
          </button>
          <div className="flex gap-3">
            <button onClick={onQuit} className="btn-ghost flex-1 rounded-xl py-3 font-gothic font-bold tracking-[0.2em] text-white/70">
              MENU
            </button>
            <button onClick={onToggleMute} className="btn-ghost w-14 rounded-xl text-lg" aria-label="toggle sound">
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>
        {!isTouch && <p className="text-[11px] text-white/35 mt-4 tracking-widest uppercase">Esc / P to resume · R to restart</p>}
      </div>
    </div>
  );
}
