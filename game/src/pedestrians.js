// pedestrians.js — pedestrians on sidewalks who walk, cross, and flee gunfire and crashes.
const SKINS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xfd79a8];

export function buildPedMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.1, 8), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.95; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
  head.position.y = 1.75; g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
  legs.position.y = 0.25; g.add(legs);
  return g;
}

export class Pedestrians {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.peds = [];
    for (let i = 0; i < 34; i++) this.spawnPed();
  }
  spawnPed(x, z) {
    const color = SKINS[Math.floor(Math.random() * SKINS.length)];
    const mesh = buildPedMesh(color);
    const px = x !== undefined ? x : (Math.random() * 2 - 1) * 360;
    const pz = z !== undefined ? z : (Math.random() * 2 - 1) * 360;
    const ped = {
      mesh, x: px, z: pz,
      heading: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 1.4,
      fleeing: 0, alive: true, panic: 0,
    };
    mesh.position.set(px, 0, pz);
    this.scene.add(mesh);
    this.peds.push(ped);
    return ped;
  }
  scare(x, z, radius) {
    for (const p of this.peds) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) {
        p.fleeing = 3 + Math.random() * 2;
        p.heading = Math.atan2(p.x - x, p.z - z) + (Math.random() - 0.5);
        p.speed = 5.5;
      }
    }
  }
  update(dt, playerPos) {
    for (const p of this.peds) {
      if (!p.alive) continue;
      if (p.fleeing > 0) {
        p.fleeing -= dt;
        if (p.fleeing <= 0) p.speed = 1.2 + Math.random();
      }
      // keep to sidewalks: drift toward nearest road offset
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      if (Math.abs(p.x) > 395 || Math.abs(p.z) > 395) p.heading += Math.PI;
      if (Math.random() < 0.001) p.heading += (Math.random() - 0.5) * 2;
      // hit by player car?
      const pc = this.game.player.car;
      if (pc && pc.speed > 6 && Math.hypot(p.x - pc.x, p.z - pc.z) < 2.2) {
        p.alive = false;
        p.mesh.visible = false;
        this.game.addWanted(1, 'pedestrian hit');
        this.game.hud.toast('Pedestrian hit! Wanted up.', 2000);
        this.game.audio.crash();
        this.spawnPed(pc.x + (Math.random() * 2 - 1) * 120, pc.z + (Math.random() * 2 - 1) * 120);
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // simple walk bob
      p.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.006 + p.x)) * 0.08;
    }
  }
}
