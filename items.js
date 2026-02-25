// =============================================
// ITEMS.JS — Everything you carry
// =============================================

const ITEM_DEFS = {
  // FOUND items (collectable on mountain)
  iron_ore:     { name:'Iron Ore',      icon:'🪨', value:8,  type:'material', desc:'Heavy. Everywhere.' },
  crystal_shard:{ name:'Ice Crystal',   icon:'💎', value:22, type:'material', desc:'Blue. Cold to touch.' },
  old_button:   { name:'Old Button',    icon:'🔘', value:5,  type:'curiosity', desc:'Someone lost this.' },
  fossil:       { name:'Stone Fossil',  icon:'🐚', value:30, type:'curiosity', desc:'Older than the mountain.' },
  wolf_fur:     { name:'Wolf Fur',      icon:'🐺', value:18, type:'material', desc:'Still warm.' },
  rope_scrap:   { name:'Rope Scrap',    icon:'🪢', value:12, type:'material', desc:'Fraying, but usable.' },
  snow_flower:  { name:'Snow Flower',   icon:'❄️', value:15, type:'curiosity', desc:'It blooms once a century.' },
  ancient_coin: { name:'Ancient Coin',  icon:'🪙', value:45, type:'curiosity', desc:'The face is worn smooth.' },
  bird_feather: { name:'Bird Feather',  icon:'🪶', value:7,  type:'curiosity', desc:'From a bird no one can name.' },
  dark_stone:   { name:'Dark Stone',    icon:'⬛', value:20, type:'material', desc:'Absorbs warmth.' },
  amber_chunk:  { name:'Amber Chunk',   icon:'🟡', value:35, type:'material', desc:'Something inside it.' },
  memo_scrap:   { name:'Old Note',      icon:'📜', value:10, type:'curiosity', desc:'Mostly illegible.' },

  // BUYABLE consumables
  hot_tea:      { name:'Hot Tea',       icon:'🫖', value:0,  type:'consumable', cost:15, desc:'Restores stamina.', effect:'stamina', amount:40 },
  thick_gloves: { name:'Thick Gloves',  icon:'🧤', value:0,  type:'equippable', cost:40, desc:'+Cold resistance', effect:'cold_resist', amount:20 },
  anchor_bolt:  { name:'Anchor Bolt',   icon:'⚓', value:0,  type:'consumable', cost:12, desc:'Plant in wall for rest.', effect:'anchor', amount:1 },
  rope_coil:    { name:'Rope Coil',     icon:'🪢', value:0,  type:'consumable', cost:20, desc:'+Rope reach.', effect:'rope_extend', amount:1 },
  ration_pack:  { name:'Rations',       icon:'🍖', value:0,  type:'consumable', cost:25, desc:'Restores full stamina.', effect:'stamina', amount:100 },
  lantern:      { name:'Lantern',       icon:'🏮', value:0,  type:'equippable', cost:60, desc:'See in blizzard.', effect:'visibility', amount:1 },
  crampons:     { name:'Crampons',      icon:'🦶', value:0,  type:'equippable', cost:55, desc:'+Grip on ice.', effect:'grip', amount:1 },
  warm_cloak:   { name:'Warm Cloak',    icon:'🧥', value:0,  type:'equippable', cost:80, desc:'Resists cold wind.', effect:'cold_resist', amount:40 },
};

const UPGRADES = [
  {
    id: 'rope_strength',
    name: 'Stronger Rope',
    icon: '🪢',
    desc: 'Your rope holds more weight and swings farther.',
    maxLevel: 4,
    baseCost: 30,
    costPerLevel: 20,
    effect: 'rope_range',
    valuePerLevel: 30,
  },
  {
    id: 'stamina_max',
    name: 'Endurance Training',
    icon: '💪',
    desc: 'Increases your maximum stamina.',
    maxLevel: 5,
    baseCost: 25,
    costPerLevel: 15,
    effect: 'max_stamina',
    valuePerLevel: 20,
  },
  {
    id: 'cold_resist',
    name: 'Frost-Hardened Skin',
    icon: '🧊',
    desc: 'Cold drains stamina slower.',
    maxLevel: 3,
    baseCost: 40,
    costPerLevel: 25,
    effect: 'cold_resist',
    valuePerLevel: 25,
  },
  {
    id: 'pickaxe_power',
    name: 'Sharper Pickaxe',
    icon: '⛏️',
    desc: 'Mine faster, find better items.',
    maxLevel: 3,
    baseCost: 35,
    costPerLevel: 20,
    effect: 'pick_power',
    valuePerLevel: 1,
  },
  {
    id: 'fall_resist',
    name: 'Climber\'s Instinct',
    icon: '🧗',
    desc: 'Survive small falls without full death.',
    maxLevel: 2,
    baseCost: 60,
    costPerLevel: 40,
    effect: 'fall_buffer',
    valuePerLevel: 1,
  },
  {
    id: 'find_rate',
    name: 'Keen Eyes',
    icon: '👁️',
    desc: 'Find rarer items while climbing.',
    maxLevel: 3,
    baseCost: 45,
    costPerLevel: 30,
    effect: 'find_rate',
    valuePerLevel: 0.15,
  }
];

const Inventory = {
  items: {}, // itemId: quantity
  equipped: [], // item ids
  upgrades: {}, // upgradeId: level
  coins: 0,

  init() {
    const saved = localStorage.getItem('ascent_inventory');
    if (saved) {
      const d = JSON.parse(saved);
      this.items = d.items || {};
      this.equipped = d.equipped || [];
      this.upgrades = d.upgrades || {};
      this.coins = d.coins || 0;
    }
  },

  save() {
    localStorage.setItem('ascent_inventory', JSON.stringify({
      items: this.items,
      equipped: this.equipped,
      upgrades: this.upgrades,
      coins: this.coins
    }));
  },

  addItem(id, qty = 1) {
    this.items[id] = (this.items[id] || 0) + qty;
  },

  removeItem(id, qty = 1) {
    if (!this.items[id]) return false;
    this.items[id] -= qty;
    if (this.items[id] <= 0) delete this.items[id];
    return true;
  },

  hasItem(id, qty = 1) {
    return (this.items[id] || 0) >= qty;
  },

  sellItem(id, qty = 1) {
    const def = ITEM_DEFS[id];
    if (!def || !this.removeItem(id, qty)) return 0;
    const earned = def.value * qty;
    this.coins += earned;
    this.save();
    return earned;
  },

  sellAll() {
    let total = 0;
    const toSell = Object.keys(this.items).filter(id => {
      const def = ITEM_DEFS[id];
      return def && def.value > 0 && def.type !== 'consumable' && def.type !== 'equippable';
    });
    toSell.forEach(id => {
      const qty = this.items[id];
      total += this.sellItem(id, qty);
    });
    return total;
  },

  buyItem(id) {
    const def = ITEM_DEFS[id];
    if (!def || !def.cost) return false;
    if (this.coins < def.cost) return false;
    this.coins -= def.cost;
    this.addItem(id, 1);
    this.save();
    return true;
  },

  buyUpgrade(upgradeId) {
    const upg = UPGRADES.find(u => u.id === upgradeId);
    if (!upg) return false;
    const currentLevel = this.upgrades[upgradeId] || 0;
    if (currentLevel >= upg.maxLevel) return false;
    const cost = upg.baseCost + currentLevel * upg.costPerLevel;
    if (this.coins < cost) return false;
    this.coins -= cost;
    this.upgrades[upgradeId] = currentLevel + 1;
    this.save();
    return true;
  },

  getUpgradeLevel(id) {
    return this.upgrades[id] || 0;
  },

  getUpgradeValue(id) {
    const upg = UPGRADES.find(u => u.id === id);
    if (!upg) return 0;
    return (this.upgrades[id] || 0) * upg.valuePerLevel;
  },

  equipItem(id) {
    const def = ITEM_DEFS[id];
    if (!def || def.type !== 'equippable') return false;
    if (!this.hasItem(id)) return false;
    if (!this.equipped.includes(id)) {
      this.equipped.push(id);
    }
    return true;
  },

  isEquipped(id) {
    return this.equipped.includes(id);
  },

  useConsumable(id) {
    if (!this.hasItem(id)) return null;
    const def = ITEM_DEFS[id];
    if (!def || def.type !== 'consumable') return null;
    this.removeItem(id, 1);
    this.save();
    return def;
  },

  // Random item found while climbing
  randomFindItem(altitude, findRate) {
    const materialItems = Object.keys(ITEM_DEFS).filter(id => {
      const d = ITEM_DEFS[id];
      return d.type === 'material' || d.type === 'curiosity';
    });
    const rareItems = ['crystal_shard','fossil','ancient_coin','amber_chunk','snow_flower'];
    const rand = Math.random();
    const effectiveFindRate = findRate || 0.05;
    if (rand > effectiveFindRate) return null;

    // Rarer items more likely at high altitude
    const altBonus = Math.min(altitude / 5000, 0.5);
    const isRare = Math.random() < (0.15 + altBonus);
    const pool = isRare ? rareItems : materialItems;
    return pool[Math.floor(Math.random() * pool.length)];
  }
};

// ---- SHOP UI ----
const ShopUI = {
  activeTab: 'sell',

  init() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    document.getElementById('sellAllBtn').addEventListener('click', () => {
      const total = Inventory.sellAll();
      if (total > 0) {
        notify(`Sold everything for ⬡${total}`);
        this.refresh();
      } else {
        notify('Nothing to sell.');
      }
    });
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('tabSell').classList.toggle('hidden', tab !== 'sell');
    document.getElementById('tabBuy').classList.toggle('hidden', tab !== 'buy');
    document.getElementById('tabUpgrades').classList.toggle('hidden', tab !== 'upgrades');
    this.refresh();
  },

  refresh() {
    document.getElementById('campCoins').textContent = Inventory.coins;
    if (this.activeTab === 'sell') this.renderSell();
    if (this.activeTab === 'buy') this.renderBuy();
    if (this.activeTab === 'upgrades') this.renderUpgrades();
  },

  renderSell() {
    const grid = document.getElementById('sellGrid');
    grid.innerHTML = '';
    const sellableItems = Object.keys(Inventory.items).filter(id => {
      const def = ITEM_DEFS[id];
      return def && def.value > 0;
    });
    if (sellableItems.length === 0) {
      grid.innerHTML = '<div style="color:var(--text-dim);font-family:var(--font-mono);font-size:12px;padding:10px">Nothing to sell. Keep climbing.</div>';
      return;
    }
    sellableItems.forEach(id => {
      const def = ITEM_DEFS[id];
      const qty = Inventory.items[id];
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <span class="item-qty">x${qty}</span>
        <span class="item-icon">${def.icon}</span>
        <div class="item-name">${def.name}</div>
        <div class="item-value">⬡${def.value}</div>
      `;
      card.addEventListener('click', () => {
        const earned = Inventory.sellItem(id, 1);
        if (earned) { notify(`Sold ${def.name} for ⬡${earned}`); this.refresh(); }
      });
      grid.appendChild(card);
    });
  },

  renderBuy() {
    const grid = document.getElementById('buyGrid');
    grid.innerHTML = '';
    const buyable = ['hot_tea','ration_pack','anchor_bolt','rope_coil','thick_gloves','crampons','warm_cloak','lantern'];
    buyable.forEach(id => {
      const def = ITEM_DEFS[id];
      if (!def) return;
      const owned = Inventory.items[id] || 0;
      const canAfford = Inventory.coins >= def.cost;
      const card = document.createElement('div');
      card.className = 'item-card';
      card.style.opacity = canAfford ? '1' : '0.5';
      card.innerHTML = `
        ${owned ? `<span class="item-qty">x${owned}</span>` : ''}
        <span class="item-icon">${def.icon}</span>
        <div class="item-name">${def.name}</div>
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-dim);margin-top:2px">${def.desc}</div>
        <div class="item-value">⬡${def.cost}</div>
      `;
      card.addEventListener('click', () => {
        if (Inventory.buyItem(id)) {
          notify(`Bought ${def.name}`);
          this.refresh();
        } else {
          notify('Not enough coins.');
        }
      });
      grid.appendChild(card);
    });
  },

  renderUpgrades() {
    const list = document.getElementById('upgradeList');
    list.innerHTML = '';
    UPGRADES.forEach(upg => {
      const level = Inventory.getUpgradeLevel(upg.id);
      const maxed = level >= upg.maxLevel;
      const cost = maxed ? '---' : upg.baseCost + level * upg.costPerLevel;
      const canAfford = !maxed && Inventory.coins >= (upg.baseCost + level * upg.costPerLevel);

      const div = document.createElement('div');
      div.className = 'upgrade-item' + (maxed ? ' maxed' : '');
      div.style.opacity = (!maxed && !canAfford) ? '0.6' : '1';

      let pips = '';
      for (let i = 0; i < upg.maxLevel; i++) {
        pips += `<div class="lvl-pip ${i < level ? 'filled' : ''}"></div>`;
      }

      div.innerHTML = `
        <div class="upgrade-icon">${upg.icon}</div>
        <div class="upgrade-info">
          <div class="upgrade-name">${upg.name}</div>
          <div class="upgrade-desc">${upg.desc}</div>
          <div class="upgrade-level">${pips}</div>
        </div>
        <div class="upgrade-cost">${maxed ? '✓' : '⬡' + cost}</div>
      `;
      div.addEventListener('click', () => {
        if (maxed) return;
        if (Inventory.buyUpgrade(upg.id)) {
          notify(`${upg.name} upgraded!`);
          this.refresh();
        } else {
          notify('Not enough coins.');
        }
      });
      list.appendChild(div);
    });
  }
};

function notify(msg, duration = 2500) {
  const el = document.getElementById('notification');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.add('hidden'), duration);
}

function showItemFound(itemId) {
  const def = ITEM_DEFS[itemId];
  if (!def) return;
  // Remove old popup
  document.querySelectorAll('.item-found-popup').forEach(el => el.remove());
  const el = document.createElement('div');
  el.className = 'item-found-popup';
  el.innerHTML = `${def.icon} Found: ${def.name}`;
  document.getElementById('gameScreen').appendChild(el);
  setTimeout(() => el.remove(), 2700);
}
