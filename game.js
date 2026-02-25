// game.js — Main game loop, state machine, save/load

const Game = (() => {
  let canvas, ctx;
  let W, H;
  let running = false;
  let rafId = null;
  let lastTime = 0;
  let gameTime = 0;

  // ── Game state ─────────────────────────────────────────────────────
  const STATE = { TITLE: 0, PLAYING: 1, CAMP: 2, DEAD: 3 };
  let state = STATE.TITLE;

  let campVisitCount = 0;
  let nearCamp = false;
  let campEnterCooldown = 0;

  // Camera
  let camY = 0;          // world Y scroll position
  let targetCamY = 0;
  const CAM_MARGIN_TOP = 0.35;    // keep player in top 35% triggers scroll
  const CAM_MARGIN_BOT = 0.65;
  const CAM_LERP = 0.06;

  // ── Resize ─────────────────────────────────────────────────────────
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // ── Init ───────────────────────────────────────────────────────────
  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    resize();
    window.addEventListener('resize', resize);

    UI.init();
    UI.hideLoading();

    // Bind global callbacks
    window.onGameStart = startGame;
    window.onGameRetry = retryGame;
    window.onCampLeave = leaveCamp;

    Camp.setupTabListeners();

    // Load save
    loadGame();

    // Touch / key input
    canvas.addEventListener('touchstart', Player.onTouchStart, { passive: false });
    canvas.addEventListener('touchend', Player.onTouchEnd, { passive: false });
    canvas.addEventListener('touchmove', Player.onTouchMove, { passive: false });
    window.addEventListener('keydown', Player.onKeyDown);
    window.addEventListener('keyup', Player.onKeyUp);

    // Camp entry via double-tap on camp — also handle from game loop
    // (double tap triggers jumpQueued in player, we'll intercept for camp)

    state = STATE.TITLE;
  }

  function startGame() {
    UI.hideTitle(() => {
      World.init();
      Entities.clearParticles();

      // Start player mid-screen at the bottom of the passage
      const startX = window.innerWidth * 0.5;
      const startY = 80;
      Player.reset(startX, startY);

      camY = 0;
      targetCamY = 0;
      gameTime = 0;
      campVisitCount = 0;
      nearCamp = false;
      campEnterCooldown = 0;
      state = STATE.PLAYING;

      UI.showHUD();
      running = true;
      lastTime = performance.now();
      loop(lastTime);
    });
  }

  function retryGame() {
    World.init();
    Entities.clearParticles();
    Entities.clearInventory();

    const startX = window.innerWidth * 0.5;
    Player.reset(startX, 80);

    camY = 0;
    targetCamY = 0;
    gameTime = 0;
    campVisitCount = 0;
    nearCamp = false;
    campEnterCooldown = 0;
    state = STATE.PLAYING;

    UI.showHUD();
    running = true;
    lastTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  // ── Main loop ──────────────────────────────────────────────────────
  function loop(ts) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);

    const dt = Math.min(ts - lastTime, 50); // cap at 50ms
    lastTime = ts;
    gameTime += dt;

    update(dt);
    render();
  }

  function update(dt) {
    if (state !== STATE.PLAYING) return;

    const pState = Player.getState();
    if (pState.dead) return;

    // World update
    World.update(dt, pState.y);

    // Player update
    Player.update(dt, World.getChunks(), World.getWindX());

    const pState2 = Player.getState();

    // Camera follow
    const playerScreenY = H - (pState2.y - camY);
    if (playerScreenY < H * CAM_MARGIN_TOP) {
      targetCamY = pState2.y - H * CAM_MARGIN_TOP;
    } else if (playerScreenY > H * CAM_MARGIN_BOT) {
      targetCamY = pState2.y - H * CAM_MARGIN_BOT;
    }
    camY += (targetCamY - camY) * CAM_LERP;
    if (camY < 0) camY = 0;

    // Check death (player fell below camera + buffer)
    const screenY = H - (pState2.y - camY);
    if (screenY > H + 150 && pState2.y < pState2.highAlt - 50) {
      playerDie(pState2.y / 5 | 0);
      return;
    }

    // Camp proximity check
    if (campEnterCooldown > 0) campEnterCooldown -= dt;

    const campNearby = World.checkCampNear(pState2.y, 120);
    if (campNearby !== nearCamp) {
      nearCamp = campNearby;
      UI.showCampPrompt(campNearby);
    }

    // Enter camp when player double-taps near camp
    if (campNearby && campEnterCooldown <= 0) {
      // Check if player is slow (hovering near camp)
      const speed = Math.sqrt(pState2.vx * pState2.vx + pState2.vy * pState2.vy);
      if (speed < 3 && Math.random() < 0.01 * dt) {
        enterCamp();
        return;
      }
    }

    // Manual camp enter: tap quickly near camp
    // Handled by triggering when player is very close & not swinging

    // Entities update
    Entities.updateParticles(dt);
    Entities.updateRopeTrail();

    // HUD
    UI.updateHUD({
      altitude: World.getAltitude(),
      stamina: pState2.stamina,
      maxStamina: pState2.maxStamina,
      gold: pState2.gold,
      equipped: pState2.equipped
    });

    // Weather notification
    if (Math.floor(gameTime / 15000) !== Math.floor((gameTime - dt) / 15000)) {
      const w = World.getWeather();
      if (w !== 'clear') {
        const msgs = {
          wind: '💨 Wind picks up!',
          snow: '❄️ Snow begins to fall...',
          storm: '⚡ Storm incoming!'
        };
        UI.showNotification(msgs[w] || '');
      }
    }
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    if (state === STATE.PLAYING || state === STATE.DEAD) {
      const pState = Player.getState();

      // Pixel-style rendering scale
      ctx.save();

      World.draw(ctx, W, H, camY, gameTime);
      Entities.drawParticles(ctx, W, H, camY);
      Player.draw(ctx, W, H, camY, gameTime);

      // Vignette
      drawVignette(ctx, W, H);

      // Weather overlay
      if (World.getWeather() === 'storm') {
        ctx.fillStyle = `rgba(20,10,40,${0.15 + Math.sin(gameTime * 0.02) * 0.05})`;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.restore();
    }
  }

  function drawVignette(ctx, W, H) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Camp ───────────────────────────────────────────────────────────
  function enterCamp() {
    if (state !== STATE.PLAYING) return;
    state = STATE.CAMP;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);

    const alt = World.getAltitude();
    UI.showNotification('⛺ Entering camp...');
    setTimeout(() => {
      Camp.open(alt, campVisitCount);
      campVisitCount++;
    }, 400);
  }

  function leaveCamp() {
    state = STATE.PLAYING;
    campEnterCooldown = 3000; // 3s before can re-enter
    saveGame();

    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);

    UI.showNotification('🧗 Back on the mountain...');
  }

  // ── Death ──────────────────────────────────────────────────────────
  function playerDie(altitude) {
    state = STATE.DEAD;
    Player.die();
    running = false;

    setTimeout(() => {
      UI.showDeath(altitude);
    }, 800);
  }

  // ── Save / Load ────────────────────────────────────────────────────
  function saveGame() {
    try {
      const data = {
        player: Player.getSaveData(),
        camp: Camp.getSaveData(),
        version: 1
      };
      localStorage.setItem('summit_save', JSON.stringify(data));
    } catch (e) {
      // Ignore save errors
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem('summit_save');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.version !== 1) return;
      if (data.player) Player.loadSaveData(data.player);
      if (data.camp) Camp.loadSaveData(data.camp);
    } catch (e) {
      // Ignore load errors
    }
  }

  return { init };
})();

// ── Bootstrap ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Small delay to let fonts load
  setTimeout(Game.init, 200);
});
