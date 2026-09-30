#!/usr/bin/env node
/** WCAG 2.x contrast ratios for the Fang Rush palette. Usage: node scripts/contrast.mjs */
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const mix = (fg, bg, a) => fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const panel = hex('#0c0512');          // panel gradient end (rgb 12,5,18)
const canvasGrass = hex('#152521');
const white = [255, 255, 255];
const rows = [
  ['bone #e9e0f2 on panel', hex('#e9e0f2'), panel],
  ['gold #ffd166 on panel', hex('#ffd166'), panel],
  ['blood-bright #ff3b4a on panel', hex('#ff3b4a'), panel],
  ['gain green #7cff9c on panel', hex('#7cff9c'), panel],
  ['loss red #ff5a5a on panel', hex('#ff5a5a'), panel],
  ['white/80 on panel', mix(white, panel, 0.8), panel],
  ['white/60 on panel', mix(white, panel, 0.6), panel],
  ['white/50 on panel', mix(white, panel, 0.5), panel],
  ['white/40 on panel (captions)', mix(white, panel, 0.4), panel],
  ['white/35 on panel (key hints)', mix(white, panel, 0.35), panel],
  ['white/30 on grass (HUD key hint, approx.)', mix(white, canvasGrass, 0.3), canvasGrass],
  ['white on brand button #c4162b', white, hex('#c4162b')],
  ['white on button gradient end #9c0f20', white, hex('#9c0f20')],
  ['white on active tab #c4162b', white, hex('#c4162b')],
];
for (const [label, fg, bg] of rows) {
  const r = ratio(fg, bg);
  console.log(`${r.toFixed(2).padStart(6)}:1  ${r >= 7 ? 'AAA' : r >= 4.5 ? 'AA ' : r >= 3 ? 'AA-large only' : 'FAIL'}  ${label}`);
}
