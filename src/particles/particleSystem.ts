import * as THREE from 'three';
import type { ParticleBackend } from '../quality/types';
import type { CreateParticleSystemOptions, ParticleEmit, ParticleSystem } from './types';

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

function makeGpuMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } },
    vertexShader: pointsVS,
    fragmentShader: pointsFS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function makeCpuMaterial(): THREE.PointsMaterial {
  return new THREE.PointsMaterial({
    size: 0.12,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

class BufferParticleSystem implements ParticleSystem {
  readonly backend: ParticleBackend;
  readonly points: THREE.Points;
  readonly capacity: number;

  private budget: number;
  private cursor = 0;
  private time = 0;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly base: Float32Array;
  private readonly alpha: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly grav: Float32Array;
  private readonly drag: Float32Array;
  private readonly twinkle: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private readonly material: THREE.Material;

  constructor(capacity: number, backend: ParticleBackend) {
    this.capacity = capacity;
    this.budget = capacity;
    this.backend = backend;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.base = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.twinkle = new Float32Array(capacity);

    const geo = new THREE.BufferGeometry();
    const mk = (arr: Float32Array, n: number) =>
      new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', mk(this.pos, 3));
    geo.setAttribute('aColor', mk(this.col, 3));
    geo.setAttribute('color', mk(this.col, 3));
    geo.setAttribute('aSize', mk(this.size, 1));
    geo.setAttribute('aAlpha', mk(this.alpha, 1));
    this.geo = geo;

    this.material = backend === 'gpu' ? makeGpuMaterial() : makeCpuMaterial();
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.name = `particles-${backend}`;
  }

  emit(p: ParticleEmit): void {
    if (this.budget <= 0) return;
    const i = this.cursor % this.budget;
    this.cursor = (this.cursor + 1) % Math.max(1, this.budget);
    const i3 = i * 3;
    this.pos[i3] = p.x;
    this.pos[i3 + 1] = p.y;
    this.pos[i3 + 2] = p.z;
    this.vel[i3] = p.vx || 0;
    this.vel[i3 + 1] = p.vy || 0;
    this.vel[i3 + 2] = p.vz || 0;
    this.col[i3] = p.color[0];
    this.col[i3 + 1] = p.color[1];
    this.col[i3 + 2] = p.color[2];
    this.base[i] = p.size ?? 0.15;
    this.life[i] = this.maxLife[i] = p.life ?? 1;
    this.grav[i] = p.gravity ?? -2;
    this.drag[i] = p.drag ?? 1.2;
    this.twinkle[i] = p.twinkle ?? 0;
  }

  update(dt: number): void {
    this.time += dt;
    const n = this.budget;
    for (let i = 0; i < n; i++) {
      if (this.life[i]! <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      this.life[i]! -= dt;
      const i3 = i * 3;
      const k = Math.max(0, 1 - this.drag[i]! * dt);
      this.vel[i3]! *= k;
      this.vel[i3 + 1] = this.vel[i3 + 1]! * k + this.grav[i]! * dt;
      this.vel[i3 + 2]! *= k;
      this.pos[i3]! += this.vel[i3]! * dt;
      this.pos[i3 + 1]! += this.vel[i3 + 1]! * dt;
      this.pos[i3 + 2]! += this.vel[i3 + 2]! * dt;
      const r = Math.max(0, this.life[i]! / this.maxLife[i]!);
      const tw = this.twinkle[i] ? 0.55 + 0.45 * Math.sin(this.time * 30 + i * 1.7) : 1;
      this.alpha[i] = Math.min(1, r * 1.6) * tw;
      this.size[i] = this.base[i]! * (0.4 + 0.6 * r);
    }
    for (let i = n; i < this.capacity; i++) {
      this.alpha[i] = 0;
      this.size[i] = 0;
    }
    for (const name of ['position', 'aColor', 'color', 'aSize', 'aAlpha'] as const) {
      const attr = this.geo.getAttribute(name);
      if (attr) attr.needsUpdate = true;
    }
    if (this.backend === 'cpu') {
      const mat = this.material as THREE.PointsMaterial;
      mat.opacity = 0.85;
    }
  }

  clear(): void {
    this.life.fill(0);
    this.alpha.fill(0);
    this.size.fill(0);
  }

  setBudget(count: number): void {
    this.budget = Math.max(0, Math.min(this.capacity, Math.floor(count)));
    this.cursor = 0;
  }

  dispose(): void {
    this.geo.dispose();
    this.material.dispose();
  }
}

/**
 * Create a particle system: GPU ShaderMaterial when preferred and available,
 * otherwise CPU PointsMaterial fallback (full scene still covered, lower cost).
 */
export function createParticleSystem(opts: CreateParticleSystemOptions): ParticleSystem {
  const gpuOk = opts.gpuAvailable ?? true;
  const backend: ParticleBackend = opts.preferGpu && gpuOk ? 'gpu' : 'cpu';
  return new BufferParticleSystem(Math.max(1, opts.capacity), backend);
}
