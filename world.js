// world.js — Infinite mountain terrain generation & rendering

const World = (() => {
  // ── Constants ──────────────────────────────────────────────────────
  const CHUNK_H = 600;      // px height per chunk
  const WALL_MARGIN = 80;   // base wall thickness
  const GRIP_COUNT = 6;     // grip points per chunk

  // ── State ──────────────────────────────────────────────────────────
  let chunks = [];          // generated terrain chunks
  let cameraY = 0;          // world units scrolled up
  let altitudeM = 0;        // metres climbed
  let weather = 'clear';    // clear | wind | snow | storm
  let weatherTimer = 0;
  let snowParticles = [];
  let windX = 0, targetWindX = 0;
  let stars = [];
  let bgLayers = [];        // parallax mountains
  let seed = Math.random() * 99999 | 0;
  let campThresholds = [];  // altitudes where camps appear
  let nextCampAlt = 400;    // first camp at 400m

  // Sky gradient stops keyed by altitude
  const SKY_PALETTES = [
    { alt: 0,    top: '#0a0a1a', mid: '#1a1535', bot: '#2a2040' },
    { alt: 500,  top: '#050a1a', mid: '#0d1530', bot: '#1a2040' },
    { alt: 1500, top: '#000510', mid: '#050a20', bot: '#0d1030' },
    { alt: 4000, top: '#000208', mid: '#020510', bot: '#05080d' },
  ];

  // ── Seeded RNG ─────────────────────────────────────────────────────
  function rng(s) {
    s = Math.sin(s) * 43758.5453;
    return s - Math.floor(s);
  }
  function chunkRng(chunkIdx, offset) {
    return rng(seed + chunkIdx * 137.3 + offset * 31.7);
  }

  // ── Terrain generation ─────────────────────────────────────────────
  function generateChunk(idx) {
    const baseAlt = idx * CHUNK_H;
    const difficulty = Math.min(idx * 0.08, 3.5);

    // Left wall profile
    const leftPts = [];
    const rightPts = [];
    const steps = 20;

    let lx = 120 + chunkRng(idx, 0) * 80;
    let rx = lx + 200 + chunkRng(idx, 1) * 120 - difficulty * 15;
    if (rx - lx < 100) rx = lx + 100;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = baseAlt + t * CHUNK_H;

      // Oscillating walls, getting narrower with height
      const wave1 = Math.sin(t * Math.PI * 3 + idx * 2.1) * (40 - difficulty * 4);
      const wave2 = Math.cos(t * Math.PI * 5 + idx * 1.7) * (20 - difficulty * 2);
      const noise = (chunkRng(idx, i + 2) - 0.5) * 30;

      const lEdge = lx + wave1 + noise * 0.5;
      const rEdge = rx + wave2 - noise * 0.5;

      leftPts.push({ x: lEdge, y });
      rightPts.push({ x: rEdge, y });
    }

    // Grip points (rocky outcrops player can grab)
    const grips = [];
    for (let g = 0; g < GRIP_COUNT + Math.floor(difficulty); g++) {
      const t = (g + 0.5 + chunkRng(idx, g + 50) * 0.8) / (GRIP_COUNT + 1);
      const y = baseAlt + t * CHUNK_H;
      const side = chunkRng(idx, g + 100) > 0.5 ? 'left' : 'right';

      let x;
      const segIdx = Math.floor(t * steps);
      if (side === 'left') {
        x = leftPts[segIdx].x + 30 + chunkRng(idx, g + 200) * 40;
      } else {
        x = rightPts[segIdx].x - 30 - chunkRng(idx, g + 200) * 40;
      }

      grips.push({
        x, y, side,
        r: 12 + chunkRng(idx, g + 300) * 8,
        type: chunkRng(idx, g + 400) > 0.8 ? 'ice' : 'rock',
        collected: false,
        wobble: 0
      });
    }

    // Collectibles
    const collectibles = [];
    const numCollect = 1 + Math.floor(chunkRng(idx, 999) * 3);
    for (let c = 0; c < numCollect; c++) {
      const t = (c + 0.3 + chunkRng(idx, c + 500) * 0.6) / numCollect;
      const y = baseAlt + t * CHUNK_H;
      const segIdx = Math.floor(t * steps);
      const lx2 = leftPts[Math.min(segIdx, leftPts.length - 1)].x;
      const rx2 = rightPts[Math.min(segIdx, rightPts.length - 1)].x;
      const x = lx2 + (rx2 - lx2) * (0.2 + chunkRng(idx, c + 600) * 0.6);

      const roll = chunkRng(idx, c + 700);
      let type;
      if (roll < 0.4) type = 'crystal';
      else if (roll < 0.65) type = 'fossil';
      else if (roll < 0.8) type = 'herb';
      else if (roll < 0.92) type = 'gem';
      else type = 'relic';

      collectibles.push({ x, y, type, collected: false, bob: Math.random() * Math.PI * 2 });
    }

    // Hazards
    const hazards = [];
    if (difficulty > 0.5) {
      const numHaz = Math.floor(chunkRng(idx, 888) * difficulty);
      for (let h = 0; h < numHaz; h++) {
        const t = (h + 0.5) / (numHaz + 1);
        const y = baseAlt + t * CHUNK_H;
        const segIdx = Math.floor(t * steps);
        const lx2 = leftPts[Math.min(segIdx, leftPts.length - 1)].x;
        const rx2 = rightPts[Math.min(segIdx, rightPts.length - 1)].x;
        const x = lx2 + (rx2 - lx2) * (0.1 + chunkRng(idx, h + 800) * 0.8);
        const type = chunkRng(idx, h + 900) > 0.6 ? 'icicle' : 'rockfall';
        hazards.push({ x, y, type, active: true, timer: chunkRng(idx, h + 950) * 300 | 0 });
      }
    }

    // Is there a camp here?
    const chunkAlt = idx * (CHUNK_H / 5); // approx metres
    let hasCamp = false;
    if (chunkAlt >= nextCampAlt && campThresholds.indexOf(idx) === -1) {
      hasCamp = true;
      campThresholds.push(idx);
      nextCampAlt += 400 + Math.random() * 400 | 0;
    }

    return { idx, baseAlt, leftPts, rightPts, grips, collectibles, hazards, hasCamp, difficulty };
  }

  function ensureChunks(bottomY, topY) {
    const startIdx = Math.max(0, Math.floor(bottomY / CHUNK_H) - 1);
    const endIdx = Math.ceil(topY / CHUNK_H) + 1;

    for (let i = startIdx; i <= endIdx; i++) {
      if (!chunks[i]) chunks[i] = generateChunk(i);
    }

    // Clean chunks far away
    for (let i = 0; i < startIdx - 3; i++) {
      chunks[i] = null;
    }
  }

  function initStars() {
    stars = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.5 + Math.random() * 1.5,
        twinkle: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
        layer: Math.floor(Math.random() * 3)
      });
    }
  }

  function initBgLayers() {
    bgLayers = [];
    // Generate several mountain silhouette layers
    for (let layer = 0; layer < 5; layer++) {
      const pts = [];
      const count = 8 + layer * 4;
      for (let i = 0; i <= count; i++) {
        const x = (i / count);
        const base = 0.4 + layer * 0.08;
        const h = (rng(layer * 100 + i * 7) * 0.3 + base);
        pts.push({ x, y: h });
      }
      bgLayers.push({ pts, layer });
    }
  }

  function updateWeather(dt) {
    weatherTimer -= dt;
    if (weatherTimer <= 0) {
      const r = Math.random();
      if (r < 0.4) weather = 'clear';
      else if (r < 0.65) weather = 'wind';
      else if (r < 0.85) weather = 'snow';
      else weather = 'storm';
      weatherTimer = 8000 + Math.random() * 12000;

      if (weather === 'wind' || weather === 'storm') {
        targetWindX = (Math.random() - 0.5) * (weather === 'storm' ? 0.6 : 0.3);
      } else {
        targetWindX = 0;
      }
    }

    windX += (targetWindX - windX) * dt * 0.001;

    // Snow particles
    if (weather === 'snow' || weather === 'storm') {
      const rate = weather === 'storm' ? 4 : 1;
      for (let i = 0; i < rate; i++) {
        snowParticles.push({
          x: Math.random(),
          y: -0.05,
          vx: windX * 0.5 + (Math.random() - 0.5) * 0.003,
          vy: 0.001 + Math.random() * 0.002,
          r: 1 + Math.random() * 2,
          alpha: 0.4 + Math.random() * 0.5
        });
      }
    }

    snowParticles = snowParticles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      return p.y < 1.1 && p.x > -0.1 && p.x < 1.1;
    });

    if (snowParticles.length > 400) snowParticles.length = 400;
  }

  // ── Sky color blend ────────────────────────────────────────────────
  function getSkyPalette(alt) {
    const palettes = SKY_PALETTES;
    for (let i = palettes.length - 1; i >= 0; i--) {
      if (alt >= palettes[i].alt) {
        const next = palettes[i + 1];
        if (!next) return palettes[i];
        const t = (alt - palettes[i].alt) / (next.alt - palettes[i].alt);
        return {
          top: lerpColor(palettes[i].top, next.top, t),
          mid: lerpColor(palettes[i].mid, next.mid, t),
          bot: lerpColor(palettes[i].bot, next.bot, t)
        };
      }
    }
    return palettes[0];
  }

  function lerpColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 0xff, ag = (pa >> 8) & 0xff, ab = pa & 0xff;
    const br = (pb >> 16) & 0xff, bg = (pb >> 8) & 0xff, bb = pb & 0xff;
    const r = (ar + (br - ar) * t) | 0;
    const g = (ag + (bg - ag) * t) | 0;
    const bv = (ab + (bb - ab) * t) | 0;
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bv.toString(16).padStart(2,'0')}`;
  }

  // ── Rendering ──────────────────────────────────────────────────────
  function drawBackground(ctx, W, H, scrollY, time) {
    // Sky gradient
    const pal = getSkyPalette(altitudeM);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, pal.top);
    grad.addColorStop(0.5, pal.mid);
    grad.addColorStop(1, pal.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars (parallax)
    const starAlpha = Math.max(0, Math.min(1, 1 - altitudeM / 200));
    if (starAlpha > 0) {
      stars.forEach(s => {
        const twinkle = 0.4 + 0.6 * Math.sin(s.twinkle + time * s.speed * 0.001);
        ctx.globalAlpha = starAlpha * twinkle;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H * 0.7, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // Moon
    if (altitudeM < 2000) {
      const mx = W * 0.75;
      const my = H * 0.15;
      const mr = 28;
      ctx.globalAlpha = Math.max(0.1, 0.8 - altitudeM / 3000);
      const moonGrad = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, mr);
      moonGrad.addColorStop(0, '#f0e8d0');
      moonGrad.addColorStop(0.7, '#d0c8b0');
      moonGrad.addColorStop(1, 'rgba(200,190,170,0)');
      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      ctx.arc(mx, my, mr * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Parallax mountain silhouettes
    bgLayers.forEach((layer, li) => {
      const speed = 0.05 + li * 0.08;
      const yOff = (scrollY * speed) % H;
      const alpha = 0.15 + li * 0.08;
      const darkness = li * 0.04;
      const r = (10 + darkness * 30) | 0;
      const g = (8 + darkness * 20) | 0;
      const b = (20 + darkness * 40) | 0;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(0, H + yOff);

      layer.pts.forEach((p, i) => {
        const x = p.x * W;
        const y = H * (1 - p.y) + yOff;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.lineTo(W, H + yOff);
      ctx.lineTo(0, H + yOff);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawFog(ctx, W, H, time) {
    if (weather === 'clear') return;
    const alpha = weather === 'storm' ? 0.25 : 0.12;
    const fGrad = ctx.createLinearGradient(0, 0, 0, H);
    fGrad.addColorStop(0, `rgba(180,180,200,${alpha})`);
    fGrad.addColorStop(0.5, `rgba(150,150,180,${alpha * 0.5})`);
    fGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fGrad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawSnow(ctx, W, H) {
    ctx.fillStyle = '#ffffff';
    snowParticles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawTerrain(ctx, W, H, scrollY, time) {
    const visBottom = scrollY;
    const visTop = scrollY + H;

    const startChunk = Math.max(0, Math.floor(visBottom / CHUNK_H));
    const endChunk = Math.ceil(visTop / CHUNK_H);

    for (let ci = startChunk; ci <= endChunk; ci++) {
      const chunk = chunks[ci];
      if (!chunk) continue;

      drawChunkWalls(ctx, chunk, W, H, scrollY, time);
      drawChunkGrips(ctx, chunk, W, H, scrollY, time);
      drawChunkCollectibles(ctx, chunk, W, H, scrollY, time);
      drawChunkHazards(ctx, chunk, W, H, scrollY, time);
      if (chunk.hasCamp) drawCampEntrance(ctx, chunk, W, H, scrollY, time);
    }
  }

  function worldToScreen(wx, wy, W, H, scrollY) {
    return { sx: wx, sy: H - (wy - scrollY) };
  }

  function drawChunkWalls(ctx, chunk, W, H, scrollY, time) {
    const leftPts = chunk.leftPts;
    const rightPts = chunk.rightPts;
    const n = leftPts.length;

    // Rock texture effect: draw wall with gradient
    const wallGrad = ctx.createLinearGradient(0, 0, W, 0);
    const d = Math.min(chunk.difficulty / 3.5, 1);
    const r = (42 + d * 20) | 0;
    const g = (35 + d * 10) | 0;
    const b = (60 + d * 30) | 0;
    wallGrad.addColorStop(0, `rgb(${r},${g},${b})`);
    wallGrad.addColorStop(0.5, `rgb(${r * 0.6 | 0},${g * 0.6 | 0},${b * 0.6 | 0})`);
    wallGrad.addColorStop(1, `rgb(${r},${g},${b})`);

    // Left wall
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < n; i++) {
      const s = worldToScreen(leftPts[i].x, leftPts[i].y, W, H, scrollY);
      if (i === 0) ctx.lineTo(s.sx, s.sy);
      else ctx.lineTo(s.sx, s.sy);
    }
    ctx.lineTo(0, worldToScreen(0, leftPts[n - 1].y, W, H, scrollY).sy);
    ctx.closePath();
    ctx.fillStyle = wallGrad;
    ctx.fill();

    // Rock detail lines
    ctx.strokeStyle = `rgba(${r + 20},${g + 20},${b + 20},0.3)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < n - 1; i += 3) {
      const s = worldToScreen(leftPts[i].x - 15, leftPts[i].y, W, H, scrollY);
      const e = worldToScreen(leftPts[i + 1] ? leftPts[i + 1].x - 8 : leftPts[i].x - 5, leftPts[i].y + 30, W, H, scrollY);
      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      ctx.lineTo(e.sx, e.sy);
      ctx.stroke();
    }

    // Right wall
    ctx.beginPath();
    ctx.moveTo(W, H);
    for (let i = 0; i < n; i++) {
      const s = worldToScreen(rightPts[i].x, rightPts[i].y, W, H, scrollY);
      if (i === 0) ctx.lineTo(s.sx, s.sy);
      else ctx.lineTo(s.sx, s.sy);
    }
    ctx.lineTo(W, worldToScreen(0, rightPts[n - 1].y, W, H, scrollY).sy);
    ctx.closePath();
    ctx.fillStyle = wallGrad;
    ctx.fill();

    // Snow on top of walls (high altitude)
    if (altitudeM > 200) {
      const snowAlpha = Math.min(1, (altitudeM - 200) / 400);
      ctx.fillStyle = `rgba(220,215,230,${snowAlpha * 0.6})`;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = worldToScreen(leftPts[i].x, leftPts[i].y, W, H, scrollY);
        if (i === 0) ctx.moveTo(s.sx, s.sy);
        else ctx.lineTo(s.sx, s.sy);
      }
      ctx.lineTo(0, worldToScreen(0, leftPts[n - 1].y, W, H, scrollY).sy);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = worldToScreen(rightPts[i].x, rightPts[i].y, W, H, scrollY);
        if (i === 0) ctx.moveTo(s.sx, s.sy);
        else ctx.lineTo(s.sx, s.sy);
      }
      ctx.lineTo(W, worldToScreen(0, rightPts[n - 1].y, W, H, scrollY).sy);
      ctx.closePath();
      ctx.fill();
    }

    // Wall edge glow
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(100,80,140,0.4)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const s = worldToScreen(leftPts[i].x, leftPts[i].y, W, H, scrollY);
      if (i === 0) ctx.moveTo(s.sx, s.sy);
      else ctx.lineTo(s.sx, s.sy);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const s = worldToScreen(rightPts[i].x, rightPts[i].y, W, H, scrollY);
      if (i === 0) ctx.moveTo(s.sx, s.sy);
      else ctx.lineTo(s.sx, s.sy);
    }
    ctx.stroke();
  }

  function drawChunkGrips(ctx, chunk, W, H, scrollY, time) {
    chunk.grips.forEach(grip => {
      if (grip.collected) return;
      const s = worldToScreen(grip.x, grip.y, W, H, scrollY);
      if (s.sy < -50 || s.sy > H + 50) return;

      const wobble = Math.sin(time * 0.002 + grip.y * 0.01) * 2;

      if (grip.type === 'ice') {
        // Ice grip - bluish crystal
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(100,200,255,0.5)';
        ctx.fillStyle = '#a0d8ef';
        drawBlockyDiamond(ctx, s.sx + wobble * 0.3, s.sy + wobble, grip.r);
        ctx.fillStyle = 'rgba(200,240,255,0.5)';
        drawBlockyDiamond(ctx, s.sx + wobble * 0.3 - 3, s.sy + wobble - 3, grip.r * 0.5);
      } else {
        // Rock grip
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(150,100,200,0.3)';
        ctx.fillStyle = '#6a5a80';
        drawBlockyHex(ctx, s.sx + wobble * 0.2, s.sy + wobble, grip.r);
        ctx.fillStyle = '#8a7aa0';
        drawBlockyHex(ctx, s.sx + wobble * 0.2 - 2, s.sy + wobble - 2, grip.r * 0.5);
      }
      ctx.shadowBlur = 0;
    });
  }

  function drawBlockyDiamond(ctx, x, y, r) {
    const s = r * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.7, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.7, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawBlockyHex(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(Math.round(px), Math.round(py));
      else ctx.lineTo(Math.round(px), Math.round(py));
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawChunkCollectibles(ctx, chunk, W, H, scrollY, time) {
    const ICONS = {
      crystal: { color: '#80c8ff', glow: 'rgba(80,150,255,0.7)', emoji: '💎' },
      fossil: { color: '#c8a870', glow: 'rgba(180,140,80,0.5)', emoji: '🦴' },
      herb: { color: '#60c060', glow: 'rgba(80,200,80,0.4)', emoji: '🌿' },
      gem: { color: '#ff80c0', glow: 'rgba(255,100,180,0.6)', emoji: '💠' },
      relic: { color: '#ffd060', glow: 'rgba(255,200,0,0.7)', emoji: '⚙️' },
    };

    chunk.collectibles.forEach(c => {
      if (c.collected) return;
      const s = worldToScreen(c.x, c.y, W, H, scrollY);
      if (s.sy < -30 || s.sy > H + 30) return;

      const bob = Math.sin(time * 0.002 + c.bob) * 3;
      const info = ICONS[c.type] || ICONS.crystal;

      ctx.shadowBlur = 12;
      ctx.shadowColor = info.glow;
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.emoji, s.sx, s.sy + bob);
      ctx.shadowBlur = 0;

      // Sparkle
      if (Math.sin(time * 0.005 + c.bob * 2) > 0.8) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        const sp = s.sx + 8;
        const sps = s.sy + bob - 8;
        ctx.fillRect(sp - 1, sps - 4, 2, 8);
        ctx.fillRect(sp - 4, sps - 1, 8, 2);
      }
    });
  }

  function drawChunkHazards(ctx, chunk, W, H, scrollY, time) {
    chunk.hazards.forEach(h => {
      if (!h.active) return;
      const s = worldToScreen(h.x, h.y, W, H, scrollY);
      if (s.sy < -30 || s.sy > H + 30) return;

      if (h.type === 'icicle') {
        ctx.fillStyle = '#a0d0f0';
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(100,180,255,0.6)';
        // Icicle shape
        ctx.beginPath();
        ctx.moveTo(s.sx - 6, s.sy - 8);
        ctx.lineTo(s.sx + 6, s.sy - 8);
        ctx.lineTo(s.sx + 3, s.sy + 12);
        ctx.lineTo(s.sx, s.sy + 16);
        ctx.lineTo(s.sx - 3, s.sy + 12);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // Rockfall indicator
        ctx.fillStyle = '#6a5060';
        if (Math.sin(time * 0.01 + h.x) > 0.7) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(200,100,50,0.8)';
        }
        ctx.beginPath();
        ctx.rect(s.sx - 8, s.sy - 8, 16, 16);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#9a8070';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.sx - 4, s.sy - 4);
        ctx.lineTo(s.sx + 2, s.sy);
        ctx.moveTo(s.sx - 2, s.sy + 2);
        ctx.lineTo(s.sx + 4, s.sy - 2);
        ctx.stroke();
      }
    });
  }

  function drawCampEntrance(ctx, chunk, W, H, scrollY, time) {
    // Find middle Y of chunk
    const campY = chunk.baseAlt + CHUNK_H * 0.5;
    const s = worldToScreen(W / 2, campY, W, H, scrollY);
    if (s.sy < -100 || s.sy > H + 100) return;

    const flicker = 0.8 + 0.2 * Math.sin(time * 0.008);

    // Warm glow
    ctx.shadowBlur = 40;
    ctx.shadowColor = `rgba(255,160,50,${0.5 * flicker})`;
    ctx.fillStyle = `rgba(255,140,30,${0.08 * flicker})`;
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Camp text
    ctx.font = 'bold 18px "Press Start 2P"';
    ctx.fillStyle = `rgba(255,200,100,${0.6 * flicker})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⛺ CAMP', s.sx, s.sy - 30);

    // Lantern icons
    ctx.font = '28px serif';
    ctx.fillText('🏕️', s.sx, s.sy + 10);

    // Arrow pointing up
    ctx.fillStyle = `rgba(255,200,80,${0.7 * flicker})`;
    ctx.font = '14px "Press Start 2P"';
    ctx.fillText('▲ ENTER', s.sx, s.sy + 50);
  }

  // ── Public API ─────────────────────────────────────────────────────
  function init() {
    initStars();
    initBgLayers();
    cameraY = 0;
    altitudeM = 0;
    chunks = [];
    snowParticles = [];
    campThresholds = [];
    nextCampAlt = 400;
    weather = 'clear';
    weatherTimer = 5000;
    ensureChunks(0, 1400);
  }

  function update(dt, playerY) {
    altitudeM = playerY / 5 | 0;
    cameraY = playerY;
    ensureChunks(playerY - 200, playerY + 1200);
    updateWeather(dt);
  }

  function draw(ctx, W, H, scrollY, time) {
    drawBackground(ctx, W, H, scrollY, time);
    drawTerrain(ctx, W, H, scrollY, time);
    drawFog(ctx, W, H, time);
    drawSnow(ctx, W, H);
  }

  function getChunks() { return chunks; }
  function getAltitude() { return altitudeM; }
  function getWeather() { return weather; }
  function getWindX() { return windX; }

  function getWallsAtY(worldY) {
    const ci = Math.floor(worldY / CHUNK_H);
    const chunk = chunks[ci];
    if (!chunk) return { left: 80, right: 300 };

    const t = (worldY - chunk.baseAlt) / CHUNK_H;
    const idx = Math.floor(t * (chunk.leftPts.length - 1));
    const safeIdx = Math.max(0, Math.min(idx, chunk.leftPts.length - 1));
    return { left: chunk.leftPts[safeIdx].x, right: chunk.rightPts[safeIdx].x };
  }

  function checkCampNear(worldY, threshold = 100) {
    const ci = Math.floor(worldY / CHUNK_H);
    const chunk = chunks[ci];
    if (!chunk || !chunk.hasCamp) return false;
    const campY = chunk.baseAlt + CHUNK_H * 0.5;
    return Math.abs(worldY - campY) < threshold;
  }

  function markChunkCollected(worldX, worldY, type) {
    const ci = Math.floor(worldY / CHUNK_H);
    const chunk = chunks[ci];
    if (!chunk) return null;
    let found = null;
    chunk.collectibles.forEach(c => {
      if (!c.collected && Math.abs(c.x - worldX) < 30 && Math.abs(c.y - worldY) < 30) {
        c.collected = true;
        found = c.type;
      }
    });
    return found;
  }

  return { init, update, draw, getChunks, getAltitude, getWeather, getWindX,
           getWallsAtY, checkCampNear, markChunkCollected, worldToScreen,
           CHUNK_H };
})();
