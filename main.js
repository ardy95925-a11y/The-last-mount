// ============================================================
// MAIN.JS - Game loop, input, initialization
// ============================================================

const Game = (() => {
  let lastTime = 0;
  let gameStarted = false;
  let cursorTile = { tx: null, ty: null };
  let placeMode = false;
  let tapPos = { x: 0, y: 0 };
  
  // Keyboard input state
  const keys = {};
  
  async function init() {
    UI.setLoading(5, 'INITIALIZING ENGINE...');
    await sleep(100);
    
    UI.setLoading(15, 'REGISTERING TILE GRAPHICS...');
    World.initTileGraphics();
    await sleep(100);
    
    UI.setLoading(30, 'GENERATING TERRAIN...');
    // Pre-generate chunks around spawn
    const spawnTX = 0;
    const spawnSurface = World.getSurface(spawnTX);
    const spawnX = spawnTX * World.TILE;
    const spawnY = (spawnSurface - 2) * World.TILE;
    
    for (let cx=-3; cx<=3; cx++) {
      for (let cy=-1; cy<=3; cy++) {
        // This triggers chunk generation
        World.tileAt(cx*32, cy*64, 0);
      }
      UI.setLoading(30 + (cx+3)/6*40, 'CARVING CAVES...');
      await sleep(10);
    }
    
    UI.setLoading(75, 'PLANTING FORESTS...');
    await sleep(100);
    
    UI.setLoading(88, 'SUMMONING COLD...');
    Player.init(spawnX, spawnY);
    Engine.cam.x = spawnX;
    Engine.cam.y = spawnY;
    await sleep(100);
    
    UI.setLoading(95, 'INITIALIZING CONTROLS...');
    UI.init();
    setupInput();
    await sleep(100);
    
    UI.setLoading(100, 'ENTERING FROSTWORLD...');
    gameStarted = true;
    
    // Show intro message
    setTimeout(()=>{
      UI.showMsg('Welcome to Frostworld. Survive the cold.', 'warn');
      setTimeout(()=>UI.showMsg('Mine stone & wood. Build shelter. Stay warm.'),2000);
      setTimeout(()=>UI.showMsg('Temperature: '+Math.round(World.weather.temperature)+'°C — Find fire quickly!','danger'),4000);
    },1200);
    
    requestAnimationFrame(loop);
  }
  
  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min((ts - lastTime)/1000, 0.05);
    lastTime = ts;
    if (!gameStarted) return;
    
    update(dt, ts*0.001);
    render(ts*0.001);
  }
  
  function update(dt, time) {
    if (Player.state.dead) return;
    
    // Player input from keyboard
    if (keys['ArrowLeft']||keys['a']||keys['A'])  Player.state.moveLeft=true;
    else if (!Player.state.moveLeft_touch) Player.state.moveLeft=false;
    
    if (keys['ArrowRight']||keys['d']||keys['D']) Player.state.moveRight=true;
    else if (!Player.state.moveRight_touch) Player.state.moveRight=false;
    
    if (keys['ArrowUp']||keys['w']||keys['W']||keys[' ']) { Player.state.jump=true; }
    if (keys['Shift']) Player.state.sprint=true; else if(!Player.state.sprint_touch) Player.state.sprint=false;
    
    // Hotbar selection (1-8)
    for (let i=1;i<=8;i++) {
      if (keys[String(i)]) { Player.state.hotbarSel=i-1; }
    }
    
    // Update world systems
    World.timeUpdate(dt);
    World.weatherUpdate(dt);
    World.spawnWeatherParticles(dt);
    Engine.windUpdate(dt);
    
    // Player update
    Player.update(dt, World);
    
    // Camera follow
    Engine.camUpdate(Player.state.x, Player.state.y - 10);
    
    // Ambient light based on time of day
    const tod = World.getTimeOfDay();
    const nightFactor = tod < 0.25 ? 1-tod/0.25 : tod > 0.75 ? (tod-0.75)/0.25 : 0;
    const r = Math.round(8 + (1-nightFactor)*12);
    const g = Math.round(10 + (1-nightFactor)*16);
    const b = Math.round(25 + (1-nightFactor)*35);
    Engine.setAmbient(r,g,b);
    
    // Particles update
    Engine.particleUpdate(dt, World.time.hour + World.time.minute/60);
    
    // Weather wind particles (wind lines)
    if (World.weather.current==='blizzard' && Math.random()<dt*5) {
      const wx=Engine.cam.x+(Math.random()-0.5)*Engine.W/Engine.cam.zoom;
      const wy=Engine.cam.y+(Math.random()-0.5)*Engine.H/Engine.cam.zoom;
      Engine.spawnParticle({
        x:wx, y:wy, vx:Engine.wind.strength*0.8+(Math.random()-0.5)*0.5, vy:0.2,
        life:1.5, size:0.8, color:`rgba(180,210,240,0.6)`, type:'circle',
        drag:0.99, fadeOut:true, windAffect:2
      });
    }
    
    // UI update
    UI.updateHUD(Player.state, World);
    
    // Mine key
    if (keys['e']||keys['E']) {
      startMineAtCursor();
    }
    if (keys['q']||keys['Q']) {
      placeAtCursor();
    }
  }
  
  function render(time) {
    const ctx = Engine.ctx;
    const W = Engine.W, H = Engine.H;
    const tod = World.getTimeOfDay();
    
    // Clear
    ctx.clearRect(0,0,W,H);
    
    // Sky
    Engine.drawSky(ctx, tod, World.weather.current);
    
    // Parallax bg mountains
    Engine.drawParallaxBG(ctx, Engine.cam.x, tod);
    
    // World tiles + lights
    Engine.clearLights();
    
    // Player warmth light if near fire
    const fireW = World.isNearFire(Player.state.x, Player.state.y, World.TILE*5);
    if (fireW > 0) Engine.addLight(Player.state.x, Player.state.y, fireW*2, 255,120,30, 0.7);
    
    // Torch player carries
    const selItem = Player.getSelectedItem();
    if (selItem?.id==='torch_item') {
      Engine.addLight(Player.state.x, Player.state.y-5, World.TILE*5, 255,180,60, 0.85);
    }
    
    World.render(ctx, Player.state.x, Player.state.y, tod);
    
    // Particles (world-space, under player)
    Engine.particleDraw(ctx);
    
    // Player
    Player.draw(ctx);
    
    // Cursor/target highlight
    UI.drawCursor(ctx, cursorTile.tx, cursorTile.ty, Player.state.miningProgress);
    
    // Lighting overlay
    Engine.drawLighting(ctx);
    
    // Screen frost effect when cold
    if (Player.state.warmth < 30) {
      const frostAlpha = (30-Player.state.warmth)/30 * 0.4;
      ctx.save();
      ctx.globalAlpha = frostAlpha;
      const grad = ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.8);
      grad.addColorStop(0,'rgba(120,180,240,0)');
      grad.addColorStop(1,'rgba(160,210,255,0.7)');
      ctx.fillStyle=grad;
      ctx.fillRect(0,0,W,H);
      // Frost crystals on edges
      if (frostAlpha > 0.2) {
        ctx.globalAlpha = frostAlpha*0.5;
        for (let i=0;i<20;i++) {
          const angle=Math.random()*Math.PI*2;
          const r=H*0.5-Math.random()*80;
          const fx=W/2+Math.cos(angle)*r, fy=H/2+Math.sin(angle)*r;
          ctx.strokeStyle='rgba(200,230,255,0.5)';
          ctx.lineWidth=0.5;
          ctx.beginPath();
          ctx.moveTo(fx,fy);
          for(let j=0;j<4;j++){
            const a2=j/4*Math.PI*2;
            const len=5+Math.random()*15;
            ctx.lineTo(fx+Math.cos(a2)*len,fy+Math.sin(a2)*len);
            ctx.moveTo(fx,fy);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    
    // Hunger darkness
    if (Player.state.hunger < 20) {
      const d = (20-Player.state.hunger)/20 * 0.3;
      ctx.save();
      ctx.globalAlpha=d;
      ctx.fillStyle='rgba(0,0,0,1)';
      const vgrad=ctx.createRadialGradient(W/2,H/2,H*0.15,W/2,H/2,H*0.7);
      vgrad.addColorStop(0,'rgba(0,0,0,0)');
      vgrad.addColorStop(1,'rgba(0,0,0,0.8)');
      ctx.fillStyle=vgrad;
      ctx.fillRect(0,0,W,H);
      ctx.restore();
    }
    
    // Time overlay (night darkness is handled by ambient light)
    
    // Debug info (dev)
    if (keys['`']) {
      ctx.fillStyle='rgba(255,255,255,0.6)';
      ctx.font='11px monospace';
      ctx.fillText(`pos: ${Math.round(Player.state.x)},${Math.round(Player.state.y)}  tiles: ${Math.floor(Player.state.x/World.TILE)},${Math.floor(Player.state.y/World.TILE)}`,10,H-40);
      ctx.fillText(`time: ${World.time.hour}:${String(Math.floor(World.time.minute)).padStart(2,'0')}  weather: ${World.weather.current}  wind: ${Engine.wind.strength.toFixed(1)}`,10,H-25);
      ctx.fillText(`particles: ${Engine.spawnParticle.length||0}`,10,H-10);
    }
  }
  
  // ---- INPUT SETUP ----
  function setupInput() {
    // Keyboard
    window.addEventListener('keydown',e=>{
      keys[e.key]=true;
      if(e.key==='i'||e.key==='I') Player.state.invOpen=!Player.state.invOpen;
      if(e.key==='c'||e.key==='C') Player.state.craftOpen=!Player.state.craftOpen;
      if(e.key==='e'||e.key==='E') startMineAtCursor();
      if(e.key==='f'||e.key==='F') { // Quick eat
        for (let i=0;i<Player.state.hotbar.length;i++) {
          const item=Player.state.hotbar[i];
          if(item && Items.get(item.id)?.type==='food') {
            Player.useItem(item.id,World);
            item.n--;
            if(item.n<=0)Player.state.hotbar[i]=null;
            break;
          }
        }
      }
    });
    window.addEventListener('keyup',e=>{ delete keys[e.key]; });
    
    // Mouse
    Engine.canvas.addEventListener('mousemove', e=>{
      const wp = Engine.screenToWorld(e.clientX, e.clientY);
      cursorTile.tx = Math.floor(wp.x/World.TILE);
      cursorTile.ty = Math.floor(wp.y/World.TILE);
    });
    
    Engine.canvas.addEventListener('click', e=>{
      if (e.button===0) {
        const wp = Engine.screenToWorld(e.clientX, e.clientY);
        const tx = Math.floor(wp.x/World.TILE);
        const ty = Math.floor(wp.y/World.TILE);
        // Check distance from player
        const pdx = Player.state.x - (tx*World.TILE+World.TILE/2);
        const pdy = Player.state.y - (ty*World.TILE+World.TILE/2);
        const dist = Math.sqrt(pdx*pdx+pdy*pdy);
        if (dist > World.TILE*4) return;
        const tileId = World.tileAt(tx,ty,0);
        if (tileId !== World.T.AIR) {
          Player.state.miningTarget = {tx,ty,layer:0};
          Player.state.miningProgress = 0;
        } else {
          // Interact with placed objects
          interactWith(tx,ty);
        }
      }
    });
    
    Engine.canvas.addEventListener('contextmenu', e=>{
      e.preventDefault();
      const wp = Engine.screenToWorld(e.clientX, e.clientY);
      const tx = Math.floor(wp.x/World.TILE);
      const ty = Math.floor(wp.y/World.TILE);
      attemptPlace(tx, ty);
    });
    
    // Touch
    let touchStart = null;
    let touchMineTimer = 0;
    let touchMineActive = false;
    
    Engine.canvas.addEventListener('touchstart', e=>{
      e.preventDefault();
      const t = e.touches[0];
      touchStart = {x:t.clientX, y:t.clientY, time:Date.now()};
      tapPos = {x:t.clientX, y:t.clientY};
      const wp = Engine.screenToWorld(t.clientX, t.clientY);
      cursorTile.tx = Math.floor(wp.x/World.TILE);
      cursorTile.ty = Math.floor(wp.y/World.TILE);
      touchMineActive = true;
    },{passive:false});
    
    Engine.canvas.addEventListener('touchmove', e=>{
      e.preventDefault();
      const t = e.touches[0];
      const wp = Engine.screenToWorld(t.clientX, t.clientY);
      cursorTile.tx = Math.floor(wp.x/World.TILE);
      cursorTile.ty = Math.floor(wp.y/World.TILE);
      if (touchStart && Math.hypot(t.clientX-touchStart.x, t.clientY-touchStart.y)>10) touchMineActive=false;
    },{passive:false});
    
    Engine.canvas.addEventListener('touchend', e=>{
      e.preventDefault();
      const elapsed = Date.now() - (touchStart?.time||0);
      if (touchMineActive) {
        const tx=cursorTile.tx, ty=cursorTile.ty;
        if (elapsed < 200) {
          // Quick tap = start mining
          const tileId=World.tileAt(tx,ty,0);
          if(tileId!==World.T.AIR) {
            Player.state.miningTarget={tx,ty};
            Player.state.miningProgress=0;
          } else { attemptPlace(tx,ty); }
        }
      }
      touchMineActive=false;
      touchStart=null;
    },{passive:false});
    
    // Mouse wheel for hotbar
    window.addEventListener('wheel',e=>{
      Player.state.hotbarSel = (Player.state.hotbarSel + (e.deltaY>0?1:-1) + 8) % 8;
    });
  }
  
  function startMineAtCursor() {
    if (cursorTile.tx===null) return;
    const {tx,ty}=cursorTile;
    const tileId=World.tileAt(tx,ty,0);
    if(tileId!==World.T.AIR){
      Player.state.miningTarget={tx,ty};
      Player.state.miningProgress=0;
    }
  }
  
  function placeAtCursor() {
    if (cursorTile.tx===null) return;
    attemptPlace(cursorTile.tx, cursorTile.ty);
  }
  
  function attemptPlace(tx, ty) {
    const sel = Player.getSelectedItem();
    if (!sel) return;
    const def = Items.get(sel.id);
    if (!def || def.type!=='placeable') return;
    // Distance check
    const pdx=Player.state.x-(tx*World.TILE+World.TILE/2);
    const pdy=Player.state.y-(ty*World.TILE+World.TILE/2);
    if(Math.sqrt(pdx*pdx+pdy*pdy)>World.TILE*5) return;
    const placed=Player.useItem(sel.id, World, tx, ty);
    if (placed) {
      sel.n--;
      if(sel.n<=0) Player.state.hotbar[Player.state.hotbarSel]=null;
      UI.showMsg(`Placed ${def.name}`);
    }
  }
  
  function interactWith(tx, ty) {
    const tileId = World.tileAt(tx,ty,0);
    if (tileId===World.T.WORKBENCH) {
      Player.state.craftOpen=true;
      UI.showMsg('Workbench: advanced crafting unlocked!');
    } else if (tileId===World.T.CHEST) {
      Player.state.invOpen=true;
      UI.showMsg('Chest (storage coming soon)');
    } else if (tileId===World.T.CAMPFIRE) {
      UI.showMsg('🔥 Warming up...');
    }
  }
  
  function respawn() {
    const spawnSurface = World.getSurface(0);
    Player.respawn(0, (spawnSurface-2)*World.TILE);
    Engine.cam.x = 0;
    Engine.cam.y = Player.state.y;
    UI.showMsg('You wake up again, cold and alone...', 'warn');
  }
  
  function showMsg(text, type) { UI.showMsg(text, type); }
  
  function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
  
  // Start the game
  window.addEventListener('load', ()=>{ init(); });
  
  return { init, respawn, startMineAtCursor, placeAtCursor, showMsg };
})();

// Expose globally for HTML buttons
window.game = { respawn: ()=>Game.respawn() };
