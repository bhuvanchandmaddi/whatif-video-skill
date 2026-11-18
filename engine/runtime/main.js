// Runtime entry: window.setup(timeline) then window.renderFrame(t) for every frame (deterministic).
import { THREE, D2R, clamp, lerp, smooth, easeOut, easeInOut, pop, rng, disposeTree } from './util.js';
import { makePerson, randomLook, poseAt, applyPose, setFace, PRESETS } from './person.js';
import { SETS } from './sets.js';
import { PROPS } from './props.js';

const W = 1080, H = 1920;
let TL = null, renderer, camera, cur = { idx: -1 };
const $ = (id) => document.getElementById(id);

window.setup = async (tl) => {
  TL = tl;
  await Promise.all(['Anton', 'LuckiestGuy', 'JetBrains Mono', 'Inter'].map((f) => document.fonts.load(`800 40px "${f}"`)));
  renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  camera = new THREE.PerspectiveCamera(56, W / H, 0.05, 400);
  $('watermark').textContent = tl.watermark || '';
  window.ready = true;
  return true;
};

// ---------------------------------------------------------------- shot building
function resolveAt(set, at) {
  if (Array.isArray(at)) return { p: [at[0], at[1]], y: at[2] || 0, face: undefined };
  if (typeof at === 'string') {
    const s = set.spots[at];
    if (!s) { console.warn('unknown spot', at, 'available:', Object.keys(set.spots).join(',')); return { p: [0, 0], y: 0 }; }
    return { p: [...s.p], y: s.y || 0, face: s.face, sitY: s.sitY };
  }
  if (at && typeof at === 'object') { const b = resolveAt(set, at.spot); b.p[0] += at.dx || 0; b.p[1] += at.dz || 0; return b; }
  return { p: [0, 0], y: 0 };
}

function buildShot(i) {
  const shot = TL.shots[i];
  if (cur.scene) { disposeTree(cur.scene); }
  const scene = new THREE.Scene();
  const setFn = SETS[shot.set] || SETS.studio;
  const set = setFn(shot.setOpts || {});
  scene.add(set.group);
  scene.background = new THREE.Color(set.sky || '#8ccfff');
  if (set.fog) scene.fog = new THREE.Fog(set.sky || '#8ccfff', set.fog[0], set.fog[1]);

  const actors = {};
  for (const a of shot.actors || []) {
    const person = makePerson(a.look || (a.id === 'hero' ? 'hero' : PRESETS[a.id] ? a.id : 'friend'));
    const at = resolveAt(set, a.at || 'center');
    const sitting = (a.actions || []).some((x) => /^(sit|sitTalk|typing)$/.test(x.a));
    const baseY = (a.y ?? at.y) + (sitting && at.sitY ? at.sitY - 0.5 : 0);
    const st = { def: a, person, pos: new THREE.Vector3(at.p[0], baseY, at.p[1]), spotFace: at.face, yaw: 0, baseScale: person.root.userData.baseScale };
    scene.add(person.root);
    actors[a.id] = st;
  }
  // crowds
  const crowd = [];
  for (const c of shot.crowds || []) {
    const r = rng(c.seed || 'crowd');
    const [x0, z0, x1, z1] = c.area || [-6, -10, 6, 2];
    for (let k = 0; k < (c.n || 12); k++) {
      const look = c.look === 'hero' ? 'hero' : (c.looks ? c.looks[k % c.looks.length] : randomLook((c.seed || 's') + k));
      const p = makePerson(look);
      const s = (c.scale || 1) * (c.scaleVar ? 1 - c.scaleVar / 2 + r() * c.scaleVar : 1);
      p.root.scale.setScalar(p.root.userData.baseScale * s);
      const st = { person: p, x: x0 + r() * (x1 - x0), z: z0 + r() * (z1 - z0), dir: c.dir ?? (r() < 0.5 ? 0 : 180), speed: c.action === 'run' ? 2.8 : 1.1, phase: r() * 5, action: c.action || 'idle', area: [x0, z0, x1, z1], faceCam: c.faceCam };
      if (c.dir === 'random') st.dir = r() * 360;
      scene.add(p.root); crowd.push(st);
    }
  }
  // props
  const props = [];
  for (const pd of shot.props || []) {
    const fn = PROPS[pd.type];
    if (!fn) { console.warn('unknown prop', pd.type); continue; }
    const obj = fn(pd);
    const noSh = obj.userData.noShadow;
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = !noSh; o.receiveShadow = !noSh; } });
    if (pd.hand && actors[pd.hand]) {
      const wr = actors[pd.hand].person.j[pd.side === 'l' ? 'lWr' : 'rWr'];
      obj.position.set(0, -0.06, 0.04); obj.rotation.set(-Math.PI / 2 + 0.3, 0, 0);
      wr.add(obj);
    } else {
      const at = resolveAt(set, pd.at || 'center');
      obj.position.set(at.p[0], pd.y ?? at.y ?? 0, at.p[1]);
      obj.rotation.y = (pd.ry || 0) * D2R;
      scene.add(obj);
    }
    obj.userData.baseY = obj.position.y;
    const s = pd.scale || 1; obj.scale.setScalar(s);
    props.push({ def: pd, obj, s });
  }
  const bub = $('bubbles'); bub.innerHTML = '';
  for (const pr of props) if (pr.obj.userData.dom) {
    const el = document.createElement('div'); el.className = 'bubble';
    el.innerHTML = String(pr.def.text || '...').split('\n').map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>') + '<i class="a"></i><i class="b"></i>';
    el.style.display = 'none'; bub.appendChild(el); pr.dom = el;
  }
  cur = { idx: i, key: shot.key, shot, scene, set, actors, crowd, props };
  // facing needs a camera position: evaluate camera at shot start
  updateActors(0, true);
  const camTarget = (shot.cam && shot.cam.target) || (actors.hero ? 'hero' : Object.keys(actors)[0]);
  const order = Object.keys(actors).sort((a, b) => (a === camTarget ? -1 : b === camTarget ? 1 : 0));
  const pending = [];
  for (const id of order) {
    const st = actors[id], f = st.def.face ?? st.spotFace ?? 'cam';
    if (f === 'cam' && id === camTarget) st.faceYaw = 0;
    else if (f === 'cam' || (typeof f === 'string' && actors[f] && actors[f].faceYaw === undefined)) pending.push([st, f]);
    else st.faceYaw = faceToYaw(st, f, null);
  }
  const c0 = cameraAt(0);
  for (const [st, f] of pending) st.faceYaw = faceToYaw(st, f, c0.pos);
}

function faceToYaw(st, f, camPos) {
  if (typeof f === 'number') return f * D2R;
  if (f === 'cam') return Math.atan2(camPos.x - st.pos.x, camPos.z - st.pos.z);
  if (typeof f === 'string' && cur.actors[f]) { const o = cur.actors[f].pos; return Math.atan2(o.x - st.pos.x, o.z - st.pos.z); }
  if (Array.isArray(f)) return Math.atan2(f[0] - st.pos.x, f[1] - st.pos.z);
  return 0;
}

function scaleAt(def, t) {
  let s = def.scale ?? 1, squash = 0;
  for (const c of def.scales || []) {
    if (t < c.t) break;
    const d = c.dur ?? 0.35, u = clamp((t - c.t) / d);
    const from = s; s = lerp(from, c.to, easeOut(u));
    if (u < 1) squash = Math.sin(u * Math.PI) * 0.12 * Math.sign(c.to - from);
  }
  return { s, squash };
}

function updateActors(t, init = false) {
  for (const id in cur.actors) {
    const st = cur.actors[id], d = st.def, p = st.person;
    // movement (to = [x, z] or [x, z, y] or spot name; gait 'none' keeps the actions, e.g. floating up)
    let moving = null, pos = st.pos.clone();
    const start = st.pos;
    let px = start.x, pz = start.z, py = start.y;
    for (const m of d.moves || []) {
      const to = Array.isArray(m.to) ? m.to : resolveAt(cur.set, m.to).p;
      const ty = to.length > 2 ? to[2] : py;
      if (t >= m.t1) { px = to[0]; pz = to[1]; py = ty; continue; }
      if (t >= m.t0) {
        const u = clamp((t - m.t0) / Math.max(0.01, m.t1 - m.t0));
        const k = m.ease === 'in' ? u * u * u : m.ease === 'linear' ? u : (to.length > 2 ? easeInOut(u) : u);
        if (Math.hypot(to[0] - px, to[1] - pz) > 0.05 && m.gait !== 'none') moving = { dx: to[0] - px, dz: to[1] - pz, gait: m.gait || 'walk' };
        px = lerp(px, to[0], k); pz = lerp(pz, to[1], k); py = lerp(py, ty, k);
      }
      break;
    }
    pos.set(px, py, pz);
    p.root.position.copy(pos);
    st.cur = pos;
    if (init) continue;
    // facing
    let yaw = st.faceYaw ?? 0;
    if (moving) yaw = Math.atan2(moving.dx, moving.dz);
    else if (d.turns) for (const tr of d.turns) if (t >= tr.t) yaw = faceToYaw({ pos }, tr.face, camera.position);
    p.root.rotation.y = yaw + (d.lean || 0) * 0;
    // pose
    const acts = d.actions && d.actions.length ? d.actions : [{ t: 0, a: 'idle' }];
    let pose = poseAt(moving ? [{ t: 0, a: moving.gait }] : acts, t + (d.phase || 0) * 0);
    applyPose(p, pose);
    // expression
    let ex = pose._expr || 'neutral';
    for (const e of d.exprs || []) if (t >= e.t) ex = e.e;
    let talk = pose._talk ? 1 : 0;
    for (const [a, b] of d.talk || []) if (t >= a && t < b) talk = 1;
    setFace(p.face, ex, t, talk);
    // scale
    const { s, squash } = scaleAt(d, t);
    const bs = st.baseScale * s;
    p.root.scale.set(bs * (1 + squash * 0.5), bs * (1 - squash), bs * (1 + squash * 0.5));
    st.scaleNow = s;
    st.visible = !(d.hideAt != null && t >= d.hideAt) && !(d.showAt != null && t < d.showAt);
    p.root.visible = st.visible;
  }
}

function updateCrowd(t) {
  for (const c of cur.crowd) {
    const p = c.person;
    let x = c.x, z = c.z;
    if (c.action === 'walk' || c.action === 'run') {
      const dx = Math.sin(c.dir * D2R), dz = Math.cos(c.dir * D2R);
      const [x0, z0, x1, z1] = c.area, L = Math.max(x1 - x0, z1 - z0);
      const dist = (t + c.phase) * c.speed;
      x = c.x + dx * dist; z = c.z + dz * dist;
      const wrap = (v, a, b) => a + ((((v - a) % (b - a)) + (b - a)) % (b - a));
      x = wrap(x, x0, x1); z = wrap(z, z0, z1);
      p.root.rotation.y = c.dir * D2R;
    } else if (c.faceCam) {
      p.root.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
    } else p.root.rotation.y = c.dir * D2R;
    p.root.position.set(x, 0, z);
    const pose = poseAt([{ t: 0, a: c.action }], t + c.phase);
    applyPose(p, pose);
    setFace(p.face, pose._expr || 'neutral', t + c.phase, pose._talk ? 1 : 0);
  }
}

function updateProps(t) {
  for (const pr of cur.props) {
    const d = pr.def;
    let s = pr.s;
    if (d.appear != null) s *= t < d.appear ? 0 : pop((t - d.appear) / 0.35);
    if (d.vanish != null && t >= d.vanish) s *= Math.max(0, 1 - (t - d.vanish) / 0.25);
    if (d.grow) { for (const g of d.grow) if (t >= g.t) s = lerp(s, g.to, easeOut((t - g.t) / (g.dur || 0.4))); }
    pr.obj.scale.setScalar(Math.max(0.0001, s));
    pr.obj.visible = s > 0.001;
    if (d.spin) pr.obj.rotation.y = (d.ry || 0) * D2R + t * d.spin;
    if (pr.obj.userData.update) pr.obj.userData.update(t);
  }
}

// ---------------------------------------------------------------- camera
const SHOT = {
  close: { d: 0.5, y: 0.92, ly: 0.9 },
  medium: { d: 0.85, y: 0.84, ly: 0.76 },
  full: { d: 1.75, y: 0.62, ly: 0.52 },
  wide: { d: 3.6, y: 1.25, ly: 0.5, min: 5.5 },
  low: { d: 1.05, y: 0.12, ly: 0.72 },
  high: { d: 1.2, y: 1.75, ly: 0.45 },
  top: { d: 0.25, y: 3.4, ly: 0.0, min: 0 },
  hands: { d: 0.4, y: 0.62, ly: 0.52 },
};

const _hv = new THREE.Vector3();
function headPos(st, Hs) {
  st.person.root.updateMatrixWorld(true);
  st.person.j.head.getWorldPosition(_hv);
  return _hv.clone().setY(_hv.y + 0.08 * Hs);
}

function cameraAt(t, lt = t) {
  const shot = cur.shot, c = shot.cam || {}, dur = shot.t1 - shot.t0;
  const u = clamp(t / Math.max(0.1, dur));
  let pos, look;
  const tgtId = c.target || (cur.actors.hero ? 'hero' : Object.keys(cur.actors)[0]);
  const tgt = cur.actors[tgtId];
  if (c.type === 'custom' || !tgt) {
    pos = new THREE.Vector3(...(c.pos || [0, 3, 8])); look = new THREE.Vector3(...(c.look || [0, 1, 0]));
    if (c.pos2) pos.lerp(new THREE.Vector3(...c.pos2), easeInOut(u));
    if (c.look2) look.lerp(new THREE.Vector3(...c.look2), easeInOut(u));
  } else {
    const anchor = (tgt.cur || tgt.pos).clone();
    const Hh = 1.78 * tgt.baseScale * (tgt.scaleNow ?? scaleAt(tgt.def, lt).s) * (c.fit || 1);
    const type = c.type || 'medium';
    if (type === 'ots' || type === 'pov') {
      const other = cur.actors[c.other] || null;
      const oPos = other ? (other.cur || other.pos) : anchor.clone().add(new THREE.Vector3(0, 0, -3));
      const Hs = Hh / (c.fit || 1);
      const oH = other ? 1.78 * other.baseScale * (other.scaleNow ?? 1) : Hs;
      const th = headPos(tgt, Hs), oh = other ? headPos(other, oH) : oPos.clone().setY(oPos.y + 0.9 * oH);
      const dir = new THREE.Vector3().subVectors(oPos, anchor).setY(0).normalize();
      const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(c.side ?? 1);
      if (type === 'ots') pos = th.clone().addScaledVector(dir, -0.5 * Hh).addScaledVector(side, 0.24 * Hh).setY(th.y + 0.06 * Hs);
      else pos = th.clone().addScaledVector(dir, 0.08 * Hs);
      look = oh.clone().setY(oh.y - 0.12 * oH);
      if (c.move === 'push') pos.lerp(look, 0.25 * easeInOut(u));
    } else {
      const Hs = Hh / (c.fit || 1);
    const ground = anchor.y;
    const head = headPos(tgt, Hs);
    const S = SHOT[type] || SHOT.medium;
    let d = Math.max(S.d * Hh * (c.dist || 1), S.min ?? 0.3);
    if (type === 'wide' && c.dist) d = c.dist;
    let y, ly, lookXZ = anchor;
    switch (type) {
      case 'close': y = head.y + 0.02 * Hs; ly = head.y + 0.012 * Hs; lookXZ = head; break;
      case 'medium': y = head.y - 0.02 * Hs; ly = head.y - 0.06 * Hs; lookXZ = head; break;
      case 'hands': y = head.y - 0.3 * Hs; ly = head.y - 0.42 * Hs; lookXZ = head; break;
      case 'low': y = ground + 0.12 * Hs; ly = head.y - 0.1 * Hs; break;
      case 'high': y = head.y + 0.85 * Hs; ly = head.y - 0.4 * Hs; break;
      case 'top': y = ground + (c.height ?? Math.max(3, 3.4 * Hs)); ly = ground; break;
      case 'wide': y = ground + (c.height ?? Math.max(1.6, 1.25 * Hs)); ly = ground + 0.5 * Hs; break;
      default: ly = head.y - 0.12 * Hs; y = ly + 0.04 * Hs; // full
    }
    // azimuth is relative to the target's facing: 0 = in front of the face, 180 = behind
    let az = (tgt.faceYaw ?? 0) + (c.angle ?? 12) * D2R;
    const mv = c.move || 'static', e = easeInOut(u);
    if (mv === 'push') d *= lerp(1.18, 0.82, e);
    if (mv === 'pull') d *= lerp(0.82, 1.25, e);
    if (mv === 'crash') d *= lerp(1.9, 1.0, easeOut(clamp(t / 0.45)));
    if (mv === 'orbitL') az += lerp(-0.3, 0.3, e);
    if (mv === 'orbitR') az -= lerp(-0.3, 0.3, e);
    if (mv === 'rise') y += lerp(-0.3, 0.5, e) * Hs;
    if (mv === 'drop') y += lerp(0.5, -0.3, e) * Hs;
    pos = new THREE.Vector3(lookXZ.x + Math.sin(az) * d, y + (c.dy || 0), lookXZ.z + Math.cos(az) * d);
    look = new THREE.Vector3(lookXZ.x + (c.lx || 0), ly + (c.ly || 0), lookXZ.z + (c.lz || 0));
    }
  }
  // gentle handheld drift
  const hh = c.handheld ?? 1;
  pos.x += Math.sin(t * 0.9 + cur.idx) * 0.012 * hh; pos.y += Math.sin(t * 1.3 + cur.idx * 2) * 0.008 * hh;
  // shakes
  for (const s of TL.shakes || []) {
    const dt = (shot.t0 + t) - s.t;
    if (dt >= 0 && dt < (s.dur || 0.5)) { const a = (s.amp || 0.05) * (1 - dt / (s.dur || 0.5)); pos.x += Math.sin(dt * 70) * a; pos.y += Math.cos(dt * 55) * a; }
  }
  if (cur.set.bounds) { const [bx, bz] = cur.set.bounds; pos.x = clamp(pos.x, -bx, bx); pos.z = clamp(pos.z, -bz, bz); pos.y = clamp(pos.y, 0.15, 2.85); }
  return { pos, look, fov: c.fov || 56 };
}

// ---------------------------------------------------------------- overlays
function fmtNum(v, fmt) {
  const n = Math.round(v);
  const s = Math.abs(n) >= 10000 ? n.toLocaleString('en-US') : (fmt && fmt.includes('$') ? n.toLocaleString('en-US') : String(n));
  return (fmt || '{v}').replace('{v}', s);
}

function overlays(t) {
  // title
  const ti = (TL.titles || []).find((x) => t >= x.t0 && t < x.t1);
  const el = $('title');
  if (ti) {
    if (el.dataset.k !== ti.text) { el.innerHTML = ti.text.replace(/\*([^*]+)\*/g, '<b>$1</b>').replace(/!([^!]+)!/g, '<i>$1</i>').replace(/\n/g, '<br>'); el.dataset.k = ti.text; }
    el.style.display = 'block';
    el.style.top = (ti.top ?? 230) + 'px';
    const k = pop((t - ti.t0) / 0.4) * (t > ti.t1 - 0.2 ? clamp((ti.t1 - t) / 0.2) : 1);
    el.style.transform = `scale(${k})`;
  } else el.style.display = 'none';

  // counter
  const C = TL.counter, ce = $('counter');
  let ev = null, prev = null;
  if (C) for (const e of C.events) { if (e.t <= t) { prev = ev; ev = e; } }
  if (ev && ev.v !== null && ev.v !== undefined) {
    let v = ev.v;
    if (ev.roll && prev && prev.v != null) v = lerp(prev.v, ev.v, easeInOut((t - ev.t) / ev.roll));
    $('counterVal').textContent = typeof ev.v === 'string' ? ev.v : fmtNum(v, ev.fmt || C.fmt);
    $('counterLabel').textContent = ev.label ?? C.label ?? '';
    $('counterLabel').style.display = (ev.label ?? C.label) ? 'inline' : 'none';
    ce.className = ev.color || 'green';
    ce.style.display = 'block';
    const k = ev.roll ? 1 : pop((t - ev.t) / 0.3);
    ce.style.top = (ev.top ?? C.top ?? 545) + 'px';
    ce.style.transform = `translateX(-50%) scale(${t - ev.t < 0.3 ? k : 1})`;
  } else ce.style.display = 'none';

  // captions
  const cap = (TL.captions || []).find((x) => t >= x.t0 && t < x.t1);
  const cp = $('caption');
  if (cap) {
    const key = cap.t0.toFixed(3);
    if (cp.dataset.k !== key) {
      cp.innerHTML = '<span class="box">' + cap.words.map(([w, c]) => {
        const e = w.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return c === 'y' ? `<em>${e}</em>` : c === 'r' ? `<s>${e}</s>` : c === 'g' ? `<u>${e}</u>` : e;
      }).join(' ') + '</span>';
      cp.dataset.k = key;
    }
    cp.style.display = 'block';
    cp.style.top = (TL.captionTop ?? 1230) + 'px';
    const k = 0.85 + 0.15 * easeOut((t - cap.t0) / 0.12);
    cp.style.transform = `scale(${k})`;
  } else cp.style.display = 'none';

  // CTA
  const cta = TL.cta, ctaEl = $('cta');
  if (cta && t >= cta.t0) {
    ctaEl.style.display = 'block';
    ctaEl.querySelector('.cta-handle').textContent = cta.handle;
    ctaEl.style.transform = `scale(${pop((t - cta.t0) / 0.4)})`;
  } else ctaEl.style.display = 'none';

  // flash
  let fl = 0;
  for (const f of TL.flashes || []) { const dt = t - f; if (dt >= 0 && dt < 0.3) fl = Math.max(fl, 0.85 * (1 - dt / 0.3)); }
  $('flash').style.opacity = fl;
}

// ---------------------------------------------------------------- 2D thought bubbles
const _pv = new THREE.Vector3();
function placeBubble(pr) {
  const el = pr.dom, d = pr.def, k = pr.obj.scale.x / (pr.s || 1);
  const st = d.over && cur.actors[d.over];
  if (!st || !st.visible || k <= 0.01) { el.style.display = 'none'; return; }
  const Hs = 1.78 * st.baseScale * (st.scaleNow ?? 1);
  _pv.copy(headPos(st, Hs)); _pv.y += 0.16 * Hs;
  const inFront = _pv.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3())) > 0;
  _pv.project(camera);
  const x = (_pv.x + 1) / 2 * W, y = (1 - _pv.y) / 2 * H;
  if (!inFront || x < -60 || x > W + 60 || y < -200 || y > H + 100) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const bw = el.offsetWidth, bh = el.offsetHeight, tail = 90;
  const left = clamp(x - bw / 2 + (d.shift || 0), 30, W - 30 - bw);
  const top = clamp(y - bh - tail, 650, 1190 - bh - tail);
  el.style.transform = `translate(${left}px, ${top}px) scale(${pop(Math.min(1, k)) * (d.scale || 1)})`;
}

// ---------------------------------------------------------------- frame
window.renderFrame = (t) => {
  let i = TL.shots.findIndex((s) => t >= s.t0 && t < s.t1);
  if (i < 0) i = t < TL.shots[0].t0 ? 0 : TL.shots.length - 1;
  const shot = TL.shots[i];
  if (shot.key !== cur.key) buildShot(i);
  cur.shot = shot; cur.idx = i;
  const lt = t - shot.sceneT0;   // scene-local time drives animation (continuous across camera cuts)
  updateActors(lt);
  updateCrowd(lt);
  updateProps(lt);
  cur.scene.updateMatrixWorld(true);
  const c = cameraAt(t - shot.t0, lt);
  camera.fov = c.fov; camera.updateProjectionMatrix();
  camera.position.copy(c.pos); camera.lookAt(c.look);
  camera.updateMatrixWorld(true);
  for (const pr of cur.props) {
    const d = pr.def;
    if (d.over && cur.actors[d.over]) {
      const st = cur.actors[d.over];
      const Hs = 1.78 * st.baseScale * (st.scaleNow ?? 1);
      const hp = headPos(st, Hs);
      pr.obj.position.set(hp.x + (d.dx ?? 0.25) * Hs, hp.y + (d.dy ?? 0.42) * Hs, hp.z);
      if (!st.visible) pr.obj.visible = false;
    }
    if (d.over || d.billboard || pr.obj.userData.billboard) pr.obj.quaternion.copy(camera.quaternion);
    if (pr.dom) placeBubble(pr);
  }
  renderer.render(cur.scene, camera);
  overlays(t);
  return true;
};

window.listSpots = () => Object.fromEntries(Object.entries(SETS).map(([k, f]) => [k, Object.keys(f({}).spots)]));
window.listActions = async () => Object.keys((await import('./person.js')).ACTIONS);
