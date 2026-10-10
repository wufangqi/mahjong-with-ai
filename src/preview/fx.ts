// 特效基础组件：粒子池、光柱、涟漪、字形采样
import * as THREE from 'three';
import glyphHu from '../fonts/glyph-hu.json';
import { visualRandom } from '../visual/rng';

const pointsVS = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const pointsFS = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d); a *= a;
  float core = smoothstep(0.14, 0.0, d);
  gl_FragColor = vec4(vColor * (a + core * 1.6), a * vAlpha);
}`;

export const pointUniforms = { uScale: { value: 400 } };

export function makePointsMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: pointUniforms,
    vertexShader: pointsVS,
    fragmentShader: pointsFS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

export type ParticleEmit = {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  color: [number, number, number];
  size?: number;
  life?: number;
  gravity?: number;
  drag?: number;
  twinkle?: number;
};

export class ParticlePool {
  cap: number;
  cursor = 0;
  pos: Float32Array;
  vel: Float32Array;
  col: Float32Array;
  size: Float32Array;
  base: Float32Array;
  alpha: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  grav: Float32Array;
  drag: Float32Array;
  twinkle: Float32Array;
  geo: THREE.BufferGeometry;
  points: THREE.Points;
  time = 0;

  constructor(cap = 4000) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.size = new Float32Array(cap);
    this.base = new Float32Array(cap);
    this.alpha = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.twinkle = new Float32Array(cap);
    const geo = new THREE.BufferGeometry();
    const mk = (arr: Float32Array, n: number) =>
      new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', mk(this.pos, 3));
    geo.setAttribute('aColor', mk(this.col, 3));
    geo.setAttribute('aSize', mk(this.size, 1));
    geo.setAttribute('aAlpha', mk(this.alpha, 1));
    this.geo = geo;
    this.points = new THREE.Points(geo, makePointsMaterial());
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(p: ParticleEmit): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    const i3 = i * 3;
    this.pos[i3] = p.x;
    this.pos[i3 + 1] = p.y;
    this.pos[i3 + 2] = p.z;
    this.vel[i3] = p.vx || 0;
    this.vel[i3 + 1] = p.vy || 0;
    this.vel[i3 + 2] = p.vz || 0;
    const c = p.color;
    this.col[i3] = c[0];
    this.col[i3 + 1] = c[1];
    this.col[i3 + 2] = c[2];
    this.base[i] = p.size ?? 0.15;
    this.life[i] = this.maxLife[i] = p.life ?? 1;
    this.grav[i] = p.gravity ?? -2;
    this.drag[i] = p.drag ?? 1.2;
    this.twinkle[i] = p.twinkle ?? 0;
  }

  update(dt: number): void {
    this.time += dt;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const i3 = i * 3;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= k;
      this.vel[i3 + 1] = this.vel[i3 + 1] * k + this.grav[i] * dt;
      this.vel[i3 + 2] *= k;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const r = Math.max(0, this.life[i] / this.maxLife[i]);
      const tw = this.twinkle[i] ? 0.55 + 0.45 * Math.sin(this.time * 30 + i * 1.7) : 1;
      this.alpha[i] = Math.min(1, r * 1.6) * tw;
      this.size[i] = this.base[i] * (0.4 + 0.6 * r);
    }
    for (const n of ['position', 'aColor', 'aSize', 'aAlpha'] as const) {
      this.geo.attributes[n].needsUpdate = true;
    }
  }

  clear(): void {
    this.life.fill(0);
    this.alpha.fill(0);
    this.size.fill(0);
  }
}

export type FxMesh = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

export function makePillar(color: THREE.ColorRepresentation, radius = 1): FxMesh {
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 64, 1, true);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform float uIntensity;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float h = vUv.y;
        float fade = smoothstep(0.0, 0.03, h) * pow(1.0 - h, 1.4);
        float streak = 0.55 + 0.45 * sin(h * 46.0 - uTime * 14.0 + vUv.x * 6.2831 * 5.0);
        float streak2 = 0.6 + 0.4 * sin(h * 13.0 - uTime * 6.0 - vUv.x * 6.2831 * 2.0);
        vec3 c = uColor * pow(facing, 1.6) * fade * streak * streak2 * uIntensity;
        gl_FragColor = vec4(c, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 4;
  return m;
}

export function makeRipple(color: THREE.ColorRepresentation, size = 14): FxMesh {
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: -1 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: 1 },
      uSpeed: { value: 4.5 },
      uGlow: { value: 0.35 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform float uIntensity; uniform float uSpeed; uniform float uGlow;
      varying vec2 vP;
      void main() {
        float d = length(vP);
        float a = 0.0;
        for (int i = 0; i < 4; i++) {
          float t = uTime - float(i) * 0.24;
          if (t > 0.0) {
            float r = t * uSpeed;
            float w = 0.08 + t * 0.12;
            float f = clamp(1.0 - t / 1.8, 0.0, 1.0);
            a += exp(-pow((d - r) / w, 2.0)) * f * f;
          }
        }
        float glow = uTime > 0.0 ? exp(-d * 1.4) * clamp(1.0 - uTime / 1.0, 0.0, 1.0) * uGlow : 0.0;
        gl_FragColor = vec4(uColor * (a + glow) * uIntensity, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 3;
  return m;
}

/**
 * Sample particle targets for a glyph silhouette.
 * Top-tier 「胡」 uses the offline bitmap (`glyph-hu.json`) so CI / fontless hosts
 * never depend on runtime system CJK fonts.
 */
export function sampleGlyph(text: string, count: number, font: string): Float32Array {
  let pts: Array<[number, number]>;
  if (text === '胡') {
    pts = glyphHu.points as Array<[number, number]>;
  } else {
    const S = 320;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 270px ${font}`;
    ctx.fillText(text, S / 2, S / 2 + 8);
    const data = ctx.getImageData(0, 0, S, S).data;
    pts = [];
    for (let y = 0; y < S; y += 2)
      for (let x = 0; x < S; x += 2) {
        if (data[(y * S + x) * 4 + 3] > 120) pts.push([x / S - 0.5, 0.5 - y / S]);
      }
  }
  if (!pts.length) pts.push([0, 0]);
  const out = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const p = pts[(visualRandom() * pts.length) | 0]!;
    out[i * 2] = p[0]! + (visualRandom() - 0.5) * 0.006;
    out[i * 2 + 1] = p[1]! + (visualRandom() - 0.5) * 0.006;
  }
  return out;
}

export const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.9,
      c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inCubic: (t: number) => t * t * t,
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
