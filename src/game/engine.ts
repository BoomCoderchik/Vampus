import { sfx } from './audio';

export type Mode = 'idle' | 'playing' | 'paused' | 'over';

export interface HudState {
  time: number;
  score: number;
  bites: number;
  combo: number;
  comboFrac: number;
  lungeFrac: number;
  mult: number;
}

export interface GameResult {
  score: number;
  bites: number;
  maxCombo: number;
  survived: number;
}

export interface Callbacks {
  onHud: (h: HudState) => void;
  onGameOver: (r: GameResult) => void;
  onPause: (paused: boolean) => void;
}

type VType = 'peasant' | 'runner' | 'noble' | 'hunter';
type VState = 'wander' | 'flee' | 'bitten';

interface Villager {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  type: VType;
  state: VState;
  speed: number;
  tx: number;
  ty: number;
  wanderT: number;
  panic: number;
  facing: number;
  flash: number;
  bobT: number;
  corpseT: number;
  seed: number;
  cooldown: number;
  alerted: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'blood' | 'bat' | 'spark' | 'garlic' | 'ring' | 'dust';
  rot: number;
  rotV: number;
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
  stroke: string;
}

interface Obstacle {
  x: number;
  y: number;
  r: number;
  kind: 'tree' | 'fountain' | 'crypt';
  seed: number;
}

const WORLD = 2200;
const START_TIME = 60;
const BITE_TIME = 3;
const PLAYER_R = 18;
const PLAYER_SPEED = 275;
const LUNGE_DUR = 0.22;
const LUNGE_BOOST = 900;
const LUNGE_CD = 0.85;
const COMBO_WINDOW = 2.6;
const MAX_PARTICLES = 420;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const TYPE_INFO: Record<
  VType,
  { speed: number; body: string; head: string; hair: string; r: number; time: number; points: number; label: string }
> = {
  peasant: { speed: 205, body: '#5b7ea8', head: '#f1cfae', hair: '#5a3a24', r: 15, time: BITE_TIME, points: 100, label: '' },
  runner: { speed: 315, body: '#5fae6c', head: '#e9c2a0', hair: '#f2d35a', r: 14, time: BITE_TIME, points: 250, label: 'SPRINTER' },
  noble: { speed: 165, body: '#8a4fbf', head: '#f6dcc4', hair: '#e5e5e5', r: 16, time: 5, points: 500, label: 'NOBLE +5s' },
  hunter: { speed: 135, body: '#6b4a2f', head: '#e6b98f', hair: '#2a2a2a', r: 17, time: 5, points: 400, label: 'HUNTER SLAIN' },
};

export class Engine {
  mode: Mode = 'idle';
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: Callbacks;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private last = 0;
  private running = false;

  private bg!: HTMLCanvasElement;
  private bgCtx!: CanvasRenderingContext2D;
  private vignette: HTMLCanvasElement | null = null;

  // world
  private obstacles: Obstacle[] = [];
  private villagers: Villager[] = [];
  private particles: Particle[] = [];
  private texts: FloatText[] = [];

  // player
  private px = WORLD / 2;
  private py = WORLD / 2 + 160;
  private pvx = 0;
  private pvy = 0;
  private facing = -Math.PI / 2;
  private lungeT = 0;
  private lungeCd = 0;
  private lungeDx = 0;
  private lungeDy = -1;
  private stun = 0;
  private bobT = 0;
  private pflash = 0;
  private trail: { x: number; y: number; a: number }[] = [];

  // game state
  private time = START_TIME;
  private score = 0;
  private bites = 0;
  private combo = 0;
  private comboT = 0;
  private maxCombo = 0;
  private elapsed = 0;
  private lastTickSec = -1;
  private heartT = 0;

  // camera & juice
  private camX = WORLD / 2;
  private camY = WORLD / 2;
  private shake = 0;
  private shakeX = 0;
  private shakeY = 0;
  private zoom = 1;
  private hitstop = 0;
  private flashRed = 0;
  private flashWhite = 0;
  private t = 0;

  // input
  private keys = new Set<string>();
  private joyId: number | null = null;
  private joyOx = 0;
  private joyOy = 0;
  private joyDx = 0;
  private joyDy = 0;
  private lungeQueued = false;
  private lastTap = 0;

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.cb = cb;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    this.buildWorld();
    this.buildBackground();
    this.resize();
    this.bindInput();
    this.populateIdle();
  }

  // ------------------------------------------------------------ lifecycle
  run() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const raw = (now - this.last) / 1000;
      this.last = now;
      const dt = Math.min(raw, 1 / 30);
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbindInput();
  }

  start() {
    this.mode = 'playing';
    this.villagers = [];
    this.particles = [];
    this.texts = [];
    this.trail = [];
    this.px = WORLD / 2;
    this.py = WORLD / 2 + 170;
    this.pvx = this.pvy = 0;
    this.facing = -Math.PI / 2;
    this.lungeT = this.lungeCd = this.stun = 0;
    this.time = START_TIME;
    this.score = 0;
    this.bites = 0;
    this.combo = 0;
    this.comboT = 0;
    this.maxCombo = 0;
    this.elapsed = 0;
    this.lastTickSec = -1;
    this.camX = this.px;
    this.camY = this.py;
    this.shake = 0;
    this.zoom = 1.08;
    this.flashWhite = 0.5;
    this.hitstop = 0;
    // fresh blood-free background
    this.buildBackground();
    // starter crowd: close enough that the first bite lands within seconds
    for (let i = 0; i < 9; i++) this.spawnVillager('peasant', 180, 420);
    for (let i = 0; i < 7; i++) this.spawnVillager(this.pickType(), 450, 800);
    for (let i = 0; i < 6; i++) this.spawnVillager(this.pickType(), 800, 1200);
    this.burst(this.px, this.py, 'dust', 14);
    sfx.start();
    this.pushHud();
  }

  togglePause() {
    if (this.mode === 'playing') {
      this.mode = 'paused';
      this.cb.onPause(true);
    } else if (this.mode === 'paused') {
      this.mode = 'playing';
      this.last = performance.now();
      this.cb.onPause(false);
    }
  }

  pause() {
    if (this.mode === 'playing') this.togglePause();
  }

  resume() {
    if (this.mode === 'paused') this.togglePause();
  }

  toIdle() {
    this.mode = 'idle';
    this.populateIdle();
  }

  private endGame() {
    this.mode = 'over';
    this.shake = 14;
    this.flashRed = 0.9;
    this.hitstop = 0.25;
    sfx.gameOver();
    this.burst(this.px, this.py, 'bat', 12);
    this.cb.onGameOver({ score: this.score, bites: this.bites, maxCombo: this.maxCombo, survived: this.elapsed });
  }

  private populateIdle() {
    this.villagers = [];
    for (let i = 0; i < 24; i++) this.spawnVillager(this.pickType(), 100, 1000, true);
  }

  // ------------------------------------------------------------ input
  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(k);
    if (k === ' ' || k === 'shift' || k === 'j' || k === 'k' || k === 'x') {
      if (this.mode === 'playing') this.lungeQueued = true;
    }
    if (k === 'p' || k === 'escape') {
      if (this.mode === 'playing' || this.mode === 'paused') this.togglePause();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private onBlur = () => {
    this.keys.clear();
    this.pause();
  };
  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    sfx.ensure();
    if (this.mode !== 'playing') return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (this.joyId === null) {
      this.joyId = e.pointerId;
      this.joyOx = x;
      this.joyOy = y;
      this.joyDx = this.joyDy = 0;
      // double tap = lunge (for one-thumb play)
      const now = performance.now();
      if (now - this.lastTap < 260) this.lungeQueued = true;
      this.lastTap = now;
      this.canvas.setPointerCapture?.(e.pointerId);
    } else {
      // second finger anywhere = lunge
      this.lungeQueued = true;
    }
  };
  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== this.joyId) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let dx = x - this.joyOx;
    let dy = y - this.joyOy;
    const max = 56;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      // drag the base along so the stick never feels "stuck"
      this.joyOx = x - (dx / d) * max;
      this.joyOy = y - (dy / d) * max;
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    const dead = 6;
    if (d < dead) {
      this.joyDx = this.joyDy = 0;
    } else {
      const mag = Math.min(1, (d - dead) / (max - dead));
      this.joyDx = (dx / d) * mag;
      this.joyDy = (dy / d) * mag;
    }
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.joyDx = this.joyDy = 0;
    }
  };

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
  }
  private unbindInput() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
  }

  /** External lunge trigger (touch button). */
  lunge() {
    if (this.mode === 'playing') this.lungeQueued = true;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, Math.round(rect.width));
    this.h = Math.max(1, Math.round(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.buildVignette();
  }

  // ------------------------------------------------------------ world building
  private buildWorld() {
    this.obstacles = [];
    const c = WORLD / 2;
    this.obstacles.push({ x: c, y: c, r: 58, kind: 'fountain', seed: 1 });
    const crypts = [
      [380, 380],
      [WORLD - 380, 380],
      [380, WORLD - 380],
      [WORLD - 380, WORLD - 380],
    ];
    crypts.forEach(([x, y], i) => this.obstacles.push({ x, y, r: 50, kind: 'crypt', seed: i }));
    let tries = 0;
    while (this.obstacles.length < 5 + 22 && tries < 500) {
      tries++;
      const x = rnd(140, WORLD - 140);
      const y = rnd(140, WORLD - 140);
      // keep the central plaza open
      if (Math.abs(x - c) < 520 && Math.abs(y - c) < 520) continue;
      if (this.obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 150)) continue;
      this.obstacles.push({ x, y, r: 24, kind: 'tree', seed: Math.random() * 1000 });
    }
  }

  private buildBackground() {
    if (!this.bg) {
      this.bg = document.createElement('canvas');
      this.bg.width = WORLD;
      this.bg.height = WORLD;
      const c = this.bg.getContext('2d');
      if (!c) throw new Error('no bg ctx');
      this.bgCtx = c;
    }
    const g = this.bgCtx;
    const c = WORLD / 2;
    // grass base
    g.fillStyle = '#152521';
    g.fillRect(0, 0, WORLD, WORLD);
    // grass texture
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * WORLD;
      const y = Math.random() * WORLD;
      g.fillStyle = Math.random() < 0.5 ? 'rgba(40,80,60,0.35)' : 'rgba(5,15,12,0.4)';
      g.fillRect(x, y, rnd(2, 5), rnd(2, 5));
    }
    // dirt patches
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(70,55,40,0.25)';
      g.beginPath();
      g.ellipse(Math.random() * WORLD, Math.random() * WORLD, rnd(40, 120), rnd(25, 70), Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // paths (cross)
    const pathW = 170;
    const drawStones = (x0: number, y0: number, x1: number, y1: number) => {
      g.fillStyle = '#2f2f3d';
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      const s = 26;
      for (let y = y0; y < y1; y += s) {
        for (let x = x0 + ((y / s) % 2 ? s / 2 : 0); x < x1; x += s) {
          const shade = 45 + Math.random() * 25;
          g.fillStyle = `rgb(${shade},${shade},${shade + 14})`;
          g.fillRect(x + 2, y + 2, s - 4, s - 4);
        }
      }
    };
    drawStones(c - pathW / 2, 0, c + pathW / 2, WORLD);
    drawStones(0, c - pathW / 2, WORLD, c + pathW / 2);
    // plaza
    const plaza = 900;
    drawStones(c - plaza / 2, c - plaza / 2, c + plaza / 2, c + plaza / 2);
    // plaza ring
    g.strokeStyle = 'rgba(120,120,150,0.35)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(c, c, 300, 0, Math.PI * 2);
    g.stroke();
    // gravestones decor around edges
    for (let i = 0; i < 70; i++) {
      const x = rnd(120, WORLD - 120);
      const y = rnd(120, WORLD - 120);
      if (Math.abs(x - c) < 560 && Math.abs(y - c) < 560) continue;
      if (Math.abs(x - c) < pathW || Math.abs(y - c) < pathW) continue;
      if (this.obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 40)) continue;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x - 10, y - 6, 22, 16);
      g.fillStyle = '#6a6f7a';
      g.beginPath();
      if (typeof g.roundRect === 'function') g.roundRect(x - 9, y - 10, 18, 22, 4);
      else g.rect(x - 9, y - 10, 18, 22);
      g.fill();
      g.fillStyle = '#4c515c';
      g.fillRect(x - 3, y - 6, 6, 2);
      g.fillRect(x - 1, y - 8, 2, 8);
    }
    // border wall
    g.strokeStyle = '#3b2f3a';
    g.lineWidth = 40;
    g.strokeRect(20, 20, WORLD - 40, WORLD - 40);
    g.strokeStyle = '#2a1f2a';
    g.lineWidth = 8;
    g.strokeRect(2, 2, WORLD - 4, WORLD - 4);
    // moonlight patches
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * WORLD;
      const y = Math.random() * WORLD;
      const r = rnd(150, 350);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(140,170,220,0.10)');
      grad.addColorStop(1, 'rgba(140,170,220,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  private buildVignette() {
    const v = document.createElement('canvas');
    v.width = Math.max(1, Math.round(this.w / 2));
    v.height = Math.max(1, Math.round(this.h / 2));
    const c = v.getContext('2d');
    if (!c) return;
    const cx = v.width / 2;
    const cy = v.height / 2;
    const r = Math.hypot(cx, cy);
    const grad = c.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    grad.addColorStop(0, 'rgba(8,2,16,0)');
    grad.addColorStop(1, 'rgba(8,2,16,0.85)');
    c.fillStyle = grad;
    c.fillRect(0, 0, v.width, v.height);
    this.vignette = v;
  }

  // ------------------------------------------------------------ spawning
  private pickType(): VType {
    const b = this.bites;
    const runner = clamp(0.12 + b * 0.008, 0.12, 0.34);
    const hunter = clamp(0.05 + b * 0.006, 0.05, 0.22);
    const noble = 0.06;
    const r = Math.random();
    if (r < noble) return 'noble';
    if (r < noble + runner) return 'runner';
    if (r < noble + runner + hunter) return 'hunter';
    return 'peasant';
  }

  private spawnVillager(type: VType, minD: number, maxD: number, anywhere = false) {
    const info = TYPE_INFO[type];
    let x = 0;
    let y = 0;
    for (let i = 0; i < 40; i++) {
      if (anywhere) {
        x = rnd(120, WORLD - 120);
        y = rnd(120, WORLD - 120);
      } else {
        const a = Math.random() * Math.PI * 2;
        const d = rnd(minD, maxD);
        x = this.px + Math.cos(a) * d;
        y = this.py + Math.sin(a) * d;
      }
      if (x < 100 || y < 100 || x > WORLD - 100 || y > WORLD - 100) continue;
      if (this.obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 40)) continue;
      break;
    }
    x = clamp(x, 100, WORLD - 100);
    y = clamp(y, 100, WORLD - 100);
    this.villagers.push({
      x,
      y,
      vx: 0,
      vy: 0,
      r: info.r,
      type,
      state: 'wander',
      speed: info.speed,
      tx: 0,
      ty: 0,
      wanderT: 0,
      panic: 0,
      facing: Math.random() * Math.PI * 2,
      flash: 0,
      bobT: Math.random() * 10,
      corpseT: 0,
      seed: Math.random(),
      cooldown: 0,
      alerted: false,
    });
  }

  private targetPopulation() {
    return 20 + Math.min(12, Math.floor(this.bites / 4));
  }

  // ------------------------------------------------------------ juice helpers
  private burst(x: number, y: number, kind: Particle['kind'], n: number, color?: string) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      let sp = rnd(60, 320);
      let life = rnd(0.35, 0.9);
      let size = rnd(2.5, 6);
      let col = color ?? '#c1121f';
      if (kind === 'bat') {
        sp = rnd(120, 260);
        life = rnd(0.7, 1.3);
        size = rnd(6, 10);
        col = '#0b0610';
      } else if (kind === 'spark') {
        sp = rnd(120, 420);
        life = rnd(0.3, 0.7);
        size = rnd(2, 4);
        col = color ?? '#ffd166';
      } else if (kind === 'garlic') {
        sp = rnd(40, 160);
        life = rnd(0.5, 1.1);
        size = rnd(5, 11);
        col = 'rgba(230,240,200,0.8)';
      } else if (kind === 'dust') {
        sp = rnd(30, 120);
        life = rnd(0.3, 0.6);
        size = rnd(4, 9);
        col = 'rgba(180,170,160,0.45)';
      }
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        maxLife: life,
        size,
        color: col,
        kind,
        rot: Math.random() * Math.PI * 2,
        rotV: rnd(-8, 8),
      });
    }
  }

  private ring(x: number, y: number, color: string, size = 10) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.35, maxLife: 0.35, size, color, kind: 'ring', rot: 0, rotV: 0 });
  }

  private addText(x: number, y: number, text: string, color: string, size = 22, stroke = 'rgba(0,0,0,0.85)') {
    this.texts.push({ x, y, vy: -70, life: 0.9, maxLife: 0.9, text, color, size, stroke });
  }

  private stain(x: number, y: number, size: number) {
    const g = this.bgCtx;
    g.fillStyle = `rgba(${90 + Math.random() * 40},8,14,0.75)`;
    g.beginPath();
    g.ellipse(x, y, size, size * rnd(0.5, 1), Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }

  // ------------------------------------------------------------ gameplay
  private doLunge() {
    this.lungeQueued = false;
    if (this.lungeCd > 0 || this.stun > 0) return;
    this.lungeT = LUNGE_DUR;
    this.lungeCd = LUNGE_CD;
    this.lungeDx = Math.cos(this.facing);
    this.lungeDy = Math.sin(this.facing);
    this.shake = Math.max(this.shake, 3);
    this.burst(this.px - this.lungeDx * 10, this.py - this.lungeDy * 10, 'dust', 8);
    sfx.lunge();
  }

  private bite(v: Villager) {
    const info = TYPE_INFO[v.type];
    v.state = 'bitten';
    v.flash = 1;
    v.vx = v.vy = 0;
    v.corpseT = 0;
    this.bites++;
    this.combo++;
    this.comboT = COMBO_WINDOW;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = Math.min(this.combo, 10);
    const pts = info.points * mult;
    this.score += pts;
    this.time += info.time;

    // juice
    this.hitstop = v.type === 'peasant' ? 0.06 : 0.1;
    this.shake = Math.max(this.shake, v.type === 'peasant' ? 7 : 11);
    this.zoom = 1.05;
    this.flashWhite = 0.12;
    this.pflash = 1;
    const mx = (this.px + v.x) / 2;
    const my = (this.py + v.y) / 2;
    this.burst(mx, my, 'blood', 16 + mult * 2);
    this.ring(mx, my, '#ff3b4a');
    this.stain(v.x, v.y, rnd(10, 18));
    if (this.combo % 5 === 0) {
      this.burst(this.px, this.py, 'spark', 26);
      this.ring(this.px, this.py, '#ffd166', 18);
      sfx.comboMilestone();
    }
    if (v.type !== 'peasant') {
      this.burst(mx, my, 'spark', 14, v.type === 'noble' ? '#e0aaff' : '#ffd166');
      sfx.bonus();
    } else {
      sfx.bite(this.combo);
    }
    // spawn a couple of bats fluttering off
    this.burst(v.x, v.y, 'bat', 2);

    this.addText(v.x, v.y - 24, `+${info.time}s`, '#7CFF9C', 22);
    this.addText(v.x + rnd(-8, 8), v.y - 52, `+${pts}`, '#ffd166', 20);
    if (info.label) this.addText(v.x, v.y - 82, info.label, '#e0aaff', 16);
    if (this.combo >= 2) {
      this.texts.push({
        x: this.px,
        y: this.py - 46,
        vy: -30,
        life: 0.7,
        maxLife: 0.7,
        text: `x${mult}`,
        color: this.combo >= 10 ? '#ff5a7a' : '#ffffff',
        size: 18 + Math.min(this.combo, 10) * 1.6,
        stroke: 'rgba(120,0,20,0.9)',
      });
    }
  }

  private hurt(v: Villager) {
    v.cooldown = 1.6;
    this.time = Math.max(0, this.time - 5);
    this.stun = 0.55;
    this.combo = 0;
    this.comboT = 0;
    const dx = this.px - v.x;
    const dy = this.py - v.y;
    const d = Math.hypot(dx, dy) || 1;
    this.pvx = (dx / d) * 520;
    this.pvy = (dy / d) * 520;
    this.shake = 14;
    this.flashRed = 0.6;
    this.hitstop = 0.09;
    this.burst(this.px, this.py, 'garlic', 18);
    this.ring(this.px, this.py, '#e6f0c8', 14);
    this.addText(this.px, this.py - 40, '-5s  GARLIC!', '#ff5a5a', 24);
    sfx.hurt();
  }

  // ------------------------------------------------------------ update
  private frame(dt: number) {
    this.t += dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.updateCamera(dt, true);
      this.render();
      return;
    }
    if (this.mode === 'playing') this.updatePlaying(dt);
    else if (this.mode === 'idle') this.updateIdle(dt);
    else this.updateFx(dt);
    this.updateCamera(dt, false);
    this.render();
  }

  private updateIdle(dt: number) {
    for (const v of this.villagers) this.updateVillager(v, dt, false);
    this.updateFx(dt);
    // slow drift around the plaza
    this.camX = WORLD / 2 + Math.cos(this.t * 0.12) * 260;
    this.camY = WORLD / 2 + Math.sin(this.t * 0.09) * 200;
  }

  private updateFx(dt: number) {
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        if (p.kind === 'blood' && Math.random() < 0.6) this.stain(p.x, p.y, p.size * 0.9);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      if (p.kind === 'bat') {
        p.rot += dt * 3;
        p.vx += Math.cos(p.rot * 4 + p.x) * 260 * dt;
        p.vy -= 90 * dt;
      } else if (p.kind === 'blood') {
        p.vx *= 1 - 6 * dt;
        p.vy *= 1 - 6 * dt;
      } else if (p.kind === 'garlic' || p.kind === 'dust') {
        p.vx *= 1 - 3 * dt;
        p.vy *= 1 - 3 * dt;
        p.size += 12 * dt;
      } else if (p.kind === 'spark') {
        p.vx *= 1 - 4 * dt;
        p.vy *= 1 - 4 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotV * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const f = this.texts[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 1 - 2.5 * dt;
      if (f.life <= 0) {
        this.texts[i] = this.texts[this.texts.length - 1];
        this.texts.pop();
      }
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].a -= dt * 4;
      if (this.trail[i].a <= 0) this.trail.splice(i, 1);
    }
    this.flashRed = Math.max(0, this.flashRed - dt * 2);
    this.flashWhite = Math.max(0, this.flashWhite - dt * 3);
    this.pflash = Math.max(0, this.pflash - dt * 5);
  }

  private updatePlaying(dt: number) {
    this.elapsed += dt;
    this.time -= dt;
    if (this.time <= 0) {
      this.time = 0;
      this.pushHud();
      this.endGame();
      return;
    }
    // timer ticks
    const sec = Math.ceil(this.time);
    if (sec !== this.lastTickSec) {
      this.lastTickSec = sec;
      if (sec <= 10) sfx.tick(sec <= 5);
    }
    if (this.time < 10) {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        this.heartT = this.time < 5 ? 0.6 : 0.9;
        sfx.heartbeat();
        this.shake = Math.max(this.shake, 1.5);
      }
    }

    // combo
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0 && this.combo > 0) {
        this.combo = 0;
      }
    }

    // ---- player input
    let ix = 0;
    let iy = 0;
    const k = this.keys;
    if (k.has('arrowleft') || k.has('a') || k.has('q')) ix -= 1;
    if (k.has('arrowright') || k.has('d')) ix += 1;
    if (k.has('arrowup') || k.has('w') || k.has('z')) iy -= 1;
    if (k.has('arrowdown') || k.has('s')) iy += 1;
    if (ix !== 0 || iy !== 0) {
      const l = Math.hypot(ix, iy);
      ix /= l;
      iy /= l;
    } else {
      ix = this.joyDx;
      iy = this.joyDy;
    }
    if (this.lungeQueued) this.doLunge();
    this.lungeCd = Math.max(0, this.lungeCd - dt);
    this.stun = Math.max(0, this.stun - dt);

    const inputMag = Math.hypot(ix, iy);
    if (this.stun <= 0 && inputMag > 0.01) {
      this.facing = Math.atan2(iy, ix);
    }
    let tvx = 0;
    let tvy = 0;
    if (this.stun <= 0) {
      tvx = ix * PLAYER_SPEED;
      tvy = iy * PLAYER_SPEED;
    }
    const accel = this.stun > 0 ? 4 : 14;
    this.pvx = lerp(this.pvx, tvx, Math.min(1, dt * accel));
    this.pvy = lerp(this.pvy, tvy, Math.min(1, dt * accel));
    if (this.lungeT > 0) {
      this.lungeT -= dt;
      const f = Math.max(0, this.lungeT / LUNGE_DUR);
      const boost = LUNGE_BOOST * f * f;
      this.pvx += this.lungeDx * boost;
      this.pvy += this.lungeDy * boost;
      this.trail.push({ x: this.px, y: this.py, a: 0.6 });
    }
    this.px += this.pvx * dt;
    this.py += this.pvy * dt;
    // world bounds
    const margin = 44 + PLAYER_R;
    this.px = clamp(this.px, margin, WORLD - margin);
    this.py = clamp(this.py, margin, WORLD - margin);
    // obstacles
    for (const o of this.obstacles) {
      const dx = this.px - o.x;
      const dy = this.py - o.y;
      const d = Math.hypot(dx, dy);
      const min = o.r + PLAYER_R;
      if (d < min && d > 0) {
        this.px = o.x + (dx / d) * min;
        this.py = o.y + (dy / d) * min;
      }
    }
    const speed = Math.hypot(this.pvx, this.pvy);
    this.bobT += dt * (6 + speed * 0.03);

    // ---- villagers
    for (const v of this.villagers) this.updateVillager(v, dt, true);

    // contacts
    for (const v of this.villagers) {
      if (v.state === 'bitten') continue;
      const dx = v.x - this.px;
      const dy = v.y - this.py;
      const d = Math.hypot(dx, dy);
      const reach = PLAYER_R + v.r + (this.lungeT > 0 ? 8 : 0);
      if (d < reach) {
        if (v.type === 'hunter') {
          if (this.lungeT > 0) this.bite(v);
          else if (v.cooldown <= 0) this.hurt(v);
        } else {
          this.bite(v);
        }
      }
    }

    // remove old corpses & far away wanderers, keep population up
    for (let i = this.villagers.length - 1; i >= 0; i--) {
      const v = this.villagers[i];
      if (v.state === 'bitten' && v.corpseT > 9) {
        this.villagers.splice(i, 1);
      }
    }
    const alive = this.villagers.filter((v) => v.state !== 'bitten').length;
    if (alive < this.targetPopulation()) {
      // spawn off-screen-ish, but never too far away
      this.spawnVillager(this.pickType(), 520, 900);
    }

    this.updateFx(dt);
    this.pushHud();
  }

  private updateVillager(v: Villager, dt: number, playerActive: boolean) {
    v.bobT += dt;
    v.flash = Math.max(0, v.flash - dt * 3);
    v.cooldown = Math.max(0, v.cooldown - dt);
    if (v.state === 'bitten') {
      v.corpseT += dt;
      return;
    }
    let dx = 0;
    let dy = 0;
    let d = 9999;
    if (playerActive) {
      dx = v.x - this.px;
      dy = v.y - this.py;
      d = Math.hypot(dx, dy);
    }
    let desiredX = 0;
    let desiredY = 0;
    let speed = v.speed;

    if (v.type === 'hunter' && playerActive) {
      // hunters stalk toward the vampire
      if (d < 460) {
        desiredX = -dx / d;
        desiredY = -dy / d;
        if (!v.alerted) {
          v.alerted = true;
          this.addText(v.x, v.y - 34, '✝', '#e6f0c8', 22);
        }
      } else {
        v.alerted = false;
        this.wander(v, dt);
        desiredX = v.tx;
        desiredY = v.ty;
        speed = 70;
      }
    } else {
      const aware = v.type === 'runner' ? 330 : 270;
      if (d < aware) {
        if (v.panic <= 0 && !v.alerted) {
          v.alerted = true;
          this.addText(v.x, v.y - 30, '!', '#ffe066', 24);
        }
        v.panic = 1.4;
      }
      if (v.panic > 0) {
        v.panic -= dt;
        if (d < 9000) {
          desiredX = dx / d;
          desiredY = dy / d;
          // zig-zag for runners, slight wobble for others
          const wob = v.type === 'runner' ? 0.7 : 0.25;
          const s = Math.sin(this.t * 7 + v.seed * 20) * wob;
          const px = -desiredY;
          const py = desiredX;
          desiredX += px * s;
          desiredY += py * s;
        }
        if (v.panic <= 0) v.alerted = false;
      } else {
        this.wander(v, dt);
        desiredX = v.tx;
        desiredY = v.ty;
        speed = v.type === 'runner' ? 95 : 65;
      }
    }

    // wall avoidance
    const wallD = 130;
    if (v.x < wallD) desiredX += ((wallD - v.x) / wallD) * 2.2;
    if (v.x > WORLD - wallD) desiredX -= ((v.x - (WORLD - wallD)) / wallD) * 2.2;
    if (v.y < wallD) desiredY += ((wallD - v.y) / wallD) * 2.2;
    if (v.y > WORLD - wallD) desiredY -= ((v.y - (WORLD - wallD)) / wallD) * 2.2;
    // obstacle avoidance
    for (const o of this.obstacles) {
      const ox = v.x - o.x;
      const oy = v.y - o.y;
      const od = Math.hypot(ox, oy);
      const range = o.r + 70;
      if (od < range && od > 0) {
        const f = (range - od) / range;
        desiredX += (ox / od) * f * 2;
        desiredY += (oy / od) * f * 2;
      }
    }
    const dl = Math.hypot(desiredX, desiredY);
    if (dl > 0) {
      desiredX /= dl;
      desiredY /= dl;
    }
    const steer = v.panic > 0 ? 9 : 4;
    v.vx = lerp(v.vx, desiredX * speed, Math.min(1, dt * steer));
    v.vy = lerp(v.vy, desiredY * speed, Math.min(1, dt * steer));
    v.x += v.vx * dt;
    v.y += v.vy * dt;
    const sp = Math.hypot(v.vx, v.vy);
    if (sp > 5) v.facing = Math.atan2(v.vy, v.vx);
    // hard bounds and obstacle push-out
    const m = 48 + v.r;
    v.x = clamp(v.x, m, WORLD - m);
    v.y = clamp(v.y, m, WORLD - m);
    for (const o of this.obstacles) {
      const ox = v.x - o.x;
      const oy = v.y - o.y;
      const od = Math.hypot(ox, oy);
      const min = o.r + v.r;
      if (od < min && od > 0) {
        v.x = o.x + (ox / od) * min;
        v.y = o.y + (oy / od) * min;
      }
    }
  }

  private wander(v: Villager, dt: number) {
    v.wanderT -= dt;
    if (v.wanderT <= 0) {
      v.wanderT = rnd(1.2, 3.2);
      if (Math.random() < 0.25) {
        v.tx = 0;
        v.ty = 0;
      } else {
        const a = Math.random() * Math.PI * 2;
        v.tx = Math.cos(a);
        v.ty = Math.sin(a);
      }
    }
  }

  private updateCamera(dt: number, frozen: boolean) {
    if (this.mode === 'playing' || this.mode === 'over' || this.mode === 'paused') {
      if (!frozen) {
        const lookX = this.pvx * 0.22;
        const lookY = this.pvy * 0.22;
        const k = Math.min(1, dt * 6);
        this.camX = lerp(this.camX, this.px + lookX, k);
        this.camY = lerp(this.camY, this.py + lookY, k);
      }
    }
    const halfW = this.w / 2 / this.zoom;
    const halfH = this.h / 2 / this.zoom;
    this.camX = clamp(this.camX, Math.min(halfW, WORLD / 2), Math.max(WORLD - halfW, WORLD / 2));
    this.camY = clamp(this.camY, Math.min(halfH, WORLD / 2), Math.max(WORLD - halfH, WORLD / 2));
    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.shake > 0) {
      this.shakeX = rnd(-1, 1) * this.shake;
      this.shakeY = rnd(-1, 1) * this.shake;
    } else {
      this.shakeX = this.shakeY = 0;
    }
    this.zoom = lerp(this.zoom, 1, Math.min(1, dt * 5));
  }

  private pushHud() {
    this.cb.onHud({
      time: this.time,
      score: this.score,
      bites: this.bites,
      combo: this.combo,
      comboFrac: this.comboT / COMBO_WINDOW,
      lungeFrac: 1 - this.lungeCd / LUNGE_CD,
      mult: Math.min(Math.max(this.combo, 1), 10),
    });
  }

  // ------------------------------------------------------------ render
  private render() {
    const c = this.ctx;
    const { w, h } = this;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#07030c';
    c.fillRect(0, 0, w, h);

    const z = this.zoom;
    const camX = this.camX + this.shakeX;
    const camY = this.camY + this.shakeY;
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(z, z);
    c.translate(-camX, -camY);

    // visible world rect
    const vx0 = camX - w / 2 / z;
    const vy0 = camY - h / 2 / z;
    const vw = w / z;
    const vh = h / z;

    // background slice
    const sx = clamp(vx0, 0, WORLD);
    const sy = clamp(vy0, 0, WORLD);
    const sw = clamp(vx0 + vw, 0, WORLD) - sx;
    const sh = clamp(vy0 + vh, 0, WORLD) - sy;
    if (sw > 0 && sh > 0) c.drawImage(this.bg, sx, sy, sw, sh, sx, sy, sw, sh);

    const inView = (x: number, y: number, pad: number) =>
      x > vx0 - pad && x < vx0 + vw + pad && y > vy0 - pad && y < vy0 + vh + pad;

    // corpses first (they lie on the ground)
    for (const v of this.villagers) {
      if (v.state === 'bitten' && inView(v.x, v.y, 60)) this.drawCorpse(c, v);
    }
    // obstacle bases
    for (const o of this.obstacles) {
      if (inView(o.x, o.y, 120)) this.drawObstacleBase(c, o);
    }
    // lunge trail
    for (const tr of this.trail) {
      c.fillStyle = `rgba(160,20,40,${tr.a * 0.5})`;
      c.beginPath();
      c.arc(tr.x, tr.y, PLAYER_R * tr.a * 1.4, 0, Math.PI * 2);
      c.fill();
    }
    // entities sorted by y
    const alive = this.villagers.filter((v) => v.state !== 'bitten' && inView(v.x, v.y, 60));
    alive.sort((a, b) => a.y - b.y);
    const showPlayer = this.mode !== 'idle';
    let playerDrawn = !showPlayer;
    for (const v of alive) {
      if (!playerDrawn && v.y > this.py) {
        this.drawPlayer(c);
        playerDrawn = true;
      }
      this.drawVillager(c, v);
    }
    if (!playerDrawn) this.drawPlayer(c);
    // canopies over everything
    for (const o of this.obstacles) {
      if (o.kind === 'tree' && inView(o.x, o.y, 120)) this.drawCanopy(c, o);
    }
    // particles
    this.drawParticles(c);
    // floating texts
    for (const f of this.texts) {
      const a = Math.min(1, f.life / (f.maxLife * 0.4));
      const pop = 1 + Math.max(0, (f.life - f.maxLife * 0.8) / (f.maxLife * 0.2)) * 0.6;
      c.globalAlpha = a;
      c.font = `900 ${f.size * pop}px "Cinzel", "Georgia", serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 4;
      c.strokeStyle = f.stroke;
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
    c.restore();

    // joystick
    if (this.joyId !== null && this.mode === 'playing') {
      c.globalAlpha = 0.35;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(this.joyOx, this.joyOy, 56, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 0.55;
      c.fillStyle = '#ff3b4a';
      c.beginPath();
      c.arc(this.joyOx + this.joyDx * 56, this.joyOy + this.joyDy * 56, 22, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }

    // vignette
    if (this.vignette) c.drawImage(this.vignette, 0, 0, w, h);
    // low-time pulse
    if (this.mode === 'playing' && this.time < 10) {
      const pulse = (Math.sin(this.t * (this.time < 5 ? 10 : 6)) + 1) / 2;
      const a = (0.12 + pulse * 0.2) * (1 - this.time / 10);
      const grad = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
      grad.addColorStop(0, 'rgba(180,0,20,0)');
      grad.addColorStop(1, `rgba(180,0,20,${a})`);
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);
    }
    if (this.flashRed > 0) {
      c.fillStyle = `rgba(200,10,30,${this.flashRed * 0.35})`;
      c.fillRect(0, 0, w, h);
    }
    if (this.flashWhite > 0) {
      c.fillStyle = `rgba(255,240,240,${this.flashWhite * 0.5})`;
      c.fillRect(0, 0, w, h);
    }
  }

  private drawShadow(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(x + 3, y + r * 0.55, r * 1.05, r * 0.5, 0, 0, Math.PI * 2);
    c.fill();
  }

  private drawPlayer(c: CanvasRenderingContext2D) {
    const x = this.px;
    const y = this.py;
    const r = PLAYER_R;
    const speed = Math.hypot(this.pvx, this.pvy);
    const moving = speed > 20;
    const bob = moving ? Math.sin(this.bobT * 2) * 1.5 : Math.sin(this.t * 3) * 0.8;
    const lungeF = this.lungeT > 0 ? this.lungeT / LUNGE_DUR : 0;
    this.drawShadow(c, x, y, r);
    c.save();
    c.translate(x, y + bob);
    c.rotate(this.facing);
    // squash & stretch along facing during lunge
    const sx = 1 + lungeF * 0.35;
    const sy = 1 - lungeF * 0.25;
    c.scale(sx, sy);
    if (this.stun > 0) c.rotate(Math.sin(this.t * 40) * 0.15);
    // cape (trailing behind)
    const flare = 1 + Math.min(speed / PLAYER_SPEED, 1.4) * 0.5;
    c.fillStyle = '#12060f';
    c.beginPath();
    c.moveTo(-r * 0.2, -r * 1.05);
    c.quadraticCurveTo(-r * 1.6 * flare, -r * 0.9 * flare, -r * 1.9 * flare, -r * 0.3 + Math.sin(this.bobT * 2.3) * 2);
    c.lineTo(-r * 1.45 * flare, 0);
    c.lineTo(-r * 1.9 * flare, r * 0.3 + Math.cos(this.bobT * 2.1) * 2);
    c.quadraticCurveTo(-r * 1.6 * flare, r * 0.9 * flare, -r * 0.2, r * 1.05);
    c.closePath();
    c.fill();
    c.fillStyle = '#8b0f1f';
    c.beginPath();
    c.moveTo(-r * 0.3, -r * 0.8);
    c.quadraticCurveTo(-r * 1.3 * flare, -r * 0.5 * flare, -r * 1.4 * flare, 0);
    c.quadraticCurveTo(-r * 1.3 * flare, r * 0.5 * flare, -r * 0.3, r * 0.8);
    c.closePath();
    c.fill();
    // body / shoulders
    c.fillStyle = this.pflash > 0.5 ? '#ffffff' : '#1a0b18';
    c.beginPath();
    c.ellipse(0, 0, r * 0.95, r * 1.1, 0, 0, Math.PI * 2);
    c.fill();
    // collar
    c.fillStyle = '#c4162b';
    c.beginPath();
    c.moveTo(-r * 0.1, -r * 1.05);
    c.lineTo(r * 0.55, -r * 0.55);
    c.lineTo(r * 0.15, -r * 0.35);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(-r * 0.1, r * 1.05);
    c.lineTo(r * 0.55, r * 0.55);
    c.lineTo(r * 0.15, r * 0.35);
    c.closePath();
    c.fill();
    // head
    const hx = r * 0.25;
    c.fillStyle = '#e9e0f2';
    c.beginPath();
    c.arc(hx, 0, r * 0.66, 0, Math.PI * 2);
    c.fill();
    // slick hair (back half + widow's peak)
    c.fillStyle = '#0a0410';
    c.beginPath();
    c.arc(hx, 0, r * 0.66, Math.PI * 0.55, Math.PI * 1.45);
    c.lineTo(hx - r * 0.05, 0);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(hx - r * 0.2, -r * 0.62);
    c.lineTo(hx + r * 0.25, 0);
    c.lineTo(hx - r * 0.2, r * 0.62);
    c.lineTo(hx - r * 0.5, 0);
    c.closePath();
    c.fill();
    // eyes (glow harder when hungry)
    const hungry = this.mode === 'playing' ? clamp(1 - this.time / 20, 0, 1) : 0;
    c.fillStyle = '#ff2a3c';
    c.shadowColor = '#ff2a3c';
    c.shadowBlur = 6 + hungry * 10 + lungeF * 8;
    c.beginPath();
    c.arc(hx + r * 0.42, -r * 0.24, r * 0.11, 0, Math.PI * 2);
    c.arc(hx + r * 0.42, r * 0.24, r * 0.11, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    // fangs when lunging / hungry
    if (lungeF > 0 || hungry > 0.5) {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(hx + r * 0.62, -r * 0.12);
      c.lineTo(hx + r * 0.82, -r * 0.06);
      c.lineTo(hx + r * 0.62, 0);
      c.moveTo(hx + r * 0.62, r * 0.12);
      c.lineTo(hx + r * 0.82, r * 0.06);
      c.lineTo(hx + r * 0.62, 0);
      c.fill();
    }
    c.restore();
    // lunge-ready indicator: subtle pulse ring
    if (this.mode === 'playing' && this.lungeCd <= 0 && this.lungeT <= 0) {
      c.globalAlpha = 0.18 + (Math.sin(this.t * 6) + 1) * 0.08;
      c.strokeStyle = '#ff3b4a';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y, r + 8, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  private drawVillager(c: CanvasRenderingContext2D, v: Villager) {
    const info = TYPE_INFO[v.type];
    const sp = Math.hypot(v.vx, v.vy);
    const bob = sp > 10 ? Math.sin(v.bobT * (v.panic > 0 ? 22 : 10)) * 2 : 0;
    this.drawShadow(c, v.x, v.y, v.r);
    // hunter danger aura
    if (v.type === 'hunter') {
      const pulse = (Math.sin(this.t * 5 + v.seed * 10) + 1) / 2;
      c.globalAlpha = 0.25 + pulse * 0.2;
      c.strokeStyle = '#d9f0a3';
      c.lineWidth = 2;
      c.setLineDash([6, 6]);
      c.beginPath();
      c.arc(v.x, v.y, v.r + 14 + pulse * 3, this.t * 2, this.t * 2 + Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 1;
    }
    c.save();
    c.translate(v.x, v.y + bob);
    c.rotate(v.facing);
    // panic squash
    if (v.panic > 0) c.scale(1.08, 0.94);
    // body
    c.fillStyle = v.flash > 0 ? '#ffffff' : info.body;
    c.beginPath();
    c.ellipse(0, 0, v.r * 0.9, v.r, 0, 0, Math.PI * 2);
    c.fill();
    // arms flail while fleeing
    if (v.panic > 0 && v.type !== 'hunter') {
      c.strokeStyle = info.head;
      c.lineWidth = 3.5;
      c.lineCap = 'round';
      const a = Math.sin(v.bobT * 24) * 0.7;
      c.beginPath();
      c.moveTo(0, -v.r * 0.7);
      c.lineTo(v.r * 0.5 + a * 4, -v.r * 1.3);
      c.moveTo(0, v.r * 0.7);
      c.lineTo(v.r * 0.5 - a * 4, v.r * 1.3);
      c.stroke();
    }
    // head
    const hx = v.r * 0.2;
    c.fillStyle = info.head;
    c.beginPath();
    c.arc(hx, 0, v.r * 0.6, 0, Math.PI * 2);
    c.fill();
    // hair (back half)
    c.fillStyle = info.hair;
    c.beginPath();
    c.arc(hx, 0, v.r * 0.6, Math.PI * 0.5, Math.PI * 1.5);
    c.closePath();
    c.fill();
    if (v.type === 'noble') {
      // crown
      c.fillStyle = '#ffd24a';
      c.beginPath();
      c.moveTo(hx - v.r * 0.55, -v.r * 0.35);
      c.lineTo(hx - v.r * 0.25, -v.r * 0.1);
      c.lineTo(hx - v.r * 0.55, 0);
      c.lineTo(hx - v.r * 0.25, v.r * 0.1);
      c.lineTo(hx - v.r * 0.55, v.r * 0.35);
      c.lineTo(hx - v.r * 0.8, v.r * 0.25);
      c.lineTo(hx - v.r * 0.8, -v.r * 0.25);
      c.closePath();
      c.fill();
    } else if (v.type === 'hunter') {
      // wide brim hat
      c.fillStyle = '#1d1410';
      c.beginPath();
      c.arc(hx, 0, v.r * 0.85, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#2f221a';
      c.beginPath();
      c.arc(hx, 0, v.r * 0.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#8b1a1a';
      c.fillRect(hx - v.r * 0.55, -v.r * 0.1, v.r * 1.1, v.r * 0.2);
    } else if (v.type === 'runner') {
      // headband
      c.fillStyle = '#e23b3b';
      c.fillRect(hx - v.r * 0.1, -v.r * 0.62, v.r * 0.22, v.r * 1.24);
    }
    // eyes
    c.fillStyle = '#1a1a1a';
    const eyeSize = v.panic > 0 ? 2.2 : 1.5;
    c.beginPath();
    c.arc(hx + v.r * 0.4, -v.r * 0.22, eyeSize, 0, Math.PI * 2);
    c.arc(hx + v.r * 0.4, v.r * 0.22, eyeSize, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  private drawCorpse(c: CanvasRenderingContext2D, v: Villager) {
    const info = TYPE_INFO[v.type];
    const a = clamp(1 - (v.corpseT - 6) / 3, 0, 1);
    c.globalAlpha = a;
    c.save();
    c.translate(v.x, v.y);
    c.rotate(v.facing + Math.PI / 2 + v.seed * 0.6);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath();
    c.ellipse(2, 3, v.r * 1.3, v.r * 0.8, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = info.body;
    c.beginPath();
    c.ellipse(0, 0, v.r * 1.25, v.r * 0.75, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#d9d3e6';
    c.beginPath();
    c.arc(v.r * 1.1, 0, v.r * 0.55, 0, Math.PI * 2);
    c.fill();
    // x eyes
    c.strokeStyle = '#333';
    c.lineWidth = 1.5;
    const ex = v.r * 1.1;
    c.beginPath();
    c.moveTo(ex - 5, -4);
    c.lineTo(ex - 1, 0);
    c.moveTo(ex - 1, -4);
    c.lineTo(ex - 5, 0);
    c.moveTo(ex + 1, -4);
    c.lineTo(ex + 5, 0);
    c.moveTo(ex + 5, -4);
    c.lineTo(ex + 1, 0);
    c.stroke();
    // neck bite
    c.fillStyle = '#b3121f';
    c.beginPath();
    c.arc(v.r * 0.55, 3, 2, 0, Math.PI * 2);
    c.arc(v.r * 0.55, 8, 2, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.globalAlpha = 1;
  }

  private drawObstacleBase(c: CanvasRenderingContext2D, o: Obstacle) {
    if (o.kind === 'tree') {
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.beginPath();
      c.ellipse(o.x + 10, o.y + 12, 50, 30, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3a2a1e';
      c.beginPath();
      c.arc(o.x, o.y, 14, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#2a1d14';
      c.beginPath();
      c.arc(o.x - 3, o.y - 3, 8, 0, Math.PI * 2);
      c.fill();
    } else if (o.kind === 'fountain') {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.arc(o.x + 6, o.y + 8, o.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#5c5f75';
      c.beginPath();
      c.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#1d3a5a';
      c.beginPath();
      c.arc(o.x, o.y, o.r - 12, 0, Math.PI * 2);
      c.fill();
      // ripples
      c.strokeStyle = 'rgba(160,200,255,0.35)';
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const rr = ((this.t * 18 + i * 14) % 42) + 4;
        c.globalAlpha = 1 - rr / 46;
        c.beginPath();
        c.arc(o.x, o.y, rr, 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.fillStyle = '#7a7d95';
      c.beginPath();
      c.arc(o.x, o.y, 12, 0, Math.PI * 2);
      c.fill();
      // blood-red glint
      c.fillStyle = '#9b1020';
      c.beginPath();
      c.arc(o.x, o.y, 5, 0, Math.PI * 2);
      c.fill();
    } else {
      // crypt
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillRect(o.x - 44, o.y - 34, 100, 84);
      c.fillStyle = '#4b4f5e';
      c.fillRect(o.x - 50, o.y - 40, 100, 80);
      c.fillStyle = '#5d6273';
      c.fillRect(o.x - 44, o.y - 34, 88, 68);
      c.fillStyle = '#2a2d38';
      c.fillRect(o.x - 14, o.y + 6, 28, 28);
      c.fillStyle = '#7d8294';
      c.fillRect(o.x - 3, o.y - 30, 6, 26);
      c.fillRect(o.x - 12, o.y - 22, 24, 6);
      // eerie glow from door
      const pulse = (Math.sin(this.t * 2 + o.seed) + 1) / 2;
      c.fillStyle = `rgba(120,255,160,${0.15 + pulse * 0.15})`;
      c.fillRect(o.x - 10, o.y + 10, 20, 20);
    }
  }

  private drawCanopy(c: CanvasRenderingContext2D, o: Obstacle) {
    const sway = Math.sin(this.t * 1.3 + o.seed) * 3;
    c.globalAlpha = 0.92;
    c.fillStyle = '#1e3a2a';
    c.beginPath();
    c.arc(o.x + sway, o.y - 6, 52, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2a5038';
    c.beginPath();
    c.arc(o.x + sway - 10, o.y - 14, 34, 0, Math.PI * 2);
    c.arc(o.x + sway + 16, o.y - 2, 30, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#3a6a48';
    c.beginPath();
    c.arc(o.x + sway - 16, o.y - 22, 14, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }

  private drawParticles(c: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const f = p.life / p.maxLife;
      if (p.kind === 'ring') {
        c.globalAlpha = f;
        c.strokeStyle = p.color;
        c.lineWidth = 3 * f + 1;
        c.beginPath();
        c.arc(p.x, p.y, p.size + (1 - f) * 70, 0, Math.PI * 2);
        c.stroke();
        continue;
      }
      if (p.kind === 'bat') {
        c.globalAlpha = Math.min(1, f * 2);
        c.fillStyle = p.color;
        c.save();
        c.translate(p.x, p.y);
        const flap = Math.sin(this.t * 30 + p.rot) * 0.6;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(-p.size * 0.6, -p.size * (0.8 + flap), -p.size * 1.3, -p.size * 0.2);
        c.quadraticCurveTo(-p.size * 0.5, -p.size * 0.1, 0, p.size * 0.3);
        c.quadraticCurveTo(p.size * 0.5, -p.size * 0.1, p.size * 1.3, -p.size * 0.2);
        c.quadraticCurveTo(p.size * 0.6, -p.size * (0.8 + flap), 0, 0);
        c.fill();
        c.restore();
        continue;
      }
      c.globalAlpha = p.kind === 'blood' ? Math.min(1, f * 1.5) : f;
      c.fillStyle = p.color;
      c.beginPath();
      if (p.kind === 'spark') {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillRect(-p.size, -p.size * 0.35, p.size * 2.2, p.size * 0.7);
        c.restore();
      } else {
        c.arc(p.x, p.y, p.size * (p.kind === 'blood' ? 0.5 + f * 0.5 : 1), 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;
  }
}
