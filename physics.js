// physics.js - Rope physics, player physics, collision detection

const Physics = {
  GRAVITY: 0.45,
  ROPE_SEGMENTS: 18,
  ROPE_STIFFNESS: 0.85,
  ROPE_DAMPING: 0.98,
  SEGMENT_LENGTH: 22,

  createRope(x, y) {
    const segments = [];
    for (let i = 0; i < this.ROPE_SEGMENTS; i++) {
      segments.push({
        x: x,
        y: y + i * this.SEGMENT_LENGTH,
        px: x,
        py: y + i * this.SEGMENT_LENGTH,
        vx: 0,
        vy: 0,
        pinned: false
      });
    }
    return {
      segments,
      hook: { x, y, stuck: false, stuckBlock: null, vx: 0, vy: 0, thrown: false },
      extended: false,
      throwing: false,
      throwAngle: 0,
      throwPower: 0
    };
  },

  updateRope(rope, player, world, dt) {
    if (!rope.extended && !rope.throwing) return;

    const hook = rope.hook;

    if (rope.throwing && !hook.stuck) {
      hook.x += hook.vx;
      hook.y += hook.vy;
      hook.vy += this.GRAVITY * 0.7;
      hook.vx *= 0.99;

      // Check hook collision with world blocks
      const blockX = Math.floor(hook.x / world.BLOCK_SIZE);
      const blockY = Math.floor(hook.y / world.BLOCK_SIZE);
      const block = world.getBlock(blockX, blockY);

      if (block && block.solid && block.type !== 'air') {
        hook.stuck = true;
        hook.stuckBlock = { bx: blockX, by: blockY };
        rope.throwing = false;
        rope.extended = true;
        // Position segments
        for (let i = 0; i < rope.segments.length; i++) {
          const t = i / (rope.segments.length - 1);
          rope.segments[i].x = player.x + (hook.x - player.x) * t;
          rope.segments[i].y = player.y + (hook.y - player.y) * t;
          rope.segments[i].px = rope.segments[i].x;
          rope.segments[i].py = rope.segments[i].y;
        }
      }

      // Out of range
      const dx = hook.x - player.x;
      const dy = hook.y - player.y;
      if (Math.sqrt(dx*dx + dy*dy) > this.ROPE_SEGMENTS * this.SEGMENT_LENGTH * 1.1) {
        rope.throwing = false;
        rope.extended = false;
        hook.stuck = false;
      }
    }

    if (rope.extended && hook.stuck) {
      // Verlet integration for rope segments
      const segs = rope.segments;
      segs[0].x = player.x;
      segs[0].y = player.y;
      segs[segs.length - 1].x = hook.x;
      segs[segs.length - 1].y = hook.y;

      for (let i = 1; i < segs.length - 1; i++) {
        const s = segs[i];
        const vx = (s.x - s.px) * this.ROPE_DAMPING;
        const vy = (s.y - s.py) * this.ROPE_DAMPING;
        s.px = s.x;
        s.py = s.y;
        s.x += vx;
        s.y += vy + this.GRAVITY * 0.3;
      }

      // Constraint passes
      for (let pass = 0; pass < 5; pass++) {
        for (let i = 0; i < segs.length - 1; i++) {
          const a = segs[i];
          const b = segs[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const diff = (dist - this.SEGMENT_LENGTH) / dist * 0.5;
          if (i !== 0) {
            a.x += dx * diff;
            a.y += dy * diff;
          }
          if (i !== segs.length - 2) {
            b.x -= dx * diff;
            b.y -= dy * diff;
          }
        }
      }

      // Pull player toward hook if swinging
      if (player.onRope) {
        const dx = hook.x - player.x;
        const dy = hook.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxLen = this.ROPE_SEGMENTS * this.SEGMENT_LENGTH;
        if (dist > maxLen) {
          const nx = dx / dist;
          const ny = dy / dist;
          player.x = hook.x - nx * maxLen;
          player.y = hook.y - ny * maxLen;
          // Reflect velocity perpendicular to rope
          const dot = player.vx * nx + player.vy * ny;
          player.vx -= dot * nx * 1.1;
          player.vy -= dot * ny * 1.1;
        }
      }
    }
  },

  updatePlayer(player, world, input, rope) {
    const BLOCK = world.BLOCK_SIZE;

    // Apply input forces
    if (!player.onRope) {
      if (input.left) player.vx -= 0.6;
      if (input.right) player.vx += 0.6;
      player.vx *= 0.82; // ground friction
    } else {
      // Swing physics
      if (input.left) player.vx -= 0.35;
      if (input.right) player.vx += 0.35;
      player.vx *= 0.97;
    }

    // Gravity
    player.vy += this.GRAVITY;

    // Rope tension - prevent going past hook distance
    if (player.onRope && rope.hook.stuck) {
      const dx = rope.hook.x - player.x;
      const dy = rope.hook.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxLen = this.ROPE_SEGMENTS * this.SEGMENT_LENGTH;
      if (dist >= maxLen - 1) {
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        const dot = player.vx * nx + player.vy * ny;
        if (dot < 0) {
          player.vx -= dot * nx;
          player.vy -= dot * ny;
        }
      }
    }

    // Clamp velocity
    player.vx = Math.max(-12, Math.min(12, player.vx));
    player.vy = Math.max(-20, Math.min(20, player.vy));

    // Move and collide
    player.x += player.vx;
    this.resolvePlayerCollision(player, world, 'x');
    player.y += player.vy;
    player.grounded = false;
    this.resolvePlayerCollision(player, world, 'y');

    // Jump
    if (input.jump && player.grounded) {
      player.vy = -11;
      player.grounded = false;
    }

    // Clamp to world bounds
    player.x = Math.max(BLOCK, player.x);
  },

  resolvePlayerCollision(player, world, axis) {
    const BLOCK = world.BLOCK_SIZE;
    const W = player.w;
    const H = player.h;

    const x0 = Math.floor((player.x - W / 2) / BLOCK);
    const x1 = Math.floor((player.x + W / 2 - 1) / BLOCK);
    const y0 = Math.floor((player.y - H) / BLOCK);
    const y1 = Math.floor((player.y - 1) / BLOCK);

    for (let bx = x0; bx <= x1; bx++) {
      for (let by = y0; by <= y1; by++) {
        const block = world.getBlock(bx, by);
        if (!block || !block.solid) continue;

        const blockLeft = bx * BLOCK;
        const blockRight = blockLeft + BLOCK;
        const blockTop = by * BLOCK;
        const blockBottom = blockTop + BLOCK;

        const playerLeft = player.x - W / 2;
        const playerRight = player.x + W / 2;
        const playerTop = player.y - H;
        const playerBottom = player.y;

        const overlapX = Math.min(playerRight, blockRight) - Math.max(playerLeft, blockLeft);
        const overlapY = Math.min(playerBottom, blockBottom) - Math.max(playerTop, blockTop);

        if (overlapX > 0 && overlapY > 0) {
          if (axis === 'x') {
            if (player.x < blockLeft + BLOCK / 2) {
              player.x = blockLeft - W / 2;
            } else {
              player.x = blockRight + W / 2;
            }
            player.vx = 0;
          } else {
            if (player.y < blockTop + BLOCK / 2) {
              player.y = blockTop;
              player.vy = 0;
            } else {
              player.y = blockBottom + H;
              if (player.vy > 0) player.vy = 0;
              player.grounded = true;
            }
          }
        }
      }
    }
  },

  throwRope(rope, player, angle, power) {
    rope.throwing = true;
    rope.extended = false;
    rope.hook.stuck = false;
    rope.hook.stuckBlock = null;
    rope.hook.x = player.x;
    rope.hook.y = player.y;
    const spd = 14 + power * 8;
    rope.hook.vx = Math.cos(angle) * spd;
    rope.hook.vy = Math.sin(angle) * spd;
  },

  retractRope(rope) {
    rope.extended = false;
    rope.throwing = false;
    rope.hook.stuck = false;
    rope.hook.stuckBlock = null;
  }
};

window.Physics = Physics;
