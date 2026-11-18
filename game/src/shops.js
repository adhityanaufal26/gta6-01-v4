// shops.js — Harbor Arms (weapons/ammo/health/armor), Voss Garage (engine/armor/paint/nitro), safehouse (save + clear wanted), Spray Works (clear wanted).
import { WEAPONS } from './combat.js';

export const PAINTS = [
  { name: 'Sunset Gold', color: 0xffd23e, price: 150 },
  { name: 'Ocean Blue', color: 0x2e7fc9, price: 150 },
  { name: 'Cherry Red', color: 0xd94f30, price: 150 },
  { name: 'Midnight Black', color: 0x1a1a1a, price: 200 },
  { name: 'Lime Rush', color: 0x7dff5a, price: 250 },
];

export class Shops {
  constructor(game) {
    this.game = game;
    this.open = null; // 'shop' | 'garage' | 'safehouse' | 'spray'
  }
  nearestSpot() {
    const pos = this.game.playerPos();
    const spots = [
      { key: 'shop', at: 'shop', range: 9 },
      { key: 'garage', at: 'garage', range: 9 },
      { key: 'safehouse', at: 'safehouse', range: 9 },
      { key: 'spray', at: 'spray', range: 9 },
      { key: 'job', at: 'garage', range: 14 },
    ];
    for (const s of spots) {
      const m = this.game.city.markers[s.at];
      if (Math.hypot(m.x - pos.x, m.z - pos.z) < s.range) return s.key;
    }
    return null;
  }
  openShop(kind) {
    const g = this.game;
    this.open = kind;
    if (kind === 'safehouse') {
      g.police.setWanted(0, 'safehouse');
      g.player.health = 100;
      g.saveGame();
      g.hud.toast('Safehouse — game saved, wanted cleared, health restored.', 3500);
      g.audio.blip(990, 0.2, 'sine', 0.18);
      this.open = null;
      return;
    }
    if (kind === 'spray') {
      if (g.player.cash < 100) { g.hud.toast('Spray Works costs $100 — not enough cash.', 2500); this.open = null; return; }
      g.player.cash -= 100;
      g.police.setWanted(0, 'spray');
      g.hud.toast('Spray Works — fresh paint, heat gone. -$100', 3000);
      this.open = null;
      return;
    }
    if (kind === 'job') { g.missions.offerNext(); this.open = null; return; }
    g.hud.showShop(kind);
    g.audio.blip(660, 0.08, 'square', 0.12);
  }
  closeShop() { this.open = null; this.game.hud.hideShop(); }
  items(kind) {
    const g = this.game;
    const list = [];
    if (kind === 'shop') {
      for (const id of ['smg', 'shotgun', 'rifle', 'marksman']) {
        const w = WEAPONS[id];
        const owned = g.combat.weapons[id] && g.combat.weapons[id].owned;
        list.push({ id: 'buy_' + id, label: w.name + (owned ? ' (owned)' : ''), price: w.price, desc: owned ? 'Buy ammo +24' : 'Buy weapon + 24 ammo', can: g.player.cash >= (owned ? 120 : w.price) });
      }
      list.push({ id: 'ammo', label: 'Ammo pack (+24 for current weapon)', price: 120, desc: 'Top up your current gun', can: g.player.cash >= 120 });
      list.push({ id: 'health', label: 'Medkit (+50 health)', price: 150, desc: 'Patch yourself up', can: g.player.cash >= 150 });
      list.push({ id: 'armor', label: 'Body armor (+50)', price: 200, desc: 'Stops bullets, not bad luck', can: g.player.cash >= 200 });
    } else if (kind === 'garage') {
      const gr = g.save.garage;
      list.push({ id: 'engine', label: 'Engine tune Lv ' + gr.engine + ' → ' + (gr.engine + 1) + ' (max 3)', price: 500 * (gr.engine + 1), desc: '+15% top speed', can: g.player.cash >= 500 * (gr.engine + 1) && gr.engine < 3 });
      list.push({ id: 'garmor', label: 'Car armor Lv ' + gr.armor + ' → ' + (gr.armor + 1) + ' (max 3)', price: 400 * (gr.armor + 1), desc: 'Car takes less damage from rams', can: g.player.cash >= 400 * (gr.armor + 1) && gr.armor < 3 });
      list.push({ id: 'nitro', label: 'Nitro kit (press N for boost)', price: 600, desc: 'One kit, unlimited boosts', can: g.player.cash >= 600 && !gr.nitro });
      for (let i = 0; i < PAINTS.length; i++) {
        list.push({ id: 'paint_' + i, label: 'Paint: ' + PAINTS[i].name, price: PAINTS[i].price, desc: 'Repaint your current car', can: g.player.cash >= PAINTS[i].price && !!g.player.car });
      }
    }
    return list;
  }
  buy(id) {
    const g = this.game;
    const kind = this.open;
    if (kind === 'shop') {
      if (id.startsWith('buy_')) {
        const wid = id.slice(4);
        const w = WEAPONS[wid];
        const owned = g.combat.weapons[wid].owned;
        const price = owned ? 120 : w.price;
        if (g.player.cash < price) return 'Not enough cash.';
        g.player.cash -= price;
        g.combat.weapons[wid].owned = true;
        g.combat.weapons[wid].ammo = Math.min(g.combat.weapons[wid].ammo + 24, w.ammoMax);
        g.combat.selectWeapon(wid);
        return 'Bought ' + w.name + ' (-$' + price + ')';
      }
      if (id === 'ammo') {
        if (g.player.cash < 120) return 'Not enough cash.';
        g.player.cash -= 120;
        const w = g.combat.weapons[g.combat.current];
        if (w) w.ammo = Math.min(w.ammo + 24, WEAPONS[g.combat.current].ammoMax);
        return 'Ammo topped up (-$120)';
      }
      if (id === 'health') {
        if (g.player.cash < 150) return 'Not enough cash.';
        g.player.cash -= 150; g.player.health = Math.min(100, g.player.health + 50);
        return 'Medkit used (-$150)';
      }
      if (id === 'armor') {
        if (g.player.cash < 200) return 'Not enough cash.';
        g.player.cash -= 200; g.player.armor = Math.min(100, g.player.armor + 50);
        return 'Body armor fitted (-$200)';
      }
    } else if (kind === 'garage') {
      const gr = g.save.garage;
      if (id === 'engine') {
        if (gr.engine >= 3 || g.player.cash < 500 * (gr.engine + 1)) return 'Cannot buy engine tune.';
        g.player.cash -= 500 * (gr.engine + 1); gr.engine += 1;
        return 'Engine tuned to Lv ' + gr.engine;
      }
      if (id === 'garmor') {
        if (gr.armor >= 3 || g.player.cash < 400 * (gr.armor + 1)) return 'Cannot buy car armor.';
        g.player.cash -= 400 * (gr.armor + 1); gr.armor += 1;
        return 'Car armor fitted Lv ' + gr.armor;
      }
      if (id === 'nitro') {
        if (gr.nitro || g.player.cash < 600) return 'Cannot buy nitro.';
        g.player.cash -= 600; gr.nitro = 1;
        return 'Nitro kit installed — press N while driving!';
      }
      if (id.startsWith('paint_')) {
        const i = Number(id.slice(6));
        if (!g.player.car || g.player.cash < PAINTS[i].price) return 'Need a car and cash for paint.';
        g.player.cash -= PAINTS[i].price;
        g.player.car.mesh.children[0].material.color.setHex(PAINTS[i].color);
        g.save.garage.paint = i;
        return 'Repainted ' + PAINTS[i].name;
      }
    }
    return 'Nothing bought.';
  }
}
