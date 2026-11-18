// save.js — localStorage save/load for Palmera Bay (story progress, cash, garage, collectibles, best score, settings).
export const SAVE_KEY = 'palmera-bay-save-v4';

export function defaultSave() {
  return {
    cash: 250, health: 100, armor: 0,
    jobsDone: [], bestScore: 0, bestGrade: '',
    collectibles: [], jumps: [],
    garage: { engine: 0, armor: 0, paint: 0, nitro: 0 },
    weapons: { pistol: { owned: true, ammo: 48 }, smg: { owned: false, ammo: 0 }, shotgun: { owned: false, ammo: 0 }, rifle: { owned: false, ammo: 0 }, marksman: { owned: false, ammo: 0 } },
    currentWeapon: 'pistol',
    radioStation: 0, muted: false,
    stats: { earned: 0, shotsFired: 0, shotsHit: 0, carsStolen: 0, fares: 0, topSpeed: 0 },
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const base = defaultSave();
    return Object.assign(base, data, { garage: Object.assign(base.garage, data.garage || {}), stats: Object.assign(base.stats, data.stats || {}) });
  } catch (e) { return null; }
}

export function writeSave(game) {
  try {
    const s = game.save;
    s.cash = Math.round(game.player.cash);
    s.health = Math.round(game.player.health);
    s.armor = Math.round(game.player.armor);
    s.bestScore = Math.max(s.bestScore, Math.round(game.player.cash + game.stats.earned));
    s.radioStation = game.radio.station;
    s.muted = game.audio.muted;
    s.currentWeapon = game.combat.current;
    s.weapons = game.combat.weapons;
    s.collectibles = game.missions.collectedPackages;
    s.jumps = game.missions.jumpsDone;
    s.jobsDone = game.missions.done;
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch (e) { return false; }
}

export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
