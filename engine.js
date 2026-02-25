// ============================================================
// ENGINE.JS - Renderer, Camera, Physics, Particles
// ============================================================

const Engine = (() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  
  let W = 0, H = 0;
  
  // Camera
  const cam = { x: 0, y: 0, targetX: 0, targetY: 0, zoom: 2.0, shake: 0, shakeX: 0, shakeY: 0 };
  
  // Particle system
  const particles = [];
  
  // Wind
  const wind = { strength: 0, targetStrength: 0, direction: 1, timer: 0, gusts: [] };
  
  // Lighting
  const lights = [];
  let ambientLight = { r: 20, g: 30, b: 60 };
  let lightCanvas = null, lightCtx = null;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = W; lightCanvas.height = H;
    lightCtx = lightCanvas.getContext('2d');
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- CAMERA ----
  function camUpdate(tx, ty) {
    cam.targetX = tx; cam.targetY = ty;
    cam.x += (cam.targetX - cam.x) * 0.08;
    cam.y += (cam.targetY - cam.y) * 0.08;
    if (cam.shake > 0) {
      cam.shakeX = (Math.random()-0.5)*cam.shake;
      cam.shakeY = (Math.random()-0.5)*cam.shake;
      cam.shake *= 0.85;
    } else { cam.shakeX=0; cam.shakeY=0; }
  }
  function camShake(amt) { cam.shake = Math.max(cam.shake, amt); }
  function worldToScreen(wx, wy) {
    return {
      x: (wx - cam.x) * cam.zoom + W/2 + cam.shakeX,
      y: (wy - cam.y) * cam.zoom + H/2 + cam.shakeY
    };
  }
  function screenToWorld(sx, sy) {
    return {
      x: (sx - W/2 - cam.shakeX) / cam.zoom + cam.x,
      y: (sy - H/2 - cam.shakeY) / cam.zoom + cam.y
    };
  }
  function getVisibleTiles(tileSize) {
    const margin = tileSize * 3;
    const tl = screenToWorld(-margin, -margin);
    const br = screenToWorld(W+margin, H+margin);
    return {
      x0: Math.floor(tl.x/tileSize), y0: Math.floor(tl.y/tileSize),
      x1: Math.ceil(br.x/tileSize),  y1: Math.ceil(br.y/tileSize)
    };
  }

  // ---- WIND ----
  function windUpdate(dt) {
    wind.timer -= dt;
    if (wind.timer <= 0) {
      wind.targetStrength = (Math.random()*2.5) * wind.direction;
      if (Math.random()<0.3) wind.direction *= -1;
      wind.timer = 3 + Math.random()*5;
      if (Math.random()<0.2) {
        wind.gusts.push({ strength: 4+Math.random()*4, life: 0.8, maxLife: 0.8 });
      }
    }
    wind.strength += (wind.targetStrength - wind.strength) * 0.02 * dt * 60;
    for (let i=wind.gusts.length-1; i>=0; i--) {
      wind.gusts[i].life -= dt;
      if (wind.gusts[i].life <= 0) wind.gusts.splice(i,1);
    }
  }
  function getWindAt(x, y, time) {
    let w = wind.strength;
    for (const g of wind.gusts) w += g.strength * (g.life/g.maxLife) * wind.direction;
    // Perlin-like variation
    w += Math.sin(x*0.01 + time*0.5) * 0.4;
    w += Math.cos(y*0.02 + time*0.3) * 0.2;
    return w;
  }

  // ---- PARTICLES ----
  function spawnParticle(p) {
    particles.push({
      x:p.x, y:p.y, vx:p.vx||0, vy:p.vy||0,
      life:p.life||1, maxLife:p.life||1,
      size:p.size||3, color:p.color||'#fff',
      gravity:p.gravity||0, drag:p.drag||0.99,
      type:p.type||'dot', spin:p.spin||0, angle:p.angle||0,
      windAffect:p.windAffect||0, glow:p.glow||0,
      fadeOut:p.fadeOut!==false
    });
  }
  function spawnBurst(x,y,n,opts) {
    for (let i=0;i<n;i++) {
      const angle = Math.random()*Math.PI*2;
      const spd = (opts.speed||1) * (0.5+Math.random()*0.5);
      spawnParticle({x,y,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd,...opts});
    }
  }
  function particleUpdate(dt, time) {
    const wf = wind.strength * 0.3;
    for (let i=particles.length-1; i>=0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i,1); continue; }
      p.vx += p.windAffect * wf * dt * 60 * 0.016;
      p.vy += p.gravity * dt * 60 * 0.016;
      p.vx *= Math.pow(p.drag, dt*60);
      p.vy *= Math.pow(p.drag, dt*60);
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.angle += p.spin * dt;
    }
  }
  function particleDraw(ctx) {
    for (const p of particles) {
      const t = p.life/p.maxLife;
      const alpha = p.fadeOut ? t : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.glow * t * cam.zoom;
      }
      const s = p.worldSpace ? worldToScreen(p.x, p.y) : {x:p.x*cam.zoom,y:p.y*cam.zoom};
      const sz = (p.worldSpace||true) ? p.size * cam.zoom * (p.fadeOut?t:1) : p.size;
      if (p.worldSpace !== false) {
        const ws = worldToScreen(p.x, p.y);
        const drawSz = p.size * cam.zoom;
        ctx.fillStyle = p.color;
        if (p.type==='circle') {
          ctx.beginPath();
          ctx.arc(ws.x, ws.y, drawSz*(p.fadeOut?(0.3+t*0.7):1), 0, Math.PI*2);
          ctx.fill();
        } else if (p.type==='star') {
          ctx.translate(ws.x, ws.y);
          ctx.rotate(p.angle);
          ctx.beginPath();
          for (let j=0;j<6;j++) {
            const a = j/6*Math.PI*2;
            const r = j%2===0?drawSz:drawSz*0.4;
            j===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
          }
          ctx.closePath(); ctx.fill();
        } else if (p.type==='snow') {
          ctx.translate(ws.x, ws.y);
          const sz2 = drawSz * (p.fadeOut?(0.5+t*0.5):1);
          ctx.beginPath();
          ctx.arc(0,0,sz2,0,Math.PI*2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        } else {
          ctx.fillRect(ws.x-drawSz/2, ws.y-drawSz/2, drawSz, drawSz);
        }
      }
      ctx.restore();
    }
  }

  // ---- LIGHTING ----
  function addLight(x, y, radius, r, g, b, intensity) {
    lights.push({x,y,radius,r,g,b,intensity:intensity||1});
  }
  function clearLights() { lights.length = 0; }
  function drawLighting(ctx) {
    if (!lightCtx) return;
    const lc = lightCtx;
    const a = ambientLight;
    lc.clearRect(0,0,W,H);
    lc.fillStyle = `rgb(${a.r},${a.g},${a.b})`;
    lc.globalCompositeOperation = 'source-over';
    lc.globalAlpha = 0.92;
    lc.fillRect(0,0,W,H);
    lc.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const s = worldToScreen(l.x, l.y);
      const r = l.radius * cam.zoom;
      const g = lc.createRadialGradient(s.x,s.y,0,s.x,s.y,r);
      g.addColorStop(0, `rgba(0,0,0,${l.intensity*0.95})`);
      g.addColorStop(0.4, `rgba(0,0,0,${l.intensity*0.7})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.beginPath();
      lc.arc(s.x, s.y, r, 0, Math.PI*2);
      lc.fill();
    }
    lc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(lightCanvas, 0, 0);
    ctx.restore();
  }

  // ---- DRAW HELPERS ----
  function drawPixelSprite(ctx, sprite, wx, wy, scale, flipX, alpha, tint) {
    const s = worldToScreen(wx, wy);
    const px = cam.zoom * scale;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (tint) { ctx.filter = `sepia(1) saturate(3) hue-rotate(${tint}deg)`; }
    ctx.translate(s.x, s.y);
    if (flipX) ctx.scale(-1,1);
    for (const [row, col, color, w, h] of sprite) {
      ctx.fillStyle = color;
      ctx.fillRect(col*px, row*px, (w||1)*px, (h||1)*px);
    }
    ctx.restore();
  }

  // Sky gradient based on time of day
  function drawSky(ctx, timeOfDay, weather) {
    // timeOfDay: 0-1 (0=midnight, 0.5=noon)
    const colors = getSkyColors(timeOfDay, weather);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, colors.top);
    grad.addColorStop(0.6, colors.mid);
    grad.addColorStop(1, colors.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Stars at night
    if (timeOfDay < 0.25 || timeOfDay > 0.75) {
      const starAlpha = Math.min(1, Math.max(0, (timeOfDay<0.25 ? 0.25-timeOfDay : timeOfDay-0.75)*8));
      drawStars(ctx, starAlpha);
    }
    // Sun or Moon
    drawCelestial(ctx, timeOfDay, weather);
    // Fog layer bottom
    if (weather === 'blizzard' || weather === 'fog') {
      const fogAlpha = weather==='blizzard' ? 0.5 : 0.35;
      const fogGrad = ctx.createLinearGradient(0, H*0.5, 0, H);
      fogGrad.addColorStop(0, `rgba(180,210,240,0)`);
      fogGrad.addColorStop(1, `rgba(180,210,240,${fogAlpha})`);
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, W, H);
    }
  }
  
  function getSkyColors(t, weather) {
    // t: 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk, 1=midnight
    let top, mid, bot;
    if (t < 0.2 || t > 0.8) { // night
      top='#010810'; mid='#020a14'; bot='#04111e';
    } else if (t < 0.28) { // dawn
      const f=(t-0.2)/0.08;
      top=lerpColor('#010810','#1a0a2e',f); mid=lerpColor('#020a14','#8b3a2a',f); bot=lerpColor('#04111e','#c4622d',f);
    } else if (t < 0.45) { // morning
      const f=(t-0.28)/0.17;
      top=lerpColor('#1a0a2e','#0a1a3a',f); mid=lerpColor('#8b3a2a','#1a4a6e',f); bot=lerpColor('#c4622d','#3a8aaa',f);
    } else if (t < 0.55) { // noon
      top='#0a1833'; mid='#0e2a50'; bot='#1a4a70';
    } else if (t < 0.72) { // afternoon
      top='#071428'; mid='#0d2245'; bot='#163c68';
    } else if (t < 0.8) { // dusk
      const f=(t-0.72)/0.08;
      top=lerpColor('#071428','#1a0a2e',f); mid=lerpColor('#0d2245','#7a3028',f); bot=lerpColor('#163c68','#b05828',f);
    }
    if (weather==='blizzard') { top=darkenColor(top); mid=darkenColor(mid); bot=darkenColor(bot); }
    if (weather==='overcast') { top='#141820'; mid='#1e2430'; bot='#262e3c'; }
    return {top,mid,bot};
  }

  const starCache = [];
  function buildStarCache() {
    for (let i=0;i<200;i++) {
      starCache.push({ x:Math.random()*2000, y:Math.random()*600, r:Math.random()*1.5+0.3, b:0.3+Math.random()*0.7 });
    }
  }
  buildStarCache();
  function drawStars(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const s of starCache) {
      const sx = (s.x - cam.x * 0.02) % W;
      const tw = Math.sin(Date.now()*0.001*s.b*0.5)*0.3+0.7;
      ctx.globalAlpha = alpha * s.b * tw;
      ctx.fillStyle = '#e0ecff';
      ctx.beginPath();
      ctx.arc(sx < 0 ? sx+W : sx, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawCelestial(ctx, t, weather) {
    const opacity = (weather==='blizzard'||weather==='overcast') ? 0.3 : 1;
    // Sun arc: rises at t=0.25, peaks at t=0.5, sets at t=0.75
    const sunT = (t - 0.25) / 0.5; // 0 to 1 during day
    if (sunT >= 0 && sunT <= 1) {
      const sx = W * sunT;
      const sy = H*0.1 + Math.sin(sunT*Math.PI) * (-H*0.35);
      ctx.save();
      ctx.globalAlpha = opacity;
      // Glow
      const glow = ctx.createRadialGradient(sx,sy,0,sx,sy,80);
      glow.addColorStop(0,'rgba(255,240,180,0.25)');
      glow.addColorStop(1,'rgba(255,240,180,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx-80,sy-80,160,160);
      // Sun
      ctx.fillStyle = '#fff8e0';
      ctx.shadowColor='#ffe080'; ctx.shadowBlur=30;
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
    // Moon
    const moonT = ((t+0.5)%1 - 0.25)/0.5;
    if (moonT>=0 && moonT<=1 && (t<0.25||t>0.75)) {
      const mx = W * moonT;
      const my = H*0.1 + Math.sin(moonT*Math.PI)*(-H*0.3);
      ctx.save();
      ctx.globalAlpha = 0.9*opacity;
      ctx.fillStyle = '#c8d8f0';
      ctx.shadowColor='#8090b0'; ctx.shadowBlur=20;
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI*2);
      ctx.fill();
      // Crescent
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.beginPath();
      ctx.arc(mx+4, my-2, 9, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Mountains in bg parallax
  function drawParallaxBG(ctx, worldX, timeOfDay) {
    const colors = [
      `rgba(15,20,40,0.9)`,`rgba(20,28,52,0.85)`,`rgba(25,35,60,0.8)`
    ];
    for (let layer=0; layer<3; layer++) {
      const parallax = 0.1 + layer*0.15;
      const offsetX = worldX * parallax * cam.zoom;
      const h = H * (0.35 - layer*0.06);
      ctx.fillStyle = colors[layer];
      ctx.beginPath();
      ctx.moveTo(0, H);
      const segs = Math.ceil(W/40)+2;
      for (let i=0; i<=segs; i++) {
        const px = i * W/segs;
        const wx = (px - offsetX % W) / cam.zoom * 0.5 + worldX*parallax;
        const noiseH = h + smoothNoise(wx * 0.003 + layer*100) * H*0.18 - H*0.05;
        i===0 ? ctx.moveTo(px, H-noiseH) : ctx.lineTo(px, H-noiseH);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      // Snow caps
      ctx.fillStyle = `rgba(200,220,240,0.${8-layer*2})`;
      ctx.beginPath();
      for (let i=0; i<=segs; i++) {
        const px = i * W/segs;
        const wx = (px - offsetX % W) / cam.zoom * 0.5 + worldX*parallax;
        const noiseH = h + smoothNoise(wx * 0.003 + layer*100) * H*0.18 - H*0.05;
        const snowH = Math.max(0, noiseH - H*0.05);
        i===0 ? ctx.moveTo(px, H-noiseH) : ctx.lineTo(px, H-noiseH);
      }
      ctx.lineTo(W, H); ctx.closePath();
      // Don't fill full - just cap effect done above
    }
  }

  // Noise helpers
  function smoothNoise(x) {
    const xi = Math.floor(x), xf = x-xi;
    const a = pseudoRand(xi), b = pseudoRand(xi+1);
    return lerp(a,b, xf*xf*(3-2*xf));
  }
  function pseudoRand(n) {
    n = (n<<13)^n;
    return (1 - ((n*(n*n*15731+789221)+1376312589)&0x7fffffff)/1073741824) * 0.5 + 0.5;
  }
  function lerp(a,b,t) { return a+(b-a)*t; }
  function lerpColor(c1,c2,t) {
    const p1=parseColor(c1), p2=parseColor(c2);
    return `rgb(${Math.round(lerp(p1[0],p2[0],t))},${Math.round(lerp(p1[1],p2[1],t))},${Math.round(lerp(p1[2],p2[2],t))})`;
  }
  function parseColor(c) {
    const m=c.match(/[\da-f]{2}/gi);
    if(m) return m.map(v=>parseInt(v,16));
    return [0,0,0];
  }
  function darkenColor(c) {
    const p=parseColor(c);
    return `rgb(${Math.round(p[0]*0.5)},${Math.round(p[1]*0.5)},${Math.round(p[2]*0.55)})`;
  }

  // ---- DRAW TILE ----
  const tileGfx = {};
  function registerTile(id, drawFn) { tileGfx[id] = drawFn; }
  function drawTile(ctx, id, sx, sy, tileW, tileH, variant, meta, time) {
    if (tileGfx[id]) tileGfx[id](ctx, sx, sy, tileW, tileH, variant||0, meta||{}, time||0);
  }

  return {
    canvas, ctx, get W(){return W}, get H(){return H},
    cam, wind,
    camUpdate, camShake, worldToScreen, screenToWorld, getVisibleTiles,
    windUpdate, getWindAt,
    spawnParticle, spawnBurst, particleUpdate, particleDraw,
    addLight, clearLights, drawLighting, setAmbient(r,g,b){ambientLight={r,g,b};},
    drawPixelSprite, drawSky, drawParallaxBG, drawTile,
    registerTile, smoothNoise, pseudoRand, lerp, lerpColor, parseColor,
    resize
  };
})();
