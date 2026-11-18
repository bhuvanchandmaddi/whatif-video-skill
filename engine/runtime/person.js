// Low-poly rigged people. One builder for the hero and every NPC so the style always matches.
import { THREE, D2R, mat, mesh, shade, rng, lerp, smooth, clamp } from './util.js';

/** The recurring main character. Change ONLY here to restyle every video. */
export const HERO = {
  skin: '#b5835a', hair: '#1d1a1a', hairStyle: 'quiff',
  top: 'hoodie', topColor: '#14a39a', accent: '#ffd23f',
  bottom: 'pants', bottomColor: '#2b2f3a', shoes: '#ffd23f', sole: '#f4f4f4',
};

/** Ready-made NPC looks the storyboard can reference by name. */
export const PRESETS = {
  hero: HERO,
  mom: { skin: '#a8754f', hair: '#1a1414', hairStyle: 'bun', female: true, top: 'kurta', topColor: '#d64f7a', accent: '#ffcf5a', bottom: 'pants', bottomColor: '#f2e6d0', shoes: '#7a4b2a' },
  dad: { skin: '#9c6b47', hair: '#2a2420', hairStyle: 'short', mustache: true, top: 'shirt', topColor: '#6c8cc4', bottom: 'pants', bottomColor: '#3a3a42', shoes: '#3b2a20' },
  brother: { skin: '#b5835a', hair: '#1d1a1a', hairStyle: 'cap', capColor: '#e63946', kid: true, top: 'tshirt', topColor: '#3fae49', bottom: 'shorts', bottomColor: '#30475e', shoes: '#ffffff' },
  sister: { skin: '#b07c55', hair: '#201818', hairStyle: 'ponytail', kid: true, female: true, top: 'tshirt', topColor: '#9b5de5', bottom: 'skirt', bottomColor: '#f15bb5', shoes: '#ffffff' },
  teacher: { skin: '#8d5e3c', hair: '#3a3a3a', hairStyle: 'short', glasses: true, top: 'shirt', topColor: '#f1f1f1', tie: '#b23a48', bottom: 'pants', bottomColor: '#4a4e69', shoes: '#2b2b2b' },
  boss: { skin: '#c99772', hair: '#555555', hairStyle: 'bald', mustache: true, top: 'suit', topColor: '#2d3142', tie: '#e63946', bottom: 'pants', bottomColor: '#2d3142', shoes: '#111111' },
  friend: { skin: '#9a6644', hair: '#ff4fa3', hairStyle: 'mohawk', top: 'tshirt', topColor: '#ffbe0b', bottom: 'pants', bottomColor: '#3d5a80', shoes: '#ffffff' },
  girl: { skin: '#c48c64', hair: '#2b1d16', hairStyle: 'long', female: true, top: 'tshirt', topColor: '#ef476f', bottom: 'pants', bottomColor: '#26547c', shoes: '#ffffff' },
  oldman: { skin: '#a77a56', hair: '#e8e8e8', hairStyle: 'short', beard: '#e8e8e8', glasses: true, top: 'shirt', topColor: '#a26769', bottom: 'pants', bottomColor: '#5c5552', shoes: '#3b2a20' },
  cop: { skin: '#8d5e3c', hair: '#1a1a1a', hairStyle: 'cap', capColor: '#1d3557', top: 'shirt', topColor: '#1d3557', bottom: 'pants', bottomColor: '#14213d', shoes: '#111111', tie: '#111111' },
  doctor: { skin: '#c48c64', hair: '#2b1d16', hairStyle: 'bun', female: true, glasses: true, top: 'coat', topColor: '#f8f9fa', bottom: 'pants', bottomColor: '#5fa8d3', shoes: '#ffffff' },
};

const SKIN_TONES = ['#c99772', '#b5835a', '#9c6b47', '#8d5e3c', '#6f4a30', '#d8a984'];
const CLOTH = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#8338ec', '#3a86ff', '#ff006e', '#06d6a0', '#118ab2', '#6d6875', '#ef476f'];
const HAIR = ['#1a1414', '#2b1d16', '#3d2b1f', '#5a3825', '#111111', '#7b5e3b'];

/** Deterministic random extra for crowds. */
export function randomLook(seed) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const female = r() < 0.45;
  return {
    skin: pick(SKIN_TONES), hair: pick(HAIR), female,
    hairStyle: female ? pick(['long', 'bun', 'ponytail']) : pick(['short', 'short', 'quiff', 'bald', 'cap']),
    capColor: pick(CLOTH),
    top: pick(['tshirt', 'tshirt', 'hoodie', 'shirt']), topColor: pick(CLOTH), accent: pick(CLOTH),
    bottom: female && r() < 0.3 ? 'skirt' : 'pants', bottomColor: pick(['#2b2f3a', '#3d5a80', '#1d3557', '#5c5552', '#2f3e46']),
    shoes: pick(['#ffffff', '#111111', '#7a4b2a']), glasses: r() < 0.15,
  };
}

function limb(len, r0, r1, color, sides = 7) {
  const g = new THREE.CylinderGeometry(r0, r1, len, sides, 1);
  g.translate(0, -len / 2, 0);
  return mesh(g, color);
}

function joint(parent, x = 0, y = 0, z = 0) {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

/**
 * Build a person. Returns { root, j (joints), face, look, height }.
 * root sits on the floor at its origin and faces +z.
 */
export function makePerson(lookIn = {}) {
  const look = { ...HERO, ...(typeof lookIn === 'string' ? PRESETS[lookIn] || {} : lookIn) };
  const F = look.female ? 0.92 : 1;
  const sleeve = ['tshirt'].includes(look.top) ? null : look.topColor;
  const root = new THREE.Group();
  const body = joint(root, 0, 0, 0); // pivot for lying down / leaning the whole body
  const hips = joint(body, 0, 0.96, 0);
  const spine = joint(hips, 0, 0, 0);
  const j = { root, body, hips, spine };
  const pantsC = look.bottomColor;

  // pelvis
  const pelvis = mesh(new THREE.CylinderGeometry(0.165 * F, 0.15, 0.16, 8), pantsC);
  pelvis.position.y = -0.03; hips.add(pelvis);

  // torso
  const torsoTop = look.top === 'kurta' || look.top === 'coat' ? look.topColor : look.topColor;
  const torso = mesh(new THREE.CylinderGeometry(0.2 * F, 0.168 * F, 0.52, 8), torsoTop);
  torso.position.y = 0.26; torso.scale.z = 0.78; spine.add(torso);
  if (look.top === 'hoodie') {
    const hood = mesh(new THREE.TorusGeometry(0.12, 0.05, 5, 9, Math.PI * 1.1), shade(look.topColor, 0.85));
    hood.rotation.set(Math.PI / 2, 0, Math.PI * 0.95); hood.position.set(0, 0.5, -0.03); spine.add(hood);
    for (const s of [-1, 1]) {
      const str = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.15, 4), '#f4f4f4');
      str.position.set(s * 0.045, 0.4, 0.165); spine.add(str);
    }
    const pocket = mesh(new THREE.BoxGeometry(0.22, 0.1, 0.03), shade(look.topColor, 0.85));
    pocket.position.set(0, 0.1, 0.13); spine.add(pocket);
    const badge = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10), look.accent);
    badge.rotation.x = Math.PI / 2; badge.position.set(0.085, 0.33, 0.158); spine.add(badge);
  }
  if (look.top === 'shirt' || look.top === 'suit' || look.top === 'coat') {
    const collar = mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.06, 8), look.top === 'suit' ? '#f1f1f1' : shade(look.topColor, 0.9));
    collar.position.y = 0.52; spine.add(collar);
  }
  if (look.top === 'suit' || look.top === 'coat') {
    for (const s of [-1, 1]) {
      const lapel = mesh(new THREE.BoxGeometry(0.07, 0.3, 0.02), shade(look.topColor, 0.8));
      lapel.position.set(s * 0.06, 0.36, 0.152); lapel.rotation.z = s * 0.25; spine.add(lapel);
    }
  }
  if (look.tie) {
    const tie = mesh(new THREE.BoxGeometry(0.045, 0.3, 0.02), look.tie);
    tie.position.set(0, 0.34, 0.158); spine.add(tie);
  }
  if (look.top === 'kurta' || look.top === 'coat') {
    const skirtTop = mesh(new THREE.CylinderGeometry(0.17 * F, 0.25, 0.5, 8), look.topColor);
    skirtTop.position.y = -0.2; skirtTop.scale.z = 0.85; skirtTop.userData.noSelfShadow = true; hips.add(skirtTop);
    if (look.top === 'kurta') {
      const trim = mesh(new THREE.CylinderGeometry(0.253, 0.255, 0.05, 8), look.accent);
      trim.position.y = -0.43; trim.scale.z = 0.86; trim.userData.noSelfShadow = true; hips.add(trim);
      const dup = mesh(new THREE.BoxGeometry(0.42, 0.06, 0.02), look.accent);
      dup.position.set(0, 0.42, 0.13); dup.rotation.z = -0.5; spine.add(dup);
    }
  }
  if (look.bottom === 'skirt') {
    const sk = mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.38, 8), look.bottomColor);
    sk.position.y = -0.17; hips.add(sk);
  }

  // neck + head
  const neck = joint(spine, 0, 0.52, 0);
  const nk = limb(0.09, 0.052, 0.058, look.skin, 6); nk.rotation.x = Math.PI; nk.position.y = -0.01; neck.add(nk);
  const head = joint(neck, 0, 0.07, 0);
  j.neck = neck; j.head = head;
  const face = buildHead(head, look);

  // arms
  for (const s of [1, -1]) {
    const k = s > 0 ? 'l' : 'r';
    const sh = joint(spine, s * 0.215 * F, 0.47, 0);
    const shoulderBall = mesh(new THREE.SphereGeometry(0.062, 6, 4), sleeve || look.topColor); sh.add(shoulderBall);
    const ua = limb(0.29, 0.058, 0.048, sleeve || (look.top === 'tshirt' && 1 ? look.topColor : look.skin));
    sh.add(ua);
    if (look.top === 'tshirt') { // short sleeve then skin
      ua.scale.y = 0.45;
      const arm = limb(0.17, 0.044, 0.042, look.skin); arm.position.y = -0.12; sh.add(arm);
    }
    const el = joint(sh, 0, -0.29, 0);
    const fa = limb(0.26, 0.046, 0.038, sleeve || look.skin); el.add(fa);
    if (sleeve) {
      const cuff = mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.03, 7), look.top === 'suit' ? '#f1f1f1' : shade(sleeve, 0.85));
      cuff.position.y = -0.245; el.add(cuff);
    }
    const wr = joint(el, 0, -0.27, 0);
    const hand = mesh(new THREE.BoxGeometry(0.06, 0.09, 0.035), look.skin);
    hand.position.y = -0.04; wr.add(hand);
    const thumb = mesh(new THREE.BoxGeometry(0.022, 0.045, 0.022), look.skin);
    thumb.position.set(-s * 0.0, -0.02, 0.03); thumb.rotation.x = -0.4; wr.add(thumb);
    j[k + 'Sh'] = sh; j[k + 'El'] = el; j[k + 'Wr'] = wr;
  }

  // legs
  for (const s of [1, -1]) {
    const k = s > 0 ? 'l' : 'r';
    const hp = joint(hips, s * 0.088, -0.03, 0);
    const shorts = look.bottom === 'shorts';
    const th = limb(0.44, 0.085, 0.066, look.bottomColor); hp.add(th);
    if (shorts) { th.scale.y = 0.55; const lg = limb(0.2, 0.06, 0.055, look.skin); lg.position.y = -0.24; hp.add(lg); }
    if (look.bottom === 'skirt' || look.top === 'kurta') { th.material = mat(look.top === 'kurta' ? look.bottomColor : look.skin); }
    const kn = joint(hp, 0, -0.44, 0);
    const shinC = shorts || look.bottom === 'skirt' ? look.skin : look.bottomColor;
    const sh = limb(0.42, 0.06, 0.047, shinC); kn.add(sh);
    if (!shorts && look.bottom !== 'skirt') {
      const cuff = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 7), shade(look.bottomColor, 0.8)); cuff.position.y = -0.4; kn.add(cuff);
    }
    const an = joint(kn, 0, -0.42, 0);
    const shoe = mesh(new THREE.BoxGeometry(0.105, 0.075, 0.25), look.shoes);
    shoe.position.set(0, -0.04, 0.05); an.add(shoe);
    const sole = mesh(new THREE.BoxGeometry(0.11, 0.025, 0.255), look.sole || shade(look.shoes, 0.6));
    sole.position.set(0, -0.083, 0.05); an.add(sole);
    j[k + 'Hip'] = hp; j[k + 'Kn'] = kn; j[k + 'An'] = an;
  }

  let s = 1;
  if (look.kid) { s = 0.66; head.scale.setScalar(1.28); }
  root.userData.baseScale = s;
  root.scale.setScalar(s);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = !o.userData.noSelfShadow; } });
  return { root, j, face, look, height: 1.78 * s };
}

function buildHead(head, look) {
  const skin = look.skin;
  const g = new THREE.SphereGeometry(1, 8, 7);
  // squash bottom into a jaw
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < -0.2) { p.setX(i, p.getX(i) * (0.82 + 0.18 * (1 + y))); p.setZ(i, p.getZ(i) * 0.92); }
  }
  g.computeVertexNormals();
  const h = mesh(g, skin);
  h.scale.set(0.118, 0.142, 0.13); h.position.y = 0.14; head.add(h);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.BoxGeometry(0.025, 0.05, 0.035), shade(skin, 0.92)); ear.position.set(s * 0.118, 0.14, 0); head.add(ear);
  }
  const nose = mesh(new THREE.ConeGeometry(0.022, 0.05, 4), shade(skin, 0.93));
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.125, 0.135); head.add(nose);

  const face = { eyes: [], brows: [], parts: {} };
  const dark = '#141010';
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(s * 0.045, 0.158, 0.112); head.add(eg);
    const white = mesh(new THREE.SphereGeometry(0.02, 8, 6), '#fbfbfb', { cast: false }); white.scale.set(1, 1.05, 0.45); eg.add(white);
    const pupil = mesh(new THREE.SphereGeometry(0.0135, 8, 6), dark, { cast: false }); pupil.position.z = 0.008; pupil.scale.z = 0.5; eg.add(pupil);
    const hl = mesh(new THREE.SphereGeometry(0.0045, 5, 4), '#ffffff', { cast: false, opts: { emissive: '#ffffff', emissiveIntensity: 0.6 } });
    hl.position.set(0.005, 0.005, 0.015); eg.add(hl);
    face.eyes.push(eg);
    const br = mesh(new THREE.BoxGeometry(0.05, 0.012, 0.014), look.hair === '#ff4fa3' ? '#2a1a1a' : shade(look.hair, 0.9), { cast: false });
    br.position.set(s * 0.047, 0.2, 0.118); head.add(br); br.userData.s = s; face.brows.push(br);
  }
  const mouth = new THREE.Group(); mouth.position.set(0, 0.075, 0.118); head.add(mouth);
  const lineM = mesh(new THREE.BoxGeometry(0.045, 0.008, 0.01), '#5a2a22', { cast: false }); mouth.add(lineM);
  const smile = mesh(new THREE.TorusGeometry(0.024, 0.006, 4, 8, Math.PI), '#5a2a22', { cast: false }); smile.rotation.z = Math.PI; smile.position.y = 0.016; mouth.add(smile);
  const open = mesh(new THREE.SphereGeometry(0.022, 8, 6), '#4a1414', { cast: false }); open.scale.set(1.1, 0.8, 0.35); mouth.add(open);
  const teeth = mesh(new THREE.BoxGeometry(0.03, 0.008, 0.01), '#ffffff', { cast: false }); teeth.position.set(0, 0.012, 0.006); open.add(teeth);
  face.parts = { mouth, lineM, smile, open };
  face.blinkSeed = Math.random() * 10;

  if (look.glasses) {
    for (const s of [-1, 1]) {
      const r = mesh(new THREE.TorusGeometry(0.026, 0.005, 4, 10), '#1b1b1b', { cast: false }); r.position.set(s * 0.045, 0.158, 0.128); head.add(r);
    }
    const b = mesh(new THREE.BoxGeometry(0.03, 0.006, 0.006), '#1b1b1b', { cast: false }); b.position.set(0, 0.16, 0.13); head.add(b);
  }
  if (look.mustache) {
    const m = mesh(new THREE.BoxGeometry(0.06, 0.015, 0.02), look.hair === '#555555' ? '#3a3a3a' : look.hair); m.position.set(0, 0.098, 0.124); head.add(m);
  }
  if (look.beard) {
    const b = mesh(new THREE.SphereGeometry(0.09, 7, 5, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), look.beard);
    b.scale.set(1.25, 1.1, 1.3); b.position.set(0, 0.12, 0.01); head.add(b);
  }
  buildHair(head, look);
  return face;
}

function buildHair(head, look) {
  const c = look.hair;
  const add = (geo, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, col = c) => {
    const m = mesh(geo, col); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); head.add(m); return m;
  };
  const cap = () => new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
  switch (look.hairStyle) {
    case 'bald':
      add(new THREE.SphereGeometry(1, 8, 3, Math.PI * 0.95, Math.PI * 1.1, Math.PI * 0.4, Math.PI * 0.22), 0, 0.14, -0.005, 0.124, 0.15, 0.134);
      break;
    case 'quiff':
      add(cap(), 0, 0.165, -0.01, 0.128, 0.13, 0.138, -0.15);
      add(new THREE.IcosahedronGeometry(1, 0), 0.01, 0.275, 0.06, 0.1, 0.05, 0.075, 0.5, 0.2, 0.1);
      add(new THREE.IcosahedronGeometry(1, 0), -0.03, 0.27, 0.02, 0.085, 0.045, 0.07, 0.2, -0.3, 0);
      break;
    case 'short':
      add(cap(), 0, 0.165, -0.01, 0.126, 0.125, 0.137, -0.12);
      break;
    case 'mohawk':
      add(cap(), 0, 0.17, -0.01, 0.122, 0.08, 0.13, -0.1, 0, 0, '#2a1a1a');
      add(new THREE.BoxGeometry(1, 1, 1), 0, 0.29, -0.01, 0.04, 0.13, 0.25, -0.1);
      add(new THREE.ConeGeometry(1, 1, 4), 0, 0.37, 0.07, 0.03, 0.08, 0.03, 0.6);
      break;
    case 'cap': {
      add(cap(), 0, 0.17, -0.01, 0.13, 0.13, 0.14, -0.1, 0, 0, look.capColor || '#e63946');
      const brim = add(new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, -Math.PI / 2, Math.PI), 0, 0.215, 0.07, 0.11, 0.012, 0.15, 0.1, 0, 0, shade(look.capColor || '#e63946', 0.8));
      brim.rotation.y = 0;
      add(new THREE.BoxGeometry(1, 1, 1), 0, 0.12, -0.11, 0.2, 0.08, 0.04, 0, 0, 0, c);
      break;
    }
    case 'long':
      add(cap(), 0, 0.168, -0.01, 0.13, 0.13, 0.142, -0.12);
      add(new THREE.BoxGeometry(1, 1, 1), 0, 0.03, -0.075, 0.25, 0.32, 0.09);
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(1, 1, 1), s * 0.11, 0.07, 0.0, 0.04, 0.22, 0.12);
      break;
    case 'bun':
      add(cap(), 0, 0.168, -0.01, 0.128, 0.128, 0.14, -0.12);
      add(new THREE.IcosahedronGeometry(1, 1), 0, 0.22, -0.13, 0.065, 0.065, 0.065);
      break;
    case 'ponytail':
      add(cap(), 0, 0.168, -0.01, 0.128, 0.128, 0.14, -0.12);
      add(new THREE.ConeGeometry(1, 1, 5), 0, 0.06, -0.16, 0.05, 0.22, 0.05, 0.25);
      break;
    default:
      add(cap(), 0, 0.165, -0.01, 0.126, 0.125, 0.137, -0.12);
  }
}

// ---------------------------------------------------------------- expressions + mouth
const EXPR = {
  neutral: { brow: 0, browY: 0, eye: 1, mouth: 'line' },
  happy: { brow: 0.1, browY: 0.004, eye: 0.85, mouth: 'smile' },
  smirk: { brow: -0.1, browY: 0, eye: 0.8, mouth: 'smile' },
  shocked: { brow: 0.05, browY: 0.018, eye: 1.35, mouth: 'open', open: 1 },
  scared: { brow: 0.35, browY: 0.012, eye: 1.25, mouth: 'open', open: 0.6 },
  sad: { brow: 0.45, browY: 0.004, eye: 0.85, mouth: 'frown' },
  angry: { brow: -0.45, browY: -0.006, eye: 0.9, mouth: 'line' },
  sleep: { brow: 0, browY: -0.004, eye: 0.1, mouth: 'line' },
  laugh: { brow: 0.15, browY: 0.01, eye: 0.35, mouth: 'open', open: 0.8 },
};

export function setFace(face, expr, t, talk = 0) {
  const e = EXPR[expr] || EXPR.neutral;
  const blinkPhase = (t + face.blinkSeed) % 3.7;
  const blink = blinkPhase < 0.12 ? Math.abs(Math.sin((blinkPhase / 0.12) * Math.PI)) : 0;
  const eyeY = Math.max(0.08, e.eye * (1 - blink * 0.9));
  face.eyes.forEach((g) => { g.scale.set(e.eye > 1 ? e.eye : 1, eyeY, 1); });
  face.brows.forEach((b) => { b.rotation.z = -b.userData.s * e.brow; b.position.y = 0.2 + e.browY; });
  const { lineM, smile, open } = face.parts;
  let openAmt = e.mouth === 'open' ? e.open : 0;
  if (talk > 0) openAmt = Math.max(openAmt, talk * (0.35 + 0.65 * Math.abs(Math.sin(t * 17) * Math.sin(t * 7.3 + 1))));
  lineM.visible = e.mouth === 'line' && openAmt < 0.15;
  smile.visible = (e.mouth === 'smile' || e.mouth === 'frown') && openAmt < 0.15;
  smile.rotation.z = e.mouth === 'frown' ? 0 : Math.PI;
  smile.position.y = e.mouth === 'frown' ? -0.012 : 0.016;
  open.visible = openAmt >= 0.15;
  open.scale.set(e.mouth === 'open' && !talk ? 0.9 : 1.1, 0.25 + 0.75 * openAmt, 0.35);
}

// ---------------------------------------------------------------- poses
// Joint angles in degrees. Conventions (character faces +z):
//   shoulder x<0 raises arm forward; l shoulder z>0 / r shoulder z<0 raises arm sideways
//   elbow x<0 bends forearm forward; hip x<0 swings leg forward; knee x>0 bends
//   spine/neck x>0 lean/look down; neck y>0 turns head to its left
const ZERO = { y: 0, bx: 0, bz: 0, hips: [0, 0, 0], spine: [0, 0, 0], neck: [0, 0, 0], lSh: [0, 0, 6], rSh: [0, 0, -6], lEl: [0, 0, 0], rEl: [0, 0, 0], lWr: [0, 0, 0], rWr: [0, 0, 0], lHip: [0, 0, 0], rHip: [0, 0, 0], lKn: [0, 0, 0], rKn: [0, 0, 0], lAn: [0, 0, 0], rAn: [0, 0, 0] };
const P = (o) => {
  const r = JSON.parse(JSON.stringify(ZERO));
  for (const k in o) r[k] = Array.isArray(o[k]) ? [...o[k]] : o[k];
  return r;
};
const sin = Math.sin;

export const ACTIONS = {
  idle: (t) => P({ spine: [1 + sin(t * 2.1) * 1.2, 0, 0], neck: [0, sin(t * 0.7) * 4, 0], lSh: [2, 0, 7 + sin(t * 2.1)], rSh: [2, 0, -7 - sin(t * 2.1)], lEl: [-8, 0, 0], rEl: [-8, 0, 0] }),
  walk: (t) => {
    const p = t * Math.PI * 2 * 1.7;
    return P({ y: Math.abs(sin(p)) * 0.025, spine: [4, sin(p) * 4, 0], neck: [-3, 0, 0], hips: [0, -sin(p) * 5, 0],
      lHip: [-28 * sin(p), 0, 0], rHip: [28 * sin(p), 0, 0], lKn: [8 + 32 * Math.max(0, sin(p + 1.4)), 0, 0], rKn: [8 + 32 * Math.max(0, -sin(p + 1.4)), 0, 0],
      lSh: [24 * sin(p), 0, 8], rSh: [-24 * sin(p), 0, -8], lEl: [-18, 0, 0], rEl: [-18, 0, 0] });
  },
  run: (t) => {
    const p = t * Math.PI * 2 * 2.6;
    return P({ y: Math.abs(sin(p)) * 0.07, spine: [14, sin(p) * 8, 0], neck: [-10, 0, 0],
      lHip: [-50 * sin(p) - 10, 0, 0], rHip: [50 * sin(p) - 10, 0, 0], lKn: [20 + 70 * Math.max(0, sin(p + 1.6)), 0, 0], rKn: [20 + 70 * Math.max(0, -sin(p + 1.6)), 0, 0],
      lSh: [50 * sin(p), 0, 12], rSh: [-50 * sin(p), 0, -12], lEl: [-85, 0, 0], rEl: [-85, 0, 0] });
  },
  talk: (t) => P({ spine: [1, sin(t * 1.3) * 4, 0], neck: [sin(t * 2.3) * 3, sin(t * 0.9) * 8, sin(t * 1.7) * 3],
    lSh: [-8, 0, 8], rSh: [-38 + sin(t * 3.1) * 12, 0, -14 - sin(t * 2.3) * 8], lEl: [-15, 0, 0], rEl: [-70 + sin(t * 4.2) * 15, 0, 0], _talk: 1 }),
  explain: (t) => P({ spine: [2, 0, 0], neck: [sin(t * 2) * 3, sin(t * 1.1) * 6, 0], lSh: [-35 + sin(t * 2.7) * 10, 0, 20], rSh: [-35 - sin(t * 2.7) * 10, 0, -20], lEl: [-70, 0, 0], rEl: [-70, 0, 0], lWr: [0, 0, 0], _talk: 1 }),
  wave: (t) => P({ spine: [0, -6, 0], lSh: [0, 0, 8], rSh: [-10, 0, -150], rEl: [0, 0, -20 + sin(t * 9) * 25], neck: [0, 0, 4], _expr: 'happy' }),
  cheer: (t) => P({ y: Math.max(0, sin(t * 7)) * 0.12, spine: [-6, 0, 0], neck: [-10, 0, 0], lSh: [0, 0, 160 + sin(t * 7) * 8], rSh: [0, 0, -160 - sin(t * 7) * 8], lEl: [0, 0, 15], rEl: [0, 0, -15], lKn: [Math.max(0, -sin(t * 7)) * 30, 0, 0], rKn: [Math.max(0, -sin(t * 7)) * 30, 0, 0], lHip: [-Math.max(0, -sin(t * 7)) * 15, 0, 0], rHip: [-Math.max(0, -sin(t * 7)) * 15, 0, 0], _expr: 'laugh' }),
  shocked: (t) => P({ spine: [-8, 0, 0], neck: [-6, 0, 0], lSh: [-115, 0, 35], rSh: [-115, 0, -35], lEl: [-105, 0, 0], rEl: [-105, 0, 0], lHip: [6, 0, 0], rHip: [-4, 0, 0], _expr: 'shocked' }),
  scared: (t) => P({ y: -0.04, spine: [10, 0, 0], neck: [6, sin(t * 20) * 2, 0], lSh: [-70, 0, 25], rSh: [-70, 0, -25], lEl: [-120, 0, 0], rEl: [-120, 0, 0], lHip: [-12, 0, 0], rHip: [-12, 0, 0], lKn: [20, 0, 0], rKn: [20, 0, 0], _expr: 'scared' }),
  facepalm: (t) => P({ spine: [10, 0, 0], neck: [18, 0, 0], rSh: [-95, 0, -12], rEl: [-125, 0, 0], lSh: [0, 0, 8], _expr: 'sad' }),
  think: (t) => P({ neck: [-6, 10, 8], rSh: [-50, 0, -8], rEl: [-135, 0, 0], lSh: [-30, 0, 30], lEl: [-95, 0, 0], _expr: 'neutral' }),
  point: (t) => P({ spine: [0, -10, 0], rSh: [-88, 0, -5], rEl: [-5, 0, 0], neck: [0, -5, 0], lSh: [0, 0, 8] }),
  pointUp: (t) => P({ rSh: [-165, 0, -10], rEl: [0, 0, 0], neck: [-25, 0, 0] }),
  thumbsup: (t) => P({ rSh: [-55, 0, -15], rEl: [-70, 0, 0], rWr: [0, 0, 0], neck: [0, 0, 5], _expr: 'happy' }),
  shrug: (t) => P({ neck: [0, 0, 10], lSh: [-20, 0, 45], rSh: [-20, 0, -45], lEl: [-90, 30, 0], rEl: [-90, -30, 0], _expr: 'smirk' }),
  sad: (t) => P({ spine: [14, 0, 0], neck: [24, 0, 0], lSh: [4, 0, 3], rSh: [4, 0, -3], _expr: 'sad' }),
  angry: (t) => P({ spine: [6, 0, 0], neck: [-4, 0, 0], lSh: [-10, 0, 20], rSh: [-10, 0, -20], lEl: [-40, 0, 0], rEl: [-40, 0, 0], _expr: 'angry', _talk: 0.6 }),
  lookUp: (t) => P({ spine: [-6, 0, 0], neck: [-35, 0, 0], lSh: [0, 0, 10], rSh: [0, 0, -10], _expr: 'shocked' }),
  lookDown: (t) => P({ spine: [8, 0, 0], neck: [35, 0, 0] }),
  sit: (t) => P({ y: -0.46, spine: [-4 + sin(t * 2) * 1, 0, 0], lHip: [-88, 0, 4], rHip: [-88, 0, -4], lKn: [88, 0, 0], rKn: [88, 0, 0], lSh: [-25, 0, 8], rSh: [-25, 0, -8], lEl: [-45, 0, 0], rEl: [-45, 0, 0] }),
  sitTalk: (t) => P({ y: -0.46, spine: [-2, sin(t) * 4, 0], neck: [0, sin(t * 0.9) * 8, 0], lHip: [-88, 0, 4], rHip: [-88, 0, -4], lKn: [88, 0, 0], rKn: [88, 0, 0], lSh: [-25, 0, 8], rSh: [-45 + sin(t * 3) * 10, 0, -15], lEl: [-45, 0, 0], rEl: [-80, 0, 0], _talk: 1 }),
  lie: (t) => P({ bx: -90, y: 0, spine: [0, 0, 0], neck: [-5, 0, 0], lSh: [0, 0, 10], rSh: [0, 0, -10], _expr: 'sleep' }),
  phone: (t) => P({ neck: [28, 0, 0], spine: [4, 0, 0], rSh: [-40, 0, -8], rEl: [-95, 0, 0], lSh: [-30, 0, 8], lEl: [-90, 0, 0] }),
  jump: (t) => { const u = (t % 0.8) / 0.8; return P({ y: Math.sin(u * Math.PI) * 0.45, lSh: [0, 0, 150], rSh: [0, 0, -150], lKn: [30 * (1 - Math.sin(u * Math.PI)), 0, 0], rKn: [30 * (1 - Math.sin(u * Math.PI)), 0, 0], _expr: 'laugh' }); },
  push: (t) => P({ spine: [20, 0, 0], lSh: [-85, 0, 10], rSh: [-85, 0, -10], lEl: [-20, 0, 0], rEl: [-20, 0, 0], lHip: [-30, 0, 0], rHip: [25, 0, 0], lKn: [30, 0, 0], _expr: 'angry' }),
  carry: (t) => P({ spine: [-4, 0, 0], lSh: [-60, 0, 15], rSh: [-60, 0, -15], lEl: [-50, 0, 0], rEl: [-50, 0, 0] }),
  crouch: (t) => P({ y: -0.35, spine: [25, 0, 0], neck: [-15, 0, 0], lHip: [-80, 0, 8], rHip: [-80, 0, -8], lKn: [120, 0, 0], rKn: [120, 0, 0], lAn: [-35, 0, 0], rAn: [-35, 0, 0], lSh: [-40, 0, 10], rSh: [-40, 0, -10], lEl: [-40, 0, 0], rEl: [-40, 0, 0] }),
  dance: (t) => { const p = t * Math.PI * 2 * 1.2; return P({ y: Math.abs(sin(p)) * 0.05, hips: [0, sin(p) * 15, sin(p) * 5], spine: [0, sin(p) * 10, sin(p) * 6], lSh: [-30 + sin(p) * 40, 0, 40], rSh: [-30 - sin(p) * 40, 0, -40], lEl: [-80, 0, 0], rEl: [-80, 0, 0], lKn: [Math.max(0, sin(p)) * 25, 0, 0], rKn: [Math.max(0, -sin(p)) * 25, 0, 0], _expr: 'happy' }); },
  sleep: (t) => ACTIONS.lie(t),
  typing: (t) => P({ y: -0.46, spine: [8, 0, 0], neck: [12, 0, 0], lHip: [-88, 0, 4], rHip: [-88, 0, -4], lKn: [88, 0, 0], rKn: [88, 0, 0], lSh: [-45, 0, 12], rSh: [-45, 0, -12], lEl: [-55 + sin(t * 18) * 6, 0, 0], rEl: [-55 + sin(t * 17 + 1) * 6, 0, 0] }),
  float: (t) => P({ y: sin(t * 2) * 0.05, spine: [-4, 0, 0], neck: [-8, 0, 0], lSh: [-20, 0, 55 + sin(t * 2) * 8], rSh: [-20, 0, -55 - sin(t * 2) * 8], lEl: [-20, 0, 0], rEl: [-20, 0, 0], lHip: [-12, 0, 4], rHip: [6, 0, -4], lKn: [25 + sin(t * 2.3) * 6, 0, 0], rKn: [42 - sin(t * 2.3) * 6, 0, 0], lAn: [30, 0, 0], rAn: [30, 0, 0], _expr: 'happy' }),
  laugh: (t) => P({ y: Math.abs(sin(t * 9)) * 0.02, spine: [-10 + sin(t * 9) * 4, 0, 0], neck: [-22 + sin(t * 9) * 5, 0, 0], lSh: [-40, 0, 15], rSh: [-40, 0, -15], lEl: [-95, 0, 0], rEl: [-95, 0, 0], _expr: 'laugh' }),
  floatLaugh: (t) => P({ y: sin(t * 2) * 0.05, spine: [-12 + sin(t * 9) * 5, 0, 0], neck: [-24 + sin(t * 9) * 5, 0, 0], lSh: [-40, 0, 18], rSh: [-40, 0, -18], lEl: [-95, 0, 0], rEl: [-95, 0, 0], lHip: [-20 + sin(t * 9) * 8, 0, 4], rHip: [-5, 0, -4], lKn: [45, 0, 0], rKn: [60, 0, 0], lAn: [30, 0, 0], rAn: [30, 0, 0], _expr: 'laugh' }),
  sitLaugh: (t) => P({ y: -0.46, spine: [-8 + sin(t * 9) * 4, 0, 0], neck: [-20 + sin(t * 9) * 5, 0, 0], lHip: [-88, 0, 4], rHip: [-88, 0, -4], lKn: [88, 0, 0], rKn: [88, 0, 0], lSh: [-40, 0, 15], rSh: [-40, 0, -15], lEl: [-95, 0, 0], rEl: [-95, 0, 0], _expr: 'laugh' }),
  sitPhone: (t) => P({ y: -0.46, spine: [6, 0, 0], neck: [25 + sin(t * 0.8) * 2, 0, 0], lHip: [-88, 0, 4], rHip: [-88, 0, -4], lKn: [88, 0, 0], rKn: [88, 0, 0], rSh: [-40, 0, -8], rEl: [-95, 0, 0], lSh: [-30, 0, 8], lEl: [-90, 0, 0] }),
  phoneWalk: (t) => { const w = ACTIONS.walk(t); return { ...w, neck: [25, 0, 0], rSh: [-40, 0, -8], rEl: [-95, 0, 0], lSh: [-30, 0, 8], lEl: [-90, 0, 0] }; },
  hunch: (t) => P({ y: -0.05, spine: [28 + sin(t * 1.5) * 2, 0, 0], neck: [-18, 0, 0], lSh: [10, 0, 6], rSh: [-25, 0, -8], rEl: [-30, 0, 0], lHip: [-10, 0, 0], rHip: [-10, 0, 0], lKn: [18, 0, 0], rKn: [18, 0, 0], _expr: 'sad' }),
  hunchWalk: (t) => { const w = ACTIONS.walk(t * 0.55); return { ...w, y: w.y * 0.4 - 0.05, spine: [28, w.spine[1], 0], neck: [-18, 0, 0], lKn: [w.lKn[0] * 0.6 + 15, 0, 0], rKn: [w.rKn[0] * 0.6 + 15, 0, 0], lHip: [w.lHip[0] * 0.5 - 8, 0, 0], rHip: [w.rHip[0] * 0.5 - 8, 0, 0], lSh: [8, 0, 6], rSh: [-25, 0, -8], rEl: [-30, 0, 0], _expr: 'sad' }; },
  fall: (t) => P({ bx: Math.min(1, t / 0.5) * 85, y: 0, lSh: [-120, 0, 30], rSh: [-120, 0, -30], _expr: 'scared' }),
};

const KEYS = Object.keys(ZERO).filter((k) => Array.isArray(ZERO[k]));

export function blendPose(a, b, w) {
  if (w <= 0) return a;
  if (w >= 1) return b;
  const r = { y: lerp(a.y, b.y, w), bx: lerp(a.bx, b.bx, w), bz: lerp(a.bz || 0, b.bz || 0, w), _talk: w > 0.5 ? b._talk : a._talk, _expr: w > 0.5 ? b._expr : a._expr };
  for (const k of KEYS) r[k] = [0, 1, 2].map((i) => lerp(a[k][i], b[k][i], w));
  return r;
}

export function applyPose(person, pose) {
  const { j } = person;
  j.body.position.y = pose.y;
  j.body.rotation.set(pose.bx * D2R, 0, (pose.bz || 0) * D2R);
  if (pose.bx < -45) j.body.position.y = pose.y + 0.0; // lying: caller positions on bed
  const set = (o, v) => o.rotation.set(v[0] * D2R, v[1] * D2R, v[2] * D2R);
  set(j.hips, pose.hips); set(j.spine, pose.spine); set(j.neck, pose.neck);
  for (const k of ['lSh', 'rSh', 'lEl', 'rEl', 'lWr', 'rWr', 'lHip', 'rHip', 'lKn', 'rKn', 'lAn', 'rAn']) set(j[k], pose[k]);
}

/** Evaluate the action timeline [{t, a}] at time t with cross-fades. */
export function poseAt(actions, t, fade = 0.28) {
  let i = 0;
  for (let k = 0; k < actions.length; k++) if (actions[k].t <= t) i = k;
  const cur = actions[i];
  const pc = (ACTIONS[cur.a] || ACTIONS.idle)(t - cur.t + (cur.phase || 0));
  if (i === 0) return pc;
  const prev = actions[i - 1];
  const w = smooth((t - cur.t) / fade);
  if (w >= 1) return pc;
  const pp = (ACTIONS[prev.a] || ACTIONS.idle)(t - prev.t + (prev.phase || 0));
  return blendPose(pp, pc, w);
}
