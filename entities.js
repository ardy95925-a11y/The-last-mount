// entities.js — Organic rendering: player, trees, rocks, NPC, items, camp

const Entities = {

  // ── PLAYER ──────────────────────────────────────────────────────────────
  drawPlayer(ctx, p, camX, camY, time) {
    const sx = p.x - camX, sy = p.y - camY;
    const f = p.facing;
    const leg = p.legPhase;
    const swing = p.state === 'swing';
    const fall = p.state === 'fall';
    const idle = p.state === 'idle';

    ctx.save();
    ctx.translate(sx, sy);

    // Body lean based on movement
    const lean = Math.atan2(p.vy * 0.3, 5) * 0.3 + (swing ? Math.atan2(p.vx, 8) * 0.35 : 0);
    ctx.rotate(lean);

    // Shadow
    ctx.save();
    ctx.resetTransform();
    const terrY = World.getTerrainYSmooth(p.x);
    const shY = terrY - camY;
    const shDist = Math.min(1, Math.abs(shY - sy) / 80);
    ctx.fillStyle = `rgba(0,0,0,${0.18 - shDist * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(sx, shY + 2, 14 - shDist * 8, 4 - shDist * 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Idle bob
    const bob = idle ? Math.sin(time * 0.04) * 1.2 : 0;
    ctx.translate(0, bob);

    // ── Back arm ──
    const backArmRot = swing ? -0.8 * f : (idle ? Math.sin(time * 0.04) * 0.15 : Math.sin(leg) * 0.5 * f);
    this._drawArm(ctx, -f * 8, -24, f, backArmRot, p.accessories, false);

    // ── Back leg ──
    const backLegRot = idle ? 0.08 : Math.sin(leg + Math.PI) * 0.42;
    this._drawLeg(ctx, f * 3, -4, -f, backLegRot, p.upgrades.gripBoots);

    // ── Torso ──
    // Cape first (behind body)
    if (p.accessories.cape || p.upgrades.windCape) {
      const capeWave = Math.sin(time * 0.08 - p.vx * 0.2) * 5 + p.vx * 2;
      ctx.save();
      ctx.translate(-f * 7, -24);
      ctx.beginPath();
      const g = ctx.createLinearGradient(0, 0, -f * 18, 28);
      g.addColorStop(0, '#6a2a8a');
      g.addColorStop(1, '#4a1a6aaa');
      ctx.fillStyle = g;
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-f * 6, 8, -f * 14 + capeWave * 0.5, 16, -f * 16 + capeWave, 28);
      ctx.bezierCurveTo(-f * 12 + capeWave * 0.8, 18, -f * 8, 10, -f * 2, 2);
      ctx.closePath();
      ctx.fill();
      // Cape edge highlight
      ctx.strokeStyle = '#9a4acaaa';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // Body — layered jacket
    ctx.beginPath();
    const bodyG = ctx.createLinearGradient(-10, -32, 10, 0);
    bodyG.addColorStop(0, '#4a5a7c');
    bodyG.addColorStop(1, '#2e3a50');
    ctx.fillStyle = bodyG;
    ctx.roundRect(-9, -30, 18, 26, [4, 4, 2, 2]);
    ctx.fill();
    // Jacket lapel shading
    ctx.fillStyle = '#5a6a8e';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(-4, -22);
    ctx.lineTo(0, -20);
    ctx.lineTo(4, -22);
    ctx.closePath();
    ctx.fill();
    // Belt
    const beltG = ctx.createLinearGradient(-9, -6, 9, -3);
    beltG.addColorStop(0, '#6a4818');
    beltG.addColorStop(0.5, '#8a6030');
    beltG.addColorStop(1, '#6a4818');
    ctx.fillStyle = beltG;
    ctx.fillRect(-9, -6, 18, 4);
    // Buckle
    ctx.fillStyle = '#c8a040';
    ctx.fillRect(-3, -7, 6, 5);
    ctx.strokeStyle = '#a07020';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-3, -7, 6, 5);

    // ── Front leg ──
    const frontLegRot = idle ? -0.05 : Math.sin(leg) * 0.42;
    this._drawLeg(ctx, -f * 3, -4, f, frontLegRot, p.upgrades.gripBoots);

    // ── Front arm ──
    const frontArmRot = swing ? 1.1 * f : (idle ? -Math.sin(time * 0.04) * 0.12 : -Math.sin(leg) * 0.5 * f);
    this._drawArm(ctx, f * 8, -24, f, frontArmRot, p.accessories, true);

    // ── Head ──
    ctx.translate(0, -2);
    const headBob = idle ? Math.sin(time * 0.04) * 0.5 : 0;
    ctx.translate(0, headBob);

    // Neck
    ctx.fillStyle = '#c4846a';
    ctx.fillRect(-3, -34, 6, 5);

    // Head shape
    const headG = ctx.createRadialGradient(f * 2, -40, 0, 0, -40, 12);
    headG.addColorStop(0, '#d49070');
    headG.addColorStop(1, '#b06848');
    ctx.fillStyle = headG;
    ctx.beginPath();
    ctx.roundRect(-8, -48, 16, 17, 5);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#2a1808';
    ctx.beginPath();
    ctx.roundRect(-9, -49, 18, 8, [5, 5, 0, 0]);
    ctx.fill();
    ctx.fillRect(-9, -49, 5, 14); // side hair

    // Eye
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.ellipse(f * 3, -40, 2.5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(f * 2.2, -41, 1, 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brow expression
    ctx.strokeStyle = '#2a1808';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (fall) {
      ctx.moveTo(f * 1, -44); ctx.lineTo(f * 5, -43);
    } else if (swing) {
      ctx.moveTo(f * 0, -44); ctx.lineTo(f * 5, -45);
    } else {
      ctx.moveTo(f * 1, -44); ctx.lineTo(f * 5, -44);
    }
    ctx.stroke();

    // Hat
    if (p.accessories.hat === 'explorer') {
      ctx.fillStyle = '#7a5030';
      ctx.beginPath();
      ctx.roundRect(-9, -54, 18, 7, 2);
      ctx.fill();
      ctx.fillStyle = '#9a6840';
      ctx.beginPath();
      ctx.ellipse(0, -48, 14, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Band
      ctx.strokeStyle = '#4a2010';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-9, -49); ctx.lineTo(9, -49);
      ctx.stroke();
    } else if (p.accessories.hat === 'winter') {
      ctx.fillStyle = '#d8dce8';
      ctx.beginPath();
      ctx.roundRect(-8, -58, 16, 12, [5, 5, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#c04040';
      ctx.fillRect(-9, -49, 18, 4);
      // Pom pom
      ctx.fillStyle = '#e8e8f0';
      ctx.beginPath();
      ctx.arc(0, -58, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  _drawLeg(ctx, ox, oy, f, rot, gripBoots) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(rot);
    // Upper leg
    const lg = ctx.createLinearGradient(-4, 0, 4, 20);
    lg.addColorStop(0, '#2a2a40');
    lg.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.roundRect(-4, 0, 8, 16, 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(ox, oy + 14);
    ctx.rotate(rot * 0.6);
    // Lower leg
    ctx.fillStyle = '#222236';
    ctx.beginPath();
    ctx.roundRect(-3.5, 0, 7, 14, 2);
    ctx.fill();
    // Boot
    const bootG = ctx.createLinearGradient(-5, 12, 8, 20);
    bootG.addColorStop(0, gripBoots ? '#b06018' : '#1a1a28');
    bootG.addColorStop(1, gripBoots ? '#7a3808' : '#101018');
    ctx.fillStyle = bootG;
    ctx.beginPath();
    ctx.moveTo(-5, 12);
    ctx.lineTo(f * 8, 12);
    ctx.lineTo(f * 8, 20);
    ctx.lineTo(-5, 20);
    ctx.closePath();
    ctx.fill();
    if (gripBoots) {
      // grip studs
      ctx.fillStyle = '#d08030';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(f * (2 + i * 2), 20, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  _drawArm(ctx, ox, oy, f, rot, accessories, isFront) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(rot);
    // Upper arm
    ctx.fillStyle = isFront ? '#4a5a7c' : '#3a4a6c';
    ctx.beginPath();
    ctx.roundRect(-3, 0, 7, 14, 2);
    ctx.fill();
    ctx.save();
    ctx.translate(0, 12);
    ctx.rotate(rot * 0.4);
    // Forearm
    ctx.fillStyle = isFront ? '#3a4a6c' : '#2e3a5c';
    ctx.beginPath();
    ctx.roundRect(-3, 0, 6, 13, 2);
    ctx.fill();
    // Hand
    ctx.fillStyle = '#c4846a';
    ctx.beginPath();
    ctx.arc(0, 14, 4, 0, Math.PI * 2);
    ctx.fill();
    if (isFront && accessories && accessories.glove) {
      ctx.fillStyle = '#ff7030';
      ctx.beginPath();
      ctx.arc(0, 14, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  },

  // ── ROPE ────────────────────────────────────────────────────────────────
  drawRope(ctx, rope, camX, camY) {
    if (!rope.active) return;
    const hook = rope.hook;
    const pts = rope.pts;

    if (rope.thrown && !hook.stuck) {
      // Flying line
      const hx = hook.x - camX, hy = hook.y - camY;
      const px = pts[0].x - camX, py = pts[0].y - camY;
      ctx.save();
      ctx.strokeStyle = 'rgba(200,160,70,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.setLineDash([]);
      // Hook indicator
      ctx.fillStyle = '#e0c060';
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (!hook.stuck || pts.length < 2) return;

    // Draw rope using catmull-rom through verlet points
    ctx.save();

    // Shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x - camX + 1, pts[0].y - camY + 2);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x - camX + 1, pts[i].y - camY + 2);
    }
    ctx.stroke();

    // Main rope - gradient from player to hook
    const grd = ctx.createLinearGradient(
      pts[0].x - camX, pts[0].y - camY,
      hook.x - camX, hook.y - camY
    );
    grd.addColorStop(0, '#c8a050');
    grd.addColorStop(0.5, '#d8b060');
    grd.addColorStop(1, '#a06820');
    ctx.strokeStyle = grd;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x - camX, pts[0].y - camY);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2;
      const my = (pts[i].y + pts[i+1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x - camX, pts[i].y - camY, mx - camX, my - camY);
    }
    ctx.lineTo(pts[pts.length-1].x - camX, pts[pts.length-1].y - camY);
    ctx.stroke();

    // Highlight strand
    ctx.strokeStyle = 'rgba(255,230,140,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x - camX - 0.5, pts[0].y - camY - 0.5);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x - camX - 0.5, pts[i].y - camY - 0.5);
    }
    ctx.stroke();

    // Hook
    const hx = hook.x - camX, hy = hook.y - camY;
    // Glow
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16);
    hg.addColorStop(0, 'rgba(255,210,80,0.5)');
    hg.addColorStop(1, 'rgba(255,150,20,0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(hx, hy, 16, 0, Math.PI * 2);
    ctx.fill();
    // Hook shape
    ctx.fillStyle = '#d4a030';
    ctx.strokeStyle = '#805010';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hx, hy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Spike
    const n = hook.stuckNormal || { x: 0, y: -1 };
    ctx.strokeStyle = '#c09020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + n.x * 8, hy + n.y * 8);
    ctx.stroke();

    ctx.restore();
  },

  // ── TREE ────────────────────────────────────────────────────────────────
  drawTree(ctx, tree, camX, camY, windOff) {
    const sx = tree.x - camX;
    const sy = tree.y - camY;
    if (sx < -200 || sx > ctx.canvas.width + 200) return;

    ctx.save();
    ctx.translate(sx, sy);

    const h = tree.h || (tree.size * 60);
    const spread = tree.spread || (tree.size * 26);
    const lean = tree.lean || 0;
    const wind = windOff * (1 + tree.size * 0.3);

    if (tree.type === 'pine') {
      this._drawPine(ctx, h, spread, lean, wind, tree);
    } else if (tree.type === 'oak') {
      this._drawOak(ctx, h, spread, lean, wind, tree);
    } else {
      this._drawShrub(ctx, tree.size * 12, wind, tree);
    }

    ctx.restore();
  },

  _drawPine(ctx, h, spread, lean, wind, tree) {
    const layers = 5 + Math.floor(tree.size * 2);
    const trunkH = h * 0.22;

    // Trunk
    ctx.save();
    ctx.rotate(lean);
    const tg = ctx.createLinearGradient(-4, -trunkH, 4, 0);
    tg.addColorStop(0, '#4a3020');
    tg.addColorStop(1, '#2e1c10');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-3.5, 0);
    ctx.lineTo(3.5, 0);
    ctx.lineTo(2, -trunkH);
    ctx.lineTo(-2, -trunkH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Layered triangular foliage
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const layerY = -trunkH - (h - trunkH) * t;
      const layerW = spread * (1 - t * 0.5) * (0.6 + (1 - t) * 0.5);
      const layerWind = wind * (0.2 + t * 0.8) + Math.sin(Date.now() * 0.001 + tree.branchSeed * 10 + i) * wind * 0.3;
      const dropY = h * 0.04 * (1 - t);

      // Dark base
      const lc = tree.leafColor;
      const r = Math.floor(20 + lc * 15);
      const g = Math.floor(55 + lc * 20 + t * 20);
      const b = Math.floor(15 + lc * 10);

      ctx.save();
      ctx.rotate(lean * (1 - t * 0.3));
      ctx.translate(layerWind, 0);

      // Shadow triangle
      ctx.fillStyle = `rgba(0,0,0,0.15)`;
      ctx.beginPath();
      ctx.moveTo(0, layerY + dropY + 2);
      ctx.lineTo(-layerW * 0.95, layerY + dropY + h * 0.12 + 2);
      ctx.lineTo(layerW * 0.95, layerY + dropY + h * 0.12 + 2);
      ctx.closePath();
      ctx.fill();

      // Main layer gradient
      const lg = ctx.createLinearGradient(-layerW, layerY, layerW, layerY + h * 0.12);
      lg.addColorStop(0, `rgb(${r-10},${g+5},${b})`);
      lg.addColorStop(0.5, `rgb(${r+10},${g+15},${b+5})`);
      lg.addColorStop(1, `rgb(${r-5},${g},${b})`);
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, layerY);
      ctx.lineTo(-layerW, layerY + h * 0.12 + dropY);
      ctx.lineTo(-layerW * 0.25, layerY + h * 0.07 + dropY);
      ctx.lineTo(-layerW * 0.45, layerY + h * 0.15 + dropY);
      ctx.lineTo(0, layerY + h * 0.1 + dropY);
      ctx.lineTo(layerW * 0.45, layerY + h * 0.15 + dropY);
      ctx.lineTo(layerW * 0.25, layerY + h * 0.07 + dropY);
      ctx.lineTo(layerW, layerY + h * 0.12 + dropY);
      ctx.closePath();
      ctx.fill();

      // Top light highlight
      ctx.fillStyle = `rgba(${r+40},${g+50},${b+20},0.25)`;
      ctx.beginPath();
      ctx.moveTo(-layerW * 0.15, layerY);
      ctx.lineTo(-layerW * 0.55, layerY + h * 0.06 + dropY);
      ctx.lineTo(layerW * 0.55, layerY + h * 0.06 + dropY);
      ctx.lineTo(layerW * 0.15, layerY);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  },

  _drawOak(ctx, h, spread, lean, wind, tree) {
    const trunkH = h * 0.5;
    // Trunk - tapered
    ctx.save();
    ctx.rotate(lean * 0.5);
    const tg = ctx.createLinearGradient(-5, -trunkH, 5, 0);
    tg.addColorStop(0, '#5a3a20');
    tg.addColorStop(1, '#3a2010');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
    ctx.lineTo(3, -trunkH); ctx.lineTo(-3, -trunkH);
    ctx.closePath();
    ctx.fill();
    // Bark texture lines
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-5 + i * 3, 0);
      ctx.bezierCurveTo(-4 + i * 2.5, -trunkH * 0.3, -3 + i * 2.8, -trunkH * 0.6, -3 + i * 2, -trunkH);
      ctx.stroke();
    }
    ctx.restore();

    // Branches
    const branches = 3 + Math.floor(tree.branchSeed * 3);
    for (let b = 0; b < branches; b++) {
      const t = 0.4 + b / branches * 0.5;
      const by = -trunkH * t;
      const bx = (b % 2 === 0 ? 1 : -1) * (spread * 0.3 + b * 5);
      const blen = spread * 0.4 + tree.branchSeed * 20;
      ctx.save();
      ctx.translate(wind * t * 0.6, 0);
      ctx.strokeStyle = '#4a2e14';
      ctx.lineWidth = 3 - b * 0.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, by);
      ctx.quadraticCurveTo(bx * 0.5, by - blen * 0.3, bx, by - blen * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // Canopy — layered circles with natural shapes
    const lc = tree.leafColor;
    const r = Math.floor(25 + lc * 15);
    const g = Math.floor(70 + lc * 25);
    const b2 = Math.floor(15 + lc * 8);
    const cloudCount = 5 + Math.floor(tree.branchSeed * 5);

    ctx.save();
    ctx.translate(wind * 0.7, 0);
    for (let c = 0; c < cloudCount; c++) {
      const angle = (c / cloudCount) * Math.PI * 2;
      const r2 = spread * (0.5 + tree.rng * 0.4);
      const cx2 = Math.cos(angle) * r2 * 0.55;
      const cy2 = -trunkH + Math.sin(angle) * r2 * 0.4 - spread * 0.3;
      const cr = spread * 0.35 + tree.branchSeed * 8;

      const cg = ctx.createRadialGradient(cx2 - 5, cy2 - 5, 0, cx2, cy2, cr);
      cg.addColorStop(0, `rgb(${r+25},${g+35},${b2+10})`);
      cg.addColorStop(0.6, `rgb(${r+8},${g+12},${b2})`);
      cg.addColorStop(1, `rgb(${r-8},${g-5},${b2-3})`);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx2, cy2, cr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rim lighting
    ctx.fillStyle = `rgba(${r+60},${g+70},${b2+30},0.12)`;
    ctx.beginPath();
    ctx.arc(0, -trunkH - spread * 0.2, spread * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _drawShrub(ctx, r, wind, tree) {
    const lc = tree.leafColor;
    ctx.save();
    ctx.translate(wind * 0.4, 0);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 - Math.PI * 0.5;
      const ex = Math.cos(angle) * r * 0.5;
      const ey = Math.sin(angle) * r * 0.4 - r * 0.5;
      const clr = Math.floor(40 + lc * 30);
      ctx.fillStyle = `rgb(${30+clr},${70+clr},${20+clr})`;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  // ── ROCK ────────────────────────────────────────────────────────────────
  drawRock(ctx, rock, camX, camY) {
    const sx = rock.x - camX, sy = rock.y - camY;
    if (sx < -100 || sx > ctx.canvas.width + 100) return;
    ctx.save();
    ctx.translate(sx, sy);

    const w = rock.w, h = rock.h;
    const fc = rock.facets || 5;
    const s = rock.seed || 0.5;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(2, 4, w * 0.55, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Generate faceted rock shape
    const pts = [];
    for (let i = 0; i < fc + 2; i++) {
      const angle = (i / (fc + 2)) * Math.PI;
      const rx = Math.cos(angle) * w * 0.5 * (0.7 + Math.sin(i * 2.3 + s * 10) * 0.3);
      const ry = Math.sin(angle) * h * (0.5 + Math.cos(i * 1.7 + s * 7) * 0.25);
      pts.push({ x: rx, y: -ry });
    }
    pts.push({ x: w * 0.45, y: 0 });
    pts.push({ x: 0, y: 0 });
    pts.push({ x: -w * 0.45, y: 0 });

    // Base rock
    const rg = ctx.createLinearGradient(-w*0.5, -h, w*0.5, 0);
    rg.addColorStop(0, '#8a8898');
    rg.addColorStop(0.4, '#6a6878');
    rg.addColorStop(1, '#4a4858');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();

    // Facet highlight (top-left)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < Math.min(3, pts.length); i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();

    // Edge shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();

    // Snow cap
    if (rock.snow) {
      ctx.fillStyle = 'rgba(220,235,248,0.85)';
      ctx.beginPath();
      const topPts = pts.slice(0, Math.ceil(pts.length * 0.4));
      ctx.moveTo(topPts[0].x, topPts[0].y);
      for (const p of topPts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(-w * 0.3, -h * 0.3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  },

  // ── LOOT ITEM ────────────────────────────────────────────────────────────
  drawItem(ctx, item, camX, camY, time) {
    const sx = item.wx - camX, sy = item.wy - camY - Math.sin(time * 0.04 + item.id) * 5;
    if (sx < -40 || sx > ctx.canvas.width + 40) return;

    ctx.save();
    ctx.translate(sx, sy);

    // Outer glow
    const outerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
    outerGlow.addColorStop(0, item.glow + 'aa');
    outerGlow.addColorStop(0.5, item.glow + '44');
    outerGlow.addColorStop(1, item.glow + '00');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();

    // Rotate crystal
    ctx.rotate(time * 0.02 + item.id);

    // Crystal facets
    const c = item.color;
    ctx.fillStyle = c;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6, -3);
    ctx.lineTo(4, 7);
    ctx.lineTo(-4, 7);
    ctx.lineTo(-6, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner bright face
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6, -3);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // Sparkles
    ctx.rotate(-time * 0.02 - item.id);
    for (let i = 0; i < 4; i++) {
      const a = (time * 0.06 + i * Math.PI * 0.5 + item.id);
      const r = 14 + Math.sin(time * 0.1 + i * 1.3) * 3;
      ctx.fillStyle = item.glow + 'bb';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  // ── NPC ──────────────────────────────────────────────────────────────────
  drawNPC(ctx, x, y, time, camX, camY) {
    const sx = x - camX, sy = y - camY;
    ctx.save();
    ctx.translate(sx, sy);
    const bob = Math.sin(time * 0.03) * 1.5;
    ctx.translate(0, bob);

    // Body
    const bg = ctx.createLinearGradient(-9, -28, 9, 0);
    bg.addColorStop(0, '#5a3060');
    bg.addColorStop(1, '#3a1a40');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(-9, -28, 18, 28, [3, 3, 2, 2]);
    ctx.fill();
    // Apron
    ctx.fillStyle = '#e0c890';
    ctx.beginPath();
    ctx.roundRect(-6, -18, 12, 18, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // Arms
    ctx.fillStyle = '#5a3060';
    ctx.fillRect(-14, -26, 6, 18);
    ctx.fillRect(8, -26, 6, 18);
    ctx.fillStyle = '#c4846a';
    ctx.beginPath();
    ctx.arc(-11, -9, 4, 0, Math.PI * 2);
    ctx.arc(11, -9, 4, 0, Math.PI * 2);
    ctx.fill();
    // Head
    const hg = ctx.createRadialGradient(1, -38, 0, 0, -38, 11);
    hg.addColorStop(0, '#d49070');
    hg.addColorStop(1, '#b06848');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.roundRect(-8, -48, 16, 19, 5);
    ctx.fill();
    // Hair
    ctx.fillStyle = '#3a2010';
    ctx.beginPath();
    ctx.roundRect(-9, -50, 18, 8, [4, 4, 0, 0]);
    ctx.fill();
    ctx.fillRect(-10, -50, 5, 15);
    // Eyes
    ctx.fillStyle = '#2a1020';
    ctx.beginPath();
    ctx.ellipse(-3, -40, 2, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(3, -40, 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(-2.5, -41, 0.8, 0, Math.PI * 2);
    ctx.arc(3.5, -41, 0.8, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.strokeStyle = '#2a1020';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -37, 4, 0.15, Math.PI - 0.15);
    ctx.stroke();
    // Headscarf
    ctx.fillStyle = '#b83030';
    ctx.beginPath();
    ctx.roundRect(-10, -51, 20, 6, [4, 4, 0, 0]);
    ctx.fill();

    ctx.restore();
  },

  // ── CAMP STRUCTURE ───────────────────────────────────────────────────────
  drawCamp(ctx, campX, camX, camY, time) {
    const cx = campX - camX;
    const groundY = World.getTerrainYSmooth(campX) - camY;

    ctx.save();
    ctx.translate(cx, groundY);

    const W = 160, H = 110;

    // Ground platform (leveled)
    ctx.fillStyle = '#2a2218';
    ctx.beginPath();
    ctx.roundRect(-W/2 - 20, -2, W + 40, 18, 2);
    ctx.fill();

    // Back wall (stone foundation)
    ctx.fillStyle = '#3a3030';
    ctx.fillRect(-W/2, -H - 15, W, 18);

    // Main walls
    const wallG = ctx.createLinearGradient(-W/2, -H, W/2, 0);
    wallG.addColorStop(0, '#4a3820');
    wallG.addColorStop(1, '#2e2010');
    ctx.fillStyle = wallG;
    ctx.fillRect(-W/2, -H, W, H);

    // Horizontal plank lines
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.2;
    for (let y = 0; y > -H; y -= 14) {
      ctx.beginPath();
      ctx.moveTo(-W/2, y); ctx.lineTo(W/2, y);
      ctx.stroke();
    }
    // Knots
    for (let i = 0; i < 6; i++) {
      const kx = -W/2 + 15 + i * 26;
      const ky = -H * 0.3 - (i % 3) * 20;
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 5, 3, 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Roof
    ctx.fillStyle = '#1e1408';
    ctx.beginPath();
    ctx.moveTo(-W/2 - 20, -H);
    ctx.lineTo(0, -H - 50);
    ctx.lineTo(W/2 + 20, -H);
    ctx.closePath();
    ctx.fill();
    // Roof planks
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const rx = -W/2 - 18 + i * (W + 38) / 6;
      ctx.beginPath();
      ctx.moveTo(rx, -H);
      ctx.lineTo(rx / 2 + (i < 3 ? -2 : 2), -H - 48);
      ctx.stroke();
    }
    // Snow on roof
    ctx.fillStyle = 'rgba(220,235,248,0.88)';
    ctx.beginPath();
    ctx.moveTo(-W/2 - 20, -H + 2);
    ctx.lineTo(0, -H - 50);
    ctx.lineTo(12, -H - 48);
    ctx.lineTo(-W/2 - 5, -H + 5);
    ctx.closePath();
    ctx.fill();

    // Chimney
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(W/2 - 25, -H - 65, 22, 68);
    ctx.fillStyle = '#2a1808';
    ctx.fillRect(W/2 - 27, -H - 70, 26, 8);
    // Smoke particles drawn in game.js

    // Door
    ctx.fillStyle = '#1a1008';
    ctx.beginPath();
    ctx.roundRect(-18, -H + H * 0.35, 36, H * 0.65, [8, 8, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#2e200c';
    ctx.beginPath();
    ctx.roundRect(-15, -H + H * 0.37, 14, H * 0.63, [5, 5, 0, 0]);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(1, -H + H * 0.37, 14, H * 0.63, [5, 5, 0, 0]);
    ctx.fill();
    // Door handle
    ctx.fillStyle = '#c89030';
    ctx.beginPath();
    ctx.arc(-4, -H * 0.25, 4, 0, Math.PI * 2);
    ctx.fill();
    // Door frame
    ctx.strokeStyle = '#5a3818';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-18, -H + H * 0.35, 36, H * 0.65, [8, 8, 0, 0]);
    ctx.stroke();

    // Left window
    const wg = ctx.createRadialGradient(-W/2 + 35, -H * 0.6, 0, -W/2 + 35, -H * 0.6, 30);
    wg.addColorStop(0, 'rgba(255,180,60,0.7)');
    wg.addColorStop(1, 'rgba(255,100,20,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(-W/2 + 5, -H * 0.9, 60, 50);
    ctx.fillStyle = '#0e1830';
    ctx.fillRect(-W/2 + 15, -H * 0.78, 30, 22);
    ctx.strokeStyle = '#4a2e10';
    ctx.lineWidth = 2;
    ctx.strokeRect(-W/2 + 15, -H * 0.78, 30, 22);
    ctx.beginPath();
    ctx.moveTo(-W/2 + 30, -H * 0.78); ctx.lineTo(-W/2 + 30, -H * 0.78 + 22);
    ctx.moveTo(-W/2 + 15, -H * 0.78 + 11); ctx.lineTo(-W/2 + 45, -H * 0.78 + 11);
    ctx.stroke();

    // Lantern hanging from eave
    const lswing = Math.sin(time * 0.02) * 5;
    ctx.strokeStyle = '#5a3010';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-W/2 + 10, -H - 2);
    ctx.lineTo(-W/2 + 10 + lswing, -H + 18);
    ctx.stroke();
    // Lantern body
    const lampG = ctx.createRadialGradient(-W/2 + 10 + lswing, -H + 28, 0, -W/2 + 10 + lswing, -H + 28, 30);
    lampG.addColorStop(0, 'rgba(255,200,80,0.7)');
    lampG.addColorStop(0.4, 'rgba(255,140,30,0.4)');
    lampG.addColorStop(1, 'rgba(255,80,10,0)');
    ctx.fillStyle = lampG;
    ctx.beginPath();
    ctx.arc(-W/2 + 10 + lswing, -H + 28, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c89030';
    ctx.fillRect(-W/2 + 4 + lswing, -H + 18, 12, 20);
    ctx.strokeStyle = '#a07020';
    ctx.lineWidth = 1;
    ctx.strokeRect(-W/2 + 4 + lswing, -H + 18, 12, 20);

    // Sign
    ctx.fillStyle = '#6a4820';
    ctx.fillRect(-28, -H - 22, 56, 16);
    ctx.strokeStyle = '#4a2e10';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-28, -H - 22, 56, 16);
    ctx.fillStyle = '#e8d090';
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MIRNA\'S POST', 0, -H - 10);
    ctx.textAlign = 'left';

    ctx.restore();
  },

  SHOP_ITEMS: [
    { id: 'ropeLen',     name: 'Long Line',        desc: 'Rope reaches 30% further each level', cost: 100, maxLevel: 3, type: 'upgrade' },
    { id: 'throwPower',  name: 'Arm Strength',      desc: 'Throw rope with more force',          cost: 80,  maxLevel: 3, type: 'upgrade' },
    { id: 'gripBoots',   name: 'Grip Boots',        desc: 'Cling to steep terrain briefly',       cost: 220, maxLevel: 1, type: 'upgrade' },
    { id: 'windCape',    name: 'Windcatcher Cape',  desc: 'Glide and slow fall speed',            cost: 280, maxLevel: 1, type: 'upgrade' },
    { id: 'grappleGlove',name: 'Grapple Glove',    desc: 'Swing with more force',                cost: 200, maxLevel: 1, type: 'upgrade' },
    { id: 'doubleThrow', name: 'Twin Hook',         desc: 'Use a second rope simultaneously',     cost: 400, maxLevel: 1, type: 'upgrade' },
    { id: 'hat_explorer',name: 'Explorer Hat',      desc: 'A rugged wide-brimmed hat',            cost: 75,  maxLevel: 1, type: 'accessory', slot: 'hat', val: 'explorer' },
    { id: 'hat_winter',  name: 'Knit Cap',          desc: 'Warm knit cap for the high peaks',     cost: 60,  maxLevel: 1, type: 'accessory', slot: 'hat', val: 'winter' },
  ],

  NPC_DIALOG: [
    ["Ah, another climber. You've got that look.", "Sit, rest. The summit isn't going anywhere."],
    ["The mountain has moods. Some days it gives,", "some days it just... takes."],
    ["Found anything interesting up there?", "Crystals fetch a good price if you ask me."],
    ["I tried to climb once. Got halfway up.", "Decided making tea was more my thing."],
    ["Storm's forming above the snowline.", "Your rope will drift in the wind - compensate."],
    ["Strange lights in the glacial caves at night.", "I don't ask what they are anymore."],
    ["The old climbers say the peak speaks to you.", "I think altitude just makes people hear things."],
    ["Map fragment, eh? Someone didn't make it back.", "No shame in that. The mountain is patient."],
  ],
};

window.Entities = Entities;
