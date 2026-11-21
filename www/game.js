// ===================================================================
//  NANI vs TANTRIK 3D - first-person stealth horror (desktop + mobile)
//  You are Nani. Search the old palace (3 floors) for the gate parts,
//  keys and food. Escape through the front gate before the Tantrik
//  catches you. Needs maps.js (the palace layout).
// ===================================================================
(function () {
'use strict';

// ---------- EASY SETTINGS (tweak these!) ----------
const CFG = {
  EYE_SECONDS: 120,            // Eye of Sight lasts 2 minutes (keep >= 120)
  HP: 4,
  WALK: 2.4, RUN: 4.0, CROUCH: 1.2,          // metres per second
  NOISE_WALK: 4, NOISE_RUN: 9,               // how far the Tantrik hears you
  SIGHT: 9, SIGHT_CROUCH: 4.5,               // how far he sees you
  MAP_PING_EVERY: 10, MAP_PING_SHOW: 3,      // minimap shows the Tantrik as an orange dot for 3s every 10s
  HINT_EVERY: 20, HINT_SHOW: 4,              // minimap blinks K (key) F (food) A (axe) for 4s every 20s
  NOISE_VASE: 20, NOISE_CLATTER: 13, NOISE_DROP: 5, HOLY_STUN: 5.5,   // how far thrown things are heard / seconds holy water stuns him
  STAGES: [   // parts = gate parts to find, foods = food items hidden in drawers, sp = Tantrik [walk, chase] speed
    { name: 'Stage 1 - The Old Palace',   flip: '',  parts: 3, foods: 4, bar: 1, holy: 1, vases: 3, lanterns: 2, sp: [1.55, 2.9] },
    { name: 'Stage 2 - The Mirror Wing',  flip: 'h', parts: 4, foods: 3, bar: 2, holy: 1, vases: 3, lanterns: 2, sp: [1.7, 3.05] },
    { name: 'Stage 3 - The Ritual Palace', flip: 'v', parts: 5, foods: 3, bar: 2, holy: 2, vases: 4, lanterns: 2, sp: [1.8, 3.2] },
  ],
};
const PART_NAMES = ['Gate Key (top half)', 'Gate Key (bottom half)', 'Brass Lock Seal', 'Iron Gate Bolt', 'Ritual Bell'];
const FOOD_NAMES = ['laddoo', 'banana', 'chapati', 'glass of milk', 'apple'];
const EMPTY_MSGS = ['Nothing but dust.', 'Only old cloth.', 'Empty.', 'A dead spider... nothing else.', 'Old bangles, nothing useful.', 'Just yellow paper.'];
const FLOOR_NAMES = ['Ground floor', 'First floor', 'Top floor'];

const TS = 1.6, W = 24, H = 16, FH = 2.4, NF = 3;   // tile size, map size, floor height, floors
const $ = id => document.getElementById(id);
const IS_TOUCH = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;
if (IS_TOUCH) document.body.classList.add('touch');

// ---------- RENDERER / SCENE ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050408);
scene.fog = new THREE.FogExp2(0x08060a, 0.06);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 60);
camera.rotation.order = 'YXZ';
scene.add(camera);
scene.add(new THREE.AmbientLight(0x585268, 0.8));
const torch = new THREE.SpotLight(0xffcf9e, 2.3, 15, Math.PI / 4, 0.65, 1.2);
torch.position.set(0, 0, 0); camera.add(torch);
const torchT = new THREE.Object3D(); torchT.position.set(0, 0, -1); camera.add(torchT); torch.target = torchT;
const nearLight = new THREE.PointLight(0xffb070, 0.9, 6, 2); camera.add(nearLight);
const exitLight = new THREE.PointLight(0x55ff99, 0, 8, 2); scene.add(exitLight);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

// ---------- PROCEDURAL TEXTURES (no image files needed) ----------
function canvasTex(w, h, draw, rx, ry) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); return t;
}
// faded wallpaper: vertical stripes, damask diamonds, damp stains, peeled plaster, skirting board
function wallpaperTex(base, stripe, plaster) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.3; g.fillStyle = stripe;
    for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 30, h);
    g.globalAlpha = 0.16; g.strokeStyle = stripe; g.lineWidth = 2;
    for (let y = 24; y < h; y += 52) for (let x = 32; x < w; x += 64) {
      g.beginPath(); g.moveTo(x, y - 11); g.lineTo(x + 9, y); g.lineTo(x, y + 11); g.lineTo(x - 9, y); g.closePath(); g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const x = 14 + Math.random() * (w - 40), y = 30 + Math.random() * (h - 120), r = 5 + Math.random() * 8;
      g.globalAlpha = 0.45; g.fillStyle = plaster; g.beginPath();
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * (0.6 + Math.random() * 0.5); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 1.3); }
      g.closePath(); g.fill();
      g.globalAlpha = 0.2; g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 16; i++) {
      const x = Math.random() * w, y = Math.random() * h * 0.85, r = 10 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(12,9,5,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.fillStyle = '#17110c'; g.fillRect(0, 0, w, 9);            // cornice
    g.fillStyle = '#2a1f15'; g.fillRect(0, h - 40, w, 40);      // skirting board
    g.fillStyle = '#3d2d1d'; g.fillRect(0, h - 45, w, 5);
  }, 1, 1);
}
const wallTexA = wallpaperTex('#3b3931', '#4a4636', '#5a5142');   // ground floor, faded olive
const wallTexB = wallpaperTex('#35333d', '#443e50', '#564c40');   // top floor, cold and rotten
const stoneTex = canvasTex(128, 128, (g, w, h) => {               // castle wing (first floor)
  g.fillStyle = '#1e1c19'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let b = 0; b < 4; b++) {
    const x = b * 32 - (r % 2 ? 16 : 0), y = r * 32, v = 56 + Math.random() * 26;
    g.fillStyle = `rgb(${Math.round(v)},${Math.round(v - 2)},${Math.round(v - 6)})`;
    g.fillRect(x + 2, y + 2, 28, 28);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 2, y + 26, 28, 4);
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.22})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}, 1, 1);
const floorTex = canvasTex(128, 128, (g, w, h) => {               // worn wooden planks
  const plank = 21;
  for (let i = 0; i < Math.ceil(h / plank); i++) {
    const v = 38 + Math.random() * 22;
    g.fillStyle = `rgb(${Math.round(v + 16)},${Math.round(v - 6)},${Math.round(v - 20)})`;
    g.fillRect(0, i * plank, w, plank - 2);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, i * plank + plank - 2, w, 2);
    for (let k = 0; k < 10; k++) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`; g.fillRect(Math.random() * w, i * plank + 2 + Math.random() * (plank - 6), 14 + Math.random() * 40, 1); }
    if (Math.random() < 0.3) { g.fillStyle = 'rgba(10,6,3,.7)'; g.fillRect(Math.random() * w, i * plank + 4, 6 + Math.random() * 10, 3); }
  }
}, 2, 2);
const ceilTex = canvasTex(128, 128, (g, w, h) => {                // stained plaster ceiling
  g.fillStyle = '#171310'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2); }
  g.strokeStyle = 'rgba(70,58,44,.3)'; g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 18; y += h / 6; g.lineTo(x, y); }
    g.stroke();
  }
}, 2, 2);
const paintTex = canvasTex(128, 96, (g, w, h) => {                // portrait whose eyes glow
  g.fillStyle = '#141018'; g.fillRect(0, 0, w, h);
  const bg = g.createRadialGradient(64, 44, 4, 64, 44, 60); bg.addColorStop(0, '#3a3026'); bg.addColorStop(1, '#0c0a0e');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#191420'; g.beginPath(); g.ellipse(64, 94, 46, 34, 0, 0, 7); g.fill();
  g.fillStyle = '#c9b295'; g.beginPath(); g.ellipse(64, 50, 17, 22, 0, 0, 7); g.fill();
  g.fillStyle = '#0a0709';
  g.beginPath(); g.ellipse(57, 46, 5, 7, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(71, 46, 5, 7, 0, 0, 7); g.fill();
  g.fillStyle = '#ffefb0';
  g.beginPath(); g.arc(57, 47, 2.4, 0, 7); g.fill();
  g.beginPath(); g.arc(71, 47, 2.4, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,214,140,.45)'; g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const sx = 30 + Math.random() * 70, sy = 20 + Math.random() * 60;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (Math.random() - 0.5) * 30, sy + (Math.random() - 0.5) * 24); g.stroke();
  }
});
const mirrorTex = canvasTex(64, 128, (g, w, h) => {               // tarnished old mirror
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, '#7b8a92'); gr.addColorStop(0.5, '#3c464c'); gr.addColorStop(1, '#0b0d0f');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(8, 0, 6, h);
}, 1, 1);
const woodTex = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#6a4424'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 20; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`; g.fillRect(0, Math.random() * h, w, 1 + Math.random() * 2); }
});
const glowTex = canvasTex(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});
const eyeTex = canvasTex(128, 80, (g) => {
  g.strokeStyle = '#6fd0ff'; g.fillStyle = '#6fd0ff'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(8, 40); g.quadraticCurveTo(64, -14, 120, 40); g.quadraticCurveTo(64, 94, 8, 40); g.stroke();
  g.beginPath(); g.arc(64, 40, 16, 0, 7); g.fill();
});

const matCache = {};
const mat = (c) => matCache['l' + c] || (matCache['l' + c] = new THREE.MeshLambertMaterial({ color: c }));
const basic = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
const wallMats = [                                              // wall style per floor
  new THREE.MeshLambertMaterial({ map: wallTexA }),   // marble hall with old wallpaper
  new THREE.MeshLambertMaterial({ map: stoneTex }),   // castle wing
  new THREE.MeshLambertMaterial({ map: wallTexB }),   // rotten attic floor
];
const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
const woodMat = new THREE.MeshLambertMaterial({ map: woodTex });
const wardBodyMat = new THREE.MeshLambertMaterial({ map: woodTex, color: 0x9a8a78 });
const wardDoorMat = new THREE.MeshLambertMaterial({ map: woodTex, color: 0xd8c2a6 });
const ceilMat = new THREE.MeshLambertMaterial({ map: ceilTex });
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const wallGeo = new THREE.BoxGeometry(TS, FH, TS);
const planeGeo = new THREE.PlaneGeometry(TS, TS);
function box(w, h, d, m, x, y, z, parent) {
  const o = new THREE.Mesh(unitBox, m); o.scale.set(w, h, d); o.position.set(x, y, z); if (parent) parent.add(o); return o;
}
function sprite(tex, color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.set(size, size, 1); return s;
}

// ---------- THE TANTRIK (model built from simple shapes) ----------
function buildTantrik() {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0); g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.34, 0.68, 1.75, 14), mat(0x120b0b), 0, 0.88, 0);            // black robe
  add(new THREE.CylinderGeometry(0.52, 0.55, 0.16, 14), mat(0xc4531a), 0, 0.85, 0);             // saffron sash
  add(new THREE.BoxGeometry(0.06, 1.05, 0.3), mat(0xc4531a), 0.3, 1.25, 0, 0, 0, 0.12);         // chest cloth
  add(new THREE.TorusGeometry(0.3, 0.045, 6, 18), mat(0xe8e0c8), 0, 1.7, 0, Math.PI / 2, 0, 0); // bead mala
  add(new THREE.SphereGeometry(0.23, 14, 12), mat(0xb98b62), 0, 1.98, 0);                       // bald head
  add(new THREE.SphereGeometry(0.04, 8, 8), basic(0xb3121b), 0.22, 2.04, 0);                    // tilak
  add(new THREE.BoxGeometry(0.02, 0.05, 0.26), basic(0xe8e0c8), 0.22, 2.12, 0);                 // ash stripes
  const eyeMat = basic(0xffd27a);
  add(new THREE.SphereGeometry(0.035, 6, 6), eyeMat, 0.2, 1.99, 0.09);
  add(new THREE.SphereGeometry(0.035, 6, 6), eyeMat, 0.2, 1.99, -0.09);
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), mat(0x120b0b), 0.4, 1.35, 0.42, 0, 0, -1.2);   // arms
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), mat(0x120b0b), 0.4, 1.35, -0.42, 0, 0, -1.2);
  const metal = mat(0x9a9a9a);
  add(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 6), metal, 0.75, 1.25, 0.42);                 // trishul shaft
  add(new THREE.ConeGeometry(0.05, 0.3, 6), metal, 0.75, 2.65, 0.42);
  add(new THREE.ConeGeometry(0.04, 0.26, 6), metal, 0.75, 2.5, 0.58);
  add(new THREE.ConeGeometry(0.04, 0.26, 6), metal, 0.75, 2.5, 0.26);
  g.userData.eyeMat = eyeMat;
  return g;
}
function buildGhost() {   // red see-through silhouette drawn on top of walls when the Eye is open
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false });
  const a = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.68, 1.75, 10), m); a.position.y = 0.88; a.renderOrder = 999;
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), m); b.position.y = 1.98; b.renderOrder = 999;
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.12, depthTest: false, depthWrite: false }));
  c.position.y = 1.1; c.renderOrder = 998;
  g.add(a); g.add(b); g.add(c); g.visible = false; return g;
}
const tkMesh = buildTantrik(); scene.add(tkMesh);
const ghost = buildGhost(); scene.add(ghost);

// ---- Nani: first-person arms + a full 3D model for third-person view ----
function limb(parent, ax, ay, az, bx, by, bz, r, m) {   // a tapered arm from point A (shoulder) to point B (hand)
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, len, 8), m);
  o.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  parent.add(o); return o;
}
function bangle(parent, ax, ay, az, bx, by, bz, t) {      // gold bangle ring around the wrist
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
  const o = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.012, 6, 14), mat(0xd9b44a));
  o.position.set(ax + dx * t, ay + dy * t, az + dz * t);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(dx / len, dy / len, dz / len));
  parent.add(o); return o;
}
const SKIN = mat(0xe3c29a), SLEEVE = mat(0x7a4b8c), GOLD = mat(0xd9b44a);
const cane = new THREE.Group();            // everything Nani shows in first person
{
  const rh = [0.40, -0.34, -0.62], lh = [-0.38, -0.40, -0.55];   // hand positions (right holds cane, left holds shawl)
  limb(cane, 0.95, -1.0, 0.2, rh[0], rh[1], rh[2], 0.075, SLEEVE); bangle(cane, 0.95, -1.0, 0.2, rh[0], rh[1], rh[2], 0.82); bangle(cane, 0.95, -1.0, 0.2, rh[0], rh[1], rh[2], 0.88);
  limb(cane, -0.95, -1.0, 0.2, lh[0], lh[1], lh[2], 0.075, SLEEVE); bangle(cane, -0.95, -1.0, 0.2, lh[0], lh[1], lh[2], 0.82); bangle(cane, -0.95, -1.0, 0.2, lh[0], lh[1], lh[2], 0.88);
  const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), SKIN); h1.position.set(rh[0], rh[1], rh[2]); h1.scale.set(1, 0.9, 1.2); cane.add(h1);
  const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), SKIN); h2.position.set(lh[0], lh[1], lh[2]); h2.scale.set(1, 0.9, 1.2); cane.add(h2);
  const stick = new THREE.Group(); stick.position.set(rh[0], rh[1], rh[2]); stick.rotation.set(0.35, 0, -0.1);   // cane planted on the floor
  const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8), mat(0x6b4a2a)); sc.position.set(0, -0.5, 0); stick.add(sc);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), mat(0x6b4a2a)); sh.position.set(0, 0.12, 0); stick.add(sh);
  cane.add(stick);
  const shawl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.05), mat(0x9b6aa8)); shawl.position.set(-0.55, -0.62, -0.5); shawl.rotation.set(0.3, 0.5, 0.3); cane.add(shawl);   // shawl edge in her left hand
}
camera.add(cane);

function buildNani() {                     // full grandmother, front of the model points to +x
  const g = new THREE.Group();
  const add = (geo, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0); g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.28, 0.52, 1.0, 14), SLEEVE, 0, 0.5, 0);                // saree
  add(new THREE.CylinderGeometry(0.525, 0.54, 0.1, 14), GOLD, 0, 0.06, 0);                // gold hem
  add(new THREE.CylinderGeometry(0.22, 0.28, 0.55, 12), mat(0xb5546a), 0, 1.25, 0);       // blouse
  add(new THREE.BoxGeometry(0.06, 0.95, 0.34), mat(0x9b6aa8), 0.2, 1.0, 0, 0, 0, 0.1);    // pallu cloth
  add(new THREE.SphereGeometry(0.17, 14, 12), SKIN, 0.02, 1.72, 0);                        // face
  const hair = add(new THREE.SphereGeometry(0.18, 14, 12), mat(0xd6d6d6), -0.04, 1.78, 0); hair.scale.set(1, 0.85, 1);
  add(new THREE.SphereGeometry(0.09, 10, 8), mat(0xd6d6d6), -0.2, 1.8, 0);                 // bun
  for (const z of [-0.07, 0.07]) add(new THREE.TorusGeometry(0.045, 0.01, 6, 14), mat(0x222222), 0.185, 1.74, z, 0, Math.PI / 2, 0);   // glasses
  add(new THREE.SphereGeometry(0.016, 6, 6), basic(0xb3121b), 0.185, 1.81, 0);             // bindi
  for (const z of [-0.29, 0.29]) {
    limb(g, 0.0, 1.45, z, 0.28, 1.0, z * 1.1, 0.06, SLEEVE);
    const h = add(new THREE.SphereGeometry(0.05, 8, 8), SKIN, 0.28, 1.0, z * 1.1);
  }
  add(new THREE.CylinderGeometry(0.018, 0.018, 1.05, 8), mat(0x6b4a2a), 0.3, 0.52, 0.32);  // cane
  add(new THREE.SphereGeometry(0.04, 8, 8), mat(0x6b4a2a), 0.3, 1.05, 0.32);
  g.scale.set(0.95, 0.95, 0.95); g.visible = false;
  return g;
}
const naniMesh = buildNani(); scene.add(naniMesh);

// ---------- STATE ----------
let state = 'menu';            // menu | play | paused | stagewin | dead | win
let stageIdx = 0, hp = CFG.HP, time = 0;
let G = [], floors = [], doors = [], drawers = [], wards = [], beds = [], blockers = [], stairs = [], lamps = [];
let stairMap = new Map(), doorMap = new Map();
let exitD = null, eyeCharm = null, world = null;
let player, tk, eye = { state: 'locked', time: 0 };
let inv = { parts: 0, need: 0, keys: 0, axe: false };
let yaw = 0, pitch = 0, hideYaw = 0, camH = 1.6, camY = 1.6, bobT = 0, burst = 0, noiseNow = 0, beat = 0, stepT = 0, shake = 0, ambT = 5, gateMsgT = 0;
let msgs = [], crouchToggle = false, thirdPerson = false, pingT = 0, hintWas = false;
let carry = null, props = [], thrown = [], flames = [], burstR = 8;
const mv = { x: 0, y: 0 };
const keys = {};

// ---------- AUDIO ----------
let ac, droneOn = false;
function audio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
// deep, filtered sounds - no high beeps
let noiseBuf = null;
function getNoise() {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 2), ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function tone(f0, f1, dur, type, vol, delay, cut) {     // oscillator gliding down, low-passed
  try {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    lp.type = 'lowpass'; lp.frequency.value = cut || 240; lp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.04);
  } catch (e) {}
}
function rustle(dur, vol, freq, q, delay, type) {      // filtered noise: creaks, cloth, thumps
  try {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = getNoise(); s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type || 'bandpass';
    f.frequency.setValueAtTime(freq || 300, t); f.Q.value = q || 1;
    if (type === 'bandpass' && dur > 0.3) f.frequency.exponentialRampToValueAtTime(Math.max(80, (freq || 300) * 0.45), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(ac.destination);
    s.start(t); s.stop(t + dur + 0.05);
  } catch (e) {}
}
const SFX = {
  step(dist) { const v = 0.3 * Math.max(0, 1 - dist / 14); tone(76 + Math.random() * 20, 33, 0.17, 'sine', v, 0, 190); rustle(0.08, v * 0.5, 140 + Math.random() * 70, 1.4, 0, 'lowpass'); },
  heartbeat() { tone(49, 27, 0.2, 'sine', 0.5, 0, 140); tone(43, 23, 0.24, 'sine', 0.34, 0.19, 120); },
  hurt() { tone(120, 20, 0.75, 'sine', 0.85, 0, 230); rustle(0.4, 0.5, 220, 0.7, 0, 'lowpass'); },
  alert() { tone(57, 40, 1.2, 'sawtooth', 0.34, 0, 160); tone(60.5, 44, 1.2, 'sawtooth', 0.3, 0.03, 160); rustle(1.1, 0.16, 170, 0.6, 0.05, 'lowpass'); },
  door(open) { rustle(open ? 0.8 : 0.45, 0.26, open ? 260 : 190, 1.3, 0, 'bandpass'); tone(open ? 125 : 92, open ? 62 : 48, 0.5, 'sawtooth', 0.1, 0, 170); },
  drawer(open) { rustle(0.16, 0.26, 210, 1.6, 0, 'bandpass'); tone(96, 50, 0.15, 'sine', 0.28, 0, 170); },
  pickup() { tone(196, 130, 0.9, 'sine', 0.24, 0, 380); tone(294, 196, 0.9, 'triangle', 0.08, 0.02, 460); },
  key() { rustle(0.1, 0.16, 900, 5, 0, 'bandpass'); tone(147, 98, 0.8, 'triangle', 0.12, 0.03, 520); },
  charm() { tone(110, 110, 1.7, 'sine', 0.26, 0, 280); tone(165, 132, 1.7, 'triangle', 0.1, 0.05, 420); rustle(1.4, 0.07, 380, 2.5, 0, 'bandpass'); },
  eyeOn() { tone(41, 62, 1.3, 'sine', 0.42, 0, 110); tone(82, 118, 1.3, 'triangle', 0.1, 0.06, 260); },
  unlock() { rustle(0.12, 0.2, 650, 4, 0, 'bandpass'); tone(128, 72, 0.32, 'square', 0.1, 0.05, 380); },
  hide() { rustle(0.35, 0.15, 420, 0.8, 0, 'lowpass'); tone(68, 42, 0.3, 'sine', 0.13, 0, 130); },
  scan() { tone(164, 123, 0.7, 'sine', 0.2, 0, 330); tone(246, 185, 0.6, 'triangle', 0.06, 0.04, 420); },   // soft low blip when the map scans
  hint() { tone(220, 196, 0.6, 'sine', 0.1, 0, 440); },
  crash() { rustle(0.55, 0.5, 900, 0.7, 0, 'bandpass'); tone(190, 60, 0.45, 'sine', 0.4, 0, 420); },
  clatter() { rustle(0.28, 0.32, 600, 1.2, 0, 'bandpass'); tone(130, 70, 0.22, 'square', 0.1, 0, 300); },
  drop() { tone(90, 50, 0.16, 'sine', 0.2, 0, 200); },
  chop() { tone(110, 45, 0.25, 'sawtooth', 0.3, 0, 260); rustle(0.2, 0.38, 500, 1.4, 0, 'bandpass'); },
  creak() { rustle(1.7, 0.1, 340, 3.5, 0, 'bandpass'); tone(96, 58, 1.5, 'sine', 0.05, 0.05, 200); },
  win() { tone(98, 98, 2.6, 'sine', 0.28, 0, 240); tone(146, 146, 2.6, 'sine', 0.16, 0.06, 300); },
};
function drone() {          // distant wind: deep rumble + airy layer so it is audible on phone speakers
  try {
    if (!ac || droneOn) return; droneOn = true;
    const src = ac.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const t0 = ac.currentTime;
    // deep layer
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.7;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.06, t0 + 6);
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.06;
    const lfoAmt = ac.createGain(); lfoAmt.gain.value = 130;
    lfo.connect(lfoAmt); lfoAmt.connect(lp.frequency);
    const swell = ac.createOscillator(); swell.frequency.value = 0.045;
    const swellAmt = ac.createGain(); swellAmt.gain.value = 0.018;
    swell.connect(swellAmt); swellAmt.connect(g.gain);
    // airy layer (small speakers cannot play the deep layer)
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 780; bp.Q.value = 0.55;
    const g2 = ac.createGain(); g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(0.032, t0 + 6);
    const gust = ac.createOscillator(); gust.frequency.value = 0.09;
    const gustAmt = ac.createGain(); gustAmt.gain.value = 0.014;
    gust.connect(gustAmt); gustAmt.connect(g2.gain);
    src.connect(lp); lp.connect(g); g.connect(ac.destination);
    src.connect(bp); bp.connect(g2); g2.connect(ac.destination);
    src.start(); lfo.start(); swell.start(); gust.start();
  } catch (e) {}
}
function msg(t, s) { msgs.push({ t, s: s || 3 }); if (msgs.length > 3) msgs.shift(); }

// ---------- HELPERS ----------
const nodeId = (f, x, y) => (f * H + y) * W + x;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ARROWS = { '>': [1, 0], '<': [-1, 0], 'v': [0, 1], '^': [0, -1] };
const MIRROR_H = { '>': '<', '<': '>' }, MIRROR_V = { '^': 'v', 'v': '^' };
function flipRows(rows, flip) {
  let r = rows.slice();
  if (flip.indexOf('h') >= 0) r = r.map(s => s.split('').reverse().map(c => MIRROR_H[c] || c).join(''));
  if (flip.indexOf('v') >= 0) r = r.slice().reverse().map(s => s.split('').map(c => MIRROR_V[c] || c).join(''));
  return r;
}
// grid values: 0 floor, 1 wall/pillar, 2 exit gate (solid until opened), 3 closed door, 4 stair
function solidAt(f, tx, ty) { if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true; const v = G[f][ty][tx]; return v === 1 || v === 2 || v === 3; }
function solidAI(f, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true; const v = G[f][ty][tx];
  if (v === 1 || v === 2) return true;
  if (v === 3) { const d = doorMap.get(nodeId(f, tx, ty)); return !d || d.locked || d.boarded; }
  return false;
}
function stairOf(e) { return stairMap.get(nodeId(e.fl, Math.floor(e.x / TS), Math.floor(e.z / TS))) || null; }
function stairP(s, e) { return Math.max(0, Math.min(1, ((e.x - s.sx) * s.dx + (e.z - s.sz) * s.dz) / (2 * TS))); }
function heightOf(e) { const s = stairOf(e); return s ? (s.f + stairP(s, e)) * FH : e.fl * FH; }
function updateFloor(e) { const s = stairOf(e); if (s) e.fl = stairP(s, e) > 0.5 ? s.f + 1 : s.f; }
function hitWall(e, obst) {
  const x0 = Math.floor((e.x - e.r) / TS), x1 = Math.floor((e.x + e.r) / TS), z0 = Math.floor((e.z - e.r) / TS), z1 = Math.floor((e.z + e.r) / TS);
  for (let y = z0; y <= z1; y++) for (let x = x0; x <= x1; x++) if (solidAt(e.fl, x, y)) return true;
  if (obst) for (const b of blockers) if (b.f === e.fl && Math.hypot(b.x - e.x, b.z - e.z) < e.r + b.r) return true;
  return false;
}
function moveEnt(e, dx, dz, obst) { e.x += dx; if (hitWall(e, obst)) e.x -= dx; e.z += dz; if (hitWall(e, obst)) e.z -= dz; updateFloor(e); }
function los(f, ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(d / 0.6));
  for (let i = 1; i < n; i++) if (solidAt(f, Math.floor((ax + (bx - ax) * i / n) / TS), Math.floor((az + (bz - az) * i / n) / TS))) return false;
  return true;
}
const canon = (f, x, y) => { const s = stairMap.get(nodeId(f, x, y)); return s ? nodeId(s.f, x, y) : nodeId(f, x, y); };
function bfs3(sf, sx, sy, gf, gx, gy) {
  if (solidAI(gf, gx, gy)) return [];
  const start = canon(sf, sx, sy), goal = canon(gf, gx, gy);
  if (start === goal) return [];
  const prev = new Int32Array(NF * W * H).fill(-2); prev[start] = -1; const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const id = q[qi]; if (id === goal) break;
    const f = Math.floor(id / (W * H)), r = id % (W * H), y = Math.floor(r / W), x = r % W;
    const s = stairMap.get(id), layers = s ? [s.f, s.f + 1] : [f];
    for (const L of layers) for (const d of DIRS) {
      const nx = x + d[0], ny = y + d[1]; if (solidAI(L, nx, ny)) continue;
      const nid = canon(L, nx, ny); if (prev[nid] !== -2) continue; prev[nid] = id; q.push(nid);
    }
  }
  if (prev[goal] === -2) return [];
  const path = []; let c = goal; while (c !== start) { path.push(c); c = prev[c]; } return path.reverse();
}
function randomSpot(pf) {
  for (let i = 0; i < 200; i++) {
    const f = Math.random() < 0.55 ? pf : Math.floor(Math.random() * NF);
    const x = 1 + Math.floor(Math.random() * (W - 2)), y = 1 + Math.floor(Math.random() * (H - 2));
    if (G[f][y][x] === 0) return { f, x: x * TS + TS / 2, z: y * TS + TS / 2 };
  }
  return { f: 0, x: 10 * TS, z: 10 * TS };
}
function placeAgainstWall(f, tx, ty, depth) {
  let cx = tx * TS + TS / 2, cz = ty * TS + TS / 2, fx = 0, fz = 1;
  for (const d of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const row = G[f][ty + d[1]];
    if (row && row[tx + d[0]] === 1) { fx = -d[0]; fz = -d[1]; cx += d[0] * (TS / 2 - depth / 2 - 0.03); cz += d[1] * (TS / 2 - depth / 2 - 0.03); break; }
  }
  return { x: cx, z: cz, fx, fz };
}

// ---------- FURNITURE (sofas, beds, mirrors, eye paintings, dust sheets, lamps) ----------
const FURN = { S: 1, A: 1, B: 1, T: 1, C: 1, M: 1, g: 1, w: 1, l: 1 };
const FURN_DEPTH = { S: 0.7, A: 0.7, B: 1.75, T: 0.9, C: 0.5, M: 0.13, g: 0.07, w: 0.98, l: 0.35 };
const FURN_R = { S: 1.0, A: 0.65, B: 0.7, T: 0.85, C: 0.35, M: 0, g: 0, w: 0.68, l: 0.25 };
const FAB = mat(0x4a3d36), FAB_D = mat(0x372c27), MATT = mat(0x8b8276), SHEET = mat(0x6f6759), DWOOD = mat(0x39281a);

function addChair(parent, x, z, ry) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; parent.add(c);
  box(0.5, 0.07, 0.5, DWOOD, 0, 0.44, 0, c);
  box(0.5, 0.52, 0.06, DWOOD, 0, 0.7, -0.22, c);
  for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(0.06, 0.44, 0.06, DWOOD, lx, 0.22, lz, c);
}
function buildSofa(g) {
  box(2.5, 0.4, 0.95, FAB, 0, 0.26, 0, g);
  box(2.5, 0.75, 0.22, FAB, 0, 0.62, -0.37, g);
  for (const x of [-1.14, 1.14]) box(0.26, 0.62, 0.95, FAB, x, 0.42, 0.02, g);
  for (const x of [-0.56, 0.56]) box(1.0, 0.16, 0.78, FAB_D, x, 0.52, 0.05, g);
  for (const [x, z] of [[-1.1, -0.4], [1.1, -0.4], [-1.1, 0.42], [1.1, 0.42]]) box(0.12, 0.14, 0.12, DWOOD, x, 0.07, z, g);
}
function buildArmchair(g) {
  box(1.05, 0.4, 0.9, FAB, 0, 0.26, 0, g);
  box(1.05, 0.78, 0.2, FAB, 0, 0.62, -0.35, g);
  for (const x of [-0.48, 0.48]) box(0.16, 0.6, 0.9, FAB, x, 0.44, 0.02, g);
  box(0.7, 0.15, 0.72, FAB_D, 0, 0.51, 0.02, g);
  for (const [x, z] of [[-0.45, -0.38], [0.45, -0.38], [-0.45, 0.38], [0.45, 0.38]]) box(0.1, 0.14, 0.1, DWOOD, x, 0.07, z, g);
}
function buildBed(g) {
  box(1.5, 0.28, 2.2, DWOOD, 0, 0.16, 0, g);
  box(1.42, 0.24, 2.1, MATT, 0, 0.4, 0.02, g);
  box(1.45, 0.1, 1.4, FAB_D, 0, 0.53, 0.32, g);
  box(0.85, 0.16, 0.42, mat(0xa39a8c), 0, 0.55, -0.78, g);
  box(1.6, 0.95, 0.12, DWOOD, 0, 0.72, -1.12, g);
}
function buildTable(g) {
  box(2.0, 0.1, 1.1, woodMat, 0, 0.76, 0, g);
  box(2.1, 0.05, 1.2, DWOOD, 0, 0.7, 0, g);
  for (const [x, z] of [[-0.88, -0.44], [0.88, -0.44], [-0.88, 0.44], [0.88, 0.44]]) box(0.09, 0.7, 0.09, DWOOD, x, 0.35, z, g);
  addChair(g, -1.5, 0, Math.PI / 2); addChair(g, 1.5, 0, -Math.PI / 2);
}
function buildMirror(g) {
  box(1.05, 2.15, 0.1, mat(0x3b2a18), 0, 1.25, 0, g);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 1.92), new THREE.MeshBasicMaterial({ map: mirrorTex }));
  glass.position.set(0, 1.25, 0.06); g.add(glass);
  box(1.15, 0.1, 0.14, mat(0x6b4f26), 0, 2.36, 0, g);
}
function buildPainting(g) {
  box(1.15, 0.9, 0.07, mat(0x2b1e12), 0, 1.75, 0, g);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.72), new THREE.MeshBasicMaterial({ map: paintTex }));
  p.position.set(0, 1.75, 0.05); g.add(p);
  for (const x of [-0.14, 0.14]) { const s = sprite(glowTex, 0xffd88a, 0.3); s.position.set(x, 1.79, 0.16); g.add(s); }
}
function buildSheet(g) {          // furniture left under a dust cover (lumpy cloth silhouette)
  const s2 = mat(0x5b5448);
  const blob = (r, sx, sy, sz, x, y, z, m) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); g.add(o); };
  blob(0.62, 1.25, 0.55, 1.0, 0, 0.34, 0, SHEET);          // body
  blob(0.5, 1.35, 0.8, 0.45, 0, 0.55, -0.38, SHEET);       // backrest lump
  blob(0.34, 1.1, 0.9, 0.9, -0.78, 0.36, 0.05, s2);        // arms
  blob(0.34, 1.1, 0.9, 0.9, 0.78, 0.36, 0.05, s2);
  blob(0.35, 1.0, 0.55, 0.9, 0.2, 0.7, 0.12, s2);          // rumpled fold on top
  box(0.9, 0.06, 0.5, s2, -0.5, 0.03, 0.55, g);            // cloth pooled on the floor
}
function buildLamp(g) {
  box(0.36, 0.06, 0.36, mat(0x241a12), 0, 0.03, 0, g);
  box(0.05, 1.6, 0.05, mat(0x2b2119), 0, 0.83, 0, g);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.36, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd2a0, side: THREE.DoubleSide }));
  shade.position.set(0, 1.7, 0); g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), basic(0xfff2d8)); bulb.position.set(0, 1.62, 0); g.add(bulb);
  const L = new THREE.PointLight(0xffc486, 0.85, 7, 2); L.position.set(0, 1.55, 0); g.add(L);
  lamps.push({ light: L, base: 0.85, seed: lamps.length * 2.7 });
}
function buildFurniture(list) {
  for (const o of list) {
    const p = o.ch === 'l'
      ? { x: o.tx * TS + TS / 2, z: o.ty * TS + TS / 2, fx: 0, fz: 1 }
      : placeAgainstWall(o.f, o.tx, o.ty, FURN_DEPTH[o.ch]);
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.fx, p.fz);
    if (o.ch !== 'l') g.scale.setScalar(0.78);
    if (o.ch === 'S') buildSofa(g);
    else if (o.ch === 'A') buildArmchair(g);
    else if (o.ch === 'B') buildBed(g);
    else if (o.ch === 'T') buildTable(g);
    else if (o.ch === 'C') addChair(g, 0, 0, 0);
    else if (o.ch === 'M') buildMirror(g);
    else if (o.ch === 'g') buildPainting(g);
    else if (o.ch === 'w') buildSheet(g);
    else if (o.ch === 'l') buildLamp(g);
    floors[o.f].add(g);
    if (o.ch === 'B') beds.push({ f: o.f, x: p.x, z: p.z, fx: p.fx, fz: p.fz, under: true });
    if (FURN_R[o.ch]) blockers.push({ f: o.f, x: p.x, z: p.z, r: FURN_R[o.ch] });
  }
}

// ---------- THROWABLES, TOOLS, BARRICADES, FLOOR THEMES ----------
const CARRY_NAMES = { vase: 'flower vase', lantern: 'lantern', holy: 'holy water' };
const carryG = new THREE.Group(); carryG.position.set(-0.30, -0.30, -0.62); camera.add(carryG);   // what Nani holds in her left hand
function buildProp(type) {
  const g = new THREE.Group();
  if (type === 'vase') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.3, 10), mat(0x3b6fa0)); body.position.y = 0.15; g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.12, 8), mat(0x3b6fa0)); neck.position.y = 0.36; g.add(neck);
    [[-0.05, 0xd33a3a, 0.62], [0.0, 0xf2c13a, 0.68], [0.05, 0xe27aa8, 0.6]].forEach(a => {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 5), mat(0x2f5a2a)); st.position.set(a[0], 0.52, 0); st.rotation.z = -a[0] * 3; g.add(st);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(a[1])); fl.position.set(a[0] * 1.6, a[2], 0); g.add(fl);
    });
  } else if (type === 'lantern') {
    box(0.16, 0.03, 0.16, mat(0x1a1410), 0, 0.015, 0, g);
    for (const [x, z] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) box(0.015, 0.2, 0.015, mat(0x1a1410), x, 0.13, z, g);
    box(0.13, 0.18, 0.13, basic(0xffc060, { transparent: true, opacity: 0.55 }), 0, 0.13, 0, g);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), basic(0xfff0c0)); fl.position.y = 0.12; g.add(fl);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.07, 4), mat(0x1a1410)); top.position.y = 0.27; top.rotation.y = Math.PI / 4; g.add(top);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 12), mat(0x1a1410)); h.position.y = 0.33; g.add(h);
    const gl = sprite(glowTex, 0xffc060, 0.8); gl.position.y = 0.13; g.add(gl);
  } else {   // holy water bottle
    const gm = basic(0x9cd7ff, { transparent: true, opacity: 0.7 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.2, 10), gm); b.position.y = 0.1; g.add(b);
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.07, 8), gm); n.position.y = 0.235; g.add(n);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), mat(0x7a5230)); c.position.y = 0.28; g.add(c);
    const gl = sprite(glowTex, 0x9cd7ff, 0.5); gl.position.y = 0.12; g.add(gl);
  }
  return g;
}
function setCarryVisual(type) {
  while (carryG.children.length) carryG.remove(carryG.children[0]);
  if (type) { const m = buildProp(type); m.scale.set(1.4, 1.4, 1.4); carryG.add(m); }
  carryG.visible = !!type;
}
function makeProp(type, f, x, z, y) {
  const mesh = buildProp(type); mesh.position.set(x, y, z); floors[f].add(mesh);
  const pr = { type, f, x, z, y, mesh }; props.push(pr); return pr;
}
function pickProp(pr) {
  if (carry) { msg('Your hands are full. Press F to drop what you hold.', 3); return; }
  floors[pr.f].remove(pr.mesh); props.splice(props.indexOf(pr), 1);
  carry = { type: pr.type }; setCarryVisual(pr.type); SFX.drop();
  msg(`You picked up the ${CARRY_NAMES[pr.type]}. ` + (IS_TOUCH ? 'Use THROW / DROP.' : 'G = throw (loud), F = drop (quiet).'), 4);
}
function noiseAt(x, z, f, R) {   // a sound the Tantrik can hear: he goes to look
  const t = tk; if (!t || t.state === 'chase') return;
  const d = Math.hypot(t.x - x, t.z - z), eff = t.fl === f ? d : d + 10;
  if (eff < R) { t.state = 'search'; t.target = { f, x, z }; t.searchT = 6; t.path = []; t.repath = 0; if (t.stun <= 0) msg('The Tantrik heard the noise!', 2); }
}
function throwCarry(hard) {
  if (state !== 'play' || !carry || player.hidden) return;
  const p = player, cp = Math.cos(pitch), fx = -Math.sin(yaw) * cp, fz = -Math.cos(yaw) * cp, fy = Math.sin(pitch), sp = hard ? 8 : 1.6;
  const t = { type: carry.type, f: p.fl, x: p.x + fx * 0.4, z: p.z + fz * 0.4, y: heightOf(p) + (hard ? 1.35 : 0.9), vx: fx * sp, vy: fy * sp + (hard ? 2.6 : 0), vz: fz * sp, hard, mesh: buildProp(carry.type) };
  if (solidAt(t.f, Math.floor(t.x / TS), Math.floor(t.z / TS))) { t.x = p.x; t.z = p.z; }
  world.add(t.mesh); t.mesh.position.set(t.x, t.y, t.z); thrown.push(t);
  carry = null; setCarryVisual(null);
}
function updateThrown(dt) {
  for (let i = thrown.length - 1; i >= 0; i--) {
    const t = thrown[i]; t.vy -= 12 * dt;
    const nx = t.x + t.vx * dt, nz = t.z + t.vz * dt;
    if (solidAt(t.f, Math.floor(nx / TS), Math.floor(nz / TS))) { t.vx *= -0.3; t.vz *= -0.3; } else { t.x = nx; t.z = nz; }
    t.y += t.vy * dt;
    const gy = heightOf({ fl: t.f, x: t.x, z: t.z });
    if (t.y <= gy + 0.05) { thrown.splice(i, 1); world.remove(t.mesh); landThrown(t, gy); continue; }
    t.mesh.position.set(t.x, t.y, t.z); t.mesh.rotation.x += dt * 9; t.mesh.rotation.z += dt * 5;
  }
}
function landThrown(t, gy) {
  if (t.hard && (t.type === 'vase' || t.type === 'holy')) {      // glass breaks
    const sh = new THREE.Group(), m = t.type === 'vase' ? mat(0x3b6fa0) : basic(0x9cd7ff, { transparent: true, opacity: 0.7 });
    for (let k = 0; k < 7; k++) box(0.05 + Math.random() * 0.05, 0.02, 0.05 + Math.random() * 0.05, m, (Math.random() - 0.5) * 0.5, 0.01, (Math.random() - 0.5) * 0.5, sh);
    sh.position.set(t.x, gy - t.f * FH, t.z); floors[t.f].add(sh);
    SFX.crash(); noiseAt(t.x, t.z, t.f, t.type === 'vase' ? CFG.NOISE_VASE : 9);
    if (t.type === 'holy') {
      if (tk.fl === t.f && Math.hypot(tk.x - t.x, tk.z - t.z) < 2.8) { tk.stun = Math.max(tk.stun, CFG.HOLY_STUN); tk.state = 'search'; tk.target = { f: t.f, x: t.x, z: t.z }; tk.searchT = 3; tk.path = []; msg('Holy water! The Tantrik is stunned! RUN!', 4); }
      else msg('The holy water splashed... it missed him.', 3);
    }
    return;
  }
  makeProp(t.type, t.f, t.x, t.z, gy - t.f * FH);                  // lanterns and gently dropped things stay on the floor
  if (t.hard) { SFX.clatter(); noiseAt(t.x, t.z, t.f, CFG.NOISE_CLATTER); } else { SFX.drop(); noiseAt(t.x, t.z, t.f, CFG.NOISE_DROP); }
}
function chopDoor(d) {
  if (!inv.axe) { msg('Boarded up. You need an axe.', 3); return; }
  d.hits = (d.hits || 0) + 1; SFX.chop(); shake = 0.2; burst = Math.max(burst, 0.7); burstR = Math.max(burstR, 14);   // chopping is LOUD
  if (d.boards && d.boards.children[d.hits - 1]) d.boards.children[d.hits - 1].visible = false;
  if (d.hits >= 3) { d.boarded = false; if (d.boards) floors[d.f].remove(d.boards); openDoor(d, true); msg('The boards splinter apart!', 3); }
  else msg('Chop! (' + d.hits + '/3)', 1.5);
}

// boarded doors seal off some rooms until you find the axe (the layout is checked so the axe and keys are never locked away)
function solidFlood(f, x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return true; const v = G[f][y][x];
  if (v === 1 || v === 2) return true;
  if (v === 3) { const d = doorMap.get(nodeId(f, x, y)); return !!(d && d.boarded); }
  return false;
}
function floodFrom(sf, sx, sy) {
  const start = canon(sf, sx, sy), seen = new Set([start]), q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const id = q[qi], f = Math.floor(id / (W * H)), r = id % (W * H), y = Math.floor(r / W), x = r % W;
    const s = stairMap.get(id), layers = s ? [s.f, s.f + 1] : [f];
    for (const L of layers) for (const d of DIRS) {
      const nx = x + d[0], ny = y + d[1]; if (solidFlood(L, nx, ny)) continue;
      const nid = canon(L, nx, ny); if (seen.has(nid)) continue; seen.add(nid); q.push(nid);
    }
  }
  return seen;
}
function chooseBarricades(S, spawn, tkSpawn) {
  const want = S.bar || 0, keyCount = doors.filter(d => d.locked).length;
  const sx = Math.floor(spawn.x / TS), sy = Math.floor(spawn.z / TS), tkId = nodeId(tkSpawn.f, Math.floor(tkSpawn.x / TS), Math.floor(tkSpawn.z / TS));
  const base = floodFrom(spawn.f, sx, sy);
  const safeCount = seen => drawers.filter(d => d.free && seen.has(nodeId(d.f, d.tx, d.ty))).length;
  if (want > 0) {
    const cand = doors.filter(d => !d.locked && !(d.f === spawn.f && Math.hypot(d.x - spawn.x, d.z - spawn.z) < 4));
    for (let tries = 0; tries < 60; tries++) {
      shuffle(cand); const pick = cand.slice(0, want); pick.forEach(d => { d.boarded = true; });
      const s2 = floodFrom(spawn.f, sx, sy);
      if (s2.has(tkId) && s2.size <= base.size - 8 && safeCount(s2) >= keyCount + 5) return s2;
      pick.forEach(d => { d.boarded = false; });
    }
  }
  return base;
}

// ---- floor themes: ground = palace hall, first = library, top = ritual floor ----
const BOOKC = [0x7a1a1a, 0x1f3a5a, 0x2f5a2a, 0x5a4a1a, 0x4a2a5a, 0x6a3a1a];
function addFlame(g, x, y, z) {
  const s = sprite(glowTex, 0xffb347, 0.32); s.position.set(x, y, z); s.userData.base = 0.32; s.userData.seed = Math.random() * 6; g.add(s); flames.push(s);
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), basic(0xfff1c0)); f.position.set(x, y - 0.02, z); g.add(f);
}
const DECOR = {
  plant(g) { box(0.3, 0.28, 0.3, mat(0x7a3b22), 0, 0.14, 0, g); for (let k = 0; k < 6; k++) { const a = k * 1.05, l = box(0.06, 0.5, 0.14, mat(k % 2 ? 0x2f5a2a : 0x3b7a35), Math.cos(a) * 0.1, 0.52, Math.sin(a) * 0.1, g); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); } },
  clock(g) { box(0.46, 1.7, 0.3, DWOOD, 0, 0.85, 0, g); box(0.38, 0.38, 0.04, basic(0xe8dcc0), 0, 1.35, 0.16, g); box(0.02, 0.14, 0.02, basic(0x111111), 0, 1.38, 0.185, g); box(0.1, 0.5, 0.04, mat(0x6b4f26), 0, 0.55, 0.16, g); box(0.1, 0.1, 0.05, basic(0xb08a3a), 0, 0.3, 0.17, g); },
  statue(g) { const st = mat(0x8a857d); box(0.5, 0.5, 0.5, mat(0x6e6a64), 0, 0.25, 0, g); box(0.3, 0.7, 0.2, st, 0, 0.85, 0, g); const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), st); h.position.set(0, 1.32, 0); g.add(h); box(0.1, 0.5, 0.1, st, 0.22, 0.95, 0.1, g); },
  banner(g) { box(0.9, 1.5, 0.04, mat(0x7a1a1a), 0, 1.25, 0, g); box(0.9, 0.06, 0.05, mat(0xb08a3a), 0, 2.0, 0.01, g); box(0.5, 0.5, 0.045, mat(0xb08a3a), 0, 1.35, 0.01, g); box(0.3, 0.3, 0.05, mat(0x7a1a1a), 0, 1.35, 0.02, g); },
  shelf(g) {
    box(1.1, 1.8, 0.4, DWOOD, 0, 0.9, -0.02, g);
    for (const yy of [0.25, 0.75, 1.25, 1.72]) box(1.04, 0.04, 0.36, woodMat, 0, yy, 0.02, g);
    for (const yy of [0.27, 0.77, 1.27]) for (let k = 0; k < 7; k++) box(0.06 + Math.random() * 0.04, 0.3 + Math.random() * 0.1, 0.22, mat(BOOKC[Math.floor(Math.random() * BOOKC.length)]), -0.42 + k * 0.14, yy + 0.19, 0.03, g);
  },
  globe(g) { box(0.3, 0.04, 0.3, DWOOD, 0, 0.04, 0, g); box(0.04, 0.55, 0.04, DWOOD, 0, 0.3, 0, g); const gl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(0x2f5a78)); gl.position.set(0, 0.82, 0); g.add(gl); const r = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 6, 20), mat(0xb08a3a)); r.position.set(0, 0.82, 0); r.rotation.x = Math.PI / 2.4; g.add(r); },
  candles(g) { box(0.4, 0.06, 0.4, mat(0x241a12), 0, 0.03, 0, g); [[-0.1, 0, 0.34], [0.12, 0.08, 0.26], [0, -0.1, 0.2]].forEach(c => { box(0.07, c[2], 0.07, mat(0xe8dcc0), c[0], 0.06 + c[2] / 2, c[1], g); addFlame(g, c[0], 0.1 + c[2], c[1]); }); },
  skull(g) {
    box(1.0, 1.3, 0.4, DWOOD, 0, 0.65, -0.02, g); for (const yy of [0.4, 0.85, 1.28]) box(0.96, 0.04, 0.36, woodMat, 0, yy, 0.02, g);
    for (const yy of [0.4, 0.85]) for (const x of [-0.3, 0, 0.3]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mat(0xd8d0bc)); h.position.set(x, yy + 0.1, 0.05); g.add(h); box(0.05, 0.04, 0.05, mat(0xd8d0bc), x, yy + 0.03, 0.06, g);
      for (const e of [-0.03, 0.03]) { const ey = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), basic(0x0a0a0a)); ey.position.set(x + e, yy + 0.105, 0.12); g.add(ey); }
    }
  },
  altar(g) { box(1.1, 0.75, 0.6, mat(0x3a1a1a), 0, 0.375, 0, g); box(1.2, 0.06, 0.7, mat(0x7a1a1a), 0, 0.78, 0, g); [-0.35, 0.35].forEach(x => { box(0.06, 0.28, 0.06, mat(0xe8dcc0), x, 0.95, 0, g); addFlame(g, x, 1.12, 0); }); const bw = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.1, 10), mat(0xb08a3a)); bw.position.set(0, 0.86, 0.05); g.add(bw); },
  stand(g) { box(0.5, 0.05, 0.5, DWOOD, 0, 0.7, 0, g); for (const lx of [-0.2, 0.2]) for (const lz of [-0.2, 0.2]) box(0.05, 0.68, 0.05, DWOOD, lx, 0.34, lz, g); box(0.52, 0.03, 0.52, mat(0x7a1a1a), 0, 0.735, 0, g); },
};
const DECOR_DEPTH = { plant: 0.5, clock: 0.45, statue: 0.6, banner: 0.06, shelf: 0.45, globe: 0.5, candles: 0.4, skull: 0.45, altar: 0.7, stand: 0.55 };
const DECOR_R = { plant: 0.32, clock: 0.3, statue: 0.4, banner: 0, shelf: 0.55, globe: 0.28, candles: 0.22, skull: 0.5, altar: 0.55, stand: 0.3 };
const THEMES = [['plant', 'clock', 'statue', 'banner', 'plant', 'banner'], ['shelf', 'shelf', 'globe', 'plant', 'clock', 'banner'], ['candles', 'skull', 'altar', 'banner', 'candles', 'skull']];
const RUGS = [[0x5a1a1a, 0x3a0f0f], [0x1f3a2a, 0x14261b], [0x2a0b0b, 0x120505]];

function buildDecorAndProps(S, furniture, spawn, tkSpawn) {
  const keep = new Set(), used = new Set();   // keep = tiles that must stay clear (doors, stairs, drawers...)
  const mark = (set, f, x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) set.add(nodeId(f, xx, yy)); } };
  for (const d of drawers) mark(keep, d.f, d.tx, d.ty, 1);
  for (const w of wards) mark(keep, w.f, Math.floor(w.x / TS), Math.floor(w.z / TS), 1);
  for (const o of furniture) mark(keep, o.f, o.tx, o.ty, 1);
  for (const d of doors) mark(keep, d.f, d.tx, d.ty, 1);
  for (const st of stairs) for (const c of st.cells) for (const L of [st.f, st.f + 1]) mark(keep, L, c.x, c.y, 1);
  mark(keep, exitD.f, exitD.tx, exitD.ty, 2);
  mark(keep, eyeCharm.f, Math.floor(eyeCharm.x / TS), Math.floor(eyeCharm.z / TS), 1);
  mark(keep, spawn.f, Math.floor(spawn.x / TS), Math.floor(spawn.z / TS), 1); mark(keep, tkSpawn.f, Math.floor(tkSpawn.x / TS), Math.floor(tkSpawn.z / TS), 1);
  const spots = [[], [], []], rugSpots = [[], [], []];
  for (let f = 0; f < NF; f++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (G[f][y][x] !== 0 || keep.has(nodeId(f, x, y))) continue;
    let open = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && G[f][y + dy][x + dx] === 0) open++;
    const wall4 = DIRS.some(d => G[f][y + d[1]][x + d[0]] === 1);
    if (open >= 5 && wall4) spots[f].push({ x, y }); else if (open === 8) rugSpots[f].push({ x, y });
  }
  for (let f = 0; f < NF; f++) { shuffle(spots[f]); shuffle(rugSpots[f]); }
  const take = (list, f, r) => { while (list[f].length) { const sp = list[f].pop(), id = nodeId(f, sp.x, sp.y); if (used.has(id)) continue; mark(used, f, sp.x, sp.y, r); return sp; } return null; };
  const place = (type, f, spot) => {
    const p = placeAgainstWall(f, spot.x, spot.y, DECOR_DEPTH[type]), g = new THREE.Group();
    g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.fx, p.fz); DECOR[type](g); floors[f].add(g);
    if (DECOR_R[type]) blockers.push({ f, x: p.x, z: p.z, r: DECOR_R[type] });
    return p;
  };
  // throwables on little stands: flower vases and lanterns
  const propTypes = []; for (let i = 0; i < (S.vases || 0); i++) propTypes.push('vase'); for (let i = 0; i < (S.lanterns || 0); i++) propTypes.push('lantern');
  propTypes.forEach((type, i) => { const f = (i + (type === 'lantern' ? 1 : 0)) % NF, sp = take(spots, f, 1); if (!sp) return; const p = place('stand', f, sp); makeProp(type, f, p.x, p.z, 0.75); });
  // themed furniture for each floor
  for (let f = 0; f < NF; f++) for (let k = 0; k < 14; k++) { const sp = take(spots, f, 1); if (!sp) break; place(THEMES[f][Math.floor(Math.random() * THEMES[f].length)], f, sp); }
  // rugs (ground + first floor) and red ritual circles (top floor)
  for (let f = 0; f < NF; f++) for (let k = 0; k < 4; k++) {
    const sp = take(rugSpots, f, 2); if (!sp) break;
    const g = new THREE.Group(); g.position.set(sp.x * TS + TS / 2, 0, sp.y * TS + TS / 2);
    if (f < 2) { g.rotation.y = Math.random() < 0.5 ? 0 : Math.PI / 2; box(2.4, 0.02, 1.5, mat(RUGS[f][0]), 0, 0.012, 0, g); box(2.1, 0.025, 1.2, mat(RUGS[f][1]), 0, 0.016, 0, g); box(1.0, 0.03, 0.5, mat(0xb08a3a), 0, 0.02, 0, g); }
    else { for (const r of [[0.45, 0.55], [0.8, 0.88]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r[0], r[1], 28), basic(0x8a1010, { side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring); } box(0.06, 0.02, 1.5, basic(0x8a1010), 0, 0.02, 0, g); box(1.5, 0.02, 0.06, basic(0x8a1010), 0, 0.02, 0, g); }
    floors[f].add(g);
  }
}

// ---------- LEVEL BUILD ----------
function loadStage(i) {
  const S = CFG.STAGES[i];
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world);
  floors = []; for (let f = 0; f < NF; f++) { const g = new THREE.Group(); g.position.y = f * FH; world.add(g); floors.push(g); }
  G = []; doors = []; drawers = []; wards = []; beds = []; blockers = []; stairs = []; stairMap = new Map(); doorMap = new Map(); lamps = [];
  props = []; thrown = []; flames = [];
  exitD = null; eyeCharm = null;
  let spawn = null, tkSpawn = null; const pillars = [], wallCells = [[], [], []], arrows = new Map(), furniture = [];

  for (let f = 0; f < NF; f++) {
    const rows = flipRows(MAPS[f], S.flip); G.push([]);
    for (let y = 0; y < H; y++) {
      G[f].push([]);
      for (let x = 0; x < W; x++) {
        const ch = rows[y][x] || '#', cx = x * TS + TS / 2, cz = y * TS + TS / 2; let g = 0;
        if (ch === '#') { g = 1; wallCells[f].push({ x: cx, z: cz }); }
        else if (ch === 'O') { g = 1; pillars.push({ f, x: cx, z: cz }); }
        else if (ch === 'D') { g = 2; exitD = { f, tx: x, ty: y, x: cx, z: cz, open: false }; }
        else if (ch === 'd' || ch === 'L') { g = 3; const d = { f, tx: x, ty: y, x: cx, z: cz, locked: ch === 'L', open: false, t: 0 }; doors.push(d); doorMap.set(nodeId(f, x, y), d); }
        else if (ch === 'R' || ch === 'Q') drawers.push({ f, tx: x, ty: y, free: ch === 'R', open: false, t: 0, item: null });
        else if (ch === 'H') wards.push({ f, tx: x, ty: y });
        else if (FURN[ch]) furniture.push({ f, tx: x, ty: y, ch });
        else if (ch === 'P') spawn = { f, x: cx, z: cz };
        else if (ch === 'X') tkSpawn = { f, x: cx, z: cz };
        else if (ch === 'E') eyeCharm = { f, x: cx, z: cz, got: false };
        else if (ARROWS[ch]) { g = 4; arrows.set(f + ',' + x + ',' + y, { f, x, y, ch, dx: ARROWS[ch][0], dz: ARROWS[ch][1] }); }
        else if (ch === 's') g = 4;
        G[f][y].push(g);
      }
    }
  }
  // stairs (2 tiles long, rise one floor); both floors treat the stair tiles as open
  arrows.forEach(a => {
    const prev = arrows.get(a.f + ',' + (a.x - a.dx) + ',' + (a.y - a.dz)); if (prev && prev.ch === a.ch) return;
    const s = { f: a.f, dx: a.dx, dz: a.dz, x: a.x, y: a.y, sx: a.x * TS + TS / 2 - a.dx * TS / 2, sz: a.y * TS + TS / 2 - a.dz * TS / 2, cells: [{ x: a.x, y: a.y }, { x: a.x + a.dx, y: a.y + a.dz }] };
    stairs.push(s);
    for (const c of s.cells) for (const L of [a.f, a.f + 1]) { G[L][c.y][c.x] = 4; stairMap.set(nodeId(L, c.x, c.y), s); }
  });

  const safeReach = chooseBarricades(S, spawn, tkSpawn);   // pick doors to board up (they need the axe)

  // ---- walls, floors, ceilings (instanced = fast on phones) ----
  const m4 = new THREE.Matrix4();
  for (let f = 0; f < NF; f++) {
    const wc = wallCells[f];
    if (wc.length) { const im = new THREE.InstancedMesh(wallGeo, wallMats[f], wc.length); wc.forEach((c, k) => { m4.makeTranslation(c.x, FH / 2, c.z); im.setMatrixAt(k, m4); }); im.instanceMatrix.needsUpdate = true; floors[f].add(im); }
    const fl = [], ce = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (G[f][y][x] === 1) continue;
      const s = stairMap.get(nodeId(f, x, y));
      if (!(s && s.f === f - 1)) fl.push({ x: x * TS + TS / 2, z: y * TS + TS / 2 });
      if (!(s && s.f === f)) ce.push({ x: x * TS + TS / 2, z: y * TS + TS / 2 });
    }
    const imF = new THREE.InstancedMesh(planeGeo, floorMat, fl.length);
    fl.forEach((c, k) => { m4.makeRotationX(-Math.PI / 2); m4.setPosition(c.x, 0, c.z); imF.setMatrixAt(k, m4); }); imF.instanceMatrix.needsUpdate = true; floors[f].add(imF);
    const imC = new THREE.InstancedMesh(planeGeo, ceilMat, ce.length);
    ce.forEach((c, k) => { m4.makeRotationX(Math.PI / 2); m4.setPosition(c.x, FH, c.z); imC.setMatrixAt(k, m4); }); imC.instanceMatrix.needsUpdate = true; floors[f].add(imC);
  }
  // pillars
  const pillarGeo = new THREE.CylinderGeometry(0.32, 0.38, FH, 10);
  for (const p of pillars) {
    const m = new THREE.Mesh(pillarGeo, mat(0x8a6f50)); m.position.set(p.x, FH / 2, p.z); floors[p.f].add(m);
    box(0.95, 0.18, 0.95, mat(0xb08a3a), p.x, 0.09, p.z, floors[p.f]); box(0.95, 0.18, 0.95, mat(0xb08a3a), p.x, FH - 0.09, p.z, floors[p.f]);
  }
  // stairs: a set of steps (the invisible ramp under them is what you walk on)
  for (const s of stairs) {
    for (let k = 0; k < 8; k++) {
      const h = (k + 0.5) * (FH / 8), px = s.sx + s.dx * (k + 0.5) * (2 * TS / 8), pz = s.sz + s.dz * (k + 0.5) * (2 * TS / 8);
      const alongX = s.dx !== 0;
      box(alongX ? 2 * TS / 8 : TS - 0.15, h, alongX ? TS - 0.15 : 2 * TS / 8, woodMat, px, h / 2, pz, floors[s.f]);
    }
  }
  // doors (swing open with the USE button)
  for (const d of doors) {
    d.axis = (G[d.f][d.ty][d.tx - 1] === 1 && G[d.f][d.ty][d.tx + 1] === 1) ? 'x' : 'z';
    const w = TS - 0.6;
    const pivot = new THREE.Group();
    if (d.axis === 'x') { pivot.position.set(d.x - w / 2, 0, d.z); d.base = 0; } else { pivot.position.set(d.x, 0, d.z - w / 2); d.base = -Math.PI / 2; }
    pivot.rotation.y = d.base;
    box(w, 1.95, 0.12, mat(0x442715), w / 2, 0.975, 0, pivot);
    box(w - 0.26, 1.64, 0.14, woodMat, w / 2, 0.97, 0, pivot);
    box(w - 0.44, 0.46, 0.16, mat(0x38200f), w / 2, 1.44, 0, pivot);
    box(0.06, 0.06, 0.16, basic(0xd9b44a), w - 0.14, 0.97, 0, pivot);
    d.lockMesh = box(0.18, 0.18, 0.18, basic(0xb3121b), w - 0.26, 0.97, 0, pivot); d.lockMesh.visible = d.locked;
    floors[d.f].add(pivot); d.pivot = pivot;
    if (d.boarded) {   // nailed planks across the doorway
      const bg = new THREE.Group(); bg.position.set(d.x, 0, d.z); bg.rotation.y = d.axis === 'x' ? 0 : Math.PI / 2;
      [[0.45, 0.05], [0.95, -0.06], [1.45, 0.04]].forEach(a => { const b = box(TS - 0.3, 0.2, 0.07, mat(0x6b4a2a), 0, a[0], 0.12, bg); b.rotation.z = a[1]; });
      d.boards = bg; floors[d.f].add(bg);
    }
    // stone frame: two posts shrink the opening to a normal door width
    const fw = (TS - w) / 2;
    if (d.axis === 'x') {
      box(fw, 1.95, 0.4, wallMats[d.f], d.x - w / 2 - fw / 2, 0.975, d.z, floors[d.f]);
      box(fw, 1.95, 0.4, wallMats[d.f], d.x + w / 2 + fw / 2, 0.975, d.z, floors[d.f]);
      box(TS, FH - 1.95, 0.4, wallMats[d.f], d.x, 1.95 + (FH - 1.95) / 2, d.z, floors[d.f]);
    } else {
      box(0.4, 1.95, fw, wallMats[d.f], d.x, 0.975, d.z - w / 2 - fw / 2, floors[d.f]);
      box(0.4, 1.95, fw, wallMats[d.f], d.x, 0.975, d.z + w / 2 + fw / 2, floors[d.f]);
      box(0.4, FH - 1.95, TS, wallMats[d.f], d.x, 1.95 + (FH - 1.95) / 2, d.z, floors[d.f]);
    }
  }
  // drawers
  const knobGeo = new THREE.SphereGeometry(0.038, 8, 8), knobMat = mat(0xc9a04a);
  for (const dr of drawers) {
    const p = placeAgainstWall(dr.f, dr.tx, dr.ty, 0.66); Object.assign(dr, p);
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.fx, p.fz);
    box(1.16, 0.94, 0.6, woodMat, 0, 0.47, 0, g); box(1.26, 0.06, 0.68, mat(0x3a2410), 0, 0.96, 0, g);
    for (const yy of [0.26, 0.54]) {
      box(1.0, 0.22, 0.04, mat(0x7a5230), 0, yy, 0.31, g);
      for (const kx of [-0.24, 0.24]) { const kn = new THREE.Mesh(knobGeo, knobMat); kn.position.set(kx, yy, 0.34); g.add(kn); }
    }
    const slide = new THREE.Group(); slide.position.set(0, 0.76, 0.08); g.add(slide);
    box(1.06, 0.22, 0.04, mat(0x8a6038), 0, 0, 0.31, slide);
    for (const kx of [-0.24, 0.24]) { const kn = new THREE.Mesh(knobGeo, knobMat); kn.position.set(kx, 0, 0.34); slide.add(kn); }
    box(0.95, 0.12, 0.55, mat(0x1c120a), 0, -0.03, 0.04, slide);
    dr.slide = slide; dr.glow = sprite(glowTex, 0xffd24a, 1.0); dr.glow.position.set(0, 0.12, 0.24); dr.glow.visible = false; slide.add(dr.glow);
    floors[dr.f].add(g); blockers.push({ f: dr.f, x: p.x, z: p.z, r: 0.55 });
  }
  // almirahs (hide inside)
  wards = wards.map(w => {
    const p = placeAgainstWall(w.f, w.tx, w.ty, 0.62); const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.fx, p.fz);
    box(1.12, 1.9, 0.56, wardBodyMat, 0, 0.95, 0, g);                 // body
    box(1.24, 0.1, 0.66, wardDoorMat, 0, 1.93, 0, g);                 // cornice
    box(1.16, 0.05, 0.6, wardDoorMat, 0, 1.86, 0, g);                 // cornice step
    box(1.24, 0.14, 0.66, mat(0x23150a), 0, 0.07, 0, g);              // plinth
    box(0.06, 1.62, 0.04, wardDoorMat, -0.52, 0.95, 0.29, g);         // fluted stiles
    box(0.06, 1.62, 0.04, wardDoorMat, 0.52, 0.95, 0.29, g);
    for (const sx of [-0.28, 0.28]) {                                  // two panel doors
      box(0.48, 1.6, 0.05, wardDoorMat, sx, 0.97, 0.29, g);
      box(0.34, 0.52, 0.03, wardBodyMat, sx, 1.5, 0.315, g);
      box(0.22, 0.34, 0.02, wardDoorMat, sx, 1.5, 0.325, g);
      box(0.34, 0.6, 0.03, wardBodyMat, sx, 0.72, 0.315, g);
      box(0.22, 0.4, 0.02, wardDoorMat, sx, 0.72, 0.325, g);
      box(0.2, 0.05, 0.02, mat(0x3a2410), sx, 1.5, 0.33, g);
      box(0.2, 0.05, 0.02, mat(0x3a2410), sx, 0.72, 0.33, g);
      box(0.04, 0.12, 0.04, mat(0xa8893c), sx + (sx < 0 ? 0.17 : -0.17), 0.99, 0.32, g); // knob
    }
    box(0.02, 1.62, 0.02, mat(0x23150a), 0, 0.97, 0.3, g);            // centre seam
    const esc = new THREE.Mesh(new THREE.CircleGeometry(0.055, 8), mat(0xa8893c)); // brass escutcheon
    esc.position.set(0, 1.06, 0.33); g.add(esc);
    floors[w.f].add(g); blockers.push({ f: w.f, x: p.x, z: p.z, r: 0.62 });
    return { f: w.f, x: p.x, z: p.z, fx: p.fx, fz: p.fz, under: false };
  });
  // haunted-mansion furniture from the map (sofas, beds, mirrors, eye paintings, sheets, lamps)
  buildFurniture(furniture);
  buildDecorAndProps(S, furniture, spawn, tkSpawn);   // floor themes, rugs, vases, lanterns
  // exit gate (sealed until all gate parts are found)
  { const g = new THREE.Group(); g.position.set(exitD.x, 0, exitD.z);
    exitD.mesh = box(TS - 0.2, FH - 0.1, TS - 0.2, mat(0x2a1c14), 0, FH / 2, 0, g);
    for (const yy of [0.75, 1.65]) box(TS - 0.16, 0.1, TS - 0.16, mat(0x4a3320), 0, yy, 0, g);   // iron bands
    box(0.1, FH - 0.2, TS - 0.16, mat(0x4a3320), 0, FH / 2, 0, g);                               // centre strap
    const sealGeo = new THREE.CircleGeometry(0.2, 12);
    exitD.seals = [];
    for (const zf of [1, -1]) for (const a of [[-0.45, 1.2], [0.45, 1.2], [-0.45, 0.35], [0.45, 0.35]]) {
      const s = new THREE.Mesh(sealGeo, basic(0xc0201a)); s.position.set(a[0], a[1], zf * (TS / 2 - 0.03)); s.rotation.y = zf > 0 ? 0 : Math.PI; g.add(s); exitD.seals.push(s);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 14), basic(0xff6a3a)); ring.position.copy(s.position); ring.rotation.copy(s.rotation); g.add(ring); exitD.seals.push(ring);
    }
    floors[exitD.f].add(g); exitLight.intensity = 0; exitLight.position.set(exitD.x, 2, exitD.z); }
  // eye charm
  { const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.44), basic(0xffffff, { map: eyeTex, transparent: true, side: THREE.DoubleSide })));
    g.add(sprite(glowTex, 0x40b8ff, 2.8)); g.position.set(eyeCharm.x, 1.2, eyeCharm.z); floors[eyeCharm.f].add(g); eyeCharm.mesh = g; }

  // ---- hide items in the drawers (random every game) ----
  const need = S.parts, keyCount = doors.filter(d => d.locked).length, barCount = doors.filter(d => d.boarded).length;
  const safeD = shuffle(drawers.filter(d => d.free && safeReach.has(nodeId(d.f, d.tx, d.ty))));
  for (let k = 0; k < keyCount && safeD.length; k++) safeD.pop().item = { type: 'key' };        // keys and the axe are never locked away
  if (barCount && safeD.length) safeD.pop().item = { type: 'axe' };
  const rest = shuffle(drawers.filter(d => !d.item));
  for (let k = 0; k < need; k++) rest.pop().item = { type: 'part', name: PART_NAMES[k] };
  for (let k = 0; k < S.foods; k++) rest.pop().item = { type: 'food', name: FOOD_NAMES[k % FOOD_NAMES.length] };
  for (let k = 0; k < (S.holy || 0) && rest.length; k++) rest.pop().item = { type: 'holy' };

  player = { x: spawn.x, z: spawn.z, fl: spawn.f, r: 0.3, inv: 0, hidden: null, crouch: false };
  tk = { x: tkSpawn.x, z: tkSpawn.z, fl: tkSpawn.f, r: 0.34, dir: 0, state: 'patrol', target: null, path: [], repath: 0, lost: 0, stun: 0, searchT: 0, findT: 0, sp: S.sp };
  inv = { parts: 0, need, keys: 0, axe: false };
  eye = { state: 'locked', time: 0 }; msgs = [];
  carry = null; setCarryVisual(null); hintWas = false; burstR = 8; pingT = 0; yaw = 0; pitch = 0; crouchToggle = false; camH = 1.6; burst = 0; noiseNow = 0; camY = 1.6;
  msg(S.name, 4); msg('Find the gate parts in the drawers! Walk into the light of the lamps.', 6);
  const stamp = world; setTimeout(() => { if (state === 'play' && world === stamp) msg('If the Tantrik comes, press E at an almirah or bed to hide.', 6); }, 6500);
}

// ---------- ACTIONS ----------
function openDoor(d, open, byTantrik) {
  d.open = open; G[d.f][d.ty][d.tx] = open ? 0 : 3;
  SFX.door(open);
  if (!byTantrik) burst = Math.max(burst, 0.45);
}
function takeItem(dr) {
  const it = dr.item; if (!it) return;
  if (it.type === 'part') { inv.parts++; msg(`Found: ${it.name} (${inv.parts}/${inv.need})`, 4); SFX.pickup(); dr.item = null;
    if (inv.parts >= inv.need) { exitD.open = true; G[exitD.f][exitD.ty][exitD.tx] = 0; exitD.mesh.material = basic(0x55ff99, { transparent: true, opacity: 0.35 }); exitD.seals.forEach(s => { s.visible = false; }); exitLight.intensity = 1.6; msg('The gate is repaired! Run to the front gate (ground floor)!', 6); } }
  else if (it.type === 'key') { inv.keys++; msg('Found a brass key! It opens a locked door.', 4); SFX.key(); dr.item = null; }
  else if (it.type === 'axe') { inv.axe = true; msg('Found an AXE! Use it on boarded-up doors.', 5); SFX.pickup(); dr.item = null; }
  else if (it.type === 'holy') {
    if (carry) { msg('Your hands are full. Press F to drop what you hold, then take it.', 4); }
    else { carry = { type: 'holy' }; setCarryVisual('holy'); msg('Found holy water! Throw it (G) at the Tantrik to stun him.', 5); SFX.pickup(); dr.item = null; }
  }
  else if (it.type === 'food') {
    if (hp < CFG.HP) { hp++; msg(`You ate a ${it.name}. +1 heart`, 4); SFX.pickup(); dr.item = null; }
    else msg(`A ${it.name}. You are not hungry, come back when hurt.`, 4);
  }
  dr.glow.visible = !!dr.item;
}
function findTarget() {
  const p = player;
  if (p.hidden) return { type: 'unhide', label: IS_TOUCH ? 'Tap OUT to leave' : 'Press E to come out', short: 'OUT' };
  let best = null, bd = 1e9; const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const consider = (type, ref, x, z, range, label, short) => {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d > range) return;
    if (d > 1.0 && (dx * fx + dz * fz) / (d || 1) < 0.35) return;
    if (d < bd) { bd = d; best = { type, ref, label, short }; }
  };
  const k = IS_TOUCH ? 'Tap ' : 'Press E to ';
  for (const d of doors) if (d.f === p.fl) {
    if (d.boarded) { consider('door', d, d.x, d.z, 2.0, inv.axe ? k + 'chop the boards (axe)' : 'Boarded up - you need an axe', inv.axe ? 'CHOP' : 'OPEN'); continue; }
    const lab = d.locked ? (inv.keys > 0 ? 'unlock the door (use key)' : 'Locked door - find a key') : (d.open ? 'close the door' : 'open the door');
    consider('door', d, d.x, d.z, 2.0, d.locked && inv.keys === 0 ? lab : k + lab, d.locked ? 'UNLOCK' : (d.open ? 'CLOSE' : 'OPEN'));
  }
  for (const dr of drawers) if (dr.f === p.fl) {
    const lab = !dr.open ? 'open the drawer' : (dr.item ? 'take the ' + (dr.item.type === 'food' ? dr.item.name : 'item') : 'close the drawer');
    consider('drawer', dr, dr.x + dr.fx * 0.4, dr.z + dr.fz * 0.4, 1.7, k + lab, !dr.open ? 'OPEN' : (dr.item ? 'TAKE' : 'CLOSE'));
  }
  for (const w of wards) if (w.f === p.fl) consider('ward', w, w.x + w.fx * 0.6, w.z + w.fz * 0.6, 1.7, k + 'hide in the almirah', 'HIDE');
  for (const b of beds) if (b.f === p.fl) consider('bed', b, b.x + b.fx * 0.6, b.z + b.fz * 0.6, 1.7, k + 'hide under the bed', 'HIDE');
  if (!carry) for (const pr of props) if (pr.f === p.fl) consider('prop', pr, pr.x, pr.z, 1.7, k + 'pick up the ' + CARRY_NAMES[pr.type], 'TAKE');
  return best;
}
function interact() {
  if (state !== 'play') return;
  const t = findTarget(); if (!t) return;
  if (t.type === 'unhide') {
    const w = player.hidden; player.x = w.x + w.fx * 1.05; player.z = w.z + w.fz * 1.05; player.hidden = null;
    if (hitWall(player, false)) { player.x = w.x; player.z = w.z; } return;
  }
  if (t.type === 'prop') { pickProp(t.ref); return; }
  if (t.type === 'ward' || t.type === 'bed') { const w = t.ref; player.hidden = w; player.x = w.x; player.z = w.z; hideYaw = Math.atan2(-w.fx, -w.fz); yaw = hideYaw; pitch = 0; SFX.hide(); return; }
  if (t.type === 'door') {
    const d = t.ref;
    if (d.boarded) { chopDoor(d); return; }
    if (d.locked) { if (inv.keys > 0) { inv.keys--; d.locked = false; d.lockMesh.visible = false; openDoor(d, true); msg('Unlocked!', 2); SFX.unlock(); } else msg('Locked. Find a key in a drawer.', 3); return; }
    if (d.open) { if (Math.hypot(d.x - player.x, d.z - player.z) < 1.1 || (Math.hypot(d.x - tk.x, d.z - tk.z) < 1.1 && tk.fl === d.f)) { msg('Something is in the way.', 2); return; } openDoor(d, false); }
    else openDoor(d, true);
    return;
  }
  if (t.type === 'drawer') {
    const dr = t.ref;
    if (!dr.open) { dr.open = true; SFX.drawer(true); burst = Math.max(burst, 0.3);
      if (dr.item) { dr.glow.visible = true; takeItem(dr); } else msg(EMPTY_MSGS[Math.floor(Math.random() * EMPTY_MSGS.length)], 2); }
    else if (dr.item) takeItem(dr);
    else { dr.open = false; SFX.drawer(false); }
  }
}
function useEye() {
  if (state !== 'play') return;
  if (eye.state === 'ready') { eye.state = 'active'; eye.time = CFG.EYE_SECONDS; msg('The Eye is open. You can see the Tantrik!', 4); SFX.eyeOn(); }
  else if (eye.state === 'locked') msg('Find the blue Eye charm first (try the first floor).', 3);
  else if (eye.state === 'used') msg('The Eye has closed.', 3);
}
function toggleCrouch() { crouchToggle = !crouchToggle; }
function toggleView() { thirdPerson = !thirdPerson; msg(thirdPerson ? 'Third-person view (V to switch back)' : 'First-person view', 2); }

// ---------- GAME FLOW (menu / pause / restart) ----------
function lockPtr() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
function unlockPtr() { try { if (document.exitPointerLock) document.exitPointerLock(); } catch (e) {} }
function goFull() {
  try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
}
function beginStage(i, freshHp) {
  stageIdx = i; if (freshHp) hp = CFG.HP;
  loadStage(i); state = 'play'; $('screen').style.display = 'none';
  Object.keys(keys).forEach(k => { keys[k] = false; });
  if (!IS_TOUCH) lockPtr();
}
function pauseGame() { if (state !== 'play') return; state = 'paused'; unlockPtr(); showScreen('pause'); }
function resumeGame() { if (state !== 'paused') return; state = 'play'; $('screen').style.display = 'none'; if (!IS_TOUCH) lockPtr(); }
function exitGame() {
  state = 'exit'; unlockPtr();
  try { if (ac) ac.suspend(); } catch (e) {}
  try { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) {}
  try { const A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; if (A && A.exitApp) { A.exitApp(); return; } } catch (e) {}
  try { window.close(); } catch (e) {}
  setTimeout(() => {
    const s = $('screen'); s.style.display = 'flex';
    s.innerHTML = `<h1 style="color:#ddd">Game closed</h1><p>Sound is off. You can close this tab now.</p>${`<button id="bExitClose" class="alt">CLOSE TAB (Ctrl+W)</button>`}`;
    const b = $('bExitClose'); if (b) b.addEventListener('click', () => { try { window.close(); } catch (e) {} });
  }, 250);
}
function showScreen(kind) {
  const s = $('screen'); s.style.display = 'flex'; if (kind !== 'pause') unlockPtr();
  const B = (id, t, alt) => `<button id="${id}"${alt ? ' class="alt"' : ''}>${t}</button>`;
  if (kind === 'menu') s.innerHTML = `<h1>NANI vs TANTRIK 3D</h1>
    <p>The Tantrik has trapped you in his old palace.</p>
    <p>Search the drawers on all 3 floors for the <b>gate parts</b>, <b>keys</b> and <b>food</b>. Repair the front gate and escape!</p>
    <p>You have <b>4 hearts</b>. If he catches you, you lose one heart and he walks away. Hide inside an <b>almirah</b> or under a <b>bed</b> until he leaves!</p><br>
    <p>${IS_TOUCH ? 'Left thumb: move (push to the edge to run) &bull; Right thumb: look<br>USE button: open doors, drawers, hide &bull; CROUCH: stay silent' :
      'WASD move &bull; Mouse look &bull; Shift run (loud) &bull; C crouch (silent)<br>E open doors / drawers / hide &bull; Q Eye &bull; Esc or P pause'}</p>
    <p>Find the blue <b>EYE charm</b>, then use the EYE button to see the Tantrik through walls for 2 minutes.</p>
    <p>Pick up <b>vases</b> and <b>lanterns</b> and <b>throw</b> them (G) to lure the Tantrik away. Find the <b>axe</b> to chop boarded doors. <b>Holy water</b> stuns him!</p>${B('bPlay', 'PLAY')}${B('bExit', 'EXIT', 1)}`;
  if (kind === 'pause') s.innerHTML = `<h1 style="color:#ddd">PAUSED</h1><p>${CFG.STAGES[stageIdx].name}</p>${B('bResume', 'RESUME')}${B('bRestartStage', 'RESTART STAGE', 1)}${B('bRestartGame', 'RESTART GAME', 1)}${B('bMenu', 'MAIN MENU', 1)}${B('bExit', 'EXIT', 1)}`;
  if (kind === 'stagewin') s.innerHTML = `<h1 style="color:#6dff9f">You escaped!</h1><p>${CFG.STAGES[stageIdx].name} complete.</p>${B('bNext', 'NEXT STAGE')}${B('bMenu', 'MAIN MENU', 1)}`;
  if (kind === 'dead') s.innerHTML = `<h1>The Tantrik caught you...</h1>${B('bRestartStage', 'TRY THIS STAGE AGAIN')}${B('bRestartGame', 'RESTART GAME', 1)}${B('bMenu', 'MAIN MENU', 1)}`;
  if (kind === 'win') s.innerHTML = `<h1 style="color:#6dff9f">FREEDOM!</h1><p>Nani escaped the palace for good.</p>${B('bRestartGame', 'PLAY AGAIN')}${B('bMenu', 'MAIN MENU', 1)}`;
  const on = (id, fn) => { const b = $(id); if (b) b.addEventListener('click', fn); };
  on('bPlay', () => { audio(); drone(); goFull(); beginStage(0, true); });
  on('bResume', () => { audio(); resumeGame(); });
  on('bRestartStage', () => { audio(); beginStage(stageIdx, true); });
  on('bRestartGame', () => { audio(); beginStage(0, true); });
  on('bMenu', () => { state = 'menu'; loadStage(0); showScreen('menu'); });
  on('bExit', exitGame);
  on('bNext', () => { audio(); if (stageIdx + 1 >= CFG.STAGES.length) { state = 'win'; showScreen('win'); } else { hp = Math.min(CFG.HP, hp + 1); beginStage(stageIdx + 1, false); } });
}

// ---------- INPUT ----------
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyP') { if (state === 'play') pauseGame(); else if (state === 'paused') resumeGame(); }
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyQ') useEye();
  if (e.code === 'KeyC') toggleCrouch();
  if (e.code === 'KeyV') toggleView();
  if (e.code === 'KeyG') throwCarry(true);
  if (e.code === 'KeyF') throwCarry(false);
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas && state === 'play') look(e.movementX * 0.0023, e.movementY * 0.0023); });
document.addEventListener('pointerlockchange', () => { if (!IS_TOUCH && document.pointerLockElement !== canvas && state === 'play') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
canvas.addEventListener('click', () => { if (!IS_TOUCH && state === 'play' && document.pointerLockElement !== canvas) lockPtr(); });
function look(dx, dy) {
  yaw -= dx; pitch = Math.max(-1.2, Math.min(1.2, pitch - dy));
  if (player.hidden) yaw = Math.max(hideYaw - 0.9, Math.min(hideYaw + 0.9, yaw));
}
$('eye').addEventListener('click', () => { audio(); useEye(); });
$('bUse').addEventListener('click', interact);
$('bCrouch').addEventListener('click', toggleCrouch);
$('bView').addEventListener('click', toggleView);
{ const bt = $('bThrow'), bd = $('bDrop'); if (bt) bt.addEventListener('click', () => throwCarry(true)); if (bd) bd.addEventListener('click', () => throwCarry(false)); }
$('pauseBtn').addEventListener('click', pauseGame);

// touch: left side = joystick, right side = look around
let joyId = null, lookId = null, joyO = { x: 0, y: 0 }, lookL = { x: 0, y: 0 };
addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || state !== 'play' || e.target.closest('button')) return;
  if (e.clientX < innerWidth * 0.45 && joyId === null) {
    joyId = e.pointerId; joyO = { x: e.clientX, y: e.clientY };
    const j = $('joy'); j.style.display = 'block'; j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; $('knob').style.transform = 'translate(0,0)';
  } else if (lookId === null) { lookId = e.pointerId; lookL = { x: e.clientX, y: e.clientY }; }
});
addEventListener('pointermove', e => {
  if (e.pointerId === joyId) {
    let dx = e.clientX - joyO.x, dy = e.clientY - joyO.y; const l = Math.hypot(dx, dy), max = 55;
    if (l > max) { dx = dx / l * max; dy = dy / l * max; }
    mv.x = dx / max; mv.y = -dy / max; $('knob').style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId === lookId) { look((e.clientX - lookL.x) * 0.0055, (e.clientY - lookL.y) * 0.0055); lookL = { x: e.clientX, y: e.clientY }; }
});
function endPtr(e) {
  if (e.pointerId === joyId) { joyId = null; mv.x = mv.y = 0; $('joy').style.display = 'none'; }
  if (e.pointerId === lookId) lookId = null;
}
addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
document.addEventListener('contextmenu', e => e.preventDefault());

function hurt() {
  if (player.inv > 0) return;
  hp--; player.inv = 2.5; tk.stun = 1.6; shake = 0.45; SFX.hurt();
  const f = $('flash'); f.style.transition = 'none'; f.style.opacity = '0.7'; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = '0'; });
  if (player.hidden) { const w = player.hidden; player.hidden = null; player.x = w.x + w.fx * 1.05; player.z = w.z + w.fz * 1.05; }
  const a = Math.atan2(player.z - tk.z, player.x - tk.x);
  for (let i = 0; i < 10; i++) moveEnt(player, Math.cos(a) * 0.3, Math.sin(a) * 0.3, true);
  if (hp <= 0) { state = 'dead'; showScreen('dead'); }
}

// ---------- UPDATE ----------
function update(dt) {
  time += dt; const p = player;
  { const E = CFG.MAP_PING_EVERY, before = pingT % E; pingT += dt; if (pingT >= E && pingT % E < before) SFX.scan(); }   // minimap scan timer
  { const HE = CFG.HINT_EVERY, on = pingT >= HE - CFG.HINT_SHOW && pingT % HE >= HE - CFG.HINT_SHOW; if (on && !hintWas) SFX.hint(); hintWas = on; }
  let ix = mv.x + ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
  let iy = mv.y + ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0);
  const mag = Math.hypot(ix, iy); if (mag > 1) { ix /= mag; iy /= mag; }
  if (p.hidden) ix = iy = 0;
  p.crouch = crouchToggle; $('bCrouch').classList.toggle('on', crouchToggle);
  const run = !p.crouch && (keys.ShiftLeft || keys.ShiftRight || (IS_TOUCH && Math.hypot(ix, iy) > 0.9));
  const sp = p.crouch ? CFG.CROUCH : run ? CFG.RUN : CFG.WALK;
  const moving = Math.hypot(ix, iy) > 0.1;
  if (moving) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const sc = sp * dt * (IS_TOUCH ? Math.min(1, Math.hypot(ix, iy) * 1.3) : 1);
    moveEnt(p, (fx * iy + rx * ix) * sc, (fz * iy + rz * ix) * sc, true);
    bobT += dt * (run ? 11 : 7);
  }
  burst = Math.max(0, burst - dt); if (burst <= 0) burstR = 8;
  gateMsgT = Math.max(0, gateMsgT - dt);
  if (!exitD.open && p.fl === exitD.f && Math.hypot(exitD.x - p.x, exitD.z - p.z) < 2.0 && gateMsgT <= 0) {
    gateMsgT = 8; msg(`The gate is sealed. Gate parts found: ${inv.parts}/${inv.need}.`, 4);
  }
  noiseNow = p.hidden ? 0 : Math.max(burst > 0 ? burstR : 0, moving ? (p.crouch ? 0 : run ? CFG.NOISE_RUN : CFG.NOISE_WALK) : 0);
  p.inv = Math.max(0, p.inv - dt);

  if (eyeCharm && !eyeCharm.got && eyeCharm.f === p.fl && Math.hypot(eyeCharm.x - p.x, eyeCharm.z - p.z) < 1.0) {
    eyeCharm.got = true; eyeCharm.mesh.visible = false; eye.state = 'ready'; SFX.charm(); msg('You found the Eye charm! Tap the EYE button' + (IS_TOUCH ? '' : ' (or Q)') + '.', 5);
  }
  if (exitD.open && p.fl === 0 && Math.hypot(exitD.x - p.x, exitD.z - p.z) < 2.0) { state = 'stagewin'; SFX.win(); showScreen('stagewin'); return; }
  if (eye.state === 'active') { eye.time -= dt; if (eye.time <= 0) { eye.state = 'used'; msg('The Eye closes...', 3); } }

  for (const d of doors) { const target = d.open ? 1 : 0; d.t += Math.sign(target - d.t) * Math.min(Math.abs(target - d.t), dt * 2.6); d.pivot.rotation.y = d.base + d.t * Math.PI / 2; }
  for (const dr of drawers) { const target = dr.open ? 1 : 0; dr.t += Math.sign(target - dr.t) * Math.min(Math.abs(target - dr.t), dt * 3); dr.slide.position.z = 0.08 + dr.t * 0.32; }

  updateTantrik(dt);
  updateThrown(dt);
  for (const m of msgs) m.s -= dt; msgs = msgs.filter(m => m.s > 0);
  shake = Math.max(0, shake - dt);
}

function updateTantrik(dt) {
  const t = tk, p = player;
  if (t.stun > 0) { t.stun -= dt; return; }
  const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz), same = t.fl === p.fl;
  const range = (p.crouch ? CFG.SIGHT_CROUCH : CFG.SIGHT) * (carry && carry.type === 'lantern' ? 1.35 : 1);   // a lit lantern makes you easier to see
  const inCone = d < 4 || (Math.cos(t.dir) * dx + Math.sin(t.dir) * dz) / (d || 1) > 0.35 || t.state === 'chase';
  const sees = same && !p.hidden && d < range && inCone && los(t.fl, t.x, t.z, p.x, p.z);

  // the Tantrik opens closed doors in his way
  for (const dd of doors) if (dd.f === t.fl && !dd.open && !dd.locked && !dd.boarded && Math.hypot(dd.x - t.x, dd.z - t.z) < 1.9) { openDoor(dd, true, true); }

  if (sees) { if (t.state !== 'chase') SFX.alert(); t.state = 'chase'; t.target = { f: p.fl, x: p.x, z: p.z }; t.lost = 0; }
  else if (t.state === 'chase') { t.lost += dt; if (t.lost > 3.5) { t.state = 'search'; t.searchT = 4; } }
  if (t.state !== 'chase' && (same ? d : d + 10) < noiseNow) { t.state = 'search'; t.target = { f: p.fl, x: p.x, z: p.z }; t.searchT = 5; t.path = []; }

  if (p.hidden) { if (same && d < 1.9) { t.findT += dt; if (t.findT > 4.2) { t.findT = 0; hurt(); return; } } else t.findT = 0; }
  if (!p.hidden && Math.abs(heightOf(t) - heightOf(p)) < 1.8 && d < 1.0) { hurt(); return; }

  const sp = t.state === 'chase' ? t.sp[1] : t.sp[0];
  if (t.state === 'patrol' && (!t.target || (t.target.f === t.fl && Math.hypot(t.target.x - t.x, t.target.z - t.z) < 0.9))) { t.target = randomSpot(p.fl); t.path = []; }
  if (t.state === 'search' && t.target && t.target.f === t.fl && Math.hypot(t.target.x - t.x, t.target.z - t.z) < 1.0) {
    t.searchT -= dt; if (t.searchT <= 0) { t.state = 'patrol'; t.target = null; } t.dir += dt * 1.8; return;
  }
  if (!t.target) return;

  const step = (tx, tz) => {
    const a = Math.atan2(tz - t.z, tx - t.x); t.dir = a; moveEnt(t, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, false);
    stepT -= dt; if (stepT <= 0 && d < 14) { stepT = t.state === 'chase' ? 0.3 : 0.55; SFX.step(d); }
  };
  if (sees && d < 7 && same) { step(p.x, p.z); return; }
  t.repath -= dt;
  if (t.repath <= 0 || !t.path.length) {
    t.repath = 0.35;
    t.path = bfs3(t.fl, Math.floor(t.x / TS), Math.floor(t.z / TS), t.target.f, Math.floor(t.target.x / TS), Math.floor(t.target.z / TS));
    if (!t.path.length && t.state !== 'chase') { t.state = 'patrol'; t.target = null; return; }   // unreachable target: give up instead of pushing into a wall
  }
  const wp = id => { const r = id % (W * H); return { x: (r % W) * TS + TS / 2, z: Math.floor(r / W) * TS + TS / 2 }; };
  while (t.path.length) { const w = wp(t.path[0]); if (Math.hypot(w.x - t.x, w.z - t.z) < 0.5) t.path.shift(); else break; }
  if (t.path.length) { const w = wp(t.path[0]); step(w.x, w.z); }
  else if (t.target && t.target.f === t.fl) step(t.target.x, t.target.z);
}

// ---------- RENDER / HUD ----------
const mini = $('mini'), mg = mini.getContext('2d');
function drawHints(p) {   // blinking K / F / A on the drawers that still hold a key, food or the axe
  const blink = 0.45 + 0.55 * Math.abs(Math.sin(time * 6)), up = {}, down = {};
  const SYM = { key: ['K', '#ffd24a'], food: ['F', '#7dff7d'], axe: ['A', '#6fe0ff'] };
  mg.font = 'bold 8px Georgia'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
  for (const dr of drawers) {
    if (!dr.item) continue; const sy = SYM[dr.item.type]; if (!sy) continue;
    if (dr.f === p.fl) { const x = dr.x / TS * 6, y = dr.z / TS * 6; mg.globalAlpha = blink; mg.fillStyle = sy[1]; mg.beginPath(); mg.arc(x, y, 5, 0, 7); mg.fill(); mg.globalAlpha = 1; mg.fillStyle = '#000'; mg.fillText(sy[0], x, y + 0.5); }
    else (dr.f > p.fl ? up : down)[sy[0]] = true;
  }
  let t = ''; for (const L of ['K', 'F', 'A']) { if (up[L]) t += L + '\u25B2 '; if (down[L]) t += L + '\u25BC '; }
  if (t) { mg.fillStyle = 'rgba(0,0,0,.6)'; mg.fillRect(0, 84, 144, 12); mg.fillStyle = '#ffd24a'; mg.textAlign = 'left'; mg.textBaseline = 'top'; mg.font = 'bold 9px Georgia'; mg.fillText(t, 3, 85); }
  mg.textAlign = 'left'; mg.textBaseline = 'top';
}
function drawMinimap(p) {
  const s = 6;
  mg.clearRect(0, 0, 144, 96);
  mg.fillStyle = 'rgba(6,5,8,.55)'; mg.fillRect(0, 0, 144, 96);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = G[p.fl][y][x];
    if (v === 1) { mg.fillStyle = '#4a423c'; mg.fillRect(x * s, y * s, s, s); }
    else if (v === 2) { mg.fillStyle = exitD.open ? '#55ff99' : '#a3231d'; mg.fillRect(x * s, y * s, s, s); }
    else if (v === 3) { const d = doorMap.get(nodeId(p.fl, x, y)); mg.fillStyle = (d && d.open) ? '#8d7a55' : (d && d.boarded ? '#5a2e12' : (d && d.locked ? '#c8402f' : '#8a6a3a')); mg.fillRect(x * s, y * s, s, s); }
    else if (v === 4) { mg.fillStyle = '#d9b44a'; mg.fillRect(x * s, y * s, s, s); }
  }
  const px = (p.x / TS) * s, py = (p.z / TS) * s;
  mg.strokeStyle = '#7ad4ff'; mg.lineWidth = 1.5; mg.beginPath(); mg.moveTo(px, py);
  mg.lineTo(px - Math.sin(yaw) * 6, py - Math.cos(yaw) * 6); mg.stroke();
  mg.fillStyle = '#fff'; mg.beginPath(); mg.arc(px, py, 2.6, 0, 7); mg.fill();
  // the Tantrik: orange dot only during a scan (3s every 10s) or while the Eye is open
  const E = CFG.MAP_PING_EVERY, cyc = pingT % E, scan = pingT >= E && cyc < CFG.MAP_PING_SHOW, shown = scan || eye.state === 'active';
  const HE = CFG.HINT_EVERY, hintOn = pingT >= HE - CFG.HINT_SHOW && pingT % HE >= HE - CFG.HINT_SHOW;
  mg.fillStyle = 'rgba(0,0,0,.6)'; mg.fillRect(0, 0, 144, 13);
  mg.font = 'bold 10px Georgia'; mg.textBaseline = 'top'; mg.textAlign = 'left';
  if (shown) {
    const tx = (tk.x / TS) * s, tz = (tk.z / TS) * s, pu = 0.5 + 0.5 * Math.sin(time * 10);
    if (tk.fl === p.fl) {
      mg.fillStyle = 'rgba(255,150,30,.3)'; mg.beginPath(); mg.arc(tx, tz, 6 + pu * 3, 0, 7); mg.fill();
      mg.fillStyle = '#ff9a1f'; mg.beginPath(); mg.arc(tx, tz, 3.6, 0, 7); mg.fill(); mg.strokeStyle = '#fff2d0'; mg.lineWidth = 1; mg.stroke();
    } else { mg.strokeStyle = '#ff9a1f'; mg.lineWidth = 2; mg.beginPath(); mg.arc(tx, tz, 4 + pu * 2, 0, 7); mg.stroke(); }
    mg.fillStyle = '#ff9a1f'; mg.fillText(tk.fl === p.fl ? 'TANTRIK' : (tk.fl > p.fl ? 'TANTRIK: upstairs' : 'TANTRIK: downstairs'), 3, 2);
  } else if (hintOn) { mg.fillStyle = '#ffd24a'; mg.font = 'bold 9px Georgia'; mg.fillText('HINT:  K key   F food   A axe', 3, 2); }
  else { mg.fillStyle = 'rgba(255,255,255,.7)'; mg.fillText('scan in ' + Math.ceil(E - cyc) + 's', 3, 2); }
  if (hintOn) drawHints(p);
}
function render() {
  const p = player, pulse = 0.5 + 0.5 * Math.sin(time * 4);
  const y0 = heightOf(p), targetH = p.hidden ? (p.hidden.under ? 0.55 : 1.5) : (p.crouch ? 0.95 : 1.6);
  camH += (targetH - camH) * 0.15; camY += (y0 - camY) * 0.4;
  const bob = Math.sin(bobT) * 0.045 * (p.crouch ? 0.5 : 1);
  const tp = thirdPerson && !p.hidden;
  let cx = p.x, cz = p.z, cy = camY + camH + bob;
  if (tp) {   // camera floats behind Nani (pulled in when a wall is in the way)
    const bx = Math.sin(yaw), bz = Math.cos(yaw); let d = 2.4;
    while (d > 0.3 && solidAt(p.fl, Math.floor((p.x + bx * (d + 0.3)) / TS), Math.floor((p.z + bz * (d + 0.3)) / TS))) d -= 0.2;
    cx = p.x + bx * d; cz = p.z + bz * d; cy += 0.45;
  }
  camera.position.set(cx, cy, cz);
  camera.rotation.y = yaw; camera.rotation.x = pitch;
  if (shake > 0) camera.position.x += (Math.random() - 0.5) * 0.15;
  cane.position.y = Math.sin(bobT * 0.5) * 0.02; cane.visible = !p.hidden && !tp;
  naniMesh.visible = tp; naniMesh.position.set(p.x, y0 + Math.abs(Math.sin(bobT * 0.5)) * 0.04, p.z);
  naniMesh.rotation.y = yaw + Math.PI / 2; naniMesh.scale.y = (p.crouch ? 0.75 : 1) * 0.95;
  torch.intensity = 2.6 + (Math.random() - 0.5) * 0.15 + (Math.random() < 0.01 ? -1.2 : 0);
  carryG.visible = !!carry && !p.hidden && !tp;
  nearLight.intensity = carry && carry.type === 'lantern' ? 1.9 : 0.9; nearLight.distance = carry && carry.type === 'lantern' ? 8 : 6;
  for (const fl of flames) { const sc = fl.userData.base * (0.85 + 0.15 * Math.sin(time * 11 + fl.userData.seed)); fl.scale.set(sc, sc, 1); }
  for (const lp of lamps) lp.light.intensity = lp.base * (0.82 + 0.1 * Math.sin(time * 8 + lp.seed) + 0.08 * Math.sin(time * 21 + lp.seed * 3.1));

  for (let f = 0; f < NF; f++) floors[f].visible = Math.abs(f - p.fl) <= 1;
  if (eyeCharm && !eyeCharm.got) { eyeCharm.mesh.position.y = 1.2 + Math.sin(time * 2) * 0.1; eyeCharm.mesh.rotation.y = time; }
  const ty = heightOf(tk);
  tkMesh.position.set(tk.x, ty + Math.sin(time * 3) * 0.03, tk.z); tkMesh.rotation.y = -tk.dir;
  tkMesh.userData.eyeMat.color.set(tk.state === 'chase' ? 0xff2020 : 0xffd27a);
  ghost.visible = eye.state === 'active'; ghost.position.set(tk.x, ty, tk.z);
  if (exitD.open) exitD.mesh.material.opacity = 0.25 + pulse * 0.25;

  renderer.render(scene, camera);

  $('hearts').textContent = '♥'.repeat(Math.max(0, hp)) + '♡'.repeat(Math.max(0, CFG.HP - hp));
  $('tal').textContent = `Gate parts: ${inv.parts}/${inv.need}   Keys: ${inv.keys}${inv.axe ? '   Axe' : ''}${carry ? '   Holding: ' + CARRY_NAMES[carry.type] : ''}`;
  $('floor').textContent = FLOOR_NAMES[p.fl] || ''; $('stage').textContent = CFG.STAGES[stageIdx].name;
  drawMinimap(p);
  const st = $('status');
  if (p.hidden) { st.style.color = '#6dff9f'; st.textContent = 'Hiding...'; }
  else if (tk.state === 'chase') { st.style.color = '#ff6b6b'; st.textContent = 'HE SEES YOU! Run or hide!'; }
  else if (tk.state === 'search') { st.style.color = '#ffb36b'; st.textContent = 'He heard something...'; }
  else st.textContent = '';
  $('danger').style.opacity = tk.state === 'chase' && state === 'play' ? (0.6 + pulse * 0.4) : 0;
  $('slit').style.display = p.hidden ? 'block' : 'none';
  const tg = state === 'play' ? findTarget() : null;
  let ptxt = tg ? tg.label : '';
  if (!ptxt && state === 'play' && !IS_TOUCH && document.pointerLockElement !== canvas) ptxt = 'Click the screen to look around';
  if (!ptxt && carry && state === 'play' && !IS_TOUCH) ptxt = 'G = throw     F = drop';
  $('prompt').textContent = ptxt;
  $('bUse').textContent = tg ? tg.short : 'USE'; $('bUse').classList.toggle('glow', !!tg);
  { const bt = $('bThrow'), bd = $('bDrop'), sh = IS_TOUCH && carry && state === 'play' ? 'block' : 'none'; if (bt) bt.style.display = sh; if (bd) bd.style.display = sh; }
  $('msgs').innerHTML = msgs.map(m => `<div style="opacity:${Math.min(1, m.s)}">${m.t}</div>`).join('');

  const eb = $('eye'); eb.className = eye.state === 'locked' ? '' : eye.state;
  let label = 'No charm';
  if (eye.state === 'ready') label = 'EYE';
  if (eye.state === 'active') { const s = Math.ceil(eye.time); label = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); eb.style.setProperty('--p', (eye.time / CFG.EYE_SECONDS * 100) + '%'); }
  if (eye.state === 'used') label = 'Closed';
  $('eyeLabel').textContent = label;
  const ab = $('arrowbox');
  if (eye.state === 'active') {
    ab.style.display = 'block';
    const vx = tk.x - p.x, vz = tk.z - p.z, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    $('arrow').style.transform = `rotate(${Math.atan2(vx * rx + vz * rz, vx * fx + vz * fz)}rad)`;
    $('dist').textContent = Math.round(Math.hypot(vx, vz)) + ' m' + (tk.fl > p.fl ? ' (upstairs)' : tk.fl < p.fl ? ' (downstairs)' : ' (same floor)');
  } else ab.style.display = 'none';
}

// ---------- MAIN LOOP ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'play') {
    update(dt);
    if (tk.state === 'chase') { beat -= dt; if (beat <= 0) { beat = 0.55; SFX.heartbeat(); } }
    else { ambT -= dt; if (ambT <= 0) { ambT = 7 + Math.random() * 9; SFX.creak(); } }
  } else time += dt;
  render();
  requestAnimationFrame(loop);
}
loadStage(0);
showScreen('menu');
requestAnimationFrame(loop);
window.__nani = { get state() { return state; }, get player() { return player; }, get tk() { return tk; }, get inv() { return inv; },
  get drawers() { return drawers; }, get doors() { return doors; }, set yaw(v) { yaw = v; }, get hp() { return hp; }, set pingT(v) { pingT = v; }, get carry() { return carry; }, get props() { return props; }, get thrown() { return thrown; }, set axe(v) { inv.axe = v; }, get boarded() { return doors.filter(d => d.boarded).length; } };
})();