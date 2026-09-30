---
status: proposed
---
# `docs/css/tokens.css` is the single source of truth for colours and gameplay constants

Colours are currently duplicated across `engine.ts` (`TYPE_INFO`, draw functions), `index.css`, 27 Tailwind arbitrary values and the legend dots in `StartScreen.tsx`. We documented them once in `docs/css/tokens.css` (primitive → semantic → gameplay) and added `npm run docs:check` to fail on drift. The proposed next step is to generate `src/game/theme.ts` from that file so code consumes the tokens instead of merely being checked against them.

## Considered Options
- Keep `engine.ts` authoritative and generate the CSS from it — rejected: designers cannot edit TypeScript.
- Tokens as JSON — rejected: the brief asked for CSS, and CSS variables are directly usable by the UI.
