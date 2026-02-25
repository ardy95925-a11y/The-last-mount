// ui.js — HUD updates, notifications, title screen, death screen

const UI = (() => {

  let notifTimer = null;

  const DEATH_QUOTES = [
    '"The mountain does not mourn the fallen."',
    '"Every climber\'s first question: why. Every survivor\'s: how."',
    '"The rope remembers the fall. The hands forget."',
    '"You chose to climb. That was brave. Try again."',
    '"Veilstone\'s log, entry unknown: \'I fell. Then I got up.\'"',
    '"The cold doesn\'t care. The cold just is."',
    '"Distance from summit: same as before. That\'s the point."',
    '"Even the mountain had to grow from nothing."',
  ];

  function init() {
    setupTitleStars();
    setupTitleCanvas();
    setupDeathScreen();
    setupButtons();
    setupControlHints();
  }

  function setupTitleStars() {
    const field = document.getElementById('starField');
    if (!field) return;
    for (let i = 0; i < 80; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.cssText = `
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 70}%;
        width: ${0.5 + Math.random() * 2}px;
        height: ${0.5 + Math.random() * 2}px;
        --dur: ${1.5 + Math.random() * 3}s;
        animation-delay: ${Math.random() * 3}s;
      `;
      field.appendChild(star);
    }
  }

  function setupTitleCanvas() {
    const canvas = document.getElementById('titleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let t = 0;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight * 0.55;
    }
    resize();
    window.addEventListener('resize', resize);

    function drawTitleMountains() {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Multiple mountain layers
      const layers = [
        { color: '#0d0824', heights: [0.5, 0.3, 0.6, 0.2, 0.7, 0.4, 0.5], speed: 0 },
        { color: '#150d30', heights: [0.4, 0.65, 0.3, 0.8, 0.35, 0.6, 0.4], speed: 0.0002 },
        { color: '#1e1040', heights: [0.6, 0.4, 0.75, 0.5, 0.65, 0.45, 0.6], speed: 0.0004 },
        { color: '#261540', heights: [0.55, 0.7, 0.45, 0.85, 0.5, 0.7, 0.55], speed: 0.0006 },
        { color: '#301a45', heights: [0.7, 0.5, 0.8, 0.6, 0.75, 0.55, 0.7], speed: 0.0008 },
      ];

      layers.forEach(layer => {
        ctx.fillStyle = layer.color;
        ctx.beginPath();
        ctx.moveTo(0, H);

        const pts = layer.heights;
        const segW = W / (pts.length - 1);

        pts.forEach((h, i) => {
          const x = i * segW;
          const y = H * (1 - h - Math.sin(t * layer.speed + i * 0.5) * 0.02);
          if (i === 0) ctx.lineTo(x, y);
          else {
            const prev = (i - 1) * segW;
            const prevY = H * (1 - pts[i - 1] - Math.sin(t * layer.speed + (i - 1) * 0.5) * 0.02);
            const cpx = (prev + x) / 2;
            ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
          }
        });

        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
      });

      // Snow cap
      ctx.fillStyle = 'rgba(220,215,235,0.5)';
      ctx.beginPath();
      const topH = H * 0.12;
      ctx.moveTo(W * 0.35, topH + 10);
      ctx.lineTo(W * 0.5, topH - 20);
      ctx.lineTo(W * 0.65, topH + 10);
      ctx.bezierCurveTo(W * 0.7, topH + 30, W * 0.6, topH + 40, W * 0.5, topH + 35);
      ctx.bezierCurveTo(W * 0.4, topH + 40, W * 0.3, topH + 30, W * 0.35, topH + 10);
      ctx.fill();

      // Climber silhouette
      const cx = W * 0.5 + Math.sin(t * 0.001) * 5;
      const cy = H * 0.18;
      ctx.fillStyle = 'rgba(200,180,255,0.6)';
      ctx.fillRect(cx - 3, cy - 16, 6, 12);
      ctx.beginPath();
      ctx.arc(cx, cy - 20, 5, 0, Math.PI * 2);
      ctx.fill();

      // Rope going down
      ctx.strokeStyle = 'rgba(200,180,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 20, cy + 30);
      ctx.lineTo(cx - 5, cy + 60);
      ctx.stroke();

      // Cozy glow at base
      const baseGlow = ctx.createRadialGradient(W * 0.5, H, 10, W * 0.5, H, 150);
      baseGlow.addColorStop(0, 'rgba(255,150,50,0.15)');
      baseGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = baseGlow;
      ctx.fillRect(0, H - 200, W, 200);

      t++;
      requestAnimationFrame(drawTitleMountains);
    }
    drawTitleMountains();
  }

  function setupButtons() {
    document.getElementById('startBtn')?.addEventListener('click', () => {
      if (window.onGameStart) window.onGameStart();
    });

    document.getElementById('retryBtn')?.addEventListener('click', () => {
      document.getElementById('deathScreen').classList.remove('active');
      if (window.onGameRetry) window.onGameRetry();
    });

    document.getElementById('titleBtn')?.addEventListener('click', () => {
      document.getElementById('deathScreen').classList.remove('active');
      showTitle();
    });
  }

  function setupDeathScreen() {
    // Initial state
  }

  function setupControlHints() {
    // Hide hints after first interaction
    const canvas = document.getElementById('gameCanvas');
    const hideHints = () => {
      const hint = document.getElementById('controlsHint');
      if (hint) {
        hint.style.opacity = '0';
        hint.style.transition = 'opacity 1s';
        setTimeout(() => hint.classList.remove('active'), 1000);
      }
      canvas.removeEventListener('touchstart', hideHints);
      window.removeEventListener('keydown', hideHints);
    };
    canvas.addEventListener('touchstart', hideHints, { passive: true });
    window.addEventListener('keydown', hideHints);
  }

  // ── Public methods ─────────────────────────────────────────────────
  function showTitle() {
    document.getElementById('titleScreen').classList.remove('hidden');
    document.getElementById('hud').classList.remove('active');
    document.getElementById('controlsHint').classList.remove('active');
  }

  function hideTitle(cb) {
    const title = document.getElementById('titleScreen');
    title.classList.add('hidden');
    setTimeout(() => {
      title.style.display = 'none';
      if (cb) cb();
    }, 1000);
  }

  function showHUD() {
    document.getElementById('hud').classList.add('active');
    document.getElementById('controlsHint').classList.add('active');
  }

  function updateHUD(state) {
    const altEl = document.getElementById('hudAlt');
    const stamEl = document.getElementById('hudStamina');
    const goldEl = document.getElementById('hudGold');
    const itemsEl = document.getElementById('hudItems');

    if (altEl) altEl.textContent = `${Math.floor(state.altitude)}m`;
    if (stamEl) {
      const pct = (state.stamina / state.maxStamina) * 100;
      stamEl.style.width = `${pct}%`;
      stamEl.classList.toggle('low', pct < 30);
    }
    if (goldEl) goldEl.textContent = `🪙 ${state.gold}`;

    if (itemsEl) {
      const inv = Entities.getInventory();
      itemsEl.innerHTML = '';
      Object.entries(inv).slice(0, 4).forEach(([type, count]) => {
        if (count === 0) return;
        const info = Entities.COLLECTIBLES[type];
        if (!info) return;
        const div = document.createElement('div');
        div.className = 'hud-item';
        div.innerHTML = `${info.emoji}<span style="font-size:6px;position:absolute;bottom:2px;right:3px;color:var(--accent2)">${count}</span>`;
        div.style.position = 'relative';
        itemsEl.appendChild(div);
      });

      // Equipped items
      const eqs = state.equipped;
      if (eqs) {
        const equippedIcons = [];
        const rope = Player.UPGRADES[eqs.rope];
        const lantern = Player.UPGRADES[eqs.lantern];
        if (rope && rope.price > 0) equippedIcons.push(rope.emoji);
        if (lantern && lantern.light > 0) equippedIcons.push(lantern.emoji);

        equippedIcons.forEach(ico => {
          const div = document.createElement('div');
          div.className = 'hud-item';
          div.textContent = ico;
          itemsEl.appendChild(div);
        });
      }
    }
  }

  function showDeath(altitude) {
    const screen = document.getElementById('deathScreen');
    const quote = document.getElementById('deathQuote');
    const alt = document.getElementById('deathAltitude');

    if (quote) quote.textContent = DEATH_QUOTES[Math.floor(Math.random() * DEATH_QUOTES.length)];
    if (alt) alt.textContent = `Reached: ${altitude}m`;

    screen.classList.add('active');
    document.getElementById('hud').classList.remove('active');
  }

  function showNotification(msg, duration = 2500) {
    const el = document.getElementById('notification');
    if (!el) return;

    el.textContent = msg;
    el.classList.add('show');

    if (notifTimer) clearTimeout(notifTimer);
    notifTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  function hideLoading() {
    const el = document.getElementById('loading');
    if (el) {
      el.classList.add('done');
      setTimeout(() => el.remove(), 600);
    }
  }

  function showCampPrompt(show) {
    // Show subtle "Enter Camp" prompt near top
    const hint = document.getElementById('controlsHint');
    if (show) {
      hint.textContent = '⛺ DOUBLE TAP TO ENTER CAMP';
      hint.classList.add('active');
      hint.style.color = 'rgba(255,200,80,0.8)';
      hint.style.fontSize = '9px';
    } else {
      hint.classList.remove('active');
      hint.style.color = '';
    }
  }

  return {
    init, showTitle, hideTitle, showHUD, updateHUD, showDeath,
    showNotification, hideLoading, showCampPrompt
  };
})();
