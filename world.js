// ============================================================
// WORLD.JS - World generation, tiles, weather, plants, chunks
// ============================================================

const World = (() => {
  const TILE = 16;
  const CHUNK_W = 32, CHUNK_H = 64;
  const WORLD_H = 128; // tiles height
  
  // Tile IDs
  const T = {
    AIR:0, STONE:1, DIRT:2, GRASS:3, SNOW:4, ICE:5,
    WOOD:6, LEAVES:7, LOG:8, COAL:9, IRON:10, GOLD:11, CRYSTAL:12,
    WATER:13, DEEP_ICE:14, SAND:15, GRAVEL:16,
    WALL_LOG:17, WALL_STONE:18, WALL_ICE_BRICK:19,
    FLOOR_PLANK:20, FLOOR_STONE:21,
    TORCH:22, CAMPFIRE:23, CHEST:24, WORKBENCH:25,
    DOOR:26, WINDOW:27
  };

  // Tile properties
  const TILE_PROPS = {
    [T.AIR]:    {solid:false, name:'Air',         hardness:0, light:0},
    [T.STONE]:  {solid:true,  name:'Stone',        hardness:3, light:0, drops:[{id:'stone',n:2}]},
    [T.DIRT]:   {solid:true,  name:'Dirt',         hardness:1, light:0, drops:[{id:'dirt',n:2}]},
    [T.GRASS]:  {solid:true,  name:'Grass',        hardness:1, light:0, drops:[{id:'dirt',n:1}]},
    [T.SNOW]:   {solid:true,  name:'Snow',         hardness:1, light:0, drops:[{id:'snowball',n:2}]},
    [T.ICE]:    {solid:true,  name:'Ice',          hardness:2, light:0, drops:[{id:'ice_chunk',n:1}]},
    [T.WOOD]:   {solid:true,  name:'Wood',         hardness:2, light:0, drops:[{id:'wood',n:2}]},
    [T.LEAVES]: {solid:false, name:'Leaves',       hardness:1, light:0, drops:[{id:'wood',n:0},{id:'stick',n:1,chance:0.3}]},
    [T.LOG]:    {solid:true,  name:'Log',          hardness:2, light:0, drops:[{id:'wood',n:3}]},
    [T.COAL]:   {solid:true,  name:'Coal Ore',     hardness:3, light:0, drops:[{id:'coal',n:2}]},
    [T.IRON]:   {solid:true,  name:'Iron Ore',     hardness:4, light:0, drops:[{id:'iron_ore',n:1}]},
    [T.GOLD]:   {solid:true,  name:'Gold Ore',     hardness:5, light:0, drops:[{id:'gold_ore',n:1}]},
    [T.CRYSTAL]:{solid:true,  name:'Ice Crystal',  hardness:4, light:3, drops:[{id:'crystal',n:1}]},
    [T.WATER]:  {solid:false, name:'Water',        hardness:0, light:0},
    [T.DEEP_ICE]:{solid:true, name:'Deep Ice',     hardness:5, light:1, drops:[{id:'deep_ice',n:1}]},
    [T.SAND]:   {solid:true,  name:'Sand',         hardness:1, light:0, drops:[{id:'sand',n:2}]},
    [T.GRAVEL]: {solid:true,  name:'Gravel',       hardness:2, light:0, drops:[{id:'gravel',n:2}]},
    [T.WALL_LOG]:{solid:false,name:'Log Wall',     hardness:2, light:0, isWall:true},
    [T.WALL_STONE]:{solid:false,name:'Stone Wall', hardness:3, light:0, isWall:true},
    [T.WALL_ICE_BRICK]:{solid:false,name:'Ice Brick',hardness:3,light:0,isWall:true},
    [T.FLOOR_PLANK]:{solid:false,name:'Plank Floor',hardness:1,light:0,isFloor:true},
    [T.FLOOR_STONE]:{solid:false,name:'Stone Floor',hardness:2,light:0,isFloor:true},
    [T.TORCH]:  {solid:false, name:'Torch',        hardness:1, light:6, isObject:true},
    [T.CAMPFIRE]:{solid:false,name:'Campfire',     hardness:1, light:8, isObject:true, warmth:5},
    [T.CHEST]:  {solid:true,  name:'Chest',        hardness:2, light:0, isObject:true},
    [T.WORKBENCH]:{solid:true,name:'Workbench',    hardness:2, light:0, isObject:true},
    [T.DOOR]:   {solid:true,  name:'Door',         hardness:1, light:0, isObject:true},
    [T.WINDOW]: {solid:false, name:'Window',       hardness:2, light:0, isObject:true},
  };

  // Chunk storage
  const chunks = new Map();
  
  // Weather system
  const weather = {
    current: 'clear',
    next: 'clear',
    timer: 60,
    transition: 0,
    temperature: -5,
    targetTemp: -5,
    snowAccum: 0,
    types: ['clear','overcast','snow','blizzard','fog','clear','clear','snow'],
    windFx: []
  };
  
  // Plant sway data per tile
  const plantSway = new Map();

  // Time of day
  const time = { day: 0, hour: 8, minute: 0, speed: 0.5 }; // speed = game mins per real sec

  // ---- CHUNK MANAGEMENT ----
  function chunkKey(cx, cy) { return `${cx},${cy}`; }
  
  function getChunk(cx, cy) {
    const k = chunkKey(cx,cy);
    if (!chunks.has(k)) chunks.set(k, generateChunk(cx, cy));
    return chunks.get(k);
  }
  
  function tileAt(tx, ty, layer) {
    // layer 0=main, 1=bg(wall/floor)
    const cx = Math.floor(tx/CHUNK_W), cy = Math.floor(ty/CHUNK_H);
    const chunk = getChunk(cx,cy);
    const lx = ((tx%CHUNK_W)+CHUNK_W)%CHUNK_W;
    const ly = ((ty%CHUNK_H)+CHUNK_H)%CHUNK_H;
    if (layer===1) return chunk.bg[ly*CHUNK_W+lx] || T.AIR;
    return chunk.fg[ly*CHUNK_W+lx] || T.AIR;
  }
  
  function setTile(tx, ty, id, layer) {
    const cx = Math.floor(tx/CHUNK_W), cy = Math.floor(ty/CHUNK_H);
    const chunk = getChunk(cx,cy);
    const lx = ((tx%CHUNK_W)+CHUNK_W)%CHUNK_W;
    const ly = ((ty%CHUNK_H)+CHUNK_H)%CHUNK_H;
    if (layer===1) chunk.bg[ly*CHUNK_W+lx] = id;
    else chunk.fg[ly*CHUNK_W+lx] = id;
    chunk.dirty = true;
  }

  // ---- WORLD GENERATION ----
  const SEED = Math.floor(Math.random()*99999);
  function noise(x, scale, seed) {
    return Engine.smoothNoise((x+seed)*scale);
  }
  function noise2(x, y, scale, seed) {
    return (Engine.smoothNoise((x+seed)*scale) + Engine.smoothNoise((y+seed+7777)*scale)) * 0.5;
  }
  
  function getSurface(tx) {
    // Multiple octaves for terrain
    const base = WORLD_H * 0.38;
    let h = 0;
    h += noise(tx, 0.008, SEED) * 18;
    h += noise(tx, 0.02, SEED+1) * 8;
    h += noise(tx, 0.06, SEED+2) * 3;
    // Mountains
    const mtn = noise(tx, 0.004, SEED+500);
    if (mtn > 0.6) h += (mtn-0.6)*80;
    // Valleys
    const val = noise(tx, 0.005, SEED+999);
    if (val < 0.3) h -= (0.3-val)*15;
    return Math.round(base + h);
  }
  
  function getBiome(tx) {
    const b = noise(tx, 0.003, SEED+2000);
    if (b < 0.2) return 'tundra';
    if (b < 0.45) return 'taiga';
    if (b < 0.7) return 'alpine';
    return 'glacier';
  }
  
  function generateChunk(cx, cy) {
    const fg = new Uint8Array(CHUNK_W*CHUNK_H);
    const bg = new Uint8Array(CHUNK_W*CHUNK_H);
    const variant = new Uint8Array(CHUNK_W*CHUNK_H);
    const meta = {};
    
    for (let lx=0; lx<CHUNK_W; lx++) {
      const tx = cx*CHUNK_W + lx;
      const surfaceY = getSurface(tx);
      const biome = getBiome(tx);
      
      for (let ly=0; ly<CHUNK_H; ly++) {
        const ty = cy*CHUNK_H + ly;
        const idx = ly*CHUNK_W+lx;
        
        if (ty < surfaceY - 40) {
          // Deep underground
          const cave = noise2(tx,ty,0.08,SEED+300) > 0.62;
          if (!cave) {
            fg[idx] = T.STONE;
            bg[idx] = T.WALL_STONE;
            // Ores
            const oreRoll = noise2(tx,ty,0.15,SEED+400);
            if (oreRoll > 0.78) fg[idx] = T.COAL;
            else if (oreRoll > 0.86) fg[idx] = T.IRON;
            else if (oreRoll > 0.92) fg[idx] = T.GOLD;
            else if (oreRoll > 0.96) fg[idx] = T.CRYSTAL;
            // Deep ice pockets
            if (noise2(tx,ty,0.05,SEED+600)>0.72 && ty > surfaceY+10) fg[idx] = T.DEEP_ICE;
          }
        } else if (ty < surfaceY - 3) {
          const cave = noise2(tx,ty,0.07,SEED+301) > 0.65;
          if (!cave) {
            fg[idx] = T.STONE;
            bg[idx] = T.WALL_STONE;
            const oreRoll = noise2(tx,ty,0.12,SEED+401);
            if (oreRoll > 0.82) fg[idx] = T.COAL;
            else if (oreRoll > 0.90) fg[idx] = T.IRON;
          }
        } else if (ty < surfaceY) {
          fg[idx] = T.DIRT;
          bg[idx] = T.WALL_STONE;
        } else if (ty === surfaceY) {
          // Surface tile based on biome
          if (biome === 'glacier') fg[idx] = T.ICE;
          else if (biome === 'alpine') fg[idx] = T.SNOW;
          else if (biome === 'tundra') {
            fg[idx] = T.GRASS;
            variant[idx] = Math.floor(noise2(tx,ty,1,SEED+700)*3);
          } else {
            fg[idx] = T.SNOW;
          }
          bg[idx] = T.WALL_STONE;
        } else if (ty === surfaceY+1) {
          fg[idx] = T.DIRT;
        } else if (ty > surfaceY) {
          fg[idx] = T.AIR;
        }
      }
      
      // Trees / plants on surface
      const surfaceTile = fg[(surfaceY - cy*CHUNK_H)*CHUNK_W+lx];
      if ((surfaceTile === T.GRASS || surfaceTile === T.SNOW) && cy*CHUNK_H <= surfaceY && surfaceY < (cy+1)*CHUNK_H) {
        const treeChance = noise(tx, 0.5, SEED+800);
        const ly_s = surfaceY - cy*CHUNK_H - 1;
        if (ly_s >= 0 && ly_s < CHUNK_H) {
          if (biome === 'taiga' && treeChance > 0.55) {
            placeTree(fg, bg, variant, cx, cy, lx, ly_s, 'pine');
          } else if (biome === 'tundra' && treeChance > 0.7) {
            placeTree(fg, bg, variant, cx, cy, lx, ly_s, 'dead');
          } else if (treeChance > 0.4 && treeChance < 0.5) {
            // Grass tufts / bushes
            const pidx = ly_s*CHUNK_W+lx;
            if (fg[pidx]===T.AIR) { fg[pidx]=T.LEAVES; variant[pidx]=3; }
          }
        }
      }
    }
    
    return { fg, bg, variant, meta, dirty:false };
  }
  
  function placeTree(fg, bg, variant, cx, cy, lx, ly_s, type) {
    const treeH = type==='pine' ? 6+Math.floor(Math.random()*3) : 4+Math.floor(Math.random()*2);
    for (let i=1; i<=treeH; i++) {
      const idx=(ly_s-i)*CHUNK_W+lx;
      if(idx<0||idx>=CHUNK_W*CHUNK_H) break;
      fg[idx]=T.LOG;
    }
    // Crown
    if (type==='pine') {
      for (let layer=0; layer<4; layer++) {
        const w = 3-Math.floor(layer*0.6);
        for (let dx=-w; dx<=w; dx++) {
          const px=lx+dx, py=ly_s-treeH-layer+1;
          if(px<0||px>=CHUNK_W||py<0||py>=CHUNK_H) continue;
          const idx=py*CHUNK_W+px;
          if(fg[idx]===T.AIR||fg[idx]===T.LEAVES) { fg[idx]=T.LEAVES; variant[idx]=type==='pine'?1:2; }
        }
      }
    } else {
      for (let dy=-2; dy<=0; dy++) {
        for (let dx=-2; dx<=2; dx++) {
          const px=lx+dx, py=ly_s-treeH+dy;
          if(px<0||px>=CHUNK_W||py<0||py>=CHUNK_H) continue;
          if(Math.abs(dx)+Math.abs(dy)<=3) {
            const idx=py*CHUNK_W+px;
            if(fg[idx]===T.AIR) { fg[idx]=T.LEAVES; variant[idx]=2; }
          }
        }
      }
    }
  }

  // ---- TILE GRAPHICS REGISTRATION ----
  function initTileGraphics() {
    const E = Engine;
    const T2 = T;
    
    // Color palettes for tiles
    const colors = {
      stone:  ['#5a6070','#6a7085','#4e5565','#787e8f'],
      dirt:   ['#6b4e32','#7a5a3c','#5c4028','#7d6244'],
      grass:  ['#3a7a3a','#4a9040','#2d6030','#5aa050'],
      snow:   ['#c8d8f0','#d8e8ff','#b8c8e0','#e0eeff'],
      ice:    ['#a0c8e8','#b0d8f8','#88b8d8','#c0e0f8'],
      log:    ['#5c3a1e','#6e4a28','#4a2e14','#7a5030'],
      leaves_green:['#2d5e2d','#366a33','#255025','#3a7038'],
      leaves_pine: ['#1e4a2e','#25583a','#163c24','#2c6040'],
      leaves_dead: ['#4a3a28','#5a4830','#3c3020','#6a5038'],
      leaves_bush: ['#2a5030','#325e38','#234228','#3a6840'],
      coal:   ['#2e2e35','#383845','#242430','#484858'],
      iron:   ['#8a6e58','#9a7e68','#7a5e48','#aa8e78'],
      gold:   ['#c8a030','#d8b040','#b89028','#e0c050'],
      crystal:['#60b8e8','#80d0f8','#40a0d0','#a0e0ff'],
      deepice:['#304870','#40588a','#203860','#507090'],
    };

    function pixelTile(ctx, sx, sy, tw, th, colors, pattern) {
      const pw = tw/8, ph = th/8;
      for (let row=0; row<8; row++) for (let col=0; col<8; col++) {
        const ci = pattern[row][col];
        ctx.fillStyle = colors[ci];
        ctx.fillRect(sx+col*pw, sy+row*ph, pw+0.5, ph+0.5);
      }
    }
    
    function noiseTile(ctx, sx, sy, tw, th, cols, seed) {
      for (let row=0; row<8; row++) for (let col=0; col<8; col++) {
        const n = Engine.smoothNoise((sx/tw*8+col+seed)*0.4)*cols.length;
        const n2 = Engine.smoothNoise((sy/th*8+row+seed*1.7)*0.4)*(cols.length-1);
        const ci = Math.floor((n+n2)/2) % cols.length;
        ctx.fillStyle = cols[ci];
        const pw=tw/8, ph=th/8;
        ctx.fillRect(sx+col*pw, sy+row*ph, pw+0.5, ph+0.5);
      }
    }

    E.registerTile(T2.STONE, (ctx,sx,sy,tw,th,v) => {
      noiseTile(ctx,sx,sy,tw,th,colors.stone,1);
      // Crack detail
      if(v===1){ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(sx+tw*0.3,sy+th*0.2);ctx.lineTo(sx+tw*0.5,sy+th*0.6);ctx.stroke();}
    });
    
    E.registerTile(T2.DIRT, (ctx,sx,sy,tw,th) => {
      noiseTile(ctx,sx,sy,tw,th,colors.dirt,2);
    });
    
    E.registerTile(T2.GRASS, (ctx,sx,sy,tw,th,v) => {
      noiseTile(ctx,sx,sy,tw,th,colors.dirt,2);
      // Top grass strip
      const topH = Math.round(th*0.3);
      for(let col=0;col<8;col++){
        const n=Engine.smoothNoise((sx/tw*8+col+5)*0.5);
        const h2=Math.round(topH*(0.7+n*0.3));
        ctx.fillStyle=colors.grass[Math.floor(n*3)%colors.grass.length];
        ctx.fillRect(sx+col*(tw/8),sy,tw/8+0.5,h2);
      }
    });
    
    E.registerTile(T2.SNOW, (ctx,sx,sy,tw,th) => {
      noiseTile(ctx,sx,sy,tw,th,colors.snow,3);
    });
    
    E.registerTile(T2.ICE, (ctx,sx,sy,tw,th) => {
      noiseTile(ctx,sx,sy,tw,th,colors.ice,4);
      // Reflective highlights
      ctx.fillStyle='rgba(255,255,255,0.15)';
      ctx.fillRect(sx+tw*0.1,sy+th*0.1,tw*0.2,th*0.1);
      ctx.fillRect(sx+tw*0.6,sy+th*0.6,tw*0.15,th*0.08);
    });
    
    E.registerTile(T2.LOG, (ctx,sx,sy,tw,th) => {
      // Vertical log
      for(let col=0;col<8;col++){
        const shade = colors.log[col%2===0?0:1];
        ctx.fillStyle=shade;
        ctx.fillRect(sx+col*(tw/8),sy,tw/8+0.5,th);
      }
      // Ring on top
      ctx.strokeStyle=colors.log[2];ctx.lineWidth=0.8;
      ctx.beginPath();ctx.ellipse(sx+tw/2,sy+th*0.15,tw*0.3,th*0.1,0,0,Math.PI*2);ctx.stroke();
    });
    
    E.registerTile(T2.LEAVES, (ctx,sx,sy,tw,th,v,meta,time) => {
      const col = v===1?colors.leaves_pine : v===2?colors.leaves_dead : v===3?colors.leaves_bush : colors.leaves_green;
      // Sway with wind
      const sway = Engine.getWindAt(sx,sy,time);
      ctx.save();
      ctx.translate(sx+tw/2, sy+th*0.8);
      ctx.rotate(sway*0.04);
      ctx.translate(-tw/2,-th*0.8);
      noiseTile(ctx,0,0,tw,th,col,v*10);
      // Sparkles / frost
      if(v===1){
        ctx.fillStyle='rgba(200,230,255,0.3)';
        ctx.fillRect(Math.random()>0.9?tw*0.2:0,Math.random()>0.9?th*0.1:0,2,2);
      }
      ctx.restore();
    });
    
    E.registerTile(T2.COAL, (ctx,sx,sy,tw,th) => {
      noiseTile(ctx,sx,sy,tw,th,colors.stone,1);
      // Coal veins
      ctx.fillStyle=colors.coal[0];
      ctx.fillRect(sx+tw*0.2,sy+th*0.3,tw*0.6,th*0.4);
      ctx.fillStyle=colors.coal[1];
      ctx.fillRect(sx+tw*0.35,sy+th*0.4,tw*0.3,th*0.2);
    });
    
    E.registerTile(T2.IRON, (ctx,sx,sy,tw,th) => {
      noiseTile(ctx,sx,sy,tw,th,colors.stone,1);
      ctx.fillStyle=colors.iron[0];
      ctx.fillRect(sx+tw*0.25,sy+th*0.25,tw*0.5,th*0.5);
      ctx.fillStyle=colors.iron[2];
      ctx.fillRect(sx+tw*0.35,sy+th*0.35,tw*0.3,th*0.3);
    });
    
    E.registerTile(T2.GOLD, (ctx,sx,sy,tw,th,v,m,time) => {
      noiseTile(ctx,sx,sy,tw,th,colors.stone,1);
      ctx.fillStyle=colors.gold[0];
      ctx.fillRect(sx+tw*0.3,sy+th*0.3,tw*0.4,th*0.4);
      // Gleam
      const gleam = Math.sin(time*2)>0.5;
      if(gleam){ctx.fillStyle='rgba(255,240,100,0.4)';ctx.fillRect(sx+tw*0.4,sy+th*0.4,tw*0.2,th*0.2);}
    });
    
    E.registerTile(T2.CRYSTAL, (ctx,sx,sy,tw,th,v,m,time) => {
      noiseTile(ctx,sx,sy,tw,th,colors.stone,1);
      // Crystal shape
      const pulse=0.7+Math.sin(time*3)*0.3;
      ctx.fillStyle=`rgba(80,180,230,${pulse*0.7})`;
      ctx.beginPath();
      ctx.moveTo(sx+tw*0.5,sy+th*0.1);
      ctx.lineTo(sx+tw*0.8,sy+th*0.5);
      ctx.lineTo(sx+tw*0.5,sy+th*0.9);
      ctx.lineTo(sx+tw*0.2,sy+th*0.5);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle=colors.crystal[3];ctx.lineWidth=0.5;ctx.stroke();
    });
    
    E.registerTile(T2.DEEP_ICE, (ctx,sx,sy,tw,th,v,m,time) => {
      noiseTile(ctx,sx,sy,tw,th,colors.deepice,5);
      ctx.fillStyle=`rgba(100,160,220,${0.2+Math.sin(time+sx)*0.1})`;
      ctx.fillRect(sx,sy,tw,th);
    });
    
    E.registerTile(T2.WALL_LOG, (ctx,sx,sy,tw,th) => {
      ctx.fillStyle='rgba(80,50,25,0.6)';ctx.fillRect(sx,sy,tw,th);
      ctx.strokeStyle='rgba(60,35,15,0.4)';ctx.lineWidth=0.5;
      ctx.strokeRect(sx,sy,tw,th);
    });
    
    E.registerTile(T2.WALL_STONE, (ctx,sx,sy,tw,th) => {
      ctx.fillStyle='rgba(50,55,70,0.4)';ctx.fillRect(sx,sy,tw,th);
    });
    
    E.registerTile(T2.FLOOR_PLANK, (ctx,sx,sy,tw,th) => {
      ctx.fillStyle='#5c3a1e';ctx.fillRect(sx,sy,tw,th);
      ctx.fillStyle='#4a2e14';ctx.fillRect(sx,sy+th*0.1,tw,th*0.15);
      ctx.fillRect(sx,sy+th*0.5,tw,th*0.12);
      ctx.fillStyle='rgba(0,0,0,0.15)';ctx.fillRect(sx,sy,1,th);ctx.fillRect(sx+tw-1,sy,1,th);
    });
    
    E.registerTile(T2.FLOOR_STONE, (ctx,sx,sy,tw,th) => {
      noiseTile(ctx,sx,sy,tw,th,colors.stone,7);
      ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=0.5;
      ctx.strokeRect(sx+1,sy+1,tw-2,th-2);
    });
    
    E.registerTile(T2.WALL_ICE_BRICK, (ctx,sx,sy,tw,th) => {
      ctx.fillStyle='rgba(120,170,210,0.5)';ctx.fillRect(sx,sy,tw,th);
      ctx.strokeStyle='rgba(80,140,200,0.4)';ctx.lineWidth=0.5;
      ctx.strokeRect(sx+1,sy+1,tw-2,th-2);
      ctx.fillStyle='rgba(200,230,255,0.15)';ctx.fillRect(sx+1,sy+1,tw*0.4,th*0.3);
    });
    
    E.registerTile(T2.TORCH, (ctx,sx,sy,tw,th,v,m,time) => {
      ctx.fillStyle=colors.log[0];ctx.fillRect(sx+tw*0.4,sy+th*0.4,tw*0.2,th*0.55);
      const flicker=0.8+Math.sin(time*8)*0.2+Math.sin(time*13)*0.1;
      ctx.fillStyle=`rgba(255,${Math.floor(140+flicker*60)},20,${flicker})`;
      ctx.beginPath();ctx.ellipse(sx+tw*0.5,sy+th*0.3,tw*0.18,th*0.22,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(255,220,100,${flicker*0.8})`;
      ctx.beginPath();ctx.ellipse(sx+tw*0.5,sy+th*0.28,tw*0.08,th*0.12,0,0,Math.PI*2);ctx.fill();
    });
    
    E.registerTile(T2.CAMPFIRE, (ctx,sx,sy,tw,th,v,m,time) => {
      // Logs
      ctx.fillStyle=colors.log[0];
      ctx.save();ctx.translate(sx+tw*0.5,sy+th*0.8);ctx.rotate(0.5);ctx.fillRect(-tw*0.4,-th*0.06,tw*0.8,th*0.12);ctx.restore();
      ctx.save();ctx.translate(sx+tw*0.5,sy+th*0.8);ctx.rotate(-0.5);ctx.fillRect(-tw*0.4,-th*0.06,tw*0.8,th*0.12);ctx.restore();
      // Flames
      for(let f=0;f<3;f++){
        const flicker=0.7+Math.sin(time*6+f*2)*0.3;
        const hue=f===0?255:f===1?200:160;
        ctx.fillStyle=`rgba(255,${hue},${f*40},${flicker*0.9})`;
        const fx=sx+tw*(0.3+f*0.2)+Math.sin(time*4+f)*2;
        const fy=sy+th*0.45;
        ctx.beginPath();ctx.ellipse(fx,fy,tw*0.1,th*(0.15+flicker*0.1),0,0,Math.PI*2);ctx.fill();
      }
    });
    
    E.registerTile(T2.WORKBENCH, (ctx,sx,sy,tw,th) => {
      ctx.fillStyle=colors.log[1];ctx.fillRect(sx,sy+th*0.3,tw,th*0.7);
      ctx.fillStyle=colors.log[0];ctx.fillRect(sx,sy+th*0.25,tw,th*0.1);
      // Tool shapes
      ctx.fillStyle='#8a9090';ctx.fillRect(sx+tw*0.2,sy+th*0.05,tw*0.2,th*0.25);
      ctx.fillStyle='#6a7080';ctx.fillRect(sx+tw*0.6,sy+th*0.08,tw*0.15,th*0.2);
    });
    
    E.registerTile(T2.CHEST, (ctx,sx,sy,tw,th) => {
      ctx.fillStyle='#7a5530';ctx.fillRect(sx,sy+th*0.3,tw,th*0.7);
      ctx.fillStyle='#6a4520';ctx.fillRect(sx,sy,tw,th*0.35);
      ctx.strokeStyle='#c8a030';ctx.lineWidth=1;
      ctx.strokeRect(sx+tw*0.1,sy+th*0.05,tw*0.8,th*0.9);
      ctx.fillStyle='#c8a030';ctx.fillRect(sx+tw*0.4,sy+th*0.42,tw*0.2,th*0.16);
    });

    E.registerTile(T2.WATER, (ctx,sx,sy,tw,th,v,m,time) => {
      const wave=Math.sin(time*2+sx*0.05)*2;
      const grad=ctx.createLinearGradient(sx,sy,sx,sy+th);
      grad.addColorStop(0,`rgba(40,100,160,0.85)`);
      grad.addColorStop(1,`rgba(20,60,120,0.95)`);
      ctx.fillStyle=grad;ctx.fillRect(sx,sy,tw,th);
      ctx.fillStyle=`rgba(100,180,240,0.2)`;
      ctx.fillRect(sx,sy+wave,tw,th*0.15);
    });
    
    E.registerTile(T2.SAND, (ctx,sx,sy,tw,th) => {
      noiseTile(ctx,sx,sy,tw,th,['#c8b060','#d8c070','#b89848','#e0c878'],6);
    });
    E.registerTile(T2.GRAVEL, (ctx,sx,sy,tw,th) => {
      noiseTile(ctx,sx,sy,tw,th,['#707880','#606870','#808890','#585e68'],8);
    });
  }

  // ---- WEATHER ----
  function weatherUpdate(dt) {
    weather.timer -= dt;
    if (weather.timer <= 0) {
      weather.current = weather.next;
      weather.next = weather.types[Math.floor(Math.random()*weather.types.length)];
      weather.timer = 120 + Math.random()*240;
      weather.transition = 0;
    }
    weather.transition = Math.min(1, weather.transition + dt * 0.2);
    
    // Target temp based on weather + time
    const baseTemp = -15 + Engine.smoothNoise(time.day*0.1)*10;
    const weatherMod = {clear:3,overcast:0,snow:-5,blizzard:-12,fog:-2}[weather.current]||0;
    weather.targetTemp = baseTemp + weatherMod;
    weather.temperature += (weather.targetTemp - weather.temperature) * dt * 0.1;
  }
  
  function spawnWeatherParticles(dt) {
    const w = weather.current;
    if (w === 'snow' || w === 'blizzard') {
      const rate = w==='blizzard' ? 80 : 30;
      const count = Math.floor(rate * dt);
      for (let i=0; i<count; i++) {
        const wstrength = Engine.wind.strength;
        Engine.spawnParticle({
          x: Engine.cam.x - Engine.W/(Engine.cam.zoom*2) + Math.random()*(Engine.W/Engine.cam.zoom*1.4),
          y: Engine.cam.y - Engine.H/(Engine.cam.zoom*2) - 20,
          vx: wstrength*0.3 + (Math.random()-0.5)*0.5,
          vy: 0.4 + Math.random()*0.6,
          life: 8+Math.random()*6,
          size: 0.5+Math.random()*1.5,
          color: `rgba(${200+Math.floor(Math.random()*55)},${220+Math.floor(Math.random()*35)},255,0.8)`,
          type:'snow',
          drag:0.998, gravity:0.01,
          windAffect:1.5,
          spin:0, fadeOut:false
        });
      }
    }
    if (w === 'fog') {
      // Occasional fog wisps
      if (Math.random() < 0.02) {
        Engine.spawnParticle({
          x: Engine.cam.x + (Math.random()-0.5)*Engine.W/Engine.cam.zoom,
          y: Engine.cam.y + (Math.random()-0.5)*Engine.H/Engine.cam.zoom*0.3,
          vx: 0.1+Math.random()*0.2, vy:0,
          life:15, size:20,
          color:'rgba(180,200,220,0.08)',
          type:'circle', drag:0.999, fadeOut:true, windAffect:0.5
        });
      }
    }
  }
  
  // Time system
  function timeUpdate(dt) {
    time.minute += dt * time.speed;
    if (time.minute >= 60) { time.minute -= 60; time.hour++; }
    if (time.hour >= 24)   { time.hour -= 24; time.day++; }
  }
  function getTimeOfDay() { return (time.hour*60+time.minute)/(24*60); }
  function getAmbientTemp(wx, wy) {
    const depth = wy / TILE - getSurface(wx/TILE);
    if (depth > 20) return Math.max(-30, weather.temperature + depth*0.3);
    return weather.temperature;
  }
  function isNearFire(wx, wy, radius) {
    const tx = Math.floor(wx/TILE), ty = Math.floor(wy/TILE);
    const r2 = Math.ceil(radius/TILE);
    for (let dy=-r2; dy<=r2; dy++) for (let dx=-r2; dx<=r2; dx++) {
      const t = tileAt(tx+dx, ty+dy, 0);
      if (t===T.CAMPFIRE||t===T.TORCH) {
        const dist=Math.sqrt(dx*dx+dy*dy)*TILE;
        if(dist<=radius) return radius-dist;
      }
    }
    return 0;
  }

  // ---- RENDER ----
  function render(ctx, playerX, playerY, timeOfDay) {
    const E = Engine;
    const vis = E.getVisibleTiles(TILE);
    const now = performance.now()*0.001;
    
    // BG layer (walls/floors)
    for (let ty=vis.y0; ty<=vis.y1; ty++) {
      for (let tx=vis.x0; tx<=vis.x1; tx++) {
        const bg = tileAt(tx,ty,1);
        if (bg !== T.AIR) {
          const s = E.worldToScreen(tx*TILE, ty*TILE);
          const tw = TILE*E.cam.zoom, th=TILE*E.cam.zoom;
          E.drawTile(ctx, bg, s.x, s.y, tw, th, 0, {}, now);
        }
      }
    }
    // FG layer
    for (let ty=vis.y0; ty<=vis.y1; ty++) {
      for (let tx=vis.x0; tx<=vis.x1; tx++) {
        const fg = tileAt(tx,ty,0);
        if (fg !== T.AIR) {
          const s = E.worldToScreen(tx*TILE, ty*TILE);
          const tw=TILE*E.cam.zoom, th=TILE*E.cam.zoom;
          const chunk = getChunk(Math.floor(tx/CHUNK_W), Math.floor(ty/CHUNK_H));
          const lx=((tx%CHUNK_W)+CHUNK_W)%CHUNK_W;
          const ly=((ty%CHUNK_H)+CHUNK_H)%CHUNK_H;
          const v = chunk.variant[ly*CHUNK_W+lx]||0;
          E.drawTile(ctx, fg, s.x, s.y, tw, th, v, {}, now);
          // Campfire / torch lights
          const props = TILE_PROPS[fg];
          if (props && props.light > 0) {
            E.addLight(tx*TILE+TILE/2, ty*TILE+TILE/2, props.light*TILE, 255,160,40, 0.9);
          }
        }
      }
    }
    // Underground ambiance: if player is underground
    const py_tile = Math.floor(playerY/TILE);
    const surf = getSurface(Math.floor(playerX/TILE));
    const depth = py_tile - surf;
    if (depth > 2) {
      // Dark underground - increase ambient darkness
      const darken = Math.min(0.95, depth*0.03);
      E.setAmbient(Math.floor(15-darken*10), Math.floor(20-darken*12), Math.floor(40-darken*25));
    }
  }

  // ---- MINING ----
  function mineTile(tx, ty, toolPower) {
    const chunk = getChunk(Math.floor(tx/CHUNK_W), Math.floor(ty/CHUNK_H));
    const lx=((tx%CHUNK_W)+CHUNK_W)%CHUNK_W;
    const ly=((ty%CHUNK_H)+CHUNK_H)%CHUNK_H;
    const idx=ly*CHUNK_W+lx;
    const tileId = chunk.fg[idx];
    if (tileId === T.AIR) return null;
    const props = TILE_PROPS[tileId];
    if (!props) return null;
    const drops = [];
    if (toolPower >= props.hardness) {
      if (props.drops) {
        for (const d of props.drops) {
          if (!d.chance || Math.random()<d.chance) {
            if (d.n > 0) drops.push({id:d.id, n:d.n});
          }
        }
      }
      chunk.fg[idx] = T.AIR;
      chunk.dirty = true;
      Engine.camShake(props.hardness*0.5);
      // Mining particles
      Engine.spawnBurst(tx*TILE+TILE/2, ty*TILE+TILE/2, 5, {
        speed:1.5, life:0.6, size:2,
        color: getTileColor(tileId), drag:0.92, gravity:0.08, type:'circle', fadeOut:true
      });
      return drops;
    }
    // Partial - spark particles
    Engine.spawnBurst(tx*TILE+TILE/2, ty*TILE+TILE/2, 3, {
      speed:1, life:0.3, size:1.5,
      color:'#ffffff', drag:0.95, gravity:0.05, type:'circle', fadeOut:true
    });
    return [];
  }
  
  function getTileColor(tileId) {
    const m = {[T.STONE]:'#6a7085',[T.DIRT]:'#7a5a3c',[T.GRASS]:'#4a9040',
               [T.SNOW]:'#d8e8ff',[T.ICE]:'#b0d8f8',[T.LOG]:'#6e4a28',
               [T.LEAVES]:'#366a33',[T.COAL]:'#383845',[T.IRON]:'#9a7e68',
               [T.GOLD]:'#d8b040',[T.CRYSTAL]:'#80d0f8'};
    return m[tileId]||'#888888';
  }
  
  function placeTile(tx, ty, id, layer) {
    const cur = tileAt(tx,ty,layer||0);
    if (cur !== T.AIR && layer!==1) return false;
    setTile(tx,ty,id,layer||0);
    Engine.spawnBurst(tx*TILE+TILE/2, ty*TILE+TILE/2, 3, {
      speed:0.8, life:0.4, size:1.5, color:getTileColor(id), drag:0.95, gravity:0.04, fadeOut:true, type:'circle'
    });
    return true;
  }
  
  function isSolid(tx, ty) {
    const fg = tileAt(tx,ty,0);
    return TILE_PROPS[fg]?.solid === true;
  }

  function initTileGraphicsAndReturn() {
    initTileGraphics();
  }

  return {
    T, TILE, WORLD_H, TILE_PROPS,
    tileAt, setTile, getSurface, getBiome,
    weather, time, getTimeOfDay, getAmbientTemp, isNearFire,
    weatherUpdate, spawnWeatherParticles, timeUpdate,
    render, mineTile, placeTile, isSolid,
    initTileGraphics: initTileGraphicsAndReturn
  };
})();
