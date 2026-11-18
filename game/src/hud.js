// hud.js — HUD (cash/health/wanted/weapon/speed/clock), canvas minimap, and all menus (title, brief, results, shop, pause).
import { MISSIONS } from './missions.js';
import { HEAT_LABELS } from './police.js';
import { WEAPONS } from './combat.js';

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of ['hud', 'cash', 'health', 'armor', 'district', 'clock', 'stars', 'heat', 'objTitle', 'objText', 'weaponName', 'ammo', 'radio', 'collect', 'speedo', 'minimap', 'toast', 'interact', 'crosshair', 'titleScreen', 'briefScreen', 'resultsScreen', 'shopScreen', 'pauseScreen', 'jobList', 'bestLine', 'briefTitle', 'briefGiver', 'briefText', 'briefPay', 'resGrade', 'resTitle', 'resPay', 'resTiles', 'shopTitle', 'shopCash', 'shopItems', 'pauseStats']) {
      this.el[id] = document.getElementById(id);
    }
    this.mm = this.el.minimap.getContext('2d');
    this.minimapZoom = 1;
    this._toastTimer = null;
    this.renderJobList();
    document.getElementById('btnContinue').addEventListener('click', () => this.game.startGame(true));
    document.getElementById('btnNew').addEventListener('click', () => this.game.startGame(false));
    document.getElementById('btnHow').addEventListener('click', () => {
      this.toast('WASD drive, E steal cars, click to shoot, R radio, F shops, M minimap, Esc pause. Finish all 10 jobs!', 5000);
    });
    document.getElementById('btnStartJob').addEventListener('click', () => {
      this.hideBrief();
      this.game.missions.startJob(this.game.missions.offered.id);
    });
    document.getElementById('btnCancelJob').addEventListener('click', () => this.hideBrief());
    document.getElementById('btnResNext').addEventListener('click', () => this.hideResults());
    document.getElementById('btnCloseShop').addEventListener('click', () => this.game.shops.closeShop());
    document.getElementById('btnResume').addEventListener('click', () => this.game.togglePause(false));
    document.getElementById('btnSaveQuit').addEventListener('click', () => {
      this.game.saveGame();
      this.game.togglePause(false);
      this.game.toTitle();
    });
  }
  renderJobList() {
    const done = this.game.save.jobsDone || [];
    this.el.jobList.innerHTML = MISSIONS.map((m) => {
      const d = done.includes(m.id);
      return '<div class="job"><span>' + (m.id + 1) + '. ' + m.name + ' — ' + m.giver + '</span><span class="' + (d ? 'done' : 'lock') + '">' + (d ? '✓ DONE $' + m.pay : '$' + m.pay) + '</span></div>';
    }).join('');
    const s = this.game.save;
    this.el.bestLine.textContent = 'Best score: $' + (s.bestScore || 0) + ' · Jobs done: ' + done.length + '/10 · Packages: ' + (s.collectibles || []).length + '/25 · Jumps: ' + (s.jumps || []).length + '/8';
    document.getElementById('btnContinue').disabled = !this.game.hasSave;
  }
  showHud() { this.el.hud.style.display = 'block'; }
  hideHud() { this.el.hud.style.display = 'none'; }
  setObjective(title, text) { this.el.objTitle.textContent = title; this.el.objText.textContent = text; }
  toast(msg, ms = 2500) {
    this.el.toast.textContent = msg;
    this.el.toast.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.el.toast.style.display = 'none'; }, ms);
  }
  setInteract(text) {
    if (text) { this.el.interact.textContent = text; this.el.interact.style.display = 'block'; }
    else this.el.interact.style.display = 'none';
  }
  showBrief(m) {
    this.el.briefTitle.textContent = 'JOB ' + (m.id + 1) + ' — ' + m.name;
    this.el.briefGiver.textContent = 'From ' + m.giver + ' · Payout $' + m.pay;
    this.el.briefText.textContent = m.brief;
    this.el.briefPay.textContent = 'Steps: ' + m.steps.map((s) => s.label).join(' → ');
    this.el.briefScreen.classList.remove('hidden');
  }
  hideBrief() { this.el.briefScreen.classList.add('hidden'); }
  showResults(grade, def, pay, stats) {
    this.el.resGrade.textContent = grade;
    this.el.resTitle.textContent = def.name.toUpperCase() + ' — COMPLETE';
    this.el.resPay.textContent = 'Payout: $' + pay + ' · Total cash: $' + Math.round(this.game.player.cash);
    this.el.resTiles.innerHTML = Object.entries(stats).map(([k, v]) => '<span class="chip"><b>' + k.toUpperCase() + '</b> ' + v + '</span>').join('');
    this.el.resultsScreen.classList.remove('hidden');
    this.renderJobList();
  }
  hideResults() { this.el.resultsScreen.classList.add('hidden'); }
  showShop(kind) {
    const g = this.game;
    this.el.shopTitle.textContent = kind === 'shop' ? 'HARBOR ARMS — WEAPONS & GEAR' : 'VOSS GARAGE — UPGRADES';
    const render = () => {
      this.el.shopCash.textContent = 'Cash: $' + Math.round(g.player.cash);
      const items = g.shops.items(kind);
      this.el.shopItems.innerHTML = '';
      for (const it of items) {
        const row = document.createElement('div');
        row.className = 'shoprow';
        row.innerHTML = '<span><b>' + it.label + '</b> — ' + it.desc + '</span>';
        const b = document.createElement('button');
        b.className = 'btn'; b.textContent = '$' + it.price;
        b.disabled = !it.can;
        b.addEventListener('click', () => {
          const msg = g.shops.buy(it.id);
          g.hud.toast(msg, 2500);
          g.audio.blip(880, 0.08, 'square', 0.12);
          render();
        });
        row.appendChild(b);
        this.el.shopItems.appendChild(row);
      }
    };
    render();
    this.el.shopScreen.classList.remove('hidden');
  }
  hideShop() { this.el.shopScreen.classList.add('hidden'); }
  showPause() {
    const g = this.game;
    this.el.pauseStats.textContent = 'Cash $' + Math.round(g.player.cash) + ' · Jobs ' + g.missions.done.length + '/10 · Packages ' + g.missions.collectedPackages.length + '/25 · Jumps ' + g.missions.jumpsDone.length + '/8';
    this.el.pauseScreen.classList.remove('hidden');
  }
  hidePause() { this.el.pauseScreen.classList.add('hidden'); }
  update() {
    const g = this.game;
    const p = g.player;
    this.el.cash.textContent = Math.round(p.cash);
    this.el.health.textContent = Math.round(p.health);
    this.el.armor.textContent = Math.round(p.armor);
    this.el.district.textContent = g.districtName();
    const hh = String(Math.floor(g.clock / 60) % 24).padStart(2, '0');
    const mm = String(Math.floor(g.clock % 60)).padStart(2, '0');
    this.el.clock.textContent = hh + ':' + mm;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += '<span class="' + (i < p.wanted ? '' : 'off') + '">★</span>';
    this.el.stars.innerHTML = stars;
    this.el.heat.textContent = HEAT_LABELS[p.wanted];
    this.el.weaponName.textContent = g.combat ? WEAPONS[g.combat.current].name : '';
    const wname = g.combat ? g.combat.weapons[g.combat.current] : null;
    this.el.ammo.textContent = g.combat && g.combat.current !== 'fists' ? ('AMMO ' + (wname ? wname.ammo : 0)) : '';
    this.el.radio.textContent = g.radio.label();
    this.el.collect.textContent = 'Packages ' + g.missions.collectedPackages.length + '/25 · Jumps ' + g.missions.jumpsDone.length + '/8';
    const speed = p.car ? Math.abs(p.car.speed) * 2.2 : 0;
    this.el.speedo.textContent = p.car ? Math.round(speed) + ' mph' : '';
    this.el.crosshair.style.display = (!p.car && g.state === 'play') ? 'block' : 'none';
    this.drawMinimap();
  }
  drawMinimap() {
    const g = this.game;
    const ctx = this.mm;
    const size = 180, R = size / 2;
    const zoom = this.minimapZoom;
    const pos = g.playerPos();
    const scale = (R / 420) * zoom;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#274b2e'; ctx.fillRect(0, 0, size, size);
    // roads
    ctx.strokeStyle = '#3c3f45'; ctx.lineWidth = 3 * zoom;
    for (let i = -4; i <= 4; i++) {
      const c = i * 80;
      ctx.beginPath(); ctx.moveTo((c - pos.x) * scale + R, 0); ctx.lineTo((c - pos.x) * scale + R, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (c - pos.z) * scale + R); ctx.lineTo(size, (c - pos.z) * scale + R); ctx.stroke();
    }
    // sea
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(0, (440 - pos.z) * scale + R, size, size);
    const dot = (x, z, color, r = 4) => {
      const dx = (x - pos.x) * scale + R, dz = (z - pos.z) * scale + R;
      if (dx < -6 || dx > size + 6 || dz < -6 || dz > size + 6) return;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(dx, dz, r, 0, Math.PI * 2); ctx.fill();
    };
    // markers
    for (const [key, m] of Object.entries(g.city.markers)) {
      dot(m.x, m.z, key === 'garage' ? '#ffd23e' : key === 'shop' ? '#7dff9a' : key === 'safehouse' ? '#7fe3ff' : '#ff7a1a', 3);
    }
    // waypoint
    if (g.missions.waypoint) dot(g.missions.waypoint.x, g.missions.waypoint.z, '#ff3b30', 6);
    // collectibles
    for (const s of g.city.collectibleSpots) if (!s.taken) dot(s.x, s.z, '#ff7a1a', 2);
    // police
    for (const c of g.police.cars) dot(c.x, c.z, '#2244ff', 3);
    if (g.police.heli) dot(g.police.heli.position.x, g.police.heli.position.z, '#2244ff', 5);
    // player arrow (north-up)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(R, R - 7); ctx.lineTo(R + 5, R + 6); ctx.lineTo(R - 5, R + 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(R, R, R - 1, 0, Math.PI * 2); ctx.stroke();
  }
}
