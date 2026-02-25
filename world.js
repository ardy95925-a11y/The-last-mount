// world.js — Infinite mountain, voxel terrain, foliage, camps, loot

const World = (() => {
  const CHUNK_W = 32, CHUNK_H = 80;
  const TILE = 24; // pixels per tile
  const SEA_LEVEL = 1000; // arbitrary Y baseline

  // Tile types
  const T = {
    AIR: 0, STONE: 1, DIRT: 2, GRASS: 3, SNOW: 4,
    ROCK: 5, ICE: 6, DARK_STONE: 7, GRAVEL: 8, MOSS: 9,
    CAMP_FLOOR: 10, CAMP_WALL: 11, CAMP_ROOF: 12, CAMP_DOOR: 13,
    WOOD: 14, LOG: 15,
  };

  // Foliage types
  const FOLIAGE = {
    TREE: 1, BUSH: 2, FLOWER: 3, GRASS_BLADE: 4,
    PINE: 5, MUSHROOM: 6, FERN: 7,
  };

  const chunks = new Map();
  const foliageMap = new Map();
  const itemsMap = new Map();
  const campChunks = new Set();

  let noise; // simple seeded noise

  // ─── NOISE ────────────────────────────────────────
  function seededRand(seed) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  const RNG = seededRand(42069);
  const perm = Array.from({ length: 512 }, (_, i) => i % 256);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(RNG() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }
  function grad(h, x) { return (h & 1 ? -x : x); }
  function grad2(h, x, y) {
    const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  function noise2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    return lerp(
      lerp(grad2(perm[a], x, y), grad2(perm[b], x - 1, y), u),
      lerp(grad2(perm[a + 1], x, y - 1), grad2(perm[b + 1], x - 1, y - 1), u),
      v
    );
  }

  function fbm(x, y, octaves = 5) {
    let val = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      val += noise2(x * freq, y * freq) * amp;
      max += amp; amp *= 0.5; freq *= 2.1;
    }
    return val / max;
  }

  // ─── HEIGHT MAP ───────────────────────────────────
  function mountainHeight(worldX) {
    const tx = worldX / 420;
    // Core mountain spine
    let h = fbm(tx, 0.5, 6) * 180;
    // Vertical trend (mountain goes UP as x increases toward center)
    const centrality = Math.abs(worldX - 0) / 4000;
    h -= centrality * 120;
    // Cliff features
    h += noise2(tx * 3.1, 1.3) * 40;
    // Plateaus
    const plateau = Math.floor(noise2(tx * 0.5, 7) * 3);
    h += plateau * 24;
    return h;
  }

  function getTerrainY(worldX) {
    // Returns world Y of surface at given world X
    return SEA_LEVEL - mountainHeight(worldX);
  }

  // ─── CHUNK KEY ────────────────────────────────────
  function chunkKey(cx, cy) { return `${cx},${cy}`; }

  function worldToChunk(wx, wy) {
    return {
      cx: Math.floor(wx / (CHUNK_W * TILE)),
      cy: Math.floor(wy / (CHUNK_H * TILE)),
    };
  }

  // ─── GENERATE CHUNK ───────────────────────────────
  function generateChunk(cx, cy) {
    const tiles = new Uint8Array(CHUNK_W * CHUNK_H);
    const foliage = [];
    const items = [];
    const isCamp = campChunks.has(chunkKey(cx, cy));

    for (let lx = 0; lx < CHUNK_W; lx++) {
      const worldX = (cx * CHUNK_W + lx) * TILE + TILE / 2;
      const surfaceY = getTerrainY(worldX);

      for (let ly = 0; ly < CHUNK_H; ly++) {
        const worldY = (cy * CHUNK_H + ly) * TILE + TILE / 2;
        const idx = ly * CHUNK_W + lx;

        const depth = worldY - surfaceY;
        const altitude = SEA_LEVEL - worldY;

        if (depth < 0) {
          tiles[idx] = T.AIR;
          continue;
        }

        if (isCamp && lx > 4 && lx < 18 && depth >= 0 && depth < TILE * 3) {
          // camp area — keep as air floor
          if (Math.abs(depth) < 2) tiles[idx] = T.CAMP_FLOOR;
          else tiles[idx] = T.AIR;
          continue;
        }

        // Material by altitude + depth
        if (depth < TILE) {
          if (altitude > 600) tiles[idx] = T.SNOW;
          else if (altitude > 300) tiles[idx] = T.ROCK;
          else if (altitude > 100) tiles[idx] = T.GRASS;
          else tiles[idx] = T.GRASS;
        } else if (depth < TILE * 4) {
          if (altitude > 400) tiles[idx] = T.DARK_STONE;
          else tiles[idx] = T.DIRT;
        } else if (depth < TILE * 10) {
          tiles[idx] = fbm(worldX / 80, worldY / 80) > 0.1 ? T.STONE : T.GRAVEL;
        } else {
          tiles[idx] = T.DARK_STONE;
        }

        // Random mossy patches
        if (tiles[idx] === T.STONE && noise2(worldX / 120, worldY / 120) > 0.5) {
          tiles[idx] = T.MOSS;
        }
      }

      // Surface foliage
      const surfaceWorldY = getTerrainY(worldX);
      const altitude = SEA_LEVEL - surfaceWorldY;
      const r = noise2(worldX / 30, 99) * 0.5 + 0.5;

      if (altitude < 500 && r > 0.5) {
        let type;
        if (altitude < 100) {
          type = r > 0.8 ? FOLIAGE.TREE : (r > 0.65 ? FOLIAGE.BUSH : FOLIAGE.GRASS_BLADE);
        } else if (altitude < 250) {
          type = r > 0.75 ? FOLIAGE.PINE : (r > 0.6 ? FOLIAGE.FERN : FOLIAGE.BUSH);
        } else {
          type = r > 0.8 ? FOLIAGE.PINE : (r > 0.65 ? FOLIAGE.FLOWER : FOLIAGE.GRASS_BLADE);
        }

        if (r > 0.95) type = FOLIAGE.MUSHROOM;
        foliage.push({ wx: worldX, wy: surfaceWorldY - TILE * 0.3, type, windPhase: worldX * 0.05 });
      }

      // Loot spawning
      const lootR = noise2(worldX / 50, 777);
      if (lootR > 0.83) {
        const lootTypes = getLootForAltitude(altitude);
        const lootType = lootTypes[Math.floor(lootR * 100) % lootTypes.length];
        items.push({
          wx: worldX + (noise2(worldX, 1) - 0.5) * TILE,
          wy: surfaceWorldY - TILE,
          type: lootType,
          collected: false,
        });
      }
    }

    const key = chunkKey(cx, cy);
    chunks.set(key, tiles);
    foliageMap.set(key, foliage);
    itemsMap.set(key, items);
    return tiles;
  }

  function getLootForAltitude(alt) {
    if (alt < 100) return ['herb', 'mushroom', 'crystal_shard', 'old_coin'];
    if (alt < 250) return ['crystal_shard', 'rare_herb', 'fossil', 'gemstone'];
    if (alt < 500) return ['gemstone', 'ice_crystal', 'ancient_relic', 'rare_crystal'];
    return ['summit_stone', 'sky_gem', 'ancient_relic'];
  }

  // ─── CAMP PLACEMENT ───────────────────────────────
  // Place camps every ~15 chunks vertically
  function placeCampsAlongPath() {
    for (let i = 1; i <= 30; i++) {
      const worldY = SEA_LEVEL - i * 380;
      const worldX = noise2(i * 13.7, 0.5) * 400 - 200;
      const { cx, cy } = worldToChunk(worldX, worldY);
      campChunks.add(chunkKey(cx, cy));
    }
  }

  // ─── GET / ENSURE CHUNK ───────────────────────────
  function getChunk(cx, cy) {
    const key = chunkKey(cx, cy);
    if (!chunks.has(key)) generateChunk(cx, cy);
    return { tiles: chunks.get(key), foliage: foliageMap.get(key) || [], items: itemsMap.get(key) || [] };
  }

  // ─── TILE AT WORLD POS ────────────────────────────
  function getTileAt(wx, wy) {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const cx = Math.floor(tx / CHUNK_W);
    const cy = Math.floor(ty / CHUNK_H);
    const { tiles } = getChunk(cx, cy);
    const lx = ((tx % CHUNK_W) + CHUNK_W) % CHUNK_W;
    const ly = ((ty % CHUNK_H) + CHUNK_H) % CHUNK_H;
    return tiles[ly * CHUNK_W + lx];
  }

  function isSolid(tile) {
    return tile !== T.AIR;
  }

  // ─── PLAYER COLLISION ─────────────────────────────
  function collide(player) {
    const result = {};
    const hw = player.width / 2;
    const hh = player.height / 2;
    const x = player.x, y = player.y;

    // Bottom
    const btile = getTileAt(x, y + hh + 1);
    if (isSolid(btile)) {
      result.bottom = Math.floor((y + hh + 1) / TILE) * TILE - hh - 1;
    }

    // Top
    const ttile = getTileAt(x, y - hh - 1);
    if (isSolid(ttile)) {
      result.top = Math.ceil((y - hh - 1) / TILE) * TILE + hh + 1;
    }

    // Left
    const ltile = getTileAt(x - hw - 1, y);
    if (isSolid(ltile)) {
      result.left = Math.ceil((x - hw - 1) / TILE) * TILE + hw + 1;
    }

    // Right
    const rtile = getTileAt(x + hw + 1, y);
    if (isSolid(rtile)) {
      result.right = Math.floor((x + hw + 1) / TILE) * TILE - hw - 1;
    }

    return result;
  }

  // ─── ROPE ANCHOR CHECK ────────────────────────────
  function checkRopeAnchor(wx, wy) {
    const tile = getTileAt(wx, wy);
    if (isSolid(tile)) {
      // Snap to tile surface
      const tx = Math.floor(wx / TILE) * TILE + TILE / 2;
      const ty = Math.floor(wy / TILE) * TILE + TILE / 2;
      return { x: tx, y: ty };
    }
    return null;
  }

  // ─── COLLECT ITEM ─────────────────────────────────
  function collectItem(playerX, playerY, radius = 48) {
    const { cx, cy } = worldToChunk(playerX, playerY);
    for (let dcx = -1; dcx <= 1; dcx++) {
      for (let dcy = -1; dcy <= 1; dcy++) {
        const key = chunkKey(cx + dcx, cy + dcy);
        const items = itemsMap.get(key) || [];
        for (const item of items) {
          if (item.collected) continue;
          const dx = item.wx - playerX, dy = item.wy - playerY;
          if (dx * dx + dy * dy < radius * radius) {
            item.collected = true;
            return item.type;
          }
        }
      }
    }
    return null;
  }

  // ─── NEARBY CAMP ──────────────────────────────────
  function nearbyCamp(playerX, playerY, radius = 120) {
    const { cx, cy } = worldToChunk(playerX, playerY);
    for (let dcx = -2; dcx <= 2; dcx++) {
      for (let dcy = -2; dcy <= 2; dcy++) {
        const key = chunkKey(cx + dcx, cy + dcy);
        if (campChunks.has(key)) {
          const campWorldX = (cx + dcx) * CHUNK_W * TILE + CHUNK_W * TILE / 2;
          const campWorldY = getTerrainY(campWorldX) - TILE;
          const dx = campWorldX - playerX, dy = campWorldY - playerY;
          if (dx * dx + dy * dy < radius * radius) return true;
        }
      }
    }
    return false;
  }

  // ─── FOLIAGE NEAR CAMERA ──────────────────────────
  function getFoliageNear(camX, camY, screenW, screenH) {
    const margin = TILE * 4;
    const left = camX - screenW / 2 - margin;
    const right = camX + screenW / 2 + margin;
    const top = camY - screenH / 2 - margin;
    const bottom = camY + screenH / 2 + margin;

    const results = [];
    const cxStart = Math.floor(left / (CHUNK_W * TILE));
    const cxEnd = Math.ceil(right / (CHUNK_W * TILE));
    const cyStart = Math.floor(top / (CHUNK_H * TILE));
    const cyEnd = Math.ceil(bottom / (CHUNK_H * TILE));

    for (let cx = cxStart; cx <= cxEnd; cx++) {
      for (let cy = cyStart; cy <= cyEnd; cy++) {
        const { foliage, items } = getChunk(cx, cy);
        results.push({ foliage, items });
      }
    }
    return results;
  }

  // ─── VISIBLE TILES ────────────────────────────────
  function getVisibleTiles(camX, camY, screenW, screenH) {
    const left = camX - screenW / 2;
    const top = camY - screenH / 2;
    const txStart = Math.floor(left / TILE) - 1;
    const txEnd = Math.ceil((left + screenW) / TILE) + 1;
    const tyStart = Math.floor(top / TILE) - 1;
    const tyEnd = Math.ceil((top + screenH) / TILE) + 1;
    return { txStart, txEnd, tyStart, tyEnd };
  }

  // ─── ALTITUDE ─────────────────────────────────────
  function getAltitude(wy) {
    return Math.max(0, Math.round((SEA_LEVEL - wy) / 10));
  }

  // ─── INIT ─────────────────────────────────────────
  function init() {
    placeCampsAlongPath();
    // Pre-generate starting area
    for (let cx = -3; cx <= 3; cx++) {
      for (let cy = -2; cy <= 3; cy++) {
        generateChunk(cx, cy);
      }
    }
  }

  return {
    init, getChunk, getTileAt, isSolid, collide, checkRopeAnchor,
    collectItem, nearbyCamp, getFoliageNear, getVisibleTiles,
    getTerrainY, getAltitude, SEA_LEVEL, TILE, CHUNK_W, CHUNK_H,
    T, FOLIAGE, fbm, noise2,
  };
})();
