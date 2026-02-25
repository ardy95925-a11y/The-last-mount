// camp.js — Camp UI, shop, sell screen, lore, cozy fire visuals

const Camp = (() => {

  // ── Lore entries ───────────────────────────────────────────────────
  const ALL_LORE = [
    {
      id: 'intro',
      title: 'THE JOURNAL OF MIRA VOSS — DAY 1',
      text: 'The mountain has no name. The people of Aldenveil call it "The Patient One." They say it has been here longer than the valleys, longer than the rivers. I am the fourteenth to try. I intend to be the first to return.',
      unlocked: true
    },
    {
      id: 'crystal',
      title: 'ON THE SKY CRYSTALS',
      text: 'The crystals form when cloud-frost falls into cracks and is compressed over centuries. Traders pay well for them. Healers say they help you breathe thin air. I think they just feel cold and pretty and remind you the sky is still there.',
      unlocked: false
    },
    {
      id: 'fossil',
      title: 'WHAT LIVED HERE',
      text: 'The fossils are wrong. The shapes inside them do not match any animal in Aldenveil\'s bestiary. Long bones. Wide skulls. Professor Aldren said they were sea creatures. We are very far from any sea.',
      unlocked: false
    },
    {
      id: 'camp_veilstone',
      title: 'CAMP VEILSTONE — FIRST ARRIVAL',
      text: 'Someone left soup. Still warm. The hammock is worn but whole. A small carved figure on the shelf — a person with arms raised. I don\'t know if they\'re celebrating or falling.',
      unlocked: false
    },
    {
      id: 'gem',
      title: 'THE HEARTSTONES',
      text: 'The heartstones pulse. Every twelve seconds, exactly. I have measured it repeatedly over three camps. I stopped measuring when I realized mine was doing the same.',
      unlocked: false
    },
    {
      id: 'relic',
      title: 'THE IRON EXPEDITION',
      text: 'They came two hundred years ago with pulleys and steam engines. They got further than anyone before them. Their machines are still here — rusted into the rock like they\'ve always belonged. The mountain ate them.',
      unlocked: false
    },
    {
      id: 'high_alt',
      title: 'ABOVE THE CLOUDS — DAY 23',
      text: 'The air is strange up here. Not thin — strange. It sits differently in your chest. I have stopped dreaming. I am not sure if that is good or bad. The summit is still above me. It always will be, I think. I think that\'s the point.',
      unlocked: false
    },
    {
      id: 'wind',
      title: 'ON THE WIND',
      text: 'The wind here doesn\'t push. It pulls. Back down. Not threatening — just insistent. Like a hand on your shoulder. Like someone saying: you can always come home. I have nothing to go home to. I keep climbing.',
      unlocked: false
    },
    {
      id: 'summit_hint',
      title: 'FOUND INSIDE A CAIRN — ALTITUDE UNKNOWN',
      text: 'There is no summit. There is only what you carry up with you, and what you leave behind. The mountain knows which is which better than you do.',
      unlocked: false
    }
  ];

  let loreUnlocked = new Set(['intro']);
  let campCanvas, campCtx;
  let fireParticles = [];
  let campAnimTime = 0;
  let currentCampAlt = 0;
  let currentCampName = 'Camp Veilstone';
  let activeCampTab = 'sell';

  const CAMP_NAMES = [
    'Camp Veilstone', 'The Pale Refuge', 'Harrow\'s Rest', 'The Crooked Eave',
    'Ember Hollow', 'Camp Duskfall', 'The Starward Post', 'Ironmist Station',
    'The Last Lamp', 'Cloudbreak Camp'
  ];

  // ── Fire particle system ───────────────────────────────────────────
  function spawnFireParticle(cx, cy) {
    fireParticles.push({
      x: cx + (Math.random() - 0.5) * 20,
      y: cy,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -(1 + Math.random() * 2),
      life: 1,
      r: 3 + Math.random() * 5,
      type: Math.random() > 0.6 ? 'ember' : 'flame'
    });
  }

  function updateFire(dt) {
    fireParticles = fireParticles.filter(p => {
      p.x += p.vx;
      p.y += p.vy * dt * 0.05;
      p.vx += (Math.random() - 0.5) * 0.1;
      p.r *= 0.97;
      p.life -= 0.015 * dt * 0.06;
      return p.life > 0 && p.r > 0.5;
    });
  }

  function drawCampScene(ctx, W, H) {
    const cx = W * 0.5;
    const groundY = H * 0.72;

    // Ground
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
    groundGrad.addColorStop(0, '#2a1a08');
    groundGrad.addColorStop(1, '#150a03');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, W, H);

    // Snow on ground
    ctx.fillStyle = 'rgba(220,215,230,0.15)';
    ctx.fillRect(0, groundY, W, 8);

    // Tent silhouette
    const tx = cx - 120;
    const ty = groundY - 80;
    ctx.fillStyle = '#3a2510';
    ctx.beginPath();
    ctx.moveTo(tx - 60, groundY);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx + 60, groundY);
    ctx.closePath();
    ctx.fill();
    // Tent opening glow
    ctx.fillStyle = 'rgba(255,150,50,0.4)';
    ctx.beginPath();
    ctx.moveTo(tx - 15, groundY);
    ctx.lineTo(tx + 5, ty + 30);
    ctx.lineTo(tx + 20, groundY);
    ctx.closePath();
    ctx.fill();

    // Supply crates
    [cx + 60, cx + 100].forEach((bx, i) => {
      const by = groundY - 20 - i * 5;
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(bx - 14, by - 14, 28, 28);
      ctx.strokeStyle = '#6a5040';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - 14, by - 14, 28, 28);
      ctx.beginPath();
      ctx.moveTo(bx - 14, by);
      ctx.lineTo(bx + 14, by);
      ctx.moveTo(bx, by - 14);
      ctx.lineTo(bx, by + 14);
      ctx.stroke();
    });

    // Hanging rope with lantern
    ctx.strokeStyle = '#6a5040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 30, groundY - 100);
    ctx.lineTo(cx + 30, groundY - 60);
    ctx.stroke();
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🪔', cx + 30, groundY - 55);

    // Fire
    const fireX = cx;
    const fireY = groundY - 10;

    // Fire glow on ground
    const glowR = 80 + Math.sin(campAnimTime * 0.003) * 15;
    const fireGlow = ctx.createRadialGradient(fireX, fireY, 5, fireX, fireY, glowR);
    fireGlow.addColorStop(0, 'rgba(255,150,50,0.3)');
    fireGlow.addColorStop(0.5, 'rgba(255,100,20,0.1)');
    fireGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fireGlow;
    ctx.beginPath();
    ctx.arc(fireX, fireY, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Fire particles
    for (let i = 0; i < 3; i++) spawnFireParticle(fireX, fireY - 5);
    updateFire(16);

    fireParticles.forEach(p => {
      ctx.globalAlpha = p.life * 0.8;
      if (p.type === 'ember') {
        ctx.fillStyle = '#ff8020';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const fireColor = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        fireColor.addColorStop(0, '#fff0a0');
        fireColor.addColorStop(0.4, '#ff8020');
        fireColor.addColorStop(1, 'rgba(200,40,0,0)');
        ctx.fillStyle = fireColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    // Log base
    ctx.fillStyle = '#3a2510';
    ctx.fillRect(fireX - 25, fireY - 4, 50, 8);
    ctx.fillRect(fireX - 20, fireY - 8, 10, 6);
    ctx.fillRect(fireX + 10, fireY - 8, 10, 6);

    // Far mountains
    ctx.fillStyle = 'rgba(15,8,25,0.6)';
    for (let m = 0; m < 5; m++) {
      const mx = (W / 4) * m;
      const mh = 60 + m * 20 + Math.sin(m * 2.3) * 30;
      ctx.beginPath();
      ctx.moveTo(mx, H);
      ctx.lineTo(mx + 60, groundY - mh);
      ctx.lineTo(mx + 120, H);
      ctx.closePath();
      ctx.fill();
    }

    // Stars
    ctx.fillStyle = 'white';
    for (let s = 0; s < 30; s++) {
      const sx = (s * 137.5) % W;
      const sy = (s * 73.1) % (groundY - 20);
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(campAnimTime * 0.001 + s));
      ctx.globalAlpha = twinkle * 0.7;
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + (s % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Camp UI setup ──────────────────────────────────────────────────
  function open(altitude, campIndex) {
    currentCampAlt = altitude;
    currentCampName = CAMP_NAMES[campIndex % CAMP_NAMES.length];

    // Unlock lore based on altitude
    if (altitude > 200) loreUnlocked.add('crystal');
    if (altitude > 400) { loreUnlocked.add('fossil'); loreUnlocked.add('camp_veilstone'); }
    if (altitude > 800) loreUnlocked.add('gem');
    if (altitude > 1200) loreUnlocked.add('relic');
    if (altitude > 2000) loreUnlocked.add('high_alt');
    if (altitude > 3000) { loreUnlocked.add('wind'); loreUnlocked.add('summit_hint'); }

    document.getElementById('campName').textContent = `⛺ ${currentCampName}`;
    document.getElementById('campSubtitle').textContent = `Altitude: ${altitude}m • The fire is warm.`;

    updateCampUI();

    const overlay = document.getElementById('campOverlay');
    overlay.classList.add('active');

    // Setup camp canvas
    campCanvas = document.getElementById('campCanvas');
    campCtx = campCanvas.getContext('2d');
    campCanvas.width = window.innerWidth;
    campCanvas.height = window.innerHeight;

    startCampAnim();
  }

  function close() {
    document.getElementById('campOverlay').classList.remove('active');
    stopCampAnim();
  }

  let campAnimId = null;
  function startCampAnim() {
    function loop() {
      campAnimTime += 16;
      if (campCtx && campCanvas) {
        campCtx.clearRect(0, 0, campCanvas.width, campCanvas.height);
        drawCampScene(campCtx, campCanvas.width, campCanvas.height);
      }
      campAnimId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopCampAnim() {
    if (campAnimId) cancelAnimationFrame(campAnimId);
    campAnimId = null;
  }

  function updateCampUI() {
    const gold = Player.getGold();
    document.getElementById('campGoldDisplay').textContent = `🪙 ${gold} SHARDS`;
    document.getElementById('shopGoldDisplay').textContent = `🪙 ${gold} SHARDS`;

    renderFindings();
    renderShop();
    renderLore();
  }

  function renderFindings() {
    const inv = Entities.getInventory();
    const grid = document.getElementById('findingsGrid');
    grid.innerHTML = '';

    const entries = Object.entries(inv);
    if (entries.length === 0) {
      grid.innerHTML = '<div style="font-family:\'IM Fell English\';font-style:italic;color:var(--text-dim);font-size:12px;grid-column:1/-1;text-align:center;padding:20px;">Your pack is empty.<br>Climb to find treasures.</div>';
      return;
    }

    entries.forEach(([type, count]) => {
      const info = Entities.COLLECTIBLES[type];
      if (!info || count === 0) return;
      const div = document.createElement('div');
      div.className = 'finding-item';
      div.innerHTML = `
        <div class="finding-icon">${info.emoji}</div>
        <div class="finding-name">${info.name}</div>
        <div class="finding-value" style="color:var(--text-dim);margin-bottom:2px">x${count}</div>
        <div class="finding-value">${info.baseValue * count}🪙</div>
      `;
      grid.appendChild(div);
    });
  }

  function renderShop() {
    const grid = document.getElementById('shopGrid');
    grid.innerHTML = '';

    Object.entries(Player.UPGRADES).forEach(([key, upg]) => {
      const owned = upg.owned;
      const canAfford = Player.getGold() >= upg.price;
      const div = document.createElement('div');
      div.className = `shop-item ${owned ? 'owned' : (!canAfford ? 'locked' : '')}`;

      div.innerHTML = `
        <div class="shop-item-icon">${upg.emoji}</div>
        <div class="shop-item-name">${upg.name}</div>
        <div class="shop-item-desc">${upg.desc}</div>
        <div class="shop-item-price">${owned ? '✓ OWNED' : `${upg.price}🪙`}</div>
      `;

      if (!owned && canAfford) {
        div.addEventListener('click', () => {
          if (Player.buyUpgrade(key)) {
            Player.equipItem(key);
            UI.showNotification(`Equipped ${upg.emoji} ${upg.name}!`);
            updateCampUI();
          }
        });
      } else if (owned && upg.price > 0) {
        div.addEventListener('click', () => {
          if (Player.equipItem(key)) {
            UI.showNotification(`Equipped ${upg.emoji} ${upg.name}!`);
          }
        });
      }

      grid.appendChild(div);
    });
  }

  function renderLore() {
    const container = document.getElementById('loreEntries');
    container.innerHTML = '';

    ALL_LORE.forEach(entry => {
      const unlocked = loreUnlocked.has(entry.id);
      const div = document.createElement('div');
      div.className = 'lore-entry';

      if (unlocked) {
        div.innerHTML = `
          <div class="lore-title">${entry.title}</div>
          <div class="lore-text">${entry.text}</div>
        `;
      } else {
        div.style.opacity = '0.4';
        div.innerHTML = `
          <div class="lore-title">???</div>
          <div class="lore-text" style="font-style:italic">Climb higher to discover this entry.</div>
        `;
      }

      container.appendChild(div);
    });
  }

  function setupTabListeners() {
    document.querySelectorAll('.camp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.camp-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.camp-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
        activeCampTab = tab;
      });
    });

    document.getElementById('sellAllBtn').addEventListener('click', () => {
      const inv = Entities.getInventory();
      const total = Entities.calcInventoryValue();
      if (total === 0) {
        UI.showNotification('Nothing to sell!');
        return;
      }
      Player.addGold(total);
      Entities.clearInventory();
      UI.showNotification(`Sold everything for ${total} 🪙 shards!`);
      updateCampUI();
    });

    document.getElementById('leaveCampBtn').addEventListener('click', () => {
      close();
      // Signal to game.js that we're leaving
      if (window.onCampLeave) window.onCampLeave();
    });
  }

  function getSaveData() {
    return { loreUnlocked: [...loreUnlocked] };
  }

  function loadSaveData(data) {
    if (data && data.loreUnlocked) loreUnlocked = new Set(data.loreUnlocked);
  }

  return { open, close, setupTabListeners, getSaveData, loadSaveData, updateCampUI };
})();
