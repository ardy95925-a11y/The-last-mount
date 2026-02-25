// =============================================
// GAME.JS — The climb itself
// =============================================

// ---- MENU BACKGROUND ANIMATION ----
function initMenuBg() {
  const canvas = document.getElementById('menuCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  let particles = [];
  let raf;

  function resize() {
    w = canvas.width = canvas.offsetWidth || window.innerWidth;
    h = canvas.height = canvas.offsetHeight || window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * 800,
      y: Math.random() * 1000,
      vy: 0.3 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.2,
      size: Math.random() < 0.3 ? 2 : 1,
      alpha: 0.2 + Math.random() * 0.5
    });
  }

  function drawMenuBg() {
    ctx.clearRect(0, 0, w, h);
    // Dark mountain silhouette
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(0, 0, w, h);

    // Stars
    ctx.fillStyle = 'rgba(200,220,240,0.6)';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.5) % w;
      const sy = (i * 83.7) % (h * 0.6);
      const ss = i % 3 === 0 ? 1.5 : 0.8;
      ctx.fillRect(sx, sy, ss, ss);
    }

    // Mountain silhouette
    ctx.fillStyle = '#111820';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w * 0.1, h * 0.7);
    ctx.lineTo(w * 0.25, h * 0.4);
    ctx.lineTo(w * 0.4, h * 0.55);
    ctx.lineTo(w * 0.5, h * 0.15);
    ctx.lineTo(w * 0.6, h * 0.5);
    ctx.lineTo(w * 0.75, h * 0.35);
    ctx.lineTo(w * 0.9, h * 0.6);
    ctx.lineTo(w, h * 0.5);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Snow on peak
    ctx.fillStyle = 'rgba(212,232,240,0.15)';
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * 0.58);
    ctx.lineTo(w * 0.5, h * 0.15);
    ctx.lineTo(w * 0.58, h * 0.52);
    ctx.closePath();
    ctx.fill();

    // Ice glow at peak
    const grd = ctx.createRadialGradient(w * 0.5, h * 0.15, 0, w * 0.5, h * 0.15, 80);
    grd.addColorStop(0, 'rgba(91,184,212,0.15)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(w * 0.3, 0, w * 0.4, h * 0.4);

    // Snowfall
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > h + 10) { p.y = -5; p.x = Math.random() * w; }
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = '#c8e0f0';
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.restore();
    });

    raf = requestAnimationFrame(drawMenuBg);
  }
  drawMenuBg();

  // Stop when game starts
  window.stopMenuBg = () => cancelAnimationFrame(raf);
}

// ---- GAME STATE ----
const Game = {
  canvas: null,
  ctx: null,
  running: false,
  raf: null,

  // Player
  player: {
    x: 0, y: 0,
    vx: 0, vy: 0,
    w: 14, h: 22,
    onGround: false,
    stamina: 100,
    maxStamina: 100,
    altitude: 0,
    facingRight: true,
    falling: false,
    fallStartAlt: 0,
    dead: false,
    // Rope
    rope: { active: false, anchorX: 0, anchorY: 0, anchorAlt: 0, length: 150, swinging: false, angle: 0, angularV: 0 },
    // Grapple
    grappleTarget: null,
    pickaxeAnim: 0,
    // Accessories
    hasLantern: false,
    hasCrampons: false,
    hasCloak: false,
    hasGloves: false,
  },

  // Camera
  camera: { alt: 0 }, // altitude in meters at center of screen

  // World state
  wind: { speed: 0, targetSpeed: 0, timer: 0 },
  blizzard: { active: false, intensity: 0, timer: 0 },
  temp: -2,

  // Session data
  sessionItems: {},
  sessionStartAlt: 0,
  lastSaveAlt: 0,

  // Input state
  keys: { left: false, right: false, rope: false, pickaxe: false, jump: false },
  touchStart: null,

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupInput();
  },

  resize() {
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
  },

  newGame() {
    Inventory.init();
    LORE.init();
    World.init();
    this.startClimb(0);
  },

  continueGame() {
    Inventory.init();
    LORE.init();
    const savedAlt = parseInt(localStorage.getItem('ascent_save_alt') || '0');
    World.init(parseInt(localStorage.getItem('ascent_seed') || '0'));
    this.startClimb(savedAlt);
  },

  startClimb(fromAltitude) {
    if (window.stopMenuBg) window.stopMenuBg();
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Spawn player in the middle of the passage
    const walls = World.getWallsAtAlt(fromAltitude);
    const spawnX = ((walls.left + walls.right) / 2) * cw;
    const spawnY = ch * 0.6;

    this.player = {
      x: spawnX, y: spawnY,
      vx: 0, vy: 0,
      w: 14, h: 22,
      onGround: false,
      stamina: this.player?.stamina || 100,
      maxStamina: 100 + Inventory.getUpgradeValue('stamina_max'),
      altitude: fromAltitude,
      facingRight: true,
      falling: false,
      fallStartAlt: fromAltitude,
      dead: false,
      rope: { active: false, anchorX: 0, anchorY: 0, anchorAlt: fromAltitude, length: 150 + Inventory.getUpgradeValue('rope_range'), swinging: false, angle: -Math.PI/2, angularV: 0 },
      grappleTarget: null,
      pickaxeAnim: 0,
      hasLantern: Inventory.isEquipped('lantern'),
      hasCrampons: Inventory.isEquipped('crampons'),
      hasCloak: Inventory.isEquipped('warm_cloak'),
      hasGloves: Inventory.isEquipped('thick_gloves'),
    };

    this.camera.alt = fromAltitude;
    this.sessionStartAlt = fromAltitude;
    this.sessionItems = {};
    this.wind = { speed: 0, targetSpeed: 0, timer: 0 };
    this.blizzard = { active: false, intensity: 0, timer: 0 };
    this.running = true;

    showScreen('gameScreen');
    if (this.raf) cancelAnimationFrame(this.raf);
    this.loop();
  },

  setupInput() {
    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') this.keys.jump = true;
      if (e.key === 'e') this.keys.rope = true;
      if (e.key === 'q') this.keys.pickaxe = true;
    });
    document.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') this.keys.jump = false;
      if (e.key === 'e') this.keys.rope = false;
      if (e.key === 'q') this.keys.pickaxe = false;
    });

    // Touch controls
    const setupBtn = (id, action) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('touchstart', e => { e.preventDefault(); this.keys[action] = true; btn.classList.add('pressed'); }, { passive: false });
      btn.addEventListener('touchend', e => { e.preventDefault(); this.keys[action] = false; btn.classList.remove('pressed'); });
    };
    setupBtn('ctrlLeft', 'left');
    setupBtn('ctrlRight', 'right');
    setupBtn('ctrlJump', 'jump');
    setupBtn('ctrlRope', 'rope');
    setupBtn('ctrlPickaxe', 'pickaxe');

    // Tap on game canvas to throw rope toward tap point
    this.canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const tx = t.clientX - rect.left;
        const ty = t.clientY - rect.top;
        this.tryThrowRopeToward(tx, ty);
      }
    }, { passive: true });

    // Inventory button
    document.getElementById('btnInventory')?.addEventListener('click', () => {
      if (this.running) this.openCamp(null, true);
    });

    // Camp buttons
    document.getElementById('btnContinueClimb')?.addEventListener('click', () => this.closeCamp());
    document.getElementById('btnDescend')?.addEventListener('click', () => this.descend());

    // Death screen
    document.getElementById('btnTryAgain')?.addEventListener('click', () => this.respawn());
    document.getElementById('btnDeathMenu')?.addEventListener('click', () => { showScreen('mainMenu'); initMenuBg(); });

    // Main menu
    document.getElementById('btnNewGame')?.addEventListener('click', () => this.newGame());
    document.getElementById('btnContinue')?.addEventListener('click', () => this.continueGame());
    document.getElementById('btnLore')?.addEventListener('click', () => {
      LORE.renderLoreScreen();
      showScreen('loreScreen');
    });
    document.getElementById('btnCredits')?.addEventListener('click', () => showScreen('creditsScreen'));
    document.getElementById('closeLore')?.addEventListener('click', () => showScreen('mainMenu'));
    document.getElementById('closeCredits')?.addEventListener('click', () => showScreen('mainMenu'));

    ShopUI.init();
  },

  tryThrowRopeToward(tx, ty) {
    const p = this.player;
    if (!p || p.dead) return;
    const ch = this.canvas.height;
    const pxPerMeter = 2;
    // Only throw rope upward (ty < p.y)
    if (ty < p.y - 20) {
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ropeLen = p.rope.length;
      const nx = dx / dist;
      const ny = dy / dist;
      const ax = p.x + nx * ropeLen;
      const ay = p.y + ny * ropeLen;
      const altOffset = (p.y - ay) / pxPerMeter;
      p.rope.anchorX = ax;
      p.rope.anchorY = ay;
      p.rope.anchorAlt = p.altitude + altOffset;
      p.rope.active = true;
      p.rope.swinging = true;
    }
  },

  loop() {
    if (!this.running) return;
    this.update();
    this.render();
    this.raf = requestAnimationFrame(() => this.loop());
  },

  update() {
    if (!this.running) return;
    const p = this.player;
    if (p.dead) return;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const dt = 1;
    const pxPerMeter = 2;

    // ---- WIND ----
    this.wind.timer -= dt;
    if (this.wind.timer <= 0) {
      this.wind.targetSpeed = (Math.random() - 0.5) * 4 * (1 + p.altitude / 2000);
      this.wind.timer = 60 + Math.random() * 120;
    }
    this.wind.speed += (this.wind.targetSpeed - this.wind.speed) * 0.01;

    // ---- BLIZZARD ----
    this.blizzard.timer -= dt;
    if (this.blizzard.timer <= 0) {
      this.blizzard.active = p.altitude > 500 && Math.random() < 0.3;
      this.blizzard.intensity = this.blizzard.active ? 0.3 + Math.random() * 0.7 : 0;
      this.blizzard.timer = 200 + Math.random() * 300;
    }
    if (this.blizzard.active) {
      World.spawnParticles(cw, this.wind.speed, 8 + Math.floor(this.blizzard.intensity * 12));
    } else {
      World.spawnParticles(cw, this.wind.speed, 2);
    }
    World.updateParticles(ch, this.wind.speed);

    // ---- TEMPERATURE ----
    this.temp = -2 - (p.altitude / 100) * 0.6 - (this.blizzard.intensity * 5);

    // ---- INPUT ----
    const speedX = 2.2 + (p.hasCrampons ? 0.4 : 0);
    const ropeRange = p.rope.length;

    // Horizontal movement
    if (this.keys.left) {
      p.vx -= 0.5;
      p.facingRight = false;
    }
    if (this.keys.right) {
      p.vx += 0.5;
      p.facingRight = true;
    }
    p.vx = Math.max(-speedX, Math.min(speedX, p.vx));

    // Jump
    if (this.keys.jump && p.onGround) {
      p.vy = -8;
      p.onGround = false;
    }

    // Rope throw (when pressed freshly)
    if (this.keys.rope && !p.rope.active) {
      // Throw rope upward toward nearest wall
      const walls = World.getWallsAtAlt(p.altitude);
      const lx = walls.left * cw;
      const rx = walls.right * cw;
      const leftDist = p.x - lx;
      const rightDist = rx - p.x;
      // Throw to the closer wall, aiming upward
      const targetX = leftDist < rightDist ? lx - 4 : rx + 4;
      const targetY = p.y - ropeRange * 0.8;
      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ax = p.x + (dx / dist) * ropeRange;
      const ay = p.y + (dy / dist) * ropeRange;
      const altOffset = (p.y - ay) / pxPerMeter;
      p.rope.anchorX = ax;
      p.rope.anchorY = ay;
      p.rope.anchorAlt = p.altitude + altOffset;
      p.rope.active = true;
      p.rope.swinging = true;
    }
    if (!this.keys.rope && p.rope.active && !this.keys.jump) {
      // Release rope when not holding
    }
    // Explicit release with jump while swinging
    if (this.keys.jump && p.rope.active) {
      // Boost from rope
      if (p.rope.active) {
        p.vy -= 4;
        p.vx += this.wind.speed * 0.2;
      }
      p.rope.active = false;
    }

    // Pickaxe
    if (this.keys.pickaxe) {
      p.pickaxeAnim = 10;
      this.tryPickaxe();
    }
    if (p.pickaxeAnim > 0) p.pickaxeAnim--;

    // ---- PHYSICS ----
    // Gravity
    p.vy += 0.4;

    // Wind effect (more at higher altitude)
    const windEffect = this.wind.speed * 0.04 * (1 + p.altitude / 3000);
    p.vx += windEffect;

    // Rope physics (pendulum)
    if (p.rope.active) {
      const ax = p.rope.anchorX;
      const ay = p.rope.anchorY;
      const dx = p.x - ax;
      const dy = p.y - ay;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Constraint
      if (dist > ropeRange) {
        const scale = ropeRange / dist;
        p.x = ax + dx * scale;
        p.y = ay + dy * scale;
        // Reflect velocity along rope direction
        const nx = dx / dist;
        const ny = dy / dist;
        const dot = p.vx * nx + p.vy * ny;
        if (dot > 0) {
          p.vx -= dot * nx * 0.7;
          p.vy -= dot * ny * 0.7;
        }
      }
      // Apply pendulum force
      const angle = Math.atan2(p.x - ax, p.y - ay);
      p.vx += Math.sin(angle) * -0.1;
    }

    // Drag
    p.vx *= 0.82;
    if (!p.onGround) p.vy *= 0.995;

    // ---- MOVEMENT ----
    // Move X
    p.x += p.vx;

    // Wall collision X
    const walls = World.getWallsAtAlt(p.altitude);
    const lx = walls.left * cw + p.w / 2 + 2;
    const rx = walls.right * cw - p.w / 2 - 2;
    if (p.x < lx) {
      p.x = lx;
      p.vx = Math.abs(p.vx) * 0.3;
      if (p.rope.active && Math.abs(p.vx) < 0.5) {
        // Grip on wall
        p.vy *= 0.7;
      }
    }
    if (p.x > rx) {
      p.x = rx;
      p.vx = -Math.abs(p.vx) * 0.3;
      if (p.rope.active && Math.abs(p.vx) < 0.5) {
        p.vy *= 0.7;
      }
    }

    // Move Y
    const prevY = p.y;
    p.y += p.vy;
    p.onGround = false;

    // Floor check (don't fall off bottom)
    if (p.y > ch - p.h) {
      p.y = ch - p.h;
      p.vy = 0;
      p.onGround = true;
    }

    // Update altitude
    const prevAlt = p.altitude;
    const screenCenterAlt = this.camera.alt;
    // Player altitude from screen position
    p.altitude = screenCenterAlt + (ch / 2 - (p.y + p.h / 2)) / pxPerMeter;

    // Scroll camera when player climbs
    if (p.y < ch * 0.4) {
      this.camera.alt += (ch * 0.4 - p.y) / pxPerMeter * 0.1;
      p.y += (ch * 0.4 - p.y) * 0.1;
    }

    // Recalculate walls after camera shift
    const wallsNow = World.getWallsAtAlt(p.altitude);
    const lxNow = wallsNow.left * cw + p.w / 2 + 2;
    const rxNow = wallsNow.right * cw - p.w / 2 - 2;
    if (p.x < lxNow) p.x = lxNow;
    if (p.x > rxNow) p.x = rxNow;

    // ---- FALL DETECTION ----
    if (p.vy > 12) {
      if (!p.falling) {
        p.falling = true;
        p.fallStartAlt = p.altitude;
      }
    } else {
      if (p.falling && p.onGround) {
        const fallDist = p.fallStartAlt - p.altitude;
        if (fallDist > 30) {
          const fallBuffer = Inventory.getUpgradeValue('fall_buffer');
          if (fallBuffer < 1) {
            this.die();
            return;
          } else {
            p.stamina -= 40;
            notify('Hard landing! Stamina reduced.');
          }
        }
        p.falling = false;
      }
    }

    // ---- STAMINA ----
    // Cold drain
    const coldResist = Inventory.getUpgradeValue('cold_resist') +
                       (p.hasGloves ? 20 : 0) +
                       (p.hasCloak ? 40 : 0);
    const coldFactor = Math.max(0, 1 - coldResist / 100);
    const staminaDrain = 0.02 + (Math.abs(this.temp) * 0.01 * coldFactor) +
                         (this.blizzard.active ? 0.05 * this.blizzard.intensity : 0);
    p.stamina -= staminaDrain;
    p.maxStamina = 100 + Inventory.getUpgradeValue('stamina_max');

    // Auto-use rations if critical
    if (p.stamina < 5) {
      if (Inventory.hasItem('ration_pack')) {
        const item = Inventory.useConsumable('ration_pack');
        p.stamina = Math.min(p.maxStamina, p.stamina + 100);
        notify('Ration consumed — barely in time.');
      } else if (Inventory.hasItem('hot_tea')) {
        Inventory.useConsumable('hot_tea');
        p.stamina = Math.min(p.maxStamina, p.stamina + 40);
        notify('Tea helped.');
      } else {
        // Die from cold
        this.die();
        return;
      }
    }
    p.stamina = Math.max(0, Math.min(p.maxStamina, p.stamina));

    // ---- ITEM COLLECTION ----
    const collected = World.checkCrystalCollection(p.x, p.y, ch, this.camera.alt);
    collected.forEach(itemId => {
      Inventory.addItem(itemId, 1);
      this.sessionItems[itemId] = (this.sessionItems[itemId] || 0) + 1;
      showItemFound(itemId);
    });

    // Random item finds while climbing
    const findRate = 0.004 + Inventory.getUpgradeValue('find_rate');
    const randItem = World.randomFindItem(p.altitude, findRate);
    if (randItem) {
      Inventory.addItem(randItem, 1);
      this.sessionItems[randItem] = (this.sessionItems[randItem] || 0) + 1;
      showItemFound(randItem);
    }

    // Place terrain items
    World.maybePlaceItem(cw, ch, this.camera.alt);

    // ---- LORE UNLOCKS ----
    const newLore = LORE.checkUnlocks(p.altitude);
    if (newLore.length > 0) {
      setTimeout(() => notify(`📜 Found: "${newLore[0].title.substring(0, 30)}..."`, 4000), 500);
    }

    // ---- CAMP ARRIVAL ----
    const camp = World.getNearestCamp(p.altitude);
    if (camp) {
      this.openCamp(camp);
    }

    // ---- HUD UPDATE ----
    this.updateHUD();
  },

  tryPickaxe() {
    const p = this.player;
    const cw = this.canvas.width;
    // Higher pickaxe power = better finds
    const power = 1 + Inventory.getUpgradeValue('pick_power');
    const rand = Math.random();
    if (rand < 0.04 * power) {
      const items = ['iron_ore', 'crystal_shard', 'dark_stone', 'amber_chunk', 'fossil'];
      const idx = Math.floor(Math.random() * items.length);
      const itemId = items[idx];
      Inventory.addItem(itemId, 1);
      this.sessionItems[itemId] = (this.sessionItems[itemId] || 0) + 1;
      showItemFound(itemId);
      // Stamina cost
      p.stamina -= 8;
    }
  },

  updateHUD() {
    const p = this.player;
    const altEl = document.getElementById('hudAlt');
    const tempEl = document.getElementById('hudTemp');
    const staminaEl = document.getElementById('staminaBar');
    const coinsEl = document.getElementById('hudCoins');
    const nextCampEl = document.getElementById('nextCampDist');
    const windEl = document.getElementById('windSpeed');
    const windArrow = document.getElementById('windArrow');

    if (altEl) altEl.textContent = Math.floor(p.altitude) + 'm';
    if (tempEl) tempEl.textContent = Math.floor(this.temp) + '°C';
    const staminaPct = (p.stamina / p.maxStamina) * 100;
    if (staminaEl) {
      staminaEl.style.width = staminaPct + '%';
      staminaEl.classList.toggle('low', staminaPct < 25);
    }
    if (coinsEl) coinsEl.textContent = Inventory.coins;

    const nextCamp = World.getNextCamp(p.altitude);
    if (nextCamp && nextCampEl) {
      const dist = Math.floor(nextCamp.altitude - p.altitude);
      nextCampEl.textContent = dist + 'm away';
    }
    if (windEl) windEl.textContent = Math.abs(this.wind.speed).toFixed(1);
    if (windArrow) windArrow.textContent = this.wind.speed > 0 ? '→' : '←';
  },

  render() {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const p = this.player;
    const pxPerMeter = 2;

    ctx.clearRect(0, 0, cw, ch);

    // Background sky
    World.drawBackground(ctx, cw, ch, this.camera.alt);

    // Stars (if high enough)
    if (this.camera.alt > 1000) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.8, (this.camera.alt - 1000) / 2000);
      ctx.fillStyle = '#c8e0f0';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 137.5 + this.camera.alt * 0.01) % cw;
        const sy = (i * 83.7) % (ch * 0.5);
        ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.restore();
    }

    // Terrain (blocky walls)
    World.drawTerrain(ctx, cw, ch, this.camera.alt);

    // Camps
    World.campData.forEach(camp => World.drawCamp(ctx, cw, ch, this.camera.alt, camp));

    // Collectible items
    World.drawCrystals(ctx, cw, ch, this.camera.alt);

    // Planted anchors
    World.drawAnchors(ctx, ch, this.camera.alt);

    // Snow particles
    World.drawParticles(ctx);

    // Blizzard overlay
    if (this.blizzard.active) {
      ctx.save();
      ctx.globalAlpha = this.blizzard.intensity * 0.15;
      ctx.fillStyle = '#8fc8e0';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }

    // ---- ROPE ----
    if (p.rope.active) {
      const ropeLen = Math.sqrt((p.x - p.rope.anchorX) ** 2 + (p.y - p.rope.anchorY) ** 2);
      const segments = 8;
      ctx.strokeStyle = '#c8a840';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const rx = p.x + (p.rope.anchorX - p.x) * t;
        const ry = p.y + (p.rope.anchorY - p.y) * t + Math.sin(t * Math.PI) * (ropeLen * 0.08);
        ctx.lineTo(rx, ry);
      }
      ctx.stroke();

      // Anchor point
      ctx.fillStyle = '#f0d060';
      ctx.fillRect(p.rope.anchorX - 3, p.rope.anchorY - 3, 6, 6);
    }

    // ---- PLAYER (blocky pixel character) ----
    this.drawPlayer(ctx, p);

    // Fog of unknown (at very top, fade out visibility)
    if (this.camera.alt > 3500) {
      const fogAlpha = Math.min(0.4, (this.camera.alt - 3500) / 1000);
      ctx.save();
      ctx.globalAlpha = fogAlpha;
      ctx.fillStyle = '#8aa8b8';
      ctx.fillRect(0, 0, cw, ch * 0.4);
      ctx.restore();
    }

    // Vignette
    const vig = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.3, cw / 2, ch / 2, ch * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, cw, ch);
  },

  drawPlayer(ctx, p) {
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    const w = p.w;
    const h = p.h;
    const dir = p.facingRight ? 1 : -1;

    // Body (dark blue coat)
    ctx.fillStyle = p.hasCloak ? '#3a2848' : '#2a3850';
    ctx.fillRect(x - w / 2, y - h, w, h);

    // Coat highlight
    ctx.fillStyle = p.hasCloak ? '#5a3870' : '#3a5070';
    ctx.fillRect(x - w / 2, y - h, w, 4);

    // Head
    ctx.fillStyle = '#c8a080';
    ctx.fillRect(x - 5, y - h - 8, 10, 9);

    // Hat / Beanie
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(x - 6, y - h - 10, 12, 4);

    // Eyes
    ctx.fillStyle = '#202830';
    ctx.fillRect(x + dir * 1, y - h - 5, 2, 2);

    // Scarf
    ctx.fillStyle = '#c04030';
    ctx.fillRect(x - w / 2, y - h + 6, w, 3);

    // Backpack
    ctx.fillStyle = '#4a3818';
    ctx.fillRect(x - dir * 9, y - h + 4, 5, 10);

    // Legs
    const legOffset = p.onGround ? Math.floor(Date.now() / 200) % 2 : 0;
    ctx.fillStyle = '#1a2840';
    ctx.fillRect(x - w / 2, y - 8, 5, 8 + legOffset);
    ctx.fillRect(x + 1, y - 8, 5, 8 - legOffset);

    // Boots
    ctx.fillStyle = p.hasCrampons ? '#607890' : '#503818';
    ctx.fillRect(x - w / 2, y - 2, 5, 3);
    ctx.fillRect(x + 1, y - 2, 5, 3);

    // Pickaxe anim
    if (p.pickaxeAnim > 0) {
      const swing = (p.pickaxeAnim / 10) * 30 * dir;
      ctx.save();
      ctx.translate(x + dir * 6, y - h + 8);
      ctx.rotate((swing * Math.PI) / 180);
      ctx.fillStyle = '#808898';
      ctx.fillRect(-1, -14, 2, 16);
      ctx.fillStyle = '#c8c0a0';
      ctx.fillRect(-4, -16, 9, 4);
      ctx.restore();
    } else {
      // Resting pickaxe
      ctx.fillStyle = '#808898';
      ctx.fillRect(x + dir * 5, y - h + 4, 2, 10);
      ctx.fillStyle = '#c8c0a0';
      ctx.fillRect(x + dir * 3, y - h + 4, 7, 3);
    }

    // Lantern glow
    if (p.hasLantern) {
      const grd = ctx.createRadialGradient(x, y - h / 2, 0, x, y - h / 2, 80);
      grd.addColorStop(0, 'rgba(244,200,80,0.12)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(x - 80, y - h / 2 - 80, 160, 160);
    }
  },

  openCamp(camp, isManual = false) {
    if (this._campOpen) return;
    this._campOpen = true;
    this.running = false;

    const p = this.player;
    const displayCamp = camp || { name: 'Rest Spot', altitude: Math.floor(p.altitude), campIndex: 0 };

    document.getElementById('campName').textContent = displayCamp.name;
    document.getElementById('campAltDisplay').textContent = `Altitude: ${Math.floor(displayCamp.altitude)}m`;
    document.getElementById('campCoins').textContent = Inventory.coins;
    document.getElementById('campLoreFragment').textContent = LORE.getCampFragment(displayCamp.campIndex || 0);

    ShopUI.switchTab('sell');
    showScreen('campScreen');

    // Save at camp
    this.saveProgress();
  },

  closeCamp() {
    this._campOpen = false;
    this.running = true;
    showScreen('gameScreen');
    this.loop();
  },

  descend() {
    this.saveProgress();
    this._campOpen = false;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    showScreen('mainMenu');
    const continueBtn = document.getElementById('btnContinue');
    if (continueBtn) continueBtn.style.display = '';
    const recordEl = document.getElementById('recordAlt');
    if (recordEl) recordEl.textContent = Math.floor(this.player.altitude) + 'm';
    initMenuBg();
  },

  saveProgress() {
    localStorage.setItem('ascent_save_alt', Math.floor(this.player.altitude));
    localStorage.setItem('ascent_seed', World.seed);
    Inventory.save();
  },

  die() {
    if (this.player.dead) return;
    this.player.dead = true;
    this.running = false;
    cancelAnimationFrame(this.raf);

    document.getElementById('deathAlt').textContent = Math.floor(this.player.altitude) + 'm';
    document.getElementById('deathMessage').textContent = LORE.getRandomDeathMessage();

    // Show found items this session
    const foundList = document.getElementById('deathFoundItems');
    const itemIds = Object.keys(this.sessionItems);
    if (itemIds.length > 0) {
      foundList.innerHTML = 'You were carrying: ' + itemIds.map(id => {
        const def = ITEM_DEFS[id];
        return def ? `${def.icon}x${this.sessionItems[id]}` : '';
      }).filter(Boolean).join(' ');
    } else {
      foundList.innerHTML = 'You carried nothing but yourself.';
    }

    // Keep items you found (they're already in inventory)
    Inventory.save();

    setTimeout(() => showScreen('deathScreen'), 1200);
  },

  respawn() {
    // Respawn at last camp or bottom
    const savedAlt = parseInt(localStorage.getItem('ascent_save_alt') || '0');
    World.init(parseInt(localStorage.getItem('ascent_seed') || World.seed));
    this.startClimb(savedAlt);
  }
};

// ---- UTILITY ----
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    const isTarget = s.id === id;
    s.classList.toggle('active', isTarget);
    s.style.display = isTarget ? 'flex' : 'none';
  });
}

// ---- BOOT ----
document.addEventListener('DOMContentLoaded', () => {
  // Init systems first (registers all button listeners)
  LORE.init();
  Inventory.init();
  Game.init();

  // Check for existing save
  if (localStorage.getItem('ascent_save_alt')) {
    const continueBtn = document.getElementById('btnContinue');
    if (continueBtn) continueBtn.style.display = '';
    const recordEl = document.getElementById('recordAlt');
    if (recordEl) recordEl.textContent = localStorage.getItem('ascent_save_alt') + 'm';
  }

  // Show main menu AFTER listeners are attached
  showScreen('mainMenu');

  // Start menu background animation
  initMenuBg();
});
