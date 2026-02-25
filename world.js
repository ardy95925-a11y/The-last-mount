// world.js - Infinite procedural mountain world generation

const World = {
  BLOCK_SIZE: 32,
  CHUNK_W: 16,
  CHUNK_H: 64,
  chunks: new Map(),
  seed: Math.random() * 99999 | 0,

  // Block types
  TYPES: {
    air:    { solid: false, color: null },
    stone:  { solid: true,  color: ['#6b7280','#5a6168','#7a818a','#646b72'], emit: null },
    dirt:   { solid: true,  color: ['#8B5E3C','#7a5233','#9a6a42'], emit: null },
    grass:  { solid: true,  color: ['#4a7c45','#3d6b38','#5a9050'], emit: null, top: true },
    snow:   { solid: true,  color: ['#e8edf2','#d4dce5','#f0f4f8'], emit: null, top: true },
    ice:    { solid: true,  color: ['#a8d8ea','#8fc5da','#bce3f5'], emit: null },
    wood:   { solid: true,  color: ['#7c5c3a','#6b4e2e','#8a6848'], emit: null },
    leaves: { solid: false, color: ['#2d7a2a','#256822','#357d30','#3a9035'], waving: true, emit: null },
    crystal:{ solid: true,  color: ['#7fd8e8','#5ec8dc','#a2e8f5'], emit: '#5ef0ff', glow: true },
    relic:  { solid: true,  color: ['#d4a843','#c49030','#e0bc55'], emit: '#ffdd88', glow: true },
    camp:   { solid: false, color: ['#8a7060'], emit: null },
    rope_anchor: { solid: true, color: ['#c0a870'], emit: null },
    mushroom: { solid: false, color: ['#c44','#d55'], emit: '#ff6666', glow: true },
    moss:   { solid: false, color: ['#3a6b2a','#2d5a22'], waving: true, emit: null },
  },

  // Simple noise
  noise(x, y) {
    let h = 0;
    const s = this.seed;
    h = Math.sin(x * 0.3 + s) * Math.cos(y * 0.2 + s * 0.7) * 0.5 + 0.5;
    h += Math.sin(x * 0.7 + s * 1.3) * 0.25;
    h += Math.sin(x * 1.5 + y * 0.3 + s * 0.5) * 0.125;
    return h;
  },

  fractalNoise(x, y, octaves) {
    let v = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      v += this.noise(x * freq, y * freq) * amp;
      max += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return v / max;
  },

  // Mountain height profile - rises steeply as y increases
  getMountainHeight(worldX) {
    const nx = worldX / 180;
    let h = 0;
    h += Math.sin(nx * 0.8 + this.seed * 0.01) * 120;
    h += Math.sin(nx * 1.7 + this.seed * 0.02) * 60;
    h += Math.sin(nx * 3.5 + this.seed * 0.03) * 30;
    h += Math.sin(nx * 7 + this.seed * 0.04) * 15;
    h += this.fractalNoise(nx * 2, 0, 4) * 80;
    return h;
  },

  getTerrainAt(worldX) {
    // Returns the surface Y position (in world pixels) at given X
    // Mountain climbs upward (lower Y = higher)
    const baseY = 3000; // start point
    const climbRate = worldX * 0.25; // gets harder higher
    const variation = this.getMountainHeight(worldX);
    return baseY - climbRate - variation;
  },

  getChunkKey(cx, cy) { return `${cx},${cy}`; },

  generateChunk(cx, cy) {
    const BS = this.BLOCK_SIZE;
    const CW = this.CHUNK_W;
    const CH = this.CHUNK_H;
    const blocks = new Uint8Array(CW * CH);
    const blockMeta = new Map();

    for (let lx = 0; lx < CW; lx++) {
      const worldX = (cx * CW + lx) * BS;
      const surfaceWorldY = this.getTerrainAt(worldX);

      // Deep underground
      const altitude = cx * CW + lx;
      const isSnowy = altitude > 80;
      const isIcy = altitude > 140;

      for (let ly = 0; ly < CH; ly++) {
        const worldY = (cy * CH + ly) * BS;
        const idx = lx + ly * CW;

        if (worldY < surfaceWorldY - BS * 3) {
          blocks[idx] = 0; // air
        } else if (worldY < surfaceWorldY) {
          // Surface zone
          const depth = (surfaceWorldY - worldY) / BS;
          if (depth < 0.5) {
            blocks[idx] = isIcy ? 4 : isSnowy ? 3 : 2; // grass/snow/ice
          } else if (depth < 3) {
            blocks[idx] = isIcy ? 4 : 7; // dirt
          } else {
            blocks[idx] = 1; // stone
          }
        } else {
          // Below surface - stone with features
          const n = this.fractalNoise(worldX * 0.002, worldY * 0.002, 3);
          if (n > 0.78) {
            // Cave
            blocks[idx] = 0;
          } else if (n > 0.72) {
            blocks[idx] = 5; // crystal
          } else {
            blocks[idx] = 1; // stone
          }
        }
      }
    }

    // Trees and features
    for (let lx = 2; lx < CW - 2; lx++) {
      const worldX = (cx * CW + lx) * BS;
      const altitude = cx * CW + lx;
      const isSnowy = altitude > 80;

      if (!isSnowy && Math.random() < 0.12) {
        const surfaceY = this.getTerrainAt(worldX);
        const surfLY = Math.round(surfaceY / BS) - cy * CH;
        if (surfLY >= 1 && surfLY < CH - 8) {
          // Tree trunk
          const treeH = 3 + Math.floor(Math.random() * 3);
          for (let h = 1; h <= treeH; h++) {
            const tly = surfLY - h;
            if (tly >= 0 && tly < CH) blocks[lx + tly * CW] = 6; // wood
          }
          // Leaves crown
          for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 1; dy++) {
              const leafLX = lx + dx;
              const leafLY = surfLY - treeH + dy;
              if (leafLX >= 0 && leafLX < CW && leafLY >= 0 && leafLY < CH) {
                const d = Math.abs(dx) + Math.abs(dy);
                if (d < 3 + Math.random()) blocks[leafLX + leafLY * CW] = 7; // leaves
              }
            }
          }
        }
      }

      // Mushrooms
      if (Math.random() < 0.04) {
        const surfaceY = this.getTerrainAt(worldX);
        const surfLY = Math.round(surfaceY / BS) - cy * CH - 1;
        if (surfLY >= 0 && surfLY < CH) {
          blocks[lx + surfLY * CW] = 10; // mushroom
        }
      }

      // Moss on stone walls
      if (Math.random() < 0.06) {
        const surfaceY = this.getTerrainAt(worldX);
        const surfLY = Math.round(surfaceY / BS) - cy * CH;
        if (surfLY >= 2 && surfLY < CH - 1) {
          blocks[lx + (surfLY - 2) * CW] = 11; // moss
        }
      }
    }

    // Camp every ~200 blocks altitude
    const globalTileX = cx * CW;
    for (let campCheck = 1; campCheck <= 10; campCheck++) {
      const campAlt = campCheck * 200;
      if (globalTileX <= campAlt && globalTileX + CW > campAlt) {
        blockMeta.set('camp_' + campCheck, {
          cx, cy,
          lx: Math.floor(CW / 2),
          altitude: campAlt
        });
        // Mark a region as camp
        const campLX = Math.floor(CW / 2);
        const worldXc = (cx * CW + campLX) * BS;
        const surfaceY = this.getTerrainAt(worldXc);
        const surfLY = Math.round(surfaceY / BS) - cy * CH;
        if (surfLY >= 2 && surfLY < CH - 4) {
          for (let dx = -3; dx <= 3; dx++) {
            for (let dy = -4; dy <= 0; dy++) {
              const clx = campLX + dx, cly = surfLY + dy;
              if (clx >= 0 && clx < CW && cly >= 0 && cly < CH) {
                blocks[clx + cly * CW] = 8; // camp marker
              }
            }
          }
        }
      }
    }

    return { blocks, blockMeta, cx, cy };
  },

  getChunk(cx, cy) {
    const key = this.getChunkKey(cx, cy);
    if (!this.chunks.has(key)) {
      this.chunks.set(key, this.generateChunk(cx, cy));
    }
    return this.chunks.get(key);
  },

  getBlock(worldTileX, worldTileY) {
    const CW = this.CHUNK_W;
    const CH = this.CHUNK_H;
    const cx = Math.floor(worldTileX / CW);
    const cy = Math.floor(worldTileY / CH);
    const lx = worldTileX - cx * CW;
    const ly = worldTileY - cy * CH;
    const chunk = this.getChunk(cx, cy);
    if (!chunk) return null;
    const idx = chunk.blocks[lx + ly * CW];
    const typeKeys = Object.keys(this.TYPES);
    const typeName = typeKeys[idx] || 'air';
    return { ...this.TYPES[typeName], type: typeName, blockIdx: idx };
  },

  setBlock(worldTileX, worldTileY, typeName) {
    const CW = this.CHUNK_W;
    const CH = this.CHUNK_H;
    const cx = Math.floor(worldTileX / CW);
    const cy = Math.floor(worldTileY / CH);
    const lx = worldTileX - cx * CW;
    const ly = worldTileY - cy * CH;
    const chunk = this.getChunk(cx, cy);
    const typeKeys = Object.keys(this.TYPES);
    const idx = typeKeys.indexOf(typeName);
    if (idx >= 0 && chunk) chunk.blocks[lx + ly * CW] = idx;
  },

  // Get surface Y pixel at worldX pixel
  getSurfaceY(worldXPx) {
    return this.getTerrainAt(worldXPx);
  },

  // Preload chunks around position
  preloadAround(worldX, worldY, radius) {
    const BS = this.BLOCK_SIZE;
    const CW = this.CHUNK_W;
    const CH = this.CHUNK_H;
    const cx = Math.floor(worldX / (BS * CW));
    const cy = Math.floor(worldY / (BS * CH));
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        this.getChunk(cx + dx, cy + dy);
      }
    }
  },

  // Find camp locations near a world y position
  findNearbyCamp(worldX, worldY) {
    const tileX = Math.floor(worldX / this.BLOCK_SIZE);
    const altitude = tileX;

    for (let c = 1; c <= 20; c++) {
      const campAlt = c * 200;
      if (Math.abs(altitude - campAlt) < 25) {
        // Find surface at camp
        const campWorldX = campAlt * this.BLOCK_SIZE;
        const surfY = this.getTerrainAt(campWorldX);
        return { worldX: campWorldX, worldY: surfY - this.BLOCK_SIZE * 2, index: c };
      }
    }
    return null;
  },

  // Items that can be found
  LOOT_TABLE: [
    { name: 'Glowing Shard', value: 45, color: '#5ef0ff', rarity: 0.15 },
    { name: 'Ancient Coin', value: 80, color: '#ffd700', rarity: 0.08 },
    { name: 'Strange Herb', value: 25, color: '#7dff85', rarity: 0.25 },
    { name: 'Mountain Pearl', value: 120, color: '#f0e8ff', rarity: 0.05 },
    { name: 'Frost Crystal', value: 60, color: '#a8e8ff', rarity: 0.10 },
    { name: 'Old Map Fragment', value: 200, color: '#d4a870', rarity: 0.03 },
    { name: 'Emberstone', value: 70, color: '#ff8844', rarity: 0.09 },
    { name: 'Echo Mushroom', value: 35, color: '#ff6688', rarity: 0.18 },
  ],

  rollLoot() {
    const roll = Math.random();
    let cumulative = 0;
    for (const item of this.LOOT_TABLE) {
      cumulative += item.rarity;
      if (roll < cumulative) return { ...item, id: Math.random() };
    }
    return null;
  }
};

window.World = World;
