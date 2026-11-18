// missions.js — 10 story jobs in one arc (Bayline Crew), plus taxi fares, 25 collectibles, 8 stunt jumps.
export const MISSIONS = [
  { id: 0, name: 'First Wheels', giver: 'Marla Voss', pay: 300,
    brief: 'You need wheels before you need a name. Steal any car on the street and bring it to Voss Garage. Nobody saw nothing.',
    steps: [{ type: 'stealCar', label: 'Steal a car (walk up, press E)' }, { type: 'goto', at: 'garage', label: 'Drive the stolen car to Voss Garage' }] },
  { id: 1, name: 'Sunset Run', giver: 'Marla Voss', pay: 450,
    brief: 'A package for a client at Crescent Beach. Fast, clean, no police. You have 150 seconds. The sunset is your deadline.',
    steps: [{ type: 'goto', at: 'beach', label: 'Deliver the package to Crescent Beach', timer: 150 }] },
  { id: 2, name: 'Tail the Courier', giver: 'Dante Reyes', pay: 500,
    brief: 'A courier is moving product through the city. Follow his blue sedan — stay close enough to see him, far enough he never sees you. 90 seconds.',
    steps: [{ type: 'follow', label: 'Tail the blue courier sedan for 90s — keep 12–40m away', timer: 150 }] },
  { id: 3, name: 'Three for the Shop', giver: 'Dante Reyes', pay: 900,
    brief: 'The chop shop is hungry. Steal THREE marked cars and deliver each one to Reyes Chop Shop. 240 seconds on the clock. Each delivery pays a cut.',
    steps: [{ type: 'collectCars', count: 3, at: 'chopshop', label: 'Steal a marked car and deliver it to Reyes Chop Shop (0/3)', timer: 240 }] },
  { id: 4, name: 'Fare Game', giver: 'Marla Voss', pay: 400,
    brief: 'Slow day, honest money. Pick up 3 taxi fares around the bay and drop them off. Tips if you drive like you mean it.',
    steps: [{ type: 'taxi', count: 3, label: 'Pick up a fare (0/3) — drive to the glowing passenger' }] },
  { id: 5, name: 'Package Run', giver: 'Old Sal', pay: 550,
    brief: 'Five packages stashed around the city, one buyer at the port. Grab all five, then bring them to Portside Docks. 200 seconds.',
    steps: [{ type: 'collectPkgs', count: 5, label: 'Collect packages (0/5)' }, { type: 'goto', at: 'port', label: 'Deliver the packages to Portside Docks', timer: 200 }] },
  { id: 6, name: 'Dragnet', giver: 'Marla Voss', pay: 700,
    brief: 'You tripped a wire — the whole city is looking for you. Lose the heat and reach the Marina Safehouse. Do not get caught.',
    steps: [{ type: 'wanted', level: 3, label: 'Heat is on — survive the dragnet' }, { type: 'escape', at: 'safehouse', label: 'Lose the cops and reach the Marina Safehouse' }] },
  { id: 7, name: 'Roadblock Breaker', giver: 'Dante Reyes', pay: 1100,
    brief: 'NEW JOB — Five stars, full manhunt, roadblocks on every avenue. Smash through or slip around them and reach the La Colina Hideout. This is the one they will talk about.',
    steps: [{ type: 'wanted', level: 5, label: '5-star manhunt! Roadblocks ahead!' }, { type: 'escape', at: 'hideout', label: 'Break the roadblocks — reach La Colina Hideout' }] },
  { id: 8, name: 'Dockside Score', giver: 'Old Sal', pay: 950,
    brief: 'Crates at the port, buyer waiting at the bank. Grab the goods at Portside Docks, then get them to Bay Trust Bank before the port crew changes its mind.',
    steps: [{ type: 'goto', at: 'port', label: 'Grab the crates at Portside Docks' }, { type: 'goto', at: 'bank', label: 'Deliver the crates to Bay Trust Bank', timer: 180 }] },
  { id: 9, name: 'The Big One', giver: 'Marla Voss', pay: 2500,
    brief: 'FINALE — Two stages. Stage 1: hit Bay Trust Bank and grab the goods. Stage 2: the whole city comes after you at 5 stars — lose the tail and bring it home to the Marina Safehouse.',
    steps: [{ type: 'goto', at: 'bank', label: 'STAGE 1: Hit Bay Trust Bank — grab the goods' }, { type: 'wanted', level: 5, label: 'STAGE 2: 5-star tail! Lose them!' }, { type: 'escape', at: 'safehouse', label: 'STAGE 2: Reach the Marina Safehouse with the goods' }] },
];

export class Missions {
  constructor(game) {
    this.game = game;
    this.done = [...(game.save.jobsDone || [])];
    this.collectedPackages = [...(game.save.collectibles || [])];
    this.jumpsDone = [...(game.save.jumps || [])];
    this.active = null; // {def, stepIdx, t, ...}
    this.offered = null;
    this.waypoint = null;
    this.followTarget = null;
    this.taxiState = null;
    this.pkgState = null;
    this.chopState = null;
    this.fareMarker = null;
    this._followTimer = 0;
    this._followOk = 0;
  }
  nextJob() { return MISSIONS.find((m) => !this.done.includes(m.id)) || null; }
  offerNext() {
    const m = this.nextJob();
    if (!m) { this.game.hud.toast('All 10 jobs done — you run Palmera Bay now.', 4000); return null; }
    this.offered = m;
    this.game.hud.showBrief(m);
    return m;
  }
  startJob(id) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return false;
    this.active = { def, stepIdx: 0, t: 0, stepT: 0, carsDelivered: 0, pkgs: 0, fares: 0, startCash: this.game.player.cash };
    this.game.hud.setObjective(def.name, def.steps[0].label);
    this.game.hud.toast('JOB STARTED: ' + def.name + ' — ' + def.brief, 5000);
    this.game.audio.blip(740, 0.15, 'square', 0.15);
    this.setupStep();
    return true;
  }
  currentStep() { return this.active ? this.active.def.steps[this.active.stepIdx] : null; }
  setupStep() {
    const step = this.currentStep();
    if (!step) return;
    const g = this.game;
    this.waypoint = null;
    if (step.type === 'goto' || step.type === 'escape') {
      const m = g.city.markers[step.at];
      this.waypoint = { x: m.x, z: m.z, label: m.label };
    }
    if (step.type === 'wanted') {
      g.police.setWanted(step.level, 'mission heat');
    }
    if (step.type === 'follow') {
      this.spawnFollowTarget();
      this._followTimer = step.timer || 90;
    }
    if (step.type === 'taxi') this.spawnFare();
    if (step.type === 'collectPkgs') {
      this.pkgState = { need: step.count, got: 0, spots: this.pickupSpots(step.count) };
    }
    if (step.type === 'collectCars') {
      this.chopState = { need: step.count, got: 0 };
      this.markChopCars();
    }
    this.active.stepT = 0;
    g.hud.setObjective(this.active.def.name, step.label);
  }
  pickupSpots(n) {
    const spots = [];
    const avail = this.game.city.collectibleSpots.filter((s) => !s.taken);
    for (let i = 0; i < Math.min(n, avail.length); i++) spots.push(avail[i]);
    return spots;
  }
  markChopCars() {
    // highlight 3 nearest traffic cars as marked (gold beacons)
    const pos = this.game.playerPos();
    const cars = [...this.game.vehicles.traffic].sort((a, b) => Math.hypot(a.x - pos.x, a.z - pos.z) - Math.hypot(b.x - pos.x, b.z - pos.z)).slice(0, 3);
    for (const c of cars) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
      ring.rotation.x = Math.PI / 2; ring.position.set(c.x, 0.4, c.z);
      this.game.scene.add(ring);
      c.chopRing = ring; c.chopMarked = true;
    }
    this._chopCars = cars;
  }
  spawnFollowTarget() {
    const pos = this.game.playerPos();
    // build directly here to avoid a circular import
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 4.4), new THREE.MeshLambertMaterial({ color: 0x2244cc }));
    body.position.y = 0.55; mesh.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), new THREE.MeshLambertMaterial({ color: 0x222831 }));
    cabin.position.set(0, 1.15, -0.2); mesh.add(cabin);
    const car = { mesh, cls: { id: 'sedan', name: 'Courier Sedan', color: 0x2244cc, top: 26, accel: 16, grip: 2.6 }, kind: 'follow', x: pos.x + 25, z: pos.z + 10, heading: Math.random() * Math.PI * 2, speed: 12, driver: true };
    mesh.position.set(car.x, 0, car.z);
    this.game.scene.add(mesh);
    this.followTarget = car;
  }
  spawnFare() {
    const pos = this.game.playerPos();
    const fx = pos.x + (Math.random() * 2 - 1) * 120, fz = pos.z + (Math.random() * 2 - 1) * 120;
    const ped = this.game.pedestrians.spawnPed(fx, fz);
    ped.isFare = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.2, 8, 20), new THREE.MeshBasicMaterial({ color: 0x7dff9a }));
    ring.rotation.x = Math.PI / 2; ring.position.set(fx, 0.4, fz);
    this.game.scene.add(ring);
    this.taxiState = { ped, ring, phase: 'pickup', dest: null };
    this.waypoint = { x: fx, z: fz, label: 'Passenger' };
  }
  advanceStep() {
    const a = this.active;
    a.stepIdx += 1;
    if (a.stepIdx >= a.def.steps.length) { this.completeJob(); return; }
    this.setupStep();
    this.game.audio.blip(880, 0.12, 'square', 0.15);
  }
  failJob(reason) {
    const a = this.active;
    if (!a) return;
    this.cleanupStep();
    this.active = null;
    this.waypoint = null;
    this.game.hud.setObjective('FREE ROAM', 'Steal a car, take a job, explore Palmera Bay.');
    this.game.hud.toast('JOB FAILED: ' + reason + ' — talk to Marla to retry.', 4000);
    this.game.audio.blip(160, 0.4, 'sawtooth', 0.25);
  }
  completeJob() {
    const a = this.active;
    const def = a.def;
    const timeUsed = a.t;
    const dmg = Math.max(0, 100 - this.game.player.health);
    const grade = this.gradeJob(timeUsed, dmg, this.game.stats.wantedPeak);
    this.done.push(def.id);
    this.game.player.cash += def.pay;
    this.game.stats.earned += def.pay;
    this.cleanupStep();
    this.active = null;
    this.waypoint = null;
    this.game.hud.setObjective('FREE ROAM', 'Steal a car, take a job, explore Palmera Bay.');
    this.game.audio.blip(990, 0.2, 'sine', 0.2);
    setTimeout(() => this.game.audio.blip(1320, 0.25, 'sine', 0.2), 180);
    this.game.saveGame();
    this.game.hud.showResults(grade, def, def.pay, {
      time: Math.round(timeUsed) + 's', damage: Math.round(dmg) + '%',
      wanted: this.game.stats.wantedPeak + '★',
      accuracy: this.game.stats.shotsFired ? Math.round(100 * this.game.stats.shotsHit / this.game.stats.shotsFired) + '%' : '—',
      collectibles: this.collectedPackages.length + '/25',
    });
    this.game.stats.wantedPeak = 0;
  }
  gradeJob(timeUsed, dmg, peak) {
    let score = 100 - dmg * 0.5 - peak * 4;
    if (timeUsed < 120) score += 10;
    if (score >= 90) return 'S';
    if (score >= 75) return 'A';
    if (score >= 60) return 'B';
    if (score >= 45) return 'C';
    return 'D';
  }
  cleanupStep() {
    if (this.followTarget) { this.game.scene.remove(this.followTarget.mesh); this.followTarget = null; }
    if (this.taxiState) {
      this.game.scene.remove(this.taxiState.ring);
      if (this.taxiState.ped) this.taxiState.ped.isFare = false;
      this.taxiState = null;
    }
    if (this._chopCars) {
      for (const c of this._chopCars) { if (c.chopRing) { this.game.scene.remove(c.chopRing); c.chopRing = null; c.chopMarked = false; } }
      this._chopCars = null;
    }
  }
  update(dt) {
    const g = this.game;
    const pos = g.playerPos();
    // collectible packages (free-roam + mission)
    for (const s of g.city.collectibleSpots) {
      if (s.taken) continue;
      s.mesh.rotation.y += dt * 2;
      if (Math.hypot(s.x - pos.x, s.z - pos.z) < 3) {
        s.taken = true; s.mesh.visible = false; s.glow.visible = false;
        this.collectedPackages.push(this.collectedPackages.length);
        g.player.cash += 50; g.stats.earned += 50;
        g.hud.toast('Package found! +$50 (' + this.collectedPackages.length + '/25)', 2000);
        g.audio.blip(1100, 0.12, 'sine', 0.15);
        const st = this.currentStep();
        if (this.active && st && st.type === 'collectPkgs') {
          this.pkgState.got += 1;
          g.hud.setObjective(this.active.def.name, 'Collect packages (' + this.pkgState.got + '/' + st.count + ')');
          if (this.pkgState.got >= st.count) this.advanceStep();
        }
        g.saveGame();
      }
    }
    // stunt jumps: crossing a ramp fast while driving
    const pc = g.player.car;
    for (const j of g.city.jumpSpots) {
      if (j.done) continue;
      if (pc && pc.speed > 20 && Math.hypot(j.x - pc.x, j.z - pc.z) < 6) {
        j.done = true;
        this.jumpsDone.push(this.jumpsDone.length);
        pc.airTime = 0.7; pc.speed *= 1.15;
        g.player.cash += 100; g.stats.earned += 100;
        g.hud.toast('STUNT JUMP! +$100 (' + this.jumpsDone.length + '/8)', 2500);
        g.audio.blip(1300, 0.2, 'sine', 0.2);
        g.saveGame();
      }
    }
    if (!this.active) return;
    const a = this.active;
    a.t += dt; a.stepT += dt;
    const step = this.currentStep();
    if (!step) return;
    // timers (follow job: 90s in range inside a 150s window)
    if (step.timer && a.stepT > step.timer) {
      if (step.type === 'follow' && this._followOk >= 90) { /* let the follow branch advance */ }
      else { this.failJob('Out of time'); return; }
    }
    if (step.type === 'stealCar') {
      if (g.player.car) this.advanceStep();
    } else if (step.type === 'goto' || step.type === 'escape') {
      const m = g.city.markers[step.at];
      const d = Math.hypot(m.x - pos.x, m.z - pos.z);
      if (d < 8) {
        if (step.type === 'escape') {
          // reaching the hideout/safehouse at 5 stars clears the heat (jobs 7 + 9);
          // the Dragnet job (6) requires losing the heat first, since it can decay at 3 stars.
          if (g.player.wanted > 0 && (a.def.id === 7 || a.def.id === 9)) g.police.setWanted(0, 'escaped');
          else if (g.player.wanted > 0) { g.hud.setObjective(a.def.name, step.label + ' — lose the heat first! (' + g.player.wanted + '★)'); return; }
        }
        this.advanceStep();
      } else if (step.type === 'escape' && g.player.wanted > 0 && a.def.id !== 7 && a.def.id !== 9) {
        g.hud.setObjective(a.def.name, step.label + ' — lose the heat first! (' + g.player.wanted + '★)');
      }
    } else if (step.type === 'wanted') {
      if (g.player.wanted >= step.level) this.advanceStep();
      else if (a.stepT > 30) { g.police.setWanted(step.level, 'mission heat'); }
    } else if (step.type === 'follow') {
      const t = this.followTarget;
      if (!t) return;
      // courier cruises around the city
      t.heading += Math.sin(a.t * 0.3) * 0.4 * dt;
      t.speed = 13;
      t.x += Math.sin(t.heading) * t.speed * dt;
      t.z += Math.cos(t.heading) * t.speed * dt;
      if (Math.abs(t.x) > 380) t.heading += Math.PI / 2;
      if (Math.abs(t.z) > 380) t.heading += Math.PI / 2;
      t.mesh.position.set(t.x, 0, t.z); t.mesh.rotation.y = t.heading;
      const d = Math.hypot(t.x - pos.x, t.z - pos.z);
      this.waypoint = { x: t.x, z: t.z, label: 'Courier' };
      if (d > 12 && d < 40) { this._followOk += dt; }
      else if (d >= 40) { this.failJob('You lost the courier'); return; }
      else if (d <= 12) { this.failJob('Too close — the courier spotted you'); return; }
      g.hud.setObjective(a.def.name, 'Tail the courier — ' + Math.round(this._followOk) + 's / 90s in range');
      if (this._followOk >= 90) this.advanceStep();
    } else if (step.type === 'taxi') {
      const ts = this.taxiState;
      if (!ts) return;
      if (ts.phase === 'pickup') {
        const d = Math.hypot(ts.ped.x - pos.x, ts.ped.z - pos.z);
        if (d < 4) {
          ts.phase = 'drop';
          const m = g.city.markers;
          const dests = [m.beach, m.port, m.park, m.bank, m.garage];
          const dest = dests[Math.floor(Math.random() * dests.length)];
          ts.dest = dest;
          this.waypoint = { x: dest.x, z: dest.z, label: 'Drop-off: ' + dest.label };
          g.hud.toast('Passenger aboard — drop them at ' + dest.label, 2500);
          ts.ped.mesh.visible = false;
          this.game.scene.remove(ts.ring);
        }
      } else {
        const d = Math.hypot(ts.dest.x - pos.x, ts.dest.z - pos.z);
        if (d < 8) {
          a.fares += 1;
          g.player.cash += 60; g.stats.earned += 60; g.stats.fares += 1;
          g.hud.toast('Fare complete! +$60 (' + a.fares + '/' + step.count + ')', 2200);
          if (a.fares >= step.count) this.advanceStep();
          else this.spawnFare();
        }
      }
    } else if (step.type === 'collectCars') {
      // delivering a stolen marked car to the chop shop
      const m = g.city.markers.chopshop;
      const pc = g.player.car;
      if (pc && pc.chopMarked && Math.hypot(m.x - pc.x, m.z - pc.z) < 10) {
        this.chopState.got += 1;
        g.player.cash += 200; g.stats.earned += 200;
        if (pc.chopRing) { this.game.scene.remove(pc.chopRing); pc.chopRing = null; }
        pc.chopMarked = false;
        // remove the delivered car
        this.game.scene.remove(pc.mesh);
        g.player.car = null;
        g.player.onFoot = true;
        g.hud.toast('Car chopped! +$200 (' + this.chopState.got + '/' + step.count + ')', 2500);
        if (this.chopState.got >= step.count) this.advanceStep();
        else {
          g.hud.setObjective(a.def.name, 'Steal a marked car and deliver it to Reyes Chop Shop (' + this.chopState.got + '/' + step.count + ')');
          this.markChopCars();
        }
      }
    } else if (step.type === 'collectPkgs') {
      // handled in the package pickup loop above; waypoint to nearest needed spot
      const s = this.pkgState && this.pkgState.spots[this.pkgState.got];
      if (s) this.waypoint = { x: s.x, z: s.z, label: 'Package' };
    }
  }
}
