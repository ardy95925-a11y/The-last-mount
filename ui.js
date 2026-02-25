// ui.js — Gesture-only controls, HUD, shop, dialogue, particles

const UI = {
  state: 'game', // game, camp, dialogue, shop
  shopTab: 'sell',
  dialogIdx: 0,

  // Gesture state
  leftTouch: null,   // { id, startX, startY, curX, curY }
  rightTouch: null,  // { id, startX, startY, curX, curY, aim: true/false }
  aimActive: false,
  aimAngle: 0,
  aimPower: 0,

  // Derived input for physics
  input: { moveX: 0, jump: false },

  // Notifications
  notifications: [],
  particles: [],
  leaves: [],
  snowflakes: [],
  smokeParticles: [],

  // HUD colors
  C: {
    bg:     '#0a0c14',
    panel:  '#141820',
    panelL: '#1c2230',
    border: '#283048',
    gold:   '#e8b840',
    blue:   '#4aacf0',
    green:  '#48cc68',
    red:    '#e84848',
    text:   '#dcd4c0',
    sub:    '#8880a0',
    accent: '#c07828',
  },

  init() {
    this.particles = [];
    this.leaves = [];
    this.snowflakes = [];
    this.smokeParticles = [];
    this.notifications = [];
    this._spawnLeaves();
  },

  _spawnLeaves() {
    for (let i = 0; i < 18; i++) {
      this.leaves.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: -0.5 - Math.random() * 1,
        vy: 0.2 + Math.random() * 0.5,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.08,
        size: 3 + Math.random() * 4,
        color: `hsl(${100 + Math.random() * 40},${40 + Math.random() * 30}%,${30 + Math.random() * 20}%)`,
        life: Math.random(),
      });
    }
  },

  // Touch handlers — called from game.js
  onTouchStart(id, x, y, W, H) {
    if (this.state !== 'game') return;
    const isLeft = x < W * 0.5;
    if (isLeft && !this.leftTouch) {
      this.leftTouch = { id, startX: x, startY: y, curX: x, curY: y };
    } else if (!isLeft && !this.rightTouch) {
      this.rightTouch = { id, startX: x, startY: y, curX: x, curY: y };
      this.aimActive = false;
    }
  },

  onTouchMove(id, x, y) {
    if (this.leftTouch && this.leftTouch.id === id) {
      this.leftTouch.curX = x;
      this.leftTouch.curY = y;
      const dx = x - this.leftTouch.startX;
      const dy = y - this.leftTouch.startY;
      this.input.moveX = Math.max(-1, Math.min(1, dx / 45));
      this.input.jump = dy < -40;
    }
    if (this.rightTouch && this.rightTouch.id === id) {
      this.rightTouch.curX = x;
      this.rightTouch.curY = y;
      const dx = x - this.rightTouch.startX;
      const dy = y - this.rightTouch.startY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 12) {
        this.aimActive = true;
        this.aimAngle = Math.atan2(dy, dx);
        this.aimPower = Math.min(1, dist / 130);
      }
    }
  },

  onTouchEnd(id, x, y, game) {
    if (this.leftTouch && this.leftTouch.id === id) {
      this.leftTouch = null;
      this.input.moveX = 0;
      this.input.jump = false;
    }
    if (this.rightTouch && this.rightTouch.id === id) {
      // Release = throw if aiming, else retract
      if (this.aimActive && this.aimPower > 0.08) {
        game.onThrow(this.aimAngle, this.aimPower);
      } else {
        // Short tap = retract
        const dx = x - this.rightTouch.startX, dy = y - this.rightTouch.startY;
        if (Math.sqrt(dx*dx+dy*dy) < 15) {
          game.onRetract();
        }
      }
      this.rightTouch = null;
      this.aimActive = false;
    }
  },

  // Camp UI taps
  onCampTap(x, y, W, H, player, game) {
    if (this.state === 'dialogue') {
      this.dialogIdx = (this.dialogIdx + 1) % Entities.NPC_DIALOG.length;
      if (this.dialogIdx === 0) this.state = 'camp';
      return;
    }
    if (this.state === 'camp' && this._campBtns) {
      for (const btn of this._campBtns) {
        if (x > btn.x && x < btn.x + btn.w && y > btn.y && y < btn.y + btn.h) {
          if (btn.action === 'dialogue') this.state = 'dialogue';
          else if (btn.action === 'shop') { this.state = 'shop'; this.shopTab = 'sell'; }
          else if (btn.action === 'leave') game.leaveCamp();
          return;
        }
      }
    }
    if (this.state === 'shop') {
      // Tab
      if (this._tabBtns) {
        for (const t of this._tabBtns) {
          if (x > t.x && x < t.x+t.w && y > t.y && y < t.y+t.h) {
            this.shopTab = t.tab; return;
          }
        }
      }
      if (this.shopTab === 'sell' && this._sellBtns) {
        for (const b of this._sellBtns) {
          if (x > b.x && x < b.x+b.w && y > b.y && y < b.y+b.h) {
            const item = player.inventory[b.idx];
            if (item) {
              player.gold += item.value;
              player.inventory.splice(b.idx, 1);
              this.notify(`Sold ${item.name}  +${item.value}g`, '#e8b840');
            }
            return;
          }
        }
      }
      if (this.shopTab === 'buy' && this._buyBtns) {
        for (const b of this._buyBtns) {
          if (x > b.x && x < b.x+b.w && y > b.y && y < b.y+b.h) {
            const si = Entities.SHOP_ITEMS[b.idx];
            if (player.gold >= si.cost) {
              player.gold -= si.cost;
              if (si.type === 'upgrade') {
                player.upgrades[si.id] = (player.upgrades[si.id] || 0) + 1;
              } else if (si.type === 'accessory') {
                player.accessories[si.slot] = si.val;
              }
              this.notify(`Bought: ${si.name}`, '#48cc68');
            } else {
              this.notify('Not enough gold', '#e84848');
            }
            return;
          }
        }
      }
      // Tap outside back
      if (this._shopBounds) {
        const sb = this._shopBounds;
        if (x < sb.x || x > sb.x + sb.w || y < sb.y || y > sb.y + sb.h) {
          this.state = 'camp';
        }
      }
    }
  },

  notify(msg, color) {
    this.notifications.push({ msg, color: color || '#e8b840', life: 150, maxLife: 150 });
    if (this.notifications.length > 4) this.notifications.shift();
  },

  spawnCollect(sx, sy, color) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const spd = 1.5 + Math.random() * 3;
      this.particles.push({
        x: sx, y: sy,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 2,
        color, life: 40 + Math.random() * 25, size: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
      });
    }
  },

  spawnLandDust(sx, sy) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: sx + (Math.random() - 0.5) * 20,
        y: sy,
        vx: (Math.random() - 0.5) * 2,
        vy: -0.5 - Math.random() * 1.5,
        color: 'rgba(180,160,120,', life: 30, size: 5 + Math.random() * 8, rot: 0, dust: true,
      });
    }
  },

  spawnSmoke(sx, sy) {
    this.smokeParticles.push({ x: sx, y: sy, vx: (Math.random()-0.5)*0.4, vy: -0.6-Math.random()*0.5,
      size: 5 + Math.random() * 6, life: 80 + Math.random() * 40, maxLife: 120 });
  },

  update(W, H, biome) {
    // Leaves
    for (const l of this.leaves) {
      l.x += l.vx + Physics.windCurrent * 0.8;
      l.y += l.vy;
      l.rot += l.rotV + Physics.windCurrent * 0.02;
      if (l.x < -20) l.x = W + 10;
      if (l.y > H + 20) { l.y = -10; l.x = Math.random() * W; }
    }

    // Snow in cold biomes
    if (biome === 'snowfield' || biome === 'glacial') {
      if (Math.random() < 0.3) {
        this.snowflakes.push({ x: Math.random() * W, y: -5, vx: (Math.random()-0.5)*0.8, vy: 0.8+Math.random()*1.2, size: 1+Math.random()*3, life: 200 });
      }
    }
    this.snowflakes = this.snowflakes.filter(s => { s.x += s.vx + Physics.windCurrent*0.5; s.y += s.vy; s.life--; return s.life > 0 && s.y < H + 10; });

    // Particles
    this.particles = this.particles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.96; p.life--; return p.life > 0;
    });

    // Smoke
    this.smokeParticles = this.smokeParticles.filter(s => {
      s.x += s.vx + Physics.windCurrent * 0.3; s.y += s.vy; s.vx *= 0.99; s.size += 0.2; s.life--; return s.life > 0;
    });

    // Notifications
    this.notifications = this.notifications.filter(n => { n.life--; return n.life > 0; });
  },

  // ── DRAW HUD ──────────────────────────────────────────────────────────────
  drawHUD(ctx, W, H, player, world, time) {
    const C = this.C;

    // Left zone hint (gesture)
    if (this.leftTouch) {
      const lx = this.leftTouch.startX, ly = this.leftTouch.startY;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(lx, ly, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.leftTouch.curX, this.leftTouch.curY, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Right zone aim indicator
    if (this.aimActive && this.rightTouch) {
      const rx = this.rightTouch.startX, ry = this.rightTouch.startY;
      const len = 60 + this.aimPower * 60;
      ctx.save();
      // Origin ring
      ctx.strokeStyle = `rgba(255,200,80,${0.3 + this.aimPower * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rx, ry, 26, 0, Math.PI * 2);
      ctx.stroke();

      // Dashed trajectory line
      ctx.strokeStyle = `rgba(255,200,80,${0.5 + this.aimPower * 0.5})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      // Arc the line (simulating gravity)
      const steps = 10;
      let px = rx, py = ry;
      const vx = Math.cos(this.aimAngle) * (16 + this.aimPower * 12) * 3;
      const vy = Math.sin(this.aimAngle) * (16 + this.aimPower * 12) * 3;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        ctx.lineTo(
          rx + vx * t * 0.35,
          ry + vy * t * 0.35 + 0.5 * 9.8 * t * t * 0.35 * 5
        );
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Power ring fill
      ctx.strokeStyle = `rgba(255,200,80,${0.25 + this.aimPower * 0.5})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(rx, ry, 26, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * this.aimPower);
      ctx.stroke();

      ctx.restore();
    }

    // Health bar
    this._drawBar(ctx, 20, 22, 140, 10, player.health / player.maxHealth, '#e84848', '#200808', 'HP', C);

    // Gold
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,20,0.65)';
    this._roundRect(ctx, 20, 40, 100, 22, 5);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText(`  ${player.gold}g`, 24, 56);
    ctx.restore();

    // Altitude
    const altM = Math.max(0, Math.floor(player.x / 180));
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,20,0.65)';
    this._roundRect(ctx, W - 120, 22, 100, 22, 5);
    ctx.fill();
    ctx.fillStyle = C.blue;
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${altM}m`, W - 28, 38);
    ctx.textAlign = 'left';
    ctx.restore();

    // Inventory badge
    if (player.inventory.length > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,12,20,0.65)';
      this._roundRect(ctx, 20, 70, 130, 22, 5);
      ctx.fill();
      ctx.fillStyle = C.sub;
      ctx.font = '10px "Courier New", monospace';
      ctx.fillText('BAG', 28, 85);
      for (let i = 0; i < Math.min(player.inventory.length, 7); i++) {
        const it = player.inventory[i];
        ctx.fillStyle = it.color;
        ctx.fillRect(58 + i * 12, 76, 8, 8);
      }
      if (player.inventory.length > 7) {
        ctx.fillStyle = C.sub;
        ctx.fillText(`+${player.inventory.length - 7}`, 58 + 7 * 12, 85);
      }
      ctx.restore();
    }

    // Camp prompt
    if (player.nearCamp && this.state === 'game') {
      const pulse = 0.7 + Math.sin(time * 0.05) * 0.3;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = 'rgba(10,12,20,0.85)';
      this._roundRect(ctx, W/2 - 110, H - 72, 220, 38, 10);
      ctx.fill();
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 1.5;
      this._roundRect(ctx, W/2 - 110, H - 72, 220, 38, 10);
      ctx.stroke();
      ctx.fillStyle = C.accent;
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CAMP NEARBY   Tap to Enter', W/2, H - 48);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Notifications
    for (let i = 0; i < this.notifications.length; i++) {
      const n = this.notifications[i];
      const alpha = Math.min(1, n.life / 30);
      const ny = H * 0.35 - i * 30;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(10,12,20,0.8)';
      this._roundRect(ctx, W/2 - 130, ny, 260, 24, 6);
      ctx.fill();
      ctx.fillStyle = n.color;
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(n.msg, W/2, ny + 16);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      const alpha = (p.life / 65);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.dust) {
        ctx.fillStyle = p.color + alpha.toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot + p.life * 0.1);
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      }
      ctx.restore();
    }

    // Snowflakes
    for (const s of this.snowflakes) {
      ctx.fillStyle = `rgba(220,235,255,${s.life / 200})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Leaves
    const biome = World.getBiome(player.x);
    if (biome === 'forest' || biome === 'highland') {
      for (const l of this.leaves) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.translate(l.x, l.y);
        ctx.rotate(l.rot);
        ctx.fillStyle = l.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, l.size, l.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Smoke particles (in world space, drawn as screen overlay)
    for (const s of this.smokeParticles) {
      const alpha = (s.life / s.maxLife) * 0.35;
      ctx.fillStyle = `rgba(180,185,200,${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gesture hint (first 5 seconds)
    if (time < 300) {
      const a = Math.min(1, (300 - time) / 60);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(10,12,20,0.7)';
      this._roundRect(ctx, W/2 - 170, H - 100, 340, 60, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(200,190,160,0.8)';
      ctx.font = '11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Drag LEFT side to move    Drag RIGHT side to aim rope', W/2, H - 75);
      ctx.fillText('Release to throw     Tap right side to retract rope', W/2, H - 58);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  },

  _drawBar(ctx, x, y, w, h, pct, fg, bg, label, C) {
    ctx.fillStyle = 'rgba(10,12,20,0.65)';
    this._roundRect(ctx, x, y, w + 36, h + 4, 4);
    ctx.fill();
    ctx.fillStyle = bg;
    this._roundRect(ctx, x + 2, y + 2, w - 4, h, 3);
    ctx.fill();
    ctx.fillStyle = fg;
    this._roundRect(ctx, x + 2, y + 2, Math.max(0, (w - 4) * pct), h, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * pct), h / 2);
    ctx.fillStyle = C.sub;
    ctx.font = `bold 9px "Courier New", monospace`;
    ctx.fillText(label, x + w + 8, y + h + 1);
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  },

  // ── CAMP UI ───────────────────────────────────────────────────────────────
  drawCamp(ctx, W, H, player, time) {
    const C = this.C;
    // Dark overlay
    ctx.fillStyle = 'rgba(5,7,14,0.94)';
    ctx.fillRect(0, 0, W, H);

    // Cozy background scene
    this._drawCampScene(ctx, W, H, time);

    if (this.state === 'dialogue') {
      this._drawDialogue(ctx, W, H, time);
    } else if (this.state === 'shop') {
      this._drawShop(ctx, W, H, player);
    } else {
      this._drawCampMenu(ctx, W, H, player, time);
    }

    // Smoke at top right of scene
    if (time % 6 === 0) {
      this.spawnSmoke(W * 0.7 + 30, H * 0.36);
    }
    for (const s of this.smokeParticles) {
      const a = (s.life / s.maxLife) * 0.35;
      ctx.fillStyle = `rgba(180,185,205,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _drawCampScene(ctx, W, H, time) {
    // Night sky gradient
    const skyG = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    skyG.addColorStop(0, '#04060e');
    skyG.addColorStop(1, '#0c1428');
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, H * 0.55);

    // Stars
    for (let i = 0; i < 60; i++) {
      const sx = (i * 153.7) % W;
      const sy = (i * 97.3) % (H * 0.45);
      const twinkle = 0.4 + Math.sin(time * 0.04 + i * 0.9) * 0.3;
      ctx.fillStyle = `rgba(200,215,255,${twinkle})`;
      ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }

    // Moon
    ctx.save();
    const moonG = ctx.createRadialGradient(W * 0.15, H * 0.1, 0, W * 0.15, H * 0.1, 35);
    moonG.addColorStop(0, 'rgba(230,240,255,0.25)');
    moonG.addColorStop(1, 'rgba(100,120,200,0)');
    ctx.fillStyle = moonG;
    ctx.beginPath();
    ctx.arc(W * 0.15, H * 0.1, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(218,228,248,0.88)';
    ctx.beginPath();
    ctx.arc(W * 0.15, H * 0.1, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(8,12,24,0.85)';
    ctx.beginPath();
    ctx.arc(W * 0.15 + 6, H * 0.1 - 4, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Mountain silhouette
    ctx.fillStyle = '#090d18';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.55);
    const pts = 12;
    for (let i = 0; i <= pts; i++) {
      const x = (i / pts) * W;
      const y = H * 0.35 + Math.sin(x * 0.008 + 1) * 60 + Math.sin(x * 0.022) * 30;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Ground
    const gG = ctx.createLinearGradient(0, H * 0.52, 0, H);
    gG.addColorStop(0, '#0e1a0c');
    gG.addColorStop(1, '#060c06');
    ctx.fillStyle = gG;
    ctx.fillRect(0, H * 0.52, W, H * 0.48);

    // Firepit glow
    const fpx = W * 0.35, fpy = H * 0.7;
    const fireG = ctx.createRadialGradient(fpx, fpy, 0, fpx, fpy, 100);
    fireG.addColorStop(0, 'rgba(255,140,40,0.5)');
    fireG.addColorStop(0.4, 'rgba(255,80,10,0.2)');
    fireG.addColorStop(1, 'rgba(200,40,0,0)');
    ctx.fillStyle = fireG;
    ctx.beginPath();
    ctx.arc(fpx, fpy, 100, 0, Math.PI * 2);
    ctx.fill();
    // Fire
    for (let f = 0; f < 5; f++) {
      const fFlicker = Math.sin(time * 0.15 + f * 1.3) * 4;
      const fh = 16 + Math.sin(time * 0.12 + f * 2) * 8;
      ctx.fillStyle = f < 2 ? `rgba(255,${120 + f * 30},20,0.85)` : `rgba(255,200,50,0.6)`;
      ctx.beginPath();
      ctx.moveTo(fpx - 10 + f * 5, fpy);
      ctx.quadraticCurveTo(fpx - 6 + f * 4 + fFlicker, fpy - fh * 0.5, fpx + fFlicker, fpy - fh);
      ctx.quadraticCurveTo(fpx + 6 + fFlicker, fpy - fh * 0.5, fpx + 10 - f * 3, fpy);
      ctx.fill();
    }
    // Logs
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(fpx - 18, fpy - 3, 36, 8);
    ctx.strokeStyle = '#2a1408';
    ctx.lineWidth = 1;
    ctx.strokeRect(fpx - 18, fpy - 3, 36, 8);

    // Cabin scene right
    ctx.save();
    ctx.translate(W * 0.68, H * 0.72);
    // Simple cabin outline
    ctx.fillStyle = '#1e1408';
    ctx.fillRect(-60, -80, 120, 80);
    const roofG = ctx.createLinearGradient(0, -115, 0, -80);
    roofG.addColorStop(0, '#121008');
    roofG.addColorStop(1, '#1e1a0e');
    ctx.fillStyle = roofG;
    ctx.beginPath();
    ctx.moveTo(-68, -80); ctx.lineTo(0, -118); ctx.lineTo(68, -80);
    ctx.closePath();
    ctx.fill();
    // Snow on roof
    ctx.fillStyle = 'rgba(210,225,240,0.7)';
    ctx.beginPath();
    ctx.moveTo(-68, -80); ctx.lineTo(0, -118); ctx.lineTo(8, -116);
    ctx.lineTo(-60, -78);
    ctx.closePath();
    ctx.fill();
    // Window glow
    const winG = ctx.createRadialGradient(-25, -45, 0, -25, -45, 40);
    winG.addColorStop(0, 'rgba(255,180,60,0.6)');
    winG.addColorStop(1, 'rgba(255,80,10,0)');
    ctx.fillStyle = winG;
    ctx.fillRect(-55, -75, 80, 60);
    ctx.fillStyle = '#0e1830';
    ctx.fillRect(-38, -62, 24, 18);
    ctx.strokeStyle = '#3a2008';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-38, -62, 24, 18);
    ctx.beginPath();
    ctx.moveTo(-26, -62); ctx.lineTo(-26, -44);
    ctx.moveTo(-38, -53); ctx.lineTo(-14, -53);
    ctx.stroke();
    ctx.restore();

    // NPC by fire
    Entities.drawNPC(ctx, W * 0.45, H * 0.7, time, 0, 0);
  },

  _drawCampMenu(ctx, W, H, player, time) {
    const C = this.C;
    const bx = W/2 - 170, by = H * 0.6, bw = 340, bh = 195;

    ctx.fillStyle = 'rgba(8,10,18,0.9)';
    this._roundRect(ctx, bx, by, bw, bh, 14);
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, bx, by, bw, bh, 14);
    ctx.stroke();
    // Inner glow
    ctx.strokeStyle = 'rgba(200,150,50,0.15)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, bx + 2, by + 2, bw - 4, bh - 4, 12);
    ctx.stroke();

    ctx.fillStyle = C.accent;
    ctx.font = 'bold 17px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText("MIRNA'S TRADING POST", W/2, by + 28);
    ctx.fillStyle = C.sub;
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText(`Gold: ${player.gold}g   Items: ${player.inventory.length}`, W/2, by + 46);
    ctx.textAlign = 'left';

    const actions = [
      { label: 'Talk to Mirna', action: 'dialogue', color: C.blue },
      { label: 'Trade & Shop', action: 'shop', color: C.gold },
      { label: 'Continue Climbing', action: 'leave', color: C.green },
    ];
    this._campBtns = [];
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      const bBtnX = W/2 - 135, bBtnY = by + 62 + i * 42;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      this._roundRect(ctx, bBtnX, bBtnY, 270, 34, 7);
      ctx.fill();
      ctx.strokeStyle = a.color + '55';
      ctx.lineWidth = 1;
      this._roundRect(ctx, bBtnX, bBtnY, 270, 34, 7);
      ctx.stroke();
      ctx.fillStyle = a.color;
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(a.label, W/2, bBtnY + 22);
      ctx.textAlign = 'left';
      this._campBtns.push({ x: bBtnX, y: bBtnY, w: 270, h: 34, action: a.action });
    }
  },

  _drawDialogue(ctx, W, H, time) {
    const C = this.C;
    const lines = Entities.NPC_DIALOG[this.dialogIdx];
    const bx = W * 0.3, by = H * 0.55, bw = W * 0.65, bh = 130;

    ctx.fillStyle = 'rgba(8,10,18,0.92)';
    this._roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, bx, by, bw, bh, 10);
    ctx.stroke();

    ctx.fillStyle = C.accent;
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText('MIRNA', bx + 16, by + 24);

    ctx.fillStyle = C.text;
    ctx.font = '12px "Courier New", monospace';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bx + 16, by + 50 + i * 22);
    }

    const pulse = 0.5 + Math.sin(time * 0.1) * 0.3;
    ctx.fillStyle = `rgba(200,170,80,${pulse})`;
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Tap to continue', bx + bw - 12, by + bh - 10);
    ctx.textAlign = 'left';
  },

  _drawShop(ctx, W, H, player) {
    const C = this.C;
    const px = 20, py = H * 0.28, pw = W - 40, ph = H * 0.66;
    this._shopBounds = { x: px, y: py, w: pw, h: ph };

    ctx.fillStyle = 'rgba(8,10,18,0.95)';
    this._roundRect(ctx, px, py, pw, ph, 12);
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, px, py, pw, ph, 12);
    ctx.stroke();

    ctx.fillStyle = C.accent;
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText("TRADING POST", W/2, py + 26);
    ctx.fillStyle = C.gold;
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText(`${player.gold}g`, W/2, py + 44);
    ctx.textAlign = 'left';

    // Tabs
    this._tabBtns = [];
    const tabs = [{ label: 'SELL', tab: 'sell' }, { label: 'BUY', tab: 'buy' }];
    for (let i = 0; i < tabs.length; i++) {
      const tx = px + 16 + i * 100, ty = py + 54, tw = 88, th = 24;
      const active = this.shopTab === tabs[i].tab;
      ctx.fillStyle = active ? C.accent : 'rgba(255,255,255,0.06)';
      this._roundRect(ctx, tx, ty, tw, th, 5);
      ctx.fill();
      ctx.fillStyle = active ? '#fff' : C.sub;
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tabs[i].label, tx + tw/2, ty + 16);
      ctx.textAlign = 'left';
      this._tabBtns.push({ x: tx, y: ty, w: tw, h: th, tab: tabs[i].tab });
    }

    const contentY = py + 86;
    if (this.shopTab === 'sell') {
      this._drawSell(ctx, player, px, contentY, pw, py + ph - contentY, C);
    } else {
      this._drawBuy(ctx, player, px, contentY, pw, py + ph - contentY, C);
    }
  },

  _drawSell(ctx, player, x, y, w, h, C) {
    this._sellBtns = [];
    if (!player.inventory.length) {
      ctx.fillStyle = C.sub;
      ctx.font = '12px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Find items while climbing the mountain', x + w/2, y + 50);
      ctx.textAlign = 'left';
      return;
    }
    const cols = Math.max(1, Math.floor(w / 175));
    player.inventory.forEach((item, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const ix = x + 14 + col * 175, iy = y + 8 + row * 62;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      this._roundRect(ctx, ix, iy, 160, 54, 7);
      ctx.fill();
      ctx.strokeStyle = item.color + '44';
      ctx.lineWidth = 1;
      this._roundRect(ctx, ix, iy, 160, 54, 7);
      ctx.stroke();
      // Item dot
      const dotG = ctx.createRadialGradient(ix+14, iy+27, 0, ix+14, iy+27, 12);
      dotG.addColorStop(0, item.glow + 'cc');
      dotG.addColorStop(1, item.glow + '00');
      ctx.fillStyle = dotG;
      ctx.beginPath();
      ctx.arc(ix+14, iy+27, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(ix+14, iy+27, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.font = '11px "Courier New", monospace';
      ctx.fillText(item.name, ix + 30, iy + 20);
      ctx.fillStyle = C.gold;
      ctx.fillText(`${item.value}g`, ix + 30, iy + 36);
      // Sell btn
      const bx2 = ix + 108, by2 = iy + 17;
      ctx.fillStyle = '#1a3a1a';
      this._roundRect(ctx, bx2, by2, 42, 22, 4);
      ctx.fill();
      ctx.fillStyle = C.green;
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SELL', bx2 + 21, by2 + 14);
      ctx.textAlign = 'left';
      this._sellBtns.push({ x: bx2, y: by2, w: 42, h: 22, idx: i });
    });
  },

  _drawBuy(ctx, player, x, y, w, h, C) {
    this._buyBtns = [];
    const cols = Math.max(1, Math.floor(w / 200));
    Entities.SHOP_ITEMS.forEach((si, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const ix = x + 14 + col * 200, iy = y + 8 + row * 72;
      const level = si.type === 'upgrade' ? (player.upgrades[si.id] || 0) : 0;
      const owned = si.type === 'upgrade' ? level >= (si.maxLevel || 1)
                  : si.type === 'accessory' && player.accessories[si.slot] === si.val;
      const canAfford = player.gold >= si.cost;

      ctx.fillStyle = owned ? 'rgba(30,60,30,0.2)' : 'rgba(255,255,255,0.03)';
      this._roundRect(ctx, ix, iy, 185, 62, 7);
      ctx.fill();
      ctx.strokeStyle = owned ? C.green + '44' : C.border;
      ctx.lineWidth = 1;
      this._roundRect(ctx, ix, iy, 185, 62, 7);
      ctx.stroke();

      ctx.fillStyle = owned ? C.green : C.text;
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillText(si.name, ix + 10, iy + 18);
      ctx.fillStyle = C.sub;
      ctx.font = '10px "Courier New", monospace';
      ctx.fillText(si.desc, ix + 10, iy + 34);

      if (si.type === 'upgrade' && si.maxLevel > 1) {
        // Level pips
        for (let l = 0; l < si.maxLevel; l++) {
          ctx.fillStyle = l < level ? C.gold : C.border;
          ctx.beginPath();
          ctx.arc(ix + 10 + l * 12, iy + 50, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (owned) {
        ctx.fillStyle = C.green;
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.fillText(si.maxLevel > 1 ? `LVL ${level}/${si.maxLevel}` : 'OWNED', ix + 130, iy + 22);
      } else {
        const bx2 = ix + 118, by2 = iy + 30;
        ctx.fillStyle = canAfford ? '#1a2a3a' : '#2a1212';
        this._roundRect(ctx, bx2, by2, 58, 22, 4);
        ctx.fill();
        ctx.fillStyle = canAfford ? C.gold : '#664444';
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${si.cost}g`, bx2 + 29, by2 + 15);
        ctx.textAlign = 'left';
        this._buyBtns.push({ x: bx2, y: by2, w: 58, h: 22, idx: i });
      }
    });
  },
};

window.UI = UI;
