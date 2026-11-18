// main.js — game loop + wiring: player on foot / driving, chase camera, input, shot modes, test hooks.
import { City, districtAt } from './city.js';
import { Vehicles, CAR_CLASSES } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions, MISSIONS } from './missions.js';
import { Combat, WEAPONS } from './combat.js';
import { Radio } from './radio.js';
import { Shops } from './shops.js';
import { Hud } from './hud.js';
import { AudioSys } from './audio.js';
import { loadSave, writeSave, clearSave, defaultSave } from './save.js';

export class Game {
  constructor() {
    this.save = loadSave() || defaultSave();
    this.hasSave = !!loadSave();
    this.state = 'title'; // title | play | pause
    this.clock = 480; // 08:00 in minutes
    this.stats = { earned: this.save.stats?.earned || 0, shotsFired: 0, shotsHit: 0, carsStolen: 0, fares: 0, topSpeed: 0, wantedPeak: 0 };
    this.player = {
      x: -40, z: 0, heading: 0, speed: 0,
      health: this.save.health ?? 100, armor: this.save.armor ?? 0,
      cash: this.save.cash ?? 250, wanted: 0,
      car: null, onFoot: true,
    };
    this.cameraMode = 0;
    this.keys = {};
    this.nitroTimer = 0;
    this.nitroCooldown = 0;
    this._wastedTimer = 0;
    this._saveTimer = 0;

    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

    this.city = new City(this.scene);
    this.audio = new AudioSys();
    this.audio.muted = !!this.save.muted;
    this.radio = new Radio(this);
    this.radio.station = this.save.radioStation ?? -1;
    this.vehicles = new Vehicles(this);
    this.pedestrians = new Pedestrians(this);
    this.police = new Police(this);
    this.missions = new Missions(this);
    this.combat = new Combat(this);
    this.shops = new Shops(this);
    this.hud = new Hud(this);

    // player on-foot mesh (Jax Marlow)
    this.playerMesh = this.buildPlayerMesh();
    this.scene.add(this.playerMesh);
    // waypoint beacon
    this.beacon = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    this.beaconRing = new THREE.Mesh(new THREE.TorusGeometry(4, 0.3, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    this.beaconRing.rotation.x = Math.PI / 2;
    this.beaconRing.visible = false;
    this.scene.add(this.beaconRing);

    this.bindInput();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.last = performance.now();
    this.applyShotMode(new URLSearchParams(location.search).get('shot'));
    requestAnimationFrame((t) => this.loop(t));
  }
  buildPlayerMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 1.15, 8), new THREE.MeshLambertMaterial({ color: 0x1e6f9f }));
    body.position.y = 1.0; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
    head.position.y = 1.8; g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0xffd23e }));
    cap.position.y = 1.98; g.add(cap);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.55, 0.3), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
    legs.position.y = 0.28; g.add(legs);
    return g;
  }
  playerPos() { return this.player.car ? { x: this.player.car.x, z: this.player.car.z } : { x: this.player.x, z: this.player.z }; }
  districtName() { const p = this.playerPos(); return districtAt(p.x, p.z); }
  addWanted(n, reason) {
    this.police.setWanted(this.player.wanted + n, reason);
    if (n > 0) this.hud.toast('Wanted level up — ' + this.player.wanted + ' star(s)!', 1800);
  }
  damagePlayer(amount) {
    const p = this.player;
    let rest = amount;
    if (p.armor > 0) { const absorbed = Math.min(p.armor, rest); p.armor -= absorbed; rest -= absorbed; }
    p.health -= rest;
  }
  saveGame() { writeSave(this); this.hasSave = true; }
  toTitle() {
    this.state = 'title';
    this.hud.hideHud();
    this.hud.renderJobList();
    document.getElementById('titleScreen').classList.remove('hidden');
  }
  startGame(fresh) {
    if (fresh) {
      clearSave();
      this.save = defaultSave();
      this.player.cash = 250; this.player.health = 100; this.player.armor = 0;
      this.missions.done = []; this.missions.collectedPackages = []; this.missions.jumpsDone = [];
      this.combat.weapons = JSON.parse(JSON.stringify(this.save.weapons));
      this.combat.current = 'pistol';
      this.hasSave = false;
    }
    this.audio.ensure();
    document.getElementById('titleScreen').classList.add('hidden');
    this.hud.showHud();
    this.state = 'play';
    this.hud.setObjective('FREE ROAM', 'Steal a car (E), take a job at Voss Garage (J), explore Palmera Bay.');
    this.hud.toast('Welcome to Palmera Bay — press J for your first job.', 4000);
  }
  togglePause(force) {
    const toPause = force !== undefined ? force : this.state === 'play';
    if (toPause && this.state === 'play') {
      this.state = 'pause'; this.hud.showPause();
    } else if (!toPause && this.state === 'pause') {
      this.state = 'play'; this.hud.hidePause();
    }
  }
  bindInput() {
    const down = (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.audio.ensure();
      if (e.code === 'Escape') { this.togglePause(); return; }
      if (this.state !== 'play') return;
      if (e.code === 'KeyE') this.tryEnterExitCar();
      if (e.code === 'KeyR') this.radio.cycle();
      if (e.code === 'KeyC') { this.cameraMode = (this.cameraMode + 1) % 3; }
      if (e.code === 'KeyM') { this.hud.minimapZoom = this.hud.minimapZoom === 1 ? 2 : 1; }
      if (e.code === 'KeyF') this.tryInteract();
      if (e.code === 'KeyJ') this.missions.offerNext();
      if (e.code === 'KeyX') { this.audio.setMuted(!this.audio.muted); this.hud.toast(this.audio.muted ? 'Sound muted' : 'Sound on', 1200); }
      if (e.code === 'Digit1') this.combat.selectWeapon('pistol');
      if (e.code === 'Digit2') this.combat.selectWeapon('smg');
      if (e.code === 'Digit3') this.combat.selectWeapon('shotgun');
      if (e.code === 'Digit4') this.combat.selectWeapon('rifle');
      if (e.code === 'Digit5') this.combat.selectWeapon('marksman');
      if (e.code === 'KeyQ') this.combat.cycleWeapon(1);
      if (e.code === 'KeyN') this.tryNitro();
    };
    const up = (e) => { this.keys[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousedown', (e) => {
      if (this.state !== 'play') return;
      if (e.button === 0) this.combat.shoot();
    });
    window.addEventListener('blur', () => { this.keys = {}; });
  }
  tryNitro() {
    if (!this.player.car || !this.save.garage.nitro || this.nitroCooldown > 0) return;
    this.nitroTimer = 2.5; this.nitroCooldown = 6;
    this.hud.toast('NITRO!', 1200);
    this.audio.blip(1400, 0.3, 'sawtooth', 0.25);
  }
  tryEnterExitCar() {
    const p = this.player;
    if (p.car) {
      // exit
      const car = p.car;
      this.vehicles.releasePlayerCar(car);
      p.car = null; p.onFoot = true;
      p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
      p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
      p.heading = car.heading;
      this.audio.engineStop();
      return;
    }
    const car = this.vehicles.nearestCar(p.x, p.z, 5);
    if (!car) { this.hud.toast('No car close enough — walk up to one.', 1500); return; }
    this.vehicles.steal(car);
    p.car = car; p.onFoot = false;
    this.stats.carsStolen += 1;
    this.audio.blip(440, 0.1, 'square', 0.15);
    this.hud.toast('Stole the ' + car.cls.name + ' — nice wheels.', 2000);
    this.addWanted(1, 'car theft');
    this.saveGame();
  }
  tryInteract() {
    if (this.shops.open) { this.shops.closeShop(); return; }
    const spot = this.shops.nearestSpot();
    if (!spot) { this.hud.toast('Nothing to interact with here.', 1500); return; }
    this.shops.openShop(spot);
  }
  applyShotMode(shot) {
    if (!shot) return;
    if (shot === 'title') return; // default title screen
    this.startGame(false);
    if (shot === 'cover') {
      // densest frame: 5-star chase, heli, roadblock, sports car, dusk clock
      const cls = CAR_CLASSES.find((c) => c.id === 'sports');
      const car = this.vehicles.parked[0];
      car.cls = cls;
      car.mesh.children[0].material.color.setHex(cls.color); // repaint the mesh to sports yellow
      this.vehicles.steal(car);
      this.player.car = car; this.player.onFoot = false;
      car.x = 0; car.z = 40; car.heading = Math.PI; car.speed = 18;
      car.mesh.position.set(0, 0, 40);
      this.coverCam = true; // closer chase cam for the cover frame
      this.clock = 17 * 60 + 35;
      this.police.setWanted(5, 'shot');
      // stage the chase in frame: two police cars ahead of the player car,
      // helicopter overhead ahead, roadblock further up the road.
      const pc1 = this.police.spawnPoliceCar();
      pc1.x = -6; pc1.z = 12; pc1.speed = 18; pc1.heading = Math.PI;
      const pc2 = this.police.spawnPoliceCar();
      pc2.x = 7; pc2.z = 24; pc2.speed = 18; pc2.heading = Math.PI;
      if (this.police.heli) this.police.heli.position.set(0, 14, -10);
      this.police.spawnRoadblock();
      this.missions.active = { def: MISSIONS[7], stepIdx: 1, t: 12, stepT: 12 };
      this.missions.waypoint = { x: 0, z: -200, label: 'La Colina Hideout' };
      this.hud.setObjective('ROADBLOCK BREAKER', 'Break the roadblocks — reach La Colina Hideout');
      this.radio.station = 0;
    } else if (shot === 'garage') {
      this.player.cash = 5200;
      this.player.x = -40; this.player.z = 28;
      this.shops.openShop('garage');
      this.hud.setObjective('VOSS GARAGE', 'Engine, armor, paint, nitro — tune your ride.');
    } else if (shot === 'results') {
      this.player.cash = 3850;
      this.hud.showResults('S', { name: 'The Big One' }, 2500, { time: '182s', damage: '4%', wanted: '5★', accuracy: '78%', collectibles: '9/25' });
      this.hud.setObjective('THE BIG ONE', 'JOB COMPLETE — grade S');
    } else if (shot === 'play') {
      const car = this.vehicles.parked[0];
      this.vehicles.steal(car);
      this.player.car = car; this.player.onFoot = false;
      car.x = -40; car.z = 0; car.heading = 0; car.speed = 12;
      this.police.setWanted(2, 'shot');
      this.missions.active = { def: MISSIONS[1], stepIdx: 0, t: 20, stepT: 20 };
      this.missions.waypoint = { x: 160, z: 400, label: 'Crescent Beach' };
      this.hud.setObjective('SUNSET RUN', 'Deliver the package to Crescent Beach');
    }
  }
  update(dt) {
    const p = this.player;
    const k = this.keys;
    this.clock = (this.clock + dt * 1.2) % 1440;
    // --- driving / on foot ---
    if (p.car) {
      const car = p.car;
      const engineMul = 1 + this.save.garage.engine * 0.15;
      const top = car.cls.top * engineMul * (this.nitroTimer > 0 ? 1.5 : 1);
      const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 0.6 : 0);
      car.speed += fwd * car.cls.accel * dt;
      if (!fwd) car.speed -= Math.sign(car.speed) * 6 * dt;
      if (k.Space) car.speed -= Math.sign(car.speed) * 22 * dt; // handbrake
      car.speed = Math.max(-12, Math.min(top, car.speed));
      if (Math.abs(car.speed) < 0.2 && !fwd) car.speed = 0;
      const steer = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0);
      const steerAmt = steer * car.cls.grip * 0.55 * Math.min(1, Math.abs(car.speed) / 10) * Math.sign(car.speed || 1);
      car.heading += steerAmt * dt;
      let nx = car.x + Math.sin(car.heading) * car.speed * dt;
      let nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const fixed = this.city.collideCircle(nx, nz, 1.6);
      if (fixed.x !== nx || fixed.z !== nz) {
        car.speed *= 0.55;
        if (Math.abs(car.speed) > 8) this.audio.crash();
      }
      car.x = fixed.x; car.z = fixed.z;
      car.mesh.position.set(car.x, car.airTime > 0 ? 1.2 : 0, car.z);
      car.mesh.rotation.y = car.heading;
      if (car.airTime > 0) car.airTime -= dt;
      p.heading = car.heading;
      this.stats.topSpeed = Math.max(this.stats.topSpeed, Math.abs(car.speed) * 2.2);
      this.audio.engineStart(Math.abs(car.speed) / 42);
      // shooting from the car
      if (k.Mouse0) this.combat.shoot();
    } else {
      const run = k.ShiftLeft || k.ShiftRight;
      const sp = run ? 10 : 6;
      let mx = 0, mz = 0;
      if (k.KeyW || k.ArrowUp) mz -= 1;
      if (k.KeyS || k.ArrowDown) mz += 1;
      if (k.KeyA || k.ArrowLeft) mx -= 1;
      if (k.KeyD || k.ArrowRight) mx += 1;
      if (mx || mz) {
        // move relative to camera yaw (behind player)
        const camYaw = Math.atan2(this.camera.position.x - p.x, this.camera.position.z - p.z);
        const ang = camYaw + Math.atan2(mx, -mz);
        p.heading = ang;
        const nx = p.x + Math.sin(ang) * sp * dt;
        const nz = p.z + Math.cos(ang) * sp * dt;
        const fixed = this.city.collideCircle(nx, nz, 0.6);
        p.x = fixed.x; p.z = fixed.z;
        p.speed = sp;
      } else p.speed = 0;
      this.playerMesh.position.set(p.x, 0, p.z);
      this.playerMesh.rotation.y = p.heading;
      this.playerMesh.visible = true;
      this.audio.engineStop();
    }
    if (!p.car) this.playerMesh.visible = true;
    else this.playerMesh.visible = false;
    if (this.nitroTimer > 0) this.nitroTimer -= dt;
    if (this.nitroCooldown > 0) this.nitroCooldown -= dt;
    // interact prompt
    if (this.state === 'play' && !this.shops.open) {
      const spot = this.shops.nearestSpot();
      if (spot === 'shop') this.hud.setInteract('Press F — Harbor Arms (weapons)');
      else if (spot === 'garage') this.hud.setInteract('Press F — Voss Garage (upgrades) · J — next job');
      else if (spot === 'safehouse') this.hud.setInteract('Press F — Marina Safehouse (save)');
      else if (spot === 'spray') this.hud.setInteract('Press F — Spray Works (lose heat $100)');
      else this.hud.setInteract(null);
    } else if (!this.shops.open) this.hud.setInteract(null);
    // subsystems
    this.vehicles.update(dt, this.playerPos());
    this.pedestrians.update(dt, this.playerPos());
    this.police.update(dt);
    this.missions.update(dt);
    this.combat.update(dt);
    this.radio.update(dt);
    // waypoint beacon
    const wp = this.missions.waypoint;
    if (wp && this.state === 'play') {
      this.beacon.visible = true; this.beaconRing.visible = true;
      this.beacon.position.set(wp.x, 14 + Math.sin(performance.now() * 0.003) * 1.5, wp.z);
      this.beacon.rotation.y += dt * 2;
      this.beaconRing.position.set(wp.x, 0.4, wp.z);
    } else { this.beacon.visible = false; this.beaconRing.visible = false; }
    // health / wasted
    if (p.health <= 0) {
      p.health = 100;
      const lost = Math.min(p.cash, 150);
      p.cash -= lost;
      this.police.setWanted(0, 'wasted');
      if (p.car) { this.vehicles.releasePlayerCar(p.car); p.car = null; p.onFoot = true; }
      const sh = this.city.markers.safehouse;
      p.x = sh.x; p.z = sh.z;
      this.hud.toast('WASTED — you woke up at the safehouse. -$' + lost, 4000);
      this.missions.failJob('You got wasted');
    }
    // periodic autosave
    this._saveTimer += dt;
    if (this._saveTimer > 20) { this._saveTimer = 0; this.saveGame(); }
    this.hud.update();
    this.updateCamera(dt);
  }
  updateCamera(dt) {
    const p = this.player;
    const pos = p.car ? { x: p.car.x, z: p.car.z } : { x: p.x, z: p.z };
    const heading = p.heading;
    const cam = this.camera;
    let dist = 13, height = 6, lookY = 2;
    if (this.coverCam) { dist = 9.5; height = 4.4; }
    if (this.cameraMode === 1) { dist = 20; height = 9; }
    if (this.cameraMode === 2) { dist = 1; height = 55; lookY = 0; }
    const tx = pos.x - Math.sin(heading) * dist;
    const tz = pos.z - Math.cos(heading) * dist;
    const lerp = 1 - Math.pow(0.001, dt);
    cam.position.x += (tx - cam.position.x) * lerp;
    cam.position.y += (height - cam.position.y) * lerp;
    cam.position.z += (tz - cam.position.z) * lerp;
    cam.lookAt(pos.x, lookY, pos.z);
    // keep camera out of buildings roughly
    if (cam.position.y < 2) cam.position.y = 2;
  }
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016);
    this.last = t;
    if (this.state === 'play') this.update(dt);
    else if (this.state === 'title') {
      // slow orbit behind the title so the city shows through the overlay
      const tt = t * 0.00005;
      this.camera.position.set(Math.sin(tt) * 260, 90, Math.cos(tt) * 260);
      this.camera.lookAt(0, 0, 0);
      this.vehicles.update(dt, { x: 0, z: 0 });
      this.pedestrians.update(dt, { x: 0, z: 0 });
    }
    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();
// Test / automation hooks (used by headless play-tests; harmless in normal play).
window.__PB = {
  game,
  state: () => ({
    mode: game.state, cash: Math.round(game.player.cash), health: Math.round(game.player.health),
    wanted: game.player.wanted, inCar: !!game.player.car,
    carClass: game.player.car ? game.player.car.cls.id : null,
    pos: game.playerPos(), jobsDone: [...game.missions.done],
    activeJob: game.missions.active ? game.missions.active.def.name : null,
    heli: !!game.police.heli, roadblocks: game.police.roadblocks.length,
    policeCars: game.police.cars.length, radio: game.radio.station,
    collectibles: game.missions.collectedPackages.length, jumps: game.missions.jumpsDone.length,
    nitro: game.save.garage.nitro, engine: game.save.garage.engine,
  }),
  startGame: (fresh) => game.startGame(fresh),
  startJob: (i) => game.missions.startJob(i),
  offerJob: () => game.missions.offerNext(),
  setWanted: (n) => game.police.setWanted(n, 'test'),
  giveCash: (n) => { game.player.cash += n; },
  teleport: (x, z) => {
    const p = game.player;
    if (p.car) { p.car.x = x; p.car.z = z; p.car.speed = 0; p.car.mesh.position.set(x, 0, z); }
    else { p.x = x; p.z = z; }
  },
  teleportTo: (name) => { const m = game.city.markers[name]; if (m) window.__PB.teleport(m.x, m.z); },
  enterNearestCar: () => game.tryEnterExitCar(),
  shoot: () => game.combat.shoot(),
  cycleRadio: () => game.radio.cycle(),
  openShop: (kind) => game.shops.openShop(kind),
  buy: (id) => game.shops.buy(id),
  save: () => game.saveGame(),
  district: () => game.districtName(),
};
