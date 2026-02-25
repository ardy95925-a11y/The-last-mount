// =============================================
// WORLD.JS — The mountain itself
// =============================================

const World = {
  // World settings
  TILE: 24,          // pixel size of blocks
  CHUNK_H: 40,       // tiles per chunk
  CAMP_INTERVAL: 200, // altitude meters between camps

  chunks: {},        // generated terrain chunks
  campData: [],      // camp positions
  particles: [],     // snow/debris particles
  crystals: [],      // collectible crystals/items on terrain
  anchors: [],       // planted anchors by player
  seed: 0,

  // Terrain parameters
  terrainParams: {
    baseWidth: 0.55,   // fraction of screen width open
    narrowing: 0.0002, // how fast it narrows per meter
    minWidth: 0.25,
    jitter: 0.08,
    iceChance: 0.15,
  },

  init(seed) {
    this.seed = seed || Math.floor(Math.random() * 99999);
    this.chunks = {};
    this.campData = [];
    this.particles = [];
    this.crystals = [];
    this.anchors = [];
    this.generateCamps();
  },

  // Seeded random (deterministic per altitude)
  seededRand(x, y = 0) {
    const val = Math.sin(x * 127.1 + y * 311.7 + this.seed * 0.01) * 43758.5453;
    return val - Math.floor(val);
  },

  generateCamps() {
    // Generate camp altitudes
    for (let i = 0; i < 20; i++) {
      const alt = (i + 1) * this.CAMP_INTERVAL + Math.floor(this.seededRand(i, 77) * 40 - 20);
      this.campData.push({
        altitude: alt,
        name: LORE.getCampName(i),
        loreFragment: LORE.getCampFragment(i),
        campIndex: i
      });
    }
  },

  // Get left/right wall x for a given altitude (in meters)
  getWallsAtAlt(altMeters) {
    const t = this.terrainParams;
    const baseOpen = t.baseWidth - altMeters * t.narrowing;
    const openFraction = Math.max(t.minWidth, baseOpen);
    const margin = (1 - openFraction) / 2;

    // Add seeded jitter
    const jitterL = (this.seededRand(Math.floor(altMeters * 0.5), 11) - 0.5) * t.jitter;
    const jitterR = (this.seededRand(Math.floor(altMeters * 0.5), 22) - 0.5) * t.jitter;

    return {
      left: margin + jitterL,
      right: 1 - margin + jitterR
    };
  },

  // Get detailed terrain for rendering
  getTerrainAtY(canvasH, cameraAlt, screenY) {
    // screenY is pixels from top. 0 = top of screen = cameraAlt + (canvasH/2 * pxPerMeter)
    const pxPerMeter = 2;
    const altAtRow = cameraAlt - (screenY - canvasH / 2) / pxPerMeter;
    return this.getWallsAtAlt(altAtRow);
  },

  // Get tiles in a row
  getRowTiles(canvasW, canvasH, cameraAlt, screenY) {
    const walls = this.getTerrainAtY(canvasH, cameraAlt, screenY);
    return {
      leftEdge: Math.floor(walls.left * canvasW),
      rightEdge: Math.floor(walls.right * canvasW)
    };
  },

  // Check if a position is inside wall (solid)
  isWall(x, y, canvasW, canvasH, cameraAlt) {
    const walls = this.getTerrainAtY(canvasH, cameraAlt, y);
    const lx = walls.left * canvasW;
    const rx = walls.right * canvasW;
    return x < lx || x > rx;
  },

  // Check if nearby tile is ice (slippery)
  isIce(x, y, canvasW, canvasH, cameraAlt) {
    const pxPerMeter = 2;
    const altAtRow = cameraAlt - (y - canvasH / 2) / pxPerMeter;
    return this.seededRand(Math.floor(x * 0.1), Math.floor(altAtRow * 0.2)) < this.terrainParams.iceChance;
  },

  // Check if altitude is near a camp
  getNearestCamp(altitude) {
    for (const camp of this.campData) {
      if (Math.abs(camp.altitude - altitude) < 15) return camp;
    }
    return null;
  },

  getNextCamp(altitude) {
    for (const camp of this.campData) {
      if (camp.altitude > altitude) return camp;
    }
    return null;
  },

  // Spawn a collectible crystal at a wall position
  maybePlaceItem(canvasW, canvasH, cameraAlt) {
    if (Math.random() > 0.003) return;
    const pxPerMeter = 2;
    const scanRows = [canvasH * 0.3, canvasH * 0.5, canvasH * 0.7];
    for (const screenY of scanRows) {
      const walls = this.getTerrainAtY(canvasH, cameraAlt, screenY);
      const altAtRow = cameraAlt - (screenY - canvasH / 2) / pxPerMeter;

      // Place near left wall
      if (Math.random() < 0.5) {
        const wx = walls.left * canvasW + 14;
        if (!this.crystals.find(c => Math.abs(c.x - wx) < 30 && Math.abs(c.altitude - altAtRow) < 10)) {
          const itemId = this.pickTerrainItem(altAtRow);
          if (itemId) {
            this.crystals.push({ x: wx, altitude: altAtRow, itemId, collected: false });
          }
        }
      } else {
        const wx = walls.right * canvasW - 14;
        if (!this.crystals.find(c => Math.abs(c.x - wx) < 30 && Math.abs(c.altitude - altAtRow) < 10)) {
          const itemId = this.pickTerrainItem(altAtRow);
          if (itemId) {
            this.crystals.push({ x: wx, altitude: altAtRow, itemId, collected: false });
          }
        }
      }
      break;
    }
    // Prune old crystals
    if (this.crystals.length > 60) this.crystals.splice(0, 10);
  },

  pickTerrainItem(altitude) {
    const r = Math.random();
    const altFactor = Math.min(altitude / 4000, 1);
    if (r < 0.25 + altFactor * 0.1) return 'crystal_shard';
    if (r < 0.45) return 'iron_ore';
    if (r < 0.60) return 'rope_scrap';
    if (r < 0.70) return 'old_button';
    if (r < 0.78) return 'wolf_fur';
    if (r < 0.85) return 'dark_stone';
    if (r < 0.90) return 'bird_feather';
    if (r < 0.94) return 'fossil';
    if (r < 0.97) return 'snow_flower';
    return 'ancient_coin';
  },

  // PARTICLES (snow, wind blowing)
  spawnParticles(canvasW, wind, count = 3) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * canvasW,
        y: -10,
        vx: wind * 0.5 + (Math.random() - 0.5) * 0.5,
        vy: 0.8 + Math.random() * 0.8,
        size: Math.random() < 0.2 ? 3 : (Math.random() < 0.5 ? 2 : 1),
        alpha: 0.3 + Math.random() * 0.5,
        type: Math.random() < 0.85 ? 'snow' : 'crystal'
      });
    }
    // Cap particles
    if (this.particles.length > 200) this.particles.splice(0, 20);
  },

  updateParticles(canvasH, wind) {
    for (const p of this.particles) {
      p.x += p.vx + wind * 0.3;
      p.y += p.vy;
    }
    this.particles = this.particles.filter(p => p.y < canvasH + 10);
  },

  // Draw background gradient (sky)
  drawBackground(ctx, canvasW, canvasH, altitude) {
    // Sky shifts from dark blue to near-black at high altitude
    const t = Math.min(altitude / 5000, 1);
    const r = Math.floor(10 + (2 - 2) * t);
    const g = Math.floor(13 + (8 - 13) * t);
    const b = Math.floor(22 + (12 - 22) * t);

    const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, `rgb(${Math.max(r-4,2)},${Math.max(g-4,2)},${Math.max(b-4,2)})`);
    grad.addColorStop(1, `rgb(${r+8},${g+10},${b+18})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
  },

  // Draw the blocky mountain walls
  drawTerrain(ctx, canvasW, canvasH, cameraAlt) {
    const pxPerMeter = 2;
    const TILE = this.TILE;

    // Draw in chunked horizontal strips
    for (let screenY = 0; screenY < canvasH + TILE; screenY += TILE) {
      const altAtRow = cameraAlt - (screenY - canvasH / 2) / pxPerMeter;
      const walls = this.getWallsAtAlt(altAtRow);
      const lx = Math.floor(walls.left * canvasW);
      const rx = Math.floor(walls.right * canvasW);

      // Determine block color (altitude-based tinting)
      const snowLevel = Math.min(1, altAtRow / 2000);
      const isIcyRow = this.seededRand(Math.floor(altAtRow * 0.3), 5) < 0.3;

      if (isIcyRow) {
        ctx.fillStyle = `rgb(${60+Math.floor(snowLevel*80)},${80+Math.floor(snowLevel*100)},${100+Math.floor(snowLevel*100)})`;
      } else {
        ctx.fillStyle = `rgb(${35+Math.floor(snowLevel*60)},${42+Math.floor(snowLevel*60)},${60+Math.floor(snowLevel*40)})`;
      }

      // Left wall block
      if (lx > 0) {
        ctx.fillRect(0, screenY - TILE / 2, lx, TILE + 1);
        // Edge highlight
        ctx.fillStyle = 'rgba(200,220,240,0.08)';
        ctx.fillRect(lx - 3, screenY - TILE / 2, 3, TILE + 1);
      }
      // Right wall block
      if (rx < canvasW) {
        if (isIcyRow) {
          ctx.fillStyle = `rgb(${60+Math.floor(snowLevel*80)},${80+Math.floor(snowLevel*100)},${100+Math.floor(snowLevel*100)})`;
        } else {
          ctx.fillStyle = `rgb(${35+Math.floor(snowLevel*60)},${42+Math.floor(snowLevel*60)},${60+Math.floor(snowLevel*40)})`;
        }
        ctx.fillRect(rx, screenY - TILE / 2, canvasW - rx, TILE + 1);
        // Edge highlight
        ctx.fillStyle = 'rgba(200,220,240,0.08)';
        ctx.fillRect(rx, screenY - TILE / 2, 3, TILE + 1);
      }

      // Snow/frost accumulation at wall edges
      if (altAtRow > 300) {
        ctx.fillStyle = `rgba(212,232,240,${0.1 + snowLevel * 0.4})`;
        // Left snow edge
        ctx.fillRect(lx - 6, screenY, 8, 4);
        // Right snow edge
        ctx.fillRect(rx - 2, screenY, 8, 4);
      }
    }

    // Draw "crevice" texture details
    ctx.save();
    ctx.globalAlpha = 0.15;
    for (let screenY = 0; screenY < canvasH; screenY += TILE * 2) {
      const altAtRow = cameraAlt - (screenY - canvasH / 2) / pxPerMeter;
      const walls = this.getWallsAtAlt(altAtRow);
      const lx = Math.floor(walls.left * canvasW);
      const rx = Math.floor(walls.right * canvasW);
      const crackSeed = this.seededRand(Math.floor(altAtRow * 0.1), 999);
      if (crackSeed > 0.5) {
        ctx.fillStyle = '#000';
        ctx.fillRect(lx + Math.floor(crackSeed * 8), screenY + 4, 2, TILE - 4);
        ctx.fillRect(rx - Math.floor(crackSeed * 8) - 2, screenY + 2, 2, TILE - 4);
      }
    }
    ctx.restore();
  },

  // Draw a camp fire/platform
  drawCamp(ctx, canvasW, canvasH, cameraAlt, camp) {
    const pxPerMeter = 2;
    const screenY = canvasH / 2 - (camp.altitude - cameraAlt) * pxPerMeter;
    if (screenY < -40 || screenY > canvasH + 40) return;

    const walls = this.getWallsAtAlt(camp.altitude);
    const lx = Math.floor(walls.left * canvasW);
    const rx = Math.floor(walls.right * canvasW);
    const cx = (lx + rx) / 2;

    // Platform ledge
    ctx.fillStyle = '#2a3048';
    ctx.fillRect(lx - 10, screenY, rx - lx + 20, 12);
    ctx.fillStyle = '#3a4060';
    ctx.fillRect(lx - 10, screenY, rx - lx + 20, 4);

    // Fire glow
    const time = Date.now() * 0.001;
    const glowSize = 30 + Math.sin(time * 3) * 8;
    const grd = ctx.createRadialGradient(cx, screenY - 10, 0, cx, screenY - 10, glowSize);
    grd.addColorStop(0, 'rgba(244,160,48,0.5)');
    grd.addColorStop(0.5, 'rgba(220,80,20,0.15)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(cx - glowSize, screenY - glowSize - 10, glowSize * 2, glowSize * 2);

    // Camp label
    ctx.font = '10px "Share Tech Mono"';
    ctx.fillStyle = 'rgba(212,232,240,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(camp.name.toUpperCase(), cx, screenY - 25);
    ctx.textAlign = 'left';
  },

  // Draw collectible items
  drawCrystals(ctx, canvasW, canvasH, cameraAlt) {
    const pxPerMeter = 2;
    this.crystals.forEach(c => {
      if (c.collected) return;
      const screenY = canvasH / 2 - (c.altitude - cameraAlt) * pxPerMeter;
      if (screenY < -20 || screenY > canvasH + 20) return;

      const def = ITEM_DEFS[c.itemId];
      if (!def) return;

      // Glow
      const pulse = 0.7 + Math.sin(Date.now() * 0.003 + c.x) * 0.3;
      ctx.save();
      ctx.globalAlpha = 0.25 * pulse;
      ctx.fillStyle = '#5bb8d4';
      ctx.beginPath();
      ctx.arc(c.x, screenY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Icon (drawn as simple pixel shape)
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      ctx.fillText(def.icon, c.x, screenY + 5);
      ctx.textAlign = 'left';
    });
  },

  // Draw anchors
  drawAnchors(ctx, canvasH, cameraAlt) {
    const pxPerMeter = 2;
    this.anchors.forEach(a => {
      const screenY = canvasH / 2 - (a.altitude - cameraAlt) * pxPerMeter;
      if (screenY < -10 || screenY > canvasH + 10) return;
      ctx.fillStyle = '#c8a840';
      ctx.fillRect(a.x - 3, screenY - 6, 6, 10);
      ctx.fillStyle = '#f0d060';
      ctx.fillRect(a.x - 1, screenY - 8, 2, 4);
    });
  },

  // Draw snowfall particles
  drawParticles(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      if (p.type === 'crystal') {
        ctx.fillStyle = '#88d0e8';
        ctx.fillRect(p.x, p.y, p.size + 1, p.size + 1);
      } else {
        ctx.fillStyle = '#c8e0f0';
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.restore();
    });
  },

  // Check crystal collection
  checkCrystalCollection(px, py, canvasH, cameraAlt) {
    const pxPerMeter = 2;
    const collected = [];
    this.crystals.forEach(c => {
      if (c.collected) return;
      const screenY = canvasH / 2 - (c.altitude - cameraAlt) * pxPerMeter;
      const dist = Math.sqrt((c.x - px) ** 2 + (screenY - py) ** 2);
      if (dist < 25) {
        c.collected = true;
        collected.push(c.itemId);
      }
    });
    return collected;
  }
};
