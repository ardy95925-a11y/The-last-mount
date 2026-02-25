// engine.js — Renderer: voxel tiles, parallax BG, foliage, rope, player

const Engine = (() => {
  let canvas, ctx, W, H;
  let camX = 0, camY = 0, camTargetX = 0, camTargetY = 0;
  let aimCanvas, aimCtx;
  let t = 0; // global time for animations

  // Tile color palettes
  const TILE_COLORS = {
    0: null,
    1: ['#6b6b6b','#7a7a7a','#5a5a5a','#888'], // STONE
    2: ['#7a5c3a','#8b6b4a','#6b4e2a','#9a7a5a'], // DIRT
    3: ['#5a8a2a','#6a9e38','#4a7a20','#7ab540'], // GRASS
    4: ['#e8f0ff','#f0f5ff','#d8e8f8','#fff'],   // SNOW
    5: ['#888080','#9a9090','#706868','#aaa'],    // ROCK
    6: ['#a0c8e8','#b8d8f0','#8ab8d8','#c8e8ff'],// ICE
    7: ['#3a3844','#45424f','#302e38','#555'],    // DARK STONE
    8: ['#a09080','#b0a090','#8a7868','#c0b0a0'],// GRAVEL
    9: ['#4a7840','#5a8e50','#3a6830','#6a9e60'],// MOSS
    10: ['#c8a870','#d8b880','#b89858','#e0c898'],// CAMP FLOOR
    11: ['#8a6040','#a07050','#705030','#b08060'],// CAMP WALL
    14: ['#8b5e2a','#a0703a','#6a4a20','#b88040'],// WOOD
    15: ['#6b4a20','#7a5530','#5a3a10','#8a6040'],// LOG
  };

  // Foliage emojis / icons mapped to draw functions
  const TREE_COLORS = {
    trunk: '#7a5520',
    trunk2: '#8a6530',
    leaf1: '#2d7a1e',
    leaf2: '#3a9a28',
    leaf3: '#4ab038',
    leaf4: '#1a6010',
    pine1: '#1a5522',
    pine2: '#236b2c',
    pine3: '#2d8238',
    dark: '#0f3a14',
  };

  // Item icons
  const ITEM_ICONS = {
    herb: '🌿', mushroom: '🍄', crystal_shard: '💎', old_coin: '🪙',
    rare_herb: '🌺', fossil: '🦴', gemstone: '💠', ice_crystal: '❄️',
    ancient_relic: '🏺', rare_crystal: '🔮', summit_stone: '⚪', sky_gem: '✨',
  };

  // ─── INIT ─────────────────────────────────────────
  function init(c, ac) {
    canvas = c; ctx = c.getContext('2d');
    aimCanvas = ac; aimCtx = ac.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    W = canvas.width = aimCanvas.width = window.innerWidth;
    H = canvas.height = aimCanvas.height = window.innerHeight;
  }

  // ─── CAMERA ───────────────────────────────────────
  function setCameraTarget(x, y) {
    camTargetX = x;
    camTargetY = y - H * 0.28;
  }

  function updateCamera() {
    camX += (camTargetX - camX) * 0.09;
    camY += (camTargetY - camY) * 0.09;
  }

  // World → screen
  function wx(worldX) { return worldX - camX + W / 2; }
  function wy(worldY) { return worldY - camY + H / 2; }

  // ─── SKY GRADIENT ─────────────────────────────────
  function drawSky(altitude) {
    const a = Math.min(1, altitude / 800);
    const r1 = lerp(0x55, 0x08, a), g1 = lerp(0x99, 0x06, a), b1 = lerp(0xcc, 0x0c, a);
    const r2 = lerp(0x22, 0x00, a), g2 = lerp(0x55, 0x02, a), b2 = lerp(0x88, 0x08, a);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `rgb(${r2|0},${g2|0},${b2|0})`);
    grad.addColorStop(0.5, `rgb(${lerp(r1,r2,0.5)|0},${lerp(g1,g2,0.5)|0},${lerp(b1,b2,0.5)|0})`);
    grad.addColorStop(1, `rgb(${r1|0},${g1|0},${b1|0})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars at high altitude
    if (altitude > 300) {
      const starAlpha = Math.min(0.8, (altitude - 300) / 400);
      ctx.fillStyle = `rgba(255,255,255,${starAlpha})`;
      // Fixed stars based on camera
      for (let i = 0; i < 80; i++) {
        const sx = ((i * 173 + camX * 0.02) % W + W) % W;
        const sy = ((i * 97 + i * 37) % (H * 0.7));
        const sr = 0.5 + (i % 3) * 0.5;
        const twinkle = 0.5 + 0.5 * Math.sin(t * 0.04 + i);
        ctx.globalAlpha = starAlpha * twinkle;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ─── PARALLAX MOUNTAINS ───────────────────────────
  function drawParallaxBG(altitude) {
    const layers = [
      { parallax: 0.15, alpha: 0.15, color: '#4a6a8a', scale: 1.4 },
      { parallax: 0.25, alpha: 0.22, color: '#3a5a78', scale: 1.2 },
      { parallax: 0.4,  alpha: 0.3,  color: '#2a4a68', scale: 1.0 },
      { parallax: 0.6,  alpha: 0.4,  color: '#1a3040', scale: 0.8 },
    ];

    for (const layer of layers) {
      const offX = camX * layer.parallax;
      ctx.fillStyle = layer.color;
      ctx.globalAlpha = layer.alpha;
      ctx.beginPath();
      ctx.moveTo(0, H);

      for (let sx = 0; sx <= W + 40; sx += 20) {
        const worldX = sx + offX;
        const mH = (World.fbm(worldX / (600 * layer.scale), layer.parallax * 3) * 0.5 + 0.5) * H * 0.7;
        const screenY = H - mH * (1 - altitude / 2000) + 50;
        ctx.lineTo(sx, screenY);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ─── CLOUD LAYER ──────────────────────────────────
  function drawClouds(altitude) {
    if (altitude > 600) return;
    const windX = Physics.getWind();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 8; i++) {
      const cx2 = ((i * 331 + t * 0.15 * (0.5 + i * 0.1) + camX * 0.05) % (W + 300)) - 150;
      const cy2 = 60 + (i * 77) % (H * 0.4);
      const cw = 80 + (i * 43) % 120;
      const ch = 22 + (i * 17) % 28;
      ctx.beginPath();
      ctx.ellipse(cx2, cy2, cw, ch, 0, 0, Math.PI * 2);
      ctx.fill();
      // Fluffy bumps
      ctx.beginPath();
      ctx.ellipse(cx2 - cw * 0.3, cy2 - ch * 0.3, cw * 0.5, ch * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx2 + cw * 0.25, cy2 - ch * 0.2, cw * 0.45, ch * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ─── TILE RENDERING ───────────────────────────────
  function drawTile(tile, sx, sy, shadow = false) {
    const colors = TILE_COLORS[tile];
    if (!colors) return;
    const T = World.TILE;

    // Base color
    ctx.fillStyle = colors[0];
    ctx.fillRect(sx, sy, T, T);

    // Top face highlight (3D effect)
    ctx.fillStyle = colors[1];
    ctx.fillRect(sx, sy, T, 4);

    // Left face shadow
    ctx.fillStyle = colors[2];
    ctx.fillRect(sx, sy, 3, T);

    // Right face darker
    ctx.fillStyle = colors[2] + '80';
    ctx.fillRect(sx + T - 3, sy, 3, T);

    // Random surface variation
    if (tile === World.T.GRASS) {
      ctx.fillStyle = TREE_COLORS.leaf4;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(sx + 2, sy, T - 4, 6);
      ctx.globalAlpha = 1;
    }

    if (tile === World.T.SNOW) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(sx, sy, T, 5);
    }

    if (shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(sx, sy, T, T);
    }
  }

  // ─── TERRAIN ──────────────────────────────────────
  function drawTerrain() {
    const { txStart, txEnd, tyStart, tyEnd } = World.getVisibleTiles(camX, camY, W, H);
    const T = World.TILE;

    for (let tx = txStart; tx <= txEnd; tx++) {
      for (let ty = tyStart; ty <= tyEnd; ty++) {
        const tile = World.getTileAt(tx * T + T / 2, ty * T + T / 2);
        if (!tile) continue;
        const sx = wx(tx * T), sy = wy(ty * T);
        drawTile(tile, sx, sy);
      }
    }
  }

  // ─── FOLIAGE ──────────────────────────────────────
  function drawFoliage(foliageChunks) {
    const windX = Physics.getWind();

    for (const { foliage, items } of foliageChunks) {
      for (const f of foliage) {
        const sx = wx(f.wx), sy = wy(f.wy);
        if (sx < -100 || sx > W + 100 || sy < -100 || sy > H + 100) continue;
        drawFoliageItem(f, sx, sy, windX);
      }
      for (const item of items) {
        if (item.collected) continue;
        const sx = wx(item.wx), sy = wy(item.wy);
        if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
        drawLootItem(item, sx, sy);
      }
    }
  }

  function drawFoliageItem(f, sx, sy, wind) {
    const sw = Math.sin(t * 0.04 + f.windPhase) * wind * 3;
    const sw2 = Math.sin(t * 0.06 + f.windPhase + 1) * wind * 2;

    ctx.save();
    switch (f.type) {
      case World.FOLIAGE.TREE: drawTree(sx, sy, sw); break;
      case World.FOLIAGE.PINE: drawPine(sx, sy, sw); break;
      case World.FOLIAGE.BUSH: drawBush(sx, sy, sw2); break;
      case World.FOLIAGE.GRASS_BLADE: drawGrassBlade(sx, sy, sw); break;
      case World.FOLIAGE.FLOWER: drawFlower(sx, sy, sw2); break;
      case World.FOLIAGE.MUSHROOM: drawMushroom(sx, sy); break;
      case World.FOLIAGE.FERN: drawFern(sx, sy, sw); break;
    }
    ctx.restore();
  }

  function drawTree(sx, sy, sw) {
    // Trunk
    ctx.fillStyle = TREE_COLORS.trunk;
    ctx.fillRect(sx - 4, sy, 8, 30);
    ctx.fillStyle = TREE_COLORS.trunk2;
    ctx.fillRect(sx - 3, sy, 3, 30);

    // Canopy layers with wind
    const wsx = sw * 0.7;
    ctx.fillStyle = TREE_COLORS.leaf4;
    ctx.beginPath();
    ctx.ellipse(sx + wsx * 1.2, sy - 18, 24, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TREE_COLORS.leaf2;
    ctx.beginPath();
    ctx.ellipse(sx + wsx, sy - 16, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TREE_COLORS.leaf3;
    ctx.beginPath();
    ctx.ellipse(sx + wsx * 0.5, sy - 28, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TREE_COLORS.leaf1;
    ctx.beginPath();
    ctx.ellipse(sx - 8 + wsx, sy - 10, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx + 8 + wsx * 0.8, sy - 12, 13, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPine(sx, sy, sw) {
    const wsx = sw * 0.5;
    ctx.fillStyle = TREE_COLORS.trunk;
    ctx.fillRect(sx - 3, sy + 8, 6, 22);
    // Pine tiers
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const w = 20 - i * 3 + wsx * (tiers - i) * 0.2;
      const y2 = sy - i * 14;
      ctx.fillStyle = i % 2 === 0 ? TREE_COLORS.pine1 : TREE_COLORS.pine2;
      ctx.beginPath();
      ctx.moveTo(sx + wsx * (tiers - i) * 0.15, y2 - 12);
      ctx.lineTo(sx - w + wsx * 0.3, y2 + 4);
      ctx.lineTo(sx + w + wsx, y2 + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBush(sx, sy, sw) {
    ctx.fillStyle = TREE_COLORS.leaf4;
    ctx.beginPath();
    ctx.ellipse(sx + sw * 0.3, sy - 8, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TREE_COLORS.leaf2;
    ctx.beginPath();
    ctx.ellipse(sx - 6 + sw * 0.2, sy - 6, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx + 6 + sw * 0.4, sy - 6, 10, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGrassBlade(sx, sy, sw) {
    ctx.strokeStyle = '#4a8a28';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * 4, sy + 4);
      const tipX = sx + i * 3 + sw * (1 + Math.abs(i) * 0.3);
      ctx.quadraticCurveTo(sx + i * 4 + sw * 0.5, sy - 4, tipX, sy - 10 - Math.abs(i) * 2);
      ctx.stroke();
    }
  }

  function drawFlower(sx, sy, sw) {
    const colors = ['#ff6b8a', '#ffb830', '#c86bff', '#ff8c42', '#6bd4ff'];
    const col = colors[Math.floor(sx * 0.1) % colors.length];
    ctx.strokeStyle = '#3a7a20';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy + 4);
    ctx.quadraticCurveTo(sx + sw * 0.5, sy - 4, sx + sw, sy - 12);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(sx + sw, sy - 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffee44';
    ctx.beginPath();
    ctx.arc(sx + sw, sy - 12, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMushroom(sx, sy) {
    ctx.fillStyle = '#c84040';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 8, 11, 9, 0, 0, Math.PI, true);
    ctx.fill();
    ctx.fillStyle = '#e86868';
    ctx.beginPath();
    ctx.arc(sx - 3, sy - 11, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 2, sy - 13, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8d8b8';
    ctx.fillRect(sx - 3, sy - 8, 6, 8);
  }

  function drawFern(sx, sy, sw) {
    ctx.strokeStyle = '#3a7030';
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      const angle = (i / 2) * 0.8 + sw * 0.05;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const l = 14;
      for (let j = 1; j <= 4; j++) {
        const jx = 0, jy = -j * (l / 4);
        const lx = j * 3.5 * (i >= 0 ? 1 : -1) * (1 + j * 0.2);
        ctx.lineTo(jx + lx, jy);
        ctx.lineTo(jx, jy);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawLootItem(item, sx, sy) {
    const icon = ITEM_ICONS[item.type] || '✦';
    const bob = Math.sin(t * 0.05 + sx * 0.1) * 3;

    // Glow
    ctx.shadowColor = '#f4c542';
    ctx.shadowBlur = 10 + bob * 2;
    ctx.fillStyle = 'rgba(244,197,66,0.15)';
    ctx.beginPath();
    ctx.arc(sx, sy + bob, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, sx, sy + bob);
  }

  // ─── CAMP ─────────────────────────────────────────
  function drawCampSign(sx, sy) {
    // Cozy shack
    const w = 90, h = 60;
    // Roof
    ctx.fillStyle = '#6a3820';
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 - 10, sy - h / 2);
    ctx.lineTo(sx, sy - h / 2 - 30);
    ctx.lineTo(sx + w / 2 + 10, sy - h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a4828';
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 - 10, sy - h / 2);
    ctx.lineTo(sx, sy - h / 2 - 30);
    ctx.lineTo(sx + 2, sy - h / 2 - 30);
    ctx.lineTo(sx - w / 2 - 8, sy - h / 2);
    ctx.fill();

    // Walls
    ctx.fillStyle = '#a07050';
    ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
    ctx.fillStyle = '#8a6040';
    ctx.fillRect(sx - w / 2, sy - h / 2, 5, h);

    // Door
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(sx - 12, sy, 24, h / 2 + 2);
    ctx.fillStyle = '#7a4a28';
    ctx.fillRect(sx - 11, sy + 1, 22, h / 2);
    ctx.fillStyle = '#f4c54299';
    ctx.beginPath();
    ctx.arc(sx + 8, sy + (h / 4), 2, 0, Math.PI * 2);
    ctx.fill();

    // Window
    ctx.fillStyle = '#3a2808';
    ctx.fillRect(sx - 38, sy - h / 2 + 8, 20, 16);
    ctx.fillStyle = 'rgba(255,220,120,0.4)';
    ctx.fillRect(sx - 37, sy - h / 2 + 9, 18, 14);
    // Warm glow from window
    const wgrd = ctx.createRadialGradient(sx - 28, sy - h / 2 + 15, 2, sx - 28, sy - h / 2 + 15, 22);
    wgrd.addColorStop(0, 'rgba(255,200,80,0.25)');
    wgrd.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = wgrd;
    ctx.fillRect(sx - 50, sy - h / 2 - 5, 50, 40);

    // Chimney
    ctx.fillStyle = '#7a5030';
    ctx.fillRect(sx + 20, sy - h / 2 - 38, 12, 24);
    // Smoke
    ctx.fillStyle = 'rgba(200,200,200,0.15)';
    for (let i = 0; i < 4; i++) {
      const smokeOff = (t * 0.3 + i * 15) % 40;
      ctx.beginPath();
      ctx.arc(sx + 26 + Math.sin(t * 0.04 + i) * 4, sy - h / 2 - 38 - smokeOff, 4 + i, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sign
    ctx.fillStyle = '#6a3010';
    ctx.fillRect(sx - 28, sy - h / 2 - 6, 56, 14);
    ctx.fillStyle = '#f0d080';
    ctx.font = 'bold 9px "Pixelify Sans", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⛺ CAMP', sx, sy - h / 2 + 1);
  }

  // ─── ROPE ─────────────────────────────────────────
  function drawRope(rope) {
    if (rope.retracted) return;
    const pts = rope.points;
    if (pts.length < 2) return;

    // Shadow
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(wx(pts[0].x) + 2, wy(pts[0].y) + 2);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(wx(pts[i].x) + 2, wy(pts[i].y) + 2);
    }
    ctx.stroke();

    // Rope gradient segments
    for (let i = 0; i < pts.length - 1; i++) {
      const progress = i / (pts.length - 1);
      const r = Math.floor(lerp(180, 120, progress));
      const g = Math.floor(lerp(120, 80, progress));
      const b = Math.floor(lerp(60, 40, progress));
      ctx.beginPath();
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = 3 - progress * 1;
      ctx.moveTo(wx(pts[i].x), wy(pts[i].y));
      ctx.lineTo(wx(pts[i + 1].x), wy(pts[i + 1].y));
      ctx.stroke();
    }

    // Hook at anchor
    if (rope.anchored) {
      const anchorSX = wx(rope.anchorX), anchorSY = wy(rope.anchorY);
      ctx.fillStyle = '#c8a850';
      ctx.beginPath();
      ctx.arc(anchorSX, anchorSY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0d070';
      ctx.beginPath();
      ctx.arc(anchorSX - 1, anchorSY - 1, 3, 0, Math.PI * 2);
      ctx.fill();
      // Anchor glow
      ctx.strokeStyle = 'rgba(240,208,100,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(anchorSX, anchorSY, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Flying hook
    if (rope.thrown) {
      const hsx = wx(rope.hookX), hsy = wy(rope.hookY);
      ctx.fillStyle = '#c8a850';
      ctx.beginPath();
      ctx.arc(hsx, hsy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ─── PLAYER ───────────────────────────────────────
  function drawPlayer(player) {
    const sx = wx(player.x), sy = wy(player.y);
    const pw = player.width, ph = player.height;
    const flip = !player.facingRight;

    ctx.save();
    ctx.translate(sx, sy);
    if (flip) ctx.scale(-1, 1);

    const frame = player.animFrame;
    const state = player.state;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, ph / 2 + 2, pw * 0.6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body sway
    const sway = state === 'walk' ? Math.sin(frame * Math.PI / 2) * 1.5 : 0;
    const hangLean = player.hangingOnRope ? Math.sin(t * 0.04) * 4 : 0;
    ctx.translate(sway + hangLean, 0);

    // Legs
    const legSwing = state === 'walk' ? Math.sin(frame * Math.PI / 2) * 6 : 0;
    ctx.fillStyle = '#3a2860';
    // Left leg
    ctx.save(); ctx.translate(-5, ph * 0.2); ctx.rotate(legSwing * 0.04);
    ctx.fillRect(-3, 0, 6, ph * 0.35); ctx.restore();
    // Right leg
    ctx.save(); ctx.translate(5, ph * 0.2); ctx.rotate(-legSwing * 0.04);
    ctx.fillRect(-3, 0, 6, ph * 0.35); ctx.restore();

    // Boots
    ctx.fillStyle = '#7a4820';
    ctx.save(); ctx.translate(-5, ph * 0.52); ctx.rotate(legSwing * 0.04);
    ctx.fillRect(-4, 0, 8, 7); ctx.restore();
    ctx.save(); ctx.translate(5, ph * 0.52); ctx.rotate(-legSwing * 0.04);
    ctx.fillRect(-4, 0, 8, 7); ctx.restore();

    // Torso
    ctx.fillStyle = '#c84040';
    ctx.fillRect(-pw * 0.38, -ph * 0.05, pw * 0.76, ph * 0.32);
    // Jacket highlight
    ctx.fillStyle = '#e05050';
    ctx.fillRect(-pw * 0.38, -ph * 0.05, 4, ph * 0.32);
    // Backpack
    ctx.fillStyle = '#5a3a80';
    ctx.fillRect(pw * 0.15, -ph * 0.12, pw * 0.32, ph * 0.28);
    ctx.fillStyle = '#7a5aa0';
    ctx.fillRect(pw * 0.18, -ph * 0.1, pw * 0.26, ph * 0.12);

    // Arms
    const armSwing = state === 'walk' ? Math.sin(frame * Math.PI / 2 + Math.PI) * 5 : 0;
    ctx.fillStyle = '#c84040';
    ctx.save(); ctx.translate(-pw * 0.35, -ph * 0.05); ctx.rotate(armSwing * 0.06 + (player.hangingOnRope ? 0.4 : 0));
    ctx.fillRect(-3, 0, 6, ph * 0.24); ctx.restore();
    ctx.save(); ctx.translate(pw * 0.35, -ph * 0.05); ctx.rotate(-armSwing * 0.06 + (player.hangingOnRope ? -0.3 : 0));
    ctx.fillRect(-3, 0, 6, ph * 0.24); ctx.restore();

    // Head
    ctx.fillStyle = '#f0c890';
    ctx.beginPath();
    ctx.ellipse(0, -ph * 0.26, pw * 0.28, ph * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hat
    ctx.fillStyle = '#3a3060';
    ctx.beginPath();
    ctx.ellipse(0, -ph * 0.36, pw * 0.3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-pw * 0.2, -ph * 0.52, pw * 0.4, ph * 0.18);
    ctx.fillStyle = '#4a4080';
    ctx.fillRect(-pw * 0.18, -ph * 0.5, pw * 0.36, 3);

    // Eyes
    ctx.fillStyle = '#1a1020';
    ctx.fillRect(4, -ph * 0.3, 3, 3);
    ctx.fillRect(8, -ph * 0.3, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, -ph * 0.3, 1, 1);
    ctx.fillRect(9, -ph * 0.3, 1, 1);

    ctx.restore();

    // Health bar
    if (player.health < 100) {
      const bw = 40;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sx - bw / 2, sy - ph / 2 - 14, bw, 5);
      ctx.fillStyle = player.health > 50 ? '#5a9e3a' : player.health > 25 ? '#f4c542' : '#e05555';
      ctx.fillRect(sx - bw / 2, sy - ph / 2 - 14, bw * (player.health / 100), 5);
    }
  }

  // ─── AIM LINE ─────────────────────────────────────
  function drawAimLine(playerX, playerY, angle, power, visible) {
    aimCtx.clearRect(0, 0, W, H);
    if (!visible) return;

    const sx = wx(playerX), sy = wy(playerY);
    const len = 60 + power * 80;
    const ex = sx + Math.cos(angle) * len;
    const ey = sy + Math.sin(angle) * len;

    // Dotted arc
    aimCtx.save();
    aimCtx.setLineDash([6, 6]);
    aimCtx.strokeStyle = 'rgba(244,197,66,0.6)';
    aimCtx.lineWidth = 2;
    aimCtx.beginPath();
    aimCtx.moveTo(sx, sy);
    aimCtx.lineTo(ex, ey);
    aimCtx.stroke();

    // Arrow tip
    aimCtx.setLineDash([]);
    aimCtx.fillStyle = '#f4c542';
    aimCtx.beginPath();
    aimCtx.arc(ex, ey, 5, 0, Math.PI * 2);
    aimCtx.fill();
    aimCtx.restore();
  }

  // ─── VIGNETTE ─────────────────────────────────────
  function drawVignette() {
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ─── MAIN RENDER ──────────────────────────────────
  function render(player, rope, foliageChunks, altitude, campNearby) {
    t++;
    updateCamera();

    ctx.clearRect(0, 0, W, H);
    drawSky(altitude);
    drawParallaxBG(altitude);
    drawClouds(altitude);
    drawTerrain();

    // Draw camps
    if (campNearby) {
      // Camp is drawn as part of terrain decoration
      drawCampSign(wx(player.x + 60), wy(World.getTerrainY(player.x + 60) - 50));
    }

    drawFoliage(foliageChunks);
    drawRope(rope);
    drawPlayer(player);
    drawVignette();

    // Altitude haze
    if (altitude > 500) {
      const hazeAlpha = Math.min(0.3, (altitude - 500) / 600);
      ctx.fillStyle = `rgba(150,180,220,${hazeAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function getT() { return t; }

  return {
    init, render, resize, setCameraTarget, drawAimLine,
    wx, wy, getT,
    W: () => W, H: () => H,
  };
})();
