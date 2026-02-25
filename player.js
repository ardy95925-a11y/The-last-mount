// player.js — Physics-based rope climbing, player state & upgrades

const Player = (() => {

  // ── Equipment / Upgrade definitions ───────────────────────────────
  const UPGRADES = {
    rope_basic:   { name: 'Hemp Rope',      emoji: '🪢', desc: 'Your worn rope. Barely holds.', owned: true,  price: 0,   maxRopeLen: 140, staminaRegen: 1.0, swingPower: 1.0 },
    rope_silk:    { name: 'Silk Line',       emoji: '🧵', desc: 'Lighter. Swings further.',      owned: false, price: 80,  maxRopeLen: 180, staminaRegen: 1.1, swingPower: 1.2 },
    rope_chain:   { name: 'Frost Chain',     emoji: '⛓️', desc: 'Heavy but unbreakable in wind.',owned: false, price: 200, maxRopeLen: 160, staminaRegen: 0.9, swingPower: 1.0, windResist: true },
    rope_ancient: { name: 'Ancient Cord',    emoji: '🌀', desc: 'Hums. Grips on its own.',       owned: false, price: 500, maxRopeLen: 200, staminaRegen: 1.3, swingPower: 1.4 },

    pack_torn:    { name: 'Torn Sack',       emoji: '🎒', desc: 'Falls apart but it\'s yours.',  owned: true,  price: 0,   maxItems: 4, isBackpack: true },
    pack_leather: { name: 'Leather Pack',    emoji: '🧳', desc: 'Holds more. Smells of pine.',   owned: false, price: 60,  maxItems: 6, isBackpack: true },
    pack_summit:  { name: 'Summit Satchel',  emoji: '💼', desc: 'Made by someone who made it.',  owned: false, price: 300, maxItems: 10, isBackpack: true },

    lantern_none: { name: 'No Lantern',      emoji: '🌑', desc: 'Dark.',                          owned: true,  price: 0,   light: 0, isLantern: true },
    lantern_oil:  { name: 'Oil Lantern',     emoji: '🪔', desc: 'Warm glow. Burns reassurance.', owned: false, price: 50,  light: 1, isLantern: true },
    lantern_cold: { name: 'Cold Light',      emoji: '🔦', desc: 'Blue. Clinical. Sees further.',  owned: false, price: 120, light: 2, isLantern: true },
    lantern_star: { name: 'Starstone Lamp',  emoji: '⭐', desc: 'Runs on memory.',                owned: false, price: 350, light: 3, isLantern: true },

    gloves_none:  { name: 'Bare Hands',      emoji: '🤚', desc: 'Raw. Getting rougher.',          owned: true,  price: 0,   gripBonus: 1.0, isGloves: true },
    gloves_wool:  { name: 'Wool Gloves',     emoji: '🧤', desc: 'Warm. Grip slips in ice.',       owned: false, price: 40,  gripBonus: 1.2, isGloves: true },
    gloves_iron:  { name: 'Iron Fingers',    emoji: '🔩', desc: 'Heavy. Grips anything.',         owned: false, price: 180, gripBonus: 1.6, isGloves: true },
  };

  // ── Rope simulation ────────────────────────────────────────────────
  const ROPE_SEGS = 12;

  // ── State ──────────────────────────────────────────────────────────
  let x, y;            // world position
  let vx = 0, vy = 0; // velocity
  let stamina = 100;
  let maxStamina = 100;
  let gripping = false;
  let anchorX = 0, anchorY = 0;
  let ropeLength = 140;
  let ropeSegs = [];   // verlet rope points
  let swinging = false;
  let onGrip = null;   // currently grabbed grip object
  let dead = false;
  let gold = 0;
  let highAlt = 0;
  let equipped = {
    rope: 'rope_basic',
    pack: 'pack_torn',
    lantern: 'lantern_none',
    gloves: 'gloves_none'
  };
  let ownedUpgrades = new Set(['rope_basic', 'pack_torn', 'lantern_none', 'gloves_none']);

  // Touch / input state
  let touches = {};
  let lastTapTime = 0;
  let swingDir = 0; // -1 left, 1 right, 0 none
  let holding = false;
  let jumpQueued = false;

  const GRAVITY = 0.25;
  const SWING_FORCE = 0.35;
  const MAX_FALL_SPEED = 12;
  const STAMINA_DRAIN = 0.08;
  const COLLECT_RANGE = 35;

  // ── Rope initialization ────────────────────────────────────────────
  function initRope(px, py) {
    ropeSegs = [];
    for (let i = 0; i <= ROPE_SEGS; i++) {
      ropeSegs.push({ x: px, y: py + i * 5, ox: px, oy: py + i * 5 });
    }
  }

  function getEquipStats() {
    const r = UPGRADES[equipped.rope] || UPGRADES.rope_basic;
    const g = UPGRADES[equipped.gloves] || UPGRADES.gloves_none;
    return {
      maxRopeLen: r.maxRopeLen || 140,
      staminaRegen: r.staminaRegen || 1.0,
      swingPower: r.swingPower || 1.0,
      gripBonus: g.gripBonus || 1.0,
      light: (UPGRADES[equipped.lantern] || {}).light || 0,
      windResist: r.windResist || false,
    };
  }

  // ── Verlet rope simulation ─────────────────────────────────────────
  function simulateRope(ancX, ancY, windX) {
    const stats = getEquipStats();
    const segLen = stats.maxRopeLen / ROPE_SEGS;

    // Pin first segment to anchor
    ropeSegs[0].x = ancX;
    ropeSegs[0].y = ancY;

    // Pin last segment to player
    ropeSegs[ROPE_SEGS].x = x;
    ropeSegs[ROPE_SEGS].y = y;

    // Verlet update on interior segments
    for (let i = 1; i < ROPE_SEGS; i++) {
      const s = ropeSegs[i];
      const ax = s.x - s.ox + windX * 0.5 * (1 - i / ROPE_SEGS);
      const ay = s.y - s.oy + GRAVITY * 0.3;
      s.ox = s.x;
      s.oy = s.y;
      s.x += ax;
      s.y += ay;
    }

    // Constraint passes
    for (let iter = 0; iter < 5; iter++) {
      for (let i = 0; i < ROPE_SEGS; i++) {
        const a = ropeSegs[i];
        const b = ropeSegs[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const diff = (dist - segLen) / dist * 0.5;
        if (i > 0) { a.x += dx * diff; a.y += dy * diff; }
        if (i < ROPE_SEGS - 1) { b.x -= dx * diff; b.y -= dy * diff; }
      }
      // Re-pin endpoints
      ropeSegs[0].x = ancX; ropeSegs[0].y = ancY;
      ropeSegs[ROPE_SEGS].x = x; ropeSegs[ROPE_SEGS].y = y;
    }
  }

  // ── Main update ────────────────────────────────────────────────────
  function update(dt, chunks, windX) {
    if (dead) return;

    const stats = getEquipStats();
    ropeLength = stats.maxRopeLen;

    const walls = World.getWallsAtY(y);

    if (gripping) {
      // Pendulum physics while gripping rope
      const dx = x - anchorX;
      const dy = y - anchorY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Swing forces
      const tangX = -dy / dist;
      const tangY = dx / dist;
      const swingForce = swingDir * SWING_FORCE * stats.swingPower * dt * 0.05;
      vx += tangX * swingForce;
      vy += tangY * swingForce;

      // Wind effect (unless wind-resistant rope)
      if (!stats.windResist) {
        vx += windX * 0.02;
      }

      // Gravity
      vy += GRAVITY;

      // Move
      x += vx;
      y += vy;

      // Constrain to rope length
      const dx2 = x - anchorX;
      const dy2 = y - anchorY;
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (dist2 > ropeLength) {
        const nx = dx2 / dist2;
        const ny = dy2 / dist2;
        x = anchorX + nx * ropeLength;
        y = anchorY + ny * ropeLength;
        // Project velocity onto tangent
        const dot = vx * nx + vy * ny;
        vx -= dot * nx * 1.1;
        vy -= dot * ny * 1.1;
      }

      // Stamina drain while holding
      stamina -= STAMINA_DRAIN * dt * 0.06;
      if (stamina <= 0 && onGrip === null) {
        releaseGrip();
      }

      simulateRope(anchorX, anchorY, windX);

    } else {
      // Free fall
      vy += GRAVITY;
      vy = Math.min(vy, MAX_FALL_SPEED);

      if (!stats.windResist) vx += windX * 0.01;
      vx *= 0.98;

      x += vx;
      y += vy;
    }

    // Wall collision
    if (x < walls.left + 15) {
      x = walls.left + 15;
      vx = Math.abs(vx) * 0.3;
    }
    if (x > walls.right - 15) {
      x = walls.right - 15;
      vx = -Math.abs(vx) * 0.3;
    }

    // Stamina regen when not gripping
    if (!gripping) {
      stamina = Math.min(maxStamina, stamina + stats.staminaRegen * 0.03 * dt);
    }

    // Jump queue
    if (jumpQueued && !gripping) {
      vx += swingDir * 4;
      vy -= 8;
      jumpQueued = false;
    }

    // Check if fallen off screen bottom  
    // (handled in game.js with death check)

    // Collect nearby items
    checkCollect(chunks);

    // Update lantern
    if (UPGRADES[equipped.lantern].light > 0) {
      Entities.spawnLanternFlicker(x - 10, y - 15);
    }

    if (y > highAlt) highAlt = y;

    Entities.addRopeTrail(x, y);
  }

  function checkCollect(chunks) {
    const ci = Math.floor(y / World.CHUNK_H);
    for (let i = ci - 1; i <= ci + 1; i++) {
      if (!chunks[i]) continue;
      chunks[i].collectibles.forEach(c => {
        if (c.collected) return;
        const dx = x - c.x;
        const dy = y - c.y;
        if (dx * dx + dy * dy < COLLECT_RANGE * COLLECT_RANGE) {
          c.collected = true;
          Entities.addToInventory(c.type);
          Entities.spawnCollectEffect(c.x, c.y, c.type);
          UI.showNotification(`Found ${Entities.COLLECTIBLES[c.type].emoji} ${Entities.COLLECTIBLES[c.type].name}!`);
        }
      });
    }
  }

  // ── Grip logic ─────────────────────────────────────────────────────
  function tryGrabNearestGrip(chunks) {
    const stats = getEquipStats();
    const GRAB_RANGE = 160 * stats.gripBonus;
    let best = null, bestDist = GRAB_RANGE;

    const ci = Math.floor(y / World.CHUNK_H);
    for (let i = ci - 1; i <= ci + 2; i++) {
      if (!chunks[i]) continue;
      chunks[i].grips.forEach(grip => {
        if (grip.collected) return;
        const dx = grip.x - x;
        const dy = grip.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Prefer grips that are higher up (above player)
        const bonus = (dy > 0) ? 0.7 : 1.0;
        if (dist * bonus < bestDist) {
          bestDist = dist * bonus;
          best = grip;
        }
      });
    }

    if (best) {
      grabGrip(best);
    } else {
      // Throw rope to wall
      const walls = World.getWallsAtY(y + ropeLength * 0.5);
      const leftDist = x - walls.left;
      const rightDist = walls.right - x;
      if (leftDist < rightDist) {
        anchorX = walls.left + 10;
      } else {
        anchorX = walls.right - 10;
      }
      anchorY = y + ropeLength * 0.7;
      gripping = true;
      onGrip = null;
      Entities.spawnRopeSwingEffect(anchorX, anchorY);
    }
  }

  function grabGrip(grip) {
    anchorX = grip.x;
    anchorY = grip.y;
    gripping = true;
    onGrip = grip;
    const stats = getEquipStats();
    Entities.spawnGripEffect(grip.x, grip.y, grip.type);

    // Ice grips drain stamina faster
    if (grip.type === 'ice') {
      stamina -= 8 / stats.gripBonus;
    }
  }

  function releaseGrip() {
    gripping = false;
    onGrip = null;
    simulateRope(x, y, 0);
  }

  // ── Input handling ─────────────────────────────────────────────────
  function onTouchStart(e) {
    e.preventDefault();
    const W = window.innerWidth;
    Array.from(e.changedTouches).forEach(t => {
      touches[t.identifier] = { x: t.clientX, y: t.clientY, startTime: Date.now() };
      if (t.clientX < W * 0.5) {
        swingDir = -1;
      } else {
        swingDir = 1;
      }

      if (!gripping) {
        tryGrabNearestGrip(World.getChunks());
      }

      // Double tap detect
      const now = Date.now();
      if (now - lastTapTime < 300) {
        jumpQueued = true;
      }
      lastTapTime = now;
    });
    holding = Object.keys(touches).length > 0;
  }

  function onTouchEnd(e) {
    e.preventDefault();
    Array.from(e.changedTouches).forEach(t => {
      delete touches[t.identifier];
    });

    if (Object.keys(touches).length === 0) {
      swingDir = 0;
      holding = false;
      if (gripping) releaseGrip();
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    const W = window.innerWidth;
    Array.from(e.changedTouches).forEach(t => {
      if (touches[t.identifier]) {
        touches[t.identifier].x = t.clientX;
        touches[t.identifier].y = t.clientY;
        swingDir = t.clientX < W * 0.5 ? -1 : 1;
      }
    });
  }

  // Keyboard fallback (for testing on desktop)
  function onKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') {
      swingDir = -1;
      if (!gripping) tryGrabNearestGrip(World.getChunks());
    }
    if (e.key === 'ArrowRight' || e.key === 'd') {
      swingDir = 1;
      if (!gripping) tryGrabNearestGrip(World.getChunks());
    }
    if (e.key === ' ') {
      if (gripping) releaseGrip();
      else tryGrabNearestGrip(World.getChunks());
    }
  }

  function onKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowRight' || e.key === 'd') {
      swingDir = 0;
      if (gripping) releaseGrip();
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────
  function draw(ctx, W, H, scrollY, time) {
    if (dead) return;

    const sx = x;
    const sy = H - (y - scrollY);

    // Draw rope
    if (gripping && ropeSegs.length > 0) {
      drawRope(ctx, H, scrollY, time);
    }

    // Lantern glow
    const stats = getEquipStats();
    if (stats.light > 0) {
      const glowR = 80 + stats.light * 40;
      const lightGrad = ctx.createRadialGradient(sx, sy, 5, sx, sy, glowR);
      const warmth = stats.light === 2 ? '160,200,255' : '255,180,60';
      lightGrad.addColorStop(0, `rgba(${warmth},${0.15 * stats.light})`);
      lightGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player body — blocky pixel style
    const bobble = gripping ? Math.sin(time * 0.004) * 1.5 : Math.sin(time * 0.008) * 0.5;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 16 + bobble, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (blocky)
    ctx.fillStyle = '#c8a060'; // coat
    ctx.fillRect(sx - 8, sy - 14 + bobble, 16, 18);

    // Head
    ctx.fillStyle = '#e0c090';
    ctx.fillRect(sx - 6, sy - 22 + bobble, 12, 10);

    // Hat
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(sx - 7, sy - 24 + bobble, 14, 3);
    ctx.fillRect(sx - 5, sy - 28 + bobble, 10, 6);

    // Eyes
    ctx.fillStyle = '#1a1010';
    ctx.fillRect(sx - 4, sy - 20 + bobble, 2, 2);
    ctx.fillRect(sx + 2, sy - 20 + bobble, 2, 2);

    // Scarf
    ctx.fillStyle = '#c84040';
    ctx.fillRect(sx - 7, sy - 16 + bobble, 14, 3);

    // Backpack indicator
    const packEmoji = UPGRADES[equipped.pack].emoji;
    ctx.font = '12px serif';
    ctx.textAlign = 'center';
    ctx.fillText(packEmoji, sx + 10, sy - 8 + bobble);

    // Lantern if equipped
    if (stats.light > 0) {
      const lantEmoji = UPGRADES[equipped.lantern].emoji;
      ctx.fillText(lantEmoji, sx - 10, sy + bobble);
    }

    // Stamina visual on player
    if (stamina < 50) {
      const staminaAlpha = (1 - stamina / 50) * 0.7;
      ctx.fillStyle = `rgba(255,100,100,${staminaAlpha})`;
      ctx.fillRect(sx - 8, sy - 26 + bobble, (stamina / 50) * 16, 2);
    }
  }

  function drawRope(ctx, H, scrollY, time) {
    if (!ropeSegs || ropeSegs.length < 2) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Rope shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ropeSegs.forEach((s, i) => {
      const sy2 = H - (s.y - scrollY);
      if (i === 0) ctx.moveTo(s.x + 2, sy2 + 2);
      else ctx.lineTo(s.x + 2, sy2 + 2);
    });
    ctx.stroke();

    // Rope main — color based on equipment
    const ropeColors = {
      rope_basic: '#c8a060',
      rope_silk: '#e0c8e0',
      rope_chain: '#808080',
      rope_ancient: '#a080c0'
    };
    const ropeColor = ropeColors[equipped.rope] || '#c8a060';

    ctx.strokeStyle = ropeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ropeSegs.forEach((s, i) => {
      const sy2 = H - (s.y - scrollY);
      if (i === 0) ctx.moveTo(s.x, sy2);
      else ctx.lineTo(s.x, sy2);
    });
    ctx.stroke();

    // Highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ropeSegs.forEach((s, i) => {
      const sy2 = H - (s.y - scrollY);
      if (i === 0) ctx.moveTo(s.x - 1, sy2);
      else ctx.lineTo(s.x - 1, sy2);
    });
    ctx.stroke();

    // Anchor point
    const as = { x: ropeSegs[0].x, sy2: H - (ropeSegs[0].y - scrollY) };
    ctx.fillStyle = onGrip ? '#ffd060' : '#a08060';
    ctx.shadowBlur = onGrip ? 8 : 0;
    ctx.shadowColor = '#ffd060';
    ctx.beginPath();
    ctx.arc(as.x, as.sy2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ── Upgrade management ─────────────────────────────────────────────
  function buyUpgrade(key) {
    const upg = UPGRADES[key];
    if (!upg || ownedUpgrades.has(key)) return false;
    if (gold < upg.price) return false;
    gold -= upg.price;
    ownedUpgrades.add(key);
    upg.owned = true;
    return true;
  }

  function equipItem(key) {
    if (!ownedUpgrades.has(key)) return false;
    const upg = UPGRADES[key];
    if (upg.isBackpack) equipped.pack = key;
    else if (upg.isLantern) equipped.lantern = key;
    else if (upg.isGloves) equipped.gloves = key;
    else equipped.rope = key; // rope
    return true;
  }

  function addGold(amount) { gold += amount; }
  function getGold() { return gold; }

  function die() {
    dead = true;
    Entities.spawnFallEffect(x, y);
  }

  function reset(startX, startY) {
    x = startX;
    y = startY;
    vx = 0;
    vy = -2; // start moving up slightly
    stamina = maxStamina;
    gripping = false;
    onGrip = null;
    dead = false;
    swingDir = 0;
    holding = false;
    jumpQueued = false;
    touches = {};
    initRope(x, y);
  }

  function getState() {
    return { x, y, vx, vy, stamina, maxStamina, gripping, gold, dead,
             highAlt, equipped, ownedUpgrades };
  }

  function getSaveData() {
    return { gold, highAlt, equipped: {...equipped}, ownedUpgrades: [...ownedUpgrades] };
  }

  function loadSaveData(data) {
    if (!data) return;
    gold = data.gold || 0;
    highAlt = data.highAlt || 0;
    if (data.equipped) equipped = {...data.equipped};
    if (data.ownedUpgrades) {
      ownedUpgrades = new Set(data.ownedUpgrades);
      Object.keys(UPGRADES).forEach(k => {
        UPGRADES[k].owned = ownedUpgrades.has(k);
      });
    }
  }

  return {
    update, draw, reset, die, getState, buyUpgrade, equipItem, addGold, getGold,
    getSaveData, loadSaveData, onTouchStart, onTouchEnd, onTouchMove, onKeyDown, onKeyUp,
    UPGRADES
  };
})();
