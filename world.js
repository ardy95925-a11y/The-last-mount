// world.js — Smooth procedural mountain world with spline terrain

const World = {
  SAMPLE: 48,
  seed: 0,
  terrainCache: new Map(),
  treeCache: new Map(),
  rockCache: new Map(),
  lootSpawns: new Map(),
  campPositions: [],

  init(seed) {
    this.seed = seed || (Math.random() * 999999 | 0);
    this.terrainCache.clear();
    this.treeCache.clear();
    this.rockCache.clear();
    this.lootSpawns.clear();
    this.campPositions = [];
    for (let i = 1; i <= 25; i++) this.campPositions.push(i * 5500);
  },

  rng(x, salt) {
    let h = (this.seed ^ 0xdeadbeef) + ((x * 374761393) | 0) + ((salt || 0) * 1234567);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },

  // Smooth value noise using sine harmonics - deterministic by seed
  sampleNoise(x, freq, salt) {
    const s = this.seed * 0.00001 + (salt || 0) * 1.337;
    return (
      Math.sin(x * freq * 1.000 + s) * 1.0 +
      Math.sin(x * freq * 1.618 + s * 2.1) * 0.6 +
      Math.sin(x * freq * 2.718 + s * 3.7) * 0.36 +
      Math.sin(x * freq * 4.236 + s * 5.3) * 0.22
    ) / 2.18;
  },

  getTerrainY(worldX) {
    const cached = this.terrainCache.get(worldX);
    if (cached !== undefined) return cached;

    const alt = worldX / 1000; // altitude unit (0 = base, higher = mountain)
    // Base: constant upward slope
    let elev = worldX * 0.22;
    // Large mountain undulation
    elev += this.sampleNoise(worldX, 0.0009, 1) * (100 + alt * 28);
    // Medium ridges
    elev += this.sampleNoise(worldX, 0.0035, 2) * (40 + alt * 12);
    // Small surface variation
    elev += this.sampleNoise(worldX, 0.012, 3) * (14 + alt * 3);
    // Micro bumps
    elev += this.sampleNoise(worldX, 0.04, 4) * 5;
    // High-altitude jaggedness
    elev += Math.max(0, this.sampleNoise(worldX, 0.006, 5)) * alt * 30;

    // Y=0 is bottom of screen, higher elev = terrain is higher up (lower screen Y)
    const screenY = 2200 - elev;
    this.terrainCache.set(worldX, screenY);
    return screenY;
  },

  // Catmull-Rom spline interpolation over sampled points
  getTerrainYSmooth(worldX) {
    const S = this.SAMPLE;
    const xi = Math.floor(worldX / S);
    const t = (worldX - xi * S) / S;
    const p0 = this.getTerrainY((xi - 1) * S);
    const p1 = this.getTerrainY(xi * S);
    const p2 = this.getTerrainY((xi + 1) * S);
    const p3 = this.getTerrainY((xi + 2) * S);
    // Catmull-Rom
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
  },

  getTerrainSlope(worldX) {
    return (this.getTerrainYSmooth(worldX + 6) - this.getTerrainYSmooth(worldX - 6)) / 12;
  },

  getBiome(worldX) {
    const alt = worldX / 1000;
    if (alt < 1.5) return 'forest';
    if (alt < 4)   return 'highland';
    if (alt < 7)   return 'alpine';
    if (alt < 11)  return 'snowfield';
    return 'glacial';
  },

  biomeColors(biome) {
    const B = {
      forest:    { grassTop: '#4a8040', grassMid: '#3a6832', soil: '#5c3d20', rock: '#5a6260', skyTop: '#0e1e36', skyBot: '#1e3a5c', fog: '#2a4a6a' },
      highland:  { grassTop: '#4a7038', grassMid: '#3a5c2a', soil: '#4a3018', rock: '#6a6870', skyTop: '#0c1828', skyBot: '#182a40', fog: '#243848' },
      alpine:    { grassTop: '#3a5a30', grassMid: '#2e4a26', soil: '#3a2814', rock: '#787880', skyTop: '#080e1c', skyBot: '#101e2e', fog: '#1a2838' },
      snowfield: { grassTop: '#d8e8f0', grassMid: '#c0d0dc', soil: '#303828', rock: '#888898', skyTop: '#060a14', skyBot: '#0c1424', fog: '#141c2c' },
      glacial:   { grassTop: '#e8f0f8', grassMid: '#d0dce8', soil: '#1e2820', rock: '#9098b0', skyTop: '#030608', skyBot: '#080e18', fog: '#0c1220' },
    };
    return B[biome] || B.forest;
  },

  // Terrain path for given X range - returns array of {x,y} points
  getTerrainPath(x0, x1, step) {
    const pts = [];
    step = step || 8;
    for (let x = x0; x <= x1 + step; x += step) {
      pts.push({ x, y: this.getTerrainYSmooth(x) });
    }
    return pts;
  },

  // Trees — organic, biome-aware
  getTrees(chunkX) {
    if (this.treeCache.has(chunkX)) return this.treeCache.get(chunkX);
    const trees = [];
    const chunkW = 600;
    const biome = this.getBiome(chunkX);
    const density = { forest: 22, highland: 35, alpine: 55, snowfield: 120, glacial: 999 }[biome];

    for (let dx = 0; dx < chunkW; dx += density) {
      const wx = chunkX + dx + this.rng(chunkX + dx, 99) * density * 0.8;
      const slope = Math.abs(this.getTerrainSlope(wx));
      if (slope > 1.6) continue; // too steep

      const ty = this.getTerrainYSmooth(wx);
      const size = 0.5 + this.rng(wx, 10) * 1.0;
      const type = biome === 'forest'
        ? (this.rng(wx, 20) > 0.4 ? 'pine' : 'oak')
        : biome === 'highland' ? (this.rng(wx, 20) > 0.5 ? 'pine' : 'shrub')
        : 'pine';

      trees.push({
        x: wx, y: ty, size, type,
        lean: (this.rng(wx, 30) - 0.5) * 0.18,
        branchSeed: this.rng(wx, 40),
        leafColor: this.rng(wx, 50),
      });
    }
    this.treeCache.set(chunkX, trees);
    return trees;
  },

  getRocks(chunkX) {
    if (this.rockCache.has(chunkX)) return this.rockCache.get(chunkX);
    const rocks = [];
    const biome = this.getBiome(chunkX);
    const density = biome === 'glacial' ? 80 : biome === 'snowfield' ? 100 : 140;
    for (let dx = 0; dx < 600; dx += density * 0.7) {
      const wx = chunkX + dx + this.rng(chunkX + dx, 77) * density * 0.5;
      if (this.rng(wx, 88) > 0.55) continue;
      rocks.push({
        x: wx,
        y: this.getTerrainYSmooth(wx),
        w: 18 + this.rng(wx, 89) * 48,
        h: 10 + this.rng(wx, 90) * 30,
        facets: 4 + Math.floor(this.rng(wx, 91) * 4),
        seed: this.rng(wx, 92),
        snow: biome === 'snowfield' || biome === 'glacial' || biome === 'alpine',
      });
    }
    this.rockCache.set(chunkX, rocks);
    return rocks;
  },

  // Loot item spawning
  getLootAt(wx, forceSpawn) {
    const key = Math.floor(wx / 300);
    if (this.lootSpawns.has(key)) return this.lootSpawns.get(key);
    if (!forceSpawn && this.rng(key, 200) > 0.35) return null;
    const spawnX = key * 300 + this.rng(key, 201) * 250;
    const spawnY = this.getTerrainYSmooth(spawnX) - 20;
    const item = { ...this.rollLoot(), wx: spawnX, wy: spawnY, id: key };
    this.lootSpawns.set(key, item);
    return item;
  },

  removeLoot(key) {
    this.lootSpawns.delete(key);
    // Regen after delay
    setTimeout(() => {
      const nk = key + 0.1;
      // re-enable by removing block
    }, 3000);
  },

  rollLoot() {
    const LOOT = [
      { name: 'Glowing Shard',    value: 45,  color: '#5ef0ff', glow: '#5ef0ff' },
      { name: 'Ancient Coin',     value: 80,  color: '#ffd700', glow: '#ffaa00' },
      { name: 'Strange Herb',     value: 25,  color: '#7dff85', glow: '#40cc50' },
      { name: 'Mountain Pearl',   value: 120, color: '#f0e8ff', glow: '#c0a0ff' },
      { name: 'Frost Crystal',    value: 60,  color: '#a8e8ff', glow: '#40c8ff' },
      { name: 'Old Map Fragment', value: 200, color: '#d4a870', glow: '#c07020' },
      { name: 'Emberstone',       value: 70,  color: '#ff8844', glow: '#ff4400' },
      { name: 'Echo Mushroom',    value: 35,  color: '#ff6688', glow: '#ff2255' },
      { name: 'Void Feather',     value: 150, color: '#9966ff', glow: '#6633cc' },
      { name: 'Summit Stone',     value: 300, color: '#ffffff', glow: '#aaddff' },
    ];
    const weights = [0.18, 0.10, 0.28, 0.06, 0.12, 0.04, 0.10, 0.20, 0.05, 0.02];
    let r = Math.random(), c = 0;
    for (let i = 0; i < LOOT.length; i++) {
      c += weights[i];
      if (r < c) return { ...LOOT[i] };
    }
    return { ...LOOT[0] };
  },

  nearestCamp(wx) {
    for (const cx of this.campPositions) {
      if (Math.abs(wx - cx) < 500) return cx;
    }
    return null;
  },

  getCampX(wx) {
    for (const cx of this.campPositions) {
      if (Math.abs(wx - cx) < 500) return cx;
    }
    return null;
  }
};

window.World = World;
