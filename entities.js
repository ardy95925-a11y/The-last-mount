// entities.js — Particles, effects, collectible info, hazard logic

const Entities = (() => {
  // ── Collectible definitions ────────────────────────────────────────
  const COLLECTIBLES = {
    crystal: {
      name: 'Sky Crystal',
      emoji: '💎',
      desc: 'Frozen light from above the clouds.',
      baseValue: 15,
      rarity: 'common',
      loreIdx: 0
    },
    fossil: {
      name: 'Stone Memory',
      emoji: '🦴',
      desc: 'Something lived here before the mountain grew.',
      baseValue: 25,
      rarity: 'uncommon',
      loreIdx: 1
    },
    herb: {
      name: 'Veil Moss',
      emoji: '🌿',
      desc: 'Smells like warmth. Tastes like forgetting.',
      baseValue: 10,
      rarity: 'common',
      loreIdx: -1
    },
    gem: {
      name: 'Heartstone',
      emoji: '💠',
      desc: 'It pulses faintly. You feel less alone.',
      baseValue: 40,
      rarity: 'rare',
      loreIdx: 2
    },
    relic: {
      name: 'Ancient Cog',
      emoji: '⚙️',
      desc: 'From a civilization that tried to reach the summit by machine.',
      baseValue: 60,
      rarity: 'rare',
      loreIdx: 3
    },
  };

  // ── Particle system ────────────────────────────────────────────────
  let particles = [];

  function spawnParticles(x, y, config) {
    const count = config.count || 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = (config.speed || 2) * (0.5 + Math.random());
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (config.upBias || 1),
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        r: config.r || (2 + Math.random() * 3),
        color: config.colors ? config.colors[Math.floor(Math.random() * config.colors.length)] : '#ffffff',
        gravity: config.gravity || 0.05,
        type: config.type || 'dot'
      });
    }
  }

  function spawnCollectEffect(x, y, type) {
    const info = COLLECTIBLES[type] || COLLECTIBLES.crystal;
    const colorMap = {
      crystal: ['#80c8ff', '#c0e8ff', '#ffffff'],
      fossil: ['#c8a870', '#e0c890', '#f0e0b0'],
      herb: ['#60c060', '#a0e0a0', '#c0f0c0'],
      gem: ['#ff80c0', '#ffb0e0', '#ffffff'],
      relic: ['#ffd060', '#fff0a0', '#ffffff'],
    };

    spawnParticles(x, y, {
      count: 12,
      speed: 3,
      r: 3,
      upBias: 2,
      colors: colorMap[type] || ['#ffffff'],
      gravity: 0.08,
      type: 'dot'
    });

    // Text popup
    particles.push({
      x, y,
      vx: 0,
      vy: -1,
      life: 1,
      decay: 0.008,
      r: 0,
      color: '#ffd060',
      text: `+${info.baseValue} 🪙`,
      type: 'text',
      fontSize: 11,
      gravity: 0
    });
  }

  function spawnRopeSwingEffect(x, y) {
    spawnParticles(x, y, {
      count: 4,
      speed: 1.5,
      r: 2,
      colors: ['rgba(255,255,255,0.6)', 'rgba(200,180,255,0.4)'],
      gravity: 0.03,
      upBias: 0.5
    });
  }

  function spawnGripEffect(x, y, type) {
    const colors = type === 'ice'
      ? ['#a0d8ef', '#c0e8ff', '#ffffff']
      : ['#6a5a80', '#8a7aa0', '#a090c0'];

    spawnParticles(x, y, {
      count: 8,
      speed: 2,
      r: 2.5,
      upBias: 1.5,
      colors,
      gravity: 0.1
    });
  }

  function spawnFallEffect(x, y) {
    spawnParticles(x, y, {
      count: 16,
      speed: 4,
      r: 4,
      colors: ['#ff4040', '#ff8040', '#ffc040'],
      upBias: 3,
      gravity: 0.15
    });
  }

  function spawnLanternFlicker(x, y) {
    if (Math.random() > 0.7) {
      spawnParticles(x, y, {
        count: 2,
        speed: 1,
        r: 1.5,
        colors: ['rgba(255,200,80,0.8)', 'rgba(255,160,40,0.6)'],
        upBias: 1.5,
        gravity: -0.02
      });
    }
  }

  function updateParticles(dt) {
    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0;
      p.vx *= 0.97;
      p.life -= p.decay;
      return p.life > 0;
    });
  }

  function drawParticles(ctx, W, H, scrollY) {
    particles.forEach(p => {
      const sy = H - (p.y - scrollY);
      if (sy < -20 || sy > H + 20) return;

      if (p.type === 'text') {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.fontSize || 10}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, sy);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = p.life * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, sy, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
  }

  // ── Rope trail ─────────────────────────────────────────────────────
  let ropeTrail = [];

  function addRopeTrail(x, y) {
    ropeTrail.push({ x, y, life: 1 });
    if (ropeTrail.length > 20) ropeTrail.shift();
  }

  function updateRopeTrail() {
    ropeTrail.forEach(p => p.life -= 0.05);
    ropeTrail = ropeTrail.filter(p => p.life > 0);
  }

  // ── Collectible inventory ──────────────────────────────────────────
  let inventory = {};

  function addToInventory(type, count = 1) {
    if (!inventory[type]) inventory[type] = 0;
    inventory[type] += count;
  }

  function getInventory() { return { ...inventory }; }
  function clearInventory() { inventory = {}; }

  function getCollectibleInfo(type) {
    return COLLECTIBLES[type] || null;
  }

  function getAllCollectibles() { return COLLECTIBLES; }

  function calcInventoryValue() {
    let total = 0;
    Object.entries(inventory).forEach(([type, count]) => {
      const info = COLLECTIBLES[type];
      if (info) total += info.baseValue * count;
    });
    return total;
  }

  // ── Hazard collision check ─────────────────────────────────────────
  function checkHazards(playerX, playerY, chunks) {
    const ci = Math.floor(playerY / World.CHUNK_H);
    for (let i = ci - 1; i <= ci + 1; i++) {
      if (!chunks[i]) continue;
      chunks[i].hazards.forEach(h => {
        if (!h.active) return;
        const dx = playerX - h.x;
        const dy = playerY - h.y;
        if (Math.sqrt(dx * dx + dy * dy) < 20) {
          return true;
        }
      });
    }
    return false;
  }

  function clearParticles() {
    particles = [];
    ropeTrail = [];
  }

  return {
    spawnCollectEffect,
    spawnRopeSwingEffect,
    spawnGripEffect,
    spawnFallEffect,
    spawnLanternFlicker,
    updateParticles,
    drawParticles,
    addRopeTrail,
    updateRopeTrail,
    addToInventory,
    getInventory,
    clearInventory,
    getCollectibleInfo,
    getAllCollectibles,
    calcInventoryValue,
    checkHazards,
    clearParticles,
    COLLECTIBLES
  };
})();
