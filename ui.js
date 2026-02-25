// ui.js - HUD, shop UI, dialogue, menus

const UI = {
  state: 'game', // game, shop, dialogue, menu, death
  shopTab: 'sell',
  dialogPage: 0,
  dialogDone: false,
  notification: null,
  notifTimer: 0,
  campAnim: 0,
  throwIndicator: { active: false, angle: 0, power: 0 },
  particles: [],
  altitude: 0,
  tutorialStep: 0,
  tutorialDone: false,
  floatingTexts: [],

  // Color palette
  C: {
    bg:     '#0d0e16',
    panel:  '#1a1c2c',
    panelL: '#22263a',
    border: '#3a4060',
    gold:   '#f0c050',
    blue:   '#5ab0f8',
    green:  '#5ad878',
    red:    '#f05858',
    text:   '#e8e0d0',
    sub:    '#a09888',
    accent: '#c87a30',
  },

  init() {
    this.particles = [];
    this.floatingTexts = [];
  },

  notify(msg, color='#f0c050') {
    this.notification = { msg, color };
    this.notifTimer = 180;
    this.addFloatingText(msg, color);
  },

  addFloatingText(text, color, x, y) {
    this.floatingTexts.push({ text, color, x: x || 0, y: y || 0, vy: -1, life: 90, maxLife: 90 });
  },

  spawnCollectParticles(sx, sy, color) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const spd = 2 + Math.random() * 3;
      this.particles.push({
        x: sx, y: sy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 2,
        color,
        life: 40 + Math.random() * 20,
        size: 3 + Math.random() * 4
      });
    }
  },

  update() {
    this.campAnim++;

    // Notification
    if (this.notifTimer > 0) this.notifTimer--;

    // Particles
    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.95;
      p.life--;
    }

    // Floating texts
    this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);
    for (const t of this.floatingTexts) {
      t.y += t.vy;
      t.life--;
    }
  },

  drawHUD(ctx, W, H, player, world, time) {
    const C = this.C;

    // Health bar
    this.drawBar(ctx, 20, 20, 160, 14, player.health / player.maxHealth, '#f05858', '#1a0808', 'HP');

    // Stamina bar
    this.drawBar(ctx, 20, 40, 160, 10, player.stamina / player.maxStamina, '#5ab0f8', '#080818', 'ST');

    // Gold
    ctx.save();
    ctx.fillStyle = 'rgba(13,14,22,0.7)';
    this.roundRect(ctx, 20, 58, 120, 26, 5);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText(`◆ ${player.gold}g`, 30, 76);
    ctx.restore();

    // Altitude meter
    const altTiles = Math.max(0, Math.floor(-player.y / world.BLOCK_SIZE / 10));
    ctx.save();
    ctx.fillStyle = 'rgba(13,14,22,0.7)';
    this.roundRect(ctx, W - 140, 20, 120, 26, 5);
    ctx.fill();
    ctx.fillStyle = C.blue;
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`▲ ${altTiles}m`, W - 30, 38);
    ctx.textAlign = 'left';
    ctx.restore();

    // Inventory dots
    if (player.inventory.length > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(13,14,22,0.7)';
      this.roundRect(ctx, 20, 92, 160, 28, 5);
      ctx.fill();
      ctx.fillStyle = C.sub;
      ctx.font = '11px "Courier New", monospace';
      ctx.fillText('BAG:', 28, 110);
      for (let i = 0; i < Math.min(player.inventory.length, 8); i++) {
        const item = player.inventory[i];
        ctx.fillStyle = item.color;
        ctx.fillRect(65 + i * 13, 101, 9, 9);
      }
      if (player.inventory.length > 8) {
        ctx.fillStyle = C.sub;
        ctx.fillText(`+${player.inventory.length - 8}`, 65 + 8 * 13, 110);
      }
      ctx.restore();
    }

    // Throw indicator
    if (this.throwIndicator.active) {
      this.drawThrowIndicator(ctx, W, H);
    }

    // Tutorial
    if (!this.tutorialDone) {
      this.drawTutorial(ctx, W, H);
    }

    // Near camp indicator
    if (player.nearCamp && this.state === 'game') {
      ctx.save();
      ctx.fillStyle = 'rgba(13,14,22,0.85)';
      this.roundRect(ctx, W/2 - 100, H - 80, 200, 36, 8);
      ctx.fill();
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, W/2 - 100, H - 80, 200, 36, 8);
      ctx.stroke();
      ctx.fillStyle = C.accent;
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CAMP  •  Tap to Enter', W/2, H - 58);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // Notification
    if (this.notifTimer > 0 && this.notification) {
      const alpha = Math.min(1, this.notifTimer / 30);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(13,14,22,0.85)';
      this.roundRect(ctx, W/2 - 120, H/2 - 60, 240, 36, 8);
      ctx.fill();
      ctx.fillStyle = this.notification.color;
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.notification.msg, W/2, H/2 - 37);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      const alpha = p.life / 60;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
      ctx.restore();
    }
  },

  drawBar(ctx, x, y, w, h, pct, fg, bg, label) {
    const C = this.C;
    ctx.fillStyle = 'rgba(13,14,22,0.7)';
    this.roundRect(ctx, x - 2, y - 2, w + 30 + 4, h + 4, 4);
    ctx.fill();
    ctx.fillStyle = bg;
    this.roundRect(ctx, x, y, w, h, 3);
    ctx.fill();
    ctx.fillStyle = fg;
    this.roundRect(ctx, x, y, Math.max(0, w * pct), h, 3);
    ctx.fill();
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, w * pct, h/2);

    ctx.fillStyle = C.sub;
    ctx.font = `bold ${Math.min(h, 10)}px "Courier New", monospace`;
    ctx.fillText(label, x + w + 6, y + h - 1);
  },

  drawThrowIndicator(ctx, W, H) {
    const cx = W / 2, cy = H / 2;
    const { angle, power } = this.throwIndicator;
    const len = 60 + power * 40;

    ctx.save();
    ctx.strokeStyle = `rgba(255,200,80,${0.5 + power * 0.5})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    ctx.fillStyle = `rgba(255,200,80,${0.5 + power * 0.5})`;
    const tip = { x: cx + Math.cos(angle) * len, y: cy + Math.sin(angle) * len };
    ctx.beginPath();
    ctx.moveTo(tip.x + Math.cos(angle) * 8, tip.y + Math.sin(angle) * 8);
    ctx.lineTo(tip.x + Math.cos(angle + 2.5) * 10, tip.y + Math.sin(angle + 2.5) * 10);
    ctx.lineTo(tip.x + Math.cos(angle - 2.5) * 10, tip.y + Math.sin(angle - 2.5) * 10);
    ctx.fill();
    ctx.restore();
  },

  drawTutorial(ctx, W, H) {
    const steps = [
      { text: ['DRAG to aim', 'RELEASE to throw rope'], icon: '🎯' },
      { text: ['Rope must HOOK onto stone', 'Then SWIPE left/right to swing'], icon: '🪝' },
      { text: ['Tap rope icon to RETRACT', 'Tap ground to walk & jump'], icon: '↩' },
    ];
    const step = steps[Math.min(this.tutorialStep, steps.length - 1)];
    if (!step) { this.tutorialDone = true; return; }

    ctx.save();
    ctx.fillStyle = 'rgba(13,14,22,0.88)';
    this.roundRect(ctx, W/2 - 160, H - 140, 320, 80, 10);
    ctx.fill();
    ctx.strokeStyle = this.C.border;
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, W/2 - 160, H - 140, 320, 80, 10);
    ctx.stroke();

    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < step.text.length; i++) {
      ctx.fillStyle = i === 0 ? this.C.text : this.C.sub;
      ctx.fillText(step.text[i], W/2, H - 110 + i * 18);
    }

    // Step dots
    for (let i = 0; i < steps.length; i++) {
      ctx.fillStyle = i === this.tutorialStep ? this.C.gold : this.C.border;
      ctx.beginPath();
      ctx.arc(W/2 - 15 + i * 15, H - 75, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'left';
    ctx.restore();
  },

  // Camp / shop UI
  drawCamp(ctx, W, H, player, npc, time) {
    const C = this.C;

    // Background overlay
    ctx.fillStyle = 'rgba(5,8,15,0.92)';
    ctx.fillRect(0, 0, W, H);

    // Cabin illustration
    this.drawCabinScene(ctx, W, H, time);

    if (this.state === 'dialogue') {
      this.drawDialogue(ctx, W, H, npc);
    } else if (this.state === 'shop') {
      this.drawShop(ctx, W, H, player, npc);
    } else {
      // Camp menu
      this.drawCampMenu(ctx, W, H, player, npc, time);
    }
  },

  drawCabinScene(ctx, W, H, time) {
    const C = this.C;
    const midX = W * 0.5;
    const baseY = H * 0.55;

    // Starry bg
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137.5 % W);
      const sy = (i * 91.3 % (H * 0.5));
      const tw = 0.5 + Math.sin(time * 0.05 + i) * 0.5;
      ctx.fillStyle = `rgba(200,220,255,${tw * 0.6})`;
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Mountain backdrop
    ctx.fillStyle = '#0d1525';
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= W; x += 40) {
      ctx.lineTo(x, baseY - 80 + Math.sin(x * 0.02) * 40 + Math.sin(x * 0.07) * 20);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // Cabin structure
    const cbx = midX - 150, cby = baseY - 140, cbw = 300, cbh = 140;

    // Roof
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath();
    ctx.moveTo(cbx - 20, cby);
    ctx.lineTo(midX, cby - 70);
    ctx.lineTo(cbx + cbw + 20, cby);
    ctx.closePath();
    ctx.fill();
    // Roof planks texture
    ctx.strokeStyle = '#1a1008';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(cbx - 20 + i * 48, cby);
      ctx.lineTo(midX - 40 + i * 28, cby - 70);
      ctx.stroke();
    }
    // Snow on roof
    ctx.fillStyle = '#d8e8f2';
    ctx.beginPath();
    ctx.moveTo(cbx - 20, cby);
    ctx.lineTo(midX, cby - 70);
    ctx.lineTo(midX + 20, cby - 68);
    ctx.lineTo(cbx - 5, cby + 4);
    ctx.fill();

    // Walls
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(cbx, cby, cbw, cbh);
    // Wood plank lines
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 2;
    for (let row = 0; row < cbh; row += 18) {
      ctx.beginPath();
      ctx.moveTo(cbx, cby + row);
      ctx.lineTo(cbx + cbw, cby + row);
      ctx.stroke();
    }
    // Knots in wood
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = '#1a0a00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cbx + 40 + i * 45, cby + 20 + (i % 3) * 35, 6, 4, 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Door
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(midX - 28, cby + 56, 56, 84);
    ctx.fillStyle = '#4a3a22';
    ctx.fillRect(midX - 25, cby + 58, 23, 80);
    ctx.fillRect(midX + 2, cby + 58, 23, 80);
    // Door knob
    ctx.fillStyle = '#d4a040';
    ctx.beginPath();
    ctx.arc(midX - 8, cby + 100, 5, 0, Math.PI * 2);
    ctx.fill();
    // Door frame
    ctx.strokeStyle = '#6a4a28';
    ctx.lineWidth = 3;
    ctx.strokeRect(midX - 28, cby + 56, 56, 84);

    // Windows
    for (let side of [-1, 1]) {
      const wx = midX + side * 90 - 20;
      const wy = cby + 20;
      ctx.fillStyle = '#0a1830';
      ctx.fillRect(wx, wy, 40, 32);
      // Warm glow from inside
      const grd = ctx.createRadialGradient(wx + 20, wy + 16, 0, wx + 20, wy + 16, 30);
      grd.addColorStop(0, 'rgba(255,180,60,0.5)');
      grd.addColorStop(1, 'rgba(255,100,20,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(wx - 10, wy - 10, 60, 52);
      // Window panes
      ctx.strokeStyle = '#5a4022';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(wx, wy, 40, 32);
      ctx.beginPath();
      ctx.moveTo(wx + 20, wy); ctx.lineTo(wx + 20, wy + 32);
      ctx.moveTo(wx, wy + 16); ctx.lineTo(wx + 40, wy + 16);
      ctx.stroke();
      // Curtains
      ctx.fillStyle = 'rgba(180,100,60,0.6)';
      ctx.fillRect(wx, wy, 10, 32);
      ctx.fillRect(wx + 30, wy, 10, 32);
    }

    // Chimney
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(midX + 60, cby - 90, 30, 60);
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(midX + 58, cby - 95, 34, 8);
    // Smoke
    for (let i = 0; i < 5; i++) {
      const st = (this.campAnim * 0.3 + i * 20) % 100;
      const sx = midX + 75 + Math.sin(st * 0.1) * 8;
      const sy = cby - 95 - st;
      const alpha = Math.max(0, 0.4 - st * 0.004);
      ctx.fillStyle = `rgba(180,180,200,${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 8 + st * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ground / snow
    ctx.fillStyle = '#d8e8f2';
    ctx.fillRect(0, baseY + cbh - 10, W, 20);
    // Footprints in snow
    ctx.fillStyle = '#c0d4e0';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(midX + 30 + i * 20, baseY + cbh - 5, 8, 5);
      ctx.fillRect(midX + 35 + i * 20, baseY + cbh - 2, 8, 5);
    }

    // NPC standing outside
    this.drawNPCPortrait(ctx, midX - 90, baseY + cbh - 50, time, false);

    // Hanging lantern
    const lx = cbx + cbw - 10;
    const ly = cby + 5;
    const swing = Math.sin(time * 0.03) * 8;
    ctx.strokeStyle = '#6a4a28';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + swing, ly + 25);
    ctx.stroke();
    // Lantern body
    ctx.fillStyle = '#d4a040';
    ctx.fillRect(lx + swing - 8, ly + 25, 16, 20);
    // Lantern glow
    const lgrd = ctx.createRadialGradient(lx + swing, ly + 38, 0, lx + swing, ly + 38, 35);
    lgrd.addColorStop(0, 'rgba(255,200,80,0.6)');
    lgrd.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = lgrd;
    ctx.beginPath();
    ctx.arc(lx + swing, ly + 38, 35, 0, Math.PI * 2);
    ctx.fill();
  },

  drawNPCPortrait(ctx, x, y, time, large) {
    const scale = large ? 2.2 : 1.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Body
    ctx.fillStyle = '#5a3a6a'; // purple dress
    ctx.fillRect(-10, -30, 20, 32);
    // Apron
    ctx.fillStyle = '#e8d4b0';
    ctx.fillRect(-7, -20, 14, 22);
    // Arms
    ctx.fillStyle = '#5a3a6a';
    ctx.fillRect(-16, -28, 8, 20);
    ctx.fillRect(8, -28, 8, 20);
    // Hands
    ctx.fillStyle = '#c4846a';
    ctx.fillRect(-16, -10, 8, 7);
    ctx.fillRect(8, -10, 8, 7);
    // Head
    ctx.fillStyle = '#c4846a';
    ctx.fillRect(-9, -45, 18, 17);
    // Hair - braided
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(-10, -46, 20, 8);
    ctx.fillRect(-11, -46, 5, 16);
    ctx.fillRect(6, -46, 5, 16);
    // Eyes
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(-5, -40, 3, 3);
    ctx.fillRect(2, -40, 3, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-4, -40, 1, 1);
    ctx.fillRect(3, -40, 1, 1);
    // Smile
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -34, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // Headscarf
    ctx.fillStyle = '#c84040';
    ctx.fillRect(-11, -48, 22, 5);

    ctx.restore();
  },

  drawCampMenu(ctx, W, H, player, npc, time) {
    const C = this.C;
    const bx = W/2 - 200, by = H * 0.58;
    const bw = 400, bh = 200;

    ctx.fillStyle = 'rgba(13,14,22,0.88)';
    this.roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, bx, by, bw, bh, 12);
    ctx.stroke();

    // Title
    ctx.fillStyle = C.accent;
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText("▲ MOUNTAIN CAMP", W/2, by + 28);

    ctx.fillStyle = C.sub;
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(`Mirna's Trading Post  •  Altitude Camp`, W/2, by + 46);

    ctx.textAlign = 'left';

    // Buttons
    const buttons = [
      { label: 'Talk to Mirna', key: 'dialogue', color: C.blue },
      { label: 'Shop & Sell', key: 'shop', color: C.gold },
      { label: 'Continue Climbing', key: 'leave', color: C.green },
    ];
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const bBtnX = W/2 - 160, bBtnY = by + 70 + i * 40;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      this.roundRect(ctx, bBtnX, bBtnY, 320, 30, 6);
      ctx.fill();
      ctx.strokeStyle = btn.color + '88';
      ctx.lineWidth = 1;
      this.roundRect(ctx, bBtnX, bBtnY, 320, 30, 6);
      ctx.stroke();
      ctx.fillStyle = btn.color;
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(btn.label, W/2, bBtnY + 20);
      ctx.textAlign = 'left';

      // Store button coords for click detection
      btn.x = bBtnX; btn.y = bBtnY; btn.w = 320; btn.h = 30;
    }
    this._campMenuButtons = buttons;

    // Stats
    ctx.fillStyle = C.sub;
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ITEMS: ${player.inventory.length}  •  GOLD: ${player.gold}g  •  ALT: ${Math.floor(-player.y / 320)}m`, W/2, by + bh - 12);
    ctx.textAlign = 'left';
  },

  drawDialogue(ctx, W, H, npc) {
    const C = this.C;
    const lines = Entities.NPC_DIALOG[this.dialogPage % Entities.NPC_DIALOG.length];

    // NPC portrait
    this.drawNPCPortrait(ctx, W/2 - 140, H * 0.58, this.campAnim, true);

    // Dialog box
    ctx.fillStyle = 'rgba(13,14,22,0.92)';
    this.roundRect(ctx, W/2 - 40, H * 0.45, W/2 + 20, 140, 10);
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, W/2 - 40, H * 0.45, W/2 + 20, 140, 10);
    ctx.stroke();

    // Name tag
    ctx.fillStyle = C.accent;
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText('MIRNA', W/2 - 28, H * 0.45 + 22);

    ctx.fillStyle = C.text;
    ctx.font = '12px "Courier New", monospace';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W/2 - 28, H * 0.45 + 48 + i * 20);
    }

    ctx.fillStyle = C.gold;
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[ Tap to continue ]', W - 40, H * 0.45 + 130);
    ctx.textAlign = 'left';
  },

  drawShop(ctx, W, H, player, npc) {
    const C = this.C;
    const px = 30, py = H * 0.35, pw = W - 60, ph = H * 0.6;

    ctx.fillStyle = 'rgba(13,14,22,0.94)';
    this.roundRect(ctx, px, py, pw, ph, 12);
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, px, py, pw, ph, 12);
    ctx.stroke();

    // Header
    ctx.fillStyle = C.accent;
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText("MIRNA'S TRADING POST", W/2, py + 28);
    ctx.fillStyle = C.gold;
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText(`◆ ${player.gold}g`, W/2, py + 48);

    // Tabs
    const tabs = ['SELL', 'BUY'];
    for (let i = 0; i < tabs.length; i++) {
      const active = this.shopTab === tabs[i].toLowerCase();
      const tx = px + 20 + i * 100;
      ctx.fillStyle = active ? C.accent : 'rgba(255,255,255,0.07)';
      this.roundRect(ctx, tx, py + 58, 88, 24, 5);
      ctx.fill();
      ctx.fillStyle = active ? '#fff' : C.sub;
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.fillText(tabs[i], tx + 44, py + 75, 88);
    }
    ctx.textAlign = 'left';

    if (this.shopTab === 'sell') {
      this.drawSellTab(ctx, player, px, py + 90, pw, ph - 100);
    } else {
      this.drawBuyTab(ctx, player, px, py + 90, pw, ph - 100);
    }

    this._shopBounds = { px, py, pw, ph };
  },

  drawSellTab(ctx, player, x, y, w, h) {
    const C = this.C;
    if (player.inventory.length === 0) {
      ctx.fillStyle = C.sub;
      ctx.font = '13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Nothing to sell. Find items while climbing!', x + w/2, y + 60);
      ctx.textAlign = 'left';
      return;
    }

    const cols = Math.floor(w / 160);
    player.inventory.forEach((item, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const ix = x + 16 + col * 160;
      const iy = y + 10 + row * 60;

      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      this.roundRect(ctx, ix, iy, 148, 50, 6);
      ctx.fill();
      ctx.strokeStyle = item.color + '66';
      ctx.lineWidth = 1;
      this.roundRect(ctx, ix, iy, 148, 50, 6);
      ctx.stroke();

      ctx.fillStyle = item.color;
      ctx.fillRect(ix + 8, iy + 10, 14, 14);

      ctx.fillStyle = C.text;
      ctx.font = '11px "Courier New", monospace';
      ctx.fillText(item.name, ix + 28, iy + 20);
      ctx.fillStyle = C.gold;
      ctx.fillText(`◆ ${item.value}g`, ix + 28, iy + 38);

      // Sell button
      ctx.fillStyle = '#2a4a2a';
      this.roundRect(ctx, ix + 100, iy + 12, 38, 26, 4);
      ctx.fill();
      ctx.fillStyle = C.green;
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SELL', ix + 119, iy + 29);
      ctx.textAlign = 'left';

      item._sellBtn = { x: ix + 100, y: iy + 12, w: 38, h: 26, idx: i };
    });
  },

  drawBuyTab(ctx, player, x, y, w, h) {
    const C = this.C;
    const items = Entities.SHOP_ITEMS;
    const cols = Math.floor(w / 200);

    items.forEach((item, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const ix = x + 16 + col * 200;
      const iy = y + 10 + row * 68;

      const owned = item.type === 'upgrade'
        ? (player.upgrades[item.id] >= (item.maxLevel || 1))
        : (item.type === 'accessory' && player.accessories[item.slot] === item.val);
      const canAfford = player.gold >= item.cost;

      ctx.fillStyle = owned ? 'rgba(40,80,40,0.2)' : 'rgba(255,255,255,0.04)';
      this.roundRect(ctx, ix, iy, 186, 58, 6);
      ctx.fill();
      ctx.strokeStyle = owned ? C.green + '66' : C.border;
      ctx.lineWidth = 1;
      this.roundRect(ctx, ix, iy, 186, 58, 6);
      ctx.stroke();

      ctx.fillStyle = owned ? C.green : C.text;
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillText(item.name, ix + 10, iy + 18);
      ctx.fillStyle = C.sub;
      ctx.font = '10px "Courier New", monospace';
      ctx.fillText(item.desc, ix + 10, iy + 33);

      if (owned) {
        ctx.fillStyle = C.green;
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.fillText('OWNED', ix + 10, iy + 50);
      } else {
        ctx.fillStyle = canAfford ? '#2a3a5a' : '#2a1a1a';
        this.roundRect(ctx, ix + 100, iy + 30, 78, 20, 4);
        ctx.fill();
        ctx.fillStyle = canAfford ? C.gold : C.sub;
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`◆ ${item.cost}g`, ix + 139, iy + 44);
        ctx.textAlign = 'left';

        item._buyBtn = { x: ix + 100, y: iy + 30, w: 78, h: 20, idx: i };
      }
    });
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  handleCampTap(x, y, W, H, player, game) {
    if (this.state === 'dialogue') {
      this.dialogPage++;
      if (this.dialogPage >= Entities.NPC_DIALOG.length) {
        this.dialogPage = 0;
        this.state = 'camp';
      }
      return;
    }

    if (this.state === 'camp' && this._campMenuButtons) {
      for (const btn of this._campMenuButtons) {
        if (x > btn.x && x < btn.x + btn.w && y > btn.y && y < btn.y + btn.h) {
          if (btn.key === 'dialogue') this.state = 'dialogue';
          else if (btn.key === 'shop') { this.state = 'shop'; this.shopTab = 'sell'; }
          else if (btn.key === 'leave') { game.leaveCamp(); }
          return;
        }
      }
    }

    if (this.state === 'shop') {
      // Tab switching
      const tabY = this._shopBounds.py + 58;
      if (y > tabY && y < tabY + 24) {
        const tx = this._shopBounds.px;
        if (x > tx + 20 && x < tx + 108) this.shopTab = 'sell';
        if (x > tx + 120 && x < tx + 208) this.shopTab = 'buy';
      }

      if (this.shopTab === 'sell') {
        // Sell items
        for (const item of player.inventory) {
          if (item._sellBtn) {
            const b = item._sellBtn;
            if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
              player.gold += item.value;
              player.totalGoldEarned += item.value;
              player.inventory.splice(b.idx, 1);
              this.notify(`Sold: +${item.value}g`, '#f0c050');
              return;
            }
          }
        }
      } else {
        // Buy items
        for (const shopItem of Entities.SHOP_ITEMS) {
          if (shopItem._buyBtn) {
            const b = shopItem._buyBtn;
            if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
              if (player.gold >= shopItem.cost) {
                player.gold -= shopItem.cost;
                if (shopItem.type === 'upgrade') {
                  player.upgrades[shopItem.id] = (player.upgrades[shopItem.id] || 0) + 1;
                } else if (shopItem.type === 'accessory') {
                  player.accessories[shopItem.slot] = shopItem.val;
                }
                this.notify(`Bought: ${shopItem.name}!`, '#5ad878');
              } else {
                this.notify('Not enough gold!', '#f05858');
              }
              return;
            }
          }
        }
      }

      // Back button area - tap outside close
      if (x < this._shopBounds.px || x > this._shopBounds.px + this._shopBounds.pw) {
        this.state = 'camp';
      }
    }
  }
};

window.UI = UI;
