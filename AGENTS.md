# Agent guide — Fang Rush (Vampus)

Read this before changing anything. It distills five skill packs into rules that apply to *this* repo.
To install the full skills locally: `bash scripts/install-skills.sh` (→ `.claude/skills`).

## Project map

| Path | What |
|---|---|
| `src/game/engine.ts` | The whole game (logic + canvas drawing). Imperative, no React. |
| `src/game/audio.ts`, `highscores.ts` | Procedural sound; `localStorage` scores. |
| `src/App.tsx`, `src/components/*` | Screens (menu / HUD / pause / game over). |
| `docs/GAME_DESIGN.md` | Rules and every gameplay number. |
| `docs/DESIGN_SYSTEM.md`, `docs/css/*` | Tokens, CSS models, UI components, galleries. |
| `docs/REVIEW.md` | Open findings and the plan. |
| `GLOSSARY.md`, `docs/adr/*` | Vocabulary and decisions. **Use the glossary terms** in code, copy and docs. |

## Commands (run them — do not assume)

```
npm ci                 # install
npm run dev            # http://localhost:5173
npm run typecheck      # tsc --noEmit
npm run build          # vite build → single-file dist/index.html
npm run docs:check     # tokens.css ⇄ engine.ts/index.css drift check (must print 0 failure(s))
npm run docs:contrast  # WCAG contrast table
```

## Rules

### Process (superpowers)
1. **Classify before building**: *spike* (answer a question), *bounded* (change to existing flow — show a short design, wait for yes), *architectural* (new subsystem — written spec, then plan). When in doubt take the heavier path.
2. **Bugs → systematic debugging**: reproduce, find root cause, write the failing test first, then fix.
3. **No completion claims without fresh evidence**: run `typecheck`, `build`, `docs:check` (and tests once they exist) in the same turn you say "done". Quote the result. "Should work" is not evidence.
4. New behaviour → test first (TDD). Regression fix → prove red-green (revert fix, see it fail, restore).

### Design (taste-skill + ui-ux-pro-max)
1. State the **design read** and dials (`DESIGN_SYSTEM.md §1`) before UI work. Stay on-brand: *blood on ink; gold = reward; green = time gained; red = cost/danger*.
2. **No hard-coded colours.** Add/modify a token in `docs/css/tokens.css` (primitive → semantic → component) and run `npm run docs:check`.
3. Avoid AI-default aesthetics (purple mesh gradients, Inter + slate, three equal cards, blur everywhere).
4. Every interactive element needs: hover, active, **`:focus-visible`**, label. Every loop animation needs a `prefers-reduced-motion` path.
5. Output complete files — no `// ...` placeholders.

### Code (mattpocock + vercel)
1. **Deep modules**: lots of behaviour behind a small interface; the interface is the test surface. Keep the `Engine` ⇄ React seam from ADR-0001 (callbacks + refs; nothing per-frame through `setState`).
2. Review smells on every diff: Mysterious Name, Duplicated Code, Feature Envy, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality.
3. React: derive state during render, functional `setState`, lazy `useState` init, clean up every listener, transient values in refs, no component definitions inside components, no barrel imports.
4. Persisted data is untrusted: validate shape on read, keep a version in the key (`vamp-highscores-v1`).
5. Keep gameplay tunables as named constants at the top of `engine.ts`; mirror them in `tokens.css` (`--fr-gm-*`) so the checker covers them.
6. UI review uses the live Vercel Web Interface Guidelines: fetch `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`, output `file:line - issue`.

### Git
Work on the session branch only; commit small; never force-push.
