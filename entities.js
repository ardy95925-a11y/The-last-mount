// ============================================================
// ENTITIES.JS - Player, Items, Crafting System
// ============================================================

const Items = (() => {
  const ITEMS = {
    // Raw materials
    wood:       {name:'Wood',        icon:'🪵', stack:64, type:'material', color:'#8B4513'},
    stick:      {name:'Stick',       icon:'🥢', stack:64, type:'material'},
    stone:      {name:'Stone',       icon:'🪨', stack:64, type:'material', color:'#888'},
    dirt:       {name:'Dirt',        icon:'🟫', stack:64, type:'material'},
    coal:       {name:'Coal',        icon:'⬛', stack:64, type:'material', fuelValue:20},
    iron_ore:   {name:'Iron Ore',    icon:'🔴', stack:32, type:'material'},
    gold_ore:   {name:'Gold Ore',    icon:'🟡', stack:32, type:'material'},
    crystal:    {name:'Ice Crystal', icon:'💎', stack:16, type:'material', glow:true},
    deep_ice:   {name:'Deep Ice',    icon:'🔷', stack:32, type:'material'},
    ice_chunk:  {name:'Ice Chunk',   icon:'🧊', stack:32, type:'material'},
    snowball:   {name:'Snowball',    icon:'⬜', stack:16, type:'material'},
    gravel:     {name:'Gravel',      icon:'⬛', stack:64, type:'material'},
    sand:       {name:'Sand',        icon:'🟨', stack:64, type:'material'},
    // Refined
    iron_bar:   {name:'Iron Bar',    icon:'🔩', stack:16, type:'material', color:'#aaa'},
    gold_bar:   {name:'Gold Bar',    icon:'✨', stack:16, type:'material', color:'#fd0'},
    plank:      {name:'Plank',       icon:'🟧', stack:64, type:'material', color:'#a0622a'},
    // Tools
    pickaxe_wood:{name:'Wood Pick', icon:'⛏',  stack:1, type:'tool', toolPower:1, durability:30, maxDura:30, speed:1.0},
    pickaxe_stone:{name:'Stone Pick',icon:'⛏', stack:1, type:'tool', toolPower:2, durability:80, maxDura:80, speed:1.1},
    pickaxe_iron:{name:'Iron Pick', icon:'⛏',  stack:1, type:'tool', toolPower:3, durability:200,maxDura:200,speed:1.3},
    axe_wood:   {name:'Wood Axe',   icon:'🪓',  stack:1, type:'tool', toolPower:1, durability:25, maxDura:25, speed:1.0, isAxe:true},
    axe_iron:   {name:'Iron Axe',   icon:'🪓',  stack:1, type:'tool', toolPower:2, durability:100,maxDura:100,speed:1.3, isAxe:true},
    sword_wood: {name:'Wood Sword', icon:'🗡️',  stack:1, type:'weapon', damage:3, durability:20, maxDura:20},
    sword_iron: {name:'Iron Sword', icon:'⚔️',  stack:1, type:'weapon', damage:8, durability:80, maxDura:80},
    // Armor / clothing
    fur_coat:   {name:'Fur Coat',    icon:'🧥', stack:1, type:'armor', warmth:15, armor:2},
    leather_boots:{name:'Boots',    icon:'🥾', stack:1, type:'armor', warmth:5, armor:1},
    wool_hat:   {name:'Wool Hat',    icon:'🪖', stack:1, type:'armor', warmth:8, armor:1},
    // Consumables
    raw_meat:   {name:'Raw Meat',    icon:'🥩', stack:16, type:'food', hunger:10, warmth:-2},
    cooked_meat:{name:'Cooked Meat', icon:'🍖', stack:16, type:'food', hunger:30, warmth:5},
    berry:      {name:'Frostberry',  icon:'🫐', stack:16, type:'food', hunger:8, warmth:2},
    herb_tea:   {name:'Herb Tea',    icon:'🍵', stack:8,  type:'food', hunger:5, warmth:15, health:10},
    // Placeable
    torch_item: {name:'Torch',       icon:'🔦', stack:32, type:'placeable', placeId:'torch'},
    campfire_item:{name:'Campfire',  icon:'🔥', stack:8, type:'placeable', placeId:'campfire'},
    chest_item: {name:'Chest',       icon:'📦', stack:8, type:'placeable', placeId:'chest'},
    workbench_item:{name:'Workbench',icon:'🪚',  stack:4, type:'placeable', placeId:'workbench'},
    wall_log:   {name:'Log Wall',    icon:'🪵', stack:32, type:'placeable', placeId:'wall_log', bgLayer:true},
    wall_stone: {name:'Stone Wall',  icon:'🪨', stack:32, type:'placeable', placeId:'wall_stone', bgLayer:true},
    wall_ice:   {name:'Ice Brick',   icon:'🧊', stack:32, type:'placeable', placeId:'wall_ice_brick', bgLayer:true},
    floor_plank:{name:'Wood Floor',  icon:'🪵', stack:32, type:'placeable', placeId:'floor_plank', bgLayer:true},
    floor_stone:{name:'Stone Floor', icon:'🪨', stack:32, type:'placeable', placeId:'floor_stone', bgLayer:true},
    door_item:  {name:'Door',        icon:'🚪', stack:4, type:'placeable', placeId:'door'},
    rope:       {name:'Rope',        icon:'〰️', stack:32, type:'material'},
    cloth:      {name:'Cloth',       icon:'🧶', stack:32, type:'material'},
    leather:    {name:'Leather',     icon:'🟤', stack:16, type:'material'},
  };

  // Crafting recipes
  const RECIPES = [
    // Basic tools
    { id:'pickaxe_wood',  result:{id:'pickaxe_wood',n:1},  requires:[{id:'wood',n:3},{id:'stick',n:2}], station:null, name:'Wood Pickaxe' },
    { id:'axe_wood',      result:{id:'axe_wood',n:1},      requires:[{id:'wood',n:3},{id:'stick',n:2}], station:null, name:'Wood Axe' },
    { id:'sword_wood',    result:{id:'sword_wood',n:1},    requires:[{id:'wood',n:2},{id:'stick',n:1}], station:null, name:'Wood Sword' },
    { id:'plank',         result:{id:'plank',n:4},         requires:[{id:'wood',n:1}], station:null, name:'Planks (x4)' },
    { id:'stick',         result:{id:'stick',n:4},         requires:[{id:'wood',n:1}], station:null, name:'Sticks (x4)' },
    { id:'torch_item',    result:{id:'torch_item',n:4},    requires:[{id:'stick',n:1},{id:'coal',n:1}], station:null, name:'Torches (x4)' },
    { id:'campfire_item', result:{id:'campfire_item',n:1}, requires:[{id:'wood',n:5},{id:'stone',n:3}], station:null, name:'Campfire' },
    { id:'wall_log',      result:{id:'wall_log',n:4},      requires:[{id:'plank',n:2}], station:null, name:'Log Walls (x4)' },
    { id:'floor_plank',   result:{id:'floor_plank',n:4},   requires:[{id:'plank',n:2}], station:null, name:'Wood Floors (x4)' },
    { id:'workbench_item',result:{id:'workbench_item',n:1},requires:[{id:'plank',n:6},{id:'wood',n:2}], station:null, name:'Workbench' },
    { id:'rope',          result:{id:'rope',n:2},          requires:[{id:'stick',n:3}], station:null, name:'Rope (x2)' },
    { id:'cooked_meat',   result:{id:'cooked_meat',n:1},   requires:[{id:'raw_meat',n:1},{id:'coal',n:1}], station:null, name:'Cook Meat' },
    // Workbench recipes
    { id:'pickaxe_stone', result:{id:'pickaxe_stone',n:1}, requires:[{id:'stone',n:5},{id:'stick',n:2}], station:'workbench', name:'Stone Pickaxe' },
    { id:'axe_iron',      result:{id:'axe_iron',n:1},      requires:[{id:'iron_bar',n:3},{id:'stick',n:2}], station:'workbench', name:'Iron Axe' },
    { id:'pickaxe_iron',  result:{id:'pickaxe_iron',n:1},  requires:[{id:'iron_bar',n:5},{id:'stick',n:2}], station:'workbench', name:'Iron Pickaxe' },
    { id:'sword_iron',    result:{id:'sword_iron',n:1},    requires:[{id:'iron_bar',n:4},{id:'stick',n:1}], station:'workbench', name:'Iron Sword' },
    { id:'wall_stone',    result:{id:'wall_stone',n:4},    requires:[{id:'stone',n:2}], station:null, name:'Stone Walls (x4)' },
    { id:'wall_ice',      result:{id:'wall_ice',n:4},      requires:[{id:'ice_chunk',n:2},{id:'deep_ice',n:1}], station:null, name:'Ice Brick Walls (x4)' },
    { id:'floor_stone',   result:{id:'floor_stone',n:4},   requires:[{id:'stone',n:2}], station:null, name:'Stone Floors (x4)' },
    { id:'iron_bar',      result:{id:'iron_bar',n:1},      requires:[{id:'iron_ore',n:2},{id:'coal',n:1}], station:'workbench', name:'Smelt Iron' },
    { id:'gold_bar',      result:{id:'gold_bar',n:1},      requires:[{id:'gold_ore',n:2},{id:'coal',n:2}], station:'workbench', name:'Smelt Gold' },
    { id:'cloth',         result:{id:'cloth',n:2},         requires:[{id:'rope',n:3}], station:'workbench', name:'Cloth (x2)' },
    { id:'leather',       result:{id:'leather',n:1},       requires:[{id:'raw_meat',n:2},{id:'rope',n:1}], station:'workbench', name:'Leather' },
    { id:'fur_coat',      result:{id:'fur_coat',n:1},      requires:[{id:'leather',n:4},{id:'cloth',n:3}], station:'workbench', name:'Fur Coat' },
    { id:'wool_hat',      result:{id:'wool_hat',n:1},      requires:[{id:'cloth',n:3},{id:'rope',n:1}], station:'workbench', name:'Wool Hat' },
    { id:'leather_boots', result:{id:'leather_boots',n:1}, requires:[{id:'leather',n:2},{id:'rope',n:2}], station:'workbench', name:'Leather Boots' },
    { id:'chest_item',    result:{id:'chest_item',n:1},    requires:[{id:'plank',n:8},{id:'rope',n:2}], station:'workbench', name:'Chest' },
    { id:'door_item',     result:{id:'door_item',n:1},     requires:[{id:'plank',n:4}], station:'workbench', name:'Door' },
    { id:'herb_tea',      result:{id:'herb_tea',n:2},      requires:[{id:'berry',n:3},{id:'ice_chunk',n:1}], station:'workbench', name:'Herb Tea (x2)' },
  ];

  function get(id) { return ITEMS[id]||null; }
  function getRecipes() { return RECIPES; }
  
  return { ITEMS, RECIPES, get, getRecipes };
})();

// ============================================================
// Player entity
// ============================================================
const Player = (() => {
  const GRAVITY = 0.4;
  const JUMP_FORCE = -7;
  const MOVE_SPEED = 2.5;
  const SPRINT_MULT = 1.6;
  
  const state = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    onGround: false,
    facingRight: true,
    health: 100, maxHealth: 100,
    warmth: 100, maxWarmth: 100,
    hunger: 100, maxHunger: 100,
    stamina: 100, maxStamina: 100,
    dead: false,
    respawnTimer: 0,
    // Input
    moveLeft: false, moveRight: false, jump: false, sprint: false,
    // Animation
    walkFrame: 0, walkTimer: 0, animState: 'idle',
    // Mining
    miningTarget: null, miningProgress: 0, miningTime: 0.7,
    // Inventory
    inventory: [],
    hotbar: [null,null,null,null,null,null,null,null],
    hotbarSel: 0,
    armor: {head:null,body:null,feet:null},
    // Stats
    miningPower: 1,
    warmthGainRate: 0,
    invOpen: false, craftOpen: false,
    nearWorkbench: false,
  };
  
  function init(spawnX, spawnY) {
    state.x = spawnX; state.y = spawnY;
    state.vx=0; state.vy=0;
    // Starting items
    state.inventory = [];
    addItem('wood', 5);
    addItem('stick', 4);
    addItem('stone', 3);
    // Starting hotbar
    state.hotbar = [null,null,null,null,null,null,null,null];
    // Put basic items in hotbar
    state.hotbar[0] = {id:'wood', n:5};
    state.hotbar[1] = {id:'stick', n:4};
  }
  
  function addItem(id, n) {
    // Try to stack
    for (const item of state.hotbar) {
      if (item && item.id === id) {
        const def = Items.get(id);
        const space = (def.stack||64) - item.n;
        const add = Math.min(space, n);
        item.n += add; n -= add;
        if (n <= 0) return true;
      }
    }
    for (const item of state.inventory) {
      if (item && item.id === id) {
        const def = Items.get(id);
        const space = (def.stack||64) - item.n;
        const add = Math.min(space, n);
        item.n += add; n -= add;
        if (n <= 0) return true;
      }
    }
    // New slot
    while (n > 0) {
      const def = Items.get(id);
      const stack = Math.min(def?.stack||64, n);
      // Try hotbar first
      let placed = false;
      for (let i=0; i<state.hotbar.length; i++) {
        if (!state.hotbar[i]) { state.hotbar[i]={id,n:stack}; placed=true; break; }
      }
      if (!placed) state.inventory.push({id, n:stack});
      n -= stack;
    }
    return true;
  }
  
  function removeItem(id, n) {
    let need = n;
    for (const src of [state.hotbar, state.inventory]) {
      for (let i=0; i<src.length; i++) {
        if (src[i] && src[i].id === id) {
          const take = Math.min(src[i].n, need);
          src[i].n -= take; need -= take;
          if (src[i].n <= 0) src[i] = null;
          if (need <= 0) return true;
        }
      }
    }
    return need <= 0;
  }
  
  function countItem(id) {
    let c=0;
    for (const src of [state.hotbar, state.inventory]) {
      for (const item of src) if (item && item.id===id) c+=item.n;
    }
    return c;
  }
  
  function getSelectedItem() {
    return state.hotbar[state.hotbarSel];
  }
  
  function getToolPower() {
    const sel = getSelectedItem();
    if (!sel) return 1;
    const def = Items.get(sel.id);
    return def?.toolPower || 0;
  }
  
  // Physics update
  function update(dt, worldRef) {
    if (state.dead) return;
    const T = worldRef.TILE;
    
    // Movement
    let ax = 0;
    const spd = state.sprint ? MOVE_SPEED*SPRINT_MULT : MOVE_SPEED;
    if (state.moveLeft)  { ax = -spd; state.facingRight=false; }
    if (state.moveRight) { ax = spd;  state.facingRight=true; }
    
    state.vx = ax;
    state.vy += GRAVITY;
    
    // Stamina for sprinting
    if (state.sprint && (state.moveLeft||state.moveRight)) {
      state.stamina = Math.max(0, state.stamina - dt*15);
    } else {
      state.stamina = Math.min(state.maxStamina, state.stamina + dt*8);
    }
    if (state.stamina === 0) state.sprint = false;
    
    if (state.jump && state.onGround) {
      state.vy = JUMP_FORCE;
      state.onGround = false;
      // Jump particles
      Engine.spawnBurst(state.x, state.y+8, 4, {speed:1,life:0.3,size:1.5,color:'#c0d0e0',drag:0.9,gravity:-0.03,fadeOut:true,type:'circle'});
    }
    state.jump = false;
    
    // Cap fall speed
    if (state.vy > 12) state.vy = 12;
    
    // Collision X
    state.x += state.vx;
    const w=6, h=14;
    for (let dy=0; dy<2; dy++) {
      const ty = Math.floor((state.y - h/2 + dy*(h-1))/T);
      for (let side=-1; side<=1; side+=2) {
        const tx = Math.floor((state.x + side*w)/T);
        if (worldRef.isSolid(tx,ty)) {
          if (side>0) state.x = tx*T - w - 0.1;
          else        state.x = (tx+1)*T + w + 0.1;
          state.vx=0;
        }
      }
    }
    
    // Collision Y
    state.y += state.vy;
    state.onGround = false;
    for (let dx=-1; dx<=1; dx++) {
      const tx = Math.floor((state.x + dx*w*0.8)/T);
      // Floor
      const tyBot = Math.floor((state.y + h/2)/T);
      if (worldRef.isSolid(tx,tyBot) && state.vy>=0) {
        state.y = tyBot*T - h/2 - 0.1;
        state.vy = 0;
        state.onGround = true;
      }
      // Ceiling
      const tyTop = Math.floor((state.y - h/2)/T);
      if (worldRef.isSolid(tx,tyTop) && state.vy<0) {
        state.y = (tyTop+1)*T + h/2 + 0.1;
        state.vy = 0;
      }
    }
    
    // Animation
    state.walkTimer += dt;
    if (state.moveLeft||state.moveRight) {
      state.animState = 'walk';
      if (state.walkTimer > 0.15) { state.walkFrame=(state.walkFrame+1)%4; state.walkTimer=0; }
    } else {
      state.animState = 'idle';
      state.walkFrame = 0;
    }
    
    // Mining progress
    if (state.miningTarget) {
      const {tx,ty,layer} = state.miningTarget;
      const dist = Math.hypot(state.x-tx*T-T/2, state.y-ty*T-T/2);
      if (dist > T*3.5) { state.miningTarget=null; state.miningProgress=0; return; }
      state.miningProgress += dt / state.miningTime;
      if (state.miningProgress >= 1) {
        const drops = worldRef.mineTile(tx, ty, getToolPower());
        if (drops) {
          for (const d of drops) if(d.n>0) addItem(d.id, d.n);
          if (drops.length > 0) Game && Game.showMsg(`+${drops.map(d=>d.n+'x '+Items.get(d.id)?.name).join(', ')}`);
        }
        state.miningTarget = null;
        state.miningProgress = 0;
        // Durability
        const sel = getSelectedItem();
        if (sel) {
          const def = Items.get(sel.id);
          if (def?.durability !== undefined) {
            sel.durability = (sel.durability||def.durability) - 1;
            if (sel.durability <= 0) {
              state.hotbar[state.hotbarSel] = null;
              Game && Game.showMsg(`${def.name} broke!`, 'warn');
            }
          }
        }
      }
      // Mining sparks
      if (Math.random()<0.3) {
        Engine.spawnParticle({
          x:tx*T+T/2+(Math.random()-0.5)*T,
          y:ty*T+T/2+(Math.random()-0.5)*T,
          vx:(Math.random()-0.5)*0.8, vy:-0.5-Math.random()*0.5,
          life:0.2+Math.random()*0.2, size:1,
          color:'rgba(255,220,100,0.9)', drag:0.95, gravity:0.05, fadeOut:true, type:'circle'
        });
      }
    }
    
    // Survival stats
    // Hunger drains slowly
    state.hunger = Math.max(0, state.hunger - dt*(0.5 + (state.sprint?0.5:0)));
    if (state.hunger === 0) state.health = Math.max(0, state.health - dt*2);
    
    // Warmth based on weather + armor + fire
    const ambTemp = worldRef.getAmbientTemp(state.x, state.y);
    const fireWarmth = worldRef.isNearFire(state.x, state.y, T*5);
    const armorWarmth = (state.armor.head?Items.get(state.armor.head.id)?.warmth||0:0) +
                        (state.armor.body?Items.get(state.armor.body.id)?.warmth||0:0) +
                        (state.armor.feet?Items.get(state.armor.feet.id)?.warmth||0:0);
    
    const warmthNet = ambTemp + armorWarmth*0.5 + fireWarmth*0.3;
    if (warmthNet < 0) {
      state.warmth = Math.max(0, state.warmth + warmthNet*dt*0.2);
    } else {
      state.warmth = Math.min(state.maxWarmth, state.warmth + warmthNet*dt*0.1);
    }
    if (state.warmth <= 0) state.health = Math.max(0, state.health - dt*3);
    
    // Warmth regen when cozy
    if (warmthNet > 15) state.warmth = Math.min(state.maxWarmth, state.warmth + dt*5);
    
    // Health regen when full
    if (state.hunger>70 && state.warmth>50 && state.health<state.maxHealth) {
      state.health = Math.min(state.maxHealth, state.health+dt*2);
    }
    
    // Breath particles in cold
    if (ambTemp < -5 && Math.random()<dt*2) {
      Engine.spawnParticle({
        x:state.x+(state.facingRight?6:-6), y:state.y-2,
        vx:(state.facingRight?0.3:-0.3)+(Math.random()-0.5)*0.2, vy:-0.2,
        life:1.5, size:3, color:'rgba(200,220,240,0.4)',
        type:'circle', drag:0.97, gravity:-0.005, fadeOut:true
      });
    }
    
    // Near workbench check
    const ptx = Math.floor(state.x/T), pty = Math.floor(state.y/T);
    state.nearWorkbench = false;
    for (let dy=-2;dy<=2;dy++) for(let dx=-3;dx<=3;dx++) {
      if (worldRef.tileAt(ptx+dx,pty+dy,0)===worldRef.T.WORKBENCH) { state.nearWorkbench=true; break; }
    }
    
    // Death
    if (state.health <= 0 && !state.dead) {
      state.dead = true;
    }
  }
  
  function respawn(wx, wy) {
    state.x=wx; state.y=wy;
    state.vx=0; state.vy=0;
    state.health=100; state.warmth=100; state.hunger=100; state.stamina=100;
    state.dead=false;
    state.miningTarget=null; state.miningProgress=0;
    init(wx,wy);
  }

  // Pixel art player sprites
  const PLAYER_W = 8, PLAYER_H = 16;
  
  function draw(ctx) {
    if (state.dead) return;
    const E = Engine;
    const s = E.worldToScreen(state.x - PLAYER_W/2, state.y - PLAYER_H/2);
    const scale = E.cam.zoom;
    const pw = PLAYER_W*scale, ph = PLAYER_H*scale;
    
    ctx.save();
    if (!state.facingRight) {
      ctx.translate(s.x + pw, s.y);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(s.x, s.y);
    }
    
    // Body bob
    const bob = state.animState==='walk' ? Math.sin(state.walkFrame*Math.PI*0.5)*1.5 : 0;
    ctx.translate(0, bob*scale*0.5);
    
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(pw/2, ph+scale, pw*0.5, scale*1.2, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Legs
    const legSwing = state.animState==='walk' ? Math.sin(state.walkFrame*Math.PI*0.5)*3*scale : 0;
    ctx.fillStyle = '#2a3a5a';
    ctx.fillRect(0, ph*0.6, pw*0.44, ph*0.4 + legSwing);
    ctx.fillRect(pw*0.56, ph*0.6, pw*0.44, ph*0.4 - legSwing);
    // Boots
    const bootColor = state.armor.feet ? '#4a3020' : '#1a2030';
    ctx.fillStyle = bootColor;
    ctx.fillRect(-scale*0.5, ph*0.88 + legSwing, pw*0.5, ph*0.12+scale);
    ctx.fillRect(pw*0.5, ph*0.88 - legSwing, pw*0.5+scale*0.5, ph*0.12+scale);
    
    // Body
    const bodyColor = state.armor.body ? '#8B4513' : '#3a4a6a';
    ctx.fillStyle = bodyColor;
    ctx.fillRect(scale*0.5, ph*0.28, pw - scale, ph*0.35);
    
    // Coat details
    if (state.armor.body) {
      ctx.fillStyle='#6b3010';
      ctx.fillRect(scale*0.5, ph*0.28, scale, ph*0.35);
      ctx.fillRect(pw-scale*1.5, ph*0.28, scale, ph*0.35);
    }
    
    // Arms
    const armSwing = state.animState==='walk' ? Math.sin(state.walkFrame*Math.PI*0.5)*2*scale : 0;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-scale, ph*0.28, scale*1.5, ph*0.3 + armSwing);
    ctx.fillRect(pw-scale*0.5, ph*0.28, scale*1.5, ph*0.3 - armSwing);
    
    // Head
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(pw*0.15, 0, pw*0.7, ph*0.32);
    // Hat
    if (state.armor.head) {
      ctx.fillStyle='#4a6080';
      ctx.fillRect(pw*0.1, 0, pw*0.8, ph*0.12);
      ctx.fillRect(pw*0.05, ph*0.03, pw*0.9, ph*0.1);
    } else {
      // Hair
      ctx.fillStyle='#3a2010';
      ctx.fillRect(pw*0.1, 0, pw*0.8, ph*0.08);
    }
    // Eyes
    ctx.fillStyle='#1a1a2a';
    ctx.fillRect(pw*0.35, ph*0.1, scale*1.2, scale*1.2);
    ctx.fillRect(pw*0.62, ph*0.1, scale*1.2, scale*1.2);
    // Breath vapor
    
    // Tool in hand
    const sel = getSelectedItem();
    if (sel) {
      ctx.save();
      ctx.translate(pw*0.9, ph*0.3);
      ctx.rotate(0.3 + (state.miningTarget?state.miningProgress*0.8:0));
      ctx.font = `${scale*8}px sans-serif`;
      ctx.fillText(Items.get(sel.id)?.icon||'', 0, 0);
      ctx.restore();
    }
    
    ctx.restore();
    
    // Mining progress bar
    if (state.miningTarget && state.miningProgress > 0) {
      const bs = E.worldToScreen(state.x-12, state.y-PLAYER_H/2-6);
      ctx.fillStyle='rgba(0,0,0,0.5)';
      ctx.fillRect(bs.x, bs.y, 24*scale*0.5, 4*scale*0.5);
      ctx.fillStyle='#60d080';
      ctx.fillRect(bs.x, bs.y, 24*scale*0.5*state.miningProgress, 4*scale*0.5);
    }
  }
  
  function useItem(id, worldRef, tx, ty) {
    const def = Items.get(id);
    if (!def) return false;
    if (def.type === 'food') {
      state.hunger = Math.min(state.maxHunger, state.hunger + def.hunger);
      if (def.warmth) state.warmth = Math.min(state.maxWarmth, state.warmth + def.warmth);
      if (def.health) state.health = Math.min(state.maxHealth, state.health + def.health);
      Engine.spawnBurst(state.x, state.y-8, 5, {speed:0.5,life:0.5,size:3,color:'#80e080',fadeOut:true,type:'circle'});
      return true;
    }
    if (def.type==='armor') {
      const slot = def.type==='armor' ? (id.includes('hat')?'head':id.includes('boot')?'feet':'body') : null;
      if (slot) { state.armor[slot]={id}; return true; }
    }
    if (def.type==='placeable' && tx!==undefined) {
      const tileId = worldRef.T[def.placeId?.toUpperCase()] || 
                     worldRef.T[Object.keys(worldRef.T).find(k=>k.toLowerCase()===def.placeId?.toLowerCase())];
      if (tileId !== undefined) {
        const layer = def.bgLayer ? 1 : 0;
        const placed = worldRef.placeTile(tx, ty, tileId, layer);
        return placed;
      }
    }
    return false;
  }
  
  function craft(recipeId, inventory_check) {
    const recipe = Items.RECIPES.find(r=>r.id===recipeId);
    if (!recipe) return false;
    if (recipe.station==='workbench' && !state.nearWorkbench) {
      Game && Game.showMsg('Need a workbench!', 'warn');
      return false;
    }
    for (const req of recipe.requires) {
      if (countItem(req.id) < req.n) return false;
    }
    for (const req of recipe.requires) removeItem(req.id, req.n);
    addItem(recipe.result.id, recipe.result.n);
    Game && Game.showMsg(`Crafted: ${recipe.name}!`);
    Engine.spawnBurst(state.x, state.y-10, 8, {speed:1,life:0.6,size:2,color:'#80d8ff',fadeOut:true,type:'circle',gravity:-0.05});
    return true;
  }
  
  function canCraft(recipeId) {
    const recipe = Items.RECIPES.find(r=>r.id===recipeId);
    if (!recipe) return false;
    for (const req of recipe.requires) if(countItem(req.id)<req.n) return false;
    return true;
  }

  return {
    state, init, update, draw,
    addItem, removeItem, countItem,
    getSelectedItem, getToolPower,
    useItem, craft, canCraft, respawn,
    PLAYER_W, PLAYER_H
  };
})();
