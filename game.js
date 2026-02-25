// game.js — Player control, rope throwing, inventory, NPC/shop system

const Game = (() => {
  let player, rope;
  let keys = { left: false, right: false, up: false, jump: false };
  let gameState = 'playing'; // playing, camp, dead

  // Touch controls
  let touchLeft = false, touchRight = false, touchUp = false;

  // Rope aiming
  let aiming = false;
  let aimAngle = -Math.PI / 2;
  let aimPower = 0.5;
  let aimTouchId = null;
  let aimStartX = 0, aimStartY = 0;
  let throwCharging = false;
  let chargeStart = 0;

  // Inventory
  const ITEMS_META = {
    herb:          { name: 'Herb',          icon: '🌿', value: 8,   rarity: 'common' },
    mushroom:      { name: 'Mushroom',      icon: '🍄', value: 12,  rarity: 'common' },
    crystal_shard: { name: 'Crystal Shard', icon: '💎', value: 25,  rarity: 'uncommon' },
    old_coin:      { name: 'Old Coin',      icon: '🪙', value: 18,  rarity: 'uncommon' },
    rare_herb:     { name: 'Rare Herb',     icon: '🌺', value: 45,  rarity: 'rare' },
    fossil:        { name: 'Fossil',        icon: '🦴', value: 60,  rarity: 'rare' },
    gemstone:      { name: 'Gemstone',      icon: '💠', value: 90,  rarity: 'rare' },
    ice_crystal:   { name: 'Ice Crystal',   icon: '❄️', value: 110, rarity: 'rare' },
    ancient_relic: { name: 'Ancient Relic', icon: '🏺', value: 200, rarity: 'epic' },
    rare_crystal:  { name: 'Rare Crystal',  icon: '🔮', value: 160, rarity: 'epic' },
    summit_stone:  { name: 'Summit Stone',  icon: '⚪', value: 300, rarity: 'legendary' },
    sky_gem:       { name: 'Sky Gem',       icon: '✨', value: 500, rarity: 'legendary' },
  };

  const UPGRADES = [
    { id: 'rope_length',   name: 'Rope Length',    icon: '🪢', desc: 'Longer rope for bigger swings', maxLevel: 5, baseCost: 40,  effect: (lvl) => { rope.length = 18 * Physics.SEGMENT_LENGTH + lvl * 72; } },
    { id: 'rope_strength', name: 'Grip Strength',  icon: '💪', desc: 'Hang longer without tiring',    maxLevel: 5, baseCost: 50,  effect: (lvl) => { player.maxStamina = 100 + lvl * 40; } },
    { id: 'boots',         name: 'Mountain Boots', icon: '👢', desc: 'Better traction, less slip',    maxLevel: 3, baseCost: 80,  effect: () => {} },
    { id: 'bag',           name: 'Bigger Bag',     icon: '🎒', desc: 'Carry more items',             maxLevel: 3, baseCost: 70,  effect: () => {} },
    { id: 'gloves',        name: 'Climbing Gloves',icon: '🧤', desc: 'Climb rope faster',            maxLevel: 4, baseCost: 60,  effect: () => {} },
    { id: 'hook',          name: 'Better Hook',    icon: '⚓', desc: 'Hook sticks to more surfaces', maxLevel: 3, baseCost: 90,  effect: () => {} },
  ];

  const ACCESSORIES = [
    { id: 'scarf',  name: 'Wool Scarf',    icon: '🧣', cost: 30,  desc: 'Cozy mountain style' },
    { id: 'goggles',name: 'Snow Goggles',  icon: '🥽', cost: 55,  desc: 'See through blizzards' },
    { id: 'flask',  name: 'Hip Flask',     icon: '🍶', cost: 40,  desc: 'Keeps you warm' },
    { id: 'lantern',name: 'Miner Lantern', icon: '🏮', cost: 65,  desc: 'Light for dark passages' },
    { id: 'compass',name: 'Old Compass',   icon: '🧭', cost: 80,  desc: 'Never get lost' },
  ];

  const NPC_LINES = [
    "Ah, another climber! The summit is further than it looks, friend.",
    "I've been up here 30 years. The mountain has moods, you know.",
    "Sold a sky gem last season. Retired for a month. Here I am again.",
    "Watch the wind above the treeline. She'll spin your rope right round.",
    "There's an old relic up near the ice fields... if you dare.",
    "My best tip? Don't look down. My second tip? Look down sometimes.",
    "The mountain giveth and the mountain taketh. Usually taketh.",
    "You look like you've seen better days. Tea? No? Suit yourself.",
    "I hear the summit glows at dawn. Nobody's come back to confirm.",
  ];

  let inventory = {};
  let coins = 30;
  let upgradeLevels = {};
  let ownedAccessories = new Set();
  let maxAlt = 0;
  let npcLine = NPC_LINES[0];
  let campNearby = false;
  let lastCampCheck = 0;

  // ─── INIT ─────────────────────────────────────────
  function init() {
    World.init();
    const startX = 0;
    const startY = World.getTerrainY(startX) - 40;
    player = Physics.createPlayer(startX, startY);
    rope = Physics.createRope(startX, startY);
    setupUI();
    setupInput();
    requestAnimationFrame(loop);
  }

  // ─── GAME LOOP ────────────────────────────────────
  function loop() {
    requestAnimationFrame(loop);
    if (gameState === 'dead') return;
    if (gameState === 'camp') return;

    // Update
    Physics.updateWind(1);

    const activeKeys = {
      left: keys.left || touchLeft,
      right: keys.right || touchRight,
      up: keys.up || touchUp,
    };

    Physics.updatePlayer(player, rope, activeKeys, World);
    Physics.updateRope(rope, player.x, player.y, World);

    // Collect nearby items
    const collected = World.collectItem(player.x, player.y);
    if (collected) {
      inventory[collected] = (inventory[collected] || 0) + 1;
      showToast(`Found ${ITEMS_META[collected]?.icon || '?'} ${ITEMS_META[collected]?.name || collected}!`);
      updateInventoryBar();
    }

    // Altitude
    const alt = World.getAltitude(player.y);
    if (alt > maxAlt) maxAlt = alt;
    updateHUD(alt);

    // Stamina bar
    const stEl = document.getElementById('staminaBar');
    if (stEl) stEl.style.width = (player.stamina / player.maxStamina * 100) + '%';

    // Camp check (every 60 frames)
    if (++lastCampCheck > 60) {
      campNearby = World.nearbyCamp(player.x, player.y);
      lastCampCheck = 0;
      document.getElementById('enterCampBtn').style.display = campNearby ? 'flex' : 'none';
    }

    // Camera
    Engine.setCameraTarget(player.x, player.y);

    // Render
    const foliage = World.getFoliageNear(player.x, player.y, Engine.W(), Engine.H());
    Engine.render(player, rope, foliage, alt, campNearby);

    // Aim line
    if (aiming) {
      const charge = Math.min(1, (Date.now() - chargeStart) / 1500);
      Engine.drawAimLine(player.x, player.y, aimAngle, charge, true);
      document.getElementById('powerMeter').style.display = 'block';
      document.getElementById('powerFill').style.height = (charge * 100) + '%';
    } else {
      Engine.drawAimLine(0, 0, 0, 0, false);
      document.getElementById('powerMeter').style.display = 'none';
    }

    // Death check
    if (player.dead) {
      gameState = 'dead';
      document.getElementById('deathScreen').classList.add('show');
    }
  }

  // ─── HUD ──────────────────────────────────────────
  function updateHUD(alt) {
    document.getElementById('altValue').textContent = alt + 'm';
    document.getElementById('coinsValue').textContent = coins;
    const st = Math.round(player.stamina);
    document.getElementById('staminaValue').textContent = st + '%';

    const windVal = Physics.getWind();
    const windDir = windVal > 0.3 ? '→' : windVal < -0.3 ? '←' : '—';
    document.getElementById('windValue').textContent = windDir + ' ' + Math.abs(windVal).toFixed(1);
  }

  function updateInventoryBar() {
    const bar = document.getElementById('inventoryBar');
    bar.innerHTML = '';
    const entries = Object.entries(inventory).filter(([, qty]) => qty > 0);
    if (entries.length === 0) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.innerHTML = '<span style="font-size:11px;opacity:0.3">empty</span>';
      bar.appendChild(slot);
      return;
    }
    entries.forEach(([type, qty]) => {
      const meta = ITEMS_META[type];
      if (!meta) return;
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.title = meta.name;
      slot.innerHTML = `${meta.icon}<span class="qty">${qty}</span>`;
      bar.appendChild(slot);
    });
  }

  // ─── CAMP UI ──────────────────────────────────────
  function openCamp() {
    gameState = 'camp';
    npcLine = NPC_LINES[Math.floor(Math.random() * NPC_LINES.length)];
    renderCampUI();
    document.getElementById('campOverlay').classList.add('open');
  }

  function closeCamp() {
    gameState = 'playing';
    document.getElementById('campOverlay').classList.remove('open');
    requestAnimationFrame(loop);
  }

  function renderCampUI() {
    const panel = document.getElementById('campContent');

    // NPC speech
    let html = `<div class="npc-speech">${npcLine}</div>`;

    // Sell items
    html += `<div class="camp-section-title">🎒 Sell Items</div>`;
    const sellableItems = Object.entries(inventory).filter(([, qty]) => qty > 0);
    if (sellableItems.length === 0) {
      html += `<p style="color:rgba(240,232,208,0.4);font-size:13px;margin-bottom:18px">Your bag is empty. Go find something!</p>`;
    } else {
      html += `<div class="item-grid">`;
      sellableItems.forEach(([type, qty]) => {
        const meta = ITEMS_META[type];
        if (!meta) return;
        html += `
          <div class="item-card">
            <div class="icon">${meta.icon}</div>
            <div class="name">${meta.name}</div>
            <div class="price">🪙 ${meta.value}</div>
            <div class="qty-badge">x${qty} in bag</div>
            <button class="sell-btn" onclick="Game.sellItem('${type}')">Sell one</button>
          </div>`;
      });
      html += `</div>`;
      html += `<button class="buy-btn" onclick="Game.sellAll()" style="margin-bottom:18px">💰 Sell All Items</button>`;
    }

    // Upgrades
    html += `<div class="camp-section-title">⬆️ Upgrades</div><div class="upgrade-grid">`;
    UPGRADES.forEach(upg => {
      const lvl = upgradeLevels[upg.id] || 0;
      const maxed = lvl >= upg.maxLevel;
      const cost = Math.round(upg.baseCost * Math.pow(1.6, lvl));
      const canAfford = coins >= cost;
      html += `
        <div class="upgrade-card">
          <div class="upg-icon">${upg.icon}</div>
          <div class="upg-name">${upg.name}</div>
          <div class="upg-desc">${upg.desc}</div>
          <div class="upg-level">Lv ${lvl}/${upg.maxLevel}</div>
          ${maxed
            ? `<button class="buy-btn" disabled style="opacity:0.4">Maxed!</button>`
            : `<button class="buy-btn" onclick="Game.buyUpgrade('${upg.id}')" ${canAfford ? '' : 'disabled style="opacity:0.5"'}>🪙 ${cost}</button>`
          }
        </div>`;
    });
    html += `</div>`;

    // Accessories
    html += `<div class="camp-section-title">🎨 Accessories</div><div class="item-grid">`;
    ACCESSORIES.forEach(acc => {
      const owned = ownedAccessories.has(acc.id);
      const canAfford = coins >= acc.cost;
      html += `
        <div class="item-card">
          <div class="icon">${acc.icon}</div>
          <div class="name">${acc.name}</div>
          <div class="price">${owned ? '✅ Owned' : `🪙 ${acc.cost}`}</div>
          <div class="qty-badge">${acc.desc}</div>
          ${owned
            ? ''
            : `<button class="buy-btn" onclick="Game.buyAccessory('${acc.id}')" ${canAfford ? '' : 'disabled style="opacity:0.5"'}>Buy</button>`
          }
        </div>`;
    });
    html += `</div>`;

    panel.innerHTML = html;
  }

  function sellItem(type) {
    if (!inventory[type] || inventory[type] <= 0) return;
    const meta = ITEMS_META[type];
    if (!meta) return;
    inventory[type]--;
    if (inventory[type] === 0) delete inventory[type];
    coins += meta.value;
    showToast(`Sold ${meta.icon} for ${meta.value} coins!`);
    updateInventoryBar();
    renderCampUI();
  }

  function sellAll() {
    let total = 0;
    Object.entries(inventory).forEach(([type, qty]) => {
      const meta = ITEMS_META[type];
      if (!meta) return;
      total += meta.value * qty;
    });
    inventory = {};
    coins += total;
    showToast(`💰 Sold everything for ${total} coins!`);
    updateInventoryBar();
    renderCampUI();
  }

  function buyUpgrade(id) {
    const upg = UPGRADES.find(u => u.id === id);
    if (!upg) return;
    const lvl = upgradeLevels[id] || 0;
    if (lvl >= upg.maxLevel) return;
    const cost = Math.round(upg.baseCost * Math.pow(1.6, lvl));
    if (coins < cost) return;
    coins -= cost;
    upgradeLevels[id] = lvl + 1;
    upg.effect(lvl + 1);
    showToast(`${upg.icon} ${upg.name} upgraded to Lv ${lvl + 1}!`);
    renderCampUI();
  }

  function buyAccessory(id) {
    const acc = ACCESSORIES.find(a => a.id === id);
    if (!acc || ownedAccessories.has(id)) return;
    if (coins < acc.cost) return;
    coins -= acc.cost;
    ownedAccessories.add(id);
    showToast(`${acc.icon} Got ${acc.name}!`);
    renderCampUI();
  }

  // ─── TOAST ────────────────────────────────────────
  let toastTimer;
  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ─── INPUT SETUP ──────────────────────────────────
  function setupInput() {
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w') keys.up = true;
      if (e.key === ' ') { e.preventDefault(); Physics.jump(player); }
      if (e.key === 'r') Physics.retractRope(rope);
      if (e.key === 'e' && campNearby) openCamp();
    });
    document.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
    });

    // Touch: right side drag to aim + throw
    const cvs = document.getElementById('gameCanvas');

    cvs.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        const tx = touch.clientX, ty = touch.clientY;
        const rightZone = tx > Engine.W() * 0.5;
        if (rightZone && !aiming) {
          aimTouchId = touch.identifier;
          aimStartX = tx; aimStartY = ty;
          aiming = true;
          throwCharging = true;
          chargeStart = Date.now();
          // Calculate angle toward touch relative to player screen pos
          const psx = Engine.wx(player.x), psy = Engine.wy(player.y);
          aimAngle = Math.atan2(ty - psy, tx - psx);
        }
      }
    }, { passive: false });

    cvs.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === aimTouchId) {
          const psx = Engine.wx(player.x), psy = Engine.wy(player.y);
          aimAngle = Math.atan2(touch.clientY - psy, touch.clientX - psx);
        }
      }
    }, { passive: false });

    cvs.addEventListener('touchend', e => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === aimTouchId) {
          if (aiming) {
            const power = Math.min(1, (Date.now() - chargeStart) / 1500);
            if (rope.anchored) {
              Physics.retractRope(rope);
            } else {
              Physics.throwRope(rope, player.x, player.y - 10, aimAngle, power);
            }
            aiming = false;
            aimTouchId = null;
          }
        }
      }
    }, { passive: false });

    // Mouse aiming (desktop/dev)
    cvs.addEventListener('mousedown', e => {
      if (e.button === 0) {
        const psx = Engine.wx(player.x), psy = Engine.wy(player.y);
        aimAngle = Math.atan2(e.clientY - psy, e.clientX - psx);
        aiming = true;
        chargeStart = Date.now();
      }
    });
    cvs.addEventListener('mousemove', e => {
      if (aiming) {
        const psx = Engine.wx(player.x), psy = Engine.wy(player.y);
        aimAngle = Math.atan2(e.clientY - psy, e.clientX - psx);
      }
    });
    cvs.addEventListener('mouseup', e => {
      if (e.button === 0 && aiming) {
        const power = Math.min(1, (Date.now() - chargeStart) / 1500);
        if (rope.anchored) {
          Physics.retractRope(rope);
        } else {
          Physics.throwRope(rope, player.x, player.y - 10, aimAngle, power);
        }
        aiming = false;
      }
    });
  }

  // ─── BUTTON HANDLERS ──────────────────────────────
  function setupUI() {
    updateInventoryBar();

    // D-pad
    function btnDown(id, action) {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', e => { e.preventDefault(); action(true); el.classList.add('pressed'); }, { passive: false });
      el.addEventListener('touchend', e => { e.preventDefault(); action(false); el.classList.remove('pressed'); }, { passive: false });
      el.addEventListener('mousedown', () => { action(true); el.classList.add('pressed'); });
      el.addEventListener('mouseup', () => { action(false); el.classList.remove('pressed'); });
    }

    btnDown('btnLeft', v => touchLeft = v);
    btnDown('btnRight', v => touchRight = v);
    btnDown('btnUp', v => touchUp = v);

    document.getElementById('btnJump').addEventListener('touchstart', e => { e.preventDefault(); Physics.jump(player); }, { passive: false });
    document.getElementById('btnJump').addEventListener('click', () => Physics.jump(player));

    document.getElementById('btnRetract').addEventListener('touchstart', e => { e.preventDefault(); Physics.retractRope(rope); }, { passive: false });
    document.getElementById('btnRetract').addEventListener('click', () => Physics.retractRope(rope));

    document.getElementById('enterCampBtn').addEventListener('click', openCamp);
    document.getElementById('closeCampBtn').addEventListener('click', closeCamp);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
  }

  function restartGame() {
    const startX = 0;
    const startY = World.getTerrainY(startX) - 40;
    player = Physics.createPlayer(startX, startY);
    rope = Physics.createRope(startX, startY);
    inventory = {};
    coins = Math.floor(coins * 0.5); // keep half coins
    updateInventoryBar();
    gameState = 'playing';
    document.getElementById('deathScreen').classList.remove('show');
    requestAnimationFrame(loop);
  }

  return {
    init,
    sellItem, sellAll, buyUpgrade, buyAccessory,
    openCamp, closeCamp,
  };
})();
