// entities.js - Player, NPC, items, camp system

const Entities = {
  createPlayer(x, y) {
    return {
      x, y,
      vx: 0, vy: 0,
      w: 22, h: 34,
      grounded: false,
      onRope: false,
      facing: 1,
      animFrame: 0,
      animTimer: 0,
      state: 'idle', // idle, walk, swing, climb, fall
      inventory: [],
      gold: 0,
      upgrades: {
        ropeLength: 1,    // multiplier
        ropePower: 1,
        gripBoots: false,
        windCape: false,
        doubleThrow: false,
        grappleGlove: false,
      },
      accessories: {
        hat: null,
        cape: null,
        charm: null,
      },
      health: 100,
      maxHealth: 100,
      stamina: 100,
      maxStamina: 100,
      highestAlt: 0,   // tiles
      totalGoldEarned: 0,
      nearCamp: false,
      inCamp: false,
    };
  },

  updatePlayer(player, dt) {
    player.animTimer += dt;
    if (player.animTimer > 8) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % 4;
    }

    // State
    if (player.inCamp) {
      player.state = 'idle';
    } else if (player.onRope) {
      player.state = 'swing';
    } else if (!player.grounded) {
      player.state = 'fall';
    } else if (Math.abs(player.vx) > 0.5) {
      player.state = 'walk';
    } else {
      player.state = 'idle';
    }

    // Stamina recovery when grounded
    if (player.grounded && player.stamina < player.maxStamina) {
      player.stamina = Math.min(player.maxStamina, player.stamina + 0.3);
    }
  },

  drawPlayer(ctx, player, camX, camY, time) {
    const px = player.x - camX;
    const py = player.y - camY;
    const f = player.facing;
    const frame = player.animFrame;

    ctx.save();
    ctx.translate(px, py);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body sway
    const sway = player.state === 'walk' ? Math.sin(time * 0.2) * 1.5 : 0;
    const swingLean = player.state === 'swing' ? Math.atan2(player.vy, player.vx) * 0.3 : 0;
    ctx.rotate(swingLean + sway * 0.02);

    // Legs
    const legOff = player.state === 'walk' ? Math.sin(time * 0.2) * 7 : 0;
    ctx.fillStyle = '#3a3a5c';
    // Left leg
    ctx.fillRect(-8 * f - 5, -12 + legOff, 8, 13);
    // Right leg
    ctx.fillRect(0 * f - 3, -12 - legOff, 8, 13);
    // Boots
    ctx.fillStyle = player.upgrades.gripBoots ? '#c88844' : '#2a2a3c';
    ctx.fillRect(-10 * f - 3, -2, 10, 5);
    ctx.fillRect(-1 * f - 1, -2, 10, 5);

    // Body - jacket
    ctx.fillStyle = '#4a5a7a';
    ctx.fillRect(-11, -28, 22, 17);

    // Jacket highlight
    ctx.fillStyle = '#5a6a8a';
    ctx.fillRect(-9, -27, 8, 14);

    // Belt
    ctx.fillStyle = '#8a6030';
    ctx.fillRect(-11, -14, 22, 3);
    ctx.fillStyle = '#c4a060';
    ctx.fillRect(-3, -14, 6, 3);

    // Cape (if equipped)
    if (player.accessories.cape || player.upgrades.windCape) {
      const capeWave = Math.sin(time * 0.1) * 4;
      ctx.fillStyle = '#7a3a8a';
      ctx.beginPath();
      ctx.moveTo(-f * 9, -26);
      ctx.lineTo(-f * 9, -12);
      ctx.lineTo(-f * 20 + capeWave * f, -8);
      ctx.lineTo(-f * 22 + capeWave * f, -26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#9a5aaa';
      ctx.fillRect(-f * 10, -28, f * 2, 18);
    }

    // Arms
    const armSwing = player.state === 'swing' ? -0.8 : (player.state === 'walk' ? Math.sin(time * 0.2) * 0.3 : 0);
    ctx.fillStyle = '#4a5a7a';
    // Left arm
    ctx.save();
    ctx.translate(-11, -24);
    ctx.rotate(-armSwing);
    ctx.fillRect(-4, 0, 7, 16);
    ctx.fillStyle = '#c4846a';
    ctx.fillRect(-3, 12, 6, 7);
    ctx.restore();
    // Right arm
    ctx.save();
    ctx.translate(11, -24);
    ctx.rotate(armSwing);
    ctx.fillRect(-3, 0, 7, 16);
    ctx.fillStyle = '#c4846a';
    ctx.fillRect(-2, 12, 6, 7);
    ctx.restore();

    // Glove highlight
    if (player.upgrades.grappleGlove) {
      ctx.fillStyle = '#ff8844';
      ctx.fillRect(9, -14, 6, 7);
    }

    // Head
    ctx.fillStyle = '#c4846a';
    ctx.fillRect(-9, -42, 18, 16);
    // Hair
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(-10, -43, 20, 6);
    ctx.fillRect(-10, -43, 5, 10);

    // Eyes
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(2 * f, -38, 4, 4);
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.fillRect(3 * f, -38, 2, 2);

    // Hat (if equipped)
    if (player.accessories.hat === 'explorer') {
      ctx.fillStyle = '#8a6040';
      ctx.fillRect(-13, -49, 26, 7);
      ctx.fillRect(-9, -55, 18, 7);
      ctx.fillStyle = '#6a4020';
      ctx.fillRect(-10, -50, 20, 2);
    } else if (player.accessories.hat === 'winter') {
      ctx.fillStyle = '#e8e8f0';
      ctx.fillRect(-10, -50, 20, 10);
      ctx.fillStyle = '#c44444';
      ctx.fillRect(-11, -44, 22, 4);
      ctx.fillRect(-11, -50, 22, 4);
    }

    // Rope throw animation
    if (player.state === 'swing') {
      ctx.strokeStyle = '#d4a060';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(11, -18);
      ctx.lineTo(11 + f * 15, -30);
      ctx.stroke();
    }

    ctx.restore();
  },

  drawRope(ctx, rope, player, camX, camY, time) {
    if (!rope.extended && !rope.throwing) return;

    const segs = rope.segments;
    const hook = rope.hook;

    // Draw rope segments
    if (rope.extended && hook.stuck && segs.length > 1) {
      // Rope with texture
      for (let i = 0; i < segs.length - 1; i++) {
        const a = segs[i];
        const b = segs[i + 1];
        const ax = a.x - camX, ay = a.y - camY;
        const bx = b.x - camX, by = b.y - camY;

        // Shadow rope
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ax + 1, ay + 1);
        ctx.lineTo(bx + 1, by + 1);
        ctx.stroke();

        // Main rope - braided look
        const t = i / segs.length;
        const r = Math.floor(200 - t * 40);
        const g = Math.floor(160 - t * 30);
        ctx.strokeStyle = `rgb(${r},${g},80)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();

        // Highlight
        ctx.strokeStyle = `rgba(255,220,120,0.3)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax - 0.5, ay - 0.5);
        ctx.lineTo(bx - 0.5, by - 0.5);
        ctx.stroke();
      }
    }

    // Throwing rope - straight line
    if (rope.throwing) {
      const hx = hook.x - camX;
      const hy = hook.y - camY;
      const px = player.x - camX;
      const py = player.y - camY;

      ctx.strokeStyle = 'rgba(200,160,80,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(px, py - 10);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Hook
    const hx = hook.x - camX;
    const hy = hook.y - camY;
    if (rope.throwing || (rope.extended && hook.stuck)) {
      // Hook glow when stuck
      if (hook.stuck) {
        ctx.fillStyle = 'rgba(255,200,80,0.3)';
        ctx.beginPath();
        ctx.arc(hx, hy, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hook shape
      ctx.fillStyle = '#e0c070';
      ctx.strokeStyle = '#a07030';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f0d080';
      ctx.beginPath();
      ctx.moveTo(hx, hy - 5);
      ctx.lineTo(hx + 4, hy + 3);
      ctx.lineTo(hx - 4, hy + 3);
      ctx.fill();
    }
  },

  // Floating item sparkle
  drawnItems: new Map(),

  drawItem(ctx, item, x, y, camX, camY, time) {
    const sx = x - camX;
    const sy = y - camY - Math.sin(time * 0.05 + item.id * 100) * 4;

    // Glow
    const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 18);
    grd.addColorStop(0, item.color + 'aa');
    grd.addColorStop(1, item.color + '00');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(sx, sy, 18, 0, Math.PI * 2);
    ctx.fill();

    // Item crystal shape
    ctx.fillStyle = item.color;
    ctx.strokeStyle = '#fff8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 9);
    ctx.lineTo(sx + 7, sy - 2);
    ctx.lineTo(sx + 5, sy + 7);
    ctx.lineTo(sx - 5, sy + 7);
    ctx.lineTo(sx - 7, sy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Shine
    ctx.fillStyle = '#fff6';
    ctx.beginPath();
    ctx.moveTo(sx - 1, sy - 8);
    ctx.lineTo(sx + 3, sy - 3);
    ctx.lineTo(sx - 1, sy - 1);
    ctx.closePath();
    ctx.fill();

    // Sparkles
    for (let i = 0; i < 3; i++) {
      const angle = time * 0.08 + i * 2.1 + item.id * 5;
      const r = 14 + Math.sin(time * 0.1 + i) * 3;
      const sx2 = sx + Math.cos(angle) * r;
      const sy2 = sy + Math.sin(angle) * r;
      ctx.fillStyle = item.color + 'cc';
      ctx.fillRect(sx2 - 1.5, sy2 - 1.5, 3, 3);
    }
  },

  // Camp NPC
  createNPC() {
    return {
      name: 'Mirna',
      mood: 'cheerful',
      dialogIndex: 0,
    };
  },

  NPC_DIALOG: [
    ["Ah, another climber! I've set up shop here on the ledge.", "Rest your arms and sell what you've found."],
    ["The mountain gets steeper up there...", "Frost crystals are worth good coin if you find 'em."],
    ["I heard a climber made it to the peak once.", "Left only a faded rope behind. Spooky stuff."],
    ["Need better gear? I've got stock.", "The Grip Boots helped me a lot, back when I climbed."],
    ["Storm's brewing above. Watch your step on ice.", "It'll throw your rope off if you're not careful."],
    ["You know what I miss? A campfire.", "Maybe one day you'll bring me some Emberstone."],
    ["Strange things live in those caves...", "Crystal critters that glow in the dark. Don't get too close."],
  ],

  SHOP_ITEMS: [
    { id: 'ropeLength', name: 'Longer Rope', desc: 'Rope reaches 25% further', cost: 120, type: 'upgrade', maxLevel: 3 },
    { id: 'ropePower', name: 'Throw Power', desc: 'Launch rope with more force', cost: 90, type: 'upgrade', maxLevel: 3 },
    { id: 'gripBoots', name: 'Grip Boots', desc: 'Stick to surfaces briefly', cost: 200, type: 'upgrade', maxLevel: 1 },
    { id: 'windCape', name: 'Wind Cape', desc: 'Glide slightly when falling', cost: 250, type: 'upgrade', maxLevel: 1 },
    { id: 'grappleGlove', name: 'Grapple Glove', desc: 'Throw rope 40% faster', cost: 180, type: 'upgrade', maxLevel: 1 },
    { id: 'doubleThrow', name: 'Twin Hook', desc: 'Throw a second rope', cost: 350, type: 'upgrade', maxLevel: 1 },
    { id: 'hat_explorer', name: "Explorer's Hat", desc: 'A rugged wide-brimmed hat', cost: 80, type: 'accessory', slot: 'hat', val: 'explorer' },
    { id: 'hat_winter', name: 'Winter Cap', desc: 'Cozy knit cap with stripe', cost: 60, type: 'accessory', slot: 'hat', val: 'winter' },
    { id: 'cape_red', name: 'Crimson Cape', desc: 'Dashing red climbing cape', cost: 110, type: 'accessory', slot: 'cape', val: 'red' },
  ],
};

window.Entities = Entities;
