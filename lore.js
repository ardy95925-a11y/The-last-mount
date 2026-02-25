// =============================================
// LORE.JS — The mountain's memory
// =============================================

const LORE = {
  fragments: [
    {
      id: 'letter_001',
      title: 'Letter — Found Near the First Cairn',
      altUnlock: 0,
      text: `If you are reading this, you found the cairn I built for her.
Her name was Mara. She made it further than anyone told her she could.
I leave this note so the mountain knows someone remembers.
The rope she carried — I kept it. I couldn't throw it away.
Maybe you'll need it where she couldn't go anymore.
— E.`
    },
    {
      id: 'camp1_note',
      title: 'Scrap — Nailed to Camp Thorn's post',
      altUnlock: 200,
      text: `Do not eat the blue berries on the north face.
Brennan ate them. He said they tasted like cold water and sleep.
He woke up three days later, frostbitten, speaking about a door in the ice.
He went back up alone the following morning.
That was two winters ago.`
    },
    {
      id: 'journal_page',
      title: 'Torn Journal Page — Day Unknown',
      altUnlock: 500,
      text: `The wind sounds like breathing at this altitude.
I have stopped trying to figure out if it's the mountain
or something else. It doesn't matter.
What matters: the rope holds. My hands still work.
Up. Always up. 
I used to know why.`
    },
    {
      id: 'survey_note',
      title: 'Old Survey Sheet — Cartographer Unknown',
      altUnlock: 800,
      text: `Summit elevation: UNKNOWN.
First measurement attempt: 2,340m — instruments failed.
Second attempt: fog. Dense. Instruments missing in the morning.
Third attempt: [ink smeared and illegible]
Notes: The mountain resists measurement.
Do not return. Do not send anyone else.`
    },
    {
      id: 'childs_drawing',
      title: 'Child's Drawing — Weatherproofed in Wax',
      altUnlock: 1200,
      text: `[A crude drawing in wax crayon, still somehow vivid. 
A stick figure, a mountain, a tiny fire. 
In child's handwriting at the bottom:]
"come home papa the fire is still on"
[No name. No date. Just wax and cold.]`
    },
    {
      id: 'lodge_register',
      title: 'Old Lodge Register — Highwater Camp',
      altUnlock: 1600,
      text: `Season 1 arrivals: 14. Departures: 14. 
Season 2 arrivals: 11. Departures: 10.
Season 3 arrivals: 9. Departures: 7. 
Season 4 arrivals: 6. Departures: 6.

[A different hand, ink much older]:
Season ?: arrivals: 1. Departures: 1.
[And below it, in fresher ink, only]:
Arrivals: 1.`
    },
    {
      id: 'rope_note',
      title: 'Message Wrapped Around an Anchor Spike',
      altUnlock: 2200,
      text: `I left this anchor for you.
I don't know who you are. I don't need to.
You are climbing. That means you understand.
Some things are not about the summit.
Some things are about the climbing itself.
The rope is fraying at this altitude — I noticed yours too.
Use mine. I am going down.
I have found what I was looking for.
It was not at the top.
— someone who made it far enough`
    },
    {
      id: 'late_note',
      title: 'Note in a Glass Bottle — Frozen Solid',
      altUnlock: 3000,
      text: `The clouds are below me now.
I cannot see the valley.
I cannot remember what it looked like.
I think that is the point.
There is only the ice and the next handhold.
My name was important once.
I've set it down somewhere. I can't carry everything.
The summit is not a place. I'm sure of that now.
It moves. It recedes.
It wants you to keep climbing.
That is either terrible or beautiful.
I have decided: beautiful.`
    },
    {
      id: 'oldest_writing',
      title: 'Stone Tablet — Carved Words, Very Old',
      altUnlock: 4000,
      text: `[The language is ancient, but some words are readable:]
...mountain...hungry...
...gives back...what you leave behind...
...the climber who reaches...
...becomes...
[The rest is worn to nothing by wind.
But the stone is warm to the touch. 
Here. At this altitude.
Where nothing should be warm.]`
    }
  ],

  deathMessages: [
    "The snow fills the marks your hands made. By morning, there will be no trace.",
    "The mountain is patient. It has watched many fall. It will watch many more.",
    "You carried something heavy that wasn't in your pack. That is what brought you down.",
    "The rope held as long as it could. That is all any rope can do.",
    "The cold is not cruel. It simply does not know you yet.",
    "Somewhere below, the fire is still burning at the camp. It will wait.",
    "To fall is not to fail. To fail is to stop getting up.",
    "The wind took your name. It keeps them all. Up there, above the clouds.",
    "Even the mountain does not know its own height."
  ],

  campNames: [
    "The Threshold",
    "Camp Thorn",
    "Ashward Refuge",
    "The Blind Ledge",
    "Highwater Camp",
    "The Hollow",
    "Frostgate",
    "The Grief Shelf",
    "Veilbreak Camp",
    "The Last Fire"
  ],

  campLoreFragments: [
    "The keeper of this camp left no name. Only the fire, which has not gone out in years.",
    "Someone scratched seven marks in the east wall. Each one the same height. They stopped on the seventh.",
    "The firewood here is always dry. No one knows who brings it.",
    "A child's boot sits by the door. It has been there longer than anyone who remembers placing it.",
    "The logbook here has one rule written in the front: Do not write your name. The mountain does not need to know it.",
    "There is a cup on the shelf. It is always warm. It is always empty.",
    "The walls breathe here. You will hear it when the wind stops.",
    "This camp was built around a single spike driven by the First Climber. No one agrees who that was.",
    "Leave something behind when you go. This is tradition. This is how the camps stay alive.",
    "Above this point, the stars are different. The climbers before you called it 'the second sky.'"
  ],

  unlocked: [],

  init() {
    const saved = localStorage.getItem('ascent_lore');
    if (saved) this.unlocked = JSON.parse(saved);
  },

  unlock(id) {
    if (!this.unlocked.includes(id)) {
      this.unlocked.push(id);
      localStorage.setItem('ascent_lore', JSON.stringify(this.unlocked));
      return true;
    }
    return false;
  },

  checkUnlocks(altitude) {
    const newUnlocks = [];
    this.fragments.forEach(f => {
      if (altitude >= f.altUnlock && !this.unlocked.includes(f.id)) {
        if (this.unlock(f.id)) {
          newUnlocks.push(f);
        }
      }
    });
    return newUnlocks;
  },

  getRandomDeathMessage() {
    return this.deathMessages[Math.floor(Math.random() * this.deathMessages.length)];
  },

  getCampName(index) {
    return this.campNames[index % this.campNames.length];
  },

  getCampFragment(index) {
    return this.campLoreFragments[index % this.campLoreFragments.length];
  },

  renderLoreScreen() {
    const list = document.getElementById('loreList');
    if (!list) return;
    list.innerHTML = '';
    this.fragments.forEach(f => {
      const div = document.createElement('div');
      div.className = 'lore-entry' + (this.unlocked.includes(f.id) ? '' : ' locked');
      div.innerHTML = `
        <div class="lore-title">${f.title}</div>
        <div class="lore-text">${this.unlocked.includes(f.id) ? f.text : '[ Not yet found ]'}</div>
        ${this.unlocked.includes(f.id) ? `<div class="lore-found-at">Discovered at ${f.altUnlock}m+</div>` : ''}
      `;
      list.appendChild(div);
    });
  }
};
