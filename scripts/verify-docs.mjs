#!/usr/bin/env node
/**
 * Verifies that docs/css/tokens.css still matches the real game.
 *   - gameplay constants and per-type stats are parsed out of src/game/engine.ts
 *   - palette values are compared with the hex literals in engine.ts / index.css
 *   - every CSS file in docs/css is checked for balanced braces, and every
 *     var(--fr-*) reference must resolve to a declared custom property
 * Exit code 1 on any mismatch. Usage: npm run docs:check
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

const engine = read('src/game/engine.ts');
const indexCss = read('src/index.css');
const cssFiles = ['docs/css/tokens.css', 'docs/css/models.css', 'docs/css/components.css'];
const css = Object.fromEntries(cssFiles.map((f) => [f, read(f)]));

const failures = [];
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  if (String(actual) !== String(expected)) failures.push(`${label}: tokens say ${expected}, code says ${actual}`);
};

// ---- custom properties declared in tokens.css --------------------------------
const tokens = new Map();
for (const m of css['docs/css/tokens.css'].matchAll(/(--fr-[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(m[1], m[2].trim());
const tok = (name) => {
  if (!tokens.has(name)) { failures.push(`missing token ${name}`); checks++; return undefined; }
  return tokens.get(name);
};

// ---- gameplay constants ----------------------------------------------------------
const constant = (name) => {
  const m = engine.match(new RegExp(`const ${name} = ([\\d.]+);`));
  if (!m) throw new Error(`const ${name} not found in engine.ts`);
  return Number(m[1]);
};
const pairs = {
  WORLD: '--fr-gm-world-n',
  START_TIME: '--fr-gm-start-time-n',
  BITE_TIME: '--fr-gm-bite-time-n',
  PLAYER_R: '--fr-gm-player-r-n',
  PLAYER_SPEED: '--fr-gm-player-speed-n',
  LUNGE_DUR: '--fr-gm-lunge-dur-n',
  LUNGE_BOOST: '--fr-gm-lunge-boost-n',
  LUNGE_CD: '--fr-gm-lunge-cd-n',
  COMBO_WINDOW: '--fr-gm-combo-window-n',
  MAX_PARTICLES: '--fr-gm-max-particles-n',
};
for (const [c, t] of Object.entries(pairs)) eq(c, constant(c), tok(t));
eq('PLAYER_R → --fr-r-player', constant('PLAYER_R') + 'px', tok('--fr-r-player'));

// ---- per-type stats -------------------------------------------------------------------
const info = {};
for (const m of engine.matchAll(/^\s{2}(peasant|runner|noble|hunter): \{ speed: (\d+), body: '(#[0-9a-f]{6})', head: '(#[0-9a-f]{6})', hair: '(#[0-9a-f]{6})', r: (\d+), time: (\w+), points: (\d+)/gm)) {
  info[m[1]] = { speed: +m[2], body: m[3], head: m[4], hair: m[5], r: +m[6], time: m[7] === 'BITE_TIME' ? constant('BITE_TIME') : +m[7], points: +m[8] };
}
for (const t of ['peasant', 'runner', 'noble', 'hunter']) {
  if (!info[t]) { failures.push(`TYPE_INFO.${t} not parsed`); continue; }
  const i = info[t];
  eq(`${t}.speed`, i.speed, tok(`--fr-gm-speed-${t}-n`));
  eq(`${t}.points`, i.points, tok(`--fr-gm-points-${t}-n`));
  eq(`${t}.time`, i.time, tok(`--fr-gm-time-${t}-n`));
  eq(`${t}.r`, i.r + 'px', tok(`--fr-r-${t}`));
  eq(`${t}.body`, i.body, tok(`--fr-p-${t}-body`));
  eq(`${t}.head`, i.head, tok(`--fr-p-${t}-head`));
  eq(`${t}.hair`, i.hair, tok(`--fr-p-${t}-hair`));
}

// ---- brand palette vs src/index.css ---------------------------------------------------
const rootVars = Object.fromEntries([...indexCss.matchAll(/--(blood-bright|blood|gold|bone|night):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
eq('--blood', rootVars.blood, tok('--fr-p-blood-600'));
eq('--blood-bright', rootVars['blood-bright'], tok('--fr-p-blood-400'));
eq('--gold', rootVars.gold, tok('--fr-p-gold-400'));
eq('--bone', rootVars.bone, tok('--fr-p-bone-100'));
eq('--night', rootVars.night, tok('--fr-p-night-950'));

// ---- hard-coded literals that also live in the canvas code -------------------------------
const literal = (label, hex, token) => {
  checks++;
  if (!engine.includes(`'${hex}'`) && !engine.includes(`#${hex.slice(1)}`)) failures.push(`${label}: ${hex} no longer appears in engine.ts`);
  eq(label, hex, tok(token));
};
literal('vampire cape', '#12060f', '--fr-p-night-850');
literal('vampire body', '#1a0b18', '--fr-p-night-750');
literal('vampire hair', '#0a0410', '--fr-p-night-900');
literal('cape lining', '#8b0f1f', '--fr-p-blood-800');
literal('vampire eyes', '#ff2a3c', '--fr-p-blood-300');
literal('grass base', '#152521', '--fr-p-grass-base');
literal('noble crown', '#ffd24a', '--fr-p-gold-crown');
literal('canopy 1', '#1e3a2a', '--fr-p-canopy-1');
literal('fountain rim', '#5c5f75', '--fr-p-fountain-rim');
literal('crypt wall', '#4b4f5e', '--fr-p-crypt-wall');
literal('hunter aura', '#d9f0a3', '--fr-p-garlic-200');

// ---- structural CSS checks ---------------------------------------------------------------------
for (const [file, text] of Object.entries(css)) {
  checks++;
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const open = (stripped.match(/{/g) || []).length;
  const close = (stripped.match(/}/g) || []).length;
  if (open !== close) failures.push(`${file}: unbalanced braces (${open} “{” vs ${close} “}”)`);
  for (const m of stripped.matchAll(/var\((--fr-[\w-]+)/g)) {
    checks++;
    const declaredHere = new RegExp(`${m[1]}\\s*:`).test(Object.values(css).join('\n'));
    if (!declaredHere) failures.push(`${file}: var(${m[1]}) is never declared`);
  }
}

console.log(`${checks} checks, ${failures.length} failure(s)`);
for (const f of failures) console.log('  ✗ ' + f);
process.exit(failures.length ? 1 : 0);
