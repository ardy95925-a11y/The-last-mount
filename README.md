# ⛰ SUMMIT — Rope Climbing Adventure

A physics-based 2D/3D hybrid voxel mountain climbing game built for iPad.

## How to Play

**Rope Throwing (main mechanic):**
- **Touch/hold** anywhere on the right side of the screen to start aiming
- The longer you hold, the more **power** charges up (watch the power meter)
- **Release** to throw the rope — it needs to hit terrain to anchor
- Once anchored, **swing** left/right using movement buttons
- Tap **🪢 IN** to retract the rope and throw again

**Movement:**
- ◀ ▶ buttons — walk left/right
- ▲ — climb up the rope (uses stamina!)
- ↑ (green) — jump

**Goals:**
- Climb as high as possible up the infinite mountain
- Collect glowing **loot items** scattered across the terrain
- Find **⛺ Camps** along the mountain to rest and trade
- Sell items to buy upgrades and accessories from Orvyn the merchant

## Controls (Desktop)
- **Click + drag** — aim rope (hold = more power, release = throw)
- **WASD / Arrow keys** — move
- **Space** — jump
- **R** — retract rope
- **E** — enter camp (when nearby)

## Features
- ∞ Infinite procedurally generated mountain with parallax sky
- Physics rope with verlet simulation and wind effects
- Animated foliage: trees, pines, bushes, grass, flowers, ferns, mushrooms
- Day/altitude sky — stars appear at high elevation
- Cozy camp shack with NPC merchant (Orvyn), upgrades & accessories
- 12 item types with rarity tiers
- 6 upgrades + 5 accessories to unlock

## Hosting on GitHub Pages
1. Push all 6 files to a GitHub repo
2. Go to Settings → Pages → Source: main branch / root
3. Your game is live at `https://yourusername.github.io/summit/`

## Files
```
index.html   — Main entry, UI, boot sequence
style.css    — All UI styles (camp panel, HUD, controls)
physics.js   — Rope verlet physics, player movement, wind
world.js     — Infinite terrain generation, foliage, loot, camps
engine.js    — WebCanvas renderer (tiles, trees, player, sky)
game.js      — Game loop, input, inventory, NPC shop logic
```
