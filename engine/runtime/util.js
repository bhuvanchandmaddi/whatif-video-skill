// Shared helpers: materials, random, easing, canvas textures.
import * as THREE from './vendor/three.module.min.js';

export { THREE };
export const D2R = Math.PI / 180;

const MATS = new Map();
/** Flat-shaded material cached by colour (+ options key). */
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!MATS.has(key)) {
    MATS.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.88, metalness: 0, ...opts }));
  }
  return MATS.get(key);
}

export function mesh(geo, color, { cast = true, receive = true, opts } = {}) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, opts) : color);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** Box positioned by its bottom-centre (x, y, z). */
export function box(w, h, d, color, x = 0, y = 0, z = 0, o = {}) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), color, o);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function cyl(rTop, rBot, h, color, x = 0, y = 0, z = 0, sides = 8, o = {}) {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBot, h, sides), color, o);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function rng(seed) {
  let a = typeof seed === 'string' ? [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) : seed | 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
/** Overshoot pop 0..1 → ~1.1 → 1 */
export const pop = (t) => { t = clamp(t); const c = 1.70158 * 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

const TEX = new Map();
/**
 * Canvas texture with text/drawing. draw(ctx, w, h) for custom art.
 * Cached by key so a scene rebuild does not re-upload.
 */
export function canvasTex(key, w, h, draw) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  TEX.set(key, t);
  return t;
}

/** Plane showing text, e.g. signs, chalkboards, phone screens. */
export function textPlane(text, w, h, { bg = '#ffffff', fg = '#111111', font = 'Inter', weight = 800, size = 0.22, pad = 0.08, key } = {}) {
  const px = 256;
  const tex = canvasTex(key || `tp:${text}:${w}:${h}:${bg}:${fg}:${size}`, Math.round(w * px), Math.round(h * px), (ctx, cw, ch) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = String(text).split('\n');
    const fs = size * px;
    ctx.font = `${weight} ${fs}px ${font}`;
    lines.forEach((l, i) => ctx.fillText(l, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * fs * 1.15, cw - pad * px * 2));
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  m.receiveShadow = true;
  return m;
}

export function disposeTree(obj) {
  obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

/** Shade a hex colour: f<1 darker, f>1 lighter. */
export function shade(hex, f) {
  const c = new THREE.Color(hex);
  if (f < 1) c.multiplyScalar(f); else c.lerp(new THREE.Color('#ffffff'), f - 1);
  return '#' + c.getHexString();
}
