// city.js — Palmera Bay: 16 named districts, grid streets, procedural buildings, palms, beach, port, parks.
// Also owns district lookup, building colliders, collectible + stunt-jump placement, and map markers.
export const DISTRICTS = [
  'Marina District', 'Old Harbor', 'Palm Court', 'Sunset Strip',
  'Coral Heights', 'The Boardwalk', 'Portside', 'Jacaranda Row',
  'Cactus Flats', 'Neon Mile', 'Bayview Terrace', 'Fisherman\'s Wharf',
  'Solano Park', 'Crescent Beach', 'Ironworks', 'La Colina',
];
export const CITY = { half: 400, road: 80, roadWidth: 16 };

const PALETTE = [0xe8b04b, 0xd97b6c, 0x7fb8a4, 0x5b8fc9, 0xc9c9c9, 0xf2e3c9, 0x9a7fc9, 0xe07a5f, 0x6aa84f, 0x4a6fa5];

export function districtAt(x, z) {
  const gx = Math.max(0, Math.min(3, Math.floor((x + CITY.half) / (CITY.half * 2 / 4))));
  const gz = Math.max(0, Math.min(3, Math.floor((z + CITY.half) / (CITY.half * 2 / 4))));
  return DISTRICTS[gz * 4 + gx];
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // {x,z,hx,hz}
    this.buildings = [];
    this.palms = [];
    this.markers = {}; // named map spots
    this.collectibleSpots = [];
    this.jumpSpots = [];
    this.build();
  }
  box(w, h, d, color, x, y, z, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    if (opts.ry) m.rotation.y = opts.ry;
    this.scene.add(m);
    return m;
  }
  build() {
    const T = THREE;
    // Sky, sun, ground
    this.scene.background = new T.Color(0x87c5e8);
    this.scene.fog = new T.Fog(0x9fd0e8, 500, 1400);
    const sun = new T.DirectionalLight(0xfff2d0, 1.15); sun.position.set(220, 320, 120); this.scene.add(sun);
    this.scene.add(new T.AmbientLight(0xbfd9e8, 0.75));
    const hemi = new T.HemisphereLight(0xbfe3ff, 0x3a7d5a, 0.5); this.scene.add(hemi);
    const ground = new T.Mesh(new T.PlaneGeometry(1100, 1100), new T.MeshLambertMaterial({ color: 0x8a9a6a }));
    ground.rotation.x = -Math.PI / 2; this.scene.add(ground);
    // Beach strip (south edge) + sea
    const sand = new T.Mesh(new T.PlaneGeometry(1100, 90), new T.MeshLambertMaterial({ color: 0xf0d9a0 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.05, 445); this.scene.add(sand);
    const sea = new T.Mesh(new T.PlaneGeometry(1100, 220), new T.MeshLambertMaterial({ color: 0x1e7fa8 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, 600); this.scene.add(sea);
    // Roads: dark strips on the grid
    const roadMat = new T.MeshLambertMaterial({ color: 0x3c3f45 });
    const walkMat = new T.MeshLambertMaterial({ color: 0xb9b3a4 });
    for (let i = -4; i <= 4; i++) {
      const c = i * CITY.road;
      const r1 = new T.Mesh(new T.PlaneGeometry(860, CITY.roadWidth), roadMat);
      r1.rotation.x = -Math.PI / 2; r1.position.set(0, 0.1, c); this.scene.add(r1);
      const r2 = new T.Mesh(new T.PlaneGeometry(CITY.roadWidth, 860), roadMat);
      r2.rotation.x = -Math.PI / 2; r2.position.set(c, 0.1, 0); this.scene.add(r2);
      // center dashes
      for (let d = -380; d < 380; d += 40) {
        const dash = new T.Mesh(new T.PlaneGeometry(14, 1.2), new T.MeshBasicMaterial({ color: 0xffd23e }));
        dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.12, c); this.scene.add(dash);
      }
    }
    // Sidewalks as slightly raised strips along roads
    for (let i = -4; i <= 4; i++) {
      const c = i * CITY.road;
      const s1 = new T.Mesh(new T.PlaneGeometry(860, 5), walkMat);
      s1.rotation.x = -Math.PI / 2; s1.position.set(0, 0.08, c + 10); this.scene.add(s1);
      const s2 = new T.Mesh(new T.PlaneGeometry(860, 5), walkMat);
      s2.rotation.x = -Math.PI / 2; s2.position.set(0, 0.08, c - 10); this.scene.add(s2);
    }
    // Buildings per block
    const rnd = mulberry(20261118);
    for (let bx = -4; bx < 4; bx++) {
      for (let bz = -4; bz < 4; bz++) {
        const cx = bx * CITY.road + CITY.road / 2, cz = bz * CITY.road + CITY.road / 2;
        if (cz > 360) continue; // beach
        if (bx === 3 && bz >= 1) continue; // port yard (east)
        if (bx === -3 && bz === -3) continue; // Solano Park
        const n = 2 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          const w = 14 + rnd() * 18, d = 14 + rnd() * 18;
          const h = 8 + rnd() * rnd() * 46;
          const x = cx - 22 + rnd() * (44 - w), z = cz - 22 + rnd() * (44 - d);
          const color = PALETTE[Math.floor(rnd() * PALETTE.length)];
          const b = this.box(w, h, d, color, x, h / 2, z);
          this.buildings.push(b);
          this.colliders.push({ x, z, hx: w / 2 + 0.5, hz: d / 2 + 0.5 });
          // roof trim + windows strip
          this.box(w + 0.6, 0.8, d + 0.6, 0x2c2f36, x, h + 0.4, z);
          const win = new T.Mesh(new T.PlaneGeometry(w * 0.8, Math.min(h * 0.7, 18)), new T.MeshBasicMaterial({ color: 0x9fd8ff }));
          win.position.set(x, h / 2, z + d / 2 + 0.06); this.scene.add(win);
          // rooftop sign on tall towers
          if (h > 34) {
            const sign = new T.Mesh(new T.PlaneGeometry(w * 0.6, 4), new T.MeshBasicMaterial({ color: 0xffd23e }));
            sign.position.set(x, h + 3, z + d / 2 + 0.1); this.scene.add(sign);
          }
        }
      }
    }
    // Solano Park (NW block): grass, trees, pond
    const park = new T.Mesh(new T.PlaneGeometry(70, 70), new T.MeshLambertMaterial({ color: 0x4e9a4e }));
    park.rotation.x = -Math.PI / 2; park.position.set(-280, 0.15, -280); this.scene.add(park);
    const pond = new T.Mesh(new T.CircleGeometry(14, 24), new T.MeshLambertMaterial({ color: 0x2e8fb8 }));
    pond.rotation.x = -Math.PI / 2; pond.position.set(-280, 0.2, -280); this.scene.add(pond);
    // Port (east): containers + cranes
    for (let i = 0; i < 14; i++) {
      const cx = 330 + (i % 4) * 16, cz = 120 + Math.floor(i / 4) * 18;
      this.box(13, 5, 6, [0xd94f30, 0x2e7fc9, 0xe8a33d, 0x3aa655][i % 4], cx, 2.5, cz, { ry: 0.2 });
      this.colliders.push({ x: cx, z: cz, hx: 7, hz: 4 });
    }
    for (let i = 0; i < 3; i++) {
      const cx = 360, cz = 60 + i * 90;
      this.box(4, 42, 4, 0xe8b04b, cx, 21, cz);
      this.box(34, 4, 4, 0xe8b04b, cx - 14, 40, cz);
      this.colliders.push({ x: cx, z: cz, hx: 3, hz: 3 });
    }
    // Palm trees along roads + beach
    const trunkMat = new T.MeshLambertMaterial({ color: 0x8a6b46 });
    const leafMat = new T.MeshLambertMaterial({ color: 0x2fae5f });
    const palmSpots = [];
    for (let i = -4; i <= 4; i++) for (let d = -360; d <= 360; d += 80) {
      palmSpots.push([d + 14, i * CITY.road + 13]);
      palmSpots.push([i * CITY.road + 13, d + 14]);
    }
    for (let d = -400; d <= 400; d += 40) palmSpots.push([d, 415]);
    for (const [x, z] of palmSpots) {
      if (Math.abs(x) > 400 || Math.abs(z) > 430) continue;
      const g = new T.Group();
      const trunk = new T.Mesh(new T.CylinderGeometry(0.35, 0.55, 9, 6), trunkMat);
      trunk.position.y = 4.5; g.add(trunk);
      const top = new T.Mesh(new T.ConeGeometry(3.4, 3.2, 7), leafMat);
      top.position.y = 10; g.add(top);
      g.position.set(x, 0, z);
      this.scene.add(g); this.palms.push(g);
    }
    // Boardwalk planks along the beach
    const walk = new T.Mesh(new T.PlaneGeometry(860, 12), new T.MeshLambertMaterial({ color: 0xc9a06a }));
    walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.12, 398); this.scene.add(walk);
    // Named markers (shops / mission spots) — all on roads, reachable
    this.markers = {
      garage: { x: -40, z: 40, label: 'Voss Garage' },
      shop: { x: 120, z: -40, label: 'Harbor Arms' },
      safehouse: { x: -200, z: 200, label: 'Marina Safehouse' },
      chopshop: { x: 320, z: 240, label: 'Reyes Chop Shop' },
      spray: { x: 40, z: -200, label: 'Spray Works' },
      port: { x: 320, z: 160, label: 'Portside Docks' },
      bank: { x: 0, z: -120, label: 'Bay Trust Bank' },
      hideout: { x: -320, z: -320, label: 'La Colina Hideout' },
      beach: { x: 160, z: 400, label: 'Crescent Beach' },
      park: { x: -280, z: -280, label: 'Solano Park' },
    };
    // Marker beacons: glowing pillars + floating label sprite
    for (const [key, m] of Object.entries(this.markers)) {
      const pillar = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 26, 10, 1, true),
        new T.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: T.DoubleSide }));
      pillar.position.set(m.x, 13, m.z); this.scene.add(pillar);
      const base = new T.Mesh(new T.CylinderGeometry(3, 3, 0.4, 16), new T.MeshBasicMaterial({ color: 0xffd23e }));
      base.position.set(m.x, 0.25, m.z); this.scene.add(base);
      m.pillar = pillar;
    }
    // 25 collectible packages (glowing orange boxes) scattered on sidewalks/roads
    const crnd = mulberry(777);
    for (let i = 0; i < 25; i++) {
      const x = Math.round((crnd() * 2 - 1) * 360 / 40) * 40 + (crnd() > 0.5 ? 12 : -12);
      const z = Math.round((crnd() * 2 - 1) * 360 / 40) * 40 + (crnd() > 0.5 ? 12 : -12);
      const pkg = new T.Mesh(new T.BoxGeometry(1.6, 1.2, 1.6), new T.MeshBasicMaterial({ color: 0xff7a1a }));
      pkg.position.set(x, 1.2, z); this.scene.add(pkg);
      const glow = new T.Mesh(new T.SphereGeometry(2.4, 10, 8), new T.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.3 }));
      glow.position.set(x, 1.2, z); this.scene.add(glow);
      this.collectibleSpots.push({ x, z, mesh: pkg, glow, taken: false });
    }
    // 8 stunt jumps: ramps on straight roads
    const jumpDefs = [
      [0, -160, 0], [160, 0, Math.PI / 2], [-160, 80, 0], [80, 240, Math.PI / 2],
      [-80, -240, 0], [240, -160, Math.PI / 2], [-240, 160, Math.PI / 2], [320, 80, 0],
    ];
    for (const [x, z, ry] of jumpDefs) {
      const ramp = new T.Mesh(new T.BoxGeometry(10, 1, 14), new T.MeshLambertMaterial({ color: 0xffd23e }));
      ramp.position.set(x, 1.2, z); ramp.rotation.y = ry; ramp.rotation.x = 0; ramp.rotation.z = 0.28;
      this.scene.add(ramp);
      const flag = new T.Mesh(new T.BoxGeometry(0.4, 7, 0.4), new T.MeshLambertMaterial({ color: 0xffffff }));
      flag.position.set(x + 6, 3.5, z); this.scene.add(flag);
      const top = new T.Mesh(new T.BoxGeometry(3, 2, 1.4), new T.MeshBasicMaterial({ color: 0xff3b30 }));
      top.position.set(x + 6, 7, z); this.scene.add(top);
      this.jumpSpots.push({ x, z, ry, mesh: ramp, done: false });
    }
  }
  collideCircle(x, z, r) {
    // returns corrected {x,z} pushed out of building colliders, or null if free
    let px = x, pz = z;
    for (const c of this.colliders) {
      const dx = px - c.x, dz = pz - c.z;
      if (Math.abs(dx) < c.hx + r && Math.abs(dz) < c.hz + r) {
        const ox = c.hx + r - Math.abs(dx), oz = c.hz + r - Math.abs(dz);
        if (ox < oz) px = c.x + (dx > 0 ? c.hx + r : -(c.hx + r));
        else pz = c.z + (dz > 0 ? c.hz + r : -(c.hz + r));
      }
    }
    px = Math.max(-420, Math.min(420, px));
    pz = Math.max(-420, Math.min(430, pz));
    return { x: px, z: pz };
  }
}
