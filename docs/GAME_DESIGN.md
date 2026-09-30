# Fang Rush — Game Design Document

> Working title in the repo: **Vampus**. Shipped title: **Fang Rush — Vampire Bite Frenzy**.
> Every number in this document is taken from the code (`src/game/engine.ts`, `src/game/audio.ts`,
> `src/game/highscores.ts`, `src/App.tsx`) and the tokens in [`docs/css/tokens.css`](css/tokens.css)
> (checked by `npm run docs:check`). Where something is a design *intent* rather than a code fact it is marked **(intent)**.

![gameplay](img/gameplay.png)

---

## 1. Concept

**One-line pitch.** You are a starving vampire with 60 seconds of night left. Every bite buys time — bite fast, chain combos, dodge the garlic-wielding hunters, and squeeze out one more feeding before the sun rises.

**Genre.** Top-down arcade score-attacker ("one more run"), 2D canvas, desktop + mobile web.

**Audience (intent).** Casual players, 1–3 minute sessions, keyboard or one-thumb touch. No account, no install, no server.

**Fantasy.** Predator, not hero. The vampire is fast, hungry, theatrical (cape, glowing eyes, bats bursting away from each bite). The villagers are comic-panic prey — never gory beyond stylised red splashes.

**Tone.** Gothic-pulp with a wink: *"You have 60 seconds to live. Every bite buys +3 s. Feast."* / *"THE SUN RISES — you starved in the dawn light"* / *"not enough to be remembered…"*.

### 1.1 Design pillars

| # | Pillar | What it means in practice |
|---|---|---|
| 1 | **Hunger is the clock** | There is no health bar. Time *is* health: it drains 1 s/s, bites refill it, garlic burns it. One resource, instantly readable. |
| 2 | **Momentum is the reward** | Combo window (2.6 s), ×10 cap, lunge dash, camera look-ahead and zoom kicks all reward continuous, flowing movement. |
| 3 | **Juice over complexity** | Two verbs (move, lunge), one risk (hunters). Depth comes from feedback: hit-stop, screen shake, particles, pitch-rising bite sound. |
| 4 | **Readable at a glance** | Four victim types distinguished by colour *and* silhouette accessory (none / headband / crown / hat+aura). Hunters carry a pulsing dashed halo. |
| 5 | **Instant restart** | Enter / R / Space restarts. Game over → new run in one keypress. |

### 1.2 Out of scope (today)
Levels, upgrades, multiple maps, online leaderboards, story, difficulty selector, accessibility options panel (see [REVIEW.md](REVIEW.md) for the gap list).

---

## 2. Core loop

```
        ┌────────────── 60 s on the clock ──────────────┐
        │                                               │
   chase prey ──► bite (touch) ──► +time +points ──► combo grows
        ▲              │                                │
        │              └── hunter touched? ──► −5 s, stun, combo reset
        │                                               │
        └──────── lunge (0.85 s cooldown) ◄─────────────┘
                                   time hits 0 ──► THE SUN RISES ──► name entry ──► "BITE AGAIN"
```

**Session shape.** Start with 22 villagers already around you (9 within 180–420 px, 7 at 450–800 px, 6 at 800–1200 px) so the first bite lands within seconds. Average run length is whatever your bites sustain — with no bites you die at exactly 60.0 s (verified in a headless run: game-over screen at 60.1 s, score 0).

---

## 3. Rules & numbers

### 3.1 World

| Item | Value | Notes |
|---|---|---|
| Play field | **2200 × 2200 px** (`WORLD`) | One screen-less map; the camera follows. |
| Border | 44 px inner margin for the player (`margin = 44 + PLAYER_R`), 48 px + r for villagers | Wall is painted as a 40 px band. |
| Layout | Cross of stone paths (170 px wide), central stone plaza 900 × 900 with a 300 px ring, fountain at the centre | Plaza stays free of trees (±520 px). |
| Obstacles | 1 fountain (r 58) · 4 crypts (r 50) at (380,380) and mirrored corners · up to 22 trees (r 24) | Trees are placed with ≥ 150 px clearance; trees are drawn **over** entities (canopy layer), so you can hide under them visually. |
| Decor | 70 gravestones baked into the ground layer, 40 dirt patches, 12 moonlight pools, 9000 grass flecks | Pure decoration. |
| Blood | Every bite and dying blood particle stains the ground layer permanently until the next run (`buildBackground` is re-run on `start()`). | Emergent "progress" visual. |
| Idle (menu) | 24 wandering villagers, camera drifts slowly around the plaza | Menu is the game running behind a panel. |

### 3.2 The vampire

| Stat | Value (code name) |
|---|---|
| Radius | 18 px (`PLAYER_R`) |
| Run speed | 275 px/s (`PLAYER_SPEED`), exponential smoothing `lerp(v, target, min(1, dt·14))` (·4 while stunned) |
| Lunge | 0.22 s dash (`LUNGE_DUR`), speed boost `900 · f²` px/s where f = remaining/total (`LUNGE_BOOST`), cooldown 0.85 s (`LUNGE_CD`), direction = current facing |
| Lunge reach bonus | +8 px contact radius while lunging |
| Damage | none — only time loss |
| Start time | 60 s (`START_TIME`) |
| Spawn | (1100, 1270) facing up |

**Lunge queue.** Pressing lunge sets a flag that is consumed on the next simulation tick; if on cooldown or stunned the press is discarded.

### 3.3 Villagers (prey)

| Type | Radius | Speed (flee) | Wander speed | Awareness | Points (× combo) | Time | Silhouette / colour |
|---|---|---|---|---|---|---|---|
| **Peasant** | 15 | 205 | 65 | 270 px | 100 | +3 s | blue `#5b7ea8`, brown hair, no accessory |
| **Runner** ("SPRINTER") | 14 | 315 | 95 | 330 px | 250 | +3 s | green `#5fae6c`, yellow hair, red headband; zig-zag factor 0.7 |
| **Noble** ("NOBLE +5s") | 16 | 165 | 65 | 270 px | 500 | **+5 s** | purple `#8a4fbf`, white hair, gold crown |
| **Hunter** ("HUNTER SLAIN") | 17 | 135 (stalk) | 70 | aggro 460 px | 400 | **+5 s** | brown `#6b4a2f`, wide-brim hat, dashed pale-green aura |

**Behaviour** (`updateVillager`):
* **Wander** — every 1.2–3.2 s pick a new random unit heading; 25 % of the time stand still.
* **Panic** — when the player is within *awareness* the villager gets `panic = 1.4 s` (refreshed while near), shows a yellow **!**, flees directly away with a sideways wobble (`sin(7t + seed·20) · 0.25`, runners `0.7`). Steering responsiveness 9 when panicked, 4 otherwise.
* **Hunter** — within 460 px it walks **towards** you (shows ✝ once when alerted), otherwise wanders slowly (70 px/s).
* **Avoidance** — soft push from walls (within 130 px) and obstacles (within `r + 70`).
* **Bitten** — becomes a corpse for 9 s (fades between 6 s and 9 s), then removed.

**Contact rules.**
* Touching a non-hunter at any time → **bite**.
* Touching a hunter **while lunging** → bite (slay). Touching one **without lunging** and the hunter's own cooldown is 0 → **hurt**.

**Population.** Target alive count = `20 + min(12, floor(bites / 4))` (20 → 32). One villager spawns per frame while below target, 520–900 px from you.

**Type mix** (`pickType`, evaluated per spawn, `b = bites`):

| Type | Probability |
|---|---|
| Noble | 0.06 |
| Runner | `clamp(0.12 + 0.008·b, 0.12, 0.34)` — reaches cap at 28 bites |
| Hunter | `clamp(0.05 + 0.006·b, 0.05, 0.22)` — reaches cap at 29 bites |
| Peasant | remainder (≈ 0.77 at start → ≈ 0.38 at 29+ bites) |

### 3.4 Scoring, time & combo

```
on bite(villager):
    combo      += 1
    comboTimer  = 2.6 s                        # COMBO_WINDOW
    mult        = min(combo, 10)               # cap ×10
    score      += basePoints(type) * mult
    time       += bonusSeconds(type)           # 3 or 5
on comboTimer → 0:   combo = 0
on hurt():           combo = 0, time -= 5 (floor 0), stun 0.55 s, knock-back 520 px/s, hunter cooldown 1.6 s
```

* Multiplier shown as `×N`, `×10+` past 10 bites in a row. Milestone burst at every 5th combo.
* Score is an integer; `toLocaleString()` for display.
* The `survived` stat is **elapsed play time** (not counting paused time); shown as `m:ss`.

### 3.5 Win / lose
There is no win. The run ends when `time ≤ 0`. A new score enters the Hall of Blood if it ranks in the top 10.

### 3.6 Difficulty curve
Purely bite-driven: more runners and hunters (harder to catch / riskier) as bites grow, more villagers around (more opportunities), time bonuses keep skilled players alive indefinitely. Skill ceiling: chain 10+ bites (every bite ×10) and kill hunters with lunges for +5 s each.

---

## 4. Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | `W A S D`, arrow keys, also `Q`/`Z` (AZERTY left/up) | Floating joystick: press anywhere, drag (dead-zone 6 px, max radius 56 px; base follows the thumb) |
| Lunge | `Space`, `Shift`, `J`, `K`, `X` | Fang button (bottom-right, 96 px, shows cooldown as a conic ring), **second finger anywhere**, **double-tap** (< 260 ms) |
| Pause / resume | `P` or `Esc` (resume: `Enter` or `Esc`/`P`) | Pause button (40 px, top-right) |
| Restart | `Enter` / `R` / `Space` on game-over; `R` on pause; `Shift+R` mid-run | "Bite again" / "Restart" buttons |
| Mute | `M` | speaker button |

Auto-pause on: window blur, tab hidden (`visibilitychange`).

---

## 5. Game feel ("juice") catalogue

| Trigger | Effects |
|---|---|
| **Bite (peasant)** | hit-stop 0.06 s · shake 7 · zoom kick to 1.05 · white flash 0.12 · 16 + 2·mult blood particles · red ring · permanent stain · 2 bats · `+3s` green, `+pts` gold, combo `xN` text |
| **Bite (other)** | hit-stop 0.10 s · shake 11 · gold/violet sparks · "bonus" arpeggio · label (NOBLE +5s / HUNTER SLAIN / SPRINTER) |
| **Combo %5** | 26 gold sparks, gold ring, milestone chime |
| **Lunge** | dust puff, shake 3, squash-and-stretch (×1.35 / ×0.75), red trail, whoosh |
| **Hurt (garlic)** | shake 14, red flash 0.6, hit-stop 0.09, 18 garlic puffs, pale ring, "−5s GARLIC!", stun wobble, knock-back |
| **Time < 10 s** | timer pulses red, vignette pulses (0.12–0.32 × (1 − t/10)), heartbeat (0.9 s; 0.6 s under 5 s) + 1.5 shake, ticking each second |
| **Hungry eyes** | eye glow grows as time falls under 20 s; fangs show under 10 s |
| **Game over** | hit-stop 0.25, shake 14, red flash 0.9, 12 bats, descending saw-wave sting |
| **Camera** | follows with look-ahead `0.22 · velocity`, smoothing `dt·6`, clamped to the map; start zoom 1.08 eases to 1 |

Numbers for the CSS re-creation of each effect are in [`docs/css/models.css`](css/models.css) §5–§6.

---

## 6. Audio design

Fully procedural WebAudio (no files). Master gain 0.6, persisted mute flag (`vamp-muted`). Audio context is created lazily on the first user gesture (required by browsers).

| Cue | Recipe |
|---|---|
| `bite(combo)` | sine 180→50 Hz 0.14 s (thump) + band-pass noise 2200→600 Hz 0.09 s (crunch) + triangle ping at `440·2^(min(combo,12)/12)` Hz — pitch rises a semitone per chained bite |
| `bonus` | triangle arpeggio 523 · 659 · 784 · 1047 Hz, 60 ms apart + high-pass noise shimmer |
| `lunge` | high-pass noise 300→4000 Hz 0.2 s + sine 220→440 Hz |
| `hurt` | saw 220→70 + square 110→55 + low-pass noise 1200→200 |
| `tick(urgent)` | square 900→700 Hz (normal) / 1200→900 Hz (≤ 5 s), 50 ms |
| `heartbeat` | two sine thumps 70→40 Hz and 65→38 Hz 0.2 s later |
| `comboMilestone` | square 660 · 880 · 1320 Hz, 50 ms apart |
| `start` | triangle 196 · 247 · 294 · 392 Hz + band-pass noise sweep |
| `gameOver` | saw 392 · 330 · 262 · 196 Hz (0.18 s apart) + sine drone 60→30 Hz, 1.2 s |
| `ui` | triangle 600→900 Hz 70 ms |

---

## 7. Screens & flow

```
         ┌────────┐  Enter/Space/tap   ┌─────────┐   Esc/P/blur/hidden   ┌────────┐
         │  MENU  │ ─────────────────► │ PLAYING │ ────────────────────► │ PAUSED │
         └────────┘ ◄───────────────── └─────────┘ ◄──────────────────── └────────┘
              ▲          Quit (menu)       │  time ≤ 0      Resume/Enter        │ R / Restart
              │                            ▼                                    ▼ (→ PLAYING, new run)
              │                       ┌────────┐  Bite again / Enter / R / Space
              └───────── Menu ─────── │  OVER  │ ─────────────────────────► PLAYING (new run)
                                      └────────┘
```

Engine `Mode` = `idle | playing | paused | over`; React `Screen` = `menu | playing | paused | over`. They are kept in sync through the `onPause` / `onGameOver` callbacks.

| Screen | Content |
|---|---|
| **Menu** | Flickering title, bat, dripping blood, promise line, **HUNT** button, tabs *How to play* (move/lunge tiles, victim legend with dots, combo note) and *Hall of Blood*, best score, mute. |
| **HUD** | Timer (centre, `tabular-nums`, one decimal under 10 s, urgent pulse), score + bites (left), pause (right), combo multiplier + drain bar (under timer, only when combo ≥ 2), lunge button (touch) or key hint (desktop). Updated by direct DOM writes from the engine — React does not re-render per frame. |
| **Pause** | PAUSED, resume (primary), restart, menu, mute; key hints. |
| **Game over** | "THE SUN RISES", score (shimmering gold if #1), rank badge (`♛ NEW HIGH SCORE!` / `#n IN THE HALL OF BLOOD` / "not enough to be remembered…"), bites · best combo · survived, editable name (max 12, upper-cased, Enter = restart), BITE AGAIN, MENU, top-5 table. |

Full CSS for each screen: [`docs/css/components.css`](css/components.css) — preview in `docs/css/components-preview.html`.

---

## 8. Persistence

| Key (`localStorage`) | Content |
|---|---|
| `vamp-highscores-v1` | JSON array, max 10 `{ id, name, score, bites, maxCombo, date }`, sorted by score desc, ties → newer first |
| `vamp-player-name` | last name typed (default `NOSFERATU`) |
| `vamp-muted` | `"1"` when muted |

All access is wrapped in `try/catch` (private-mode safe). Scores of **0 are stored** (see REVIEW.md #5).

---

## 9. Technical design

| Concern | Decision |
|---|---|
| Stack | React 19 + TypeScript 5.9 (strict) + Vite 7 + Tailwind CSS 4; `vite-plugin-singlefile` bundles to one `index.html` (≈ 268 kB, 82 kB gzip) |
| Rendering | Canvas 2D, `alpha:false`, DPR capped at 2, ground layer pre-rendered once to an offscreen 2200² canvas, vignette pre-rendered at ½ resolution |
| Loop | `requestAnimationFrame`, `dt = min(raw, 1/30)` (no spiral of death), simulation + render in one `frame()` |
| Architecture | `Engine` (pure game logic + drawing, no React) ←callbacks→ `App` (screens). See ADR-0001 |
| Input | Window key listeners + canvas pointer events (pointer capture for the joystick) |
| Audio | `Sfx` singleton, lazily created `AudioContext` |
| Particles | Hard cap 420, swap-remove; blood particles leave stains on death (60 %) |
| Timing constants | All tunables live at the top of `engine.ts` |

---

## 10. Content inventory (assets)

No raster or audio assets. Everything is code.

| Asset | Where | CSS re-creation |
|---|---|---|
| Vampire (cape, body, collar, head, hair, widow's peak, eyes, fangs) | `drawPlayer` | `.fr-vampire*` |
| 4 villagers + panic pose | `drawVillager` | `.fr-villager*` |
| Hunter aura | `drawVillager` | `.fr-hunter-aura` |
| Corpses | `drawCorpse` | `.fr-corpse*` |
| Tree / canopy, fountain, crypt, gravestone | `drawObstacleBase`, `drawCanopy`, `buildBackground` | `.fr-tree-*`, `.fr-canopy*`, `.fr-fountain-*`, `.fr-crypt-*`, `.fr-grave-*` |
| Blood, spark, garlic, dust, ring, bat particles | `drawParticles` | `.fr-ptcl--*`, `.fr-bat` |
| Floating text | `render` | `.fr-float*` |
| Ground | `buildBackground` | `.fr-world*`, `.fr-stone` |
| Screen effects | `render` | `.fr-fx--*` |

![models](img/models-gallery.png)

---

## 11. Roadmap ideas **(intent)**

1. Accessibility options: reduced flashes/shake, high-contrast hunters, remappable keys.
2. Daily seed + shareable score card.
3. New prey: priests (cross stun), bats that steal time, children (no-bite penalty).
4. Power-ups: bat-form dash, blood frenzy (×2 for 5 s), mist (hunters lose you).
5. Second map (graveyard at dawn: light zones that drain time).
6. Extract `theme.ts` from `tokens.css` so canvas colours and UI share one source of truth (ADR-0002).
