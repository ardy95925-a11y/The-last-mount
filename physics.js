// physics.js — Verlet rope, smooth player physics, wind, terrain collision

const Physics = {
  GRAVITY: 0.5,
  WIND_STRENGTH: 0,
  windTarget: 0,
  windCurrent: 0,
  windTimer: 0,

  // --- Rope ---
  createRope(x, y, segments) {
    segments = segments || 20;
    const len = 26;
    const pts = [];
    for (let i = 0; i < segments; i++) {
      pts.push({ x, y: y + i * len, ox: x, oy: y + i * len, pinStart: i === 0, pinEnd: false });
    }
    return {
      pts,
      segLen: len,
      segments,
      hook: { x, y, vx: 0, vy: 0, stuck: false, stuckX: 0, stuckY: 0, stuckNormal: null },
      thrown: false,
      active: false,
      throwAngle: 0,
      throwPower: 0,
    };
  },

  updateWind() {
    this.windTimer++;
    if (this.windTimer > 180 + Math.random() * 240) {
      this.windTimer = 0;
      this.windTarget = (Math.random() - 0.5) * 0.8;
    }
    this.windCurrent += (this.windTarget - this.windCurrent) * 0.005;
  },

  throwRope(rope, player, angle, power) {
    const spd = 16 + power * 12;
    rope.thrown = true;
    rope.active = true;
    rope.hook.stuck = false;
    rope.hook.x = player.x;
    rope.hook.y = player.y - 10;
    rope.hook.vx = Math.cos(angle) * spd;
    rope.hook.vy = Math.sin(angle) * spd;
    // Reset rope along player
    for (let i = 0; i < rope.pts.length; i++) {
      rope.pts[i].x = player.x;
      rope.pts[i].y = player.y - 10;
      rope.pts[i].ox = rope.pts[i].x;
      rope.pts[i].oy = rope.pts[i].y;
    }
  },

  retractRope(rope) {
    rope.active = false;
    rope.thrown = false;
    rope.hook.stuck = false;
  },

  updateRope(rope, player) {
    if (!rope.active) return;
    const hook = rope.hook;

    // Update flying hook
    if (rope.thrown && !hook.stuck) {
      hook.x += hook.vx;
      hook.y += hook.vy;
      hook.vy += this.GRAVITY * 0.5;
      hook.vx += this.windCurrent * 0.3;
      hook.vx *= 0.995;

      // Terrain collision
      const terrY = World.getTerrainYSmooth(hook.x);
      if (hook.y >= terrY - 2) {
        // Stick to terrain
        hook.y = terrY - 2;
        hook.stuck = true;
        hook.stuckX = hook.x;
        hook.stuckY = hook.y;
        const slope = World.getTerrainSlope(hook.x);
        const len = Math.sqrt(1 + slope * slope);
        hook.stuckNormal = { x: -slope / len, y: -1 / len };
        rope.thrown = false;
        // Spread rope from player to hook
        for (let i = 0; i < rope.pts.length; i++) {
          const t = i / (rope.pts.length - 1);
          rope.pts[i].x = player.x + (hook.x - player.x) * t;
          rope.pts[i].y = (player.y - 10) + (hook.y - (player.y - 10)) * t;
          rope.pts[i].ox = rope.pts[i].x;
          rope.pts[i].oy = rope.pts[i].y;
        }
      }

      // Max range check
      const dx = hook.x - player.x, dy = hook.y - player.y;
      if (Math.sqrt(dx*dx + dy*dy) > rope.segLen * rope.pts.length * 1.1) {
        this.retractRope(rope);
        return;
      }
    }

    if (rope.active && hook.stuck) {
      const pts = rope.pts;
      // Pin first point to player hand
      pts[0].x = player.x;
      pts[0].y = player.y - 10;
      // Pin last point to hook
      pts[pts.length-1].x = hook.x;
      pts[pts.length-1].y = hook.y;

      // Verlet integration for middle points
      for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i];
        const vx = (p.x - p.ox) * 0.96 + this.windCurrent * 0.06;
        const vy = (p.y - p.oy) * 0.96;
        p.ox = p.x;
        p.oy = p.y;
        p.x += vx;
        p.y += vy + this.GRAVITY * 0.25;
      }

      // Distance constraints (multiple passes for stiffness)
      for (let pass = 0; pass < 6; pass++) {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i+1];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
          const diff = (dist - rope.segLen) / dist * 0.5;
          if (i > 0)             { a.x += dx * diff; a.y += dy * diff; }
          if (i < pts.length-2)  { b.x -= dx * diff; b.y -= dy * diff; }
        }
        // Re-pin
        pts[0].x = player.x; pts[0].y = player.y - 10;
        pts[pts.length-1].x = hook.x; pts[pts.length-1].y = hook.y;
      }
    }
  },

  // --- Player ---
  createPlayer(x, y) {
    return {
      x, y, vx: 0, vy: 0,
      w: 14, h: 32,
      grounded: false,
      onRope: false,
      ropeSwing: false,
      facing: 1,
      state: 'fall',    // starts falling from above terrain
      stateTime: 0,
      coyoteTime: 0,
      landImpact: 0,
      legPhase: 0,
      armPhase: 0,
      upgrades: { ropeLen: 1, throwPower: 1, gripBoots: false, windCape: false, doubleThrow: false, grappleGlove: false },
      accessories: { hat: null, cape: null },
      inventory: [],
      gold: 0,
      health: 100, maxHealth: 100,
      nearCamp: false,
      inCamp: false,
      trailX: 0, trailY: 0,
    };
  },

  updatePlayer(player, input, rope) {
    // State timer
    player.stateTime++;

    // Coyote time
    if (player.grounded) player.coyoteTime = 8;
    else if (player.coyoteTime > 0) player.coyoteTime--;

    // On rope determines swing physics vs ground
    player.onRope = rope.active && rope.hook.stuck;

    if (player.onRope) {
      // Swing physics: only horizontal push
      const pushForce = 0.28 + (player.upgrades.grappleGlove ? 0.1 : 0);
      if (input.moveX !== 0) player.vx += input.moveX * pushForce;
      player.vx *= 0.975;

      // Rope constraint — pendulum
      const hx = rope.hook.x, hy = rope.hook.y;
      const dx = player.x - hx, dy = player.y - hy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const maxLen = rope.segLen * rope.pts.length * 0.92;
      if (dist > maxLen && dist > 0.1) {
        const nx = dx / dist, ny = dy / dist;
        player.x = hx + nx * maxLen;
        player.y = hy + ny * maxLen;
        // Reflect velocity along rope perpendicular
        const dot = player.vx * nx + player.vy * ny;
        player.vx -= dot * nx * 1.05;
        player.vy -= dot * ny * 1.05;
      }

      // Wind cape: dampen fall when falling
      if (player.upgrades.windCape && player.vy > 0) {
        player.vy *= 0.93;
      }

    } else {
      // Ground movement
      const speed = 4.2;
      const accel = player.grounded ? 0.55 : 0.22;
      const decel = player.grounded ? 0.78 : 0.92;

      if (Math.abs(input.moveX) > 0.1) {
        player.vx += input.moveX * speed * accel;
        player.vx = Math.max(-speed * 1.8, Math.min(speed * 1.8, player.vx));
      } else {
        player.vx *= decel;
      }

      // Wind cape glide
      if (player.upgrades.windCape && !player.grounded && player.vy > 2) {
        player.vy *= 0.94;
      }
    }

    // Gravity
    player.vy += this.GRAVITY;
    player.vy = Math.min(player.vy, 22);

    // Facing
    if (player.vx > 0.3) player.facing = 1;
    if (player.vx < -0.3) player.facing = -1;

    // Move X
    player.x += player.vx;
    // Clamp left world boundary
    if (player.x < 100) { player.x = 100; player.vx = 0; }

    // Terrain collision X — push out of steep slopes
    const slopeAtX = World.getTerrainSlope(player.x);
    if (Math.abs(slopeAtX) > 1.2 && player.grounded) {
      player.x -= player.vx * 0.6;
      player.vx *= -0.2;
    }

    // Move Y
    player.y += player.vy;

    // Terrain collision Y — sample terrain once, use for both check and correction
    const terrY = World.getTerrainYSmooth(player.x);
    const playerFeet = player.y; // y is feet position

    if (playerFeet >= terrY) {
      if (player.vy > 8) player.landImpact = player.vy; else player.landImpact = 0;
      player.y = terrY;          // snap feet to surface
      player.vy = 0;
      // Slide along slope
      const slope = World.getTerrainSlope(player.x);
      player.vx += slope * 0.3;
      player.grounded = true;
    } else {
      player.grounded = false;
    }

    // Update state
    const prevState = player.state;
    if (player.onRope) {
      player.state = 'swing';
    } else if (!player.grounded) {
      player.state = 'fall';
    } else if (Math.abs(player.vx) > 0.8) {
      player.state = 'walk';
      player.legPhase += Math.abs(player.vx) * 0.08;
      player.armPhase += Math.abs(player.vx) * 0.08;
    } else {
      player.state = 'idle';
    }
    if (player.state !== prevState) player.stateTime = 0;
  },

  // Check if terrain solid at point (for hook lodging)
  isTerrainAt(x, y) {
    return y >= World.getTerrainYSmooth(x);
  }
};

window.Physics = Physics;
