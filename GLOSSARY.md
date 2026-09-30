# Fang Rush

A top-down arcade game in which a starving vampire buys time by biting villagers. One context; this file is the shared vocabulary for code, docs and UI copy.

## Language

### The run

**Run**:
One play from pressing *Hunt* until the clock reaches zero.
_Avoid_: Game, round, level, session

**Night**:
The time budget of a run — starts at 60 s and is the only life resource.
_Avoid_: Health, HP, lives

**Time**:
Seconds remaining in the night. Falls continuously; bites add to it, garlic subtracts from it.
_Avoid_: Timer (that is the HUD element), energy, blood

**Score**:
Points accumulated in a run. Each bite adds its victim's base points times the current multiplier.
_Avoid_: Points total

**Hall of Blood**:
The persistent top-10 list of finished runs on this device.
_Avoid_: Leaderboard, high-score table (in player-facing copy)

### The vampire

**Vampire**:
The player character.
_Avoid_: Player (in fiction copy), Nosferatu (that is only the default name)

**Bite**:
The act of touching a victim; always succeeds against non-hunters, and against hunters only during a lunge.
_Avoid_: Kill, hit, feed

**Lunge**:
A short forward dash with a cooldown; extends reach and is the only way to slay a hunter.
_Avoid_: Dash, charge, attack

**Hunger**:
The visual state of the vampire when time is low: glowing eyes under 20 s, fangs under 10 s.
_Avoid_: Low health

### Victims

**Villager**:
Any non-player character on the map.
_Avoid_: NPC, enemy, mob

**Victim**:
A villager that has been bitten; becomes a corpse.
_Avoid_: Target

**Peasant**:
The common villager: +3 s, 100 points.

**Runner**:
A fast, zig-zagging villager: +3 s, 250 points. Player-facing name: **Sprinter**.
_Avoid_: Sprinter (in code), fast enemy

**Noble**:
A rare, slow villager wearing a crown: +5 s, 500 points.
_Avoid_: King, boss

**Hunter**:
A villager who carries garlic and advances on the vampire; dangerous unless lunged into.
_Avoid_: Enemy, guard

**Panic**:
A villager's flee state, triggered when the vampire is within its awareness range.
_Avoid_: Flee mode, aggro (aggro is reserved for hunters)

**Corpse**:
A bitten villager lying on the ground for 9 s before it disappears.
_Avoid_: Body, dead NPC

### Scoring

**Combo**:
The count of consecutive bites, each within 2.6 s of the previous; resets on timeout or garlic.
_Avoid_: Streak, chain

**Multiplier**:
The combo count capped at 10, shown as ×N.
_Avoid_: Combo (they differ above 10)

**Garlic**:
The penalty inflicted by touching a hunter without lunging: −5 s, stun and combo reset.
_Avoid_: Damage, hurt (in copy)

### The world

**Plaza**:
The stone square with the fountain at the centre of the map.
_Avoid_: Arena, hub

**Obstacle**:
A solid map feature — fountain, crypt or tree.
_Avoid_: Wall, prop (prop is used only in CSS docs)

**Stain**:
Blood painted onto the ground; accumulates during a run.
_Avoid_: Decal, splatter

### Feedback

**Juice**:
The collective name for hit-stop, shake, flashes, particles and sound that accompany events.
_Avoid_: Polish, FX (FX is used for screen overlays only)

**Hit-stop**:
A brief freeze of simulation on impact.
_Avoid_: Freeze frame, lag
