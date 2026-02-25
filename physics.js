// physics.js — Rope physics, player movement, wind simulation

const Physics = (() => {
  const GRAVITY = 0.38;
  const ROPE_SEGMENTS = 18;
  const SEGMENT_LENGTH = 18;
  const ROPE_STIFFNESS = 0.85;
  const DAMPING = 0.97;
  const FRICTION = 0.75;

  // Wind state
  let windX = 0, windTarget = 0, windTimer = 0;
  let gustIntensity = 0;

  // ─── POINT ───────────────────────────────────────
  function makePoint(x, y, pinned = false) {
    return { x, y, px: x, py: y, pinned, vx: 0, vy: 0 };
  }

  // ─── ROPE ─────────────────────────────────────────
  function createRope(x, y) {
    const pts = [];
    for (let i = 0; i < ROPE_SEGMENTS; i++) {
      pts.push(makePoint(x, y + i * SEGMENT_LENGTH));
    }
    return {
      points: pts,
      anchored: false,
      anchorX: 0, anchorY: 0,
      thrown: false,
      throwVX: 0, throwVY: 0,
      hookX: x, hookY: y,
      hookVX: 0, hookVY: 0,
      grabbing: false,
      swinging: false,
      retracted: true,
      length: ROPE_SEGMENTS * SEGMENT_LENGTH,
    };
  }

  // ─── THROW ROPE ───────────────────────────────────
  function throwRope(rope, fromX, fromY, angle, power) {
    rope.thrown = true;
    rope.anchored = false;
    rope.retracted = false;
    rope.swinging = false;
    rope.hookX = fromX;
    rope.hookY = fromY;
    const speed = 12 + power * 14;
    rope.hookVX = Math.cos(angle) * speed;
    rope.hookVY = Math.sin(angle) * speed;
    // Reset all points to player position
    rope.points.forEach(p => {
      p.x = fromX; p.y = fromY;
      p.px = fromX; p.py = fromY;
      p.pinned = false;
    });
  }

  // ─── UPDATE ROPE ──────────────────────────────────
  function updateRope(rope, playerX, playerY, world) {
    if (rope.retracted) return;

    const wind = windX;

    if (rope.thrown && !rope.anchored) {
      // Move flying hook
      rope.hookVY += GRAVITY * 0.5;
      rope.hookVX += wind * 0.02;
      rope.hookX += rope.hookVX;
      rope.hookY += rope.hookVY;

      // Check anchor collision
      const hit = world.checkRopeAnchor(rope.hookX, rope.hookY);
      if (hit) {
        rope.anchored = true;
        rope.thrown = false;
        rope.swinging = true;
        rope.anchorX = hit.x;
        rope.anchorY = hit.y;
        rope.points[0].x = hit.x;
        rope.points[0].y = hit.y;
        rope.points[0].pinned = true;
      }

      // Missed — retract after going too far
      const dx = rope.hookX - playerX;
      const dy = rope.hookY - playerY;
      if (Math.sqrt(dx * dx + dy * dy) > rope.length * 1.6 || rope.hookY > playerY + rope.length * 2) {
        rope.retracted = true;
        rope.thrown = false;
      }

      // Update visual points along throw trajectory
      const last = rope.points.length - 1;
      rope.points[last].x = playerX;
      rope.points[last].y = playerY;
      rope.points[last].pinned = true;
      rope.points[0].x = rope.hookX;
      rope.points[0].y = rope.hookY;
      return;
    }

    if (rope.anchored) {
      rope.points[0].pinned = true;
      rope.points[0].x = rope.anchorX;
      rope.points[0].y = rope.anchorY;
      rope.points[rope.points.length - 1].pinned = true;
      rope.points[rope.points.length - 1].x = playerX;
      rope.points[rope.points.length - 1].y = playerY;
    }

    // Verlet integration
    for (let i = 0; i < rope.points.length; i++) {
      const p = rope.points[i];
      if (p.pinned) continue;
      const vx = (p.x - p.px) * DAMPING + wind * 0.015;
      const vy = (p.y - p.py) * DAMPING;
      p.px = p.x; p.py = p.y;
      p.x += vx;
      p.y += vy + GRAVITY * 0.4;
    }

    // Constrain segments
    for (let iter = 0; iter < 6; iter++) {
      for (let i = 0; i < rope.points.length - 1; i++) {
        const a = rope.points[i], b = rope.points[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const diff = (dist - SEGMENT_LENGTH) / dist * 0.5 * ROPE_STIFFNESS;
        if (!a.pinned) { a.x += dx * diff; a.y += dy * diff; }
        if (!b.pinned) { b.x -= dx * diff; b.y -= dy * diff; }
      }
    }
  }

  // ─── PLAYER PHYSICS ───────────────────────────────
  function createPlayer(x, y) {
    return {
      x, y,
      vx: 0, vy: 0,
      onGround: false,
      facingRight: true,
      width: 20, height: 32,
      stamina: 100,
      maxStamina: 100,
      health: 100,
      dead: false,
      swingAngle: 0,
      hangingOnRope: false,
      grounded: false,
      // animation
      animFrame: 0,
      animTimer: 0,
      state: 'idle', // idle, walk, fall, swing, climb
    };
  }

  function updatePlayer(player, rope, keys, world) {
    if (player.dead) return;

    const onRope = rope.anchored && !rope.retracted;
    const prevY = player.y;

    if (onRope) {
      player.state = 'swing';
      player.hangingOnRope = true;

      // Pendulum-like swing
      if (keys.left) { player.vx -= 0.4; }
      if (keys.right) { player.vx += 0.4; }
      if (keys.up) {
        // Climb up rope
        if (player.stamina > 0) {
          const dx = rope.anchorX - player.x;
          const dy = rope.anchorY - player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 20) {
            player.x += (dx / dist) * 2.5;
            player.y += (dy / dist) * 2.5;
          }
          player.stamina = Math.max(0, player.stamina - 0.4);
        }
      }

      player.vx += windX * 0.012;
      player.vx *= 0.94;
      player.vy += GRAVITY;
      player.vy *= 0.94;

      // Rope tension constraint
      const dx = player.x - rope.anchorX;
      const dy = player.y - rope.anchorY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = rope.length * 0.95;
      if (dist > maxDist) {
        const nx = dx / dist, ny = dy / dist;
        player.x = rope.anchorX + nx * maxDist;
        player.y = rope.anchorY + ny * maxDist;
        // Transfer velocity along tangent
        const dot = player.vx * nx + player.vy * ny;
        player.vx -= dot * nx * 1.1;
        player.vy -= dot * ny * 1.1;
      }
    } else {
      player.hangingOnRope = false;
      // Normal movement
      if (!player.onGround) {
        if (keys.left) { player.vx -= 0.3; player.facingRight = false; }
        if (keys.right) { player.vx += 0.3; player.facingRight = true; }
      } else {
        if (keys.left) { player.vx -= 0.8; player.facingRight = false; player.state = 'walk'; }
        else if (keys.right) { player.vx += 0.8; player.facingRight = true; player.state = 'walk'; }
        else { player.state = 'idle'; }
      }

      player.vx *= 0.82;
      player.vy += GRAVITY;
      player.vx += windX * 0.008;
    }

    // Clamp speed
    player.vx = Math.max(-9, Math.min(9, player.vx));
    player.vy = Math.max(-20, Math.min(22, player.vy));

    // Move and collide
    player.x += player.vx;
    player.y += player.vy;
    player.onGround = false;

    const col = world.collide(player);
    if (col.bottom) {
      player.y = col.bottom;
      if (player.vy > 14) {
        // Fall damage
        player.health -= (player.vy - 14) * 8;
        if (player.health <= 0) player.dead = true;
      }
      player.vy = 0;
      player.onGround = true;
      if (!onRope) player.state = Math.abs(player.vx) > 0.5 ? 'walk' : 'idle';
    }
    if (col.top) { player.y = col.top + player.height; player.vy = Math.abs(player.vy) * 0.2; }
    if (col.left) { player.x = col.left + player.width / 2; player.vx = Math.abs(player.vx) * 0.3; }
    if (col.right) { player.x = col.right - player.width / 2; player.vx = -Math.abs(player.vx) * 0.3; }

    if (!player.onGround && !onRope) player.state = player.vy > 0 ? 'fall' : 'jump';

    // Stamina regen
    if (!keys.up) player.stamina = Math.min(player.maxStamina, player.stamina + 0.2);

    // Animation
    player.animTimer++;
    if (player.animTimer > 8) { player.animFrame = (player.animFrame + 1) % 4; player.animTimer = 0; }

    if (player.health < 0) player.dead = true;
  }

  // ─── WIND ─────────────────────────────────────────
  function updateWind(dt) {
    windTimer += dt;
    if (windTimer > 180 + Math.random() * 240) {
      windTarget = (Math.random() - 0.5) * 3.5;
      gustIntensity = Math.random();
      windTimer = 0;
    }
    windX += (windTarget - windX) * 0.012;
    // Random gusts
    if (Math.random() < 0.003) {
      windX += (Math.random() - 0.5) * gustIntensity * 2;
    }
  }

  function getWind() { return windX; }

  // ─── JUMP ─────────────────────────────────────────
  function jump(player) {
    if (player.onGround) {
      player.vy = -9.5;
      player.onGround = false;
      player.state = 'jump';
    }
  }

  // ─── RETRACT ROPE ─────────────────────────────────
  function retractRope(rope) {
    rope.retracted = true;
    rope.anchored = false;
    rope.thrown = false;
    rope.swinging = false;
    rope.points.forEach(p => { p.pinned = false; });
  }

  return {
    createRope, throwRope, updateRope, retractRope,
    createPlayer, updatePlayer,
    updateWind, getWind,
    jump,
    ROPE_SEGMENTS, SEGMENT_LENGTH,
  };
})();
