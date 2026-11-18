// Procedural low-poly sets. Each returns { group, spots, sky, shadow } and lights itself.
// Interiors: room centred at origin, back wall z=-3.5, side walls x=±3.5, camera usually at +z.
import { THREE, mat, mesh, box, cyl, rng, canvasTex, textPlane, shade, D2R } from './util.js';

const ROOM = 3.5, WALL_H = 3.0;

function lights(g, { sky = '#bfe3ff', ground = '#6b5a48', hemi = 1.25, sun = 2.3, sunColor = '#fff2dc', sunPos = [5, 9, 6], area = 9, warm = 0 }) {
  g.add(new THREE.HemisphereLight(sky, ground, hemi));
  const d = new THREE.DirectionalLight(sunColor, sun);
  d.position.set(...sunPos);
  d.castShadow = true;
  d.shadow.mapSize.set(2048, 2048);
  d.shadow.bias = -0.0004;
  d.shadow.normalBias = 0.02;
  Object.assign(d.shadow.camera, { left: -area, right: area, top: area, bottom: -area, near: 0.5, far: 60 });
  g.add(d); g.add(d.target);
  if (warm) { const p = new THREE.PointLight('#ffd9a0', warm, 12, 1.6); p.position.set(0, 2.7, 0.5); g.add(p); }
}

function planks(key, base, line) {
  return canvasTex('planks' + key, 512, 512, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    const r = rng(key);
    for (let y = 0; y < h; y += 64) {
      c.fillStyle = shade(base, 0.92 + r() * 0.12); c.fillRect(0, y, w, 62);
      c.fillStyle = line; c.fillRect(0, y + 62, w, 2);
      const off = r() * w; c.fillRect(off, y, 2, 62);
    }
  });
}
function tiles(key, a, b, n = 8) {
  return canvasTex('tiles' + key, 512, 512, (c, w, h) => {
    const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = (i + j) % 2 ? a : b; c.fillRect(i * s, j * s, s, s); }
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2;
    for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, h); c.stroke(); c.beginPath(); c.moveTo(0, i * s); c.lineTo(w, i * s); c.stroke(); }
  });
}
function texFloor(g, tex, w, d, rep = 3, y = 0) {
  const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep * d / w); t.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; g.add(m); return m;
}

/** Walls with a baseboard; window: {wall:'back'|'left'|'right', x, w, h, y}. */
function room(g, { wall = '#9fb4c7', floorTex, base = '#f2f2f2', ceiling = '#f4f1ea', windows = [], door = null, w = ROOM * 2, d = ROOM * 2, h = WALL_H, outside = '#8fd0ff' }) {
  texFloor(g, floorTex, w, d, 3);
  const wm = mat(wall);
  const mk = (W, H, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wm); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); };
  // back wall pieces around windows (simple: full wall, windows drawn on top as insets)
  mk(w, h, 0, h / 2, -d / 2, 0);
  mk(d, h, -w / 2, h / 2, 0, Math.PI / 2);
  mk(d, h, w / 2, h / 2, 0, -Math.PI / 2);
  mk(w, h, 0, h / 2, d / 2, Math.PI);
  g.add(box(w, 0.12, 0.04, base, 0, 0, d / 2 - 0.02));
  const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: shade(ceiling, 0.93) })); c.rotation.x = Math.PI / 2; c.position.y = h; g.add(c);
  g.add(box(w, 0.12, 0.04, base, 0, 0, -d / 2 + 0.02));
  const lb = box(0.04, 0.12, d, base, -w / 2 + 0.02, 0, 0); g.add(lb);
  const rb = box(0.04, 0.12, d, base, w / 2 - 0.02, 0, 0); g.add(rb);
  for (const wi of windows) addWindow(g, wi, w, d, outside);
  if (door) addDoor(g, door, w, d);
}

function wallPlace(o, wall, x, y, w, d) {
  if (wall === 'back') { o.position.set(x, y, -d / 2 + 0.02); }
  if (wall === 'left') { o.position.set(-w / 2 + 0.02, y, x); o.rotation.y = Math.PI / 2; }
  if (wall === 'right') { o.position.set(w / 2 - 0.02, y, x); o.rotation.y = -Math.PI / 2; }
}

function addWindow(g, { wall = 'back', x = 0, w: ww = 1.4, h: wh = 1.3, y = 1.55 }, W, D, outside) {
  const grp = new THREE.Group();
  const skyTex = canvasTex('winsky' + outside, 256, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, outside); gr.addColorStop(1, '#e6f6ff'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#6dbb5a'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(20 + i * 48, h * 0.92, 40, 0, 7); c.fill(); }
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(70, 60, 40, 14, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(180, 90, 32, 10, 0, 0, 7); c.fill();
  });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyTex }));
  pane.position.z = 0.005; grp.add(pane);
  const fr = '#f7f7f7', t = 0.07;
  grp.add(box(ww + t * 2, t, 0.08, fr, 0, wh / 2, 0), box(ww + t * 2, t, 0.08, fr, 0, -wh / 2 - t, 0));
  const l = box(t, wh, 0.08, fr, -ww / 2 - t / 2, -wh / 2, 0), r = box(t, wh, 0.08, fr, ww / 2 + t / 2, -wh / 2, 0);
  const mid = box(0.04, wh, 0.06, fr, 0, -wh / 2, 0), midh = box(ww, 0.04, 0.06, fr, 0, -0.02, 0);
  grp.add(l, r, mid, midh);
  grp.add(box(ww + 0.3, 0.05, 0.18, fr, 0, -wh / 2 - t - 0.05, 0.06));
  wallPlace(grp, wall, x, y, W, D);
  g.add(grp);
}

function addDoor(g, { wall = 'right', x = 1.5, color = '#8a5a3b' }, W, D) {
  const grp = new THREE.Group();
  grp.add(box(1.0, 2.15, 0.06, color, 0, 0, 0.03));
  grp.add(box(1.14, 0.08, 0.1, '#f2f2f2', 0, 2.15, 0.03));
  grp.add(box(0.07, 2.15, 0.1, '#f2f2f2', -0.535, 0, 0.03), box(0.07, 2.15, 0.1, '#f2f2f2', 0.535, 0, 0.03));
  const knob = mesh(new THREE.SphereGeometry(0.04, 6, 4), '#d9b44a'); knob.position.set(0.38, 1.0, 0.1); grp.add(knob);
  for (const y of [0.3, 1.2]) grp.add(box(0.7, 0.7, 0.02, shade(color, 0.9), 0, y, 0.065));
  wallPlace(grp, wall, x, 0, W, D);
  g.add(grp);
}

function poster(g, wall, x, y, w, h, draw, key, W = ROOM * 2, D = ROOM * 2) {
  const t = canvasTex(key, 256, Math.round(256 * h / w), draw);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  p.position.z = 0.01; const grp = new THREE.Group(); grp.add(p); wallPlace(grp, wall, x, y, W, D); grp.position[wall === 'back' ? 'z' : 'x'] += wall === 'right' ? -0.01 : 0.01; g.add(grp);
}

// ------------------------------------------------------------------ furniture
export function bed(g, x, z, ry = 0, blanket = '#3a6ea5') {
  const b = new THREE.Group();
  b.add(box(1.5, 0.3, 2.2, '#8a5a3b', 0, 0, 0));
  b.add(box(1.42, 0.2, 2.1, '#f4f4f4', 0, 0.3, 0));
  b.add(box(1.46, 0.08, 1.45, blanket, 0, 0.47, 0.35));
  b.add(box(1.5, 0.8, 0.1, '#7a4b2f', 0, 0, -1.08));
  b.add(box(0.6, 0.14, 0.38, '#ffffff', -0.33, 0.5, -0.78), box(0.6, 0.14, 0.38, '#ffffff', 0.33, 0.5, -0.78));
  b.position.set(x, 0, z); b.rotation.y = ry; g.add(b); return b;
}
export function desk(g, x, z, ry = 0, { w = 1.4, color = '#c49a6c', laptop = true, chair = true } = {}) {
  const d = new THREE.Group();
  d.add(box(w, 0.05, 0.7, color, 0, 0.74, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) d.add(box(0.05, 0.74, 0.05, shade(color, 0.7), sx * (w / 2 - 0.05), 0, sz * 0.3));
  if (laptop) {
    d.add(box(0.42, 0.02, 0.3, '#3a3d46', 0, 0.79, 0.05));
    const scr = box(0.42, 0.28, 0.02, '#3a3d46', 0, 0.8, -0.1); scr.rotation.x = -0.25; d.add(scr);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), new THREE.MeshBasicMaterial({ color: '#8fd3ff' })); glow.position.set(0, 0.94, -0.074); glow.rotation.x = -0.25; d.add(glow);
  }
  if (chair) d.add(officeChair(0, 0.6));
  d.position.set(x, 0, z); d.rotation.y = ry; g.add(d); return d;
}
export function officeChair(x, z, color = '#2b2d33') {
  const c = new THREE.Group();
  c.add(box(0.5, 0.08, 0.5, color, 0, 0.45, 0));
  c.add(box(0.48, 0.55, 0.07, color, 0, 0.55, 0.24));
  c.add(cyl(0.03, 0.03, 0.4, '#666', 0, 0.05, 0, 6));
  for (let i = 0; i < 5; i++) { const l = box(0.04, 0.03, 0.3, '#555', 0, 0.04, 0); l.rotation.y = i * 72 * D2R; l.position.set(Math.sin(i * 72 * D2R) * 0.15, 0.04, Math.cos(i * 72 * D2R) * 0.15); c.add(l); }
  c.position.set(x, 0, z); return c;
}
export function chair(g, x, z, ry = 0, color = '#a0522d') {
  const c = new THREE.Group();
  c.add(box(0.45, 0.05, 0.45, color, 0, 0.45, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.add(box(0.04, 0.45, 0.04, shade(color, 0.75), sx * 0.19, 0, sz * 0.19));
  c.add(box(0.45, 0.5, 0.04, color, 0, 0.5, 0.2));
  c.position.set(x, 0, z); c.rotation.y = ry; g.add(c); return c;
}
function shelf(g, x, z, ry = 0, seed = 's') {
  const s = new THREE.Group(), r = rng(seed);
  s.add(box(1.0, 1.6, 0.32, '#8a5a3b', 0, 0, 0));
  for (let k = 0; k < 4; k++) {
    s.add(box(0.94, 0.03, 0.3, '#6e452c', 0, 0.12 + k * 0.38, 0.02));
    let xx = -0.42;
    while (xx < 0.4) { const bw = 0.05 + r() * 0.05, bh = 0.2 + r() * 0.12; s.add(box(bw, bh, 0.22, ['#e63946', '#457b9d', '#e9c46a', '#2a9d8f', '#f4a261', '#8338ec'][Math.floor(r() * 6)], xx + bw / 2, 0.15 + k * 0.38, 0.03)); xx += bw + 0.01; }
  }
  s.position.set(x, 0, z); s.rotation.y = ry; g.add(s); return s;
}
function plant(g, x, z, s = 1) {
  const p = new THREE.Group();
  p.add(cyl(0.16, 0.12, 0.3, '#c76b3b', 0, 0, 0, 7));
  for (let i = 0; i < 5; i++) { const l = mesh(new THREE.IcosahedronGeometry(0.17, 0), '#3f9d4a'); l.position.set(Math.sin(i * 1.3) * 0.12, 0.42 + (i % 2) * 0.15, Math.cos(i * 1.3) * 0.12); p.add(l); }
  p.position.set(x, 0, z); p.scale.setScalar(s); g.add(p); return p;
}
function lamp(g, x, y, z) {
  g.add(cyl(0.12, 0.14, 0.04, '#333', x, y, z, 8));
  g.add(cyl(0.02, 0.02, 0.35, '#333', x, y, z, 6));
  const shadeM = mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.22, 8, 1, true), '#fff3c4', { opts: { emissive: '#ffe9a8', emissiveIntensity: 0.5, side: THREE.DoubleSide } });
  shadeM.position.set(x, y + 0.42, z); g.add(shadeM);
}
function rug(g, x, z, w, d, a = '#b5443a', b = '#f2e3c6') {
  const t = canvasTex('rug' + a + b, 256, 256, (c, W, H) => { c.fillStyle = a; c.fillRect(0, 0, W, H); for (let i = 1; i < 6; i++) { c.strokeStyle = i % 2 ? b : a; c.lineWidth = 10; c.strokeRect(i * 18, i * 18, W - i * 36, H - i * 36); } });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 1 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); m.receiveShadow = true; g.add(m);
}
function clock(g, wall, x, y, W, D) {
  poster(g, wall, x, y, 0.4, 0.4, (c, w, h) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, 7); c.fill(); c.lineWidth = 10; c.strokeStyle = '#222'; c.stroke(); c.lineWidth = 8; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2, 50); c.moveTo(w / 2, h / 2); c.lineTo(w * 0.75, h / 2); c.stroke(); }, 'clock', W, D);
}

export function tree(g, x, z, s = 1, seed = 1) {
  const t = new THREE.Group(), r = rng(seed);
  t.add(cyl(0.12, 0.18, 1.4, '#7a5230', 0, 0, 0, 6));
  const greens = ['#3f9d4a', '#4caf50', '#2e7d32', '#5cb85c'];
  for (let i = 0; i < 3; i++) { const c = mesh(new THREE.IcosahedronGeometry(0.8 - i * 0.12, 0), greens[Math.floor(r() * 4)]); c.position.set((r() - 0.5) * 0.5, 1.7 + i * 0.5, (r() - 0.5) * 0.5); c.rotation.set(r() * 3, r() * 3, 0); t.add(c); }
  t.position.set(x, 0, z); t.scale.setScalar(s); g.add(t); return t;
}
function bush(g, x, z, s = 1, c = '#4caf50') { const b = mesh(new THREE.IcosahedronGeometry(0.45, 0), c); b.position.set(x, 0.3 * s, z); b.scale.set(s * 1.2, s * 0.8, s); g.add(b); }
export function car(g, x, z, ry = 0, color = '#e63946') {
  const c = new THREE.Group();
  c.add(box(1.8, 0.55, 4.0, color, 0, 0.3, 0));
  c.add(box(1.6, 0.5, 2.0, shade(color, 0.92), 0, 0.85, -0.2));
  const glass = '#a9d6f5';
  c.add(box(1.62, 0.36, 0.05, glass, 0, 0.92, 0.82), box(1.62, 0.36, 0.05, glass, 0, 0.92, -1.22));
  for (const sx of [-1, 1]) c.add(box(0.03, 0.34, 1.7, glass, sx * 0.81, 0.92, -0.2));
  for (const sx of [-1, 1]) for (const sz of [-1.3, 1.3]) { const w = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 10), '#222'); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.85, 0.33, sz); c.add(w); }
  c.add(box(0.3, 0.12, 0.05, '#fff7c2', -0.6, 0.55, 2.0), box(0.3, 0.12, 0.05, '#fff7c2', 0.6, 0.55, 2.0));
  c.position.set(x, 0, z); c.rotation.y = ry; g.add(c); return c;
}
function streetLight(g, x, z, side = 1) {
  g.add(cyl(0.06, 0.08, 4.2, '#3d3d3d', x, 0, z, 6));
  g.add(box(1.0, 0.08, 0.12, '#3d3d3d', x - side * 0.45, 4.15, z));
  g.add(box(0.4, 0.1, 0.2, '#fff6c8', x - side * 0.85, 4.07, z));
}
function building(g, x, z, w, d, h, color, seed, face = 1) {
  const b = new THREE.Group();
  b.add(box(w, h, d, color, 0, 0, 0));
  const win = canvasTex('bw' + color + seed + w + h, 256, 512, (c, W, H) => {
    c.fillStyle = color; c.fillRect(0, 0, W, H);
    const r = rng(seed); const cols = Math.max(2, Math.round(w / 1.1)), rows = Math.max(2, Math.round(h / 1.4));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows - 0.5; j++) {
      c.fillStyle = r() < 0.2 ? '#ffe59a' : '#3c5a78'; const cw = W / cols, ch = H / rows;
      c.fillRect(i * cw + cw * 0.2, j * ch + ch * 0.2, cw * 0.6, ch * 0.55);
    }
    c.fillStyle = shade(color, 0.7); c.fillRect(0, H - 40, W, 40);
  });
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: win, roughness: 0.9 }));
  fm.position.set(0, h / 2, face * (d / 2 + 0.01)); if (face < 0) fm.rotation.y = Math.PI; b.add(fm);
  b.add(box(w + 0.1, 0.2, d + 0.1, shade(color, 0.8), 0, h, 0));
  b.position.set(x, 0, z); g.add(b); return b;
}
function sideBuilding(g, x, z, w, d, h, color, seed, side) {
  // facade faces the street (towards x=0)
  const b = building(g, 0, 0, d, w, h, color, seed, 1);
  b.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  b.position.set(x, 0, z);
  return b;
}
function house(g, x, z, ry = 0, wall = '#f1ece2', roof = '#8c3b2e', door = '#c0392b') {
  const h = new THREE.Group();
  h.add(box(6, 3, 5, wall, 0, 0, 0));
  const roofG = new THREE.CylinderGeometry(0.01, 4.2, 2.0, 4, 1); roofG.rotateY(Math.PI / 4);
  const rf = mesh(roofG, roof); rf.scale.set(1.05, 1, 0.85); rf.position.set(0, 4.0, 0); h.add(rf);
  h.add(box(1.1, 2.1, 0.08, door, 0, 0, 2.52));
  h.add(box(1.3, 0.12, 0.1, '#ffffff', 0, 2.1, 2.54));
  for (const sx of [-1, 1]) {
    h.add(box(1.2, 1.1, 0.06, '#9fd3f5', sx * 1.9, 1.2, 2.52));
    h.add(box(1.36, 0.1, 0.12, '#ffffff', sx * 1.9, 1.15, 2.55), box(1.36, 0.1, 0.12, '#ffffff', sx * 1.9, 2.3, 2.55));
    h.add(box(0.3, 1.25, 0.06, '#2d4a3e', sx * 2.65, 1.15, 2.55), box(0.3, 1.25, 0.06, '#2d4a3e', sx * 1.15, 1.15, 2.55));
  }
  h.add(box(2.2, 0.15, 1.0, '#bfb8aa', 0, 0, 3.0), box(2.2, 0.15, 0.6, '#bfb8aa', 0, 0.15, 2.8));
  h.add(box(7, 0.2, 0.3, shade(wall, 0.85), 0, 3.0, 2.55));
  h.position.set(x, 0, z); h.rotation.y = ry; g.add(h); return h;
}
function ground(g, color, size = 120, y = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), mat(color)); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; g.add(m);
}
function grassTex() {
  return canvasTex('grass', 512, 512, (c, w, h) => { c.fillStyle = '#5cbf4a'; c.fillRect(0, 0, w, h); const r = rng(3); for (let i = 0; i < 2500; i++) { c.fillStyle = r() < 0.5 ? '#54b343' : '#68c955'; c.fillRect(r() * w, r() * h, 3, 6); } });
}

// ------------------------------------------------------------------ sets
export const SETS = {
  bedroom(o = {}) {
    const g = new THREE.Group();
    room(g, { wall: o.wall || '#8fa9c4', floorTex: planks('bed', '#a9774c', '#6e4a2c'), windows: [{ wall: 'back', x: 0.6 }], door: { wall: 'right', x: 1.6 }, outside: o.night ? '#1d2b53' : '#7cc6ff' });
    bed(g, -2.2, -1.9, 0, o.blanket || '#3a6ea5');
    g.add(box(0.5, 0.55, 0.45, '#8a5a3b', -1.1, 0, -3.1)); lamp(g, -1.1, 0.55, -3.1);
    desk(g, 2.4, -2.9, 0, { chair: false }); chair(g, 2.4, -2.3, 0);
    shelf(g, -3.25, 0.6, Math.PI / 2, 'bshelf');
    rug(g, 0, -0.6, 2.4, 1.6);
    poster(g, 'back', -2.3, 2.2, 0.8, 0.55, (c, w, h) => { c.fillStyle = '#ffcf33'; c.fillRect(0, 0, w, h); c.fillStyle = '#e63946'; c.font = '900 46px Inter'; c.textAlign = 'center'; c.fillText('LEVEL UP', w / 2, h / 2 + 15); }, 'lvlup');
    poster(g, 'back', 2.4, 2.05, 0.6, 0.8, (c, w, h) => { c.fillStyle = '#1d3557'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(w / 2, h / 2.6, 60, 0, 7); c.fill(); c.fillStyle = '#a8dadc'; c.fillRect(20, h - 90, w - 40, 14); c.fillRect(40, h - 60, w - 80, 14); }, 'spaceposter');
    lights(g, { sky: '#dfefff', ground: '#806040', hemi: o.night ? 0.5 : 1.3, sun: o.night ? 0.6 : 2.0, sunColor: o.night ? '#8fa8ff' : '#fff2dc', sunPos: [1, 6, -2.5], area: 5, warm: o.night ? 6 : 2.5 });
    return { group: g, sky: '#000000', bounds: [3.3, 3.4], spots: {
      bedLie: { p: [-2.2, -0.95], face: 0, y: 0.66 },
      center: { p: [0, -0.4], face: 0 }, bed: { p: [-2.2, -1.5], face: 0, sitY: 0.52 }, bedside: { p: [-1.2, -1.2], face: -60 }, door: { p: [3.0, 1.6], face: -90 },
      desk: { p: [2.4, -2.25], face: 180, sitY: 0.47 }, window: { p: [0.6, -2.7], face: 180 }, front: { p: [0, 1.5], face: 0 }, left: { p: [-1.2, 0.2], face: 30 }, right: { p: [1.2, 0.2], face: -30 } } };
  },

  kitchen(o = {}) {
    const g = new THREE.Group();
    room(g, { wall: '#f3e1c7', floorTex: tiles('kit', '#e8e8e8', '#cfd8dc'), windows: [{ wall: 'back', x: -0.2, w: 1.2, h: 1.0, y: 1.9 }], door: { wall: 'left', x: 1.8, color: '#9c6b47' } });
    const cab = '#2f6690';
    g.add(box(6.6, 0.9, 0.6, cab, 0, 0, -3.15)); g.add(box(6.7, 0.05, 0.66, '#eeeeee', 0, 0.9, -3.15));
    for (let i = -3; i <= 3; i++) if (i !== 0) g.add(box(0.85, 0.7, 0.4, cab, i * 0.95, 2.0, -3.25));
    g.add(box(0.9, 2.0, 0.7, '#d9dde0', 2.9, 0, -3.0)); g.add(box(0.04, 0.5, 0.04, '#999', 2.55, 1.2, -2.63));
    g.add(box(0.7, 0.04, 0.5, '#333', -1.4, 0.93, -3.15));
    desk(g, 0, -0.3, 0, { w: 1.6, color: '#b5835a', laptop: false, chair: false });
    chair(g, -0.5, 0.35, 0); chair(g, 0.5, 0.35, 0); chair(g, 0, -1.0, Math.PI);
    g.add(cyl(0.15, 0.15, 0.04, '#ffffff', -0.3, 0.79, -0.3, 10), cyl(0.15, 0.15, 0.04, '#ffffff', 0.35, 0.79, -0.2, 10));
    plant(g, -3.0, -3.0, 0.9);
    lights(g, { sky: '#fff6e8', ground: '#806040', hemi: 1.35, sun: 2.0, sunPos: [-0.5, 6, -2.0], area: 5, warm: 2 });
    return { group: g, bounds: [3.3, 3.4], spots: { center: { p: [0, 1.2], face: 0 }, table: { p: [0, -1.05], face: 0, sitY: 0.47 }, tableFront: { p: [0.5, 0.42], face: 180, sitY: 0.47 }, fridge: { p: [2.6, -2.2], face: -150 },
      stove: { p: [-1.4, -2.5], face: 180 }, door: { p: [-3.0, 1.8], face: 90 }, front: { p: [0, 2.2], face: 0 }, left: { p: [-1.4, 1.2], face: 20 }, right: { p: [1.4, 1.2], face: -20 } } };
  },

  living(o = {}) {
    const g = new THREE.Group();
    room(g, { wall: '#d7c9e8', floorTex: planks('liv', '#b98a5e', '#7a5536'), windows: [{ wall: 'left', x: -0.8, w: 1.6 }], door: { wall: 'right', x: 2.0 } });
    const sofa = new THREE.Group(); const sc = '#c8553d';
    sofa.add(box(2.4, 0.45, 0.9, sc, 0, 0, 0), box(2.4, 0.6, 0.25, shade(sc, 0.9), 0, 0.45, -0.35), box(0.25, 0.65, 0.9, shade(sc, 0.9), -1.2, 0, 0), box(0.25, 0.65, 0.9, shade(sc, 0.9), 1.2, 0, 0));
    sofa.position.set(0, 0, 1.4); sofa.rotation.y = Math.PI; g.add(sofa);
    g.add(box(2.2, 0.5, 0.45, '#5b4636', 0, 0, -3.2));
    const tv = new THREE.Group(); tv.add(box(1.9, 1.1, 0.08, '#1a1a1a', 0, 0, 0));
    const scr = o.brokenTV ? canvasTex('tvbroken', 256, 160, (c, w, h) => { c.fillStyle = '#1e2a38'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e8f1ff'; c.lineWidth = 3; const cx = w * 0.55, cy = h * 0.45; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(cx, cy); let x = cx, y = cy; for (let k = 0; k < 4; k++) { x += Math.cos(i * 0.52 + k * 0.3) * 30; y += Math.sin(i * 0.52 + k * 0.4) * 22; c.lineTo(x, y); } c.stroke(); } })
      : canvasTex('tvon', 256, 160, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#4cc9f0'); gr.addColorStop(1, '#7209b7'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), new THREE.MeshBasicMaterial({ map: scr })); sp.position.set(0, 0.55, 0.045); tv.add(sp);
    tv.position.set(0, 0.62, -3.3); g.add(tv);
    rug(g, 0, -0.6, 2.8, 2.0, '#2a9d8f', '#e9f5db');
    g.add(box(1.0, 0.4, 0.6, '#8a5a3b', 0, 0, -0.5));
    plant(g, -2.9, -3.0, 1.2); plant(g, 2.9, -3.0, 1.0); shelf(g, 3.25, -1.0, -Math.PI / 2, 'lshelf');
    lights(g, { sky: '#f4ecff', ground: '#806040', hemi: 1.3, sun: 2.0, sunPos: [-4, 6, -0.5], area: 5, warm: 2 });
    return { group: g, bounds: [3.3, 3.4], spots: { center: { p: [0, 0.4], face: 0 }, sofa: { p: [0, 1.25], face: 180, sitY: 0.45 }, tv: { p: [0.6, -2.4], face: 0 }, door: { p: [3.0, 2.0], face: -90 },
      front: { p: [0, 2.4], face: 0 }, left: { p: [-1.3, 0.2], face: 20 }, right: { p: [1.3, 0.2], face: -20 } } };
  },

  classroom(o = {}) {
    const g = new THREE.Group();
    room(g, { wall: '#f1e3b3', floorTex: tiles('cls', '#d9d4c7', '#c9c2b2', 10), windows: [{ wall: 'left', x: -1.2, w: 1.6 }, { wall: 'left', x: 1.2, w: 1.6 }], door: { wall: 'right', x: 2.2, color: '#4a7c59' }, d: 9, w: 7 });
    const bt = canvasTex('chalk' + (o.board || ''), 512, 220, (c, w, h) => { c.fillStyle = '#2f5d50'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f4f4'; c.font = '700 44px Inter'; c.textAlign = 'center'; (o.board || 'HONESTY = ?').split('\n').forEach((l, i, a) => c.fillText(l, w / 2, h / 2 + 15 + (i - (a.length - 1) / 2) * 52)); });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.4), new THREE.MeshStandardMaterial({ map: bt, roughness: 1 })); board.position.set(0, 1.75, -4.47); g.add(board);
    g.add(box(3.8, 0.08, 0.12, '#8a5a3b', 0, 1.0, -4.43));
    g.add(box(1.6, 0.8, 0.7, '#8a5a3b', -1.6, 0, -3.3));
    for (let r = 0; r < 3; r++) for (let c = -1; c <= 1; c++) {
      const x = c * 1.6, z = -1.6 + r * 1.5;
      g.add(box(0.9, 0.05, 0.55, '#d4a373', x, 0.68, z)); g.add(box(0.06, 0.68, 0.06, '#666', x - 0.4, 0, z), box(0.06, 0.68, 0.06, '#666', x + 0.4, 0, z));
      chair(g, x, z + 0.55, 0, '#3d5a80');
    }
    clock(g, 'back', 2.6, 2.4, 7, 9);
    lights(g, { sky: '#fff9e8', ground: '#806040', hemi: 1.35, sun: 2.0, sunPos: [-6, 6, 0], area: 6, warm: 2 });
    return { group: g, bounds: [3.3, 4.4], spots: { board: { p: [0.3, -3.7], face: 0 }, teacher: { p: [-1.6, -2.7], face: 0 }, door: { p: [3.0, 2.2], face: -90 }, center: { p: [0, 0.6], face: 0 },
      seat: { p: [0, 0.45], face: 180, sitY: 0.47 }, seatFront: { p: [0, -1.05], face: 180, sitY: 0.47 }, seatBack: { p: [0, 1.95], face: 180, sitY: 0.47 }, front: { p: [0, 3.2], face: 0 }, aisle: { p: [0.8, 0.8], face: 0 } } };
  },

  office(o = {}) {
    const g = new THREE.Group();
    room(g, { wall: '#e5e9ee', floorTex: tiles('off', '#b8c1cc', '#aab4bf', 6), door: { wall: 'left', x: 2.0, color: '#6c757d' } });
    const sky = canvasTex('skyline', 512, 256, (c, w, h) => { c.fillStyle = '#9ed2ff'; c.fillRect(0, 0, w, h); const r = rng(9); for (let i = 0; i < 18; i++) { const bw = 20 + r() * 30, bh = 60 + r() * 150; c.fillStyle = ['#5c7a99', '#6d8bab', '#4f6b87'][i % 3]; c.fillRect(i * 30, h - bh, bw, bh); } });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 2.0), new THREE.MeshBasicMaterial({ map: sky })); win.position.set(0, 1.6, -3.47); g.add(win);
    for (let i = -3; i <= 3; i++) g.add(box(0.06, 2.0, 0.06, '#d0d4d9', i * 1.1, 0.6, -3.44));
    desk(g, 0, -2.2, 0, { w: 2.0, color: '#3d3d3d' });
    desk(g, -2.4, 0.4, Math.PI / 2, { w: 1.2, color: '#c9ada7' }); desk(g, 2.4, 0.4, -Math.PI / 2, { w: 1.2, color: '#c9ada7' });
    plant(g, -3.0, -3.0, 1.3); plant(g, 3.0, -3.0, 1.3);
    poster(g, 'right', -1.5, 1.9, 1.2, 0.7, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e63946'; c.lineWidth = 8; c.beginPath(); c.moveTo(20, h - 30); c.lineTo(90, h - 70); c.lineTo(150, h - 50); c.lineTo(230, 25); c.stroke(); }, 'chart');
    lights(g, { sky: '#ffffff', ground: '#808a94', hemi: 1.45, sun: 1.7, sunPos: [0, 6, -2.5], area: 5, warm: 1.5 });
    return { group: g, bounds: [3.3, 3.4], spots: { boss: { p: [0, -1.6], face: 180, sitY: 0.47 }, bossDesk: { p: [0, -2.2], face: 0 }, front: { p: [0, 1.8], face: 0 }, center: { p: [0, 0.2], face: 0 },
      left: { p: [-1.6, 0.4], face: -90, sitY: 0.47 }, right: { p: [1.6, 0.4], face: 90, sitY: 0.47 }, door: { p: [-3.0, 2.0], face: 90 }, desktop: { p: [0, -2.2], y: 0.77, face: 0 } } };
  },

  street(o = {}) {
    const g = new THREE.Group();
    ground(g, '#9aa0a6', 200, -0.01);
    g.add(box(8, 0.02, 200, '#3b3f45', 0, 0, -60, { cast: false }));
    for (let z = 30; z > -150; z -= 4) g.add(box(0.18, 0.025, 1.8, '#f1f1f1', 0, 0, z, { cast: false }));
    for (const s of [-1, 1]) { g.add(box(4, 0.18, 200, '#c9c4bb', s * 6, 0, -60)); g.add(box(0.25, 0.2, 200, '#8d8a85', s * 4.1, 0, -60)); }
    const cols = ['#e07a5f', '#81b29a', '#f2cc8f', '#3d405b', '#a3b18a', '#d4a373', '#6d6875', '#b56576'];
    const r = rng('street' + (o.seed || 1));
    for (const s of [-1, 1]) {
      let z = 12;
      while (z > -140) { const w = 5 + r() * 4, h = 6 + r() * 12; sideBuilding(g, s * (8 + 2.5), z - w / 2, w, 5, h, cols[Math.floor(r() * cols.length)], Math.floor(r() * 1000), s); z -= w + 0.3; }
      for (let z2 = 8; z2 > -120; z2 -= 9) tree(g, s * 4.7, z2, 0.9 + r() * 0.3, Math.floor(r() * 99));
      for (let z2 = 4; z2 > -120; z2 -= 18) streetLight(g, s * 4.5, z2, s);
    }
    if (o.cars !== false) { car(g, 2.2, -12, 0, '#e63946'); car(g, -2.2, -26, Math.PI, '#3a86ff'); car(g, 2.2, -40, 0, '#ffbe0b'); car(g, -2.2, 6, Math.PI, '#2a9d8f'); }
    lights(g, { sky: '#bfe3ff', ground: '#8a8f99', hemi: 1.3, sun: 2.5, sunPos: [10, 18, 8], area: 22 });
    return { group: g, sky: o.night ? '#1d2b53' : '#8ccfff', fog: [40, 140], spots: {
      center: { p: [5.5, 0], face: 0 }, sidewalk: { p: [5.5, 0], face: 0 }, sidewalkFar: { p: [5.5, -12], face: 0 }, across: { p: [-5.5, 0], face: 0 },
      road: { p: [1.5, 0], face: 0 }, front: { p: [5.5, 4], face: 0 }, left: { p: [4.8, 0.3], face: 60 }, right: { p: [6.2, 0.3], face: -60 } } };
  },

  house_front(o = {}) {
    const g = new THREE.Group();
    texFloor(g, grassTex(), 120, 120, 20);
    g.add(box(1.4, 0.03, 9, '#d6d0c4', 0, 0, 1.5, { cast: false }));
    g.add(box(120, 0.03, 4, '#c9c4bb', 0, 0, 8, { cast: false }));
    g.add(box(120, 0.02, 7, '#3b3f45', 0, 0, 13.5, { cast: false }));
    house(g, 0, -5.5, 0);
    house(g, -11, -6, 0, '#dfe7f0', '#3d405b', '#3a86ff'); house(g, 11, -6, 0, '#f2e1c1', '#5a3e36', '#2a9d8f');
    for (let x = -4; x <= 4; x += 0.5) if (Math.abs(x) > 0.9) g.add(box(0.08, 0.7, 0.08, '#ffffff', x, 0, 5.8));
    g.add(box(3.2, 0.06, 0.06, '#ffffff', -2.5, 0.55, 5.8), box(3.2, 0.06, 0.06, '#ffffff', 2.5, 0.55, 5.8));
    for (const x of [-2.5, -1.6, 1.6, 2.5]) bush(g, x, -2.4, 1, x < 0 ? '#4caf50' : '#43a047');
    for (const x of [-2.2, 2.2]) for (const c of ['#ff6b8a', '#ffd23f']) { const f = mesh(new THREE.IcosahedronGeometry(0.08, 0), c); f.position.set(x + (c === '#ffd23f' ? 0.3 : 0), 0.62, -2.2); g.add(f); }
    tree(g, -5.5, 1, 1.3, 4); tree(g, 6, 0, 1.2, 5);
    g.add(cyl(0.05, 0.05, 1.0, '#555', 1.8, 0, 6.3, 6), box(0.4, 0.3, 0.5, '#1d3557', 1.8, 1.0, 6.3));
    if (o.car) car(g, 4, 13, Math.PI / 2, o.car);
    lights(g, { sky: '#bfe3ff', ground: '#6a9a5a', hemi: 1.25, sun: 2.5, sunPos: [8, 14, 10], area: 16 });
    return { group: g, sky: '#8ccfff', fog: [35, 120], spots: {
      door: { p: [0, -2.2], face: 0 }, porch: { p: [0, -1.6], face: 0 }, path: { p: [0, 1.5], face: 0 }, lawn: { p: [-2.4, 1.0], face: 20 }, lawnR: { p: [2.4, 1.0], face: -20 },
      gate: { p: [0, 5.8], face: 180 }, center: { p: [0, 1.5], face: 0 }, front: { p: [0, 4.5], face: 0 }, sidewalk: { p: [-2, 8], face: 90 } } };
  },

  park(o = {}) {
    const g = new THREE.Group();
    texFloor(g, grassTex(), 120, 120, 20);
    g.add(box(1.6, 0.03, 60, '#d9c9a3', 0, 0, -10, { cast: false }));
    const goal = new THREE.Group(); const wc = '#ffffff';
    goal.add(cyl(0.06, 0.06, 2.2, wc, -2.4, 0, 0, 6), cyl(0.06, 0.06, 2.2, wc, 2.4, 0, 0, 6), box(4.9, 0.12, 0.12, wc, 0, 2.15, 0));
    const net = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.2, 16, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.6 })); net.position.set(0, 1.1, -0.9); goal.add(net);
    goal.position.set(-6, 0, -10); goal.rotation.y = 0.4; g.add(goal);
    for (const [x, z] of [[-4, 2], [5, -3], [7, -14], [-8, -18], [3, -22], [-3, -28], [9, 4]]) tree(g, x, z, 1 + (Math.abs(x) % 3) * 0.15, x * 7 + z);
    for (const [x, z, ry] of [[2.2, -2, -Math.PI / 2], [-2.2, -8, Math.PI / 2]]) { const b = new THREE.Group(); b.add(box(1.6, 0.06, 0.45, '#a0522d', 0, 0.45, 0), box(1.6, 0.4, 0.06, '#a0522d', 0, 0.6, -0.2), box(0.08, 0.45, 0.4, '#444', -0.7, 0, 0), box(0.08, 0.45, 0.4, '#444', 0.7, 0, 0)); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b); }
    for (let i = 0; i < 6; i++) bush(g, -6 + i * 2.6, 6, 0.9);
    lights(g, { sky: '#bfe3ff', ground: '#6a9a5a', hemi: 1.25, sun: 2.5, sunPos: [8, 14, 10], area: 18 });
    return { group: g, sky: '#8ccfff', fog: [35, 120], spots: { center: { p: [0, 0], face: 0 }, path: { p: [0, -4], face: 0 }, bench: { p: [1.85, -2], face: -90, sitY: 0.47 }, goal: { p: [-5.5, -8.5], face: 20 },
      front: { p: [0, 4], face: 0 }, left: { p: [-1.4, 0.3], face: 40 }, right: { p: [1.4, 0.3], face: -40 } } };
  },

  studio(o = {}) {
    const g = new THREE.Group();
    const c = o.color || '#ffd23f';
    ground(g, c, 200);
    lights(g, { sky: '#ffffff', ground: shade(c, 0.6), hemi: 1.5, sun: 2.0, sunPos: [4, 10, 8], area: 10 });
    return { group: g, sky: shade(c, 1.15), fog: [20, 60], spots: { center: { p: [0, 0], face: 0 }, left: { p: [-1.2, 0], face: 20 }, right: { p: [1.2, 0], face: -20 }, front: { p: [0, 3], face: 0 } } };
  },
};
