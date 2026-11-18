// vehicles.js — 6 drivable car classes, arcade physics, dense traffic with lane following, stealing.
export const CAR_CLASSES = [
  { id: 'compact', name: 'Pip Squeak', color: 0x4fc3f7, top: 26, accel: 16, grip: 2.6 },
  { id: 'sedan', name: 'Bayline Sedan', color: 0xe8e8e8, top: 30, accel: 18, grip: 2.8 },
  { id: 'muscle', name: 'V8 Brute', color: 0xd94f30, top: 34, accel: 24, grip: 2.4 },
  { id: 'suv', name: 'Colina SUV', color: 0x3aa655, top: 28, accel: 16, grip: 3.0 },
  { id: 'sports', name: 'Comet GT', color: 0xffd23e, top: 42, accel: 30, grip: 3.4 },
  { id: 'van', name: 'Cargo Van', color: 0x9a7fc9, top: 24, accel: 13, grip: 2.4 },
];
const TRAFFIC_COLORS = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0xecf0f1, 0x2c3e50, 0xe67e22];

export function buildCarMesh(cls, police = false) {
  const g = new THREE.Group();
  const bodyColor = police ? 0x1a1a1a : cls.color;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 4.4), new THREE.MeshLambertMaterial({ color: bodyColor }));
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), new THREE.MeshLambertMaterial({ color: police ? 0xffffff : 0x222831 }));
  cabin.position.set(0, 1.15, -0.2); g.add(cabin);
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.55, -0.2); g.add(bar);
    g.userData.lightBar = bar;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [x, z] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z); g.add(w);
  }
  const light = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.15), new THREE.MeshBasicMaterial({ color: 0xfff6b0 }));
  light.position.set(0, 0.6, 2.25); g.add(light);
  g.userData.isCar = true;
  return g;
}

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.traffic = [];
    this.parked = [];
    this.spawnTraffic(26);
    this.spawnParked(14);
  }
  // A spawn point is free when the collision solver leaves it (almost) alone.
  freeSpot(x, z) {
    const f = this.game.city.collideCircle(x, z, 3);
    return Math.hypot(f.x - x, f.z - z) < 0.5;
  }
  spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const cls = CAR_CLASSES[Math.floor(Math.random() * CAR_CLASSES.length)];
      const mesh = buildCarMesh(cls);
      const road = (Math.floor(Math.random() * 9) - 4) * 80;
      let along = (Math.random() * 2 - 1) * 360;
      const horizontal = Math.random() > 0.5;
      let x = horizontal ? along : road + (Math.random() > 0.5 ? 4 : -4);
      let z = horizontal ? road + (Math.random() > 0.5 ? 4 : -4) : along;
      for (let tries = 0; tries < 10 && !this.freeSpot(x, z); tries++) {
        along = (Math.random() * 2 - 1) * 360;
        x = horizontal ? along : road + (Math.random() > 0.5 ? 4 : -4);
        z = horizontal ? road + (Math.random() > 0.5 ? 4 : -4) : along;
      }
      const car = {
        mesh, cls, kind: 'traffic', x, z,
        // heading convention: x += sin(h), z += cos(h). A car on a horizontal
        // road (running along x) heads ±90°; on a vertical road it heads 0/180°.
        heading: horizontal ? (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() > 0.5 ? 0 : Math.PI),
        speed: 8 + Math.random() * 6, driver: true,
        horizontal, road, lane: Math.random() > 0.5 ? 4 : -4,
      };
      mesh.position.set(car.x, 0, car.z); mesh.rotation.y = car.heading;
      this.scene.add(mesh); this.traffic.push(car);
    }
  }
  spawnParked(n) {
    for (let i = 0; i < n; i++) {
      const cls = CAR_CLASSES[Math.floor(Math.random() * CAR_CLASSES.length)];
      const mesh = buildCarMesh(cls);
      const road = (Math.floor(Math.random() * 9) - 4) * 80;
      let along = (Math.random() * 2 - 1) * 340;
      const horizontal = Math.random() > 0.5;
      let x = horizontal ? along : road + 7;
      let z = horizontal ? road + 7 : along;
      for (let tries = 0; tries < 10 && !this.freeSpot(x, z); tries++) {
        along = (Math.random() * 2 - 1) * 340;
        x = horizontal ? along : road + 7;
        z = horizontal ? road + 7 : along;
      }
      const car = {
        mesh, cls, kind: 'parked', x, z,
        heading: horizontal ? Math.PI / 2 : 0, speed: 0, driver: false,
      };
      mesh.position.set(car.x, 0, car.z); mesh.rotation.y = car.heading;
      this.scene.add(mesh); this.parked.push(car);
    }
  }
  nearestCar(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const c of [...this.traffic, ...this.parked]) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  steal(car) {
    if (car.kind === 'traffic') {
      const i = this.traffic.indexOf(car); if (i >= 0) this.traffic.splice(i, 1);
    } else {
      const i = this.parked.indexOf(car); if (i >= 0) this.parked.splice(i, 1);
    }
    car.kind = 'player'; car.driver = true; car.speed = 0;
    return car;
  }
  releasePlayerCar(car) {
    car.kind = 'parked'; car.speed = 0;
    this.parked.push(car);
  }
  update(dt, playerPos) {
    // traffic: lane following along roads, turn at intersections, avoid the player car
    for (const c of this.traffic) {
      const ahead = 14;
      const ax = c.x + Math.sin(c.heading) * ahead, az = c.z + Math.cos(c.heading) * ahead;
      // slow down if something is ahead (player car or another traffic car)
      let slow = false;
      for (const o of this.traffic) {
        if (o !== c && Math.hypot(o.x - ax, o.z - az) < 7) { slow = true; break; }
      }
      const pc = this.game.player.car;
      if (pc && Math.hypot(pc.x - ax, pc.z - az) < 8) slow = true;
      const target = slow ? 0 : 10 + (c.cls.top * 0.25);
      c.speed += Math.sign(target - c.speed) * 8 * dt;
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      // at intersection, sometimes turn
      const nearRoad = Math.abs((c.horizontal ? c.z : c.x) % 80) < 2 || Math.abs(((c.horizontal ? c.z : c.x) % 80) - 80) < 2;
      const atGrid = Math.abs(((c.horizontal ? c.x : c.z) % 80)) < 1.5;
      if (Math.abs(c.x) > 390 || Math.abs(c.z) > 390) { c.heading += Math.PI; }
      else if (atGrid && Math.random() < 0.002) {
        c.heading += (Math.random() > 0.5 ? 1 : -1) * Math.PI / 2;
        c.horizontal = !c.horizontal;
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // respawn far traffic near player to keep density
      if (playerPos && Math.hypot(c.x - playerPos.x, c.z - playerPos.z) > 420) {
        c.x = playerPos.x + (Math.random() * 2 - 1) * 200;
        c.z = playerPos.z + (Math.random() * 2 - 1) * 200;
        c.x = Math.max(-380, Math.min(380, c.x)); c.z = Math.max(-380, Math.min(380, c.z));
      }
    }
  }
}
