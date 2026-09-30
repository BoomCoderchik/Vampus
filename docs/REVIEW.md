# Fang Rush — Review (2026-09-30)

Reviewed against the five skill packs you listed. **How they were used:** this agent harness has no slash-command plugin loader, so each pack was cloned and its `SKILL.md` was read and applied by hand as a checklist (details in §1). Nothing below is "run by the skill"; it is this checklist applied to this repo, with evidence.

---

## 1. Skills → what was applied

| Pack | Skills actually applied | Applied as |
|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | `using-superpowers`, `brainstorming`, `verification-before-completion`, `writing-plans`* | *Classification:* documentation-only, **no product-code change** (brainstorming's hard gate is about implementation; nothing in `src/` was edited). *Verification:* every claim below marked ✅ was re-run in this session (see §2); red-green check performed on the new `docs:check` (see §2.3). \*plan in §6. |
| [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) | `taste-skill` (brief inference, dials, anti-default), `brandkit` (brand idea / palette logic), `output-skill` (no truncation) | *Design read + dials* in DESIGN_SYSTEM §1; *anti-slop check* on palette/type; *full output*: every model/component is written out in full, no placeholders. `taste-skill` explicitly targets landing pages — only its brief-inference and anti-default parts are used here. |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `design-system` (3-layer tokens, component spec/state matrix), `ui-ux-pro-max` (UX checklist) | `tokens.css` is primitive→semantic→gameplay; state matrix in DESIGN_SYSTEM §6; its `validate-tokens` idea became `scripts/verify-docs.mjs`. |
| [mattpocock/skills](https://github.com/mattpocock/skills) | `domain-modeling` (GLOSSARY + ADR format), `code-review` (Fowler smell baseline), `codebase-design` (deep modules) | `GLOSSARY.md`, `docs/adr/0001…0002`, smell findings in §4. |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `web-design-guidelines` (fetched the live rules from `vercel-labs/web-interface-guidelines`), `react-best-practices`, `composition-patterns` | §3 and §4 findings in `file:line` format. |

Not applicable here (and therefore not used): `deploy-to-vercel`, `vercel-cli-with-tokens`, `react-native-skills`, `react-view-transitions`, `image-to-code`, `imagegen-*`, `stitch`, slides/banner skills, Matt Pocock's ticket/PR workflow skills (no issue tracker configured).

To keep them for future sessions, see [`AGENTS.md`](../AGENTS.md) and `scripts/install-skills.sh`.

---

## 2. Verification evidence (verification-before-completion)

### 2.1 Commands run in this session

| Claim | Command | Result |
|---|---|---|
| Type-checks clean | `npx tsc --noEmit` | exit 0, no output |
| Production build works | `npx vite build` | ✅ `dist/index.html 268.29 kB │ gzip: 82.12 kB`, built in 1.52 s |
| Dev server serves the game | `vite` on `0.0.0.0:5173` + headless Chromium 153 | ✅ menu and gameplay rendered (`docs/img/gameplay.png`); **0 page errors** (the only console error was Google Fonts being unreachable in the sandbox) |
| Game-over at exactly 60 s with no bites | headless run, no input after *Hunt* | ✅ "THE SUN RISES" after 60.1 s |
| A **0-point run is saved** to the high-score table | same run, `localStorage['vamp-highscores-v1']` | ✅ `[{"name":"NOSFERATU","score":0,"bites":0,…}]` → finding #5 |
| CSS models render as intended | headless screenshot of `docs/css/models-preview.html` | ✅ `docs/img/models-gallery.png` (visually compared with the real sprites in `gameplay.png`) |
| UI components render as intended | headless screenshot of `components-preview.html` | ✅ `docs/img/ui-gallery.png` |
| Tokens match the code | `npm run docs:check` | ✅ 405 checks, 0 failures |
| Contrast numbers | `node scripts/contrast.mjs` | ✅ values in DESIGN_SYSTEM §2 |

### 2.2 Not verified (honest gaps)
* **No real-device / real-browser matrix.** Only headless Chromium 153 was available. Firefox/Safari behaviour of the CSS models (`clip-path`, `paint-order`, `zoom` in the gallery page only) is untested.
* **Emoji rendered as empty boxes** in the screenshots because the sandbox has no emoji font — a sandbox artefact, not a game bug.
* The **first `Enter` pressed immediately after page load did not start a run** in one headless attempt (worked after a 1 s delay). Probably a listener-mount race in the test, not reproduced by hand; listed as *unconfirmed*.
* Findings marked *(reading)* come from code reading, not runtime reproduction.

### 2.3 Red-green check of the new verifier
`docs:check` was deliberately broken (`START_TIME` 60→75 and one hex digit of the noble colour) → it reported **2 failures, exit 1**; restored → **0 failures, exit 0**.

---

## 3. Findings — UI / accessibility (Web Interface Guidelines, live rules)

Severity: 🔴 fix soon · 🟠 worthwhile · 🟡 nice-to-have.

| # | Sev | Location | Finding | Fix (already prototyped in `components.css`/`models.css` where noted) |
|---|---|---|---|---|
| A1 | 🟠 | `index.html:5` | `user-scalable=no, maximum-scale=1` blocks zoom (guideline anti-pattern). Defensible for the canvas, not for menus. | Drop `maximum-scale`/`user-scalable`; keep `touch-action:none` on the canvas (already set) so gestures still don't zoom the game. |
| A2 | 🔴 | `src/index.css`, all buttons | No `:focus-visible` style anywhere; keyboard users can't see focus. | `.fr-btn:focus-visible`… in `components.css`. |
| A3 | 🟠 | `src/index.css` | No `prefers-reduced-motion` handling (flicker, drip, bat-float, shimmer, urgent loop forever; canvas shake/flash too). | Reduced-motion block in `components.css`; engine should read `matchMedia` to scale `shake`/flash. |
| A4 | 🟠 | `GameOverScreen.tsx:79` | `outline-none` on the name input — replaced only by a border-colour change. | Keep the colour change **and** add the ring (`.fr-input:focus-visible`). |
| A5 | 🟠 | `GameOverScreen.tsx:67` | Name `<input>` has no `<label>`/`aria-label`, no `name`, no `autocomplete="off"`, no `spellCheck={false}`; placeholder lacks `…`. | `<label class="fr-field">` pattern in `components-preview.html`. |
| A6 | 🟡 | `Hud.tsx:46,91`, `StartScreen.tsx:25,29`, `PauseScreen.tsx:28`, `GameOverScreen.tsx:37,59` | Decorative emoji not `aria-hidden`; 🔊/🔇 glyph is the only content of the mute button (label exists). | `aria-hidden="true"` on glyph spans. |
| A7 | 🟠 | `App.tsx:208` | `<canvas>` has no role/label; screen readers get nothing. | `role="img"` + `aria-label="Fang Rush playfield"`; add a visually-hidden `aria-live="polite"` line that announces score/time every ~5 s and game over. |
| A8 | 🟡 | `Hud.tsx`, `StartScreen.tsx` | Tiny captions use `white/30–40` (2.7–3.7 : 1) — fail AA for text (table in DESIGN_SYSTEM §2). | Raise to `white/55` (6.3 : 1). |
| A9 | 🟡 | all buttons | Labels are ALL-CAPS literals; guideline prefers Title Case + CSS `text-transform`. | Keep `text-transform:uppercase` in CSS, write "Hunt" / "Bite Again" in JSX (also better for screen readers). |
| A10 | 🟠 | engine (shake 14, red/white flashes) | No photosensitivity option. | Settings toggle "Reduce flashes & shake" (roadmap #1). |
| A11 | 🟡 | `index.html` | No `color-scheme: dark` (scrollbars/inputs), no `translate="no"` on brand name, no skip link (single-screen game: skip link not needed). | `color-scheme: dark` (present in `tokens.css :root`). |
| A12 | 🟡 | `index.html:11` | Cinzel loaded from Google Fonts: render-blocking stylesheet, offline = serif fallback, and canvas text uses whatever is loaded at draw time. | Self-host `woff2` + `font-display:swap` + `document.fonts.load('900 20px Cinzel')` before first draw. |

Things that are **already good**: safe-area insets on the HUD (`Hud.tsx:22`), `tabular-nums` on numbers, `touch-action:none` on canvas, `overscroll-behavior:none`, `-webkit-tap-highlight-color` set, only `transform/opacity` animated, explicit `transition` property lists (no `transition: all`), icon-only buttons have `aria-label` (pause, lunge, mute), drag gestures have a button alternative.

---

## 4. Findings — code (mattpocock `code-review` smell baseline + Vercel React rules)

| # | Sev | Location | Finding |
|---|---|---|---|
| C1 | 🔴 | `engine.ts:926` *(reading)* | **Garlic stun-lock:** `hurt()` is gated only by the *hunter's own* `cooldown`. During the 0.55 s stun the player can be touched by a **second** hunter and lose another 5 s and reset the combo. Suggest `if (this.stun > 0) skip` or a short global i-frame (design call: maybe intended as "don't stand in a hunter pack"). |
| C2 | 🟠 | `App.tsx:104`, `highscores.ts:52` ✅ | **Zero-point runs are stored** and occupy Hall-of-Blood slots (reproduced). Gate on `res.score > 0`. |
| C3 | 🟠 | `engine.ts:310` *(reading)* | `window blur` auto-pauses. Inside an iframe preview, clicking the host page (not the game) pauses the game; on desktop, alt-tabbing is fine. Consider pausing on `visibilitychange` only. |
| C4 | 🟠 | `highscores.ts:18` | `JSON.parse(raw) as ScoreEntry[]` — shape is trusted. A corrupted/hand-edited entry (missing `score`) sorts to `NaN`, and `HighScoreTable.tsx:45` calls `s.score.toLocaleString()` → `TypeError` when the table renders *(reading)*. Validate each entry (Vercel `client-localstorage-schema`). |
| C5 | 🟡 | `StartScreen.tsx:41` | Copy says "Every bite buys **+3 s**" but nobles/hunters give +5 s; the legend below is correct. Say "at least +3 s". |
| C6 | 🟡 | `engine.ts:1162`, `:940` | **Per-frame allocation**: `villagers.filter(...)` twice per frame + `sort`. Fine at ≤ 32 NPCs; trivial to keep an `alive` array updated on bite/spawn (Vercel `js-*` rules). |
| C7 | 🟡 | `engine.ts:597`, `:813` | `particles.shift()` and `trail.splice()` are O(n); ring buffer/swap-remove (already used for particle death). |
| C8 | 🟡 | `engine.ts:243` (`start()` → `buildBackground`) | 9 000 `fillRect`s + random repaint on **every** restart (~ms hitch). Could clear only stains. |
| C9 | 🟠 | `StartScreen.tsx:87-96`, `engine.ts:102-109` | **Duplicated constants** (Fowler: *Duplicated Code / Shotgun Surgery*): victim colours live in `TYPE_INFO`, the legend dots and the canvas code; UI palette in `index.css` **and** 27 Tailwind arbitrary colour values (counted with grep) (`text-[#ff3b4a]` …). Adopt `tokens.css` → generate `theme.ts` (ADR-0002). |
| C10 | 🟡 | `engine.ts` (1 617 lines) | *Divergent Change*: input, simulation, AI, world-gen, rendering, particle FX in one class. Candidate split into deep modules: `input`, `world`, `ai`, `render`, `fx` behind the existing `Engine` interface (ADR-0001 keeps the React↔engine seam). |
| C11 | 🟡 | `engine.ts` | *Primitive Obsession / magic numbers*: `0.22`, `9000`, `460`, `1.4` inline. Most gameplay ones are named at the top; AI/FX ones are not. Docs now name them (GAME_DESIGN §3). |
| C12 | 🟡 | repo | **No tests.** The pure parts (`pickType`, combo/score maths, `insertScore`) are easy to unit-test; the engine needs the state split from drawing first. |
| C13 | 🟡 | `App.tsx:143` | `// eslint-disable-next-line react-hooks/exhaustive-deps` but ESLint isn't installed. Either add ESLint + `eslint-plugin-react-hooks` or drop the comments. |
| C14 | 🟡 | `App.tsx:31-39` | `hudRefs` is rebuilt each render (hook calls in an object literal — legal, but `rerender-*` style would keep it in one `useRef`/custom hook). Works correctly because refs are stable. |

**React-specific (Vercel `react-best-practices`):** the architecture already follows `rerender-use-ref-transient-values` (HUD updated by DOM writes, not state), `rerender-defer-reads` (engine via ref), listener cleanup in `useEffect` and lazy `useState(() => loadScores())`. No waterfalls (no data fetching). Bundle: one inlined chunk, no barrel imports. **`composition-patterns`**: components are small and flat; the boolean-prop pattern appears once (`HighScoreTable compact`) — fine; if screens grow, prefer explicit variants (`<HighScoreTable.Top5/>`).

---

## 5. Findings — repo hygiene

| # | Sev | Finding | Status |
|---|---|---|---|
| R1 | 🔴 | No `.gitignore` (node_modules/dist would be committed) | ✅ fixed earlier in this branch |
| R2 | 🟠 | `tsconfig.json:29` includes `../../Desktop/projects/Vampus/vite.config.ts` — a path from the author's machine | open |
| R3 | 🟡 | `package.json:2` name is still the template's `react-vite-tailwind`; `build` doesn't type-check | partly fixed: scripts `typecheck`, `docs:check`, `docs:contrast` added; name and build-step still open |
| R4 | 🟡 | `README.md` was just `# Vampus` | ✅ rewritten |
| R5 | 🟡 | `index.html` `<title>` says *Fang Rush*, repo says *Vampus*, no meta description / OG tags | open |
| R6 | 🟠 | Tailwind 4 auto-scans **every** file in the repo: adding `docs/` grew the bundle 268.29 → 271.38 kB (class-like strings in docs). | ✅ fixed: `@source` limited to `src/` + `index.html` in `src/index.css`; build is back to exactly 268.29 kB / 82.12 kB gzip (the only `src/` edit in this work) |

---

## 6. Suggested plan (superpowers `writing-plans` format — not executed)

1. **Hygiene** (R2, R3, C13) — 15 min, zero risk.
2. **Correctness** (C2, C4, C1 after a design decision, C3) — unit-test `insertScore`/`loadScores` first (TDD skill), then fix.
3. **A11y pass** (A1–A9) — adopt `components.css` focus/reduced-motion rules; add `aria-live` announcer.
4. **Single source of truth** (C9) — generate `src/game/theme.ts` from `tokens.css`; replace Tailwind arbitrary hexes with theme colours; keep `docs:check`.
5. **Engine split** (C10–C12) — only after 2 and 4, behind the existing interface.

Approval gate (brainstorming skill): none of these is started. Tell me which items to implement.
