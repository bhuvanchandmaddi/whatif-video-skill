// Props. Each factory returns an Object3D; optional update(obj, tLocal) for animated props.
import { THREE, mat, mesh, box, cyl, rng, canvasTex, textPlane, shade, D2R } from './util.js';
import { car as carSet, tree as treeSet } from './sets.js';

function billTex() {
  return canvasTex('bill', 256, 120, (c, w, h) => {
    c.fillStyle = '#9bd59b'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#3f7f4a'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#3f7f4a'; c.beginPath(); c.ellipse(w / 2, h / 2, 30, 34, 0, 0, 7); c.fill();
    c.font = '900 40px Inter'; c.fillText('100', 22, 50); c.fillText('100', w - 100, h - 22);
  });
}

function bubbleTex(text) {
  return canvasTex('bubble:' + text, 640, 360, (c, w, h) => {
    const lines = String(text).split('\n');
    c.fillStyle = '#ffffff'; c.strokeStyle = '#111111'; c.lineWidth = 10;
    const r = 70, x0 = 20, y0 = 20, x1 = w - 20, y1 = h - 95;
    c.beginPath(); c.moveTo(x0 + r, y0); c.arcTo(x1, y0, x1, y1, r); c.arcTo(x1, y1, x0, y1, r); c.arcTo(x0, y1, x0, y0, r); c.arcTo(x0, y0, x1, y0, r); c.closePath(); c.fill(); c.stroke();
    for (const [cx, cy, cr] of [[w * 0.42, h - 62, 22], [w * 0.36, h - 22, 13]]) { c.beginPath(); c.arc(cx, cy, cr, 0, 7); c.fill(); c.stroke(); }
    c.fillStyle = '#111111'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const fs = lines.length > 2 ? 54 : 66; c.font = `400 ${fs}px Anton`;
    lines.forEach((l, i) => c.fillText(l, w / 2, (y0 + y1) / 2 + (i - (lines.length - 1) / 2) * fs * 1.12, w - 90));
  });
}

export const PROPS = {
  thought: (o) => { const g = new THREE.Group(); g.userData.dom = true; g.userData.noShadow = true; return g; },
  cloud: (o) => {
    const g = new THREE.Group(), r = rng('cloud' + (o.seed || 1)), cm = mat('#ffffff', { roughness: 1 });
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + r() * 0.7, 0), cm); b.position.set((r() - 0.5) * 3.2, r() * 0.6, (r() - 0.5) * 1.2); g.add(b); }
    g.userData.noShadow = true; return g;
  },
  money: (o) => {
    const g = new THREE.Group(), n = o.count || 6, m = new THREE.MeshStandardMaterial({ map: billTex(), roughness: 0.9 });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.15), [mat('#8fcf8f'), mat('#8fcf8f'), m, m, mat('#8fcf8f'), mat('#8fcf8f')]);
      s.position.set((i % 3) * 0.34 - 0.34, 0.06 + Math.floor(i / 3) * 0.125, 0); s.castShadow = true; g.add(s);
      const band = box(0.06, 0.125, 0.155, '#f4e285', s.position.x, Math.floor(i / 3) * 0.125, 0); g.add(band);
    }
    return g;
  },
  moneyRain: (o) => {
    const n = o.count || 140, g = new THREE.Group();
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.1), new THREE.MeshStandardMaterial({ map: billTex(), side: THREE.DoubleSide, roughness: 0.9 }), n);
    im.castShadow = true; g.add(im);
    const r = rng('rain'), seeds = [...Array(n)].map(() => [r() * 6 - 3, r() * 6 - 3, r() * 4, r() * 6, 0.6 + r() * 0.5]);
    const d = new THREE.Object3D();
    g.userData.update = (t) => {
      seeds.forEach(([x, z, y0, ph, sp], i) => {
        const y = 4.5 - ((y0 + t * sp * 1.4) % 4.5);
        d.position.set(x + Math.sin(t * 2 + ph) * 0.3, y, z + Math.cos(t * 1.7 + ph) * 0.3);
        d.rotation.set(t * 3 + ph, t * 2 + ph, ph); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
    };
    return g;
  },
  coin: (o) => { const c = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.025, 14), '#f4c430', { opts: { metalness: 0.4, roughness: 0.4 } }); c.rotation.x = Math.PI / 2; const g = new THREE.Group(); c.position.y = 0.12; g.add(c); g.userData.update = (t) => { c.rotation.z = t * 4; }; return g; },
  phone: (o) => {
    const g = new THREE.Group();
    g.add(box(0.075, 0.15, 0.012, '#1b1b1b', 0, -0.075, 0));
    const tex = canvasTex('phone:' + (o.text || ''), 150, 300, (c, w, h) => {
      c.fillStyle = o.bg || '#ffffff'; c.fillRect(0, 0, w, h);
      c.fillStyle = o.fg || '#111'; c.font = '800 26px Inter'; c.textAlign = 'center';
      String(o.text || '').split('\n').forEach((l, i) => c.fillText(l, w / 2, 80 + i * 34));
    });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.135), new THREE.MeshBasicMaterial({ map: tex })); scr.position.set(0, -0.075, 0.0065); g.add(scr);
    return g;
  },
  bigPhone: (o) => { // screen-sized phone used for close inserts
    const g = new THREE.Group();
    g.add(box(0.75, 1.5, 0.06, '#1b1b1b', 0, 0, 0));
    const tex = canvasTex('bigphone:' + (o.text || ''), 300, 600, (c, w, h) => {
      c.fillStyle = o.bg || '#f4f6fb'; c.fillRect(0, 0, w, h); c.fillStyle = o.fg || '#111'; c.textAlign = 'center';
      c.font = '800 38px Inter'; String(o.text || '').split('\n').forEach((l, i) => c.fillText(l, w / 2, 160 + i * 52));
    });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 1.38), new THREE.MeshBasicMaterial({ map: tex })); scr.position.set(0, 0.75, 0.032); g.add(scr);
    return g;
  },
  sign: (o) => {
    const g = new THREE.Group(), w = o.w || 1.4, h = o.h || 0.8;
    if (o.post !== false) g.add(cyl(0.04, 0.04, o.postH || 1.2, '#6b4f3a', 0, 0, -0.03, 6));
    const p = textPlane(o.text || 'SIGN', w, h, { bg: o.bg || '#1b1b1b', fg: o.fg || '#ffd23f', size: o.size || 0.22, font: 'Anton' });
    p.position.set(0, (o.post !== false ? o.postH || 1.2 : 0) + h / 2, 0); g.add(p);
    g.add(box(w + 0.06, h + 0.06, 0.03, shade(o.bg || '#1b1b1b', 0.7), 0, (o.post !== false ? o.postH || 1.2 : 0) - 0.03, -0.02));
    return g;
  },
  backpack: (o) => {
    const g = new THREE.Group(), c = o.color || '#e63946';
    g.add(box(0.36, 0.45, 0.2, c, 0, 0, 0));
    const top = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 8, 1, false, 0, Math.PI), c); top.rotation.z = Math.PI / 2; top.position.y = 0.45; g.add(top);
    g.add(box(0.28, 0.18, 0.06, shade(c, 0.8), 0, 0.06, 0.12));
    for (const s of [-1, 1]) g.add(box(0.05, 0.4, 0.03, '#222', s * 0.1, 0.05, -0.115));
    for (const s of [-1, 1]) g.add(box(0.05, 0.22, 0.14, shade(c, 0.85), s * 0.2, 0.05, 0));
    g.add(box(0.3, 0.012, 0.012, '#f1f1f1', 0, 0.245, 0.152), box(0.24, 0.01, 0.012, '#f1f1f1', 0, 0.22, 0.102));
    const handle = mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI), '#222'); handle.position.set(0, 0.55, 0); g.add(handle);
    return g;
  },
  gift: (o) => { const g = new THREE.Group(), c = o.color || '#ef476f'; g.add(box(0.4, 0.35, 0.4, c)); g.add(box(0.42, 0.06, 0.08, '#ffd23f', 0, 0.35, 0), box(0.08, 0.36, 0.42, '#ffd23f', 0, 0, 0), box(0.42, 0.36, 0.08, '#ffd23f', 0, 0, 0)); return g; },
  ball: (o) => { const b = mesh(new THREE.IcosahedronGeometry(0.11, 1), o.color || '#ffffff'); b.position.y = 0.11; const g = new THREE.Group(); g.add(b); return g; },
  box: (o) => box(o.w || 0.5, o.h || 0.5, o.d || 0.5, o.color || '#c49a6c'),
  car: (o) => { const g = new THREE.Group(); carSet(g, 0, 0, 0, o.color || '#e63946'); return g; },
  tree: (o) => { const g = new THREE.Group(); treeSet(g, 0, 0, 1, o.seed || 1); return g; },
  cake: (o) => { const g = new THREE.Group(); g.add(cyl(0.3, 0.3, 0.25, '#f7c6d9', 0, 0, 0, 12), cyl(0.31, 0.31, 0.04, '#ffffff', 0, 0.25, 0, 12)); for (let i = 0; i < 5; i++) g.add(cyl(0.012, 0.012, 0.12, '#4cc9f0', Math.cos(i * 1.26) * 0.15, 0.29, Math.sin(i * 1.26) * 0.15, 5)); return g; },
  trophy: (o) => { const g = new THREE.Group(), gold = mat('#f4c430', { metalness: 0.5, roughness: 0.35 }); g.add(box(0.2, 0.08, 0.2, '#5a3e2b'), new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), gold).translateY(0.14)); const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.06, 0.2, 8), gold); cup.position.y = 0.3; g.add(cup); return g; },
  arrow: (o) => { // big 3D arrow pointing down at something
    const g = new THREE.Group(), c = o.color || '#ffd23f';
    const shaft = mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), c); shaft.position.y = 0.45; g.add(shaft);
    const head = mesh(new THREE.ConeGeometry(0.2, 0.28, 4), c); head.rotation.x = Math.PI; head.position.y = 0.14; g.add(head);
    g.userData.update = (t) => { g.children.forEach((ch) => (ch.position.y += 0)); g.position.y = (g.userData.baseY || 0) + Math.abs(Math.sin(t * 4)) * 0.12; };
    return g;
  },
  label: (o) => { const p = textPlane(o.text || '', o.w || 1.2, o.h || 0.4, { bg: o.bg || '#ffffff', fg: o.fg || '#111', size: o.size || 0.2, font: 'Anton' }); const g = new THREE.Group(); p.position.y = (o.h || 0.4) / 2; g.add(p); return g; },
};
