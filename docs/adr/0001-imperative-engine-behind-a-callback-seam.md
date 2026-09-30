---
status: accepted
---
# The game is an imperative canvas engine; React only owns the screens

`Engine` (src/game/engine.ts) runs its own `requestAnimationFrame` loop, owns all game state and drawing, and talks to React through three callbacks (`onHud`, `onGameOver`, `onPause`). React renders only the menu/pause/game-over screens and the static HUD shell; per-frame HUD values are written straight to DOM refs, never through `setState`. We chose this over a React-state game loop because 60 fps state updates would re-render the tree every frame; the cost is that HUD markup and engine must agree on the `HudRefs` contract.

## Consequences
Anything that changes per frame must go through `HudState` + a ref. Anything that changes per *screen* goes through React state. New engine features must not import React.
