import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Engine, type GameResult, type HudState } from './game/engine';
import { sfx } from './game/audio';
import { insertScore, loadName, loadScores, renameEntry, saveName, type ScoreEntry } from './game/highscores';
import StartScreen from './components/StartScreen';
import PauseScreen from './components/PauseScreen';
import GameOverScreen from './components/GameOverScreen';
import Hud, { type HudRefs } from './components/Hud';

type Screen = 'menu' | 'playing' | 'paused' | 'over';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const screenRef = useRef<Screen>('menu');
  const [result, setResult] = useState<GameResult | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [entryId, setEntryId] = useState<string | null>(null);
  const [rank, setRank] = useState(-1);
  const [name, setName] = useState(() => loadName());
  const [muted, setMuted] = useState(sfx.muted);
  const nameRef = useRef(name);
  nameRef.current = name;

  const isTouch = useMemo(
    () => (typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window : false),
    [],
  );

  const hudRefs: HudRefs = {
    time: useRef<HTMLDivElement>(null),
    score: useRef<HTMLDivElement>(null),
    bites: useRef<HTMLSpanElement>(null),
    comboWrap: useRef<HTMLDivElement>(null),
    comboBar: useRef<HTMLDivElement>(null),
    mult: useRef<HTMLDivElement>(null),
    lungeBtn: useRef<HTMLButtonElement>(null),
  };
  const lastHud = useRef({ score: -1, bites: -1, urgent: false, combo: -1 });

  const go = useCallback((s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  }, []);

  // ------------------------------------------------------------ engine wiring
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onHud = (h: HudState) => {
      const r = hudRefs;
      const last = lastHud.current;
      if (r.time.current) {
        r.time.current.textContent = h.time < 10 ? h.time.toFixed(1) : Math.ceil(h.time).toString();
        const urgent = h.time < 10;
        if (urgent !== last.urgent) {
          last.urgent = urgent;
          r.time.current.classList.toggle('urgent', urgent);
        }
      }
      if (h.score !== last.score && r.score.current) {
        last.score = h.score;
        r.score.current.textContent = h.score.toLocaleString();
        r.score.current.classList.remove('pop');
        void r.score.current.offsetWidth;
        r.score.current.classList.add('pop');
      }
      if (h.bites !== last.bites && r.bites.current) {
        last.bites = h.bites;
        r.bites.current.textContent = h.bites.toString();
      }
      if (r.comboWrap.current) {
        const show = h.combo >= 2 && h.comboFrac > 0;
        r.comboWrap.current.style.opacity = show ? '1' : '0';
        if (show) {
          if (r.comboBar.current) r.comboBar.current.style.transform = `scaleX(${h.comboFrac.toFixed(3)})`;
          if (r.mult.current && h.combo !== last.combo) {
            r.mult.current.textContent = `×${h.mult}${h.combo > 10 ? '+' : ''}`;
            r.mult.current.style.color = h.combo >= 10 ? '#ffd166' : '#ffffff';
            r.mult.current.classList.remove('pop');
            void r.mult.current.offsetWidth;
            r.mult.current.classList.add('pop');
          }
        }
        last.combo = h.combo;
      }
      if (r.lungeBtn.current) {
        r.lungeBtn.current.style.setProperty('--fill', h.lungeFrac.toFixed(3));
      }
    };

    const onGameOver = (res: GameResult) => {
      setResult(res);
      const entry: ScoreEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: nameRef.current.trim() || 'NOSFERATU',
        score: res.score,
        bites: res.bites,
        maxCombo: res.maxCombo,
        date: Date.now(),
      };
      const { list, rank } = insertScore(entry);
      setScores(list);
      setEntryId(rank > 0 ? entry.id : null);
      setRank(rank);
      go('over');
    };

    const onPause = (paused: boolean) => {
      go(paused ? 'paused' : 'playing');
    };

    const engine = new Engine(canvas, { onHud, onGameOver, onPause });
    engineRef.current = engine;
    engine.run();

    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);
    const onVis = () => {
      if (document.hidden) engine.pause();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ actions
  const startGame = useCallback(() => {
    sfx.ensure();
    lastHud.current = { score: -1, bites: -1, urgent: false, combo: -1 };
    hudRefs.time.current?.classList.remove('urgent');
    engineRef.current?.start();
    go('playing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go]);

  const resume = useCallback(() => {
    sfx.ui();
    engineRef.current?.resume();
  }, []);

  const pause = useCallback(() => {
    sfx.ui();
    engineRef.current?.pause();
  }, []);

  const toMenu = useCallback(() => {
    sfx.ui();
    engineRef.current?.toIdle();
    setScores(loadScores());
    go('menu');
  }, [go]);

  const toggleMute = useCallback(() => {
    const m = !sfx.muted;
    sfx.setMuted(m);
    setMuted(m);
  }, []);

  const onNameChange = useCallback(
    (n: string) => {
      setName(n);
      saveName(n);
      if (entryId) setScores(renameEntry(entryId, n.trim() || 'NOSFERATU'));
    },
    [entryId],
  );

  // ------------------------------------------------------------ global keys for screens
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = screenRef.current;
      const k = e.key.toLowerCase();
      const inInput = (e.target as HTMLElement)?.tagName === 'INPUT';
      if (s === 'menu' && (k === 'enter' || k === ' ')) {
        e.preventDefault();
        startGame();
      } else if (s === 'over' && !inInput && (k === 'enter' || k === 'r' || k === ' ')) {
        e.preventDefault();
        startGame();
      } else if (s === 'paused') {
        if (k === 'enter') resume();
        else if (k === 'r') startGame();
      } else if (s === 'playing' && k === 'r' && e.shiftKey) {
        startGame();
      }
      if (k === 'm' && !inInput) toggleMute();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startGame, resume, toggleMute]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#07030c]" style={{ height: '100dvh' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {(screen === 'playing' || screen === 'paused') && (
        <Hud refs={hudRefs} isTouch={isTouch} onPause={pause} onLunge={() => engineRef.current?.lunge()} />
      )}

      {screen === 'menu' && (
        <StartScreen onStart={startGame} scores={scores} isTouch={isTouch} muted={muted} onToggleMute={toggleMute} />
      )}

      {screen === 'paused' && (
        <PauseScreen onResume={resume} onRestart={startGame} onQuit={toMenu} muted={muted} onToggleMute={toggleMute} isTouch={isTouch} />
      )}

      {screen === 'over' && result && (
        <GameOverScreen
          result={result}
          scores={scores}
          entryId={entryId}
          rank={rank}
          name={name}
          onNameChange={onNameChange}
          onRestart={startGame}
          onMenu={toMenu}
          isTouch={isTouch}
        />
      )}
    </div>
  );
}
