// game.js — Core game: render pipeline, smooth terrain, lighting, parallax, loop

const Game = {
  canvas: null,
  ctx: null,
  W: 0, H: 0,
  camX: 0, camY: 0,
  time: 0,
  player: null,
  rope: null,
  rope2: null, // second rope if upgrade
  worldItems: [],
  lastItemCheck: 0,
  currentCampX: null,
  npcAnimTime: 0,
  running: false,
  bgLayers: [],
  parallaxMountains: [],
  // Cached terrain path segments
  _terrainPaths: new Map(),

  init() {
    this.canvas = document.getElementById('c');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    World.init();

    const startX = 200;
    const startY = World.getTerrainYSmooth(startX) - 5;
    this.player = Physics.createPlayer(startX, startY - 30);
    this.rope = Physics.createRope(startX, startY - 30);

    this.camX = startX - this.W / 2;
    this.camY = startY - this.H * 0.55;

    UI.init();
    this._genParallaxLayers();
    this._setupInput();
    this.running = true;
    requestAnimationFrame(t => this.loop());
  },

  resize() {
    this.canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
    this.canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.W = this.canvas.width;
    this.H = this.canvas.height;
  },

  _genParallaxLayers() {
    // Pre-generate distant mountain silhouettes (3 layers)
    this.parallaxLayers = [
      { depth: 0.06, points: this._genMountainLine(0.18, 0.55) },
      { depth: 0.13, points: this._genMountainLine(0.12, 0.65) },
      { depth: 0.22, points: this._genMountainLine(0.07, 0.75) },
    ];
  },

  _genMountainLine(freq, baseH) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const x = i / 30;
      const y = baseH
        + Math.sin(x * Math.PI * 3 + World.seed * 0.001) * 0.12
        + Math.sin(x * Math.PI * 7 + World.seed * 0.002) * 0.06
        + Math.sin(x * Math.PI * 13 + World.seed * 0.003) * 0.03;
      pts.push({ x, y });
    }
    return pts;
  },

  _setupInput() {
    const el = this.canvas;

    el.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const rx = t.clientX * (window.devicePixelRatio || 1);
        const ry = t.clientY * (window.devicePixelRatio || 1);
        if (UI.state !== 'game') {
          UI.onCampTap(rx, ry, this.W, this.H, this.player, this);
        } else {
          UI.onTouchStart(t.identifier, rx, ry, this.W, this.H);
        }
      }
    }, { passive: false });

    el.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const rx = t.clientX * (window.devicePixelRatio || 1);
        const ry = t.clientY * (window.devicePixelRatio || 1);
        UI.onTouchMove(t.identifier, rx, ry);
      }
    }, { passive: false });

    el.addEventListener('touchend', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const rx = t.clientX * (window.devicePixelRatio || 1);
        const ry = t.clientY * (window.devicePixelRatio || 1);
        UI.onTouchEnd(t.identifier, rx, ry, this);
      }
    }, { passive: false });

    // Mouse support
    el.addEventListener('mousedown', e => {
      const rx = e.clientX * (window.devicePixelRatio || 1);
      const ry = e.clientY * (window.devicePixelRatio || 1);
      if (UI.state !== 'game') {
        UI.onCampTap(rx, ry, this.W, this.H, this.player, this);
      } else {
        UI.onTouchStart(0, rx, ry, this.W, this.H);
      }
    });
    el.addEventListener('mousemove', e => {
      if (e.buttons > 0) {
        const rx = e.clientX * (window.devicePixelRatio || 1);
        const ry = e.clientY * (window.devicePixelRatio || 1);
        UI.onTouchMove(0, rx, ry);
      }
    });
    el.addEventListener('mouseup', e => {
      const rx = e.clientX * (window.devicePixelRatio || 1);
      const ry = e.clientY * (window.devicePixelRatio || 1);
      UI.onTouchEnd(0, rx, ry, this);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') UI.input.moveX = -1;
      if (e.key === 'ArrowRight' || e.key === 'd') UI.input.moveX = 1;
      if (e.key === ' ' || e.key === 'ArrowUp') UI.input.jump = true;
      if (e.key === 'r') this.onRetract();
    });
    document.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') UI.input.moveX = 0;
      if (e.key === ' ' || e.key === 'ArrowUp') UI.input.jump = false;
    });
  },

  onThrow(angle, power) {
    Physics.throwRope(this.rope, this.player, angle, power);
  },

  onRetract() {
    Physics.retractRope(this.rope);
    this.player.onRope = false;
  },

  enterCamp(campX) {
    this.player.inCamp = true;
    this.player.nearCamp = true;
    UI.state = 'camp';
    this.currentCampX = campX;
    UI.notify('Entered camp', '#c07828');
  },

  leaveCamp() {
    this.player.inCamp = false;
    UI.state = 'game';
    UI.notify('Keep climbing', '#48cc68');
  },

  // ── UPDATE ──────────────────────────────────────────────────────────────
  update() {
    this.time++;
    this.npcAnimTime++;
    Physics.updateWind();

    const biome = World.getBiome(this.player.x);
    UI.update(this.W, this.H, biome);

    if (UI.state !== 'game' || this.player.inCamp) return;

    // Physics
    Physics.updateRope(this.rope, this.player);
    Physics.updatePlayer(this.player, UI.input, this.rope);

    // Land dust
    if (this.player.landImpact > 6) {
      const sx = this.player.x - this.camX, sy = this.player.y - this.camY;
      UI.spawnLandDust(sx, sy);
      this.player.landImpact = 0;
    }

    // Camera - smooth follow with look-ahead
    const lookX = this.player.vx * 50;
    const lookY = this.player.vy * 20;
    const targetX = this.player.x - this.W * 0.45 + lookX;
    const targetY = this.player.y - this.H * 0.52 + lookY;
    const camSpeed = this.player.onRope ? 0.06 : 0.09;
    this.camX += (targetX - this.camX) * camSpeed;
    this.camY += (targetY - this.camY) * camSpeed;

    // Items
    if (this.time - this.lastItemCheck > 60) {
      this._spawnNearbyItems();
      this._checkItemPickup();
      this.lastItemCheck = this.time;
    }

    // Camp check
    const campX = World.nearestCamp(this.player.x);
    if (campX && Math.abs(this.player.x - campX) < 350) {
      this.player.nearCamp = true;
      this.currentCampX = campX;
    } else {
      this.player.nearCamp = false;
    }

    // Auto-enter camp on proximity
    if (this.player.nearCamp && Math.abs(this.player.x - this.currentCampX) < 120 && this.player.grounded) {
      if (!this.player.inCamp) this.enterCamp(this.currentCampX);
    }
  },

  _spawnNearbyItems() {
    const px = this.player.x;
    // Check loot spawns in visible range
    for (let dx = -800; dx <= 800; dx += 300) {
      const wx = px + dx;
      const item = World.getLootAt(wx);
      if (item && !this.worldItems.find(i => i.id === item.id)) {
        this.worldItems.push(item);
      }
    }
    // Prune far items
    this.worldItems = this.worldItems.filter(it => Math.abs(it.wx - px) < 1200);
  },

  _checkItemPickup() {
    const px = this.player.x, py = this.player.y;
    this.worldItems = this.worldItems.filter(item => {
      const dx = item.wx - px, dy = item.wy - py;
      if (Math.sqrt(dx*dx + dy*dy) < 45) {
        this.player.inventory.push(item);
        World.lootSpawns.delete(item.id);
        UI.notify(`Found: ${item.name}`, item.color);
        UI.spawnCollect(px - this.camX, py - this.camY, item.color);
        return false;
      }
      return true;
    });
  },

  // ── RENDER ───────────────────────────────────────────────────────────────
  render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);

    if (UI.state !== 'game' && this.player.inCamp) {
      UI.drawCamp(ctx, W, H, this.player, this.npcAnimTime);
      return;
    }

    const biome = World.getBiome(this.player.x);
    const colors = World.biomeColors(biome);

    // 1. Sky gradient
    this._renderSky(ctx, W, H, colors, biome);

    // 2. Parallax mountain layers
    this._renderParallax(ctx, W, H, colors);

    // 3. Atmospheric fog layer
    this._renderFog(ctx, W, H, colors);

    // 4. Trees (far layer - behind terrain)
    this._renderTrees(ctx, W, H, false);

    // 5. Smooth terrain fill
    this._renderTerrain(ctx, W, H, colors, biome);

    // 6. Trees (front layer - on terrain)
    this._renderTrees(ctx, W, H, true);

    // 7. Rocks on terrain
    this._renderRocks(ctx, W, H);

    // 8. Camp structure
    if (this.currentCampX) {
      const campSX = this.currentCampX - this.camX;
      if (campSX > -300 && campSX < W + 300) {
        Entities.drawCamp(ctx, this.currentCampX, this.camX, this.camY, this.time);
      }
    }

    // 9. World items
    for (const item of this.worldItems) {
      Entities.drawItem(ctx, item, this.camX, this.camY, this.time);
    }

    // 10. Rope
    Entities.drawRope(ctx, this.rope, this.camX, this.camY);

    // 11. Player
    Entities.drawPlayer(ctx, this.player, this.camX, this.camY, this.time);

    // 12. NPC if near camp (outside)
    if (this.player.nearCamp && !this.player.inCamp && this.currentCampX) {
      const campX = this.currentCampX;
      const campY = World.getTerrainYSmooth(campX);
      const nsx = campX - 80 - this.camX;
      if (nsx > -80 && nsx < W + 80) {
        Entities.drawNPC(ctx, campX - 80, campY - 38, this.npcAnimTime, this.camX, this.camY);
      }
    }

    // 13. Terrain surface detail (grass / snow tufts)
    this._renderSurfaceDetail(ctx, W, H, biome);

    // 14. Lighting overlay (depth, god rays)
    this._renderLighting(ctx, W, H, biome);

    // 15. HUD
    UI.drawHUD(ctx, W, H, this.player, World, this.time);
  },

  _renderSky(ctx, W, H, colors, biome) {
    const alt = this.player.x / 1000;
    const nightness = Math.min(1, alt * 0.12);
    const skyG = ctx.createLinearGradient(0, 0, 0, H);
    skyG.addColorStop(0, this._lerpColor(colors.skyTop, '#020305', nightness));
    skyG.addColorStop(0.6, this._lerpColor(colors.skyBot, '#030507', nightness));
    skyG.addColorStop(1, colors.fog);
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, H);

    // Stars at altitude
    if (alt > 2) {
      const starAlpha = Math.min(0.8, (alt - 2) * 0.15);
      for (let i = 0; i < 80; i++) {
        const sx = ((i * 137.5 + World.seed) % W);
        const sy = ((i * 73.1 + World.seed * 0.3) % (H * 0.55));
        const twinkle = 0.4 + Math.sin(this.time * 0.03 + i * 1.3) * 0.35;
        ctx.fillStyle = `rgba(200,215,255,${starAlpha * twinkle})`;
        ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
      }
    }

    // Sun/Moon
    const sunY = H * (0.12 + alt * 0.02);
    if (alt < 6) {
      // Sun
      const sunG = ctx.createRadialGradient(W * 0.8, sunY, 0, W * 0.8, sunY, 60);
      sunG.addColorStop(0, 'rgba(255,240,180,0.4)');
      sunG.addColorStop(0.5, 'rgba(255,200,80,0.1)');
      sunG.addColorStop(1, 'rgba(255,140,30,0)');
      ctx.fillStyle = sunG;
      ctx.beginPath();
      ctx.arc(W * 0.8, sunY, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,245,200,0.75)';
      ctx.beginPath();
      ctx.arc(W * 0.8, sunY, 18, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Moon
      const moonG = ctx.createRadialGradient(W * 0.8, sunY, 0, W * 0.8, sunY, 40);
      moonG.addColorStop(0, 'rgba(210,225,255,0.25)');
      moonG.addColorStop(1, 'rgba(100,120,200,0)');
      ctx.fillStyle = moonG;
      ctx.beginPath();
      ctx.arc(W * 0.8, sunY, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(215,228,250,0.82)';
      ctx.beginPath();
      ctx.arc(W * 0.8, sunY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(10,15,30,0.8)';
      ctx.beginPath();
      ctx.arc(W * 0.8 + 5, sunY - 3, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _renderParallax(ctx, W, H, colors) {
    const alphas = [0.55, 0.70, 0.85];
    const darkens = [0.7, 0.8, 0.9];

    for (let li = 0; li < this.parallaxLayers.length; li++) {
      const layer = this.parallaxLayers[li];
      const offsetX = this.camX * layer.depth;
      const pts = layer.points;

      ctx.fillStyle = `rgba(15,20,35,${alphas[li]})`;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i < pts.length; i++) {
        const sx = pts[i].x * W - (offsetX % W);
        const sy = pts[i].y * H;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      // Tile second copy
      for (let i = 0; i < pts.length; i++) {
        const sx = pts[i].x * W - (offsetX % W) + W;
        const sy = pts[i].y * H;
        ctx.lineTo(sx, sy);
      }
      ctx.lineTo(W * 2, H); ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
    }
  },

  _renderFog(ctx, W, H, colors) {
    const fogG = ctx.createLinearGradient(0, H * 0.5, 0, H);
    fogG.addColorStop(0, colors.fog + '00');
    fogG.addColorStop(0.5, colors.fog + '18');
    fogG.addColorStop(1, colors.fog + '44');
    ctx.fillStyle = fogG;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);
  },

  // Build and cache terrain path for a visible segment
  _getTerrainPath(x0, x1) {
    const step = 8;
    const pts = [];
    for (let x = x0; x <= x1 + step; x += step) {
      pts.push({ x, y: World.getTerrainYSmooth(x) });
    }
    return pts;
  },

  _renderTerrain(ctx, W, H, colors, biome) {
    const wx0 = this.camX - 50;
    const wx1 = this.camX + W + 50;
    const pts = this._getTerrainPath(wx0, wx1);
    const botY = this.camY + H + 50;
    const isSnowy = biome === 'snowfield' || biome === 'glacial';
    const isAlpine = biome === 'alpine';

    // — Underground fill with gradient depth —
    const deepY = botY;
    const surfAvg = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const depthG = ctx.createLinearGradient(0, surfAvg - this.camY, 0, this.camY + H + 60);
    if (isSnowy) {
      depthG.addColorStop(0, '#c8dce8');
      depthG.addColorStop(0.04, '#8898a8');
      depthG.addColorStop(0.15, '#585868');
      depthG.addColorStop(1, '#282830');
    } else if (isAlpine) {
      depthG.addColorStop(0, colors.grassTop);
      depthG.addColorStop(0.05, colors.grassMid);
      depthG.addColorStop(0.2, colors.soil);
      depthG.addColorStop(1, '#1e1a10');
    } else {
      depthG.addColorStop(0, colors.grassTop);
      depthG.addColorStop(0.04, colors.grassMid);
      depthG.addColorStop(0.18, colors.soil);
      depthG.addColorStop(1, '#1a1408');
    }
    ctx.fillStyle = depthG;
    ctx.beginPath();
    ctx.moveTo(pts[0].x - this.camX, pts[0].y - this.camY);
    for (let i = 1; i < pts.length - 1; i++) {
      const cx = (pts[i].x + pts[i+1].x) / 2 - this.camX;
      const cy = (pts[i].y + pts[i+1].y) / 2 - this.camY;
      ctx.quadraticCurveTo(pts[i].x - this.camX, pts[i].y - this.camY, cx, cy);
    }
    ctx.lineTo(pts[pts.length-1].x - this.camX, pts[pts.length-1].y - this.camY);
    ctx.lineTo(wx1 - this.camX, deepY - this.camY);
    ctx.lineTo(wx0 - this.camX, deepY - this.camY);
    ctx.closePath();
    ctx.fill();

    // — Rock strata lines (underground detail) —
    ctx.save();
    for (let strataY = Math.floor((this.camY + 80) / 60) * 60; strataY < this.camY + H; strataY += 60) {
      const alpha = Math.min(0.12, 0.04 + (strataY - surfAvg) / 4000);
      if (alpha <= 0) continue;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([18, 28]);
      ctx.beginPath();
      ctx.moveTo(0, strataY - this.camY);
      ctx.lineTo(W, strataY - this.camY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // — Surface edge (grass/snow line) —
    ctx.save();
    ctx.strokeStyle = isSnowy ? 'rgba(220,236,248,0.88)' : colors.grassTop;
    ctx.lineWidth = isSnowy ? 3 : 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x - this.camX, pts[0].y - this.camY);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2 - this.camX;
      const my = (pts[i].y + pts[i+1].y) / 2 - this.camY;
      ctx.quadraticCurveTo(pts[i].x - this.camX, pts[i].y - this.camY, mx, my);
    }
    ctx.lineTo(pts[pts.length-1].x - this.camX, pts[pts.length-1].y - this.camY);
    ctx.stroke();

    // Snow layer on top of terrain
    if (isSnowy || isAlpine) {
      const snowDepth = isSnowy ? 10 : 5;
      ctx.fillStyle = `rgba(218,234,248,${isSnowy ? 0.85 : 0.5})`;
      ctx.beginPath();
      ctx.moveTo(pts[0].x - this.camX, pts[0].y - this.camY);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i+1].x) / 2 - this.camX;
        const my = (pts[i].y + pts[i+1].y) / 2 - this.camY;
        ctx.quadraticCurveTo(pts[i].x - this.camX, pts[i].y - this.camY, mx, my);
      }
      ctx.lineTo(pts[pts.length-1].x - this.camX, pts[pts.length-1].y - this.camY - snowDepth);
      for (let i = pts.length - 1; i > 0; i--) {
        const mx = (pts[i].x + pts[i-1].x) / 2 - this.camX;
        const my = (pts[i].y + pts[i-1].y) / 2 - this.camY - snowDepth;
        ctx.quadraticCurveTo(pts[i].x - this.camX, pts[i].y - this.camY - snowDepth, mx, my);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  },

  _renderSurfaceDetail(ctx, W, H, biome) {
    const isForest = biome === 'forest' || biome === 'highland';
    const isSnowy = biome === 'snowfield' || biome === 'glacial';
    const wind = Physics.windCurrent;

    const wx0 = this.camX - 60;
    const wx1 = this.camX + W + 60;
    const step = isForest ? 18 : 30;

    ctx.save();
    for (let wx = Math.floor(wx0 / step) * step; wx <= wx1; wx += step) {
      const r = World.rng(wx, 500);
      if (r > (isForest ? 0.55 : 0.3)) continue;
      const sx = wx - this.camX;
      const sy = World.getTerrainYSmooth(wx) - this.camY;
      if (sy < -20 || sy > H + 20) continue;

      const waveOff = Math.sin(this.time * 0.06 + wx * 0.08) * (2 + wind * 3);

      if (isSnowy) {
        // Snow wisp puffs
        ctx.fillStyle = 'rgba(220,235,248,0.5)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 3, 5 + r * 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (isForest) {
        // Grass blade
        const h2 = 5 + r * 9;
        ctx.strokeStyle = r > 0.5
          ? `rgba(60,110,45,0.7)`
          : `rgba(50,90,38,0.65)`;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + waveOff * 0.5, sy - h2 * 0.5, sx + waveOff, sy - h2);
        ctx.stroke();
        // Wildflowers
        if (wx % 80 < 4 && biome === 'forest') {
          ctx.fillStyle = r > 0.5 ? '#e8a040' : '#a04080';
          ctx.beginPath();
          ctx.arc(sx + waveOff, sy - h2 - 3, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,200,0.8)';
          ctx.beginPath();
          ctx.arc(sx + waveOff, sy - h2 - 3, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Alpine sparse grass
        ctx.strokeStyle = `rgba(55,80,45,0.5)`;
        ctx.lineWidth = 0.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + waveOff * 0.6, sy - 4 - r * 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  _renderTrees(ctx, W, H, front) {
    const wx0 = this.camX - 250;
    const wx1 = this.camX + W + 250;
    const chunkSize = 600;
    const wind = Physics.windCurrent;
    const windOff = Math.sin(this.time * 0.05) * (3 + wind * 8);

    for (let cx = Math.floor(wx0 / chunkSize) * chunkSize; cx <= wx1; cx += chunkSize) {
      const trees = World.getTrees(cx);
      for (const tree of trees) {
        const isFront = tree.type !== 'pine' || tree.size < 0.8;
        if (isFront !== front) continue;
        Entities.drawTree(ctx, tree, this.camX, this.camY, windOff);
      }
    }
  },

  _renderRocks(ctx, W, H) {
    const wx0 = this.camX - 100;
    const wx1 = this.camX + W + 100;
    const chunkSize = 600;
    for (let cx = Math.floor(wx0 / chunkSize) * chunkSize; cx <= wx1; cx += chunkSize) {
      const rocks = World.getRocks(cx);
      for (const rock of rocks) {
        Entities.drawRock(ctx, rock, this.camX, this.camY);
      }
    }
  },

  _renderLighting(ctx, W, H, biome) {
    // Vignette
    const vg = ctx.createRadialGradient(W/2, H/2, H * 0.3, W/2, H/2, H * 0.9);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // God rays from sun direction (only forest/highland)
    const alt = this.player.x / 1000;
    if (alt < 5) {
      const alpha = Math.max(0, 0.05 - alt * 0.01);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 5; i++) {
        const angle = -0.4 + i * 0.12;
        const rayG = ctx.createLinearGradient(W * 0.8, 0, W * 0.8 + Math.cos(angle) * H, H);
        rayG.addColorStop(0, 'rgba(255,240,180,0.6)');
        rayG.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = rayG;
        ctx.beginPath();
        ctx.moveTo(W * 0.8, 0);
        ctx.lineTo(W * 0.8 - 20 + i * 30, H);
        ctx.lineTo(W * 0.8 - 10 + i * 30, H);
        ctx.lineTo(W * 0.8 + 10, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Height fog (atmospheric at altitude)
    if (alt > 4) {
      const fogAlpha = Math.min(0.25, (alt - 4) * 0.04);
      const atmoG = ctx.createLinearGradient(0, 0, 0, H * 0.4);
      atmoG.addColorStop(0, `rgba(140,160,200,${fogAlpha})`);
      atmoG.addColorStop(1, `rgba(140,160,200,0)`);
      ctx.fillStyle = atmoG;
      ctx.fillRect(0, 0, W, H * 0.4);
    }
  },

  _lerpColor(a, b, t) {
    const pa = this._parseHex(a), pb = this._parseHex(b);
    if (!pa || !pb) return a;
    const r = Math.round(pa[0] + (pb[0]-pa[0])*t);
    const g = Math.round(pa[1] + (pb[1]-pa[1])*t);
    const bl = Math.round(pa[2] + (pb[2]-pa[2])*t);
    return `rgb(${r},${g},${bl})`;
  },

  _parseHex(hex) {
    const m = hex.replace('#','').match(/.{2}/g);
    if (!m) return null;
    return m.map(h => parseInt(h, 16));
  },

  loop() {
    if (!this.running) return;
    this.update();
    this.render();
    requestAnimationFrame(() => this.loop());
  }
};

window.Game = Game;
window.addEventListener('load', () => Game.init());
