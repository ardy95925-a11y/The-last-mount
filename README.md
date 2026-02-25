# ⛰ SUMMIT — The Eternal Mountain

A cozy pixel-style physics climbing game for iPad. Swing your rope, collect treasures, visit warm camps, and ascend an infinite mountain.

## Play

Open `index.html` in any modern browser, or deploy to GitHub Pages.

### GitHub Pages Setup

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to **main branch / root**
4. Your game will be live at `https://<username>.github.io/<repo>/`

## Controls

| Action | Touch | Keyboard |
|--------|-------|----------|
| Grab / Swing Left | Tap left half | ← or A |
| Grab / Swing Right | Tap right half | → or D |
| Release grip | Lift finger | Space |
| Jump (mid-air) | Double tap | — |

## Files (7 scripts)

```
index.html          — Shell, styles, layout
js/world.js         — Infinite terrain generation, parallax, weather
js/entities.js      — Particles, collectibles, hazard logic
js/player.js        — Rope physics (verlet), climbing, upgrades
js/camp.js          — Camp UI, cozy fire, shop, sell, lore
js/ui.js            — HUD, title screen, notifications, death screen
js/game.js          — Main loop, state machine, save/load
```

## Features

- 🎮 Physics-based rope swinging (verlet simulation)
- 🏔 Infinite procedural mountain generation
- 🌨 Dynamic weather (wind, snow, storms)
- 💎 Collectibles: crystals, fossils, herbs, gems, relics
- ⛺ Cozy mountain camps with fire animation
- 🛒 Shop: 4 rope types, 3 backpacks, 4 lanterns, 3 gloves
- 📖 9 lore entries unlocked by altitude
- 💾 Auto-save via localStorage
- 📱 Optimized for iPad touch

## Lore

*"They say the peak grants a wish. Every climber who ever reached Camp Veilstone came back changed. None of them ever spoke of what lies above."*

The mountain has no name. The people of Aldenveil call it **The Patient One**.

---

Made with vanilla JS, Canvas API, and cozy intentions.
