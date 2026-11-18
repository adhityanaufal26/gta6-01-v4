// combat.js — 5 weapons, mouse aim, ammo, pickups, hit detection vs peds, police and cars.
export const WEAPONS = {
  fists: { name: 'Fists', damage: 8, rate: 0.35, range: 3, auto: false, ammoMax: Infinity },
  pistol: { name: 'P9 Sidearm', damage: 22, rate: 0.28, range: 60, auto: false, ammoMax: 120, price: 0 },
  smg: { name: 'Vesper SMG', damage: 13, rate: 0.09, range: 45, auto: true, ammoMax: 240, price: 800 },
  shotgun: { name: 'Street Sweeper', damage: 55, rate: 0.8, range: 22, auto: false, ammoMax: 48, price: 1200 },
  rifle: { name: 'Longshot Rifle', damage: 40, rate: 0.16, range: 90, auto: true, ammoMax: 150, price: 1800 },
  marksman: { name: 'Hawkeye Marksman', damage: 95, rate: 1.1, range: 130, auto: false, ammoMax: 30, price: 2500 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle', 'marksman'];

export class Combat {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.weapons = JSON.parse(JSON.stringify(game.save.weapons));
    this.current = game.save.currentWeapon || 'pistol';
    this.cooldown = 0;
    this.tracer = null;
    this.pickups = [];
    this.spawnPickups();
  }
  spawnPickups() {
    const spots = [[-120, -120], [200, 120], [-280, 40], [40, 320], [280, -280], [-40, -320]];
    for (const [x, z] of spots) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.4), new THREE.MeshBasicMaterial({ color: 0x7dff9a }));
      mesh.position.set(x, 1, z);
      this.scene.add(mesh);
      this.pickups.push({ x, z, mesh, kind: Math.random() > 0.5 ? 'ammo' : 'health', taken: false });
    }
  }
  selectWeapon(id) {
    if (this.weapons[id] && this.weapons[id].owned) {
      this.current = id;
      this.game.audio.blip(520, 0.06, 'square', 0.1);
    }
  }
  cycleWeapon(dir = 1) {
    const owned = WEAPON_ORDER.filter((w) => this.weapons[w] && this.weapons[w].owned);
    if (owned.length < 2) return;
    const i = owned.indexOf(this.current);
    this.current = owned[(i + dir + owned.length) % owned.length];
  }
  ammo() {
    const w = this.weapons[this.current];
    return w ? w.ammo : 0;
  }
  shoot() {
    const game = this.game;
    if (this.cooldown > 0) return false;
    const def = WEAPONS[this.current];
    const w = this.weapons[this.current];
    if (this.current !== 'fists' && (!w || !w.owned || w.ammo <= 0)) {
      game.audio.blip(180, 0.1, 'square', 0.12);
      game.hud.toast('No ammo — buy more at Harbor Arms (F).', 2000);
      return false;
    }
    this.cooldown = def.rate;
    if (this.current !== 'fists') w.ammo -= 1;
    game.stats.shotsFired += 1;
    game.audio.gunshot(def.damage >= 50);
    // aim from camera through screen center
    const origin = game.camera.position.clone();
    const dir = new THREE.Vector3();
    game.camera.getWorldDirection(dir);
    const ray = new THREE.Raycaster(origin, dir);
    ray.far = def.range;
    // targets: peds, cops, police cars, traffic
    const targets = [];
    for (const p of game.pedestrians.peds) if (p.alive) targets.push(p.mesh);
    for (const c of game.police.foot) targets.push(c.mesh);
    for (const c of game.police.cars) targets.push(c.mesh);
    for (const c of game.vehicles.traffic) targets.push(c.mesh);
    const hits = ray.intersectObjects(targets, true);
    let hitSomething = false;
    if (hits.length > 0) {
      const hit = hits[0];
      hitSomething = true;
      game.stats.shotsHit += 1;
      // find owner mesh
      let obj = hit.object;
      while (obj && !obj.userData.isCar && obj.parent) obj = obj.parent;
      this.impactFx(hit.point);
      // ped hit?
      for (const p of game.pedestrians.peds) {
        if (p.alive && (p.mesh === hit.object || p.mesh === obj || p.mesh.children.includes(hit.object))) {
          p.alive = false; p.mesh.visible = false;
          game.addWanted(1, 'shooting');
          game.pedestrians.scare(p.x, p.z, 40);
          game.pedestrians.spawnPed(p.x + 100, p.z + 100);
        }
      }
      // police car hit: damage it, it may explode off
      for (let i = game.police.cars.length - 1; i >= 0; i--) {
        const c = game.police.cars[i];
        if (c.mesh === hit.object || c.mesh === obj || c.mesh.children.includes(hit.object)) {
          c.speed *= 0.5;
          if (Math.random() < 0.25) {
            game.scene.remove(c.mesh); game.police.cars.splice(i, 1);
            game.hud.toast('Police car disabled!', 1800);
            game.player.cash += 25; game.stats.earned += 25;
          }
          game.addWanted(1, 'shooting police');
        }
      }
    }
    // muzzle tracer
    this.showTracer(origin, dir, def.range, hitSomething ? hits[0].distance : def.range);
    // gunfire scares nearby peds and raises heat a little
    game.pedestrians.scare(game.playerPos().x, game.playerPos().z, 30);
    return true;
  }
  impactFx(point) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    s.position.copy(point);
    this.scene.add(s);
    setTimeout(() => this.scene.remove(s), 180);
  }
  showTracer(origin, dir, range, len) {
    if (this.tracer) this.scene.remove(this.tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([origin, origin.clone().add(dir.clone().multiplyScalar(len))]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe27a }));
    this.scene.add(this.tracer);
    setTimeout(() => { if (this.tracer) { this.scene.remove(this.tracer); this.tracer = null; } }, 90);
  }
  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    const pos = this.game.playerPos();
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      pk.mesh.rotation.y += dt * 2;
      if (Math.hypot(pk.x - pos.x, pk.z - pos.z) < 2.5) {
        pk.taken = true; pk.mesh.visible = false;
        if (pk.kind === 'ammo') {
          const w = this.weapons[this.current];
          if (w) w.ammo = Math.min(w.ammo + 24, WEAPONS[this.current].ammoMax);
          this.game.hud.toast('+24 ammo', 1500);
        } else {
          this.game.player.health = Math.min(100, this.game.player.health + 40);
          this.game.hud.toast('+40 health', 1500);
        }
        this.game.audio.blip(990, 0.12, 'sine', 0.15);
      }
    }
  }
}
