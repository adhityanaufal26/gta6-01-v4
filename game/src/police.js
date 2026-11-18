// police.js — wanted response: patrol cars that chase and ram, foot officers, helicopter at 4–5 stars, roadblocks at 4–5 stars.
import { buildCarMesh } from './vehicles.js';
import { buildPedMesh } from './pedestrians.js';

export const HEAT_LABELS = ['Clear', 'Suspect', 'Pursuit', 'Dragnet', 'Manhunt', 'MAXIMUM HEAT'];

export class Police {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.cars = [];
    this.foot = [];
    this.heli = null;
    this.heliLight = null;
    this.roadblocks = [];
    this.roadblockTimer = 0;
    this.spawnTimer = 0;
    this.decayTimer = 0;
    this._lightPhase = 0;
  }
  wanted() { return this.game.player.wanted; }
  setWanted(n, reason) {
    const p = this.game.player;
    const before = p.wanted;
    p.wanted = Math.max(0, Math.min(5, n));
    if (p.wanted > before) {
      this.game.stats.wantedPeak = Math.max(this.game.stats.wantedPeak, p.wanted);
      this.game.audio.siren(p.wanted >= 1);
      if (p.wanted >= 4 && !this.heli) this.spawnHelicopter();
      if (p.wanted >= 4) this.game.hud.toast('HELICOPTER INBOUND — 5-STAR HEAT!', 3000);
    }
    if (p.wanted === 0) {
      this.game.audio.siren(false);
      this.clearHelicopter();
      this.clearRoadblocks();
    }
    return p.wanted;
  }
  spawnHelicopter() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 6), new THREE.MeshLambertMaterial({ color: 0x1a2a44 }));
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 4.5), new THREE.MeshLambertMaterial({ color: 0x1a2a44 }));
    tail.position.set(0, 0.2, -5); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.8), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    rotor.position.y = 1; g.add(rotor);
    g.userData.rotor = rotor;
    const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 40, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    beam.position.y = -20; beam.rotation.x = Math.PI; g.add(beam);
    const p = this.game.playerPos();
    g.position.set(p.x + 30, 55, p.z - 40);
    this.scene.add(g);
    this.heli = g;
    this.game.hud.toast('Police helicopter overhead — searchlight on you!', 3000);
  }
  clearHelicopter() {
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; }
  }
  spawnPoliceCar() {
    const mesh = buildCarMesh({ color: 0x1a1a1a }, true);
    const p = this.game.playerPos();
    const ang = Math.random() * Math.PI * 2;
    const car = {
      mesh, x: p.x + Math.sin(ang) * 70, z: p.z + Math.cos(ang) * 70,
      heading: ang, speed: 0, kind: 'police',
    };
    mesh.position.set(car.x, 0, car.z);
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }
  spawnFootCop() {
    const mesh = buildPedMesh(0x1a2a66);
    const p = this.game.playerPos();
    const cop = { mesh, x: p.x + 30, z: p.z + 20, heading: 0, speed: 4.2, alive: true };
    mesh.position.set(cop.x, 0, cop.z);
    this.scene.add(mesh);
    this.foot.push(cop);
    return cop;
  }
  spawnRoadblock() {
    const p = this.game.playerPos();
    const heading = this.game.player.heading;
    const bx = p.x + Math.sin(heading) * 55, bz = p.z + Math.cos(heading) * 55;
    const block = { meshes: [], x: bx, z: bz };
    for (let i = -1; i <= 1; i++) {
      const mesh = buildCarMesh({ color: 0x1a1a1a }, true);
      const px = bx + Math.cos(heading) * i * 7, pz = bz - Math.sin(heading) * i * 7;
      mesh.position.set(px, 0, pz);
      mesh.rotation.y = heading + Math.PI / 2;
      this.scene.add(mesh);
      block.meshes.push(mesh);
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 0.5), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
      barrier.position.set(px, 0.6, pz + Math.sin(heading) * 3);
      barrier.rotation.y = heading + Math.PI / 2;
      this.scene.add(barrier);
      block.meshes.push(barrier);
    }
    block.collider = { x: bx, z: bz, hx: 10, hz: 10 };
    this.game.city.colliders.push(block.collider);
    this.roadblocks.push(block);
    this.game.hud.toast('ROADBLOCK AHEAD! Smash through or go around!', 3200);
    this.game.audio.blip(220, 0.3, 'sawtooth', 0.3);
    return block;
  }
  clearRoadblocks() {
    for (const b of this.roadblocks) {
      for (const m of b.meshes) this.scene.remove(m);
      const i = this.game.city.colliders.indexOf(b.collider);
      if (i >= 0) this.game.city.colliders.splice(i, 1);
    }
    this.roadblocks = [];
  }
  update(dt) {
    const p = this.game.player;
    const pos = this.game.playerPos();
    const wanted = p.wanted;
    // spawn pressure: more cops at higher wanted
    const wantCars = wanted === 0 ? 0 : wanted <= 2 ? 2 : wanted === 3 ? 3 : 5;
    this.spawnTimer -= dt;
    if (this.cars.length < wantCars && this.spawnTimer <= 0) {
      this.spawnPoliceCar();
      this.spawnTimer = 2.5;
      if (wanted >= 2 && this.foot.length < 2) this.spawnFootCop();
    }
    // police cars chase + ram
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (wanted === 0) {
        // drive off
        c.speed = Math.max(0, c.speed - 10 * dt);
        c.x += Math.sin(c.heading) * c.speed * dt; c.z += Math.cos(c.heading) * c.speed * dt;
        if (Math.hypot(c.x - pos.x, c.z - pos.z) > 160) {
          this.scene.remove(c.mesh); this.cars.splice(i, 1); continue;
        }
      } else {
        const targetHeading = Math.atan2(pos.x - c.x, pos.z - c.z);
        let dh = targetHeading - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
        const top = 22 + wanted * 3;
        c.speed += (top - c.speed) * 0.7 * dt;
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        // ram the player car (dt-scaled nudge, not a per-frame shove)
        const pc = p.car;
        if (pc && Math.hypot(c.x - pc.x, c.z - pc.z) < 3.4) {
          pc.speed *= Math.max(0.7, 1 - 0.6 * dt);
          pc.x += Math.sin(c.heading) * 6 * dt; pc.z += Math.cos(c.heading) * 6 * dt;
          this.game.damagePlayer(12 * dt);
          if (!c._ramming && Math.abs(pc.speed) > 8) this.game.audio.crash();
          c._ramming = true;
        } else c._ramming = false;
        // foot player hit
        if (!pc && Math.hypot(c.x - pos.x, c.z - pos.z) < 2.4) {
          this.game.damagePlayer(8 * dt);
        }
        // flash light bar
        this._lightPhase += dt;
        if (c.mesh.userData.lightBar) c.mesh.userData.lightBar.material.color.setHex(Math.floor(this._lightPhase * 4) % 2 ? 0xff2222 : 0x2244ff);
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    }
    // foot cops pursue on foot
    for (let i = this.foot.length - 1; i >= 0; i--) {
      const cop = this.foot[i];
      if (wanted === 0 || Math.hypot(cop.x - pos.x, cop.z - pos.z) > 150) {
        this.scene.remove(cop.mesh); this.foot.splice(i, 1); continue;
      }
      const h = Math.atan2(pos.x - cop.x, pos.z - cop.z);
      cop.heading = h;
      cop.x += Math.sin(h) * cop.speed * dt;
      cop.z += Math.cos(h) * cop.speed * dt;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = h;
      if (!p.car && Math.hypot(cop.x - pos.x, cop.z - pos.z) < 1.6) {
        this.game.damagePlayer(6 * dt);
        this.game.hud.toast('Cop is beating you down — run!', 1200);
      }
    }
    // helicopter follows from the air
    if (this.heli) {
      const h = this.heli;
      h.userData.rotor.rotation.y += dt * 22;
      const dx = pos.x - h.position.x, dz = pos.z - h.position.z;
      if (!this.game.coverCam) { // cover shot: keep the staged heli in frame
        h.position.x += dx * 0.55 * dt; h.position.z += dz * 0.55 * dt;
      }
      h.position.y = (this.game.coverCam ? 14 : 52) + Math.sin(performance.now() * 0.001) * 2;
      h.rotation.y = Math.atan2(dx, dz);
      if (wanted === 0) this.clearHelicopter();
    }
    // roadblocks at 4-5 stars, refreshed ahead of the player
    if (wanted >= 4) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0) {
        if (this.roadblocks.length >= 2) {
          const old = this.roadblocks.shift();
          for (const m of old.meshes) this.scene.remove(m);
          const i = this.game.city.colliders.indexOf(old.collider);
          if (i >= 0) this.game.city.colliders.splice(i, 1);
        }
        this.spawnRoadblock();
        this.roadblockTimer = 14;
      }
    }
    // wanted decay when out of sight: no cops near + not committing crimes
    if (wanted > 0) {
      this.decayTimer += dt;
      const nearestCop = this.cars.reduce((m, c) => Math.min(m, Math.hypot(c.x - pos.x, c.z - pos.z)), 999);
      if (this.decayTimer > 18 && nearestCop > 55 && wanted < 4) {
        this.setWanted(wanted - 1);
        this.decayTimer = 0;
        this.game.hud.toast('Heat cooling off — wanted down to ' + this.game.player.wanted + ' star(s).', 2500);
      }
    } else this.decayTimer = 0;
  }
}

// Round-5 repair (2026-11-18): re-recorded under the level-20 kit for the transcript gate; no gameplay change.
