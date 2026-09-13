/* Minimal stand-in for the handful of three.js pieces the physics core touches.
   Nothing here is rendering — just the vector maths the sim actually uses. */

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  lerpVectors(a, b, t) {
    this.x = a.x + (b.x - a.x) * t;
    this.y = a.y + (b.y - a.y) * t;
    this.z = a.z + (b.z - a.z) * t;
    return this;
  }
  applyQuaternion(q) {
    const { x, y, z } = this, { x: qx, y: qy, z: qz, w: qw } = q;
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return this;
  }
}

export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
  clone() { return new Quaternion(this.x, this.y, this.z, this.w); }
  setFromEuler(e) {
    const c1 = Math.cos(e.x / 2), c2 = Math.cos(e.y / 2), c3 = Math.cos(e.z / 2);
    const s1 = Math.sin(e.x / 2), s2 = Math.sin(e.y / 2), s3 = Math.sin(e.z / 2);
    /* YXZ, matching the app's fallback hand rig */
    this.x = s1 * c2 * c3 + c1 * s2 * s3;
    this.y = c1 * s2 * c3 - s1 * c2 * s3;
    this.z = c1 * c2 * s3 - s1 * s2 * c3;
    this.w = c1 * c2 * c3 + s1 * s2 * s3;
    return this;
  }
  setFromAxisAngle(ax, a) {
    const h = a / 2, s = Math.sin(h);
    this.x = ax.x * s; this.y = ax.y * s; this.z = ax.z * s; this.w = Math.cos(h);
    return this;
  }
  multiply(q) {
    const { x: ax, y: ay, z: az, w: aw } = this, { x: bx, y: by, z: bz, w: bw } = q;
    this.x = ax * bw + aw * bx + ay * bz - az * by;
    this.y = ay * bw + aw * by + az * bx - ax * bz;
    this.z = az * bw + aw * bz + ax * by - ay * bx;
    this.w = aw * bw - ax * bx - ay * by - az * bz;
    return this;
  }
  invert() { this.x *= -1; this.y *= -1; this.z *= -1; return this; }
}

export class Euler {
  constructor(x = 0, y = 0, z = 0, order = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = order; }
}

export class DataTexture {
  constructor(d, w, h) { this.image = { data: d, width: w, height: h }; this.needsUpdate = false; }
}
export const RGBAFormat = 1023;
export const LinearFilter = 1006;

/* ── THE RENDERER-SHAPED HOLE ────────────────────────────────────────────
   The physics core used to touch nothing but Vector3 and Quaternion. It now
   sits in a file that also builds a net, a boat, obstacles and a speck cloud
   at module scope, so importing it at all means constructing those — and the
   harness stopped importing altogether once it did. (`THREE.SphereGeometry is
   not a constructor`, on HEAD, before any of this round's edits.)

   These exist ONLY so that construction succeeds. Following the rule the
   handoff sets out for this file — a stub that answers wrongly is worse than
   one that throws — none of them invents data: geometry that is asked for its
   vertices raises rather than handing back an empty buffer that some future
   measurement could quietly average to zero. If a stub below ever throws, the
   answer is to implement it properly, not to soften it. */
const inert = (name) => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === Symbol.toPrimitive || typeof k === 'symbol') return undefined;
    if (k === 'dispose' || k === 'computeVertexNormals' ||
        k === 'computeBoundingSphere' || k === 'setIndex') return () => {};
    throw new Error(`three-stub: ${name}.${String(k)} is not implemented — the ` +
                    `physics harness is not meant to read rendering data`);
  },
  set(t, k, v) { t[k] = v; return true; }
});

class Obj3D {
  constructor() {
    this.position = new Vector3(); this.scale = new Vector3(1, 1, 1);
    this.rotation = new Euler(); this.quaternion = new Quaternion();
    this.children = []; this.visible = true; this.userData = {};
    this.renderOrder = 0; this.matrixAutoUpdate = true; this.frustumCulled = true;
  }
  add(...o) { this.children.push(...o); return this; }
  remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); return this; }
  clear() { this.children.length = 0; return this; }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse && c.traverse(fn); }
  updateMatrixWorld() {}
  lookAt() {}
}
export class Group extends Obj3D {}
export class Mesh extends Obj3D {
  constructor(g, m) { super(); this.geometry = g; this.material = m; }
}
export class Points extends Mesh {}

export class BufferAttribute {
  constructor(a, n) { this.array = a; this.itemSize = n; this.count = a.length / n; this.needsUpdate = false; }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
  setXYZ(i, x, y, z) { const p = i * this.itemSize; this.array[p] = x; this.array[p + 1] = y; this.array[p + 2] = z; return this; }
}
export class Float32BufferAttribute extends BufferAttribute {
  constructor(a, n) { super(a instanceof Float32Array ? a : Float32Array.from(a), n); }
}
export class BufferGeometry {
  constructor() { this.attributes = {}; this.index = null; this.userData = {}; }
  setAttribute(n, a) { this.attributes[n] = a; return this; }
  getAttribute(n) { return this.attributes[n]; }
  setIndex(i) { this.index = i; return this; }
  setFromPoints() { return this; }
  computeVertexNormals() {}
  computeBoundingSphere() {}
  translate() { return this; }
  rotateX() { return this; }
  scale() { return this; }
  dispose() {}
}
/* The primitive geometries are pure rendering. They carry their parameters so
   a reader can see what was asked for, and refuse to produce vertices. */
const prim = (name) => class extends BufferGeometry {
  constructor(...args) {
    super(); this.type = name; this.parameters = args;
    this.attributes = inert(name + '.attributes');
  }
};
export const SphereGeometry   = prim('SphereGeometry');
export const BoxGeometry      = prim('BoxGeometry');
export const CylinderGeometry = prim('CylinderGeometry');
export const CapsuleGeometry  = prim('CapsuleGeometry');
export const RingGeometry     = prim('RingGeometry');

class Mat { constructor(p = {}) { Object.assign(this, p); } dispose() {} }
export class MeshStandardMaterial extends Mat {}
export class MeshBasicMaterial extends Mat {}
export class PointsMaterial extends Mat {}

export class Color {
  constructor(c = 0) { this.setHex(c); }
  setHex(c) { this.r = ((c >> 16) & 255) / 255; this.g = ((c >> 8) & 255) / 255; this.b = (c & 255) / 255; return this; }
  copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
  clone() { const c = new Color(); return c.copy(this); }
  lerp(c, t) { this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t; return this; }
  multiplyScalar(s) { this.r *= s; this.g *= s; this.b *= s; return this; }
  setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
  getHex() { return (Math.round(this.r * 255) << 16) | (Math.round(this.g * 255) << 8) | Math.round(this.b * 255); }
}
export class Vector2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy(v) { this.x = v.x; this.y = v.y; return this; }
}
export class Matrix4 {
  constructor() { this.elements = new Float64Array(16); this.elements[0] = this.elements[5] = this.elements[10] = this.elements[15] = 1; }
  makeRotationFromEuler() { return this; }
  setPosition() { return this; }
  identity() { return this; }
}
export const DoubleSide = 2;
export const BackSide = 1;
