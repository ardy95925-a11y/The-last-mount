// game.js - Core game engine, rendering, main loop

const Game = {
  canvas: null,
  ctx: null,
  W: 0, H: 0,
  camX: 0, camY: 0,
  camTargetX: 0,
  camTargetY: 0,
  time: 0,
  player: null,
  rope: null,
  rope2: null,
  input: { left: false, right: false, jump: false },
  touchState: { type: null, startX: 0, startY: 0, curX: 0, curY: 0 },
  worldItems: [],
  npc: null,
  lastItemSpawn: 0,
  running: false,
  windTime: 0,
  bgLayers: [],
  currentCamp: null,

  init() {
    this.canvas = document.getElementById('c');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Init world and preload
    World.preloadAround(0, 3000, 3);

    // Create player at mountain base
    const startX = 5 * World.BLOCK_SIZE;
    const startY = World.getSurfaceY(startX) - World.BLOCK_SIZE * 2;
    this.player = Entities.createPlayer(startX, startY);
    this.rope = Physics.createRope(startX, startY);
    this.npc = Entities.createNPC();

    this.camX = startX - this.W / 2;
    this.camY = startY - this.H / 2;
    this.camTargetX = this.camX;
    this.camTargetY = this.camY;

    UI.init();

    this.setupInput();
    this.running = true;
    requestAnimationFrame(t => this.loop(t));
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
  },

  setupInput() {
    const canvas = this.canvas;
    canvas.addEventListener('touchstart', e => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', e => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', e => this.onTouchEnd(e), { passive: false });
    canvas.addEventListener('mousedown', e => this.onTouchStart({ touches: [{ clientX: e.clientX, clientY: e.clientY }], preventDefault: () => {} }));
    canvas.addEventListener('mousemove', e => { if (e.buttons > 0) this.onTouchMove({ touches: [{ clientX: e.clientX, clientY: e.clientY }], preventDefault: () => {} }); });
    canvas.addEventListener('mouseup', e => this.onTouchEnd({ changedTouches: [{ clientX: e.clientX, clientY: e.clientY }], preventDefault: () => {} }));
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this.input.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') this.input.right = true;
      if (e.key === ' ' || e.key === 'ArrowUp') this.input.jump = true;
      if (e.key === 'r' || e.key === 'R') Physics.retractRope(this.rope);
    });
    document.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this.input.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') this.input.right = false;
      if (e.key === ' ' || e.key === 'ArrowUp') this.input.jump = false;
    });
  },

  onTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0];
    const x = t.clientX, y = t.clientY;

    if (UI.state !== 'game') {
      UI.handleCampTap(x, y, this.W, this.H, this.player, this);
      return;
    }

    this.touchState.startX = x;
    this.touchState.startY = y;
    this.touchState.curX = x;
    this.touchState.curY = y;
    this.touchState.startTime = Date.now();

    // Left side = movement, right side = rope
    if (x < this.W / 2) {
      this.touchState.type = 'move';
      this.input.left = false;
      this.input.right = false;
    } else {
      this.touchState.type = 'rope';
      UI.throwIndicator.active = true;
      UI.throwIndicator.angle = -Math.PI / 2;
      UI.throwIndicator.power = 0.5;
    }
  },

  onTouchMove(e) {
    e.preventDefault();
    const t = e.touches[0];
    this.touchState.curX = t.clientX;
    this.touchState.curY = t.clientY;

    if (UI.state !== 'game') return;

    if (this.touchState.type === 'move') {
      const dx = t.clientX - this.touchState.startX;
      this.input.left = dx < -15;
      this.input.right = dx > 15;
      this.input.jump = t.clientY < this.touchState.startY - 40;
    } else if (this.touchState.type === 'rope') {
      const dx = t.clientX - this.touchState.startX;
      const dy = t.clientY - this.touchState.startY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 10) {
        UI.throwIndicator.angle = Math.atan2(dy, dx);
        UI.throwIndicator.power = Math.min(1, dist / 120);
      }
    }
  },

  onTouchEnd(e) {
    e.preventDefault();
    const t = e.changedTouches ? e.changedTouches[0] : e.touches[0];
    const x = t ? t.clientX : this.touchState.curX;
    const y = t ? t.clientY : this.touchState.curY;

    if (UI.state !== 'game') return;

    if (this.touchState.type === 'rope') {
      UI.throwIndicator.active = false;
      const dx = this.touchState.curX - this.touchState.startX;
      const dy = this.touchState.curY - this.touchState.startY;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (this.rope.hook.stuck) {
        // Retract
        Physics.retractRope(this.rope);
        this.player.onRope = false;
      } else if (dist > 15) {
        // Throw
        const angle = Math.atan2(dy, dx);
        const power = Math.min(1, dist / 120);
        Physics.throwRope(this.rope, this.player, angle, power);
        if (!UI.tutorialDone && UI.tutorialStep === 0) UI.tutorialStep = 1;
      } else {
        // Tap - retract or quick throw up-left
        if (this.rope.throwing) {
          Physics.retractRope(this.rope);
        }
      }
    } else if (this.touchState.type === 'move') {
      this.input.left = false;
      this.input.right = false;
      this.input.jump = false;
    }

    this.touchState.type = null;

    // Camp enter check
    if (this.player.nearCamp && !this.player.inCamp) {
      const dx = x - this.W/2, dy = y - this.H/2;
      if (Math.abs(dx) < 100 && y > this.H - 90) {
        this.enterCamp();
      }
    }
  },

  enterCamp() {
    this.player.inCamp = true;
    UI.state = 'camp';
    UI.notify('Entered Camp', '#c87a30');
    if (!UI.tutorialDone) UI.tutorialStep = 3;
  },

  leaveCamp() {
    this.player.inCamp = false;
    UI.state = 'game';
    UI.notify('Climb on!', '#5ad878');
  },

  spawnItems() {
    if (this.worldItems.length > 12) return;
    const px = this.player.x;
    const py = this.player.y;
    const BS = World.BLOCK_SIZE;

    for (let attempt = 0; attempt < 3; attempt++) {
      const offX = (Math.random() - 0.5) * 600;
      const offY = (Math.random() - 0.3) * 400;
      const wx = px + offX;
      const wy = py + offY;
      const tx = Math.floor(wx / BS);
      const ty = Math.floor(wy / BS);
      const block = World.getBlock(tx, ty);
      const blockBelow = World.getBlock(tx, ty + 1);

      if (block && !block.solid && blockBelow && blockBelow.solid) {
        // Check not too close to existing items
        const tooClose = this.worldItems.some(it => {
          const d = Math.hypot(it.x - wx, it.y - wy);
          return d < 100;
        });
        if (!tooClose) {
          const item = World.rollLoot();
          if (item) {
            item.x = wx;
            item.y = wy;
            item.id = Math.random() * 9999 | 0;
            this.worldItems.push(item);
          }
        }
      }
    }
    this.lastItemSpawn = this.time;
  },

  checkItemPickup() {
    const px = this.player.x, py = this.player.y;
    this.worldItems = this.worldItems.filter(item => {
      const dx = item.x - px, dy = item.y - py;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 40) {
        this.player.inventory.push(item);
        UI.notify(`Found: ${item.name}!`, item.color);
        UI.spawnCollectParticles(px - this.camX, py - this.camY, item.color);
        if (!UI.tutorialDone && UI.tutorialStep === 1) UI.tutorialStep = 2;
        return false;
      }
      return true;
    });
  },

  checkCampProximity() {
    const camp = World.findNearbyCamp(this.player.x, this.player.y);
    this.player.nearCamp = !!camp;
    this.currentCamp = camp;
  },

  updateCamera() {
    const p = this.player;
    // Camera follows player with offset (look ahead based on velocity)
    const lookAheadX = p.vx * 6;
    const lookAheadY = p.vy * 4;
    this.camTargetX = p.x - this.W / 2 + lookAheadX;
    this.camTargetY = p.y - this.H * 0.55 + lookAheadY;

    // Smooth follow
    this.camX += (this.camTargetX - this.camX) * 0.08;
    this.camY += (this.camTargetY - this.camY) * 0.08;
  },

  // Main render of world
  renderWorld() {
    const ctx = this.ctx;
    const BS = World.BLOCK_SIZE;
    const camX = this.camX, camY = this.camY;
    const W = this.W, H = this.H;

    // Visible tile range
    const tx0 = Math.floor(camX / BS) - 1;
    const ty0 = Math.floor(camY / BS) - 1;
    const tx1 = tx0 + Math.ceil(W / BS) + 2;
    const ty1 = ty0 + Math.ceil(H / BS) + 2;

    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        const block = World.getBlock(tx, ty);
        if (!block || block.type === 'air') continue;

        const sx = tx * BS - camX;
        const sy = ty * BS - camY;

        // Skip camp marker in world (drawn specially)
        if (block.type === 'camp') continue;

        // Color variation by position
        const colorArr = block.color;
        const ci = ((tx * 3 + ty * 7) ^ (tx * 11)) & (colorArr.length - 1);
        let color = colorArr[Math.max(0, Math.min(ci, colorArr.length - 1))];

        // Ambient occlusion effect - darken based on neighbors
        const above = World.getBlock(tx, ty - 1);
        const dark = above && above.solid ? 0.82 : 1.0;

        // Draw block
        if (block.glow && block.emit) {
          // Glowing blocks
          const grd = ctx.createRadialGradient(sx + BS/2, sy + BS/2, 0, sx + BS/2, sy + BS/2, BS * 1.5);
          grd.addColorStop(0, block.emit + '55');
          grd.addColorStop(1, block.emit + '00');
          ctx.fillStyle = grd;
          ctx.fillRect(sx - BS/2, sy - BS/2, BS * 2, BS * 2);
        }

        ctx.fillStyle = color;
        ctx.fillRect(sx, sy, BS, BS);

        // Top face highlight for surface blocks
        if (block.top) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(sx, sy, BS, 4);
        }

        // Stone edge texture
        if (block.type === 'stone' || block.type === 'ice') {
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(sx, sy, BS, BS);
          // Subtle crack lines
          if ((tx + ty) % 5 === 0) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.beginPath();
            ctx.moveTo(sx + 4, sy + 8);
            ctx.lineTo(sx + 14, sy + 20);
            ctx.stroke();
          }
        }

        // Waving leaves and moss
        if (block.waving) {
          const wave = Math.sin(this.time * 0.07 + tx * 0.5 + ty * 0.3) * 2;
          this.drawLeaf(ctx, sx, sy, BS, color, wave, block.type === 'moss');
        }

        // Mushroom cap
        if (block.type === 'mushroom') {
          this.drawMushroom(ctx, sx, sy);
        }

        // Dirt face
        if (block.type === 'dirt') {
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          ctx.fillRect(sx, sy, BS, BS);
        }
      }
    }

    // Draw grass/waving vegetation on surface
    this.renderVegetation(tx0, ty0, tx1, ty1, camX, camY, BS);
  },

  renderVegetation(tx0, ty0, tx1, ty1, camX, camY, BS) {
    const ctx = this.ctx;
    for (let tx = tx0; tx <= tx1; tx += 2) {
      for (let ty = ty0; ty <= ty1; ty++) {
        const block = World.getBlock(tx, ty);
        if (!block || (block.type !== 'grass' && block.type !== 'snow')) continue;
        const above = World.getBlock(tx, ty - 1);
        if (above && above.solid) continue;

        const sx = tx * BS - camX;
        const sy = ty * BS - camY;
        const windOff = Math.sin(this.windTime * 0.04 + tx * 0.4) * 3;

        if (block.type === 'grass') {
          // Grass blades
          ctx.strokeStyle = '#5daa50';
          ctx.lineWidth = 1.5;
          for (let g = 0; g < 4; g++) {
            const gx = sx + 4 + g * 8;
            const gh = 6 + Math.sin(tx * 3 + g) * 3;
            ctx.beginPath();
            ctx.moveTo(gx, sy);
            ctx.quadraticCurveTo(gx + windOff, sy - gh/2, gx + windOff * 1.5, sy - gh);
            ctx.stroke();
          }
          // Flowers occasionally
          if ((tx * 7 + ty * 3) % 11 === 0) {
            ctx.fillStyle = (tx * 13 % 3 === 0) ? '#f07040' : '#e8c040';
            ctx.beginPath();
            ctx.arc(sx + 16 + windOff, sy - 10, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(sx + 16 + windOff, sy - 10, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (block.type === 'snow') {
          // Snow pile
          ctx.fillStyle = 'rgba(240,248,255,0.6)';
          ctx.beginPath();
          ctx.ellipse(sx + BS/2, sy - 2, BS/2, 4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  },

  drawLeaf(ctx, sx, sy, BS, color, wave, isMoss) {
    if (isMoss) {
      ctx.fillStyle = color;
      ctx.fillRect(sx, sy, BS, BS);
      // Wispy strands
      ctx.strokeStyle = '#4a8a3a';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const lx = sx + 5 + i * 10;
        ctx.beginPath();
        ctx.moveTo(lx, sy + BS);
        ctx.quadraticCurveTo(lx + wave, sy + BS/2, lx + wave * 1.5, sy);
        ctx.stroke();
      }
    } else {
      // Leaf cluster
      ctx.fillStyle = color;
      ctx.fillRect(sx + wave, sy, BS, BS);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(sx + wave, sy, BS, 6);
      // Vein highlights
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(sx + BS/2 + wave, sy + 2);
      ctx.lineTo(sx + BS/2 + wave, sy + BS - 2);
      ctx.stroke();
    }
  },

  drawMushroom(ctx, sx, sy) {
    const BS = World.BLOCK_SIZE;
    // Stem
    ctx.fillStyle = '#ffe8d0';
    ctx.fillRect(sx + 10, sy + 8, 12, 16);
    // Cap
    ctx.fillStyle = '#cc3333';
    ctx.beginPath();
    ctx.ellipse(sx + 16, sy + 10, 16, 12, 0, Math.PI, 0);
    ctx.fill();
    // Spots
    ctx.fillStyle = '#fff8';
    ctx.beginPath();
    ctx.arc(sx + 10, sy + 6, 3, 0, Math.PI * 2);
    ctx.arc(sx + 20, sy + 4, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  // Background sky gradient
  renderBackground() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const altitude = Math.max(0, -this.camY / 100);
    const deepness = Math.min(1, altitude / 30);

    // Sky gradient based on altitude
    const r = Math.floor(15 + 30 * (1 - deepness));
    const g = Math.floor(20 + 50 * (1 - deepness));
    const b = Math.floor(50 + 100 * (1 - deepness));
    const r2 = Math.floor(5);
    const g2 = Math.floor(8);
    const b2 = Math.floor(20);

    const skyGrd = ctx.createLinearGradient(0, 0, 0, H);
    skyGrd.addColorStop(0, `rgb(${r2},${g2},${b2})`);
    skyGrd.addColorStop(1, `rgb(${r},${g},${b})`);
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, W, H);

    // Stars (visible when high enough)
    if (deepness > 0.3) {
      const starAlpha = (deepness - 0.3) * 1.4;
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 137.5 + 50) % W);
        const sy = (i * 97.3 % (H * 0.6));
        const tw = Math.sin(this.time * 0.04 + i * 0.7) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(200,220,255,${starAlpha * tw * 0.8})`;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
    }

    // Far mountain silhouettes
    ctx.fillStyle = `rgba(20,30,50,0.5)`;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 60) {
      const my = H * 0.6 + Math.sin(x * 0.02 + this.camX * 0.001) * 80 + Math.sin(x * 0.05) * 30;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(W, H);
    ctx.fill();

    // Atmospheric fog at low altitude
    if (deepness < 0.5) {
      const fogAlpha = 0.12 * (1 - deepness * 2);
      const fogGrd = ctx.createLinearGradient(0, H * 0.5, 0, H);
      fogGrd.addColorStop(0, `rgba(150,200,255,0)`);
      fogGrd.addColorStop(1, `rgba(150,200,255,${fogAlpha})`);
      ctx.fillStyle = fogGrd;
      ctx.fillRect(0, H * 0.5, W, H * 0.5);
    }
  },

  update() {
    this.time++;
    this.windTime++;
    UI.update();

    if (UI.state !== 'game' || this.player.inCamp) return;

    const player = this.player;

    // Rope physics
    Physics.updateRope(this.rope, player, World, 1);

    // Attach rope to player if hook stuck
    if (this.rope.hook.stuck) {
      player.onRope = true;
      if (!UI.tutorialDone && UI.tutorialStep === 1) UI.tutorialStep = 2;
    } else {
      player.onRope = false;
    }

    // Player physics
    Physics.updatePlayer(player, World, this.input, this.rope);
    Entities.updatePlayer(player, 1);

    // Facing direction
    if (player.vx > 0.5) player.facing = 1;
    if (player.vx < -0.5) player.facing = -1;

    // Camera
    this.updateCamera();

    // Items
    if (this.time - this.lastItemSpawn > 90) {
      this.spawnItems();
    }
    this.checkItemPickup();

    // Camp proximity
    if (this.time % 30 === 0) this.checkCampProximity();

    // Preload chunks
    if (this.time % 60 === 0) {
      World.preloadAround(player.x, player.y, 3);
    }

    // Track highest altitude
    const tileX = Math.floor(player.x / World.BLOCK_SIZE);
    if (tileX > player.highestAlt) player.highestAlt = tileX;
  },

  render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    ctx.clearRect(0, 0, W, H);

    if (UI.state !== 'game' && this.player.inCamp) {
      UI.drawCamp(ctx, W, H, this.player, this.npc, this.time);
      return;
    }

    // Background
    this.renderBackground();

    // World blocks
    this.renderWorld();

    // Camp visual if nearby
    if (this.currentCamp) {
      this.renderCampVisual(this.currentCamp);
    }

    // World items
    for (const item of this.worldItems) {
      const sx = item.x - this.camX;
      const sy = item.y - this.camY;
      if (sx > -40 && sx < W + 40 && sy > -40 && sy < H + 40) {
        Entities.drawItem(ctx, item, item.x, item.y, this.camX, this.camY, this.time);
      }
    }

    // Rope
    Entities.drawRope(ctx, this.rope, this.player, this.camX, this.camY, this.time);

    // Player
    Entities.drawPlayer(ctx, this.player, this.camX, this.camY, this.time);

    // HUD
    UI.drawHUD(ctx, W, H, this.player, World, this.time);
  },

  renderCampVisual(camp) {
    const ctx = this.ctx;
    const BS = World.BLOCK_SIZE;
    const sx = camp.worldX - this.camX;
    const sy = camp.worldY - this.camY;

    // Shack structure
    const shW = 7 * BS, shH = 6 * BS;
    const shX = sx - shW / 2, shY = sy - shH;

    // Wooden walls
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(shX, shY + BS, shW, shH - BS);

    // Wood lines
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 1.5;
    for (let r = 0; r < shH - BS; r += BS / 2) {
      ctx.beginPath();
      ctx.moveTo(shX, shY + BS + r);
      ctx.lineTo(shX + shW, shY + BS + r);
      ctx.stroke();
    }

    // Roof
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath();
    ctx.moveTo(shX - BS/2, shY + BS);
    ctx.lineTo(sx, shY - BS);
    ctx.lineTo(shX + shW + BS/2, shY + BS);
    ctx.closePath();
    ctx.fill();

    // Roof snow
    ctx.fillStyle = '#d8e8f2';
    ctx.beginPath();
    ctx.moveTo(shX - BS/2, shY + BS);
    ctx.lineTo(sx, shY - BS);
    ctx.lineTo(sx + 8, shY - BS + 2);
    ctx.lineTo(shX, shY + BS + 4);
    ctx.fill();

    // Door
    ctx.fillStyle = '#1a1008';
    ctx.fillRect(sx - BS/2, shY + shH - 2 * BS, BS, 2 * BS);

    // Warm window glow
    const grd = ctx.createRadialGradient(sx - BS * 2, shY + shH/2, 0, sx - BS * 2, shY + shH/2, BS * 2);
    grd.addColorStop(0, 'rgba(255,180,60,0.6)');
    grd.addColorStop(1, 'rgba(255,100,20,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(sx - 4 * BS, shY, 4 * BS, shH);

    ctx.fillStyle = '#0a1830';
    ctx.fillRect(sx - 3 * BS, shY + BS * 1.5, BS * 1.2, BS * 0.8);

    // Chimney smoke
    for (let i = 0; i < 5; i++) {
      const st = (this.time * 0.4 + i * 22) % 100;
      const smX = sx + BS * 2.5 + Math.sin(st * 0.08) * 8;
      const smY = shY - st * 1.2;
      const alpha = Math.max(0, 0.35 - st * 0.003);
      ctx.fillStyle = `rgba(180,180,200,${alpha})`;
      ctx.beginPath();
      ctx.arc(smX, smY, 7 + st * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    // Camp label
    const glowPulse = 0.7 + Math.sin(this.time * 0.05) * 0.3;
    ctx.fillStyle = `rgba(200,150,60,${glowPulse})`;
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▲ CAMP', sx, shY - BS * 1.8);
    ctx.textAlign = 'left';
  },

  loop(timestamp) {
    if (!this.running) return;
    this.update();
    this.render();
    requestAnimationFrame(t => this.loop(t));
  }
};

window.Game = Game;
window.addEventListener('load', () => Game.init());
