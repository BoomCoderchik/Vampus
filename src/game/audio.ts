// Tiny procedural sound engine – no assets needed.
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('vamp-muted') === '1';
    } catch {
      /* ignore */
    }
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem('vamp-muted', m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.02);
    }
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    vol: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterType: BiquadFilterType, f0: number, f1: number, delay = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  bite(combo: number) {
    this.ensure();
    // wet chomp: thump + noise crunch
    this.tone('sine', 180, 50, 0.14, 0.7);
    this.noise(0.09, 0.5, 'bandpass', 2200, 600);
    // rising ping that climbs with combo
    const step = Math.min(combo, 12);
    const f = 440 * Math.pow(2, step / 12);
    this.tone('triangle', f, f * 1.01, 0.18, 0.25, 0.03);
  }

  bonus() {
    this.ensure();
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.tone('triangle', n, n, 0.22, 0.25, i * 0.06));
    this.noise(0.25, 0.15, 'highpass', 3000, 6000);
  }

  lunge() {
    this.ensure();
    this.noise(0.2, 0.35, 'highpass', 300, 4000);
    this.tone('sine', 220, 440, 0.12, 0.12);
  }

  hurt() {
    this.ensure();
    this.tone('sawtooth', 220, 70, 0.35, 0.35);
    this.tone('square', 110, 55, 0.3, 0.2);
    this.noise(0.3, 0.3, 'lowpass', 1200, 200);
  }

  tick(urgent: boolean) {
    this.ensure();
    this.tone('square', urgent ? 1200 : 900, urgent ? 900 : 700, 0.05, urgent ? 0.12 : 0.06);
  }

  heartbeat() {
    this.ensure();
    this.tone('sine', 70, 40, 0.16, 0.5);
    this.tone('sine', 65, 38, 0.14, 0.4, 0.2);
  }

  comboMilestone() {
    this.ensure();
    [660, 880, 1320].forEach((n, i) => this.tone('square', n, n, 0.12, 0.12, i * 0.05));
  }

  start() {
    this.ensure();
    [196, 247, 294, 392].forEach((n, i) => this.tone('triangle', n, n, 0.3, 0.2, i * 0.08));
    this.noise(0.4, 0.12, 'bandpass', 400, 1500);
  }

  gameOver() {
    this.ensure();
    [392, 330, 262, 196].forEach((n, i) => this.tone('sawtooth', n, n * 0.97, 0.45, 0.18, i * 0.18));
    this.tone('sine', 60, 30, 1.2, 0.4, 0.6);
  }

  ui() {
    this.ensure();
    this.tone('triangle', 600, 900, 0.07, 0.12);
  }
}

export const sfx = new Sfx();
