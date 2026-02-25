// ============================================================
// UI.JS - HUD, Inventory, Crafting, Messages
// ============================================================

const UI = (() => {
  // Elements
  const els = {
    healthFill:    document.querySelector('#healthBar .bar-fill'),
    warmthFill:    document.querySelector('#warmthBar .bar-fill'),
    hungerFill:    document.querySelector('#hungerBar .bar-fill'),
    staminaFill:   document.querySelector('#staminaBar .bar-fill'),
    weatherName:   document.getElementById('weatherName'),
    tempDisplay:   document.getElementById('tempDisplay'),
    hotbar:        document.getElementById('hotbar'),
    invGrid:       document.getElementById('invGrid'),
    inventory:     document.getElementById('inventory'),
    crafting:      document.getElementById('crafting'),
    recipeList:    document.getElementById('recipeList'),
    tooltip:       document.getElementById('tooltip'),
    msgLog:        document.getElementById('msgLog'),
    deathScreen:   document.getElementById('deathScreen'),
    loading:       document.getElementById('loading'),
    loadFill:      document.getElementById('loadFill'),
    loadText:      document.getElementById('loadText'),
  };
  
  const HOTBAR_SIZE = 8;
  let lastHotbarSel = -1;
  let hotbarSlots = [];
  
  const weatherIcons = {clear:'❄️',overcast:'☁️',snow:'🌨️',blizzard:'🌪️',fog:'🌫️'};
  const weatherColors = {clear:'#a8d8f0',overcast:'#9090a0',snow:'#c0d8f8',blizzard:'#8090b0',fog:'#b0b8c8'};
  
  function init() {
    buildHotbar();
    setupTouchControls();
  }
  
  function buildHotbar() {
    els.hotbar.innerHTML='';
    hotbarSlots=[];
    for (let i=0;i<HOTBAR_SIZE;i++) {
      const slot = document.createElement('div');
      slot.className='hotslot' + (i===0?' selected':'');
      slot.innerHTML=`<span class="hotslot-key">${i+1}</span><div class="hotslot-icon"></div><div class="hotslot-count"></div>`;
      slot.addEventListener('click',()=>{ Player.state.hotbarSel=i; });
      slot.addEventListener('contextmenu',(e)=>{e.preventDefault();tryUseHotbarItem(i);});
      els.hotbar.appendChild(slot);
      hotbarSlots.push(slot);
    }
  }
  
  function tryUseHotbarItem(i) {
    const item = Player.state.hotbar[i];
    if (!item) return;
    const def = Items.get(item.id);
    if (!def) return;
    if (def.type==='food') {
      Player.useItem(item.id, World);
      item.n--;
      if (item.n<=0) Player.state.hotbar[i]=null;
    } else if (def.type==='armor') {
      const slot = item.id.includes('hat')?'head':item.id.includes('boot')||item.id.includes('boots')?'feet':'body';
      Player.state.armor[slot] = {id:item.id};
      Player.state.hotbar[i]=null;
      Game.showMsg(`Equipped ${def.name}`);
    }
  }
  
  function updateHUD(playerState, worldState) {
    // Stat bars
    els.healthFill.style.width  = (playerState.health/playerState.maxHealth*100)+'%';
    els.warmthFill.style.width  = (playerState.warmth/playerState.maxWarmth*100)+'%';
    els.hungerFill.style.width  = (playerState.hunger/playerState.maxHunger*100)+'%';
    els.staminaFill.style.width = (playerState.stamina/playerState.maxStamina*100)+'%';
    
    // Color tint when low
    els.healthFill.style.opacity = playerState.health<30?'1':(0.7+playerState.health/playerState.maxHealth*0.3)+'';
    els.warmthFill.style.filter  = playerState.warmth<20?'hue-rotate(-30deg)':'none';
    
    // Weather
    const w = worldState.weather.current;
    els.weatherName.textContent = (weatherIcons[w]||'') + ' ' + w.charAt(0).toUpperCase()+w.slice(1);
    els.weatherName.style.color = weatherColors[w]||'#a8d8f0';
    const temp = Math.round(worldState.weather.temperature);
    els.tempDisplay.textContent = `${temp}°C`;
    els.tempDisplay.style.color = temp<-15?'#60a0ff':temp<-5?'#80c0ff':temp<5?'#a0d0ff':'#c0e0ff';
    
    // Hotbar
    if (playerState.hotbarSel !== lastHotbarSel) {
      hotbarSlots.forEach((s,i)=>{
        s.classList.toggle('selected', i===playerState.hotbarSel);
      });
      lastHotbarSel = playerState.hotbarSel;
    }
    hotbarSlots.forEach((s,i)=>{
      const item = playerState.hotbar[i];
      const iconEl = s.querySelector('.hotslot-icon');
      const countEl = s.querySelector('.hotslot-count');
      if (item) {
        const def = Items.get(item.id);
        iconEl.textContent = def?.icon||'?';
        countEl.textContent = item.n>1?item.n:'';
        // Durability color
        if (def?.maxDura) {
          const pct = (item.durability||def.durability||def.maxDura)/def.maxDura;
          s.style.borderBottomColor = pct<0.25?'#e74c3c':pct<0.5?'#f39c12':'rgba(100,150,200,0.3)';
        } else { s.style.borderBottomColor=''; }
      } else {
        iconEl.textContent='';
        countEl.textContent='';
        s.style.borderBottomColor='';
      }
    });
    
    // Death screen
    if (playerState.dead) {
      els.deathScreen.classList.add('active');
    } else {
      els.deathScreen.classList.remove('active');
    }
    
    // Inventory
    if (playerState.invOpen) {
      els.inventory.classList.add('open');
      renderInventory(playerState);
    } else {
      els.inventory.classList.remove('open');
    }
    
    // Crafting
    if (playerState.craftOpen) {
      els.crafting.classList.add('open');
      renderCrafting(playerState);
    } else {
      els.crafting.classList.remove('open');
    }
  }
  
  function renderInventory(playerState) {
    const grid = els.invGrid;
    grid.innerHTML='';
    // Show all inventory + armor
    const allItems = [...playerState.inventory];
    for (const item of allItems) {
      const slot = document.createElement('div');
      slot.className='inv-slot';
      if (item) {
        const def = Items.get(item.id);
        slot.innerHTML=`<div class="slot-icon">${def?.icon||'?'}</div><div class="slot-count">${item.n>1?item.n:''}</div>`;
        slot.addEventListener('mouseenter',(e)=>{showTooltip(e,item);});
        slot.addEventListener('mouseleave',()=>{hideTooltip();});
        slot.addEventListener('click',()=>{
          // Move to hotbar if possible
          for(let i=0;i<playerState.hotbar.length;i++){
            if(!playerState.hotbar[i]){
              playerState.hotbar[i]=item;
              const idx=playerState.inventory.indexOf(item);
              if(idx!==-1) playerState.inventory.splice(idx,1);
              renderInventory(playerState); break;
            }
          }
        });
      }
      grid.appendChild(slot);
    }
    // Armor slots
    const armorSlots = ['head','body','feet'];
    for (const aslot of armorSlots) {
      const slot=document.createElement('div');
      slot.className='inv-slot';
      slot.style.borderColor='rgba(200,160,60,0.3)';
      const item = playerState.armor[aslot];
      if (item) {
        const def=Items.get(item.id);
        slot.innerHTML=`<div class="slot-icon">${def?.icon||'?'}</div>`;
        slot.title=aslot;
      } else {
        slot.innerHTML=`<div style="font-size:10px;color:rgba(200,200,200,0.3)">${aslot}</div>`;
      }
      grid.appendChild(slot);
    }
  }
  
  function renderCrafting(playerState) {
    els.recipeList.innerHTML='';
    const recipes = Items.RECIPES;
    for (const recipe of recipes) {
      const canMake = Player.canCraft(recipe.id);
      const needsBench = recipe.station==='workbench';
      const hasStation = !needsBench || playerState.nearWorkbench;
      
      const item = document.createElement('div');
      item.className = 'recipe-item' + (canMake&&hasStation?' craftable':'');
      
      const reqs = recipe.requires.map(r=>{
        const have = Player.countItem(r.id);
        const def = Items.get(r.id);
        const ok = have>=r.n;
        return `<span style="color:${ok?'#80d080':'#e07070'}">${def?.icon||'?'}×${r.n}</span>`;
      }).join(' ');
      
      const resIcon = Items.get(recipe.result.id)?.icon||'?';
      item.innerHTML=`
        <div class="recipe-name">${resIcon} ${recipe.name}</div>
        <div>
          <div class="recipe-reqs">${reqs}${needsBench?'<span style="color:#c8a030;margin-left:6px">🪚</span>':''}</div>
          <button class="craft-btn" ${(canMake&&hasStation)?'':'disabled'} data-id="${recipe.id}">CRAFT</button>
        </div>`;
      item.querySelector('.craft-btn').addEventListener('click',()=>{
        Player.craft(recipe.id);
        renderCrafting(playerState);
      });
      els.recipeList.appendChild(item);
    }
  }
  
  function showTooltip(e, item) {
    const def = Items.get(item.id);
    if (!def) return;
    let html = `<strong>${def.name}</strong>`;
    if (def.type==='tool') html+=`<br>Power: ${def.toolPower||1} | Dur: ${item.durability||def.durability||def.maxDura}/${def.maxDura}`;
    if (def.type==='food') html+=`<br>Hunger: +${def.hunger}${def.warmth?`<br>Warmth: ${def.warmth>0?'+':''}${def.warmth}`:''}`;
    if (def.type==='armor') html+=`<br>Warmth: +${def.warmth||0} | Armor: +${def.armor||0}`;
    if (def.fuelValue) html+=`<br>Fuel: ${def.fuelValue}`;
    els.tooltip.innerHTML=html;
    els.tooltip.style.display='block';
    els.tooltip.style.left=Math.min(e.clientX+12, window.innerWidth-220)+'px';
    els.tooltip.style.top=Math.max(10,e.clientY-40)+'px';
  }
  function hideTooltip() { els.tooltip.style.display='none'; }
  
  // Message log
  const msgQueue = [];
  function showMsg(text, type) {
    const msg = document.createElement('div');
    msg.className='msg '+(type||'');
    msg.textContent=text;
    els.msgLog.appendChild(msg);
    msgQueue.push(msg);
    if (msgQueue.length>5) {
      const old=msgQueue.shift();
      if(old.parentNode)old.parentNode.removeChild(old);
    }
    setTimeout(()=>{ if(msg.parentNode)msg.parentNode.removeChild(msg); },4000);
  }
  
  // Loading screen
  function setLoading(pct, text) {
    els.loadFill.style.width=pct+'%';
    if (text) els.loadText.textContent=text;
    if (pct>=100) {
      setTimeout(()=>{
        els.loading.style.transition='opacity 0.8s';
        els.loading.style.opacity='0';
        setTimeout(()=>{els.loading.style.display='none';},800);
      },400);
    }
  }
  
  // Touch / button controls
  function setupTouchControls() {
    const dpadUp    = document.getElementById('dpad-up');
    const dpadDown  = document.getElementById('dpad-down');
    const dpadLeft  = document.getElementById('dpad-left');
    const dpadRight = document.getElementById('dpad-right');
    const dpadMid   = document.getElementById('dpad-mid');
    
    function touch(el, down, up) {
      el.addEventListener('touchstart',e=>{e.preventDefault();down();},{passive:false});
      el.addEventListener('touchend',e=>{e.preventDefault();up();},{passive:false});
      el.addEventListener('mousedown',e=>{e.preventDefault();down();},{passive:false});
      el.addEventListener('mouseup',e=>{e.preventDefault();up();},{passive:false});
    }
    
    touch(dpadLeft,  ()=>Player.state.moveLeft=true,  ()=>Player.state.moveLeft=false);
    touch(dpadRight, ()=>Player.state.moveRight=true, ()=>Player.state.moveRight=false);
    touch(dpadUp,    ()=>{ Player.state.jump=true; },    ()=>{});
    touch(dpadMid,   ()=>Player.state.sprint=!Player.state.sprint, ()=>{});
    
    document.getElementById('btn-mine').addEventListener('click',()=>{
      Game && Game.startMineAtCursor();
    });
    document.getElementById('btn-place').addEventListener('click',()=>{
      Game && Game.placeAtCursor();
    });
    document.getElementById('btn-inv').addEventListener('click',()=>{
      Player.state.invOpen = !Player.state.invOpen;
      if(Player.state.invOpen) Player.state.craftOpen=false;
    });
    document.getElementById('btn-craft').addEventListener('click',()=>{
      Player.state.craftOpen = !Player.state.craftOpen;
      if(Player.state.craftOpen) Player.state.invOpen=false;
    });
    
    // Hotbar touch long-press to use
    hotbarSlots.forEach((s,i)=>{
      s.addEventListener('touchstart',e=>{
        e.preventDefault();
        Player.state.hotbarSel=i;
      },{passive:false});
    });
  }
  
  // Draw cursor/target highlight on canvas
  function drawCursor(ctx, targetTx, targetTy, miningProgress) {
    if (targetTx===null||targetTx===undefined) return;
    const T=World.TILE;
    const s=Engine.worldToScreen(targetTx*T,targetTy*T);
    const sz=T*Engine.cam.zoom;
    ctx.save();
    ctx.strokeStyle=`rgba(255,255,255,${0.4+Math.sin(Date.now()*0.005)*0.2})`;
    ctx.lineWidth=1.5;
    ctx.strokeRect(s.x+1,s.y+1,sz-2,sz-2);
    if (miningProgress>0) {
      // Crack overlay
      ctx.fillStyle=`rgba(0,0,0,${miningProgress*0.4})`;
      ctx.fillRect(s.x,s.y,sz,sz);
      // Progress arc
      ctx.strokeStyle=`rgba(100,220,100,0.8)`;
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(s.x+sz/2,s.y+sz/2,sz*0.35,-Math.PI/2,-Math.PI/2+miningProgress*Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
  }

  return { init, updateHUD, showMsg, setLoading, drawCursor };
})();
