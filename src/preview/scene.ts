import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { getPreparedVisualConfig } from '../visual/prepare';
import { visualRandom } from '../visual/rng';
import { TILE_W, TILE_H, TILE_D, GOLD, FONT_SERIF, createTile, setTileCode, tileGeometry, sideMat, backMat, setAnisotropy, frontMaterial } from './tiles';
import { ParticlePool, makePillar, makeRipple, sampleGlyph, makePointsMaterial, pointUniforms, ease, clamp01, type FxMesh } from './fx';
import { sfx, stopAll as stopAudio, setMuted, isMuted } from './audio';
import { createHeavenCourt } from './court';
import { FIXED_HANDS, type HandName } from './fixedHands';
import { timelineFor } from './timelines';

const visualCfg = getPreparedVisualConfig();
const VIEW_W = visualCfg?.enabled ? visualCfg.width : window.innerWidth;
const VIEW_H = visualCfg?.enabled ? visualCfg.height : window.innerHeight;
const VIEW_DPR = visualCfg?.enabled ? visualCfg.dpr : Math.min(window.devicePixelRatio, 2);

function mustEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

// ---------------- 渲染器 / 场景 ----------------
const canvas = mustEl<HTMLCanvasElement>('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!visualCfg?.enabled });
renderer.setPixelRatio(VIEW_DPR);
renderer.setSize(VIEW_W, VIEW_H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setAnisotropy(renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1028);
scene.fog = new THREE.Fog(0xe8c8aa, 38, 110);

const camera = new THREE.PerspectiveCamera(60, VIEW_W / VIEW_H, 0.08, 160);
// 站在斗兽场看台缺口外，拉远后能看见整圈看台和手牌
const EYE = new THREE.Vector3(0, 4.7, 18.8);
const CAM_TARGET = new THREE.Vector3(0, 0.55, 0.2);
const camBase = new THREE.Vector3();
const look: { yaw: number; pitch: number } = { yaw: 0, pitch: 0 };
function updateCamBase() {
  const aspect = (visualCfg?.enabled ? VIEW_W : window.innerWidth) / (visualCfg?.enabled ? VIEW_H : window.innerHeight);
  camera.fov = aspect < 0.85 ? 72 : 60;
  camera.updateProjectionMatrix();
  camBase.copy(EYE);
  if (scene.fog instanceof THREE.Fog) { scene.fog.near = 38; scene.fog.far = 110; }
}
updateCamBase();
camera.position.copy(camBase);
camera.lookAt(CAM_TARGET);

// 灯光
scene.add(new THREE.HemisphereLight(0xffe2b8, 0x3a2430, 0.72));
const key = new THREE.DirectionalLight(0xfff1dc, 1.7);
key.position.set(3, 10, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
key.shadow.bias = -0.0004; key.shadow.radius = 4;
scene.add(key);
const rim = new THREE.PointLight(0xffb060, 30, 20, 2);
rim.position.set(-5, 4, -4); scene.add(rim);
const fxLight = new THREE.PointLight(0xffd27a, 0, 14, 2); // 特效时点亮
fxLight.position.set(0, 2.5, 0.5); scene.add(fxLight);

// ---------------- 牌桌 ----------------
function feltTexture(): THREE.CanvasTexture {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const g = ctx.createRadialGradient(S / 2, S / 2, 60, S / 2, S / 2, S * 0.72);
  g.addColorStop(0, '#13684a'); g.addColorStop(0.6, '#0b4a34'); g.addColorStop(1, '#062a1e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (visualRandom() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  // 中央装饰金圈
  ctx.strokeStyle = 'rgba(214,176,96,.35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, 150, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(S / 2, S / 2, 165, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(214,176,96,.16)';
  ctx.font = `900 150px ${FONT_SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('雀', S / 2, S / 2 + 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function woodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = '#3a1d0e'; ctx.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(${20 + visualRandom() * 40},${8 + visualRandom() * 14},4,${0.25 + visualRandom() * 0.3})`;
    ctx.lineWidth = 1 + visualRandom() * 2; ctx.beginPath();
    const y = visualRandom() * 64; ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const TW = 15, TD = 11;
const felt = new THREE.Mesh(new THREE.PlaneGeometry(TW, TD), new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 0.95 }));
felt.rotation.x = -Math.PI / 2; felt.receiveShadow = true; scene.add(felt);
const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.42, metalness: 0.22, color: 0xc46a48 });
const R = 0.55, RH = 0.3;
for (const [w, d, x, z] of [[TW + 2 * R, R, 0, -(TD + R) / 2], [TW + 2 * R, R, 0, (TD + R) / 2], [R, TD, -(TW + R) / 2, 0], [R, TD, (TW + R) / 2, 0]]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, RH, d), woodMat);
  m.position.set(x, RH / 2 - 0.08, z); m.castShadow = m.receiveShadow = true; scene.add(m);
}
const body = new THREE.Mesh(new THREE.BoxGeometry(TW + 2 * R, 1.2, TD + 2 * R), woodMat);
body.position.y = -0.61; scene.add(body);
const court = createHeavenCourt(scene);

// 四面牌墙（装饰，背面朝上）
{
  const stacks = 9, s = 0.88;
  const wall = new THREE.InstancedMesh(tileGeometry, [sideMat, sideMat, sideMat, sideMat, sideMat, backMat], 4 * stacks * 2);
  wall.castShadow = wall.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let n = 0;
  const dist = 2.75;
  for (let side = 0; side < 4; side++) {
    const yaw = side * Math.PI / 2;
    for (let i = 0; i < stacks; i++) for (let l = 0; l < 2; l++) {
      const along = (i - (stacks - 1) / 2) * TILE_W * s * 1.02;
      const p = new THREE.Vector3(along, TILE_D * s * (l + 0.5) + 0.002, dist).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      e.set(Math.PI / 2, yaw, 0, 'YXZ'); q.setFromEuler(e);
      m.compose(p, q, new THREE.Vector3(s, s, s)); wall.setMatrixAt(n++, m);
    }
  }
  scene.add(wall);
}

// ---------------- 手牌 ----------------
const HANDS: Record<HandName, readonly string[]> = FIXED_HANDS;
const HAND_Z = 4.35, HAND_TILT = 0;
// 绕牌心倾斜后，把底边落到桌面上
function handRestY(tilt: number): number {
  const h = TILE_H / 2, d = TILE_D / 2, c = Math.cos(tilt), s = Math.sin(tilt);
  let minY = Infinity;
  for (const [y, z] of [[h, d], [h, -d], [-h, d], [-h, -d]]) minY = Math.min(minY, y * c - z * s);
  return 0.012 - minY;
}
const HAND_Y = handRestY(HAND_TILT);
const tiles = HANDS.idle.map((code, i) => {
  const t = createTile(code);
  const gap = i === 13 ? 0.28 : 0;
  const x = (i - 6.5) * (TILE_W + 0.03) + gap - 0.14;
  t.basePos = new THREE.Vector3(x, HAND_Y, HAND_Z);
  t.baseQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(HAND_TILT, 0, 0));
  t.group.position.copy(t.basePos); t.group.quaternion.copy(t.baseQuat);
  scene.add(t.group);
  return t;
});
function setHand(name: HandName): void { HANDS[name].forEach((c, i) => setTileCode(tiles[i], c)); }

// ---------------- 后处理 ----------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const BLOOM_BASE = 0.35;
const bloom = new UnrealBloomPass(new THREE.Vector2(VIEW_W, VIEW_H), BLOOM_BASE, 0.55, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------- 全局状态 ----------------
const sparks = new ParticlePool(5000);
scene.add(sparks.points);
const st: {
  effect: Effect | null;
  timeScale: number;
  dolly: number;
  camLift: number;
  shake: number;
  flash: number;
  bloomBoost: number;
  fxLight: number;
} = {
  effect: null,
  timeScale: 1,
  dolly: 0,
  camLift: 0,
  shake: 0,
  flash: 0,
  bloomBoost: 0,
  fxLight: 0,
};
const ui = {
  flash: mustEl<HTMLElement>('flash'),
  vignette: mustEl<HTMLElement>('vignette'),
  banner: mustEl<HTMLElement>('banner'),
  bannerSub: mustEl<HTMLElement>('banner-sub'),
  buttons: [...document.querySelectorAll<HTMLButtonElement>('[data-fx]')],
};

function showBanner(text: string, sub: string, cls: string, delay = 0): void {
  const b = ui.banner;
  b.className = ''; b.style.animationDelay = ''; void b.offsetWidth;
  const main = b.querySelector('.main'); if (main) main.textContent = text;
  ui.bannerSub.textContent = sub;
  b.style.setProperty('--delay', `${delay}s`);
  b.className = `show ${cls}`;
}

function resetAll(): void {
  if (st.effect) { st.effect.dispose(); st.effect = null; }
  for (const t of tiles) {
    t.group.position.copy(t.basePos); t.group.quaternion.copy(t.baseQuat);
    t.group.scale.setScalar(1); t.group.visible = true;
    t.outline.material.opacity = 0; t.outline.material.color.copy(GOLD);
  }
  for (const code of new Set(Object.values(HANDS).flat())) frontMaterial(code).emissiveIntensity = 0;
  sparks.clear();
  Object.assign(st, { timeScale: 1, dolly: 0, camLift: 0, shake: 0, flash: 0, bloomBoost: 0, fxLight: 0 });
  ui.vignette.classList.remove('on', 'gold');
  canvas.classList.remove('slowmo');
  ui.banner.className = '';
  ui.buttons.forEach(b => b.classList.remove('active'));
}

class Effect {
  t = 0;
  duration: number;
  group: THREE.Group;
  constructor(duration: number) {
    this.duration = duration;
    this.group = new THREE.Group();
    scene.add(this.group);
  }
  get done(): boolean { return this.t >= this.duration; }
  dispose(): void {
    scene.remove(this.group);
    this.group.traverse((o) => {
      const obj = o as THREE.Mesh;
      if (obj.geometry) obj.geometry.dispose();
      const mat = obj.material;
      if (!mat) return;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    });
  }
  update(_dt: number): void {}
}

const GLYPH_POS = new THREE.Vector3(0, 2.05, 2.1);
const rnd = (a: number, b: number) => a + visualRandom() * (b - a);
const _v = new THREE.Vector3();

// ===== 1. 基础胡：牌弹起 + 金边闪光 + 闪粉 =====
class BasicWin extends Effect {
  burst = false;
  constructor() {
    const cfg = timelineFor('basic');
    const banner = cfg.tracks.find((t) => t.kind === 'banner');
    super(cfg.durationMs / 1000);
    showBanner(cfg.bannerMain, cfg.bannerSub, 'basic', (banner?.startMs ?? 0) / 1000);
    sfx.basic();
  }
  update(dt: number): void {
    const t = (this.t += dt);
    tiles.forEach((tile, i) => {
      const u = clamp01((t - i * 0.035) / 1.9);
      const lift = u < 0.2 ? ease.outBack(u / 0.2) : u < 0.62 ? 1 : 1 - ease.inOutCubic((u - 0.62) / 0.38);
      tile.group.position.y = tile.basePos.y + lift * 0.34;
      tile.group.quaternion.copy(tile.baseQuat);
      tile.group.rotateX(-lift * 0.22);
      // 金边：两次脉冲
      const ft = t - i * 0.035 - 0.15;
      const f = ft > 0 ? Math.exp(-ft * 3.2) * (0.65 + 0.35 * Math.cos(ft * 16)) : 0;
      tile.outline.material.opacity = Math.max(0, f);
      if (i === 13) tile.outline.material.opacity = Math.max(0, f * 1.3);
    });
    for (const code of new Set(HANDS.basic)) frontMaterial(code).emissiveIntensity = Math.max(0, 0.35 * Math.exp(-Math.max(0, t - 0.2) * 3)) * (t > 0.2 ? 1 : 0);
    if (!this.burst && t > 0.22) {
      this.burst = true;
      for (const tile of tiles) for (let k = 0; k < 14; k++) {
        const p = tile.group.position;
        sparks.emit({ x: p.x + rnd(-0.3, 0.3), y: p.y + rnd(0.2, 0.5), z: p.z + rnd(-0.2, 0.2), vx: rnd(-1.2, 1.2), vy: rnd(1.5, 4), vz: rnd(-1, 1),
          color: visualRandom() < 0.7 ? [3, 2, 0.6] : [3, 3, 3], size: rnd(0.08, 0.2), life: rnd(0.6, 1.3), gravity: -4, drag: 1.8, twinkle: 1 });
      }
    }
    if (t > 0.2 && t < 1.3) {
      for (let k = 0; k < 4; k++) {
        const tile = tiles[(visualRandom() * 14) | 0], p = tile.group.position;
        sparks.emit({ x: p.x + rnd(-0.32, 0.32), y: p.y + rnd(-0.3, 0.45), z: p.z + rnd(0.1, 0.3), vx: rnd(-0.2, 0.2), vy: rnd(0.3, 1), vz: rnd(-0.1, 0.2),
          color: [2.6, 1.8, 0.6], size: rnd(0.06, 0.14), life: rnd(0.4, 0.9), gravity: 0, drag: 0.5, twinkle: 1 });
      }
    }
    st.fxLight = t > 0.2 ? 6 * Math.exp(-(t - 0.2) * 2.5) : 0;
    st.bloomBoost = t > 0.2 ? 0.3 * Math.exp(-(t - 0.2) * 2) : 0;
  }
}

// ===== 2. 大牌胡：聚拢中心 + 光柱 + 涟漪 + 镜头推拉 =====
class BigWin extends Effect {
  pillar: FxMesh;
  core: FxMesh;
  ripple: FxMesh;
  impact = false;
  constructor() {
    const cfg = timelineFor('big');
    const banner = cfg.tracks.find((t) => t.kind === 'banner');
    super(cfg.durationMs / 1000);
    this.pillar = makePillar(new THREE.Color(1.0, 0.55, 0.15), 1.0);
    this.core = makePillar(new THREE.Color(1.6, 1.4, 1.0), 0.38);
    this.pillar.scale.y = this.core.scale.y = 0.001;
    this.ripple = makeRipple(new THREE.Color(1.5, 0.85, 0.25), 15);
    this.ripple.position.y = 0.01;
    this.group.add(this.pillar, this.core, this.ripple);
    showBanner(cfg.bannerMain, cfg.bannerSub, 'big', (banner?.startMs ?? 0) / 1000);
    sfx.big();
  }
  ringPos(i: number, t: number, out: THREE.Vector3): number {
    const a = (i / 14) * Math.PI * 2 + t * 1.6;
    const y = 0.9 + Math.min(1, Math.max(0, t - 0.9) / 1.7) * 0.6 + Math.sin(t * 3 + i) * 0.05;
    out.set(Math.sin(a) * 1.55, y, Math.cos(a) * 1.55);
    return a;
  }
  update(dt: number): void {
    const t = (this.t += dt);
    const q = new THREE.Quaternion(), qt = new THREE.Quaternion();
    tiles.forEach((tile, i) => {
      const a = this.ringPos(i, t, _v);
      qt.setFromEuler(new THREE.Euler(0, a, 0));
      let e;
      if (t < 2.7) e = ease.inOutCubic(clamp01((t - i * 0.025) / 0.85));
      else e = 1 - ease.inOutCubic(clamp01((t - 2.7 - (13 - i) * 0.015) / 0.75));
      tile.group.position.lerpVectors(tile.basePos, _v, e);
      tile.group.position.y += Math.sin(Math.PI * e) * (t < 2.7 ? 1.0 : 0.5);
      q.slerpQuaternions(tile.baseQuat, qt, e);
      tile.group.quaternion.copy(q);
      tile.outline.material.color.setRGB(3.2, 1.2 + 0.6 * Math.sin(t * 6 + i), 0.3);
      tile.outline.material.opacity = t > 0.85 && t < 3.0 ? 0.55 + 0.25 * Math.sin(t * 10 + i) : e * 0.25;
    });
    for (const code of new Set(HANDS.big)) frontMaterial(code).emissiveIntensity = t > 0.85 && t < 3.0 ? 0.25 : 0;

    // 光柱
    const pu = clamp01((t - 0.85) / 0.3);
    const fade = 1 - clamp01((t - 2.6) / 0.6);
    const pulse = 1 + 0.08 * Math.sin(t * 22);
    this.pillar.scale.set(pulse * (1.4 - 0.4 * ease.outCubic(pu)), 16 * ease.outCubic(pu) + 0.001, pulse * (1.4 - 0.4 * ease.outCubic(pu)));
    this.core.scale.set(pulse, 16 * ease.outCubic(pu) + 0.001, pulse);
    this.pillar.material.uniforms.uIntensity.value = pu * fade * 1.1;
    this.core.material.uniforms.uIntensity.value = pu * fade * 1.3;
    this.pillar.material.uniforms.uTime.value = this.core.material.uniforms.uTime.value = t;
    this.ripple.material.uniforms.uTime.value = t - 0.85;

    if (!this.impact && t > 0.85) {
      this.impact = true; st.shake = 0.12; st.flash = 0.35;
      for (let k = 0; k < 260; k++) {
        const a = rnd(0, Math.PI * 2), s = rnd(2, 6);
        sparks.emit({ x: Math.cos(a) * 0.5, y: 0.1, z: Math.sin(a) * 0.5, vx: Math.cos(a) * s, vy: rnd(0.5, 3), vz: Math.sin(a) * s,
          color: visualRandom() < 0.5 ? [3, 1.4, 0.3] : [3, 2.4, 1], size: rnd(0.08, 0.22), life: rnd(0.5, 1.2), gravity: -5, drag: 2.2, twinkle: 0 });
      }
    }
    // 沿光柱螺旋上升的粒子
    if (t > 0.9 && t < 2.8) {
      for (let k = 0; k < 10; k++) {
        const a = rnd(0, Math.PI * 2), r = rnd(0.6, 1.6);
        sparks.emit({ x: Math.cos(a) * r, y: rnd(0, 1.5), z: Math.sin(a) * r, vx: -Math.sin(a) * 2.5 - Math.cos(a) * 0.4, vy: rnd(2, 5), vz: Math.cos(a) * 2.5 - Math.sin(a) * 0.4,
          color: visualRandom() < 0.6 ? [3, 1.5, 0.35] : [2.5, 0.5, 0.3], size: rnd(0.07, 0.18), life: rnd(0.8, 1.6), gravity: 1.5, drag: 0.6, twinkle: 1 });
      }
    }
    // 镜头：先拉远，冲击时推近，再回位
    if (t < 0.85) st.dolly = 1.6 * ease.inOutCubic(t / 0.85);
    else if (t < 1.25) st.dolly = 1.6 - 3.0 * ease.outExpo((t - 0.85) / 0.4);
    else st.dolly = -1.4 * (1 - ease.inOutCubic(clamp01((t - 2.4) / 1.3)));
    st.camLift = Math.sin(clamp01(t / 3.6) * Math.PI) * 0.6;
    st.fxLight = pu * fade * 9;
    st.bloomBoost = pu * fade * 0.25;
  }
}

// ===== 3. 顶级胡：慢动作 → 碎成光粒 → 重组成「胡」字 + 强辉光 + 震屏 =====
class TopWin extends Effect {
  N = 5000;
  slow = 0;
  stage = 0;
  target!: Float32Array;
  start!: Float32Array;
  vel!: Float32Array;
  mid!: Float32Array;
  phase!: Float32Array;
  pos!: Float32Array;
  col!: Float32Array;
  size!: Float32Array;
  alpha!: Float32Array;
  baseCol!: Float32Array;
  baseSize!: Float32Array;
  geo!: THREE.BufferGeometry;
  points!: THREE.Points;
  ripple!: FxMesh;
  backdrop!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  anchor!: THREE.Object3D;
  constructor() {
    const cfg = timelineFor('top');
    const banner = cfg.tracks.find((t) => t.kind === 'banner');
    super(cfg.durationMs / 1000);
    // 「胡」字目标位置：悬浮于桌面中央并朝向镜头
    const anchor = new THREE.Object3D();
    anchor.position.copy(GLYPH_POS);
    anchor.lookAt(camBase);
    anchor.updateMatrixWorld();
    const pts = sampleGlyph('胡', this.N, FONT_SERIF);
    this.target = new Float32Array(this.N * 3);
    const SZ = 3.6;
    for (let i = 0; i < this.N; i++) {
      _v.set(pts[i * 2] * SZ, pts[i * 2 + 1] * SZ, rnd(-0.06, 0.06)).applyMatrix4(anchor.matrixWorld);
      this.target.set([_v.x, _v.y, _v.z], i * 3);
    }
    this.anchor = anchor;
    this.start = new Float32Array(this.N * 3);
    this.vel = new Float32Array(this.N * 3);
    this.mid = new Float32Array(this.N * 3);
    this.phase = new Float32Array(this.N);
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.N * 3);
    this.col = new Float32Array(this.N * 3);
    this.size = new Float32Array(this.N);
    this.alpha = new Float32Array(this.N);
    this.baseCol = new Float32Array(this.N * 3);
    this.baseSize = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) {
      const r = visualRandom();
      const c = r < 0.62 ? [1.0, 0.62, 0.2] : r < 0.85 ? [1.15, 0.2, 0.1] : [1.0, 1.0, 1.0];
      this.baseCol.set(c, i * 3);
      this.size[i] = this.baseSize[i] = rnd(0.08, 0.17);
      this.phase[i] = visualRandom() * Math.PI * 2;
    }
    const mk = (a: Float32Array, n: number) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', mk(this.pos, 3));
    geo.setAttribute('aColor', mk(this.col, 3));
    geo.setAttribute('aSize', mk(this.size, 1));
    geo.setAttribute('aAlpha', mk(this.alpha, 1));
    this.geo = geo;
    this.points = new THREE.Points(geo, makePointsMaterial());
    this.points.frustumCulled = false; this.points.renderOrder = 6; this.points.visible = false;
    this.group.add(this.points);
    this.ripple = makeRipple(new THREE.Color(1.6, 0.9, 0.3), 15);
    this.ripple.position.y = 0.01; this.ripple.material.uniforms.uSpeed.value = 5.5;
    this.ripple.material.uniforms.uGlow.value = 0.0; // 不要中心光晕，避免盖住「胡」字
    this.group.add(this.ripple);
    // 「胡」字后方的暗色光晕底板，提升可读性
    const bc = document.createElement('canvas'); bc.width = bc.height = 128;
    const bctx = bc.getContext('2d');
    if (!bctx) throw new Error('2D canvas unavailable');
    const bg = bctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    bg.addColorStop(0, 'rgba(0,0,0,0.92)'); bg.addColorStop(0.5, 'rgba(8,3,0,0.7)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = bg; bctx.fillRect(0, 0, 128, 128);
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false, opacity: 0 }));
    this.backdrop.position.copy(GLYPH_POS); this.backdrop.quaternion.copy(anchor.quaternion); this.backdrop.translateZ(-0.4);
    this.backdrop.renderOrder = 3.5; // 盖在涟漪之上、粒子之下
    this.group.add(this.backdrop);

    ui.vignette.classList.add('on');
    canvas.classList.add('slowmo');
    showBanner(cfg.bannerMain, cfg.bannerSub, 'top', (banner?.startMs ?? 0) / 1000);
    sfx.top();
  }
  explode(): void {
    // 从各张牌体积内取样起点
    const N = this.N;
    for (let i = 0; i < N; i++) {
      const tile = tiles[i % 14];
      _v.set(rnd(-TILE_W / 2, TILE_W / 2), rnd(-TILE_H / 2, TILE_H / 2), rnd(-TILE_D / 2, TILE_D / 2)).applyMatrix4(tile.group.matrixWorld);
      this.start.set([_v.x, _v.y, _v.z], i * 3);
      const th = rnd(0, Math.PI * 2), ph = Math.acos(rnd(-1, 1)), s = rnd(3, 9);
      this.vel.set([Math.sin(ph) * Math.cos(th) * s, Math.abs(Math.cos(ph)) * s * 0.9 + 1.5, Math.sin(ph) * Math.sin(th) * s], i * 3);
    }
    tiles.forEach(t => { t.group.visible = false; });
    this.points.visible = true;
  }
  update(dt: number): void {
    const t = (this.t += dt);
    const N = this.N;
    // ---- 阶段 A：慢动作（0 ~ 1.0s）----
    if (t < 1.0) {
      this.slow += dt * (t < 0.12 ? 1 : 0.1);
      st.timeScale = t < 0.12 ? 1 : 0.1;
      const s = this.slow;
      tiles.forEach((tile, i) => {
        const up = ease.outCubic(Math.min(1, s / 0.16));
        tile.group.position.set(tile.basePos.x * (1 + up * 0.08), tile.basePos.y + up * 0.7 + Math.sin(i * 1.3) * up * 0.12, tile.basePos.z - up * 0.4);
        tile.group.quaternion.copy(tile.baseQuat);
        tile.group.rotateX(-up * 0.3 + s * 0.8 * Math.sin(i));
        tile.group.rotateZ(s * 1.5 * Math.cos(i * 2.1));
        tile.outline.material.color.setHSL((i / 14 + t * 0.5) % 1, 1, 0.5).multiplyScalar(4);
        tile.outline.material.opacity = 0.2 + 0.8 * ease.inCubic(t);
      });
      for (const code of new Set(HANDS.top)) frontMaterial(code).emissiveIntensity = ease.inCubic(t) * 0.9;
      if (t < 0.12) {
        for (let k = 0; k < 30; k++) {
          const tile = tiles[(visualRandom() * 14) | 0], p = tile.group.position;
          sparks.emit({ x: p.x + rnd(-0.4, 0.4), y: p.y + rnd(-0.4, 0.6), z: p.z + rnd(-0.4, 0.4), vx: rnd(-2, 2), vy: rnd(0, 3), vz: rnd(-2, 2),
            color: visualRandom() < 0.5 ? [3, 2.2, 0.8] : [2, 2.4, 3.2], size: rnd(0.05, 0.14), life: rnd(2.5, 4), gravity: -1, drag: 0.8, twinkle: 1 });
        }
      }
      st.dolly = -1.2 * ease.outCubic(t);
      st.bloomBoost = 0.4 * t;
      st.fxLight = 8 * t;
    } else if (this.stage === 0) {
      // ---- 爆裂 ----
      this.stage = 1;
      st.timeScale = 1;
      canvas.classList.remove('slowmo');
      ui.vignette.classList.remove('on'); ui.vignette.classList.add('gold');
      this.explode();
      st.flash = 0.6; st.shake = 0.32;
      for (let k = 0; k < 300; k++) {
        const a = rnd(0, Math.PI * 2), s = rnd(3, 9);
        sparks.emit({ x: rnd(-4, 4), y: 1, z: HAND_Z - 0.4, vx: Math.cos(a) * s, vy: rnd(1, 6), vz: Math.sin(a) * s * 0.6,
          color: [3, 2, 0.8], size: rnd(0.08, 0.2), life: rnd(0.5, 1.1), gravity: -6, drag: 2, twinkle: 0 });
      }
    }

    if (t >= 1.0) {
      const P = this.pos, S = this.start, V = this.vel, T = this.target, M = this.mid, C = this.col, B = this.baseCol;
      const tau = t - 1.0;
      const EXP_END = 0.45, CONV_END = 1.45, HOLD_END = 2.6;
      const k = 2.6;
      const burstDist = (tt: number) => (1 - Math.exp(-k * tt)) / k;
      if (tau < EXP_END) {
        const d = burstDist(tau);
        for (let i = 0; i < N; i++) {
          const i3 = i * 3;
          P[i3] = S[i3] + V[i3] * d; P[i3 + 1] = S[i3 + 1] + V[i3 + 1] * d - 1.2 * tau * tau; P[i3 + 2] = S[i3 + 2] + V[i3 + 2] * d;
          M[i3] = P[i3]; M[i3 + 1] = P[i3 + 1]; M[i3 + 2] = P[i3 + 2];
          this.alpha[i] = 1;
        }
      } else if (tau < CONV_END) {
        const u = (tau - EXP_END) / (CONV_END - EXP_END);
        for (let i = 0; i < N; i++) {
          const i3 = i * 3;
          const ui_ = clamp01(u * 1.25 - (this.phase[i] / 6.283) * 0.25);
          const e = ease.inOutCubic(ui_);
          const sw = Math.sin(Math.PI * e) * 0.9;
          const ph = this.phase[i] + u * 6;
          P[i3] = M[i3] + (T[i3] - M[i3]) * e + Math.cos(ph) * sw;
          P[i3 + 1] = M[i3 + 1] + (T[i3 + 1] - M[i3 + 1]) * e + Math.sin(ph * 1.3) * sw * 0.6;
          P[i3 + 2] = M[i3 + 2] + (T[i3 + 2] - M[i3 + 2]) * e + Math.sin(ph) * sw;
          this.alpha[i] = 1;
        }
      } else {
        if (this.stage === 1) {
          // ---- 成字冲击 ----
          this.stage = 2;
          st.flash = 0.6; st.shake = 0.45;
          this.ripple.material.uniforms.uTime.value = 0;
          for (let kk = 0; kk < 500; kk++) {
            const a = rnd(0, Math.PI * 2), s = rnd(4, 10);
            _v.set(Math.cos(a), Math.sin(a), 0).transformDirection(this.anchor.matrixWorld);
            sparks.emit({ x: this.anchor.position.x, y: this.anchor.position.y, z: this.anchor.position.z, vx: _v.x * s, vy: _v.y * s, vz: _v.z * s,
              color: visualRandom() < 0.6 ? [3.2, 2.2, 0.7] : [3.2, 0.6, 0.3], size: rnd(0.1, 0.26), life: rnd(0.6, 1.4), gravity: -2, drag: 1.6, twinkle: 1 });
          }
        }
        const h = tau - CONV_END;
        const disp = clamp01((tau - HOLD_END) / 0.9);
        const breathe = 1 + 0.03 * Math.sin(h * 6);
        const ax = this.anchor.position;
        for (let i = 0; i < N; i++) {
          const i3 = i * 3;
          const sh = 0.025 * Math.sin(h * 8 + this.phase[i] * 3);
          const dx = (T[i3] - ax.x) * breathe, dy = (T[i3 + 1] - ax.y) * breathe, dz = (T[i3 + 2] - ax.z) * breathe;
          const de = disp * disp;
          P[i3] = ax.x + dx + sh + dx * de * 1.8 + Math.cos(this.phase[i]) * de * 2;
          P[i3 + 1] = ax.y + dy + sh + de * 3 * (0.5 + this.phase[i] / 6.283);
          P[i3 + 2] = ax.z + dz + Math.sin(this.phase[i]) * de * 2;
          this.alpha[i] = 1 - disp;
        }
      }
      // 颜色：成字后闪白再回金
      const glow = this.stage === 2 ? 1.1 + 1.6 * Math.exp(-(tau - CONV_END) * 3) : 1;
      for (let i = 0; i < N; i++) {
        const i3 = i * 3;
        const tw = 0.8 + 0.2 * Math.sin(t * 12 + this.phase[i] * 5);
        C[i3] = B[i3] * glow * tw; C[i3 + 1] = B[i3 + 1] * glow * tw; C[i3 + 2] = B[i3 + 2] * glow * tw;
      }
      // 爆裂时粒子更大，成字后收细
      const sm = tau < EXP_END ? 1.9 : tau < CONV_END ? 1.9 - 0.9 * ((tau - EXP_END) / (CONV_END - EXP_END)) : 1;
      for (let i = 0; i < N; i++) this.size[i] = this.baseSize[i] * sm;
      for (const n of ['position', 'aColor', 'aAlpha', 'aSize']) this.geo.attributes[n].needsUpdate = true;
      if (this.stage === 2) this.ripple.material.uniforms.uTime.value += dt;
      this.backdrop.material.opacity = 0.9 * clamp01((tau - 0.6) / 0.8) * (1 - clamp01((tau - HOLD_END) / 0.7));

      // 镜头 & 辉光
      if (tau < CONV_END) st.dolly = -1.2 + 1.8 * ease.outCubic(clamp01(tau / 0.4)) - 0.6 * ease.inOutCubic(clamp01((tau - 0.45) / 1.0));
      else st.dolly = 0 - 0.5 * Math.exp(-(tau - CONV_END) * 4) * (1 - clamp01((tau - 2.6) / 0.8));
      st.bloomBoost = tau < CONV_END ? 0.25 + 0.2 * tau : 0.45 + 0.9 * Math.exp(-(tau - CONV_END) * 2.2);
      st.bloomBoost *= 1 - clamp01((tau - HOLD_END) / 1.0);
      st.fxLight = (tau < CONV_END ? 6 : 10) * (1 - clamp01((tau - HOLD_END) / 0.9));
      st.camLift = 0.3 * Math.sin(clamp01(tau / 3.5) * Math.PI);

      // 牌重新出现
      if (tau > 2.75) {
        tiles.forEach((tile, i) => {
          const u = clamp01((tau - 2.75 - i * 0.03) / 0.45);
          tile.group.visible = u > 0;
          tile.group.position.copy(tile.basePos); tile.group.quaternion.copy(tile.baseQuat);
          tile.group.scale.setScalar(Math.max(0.001, ease.outBack(u)));
          tile.outline.material.color.copy(GOLD);
          tile.outline.material.opacity = (1 - u) * 0.8;
        });
        for (const code of new Set(HANDS.top)) frontMaterial(code).emissiveIntensity = 0;
      }
    }
  }
}

type EffectName = Exclude<HandName, 'idle'>;
const EFFECTS: Record<EffectName, new () => Effect> = { basic: BasicWin, big: BigWin, top: TopWin };
function play(name: EffectName): void {
  resetAll();
  stopAudio();
  setHand(name);
  st.effect = new EFFECTS[name]();
  ui.buttons.forEach((b) => b.classList.toggle('active', b.dataset.fx === name));
}
ui.buttons.forEach((b) => b.addEventListener('click', () => {
  const fx = b.dataset.fx;
  if (fx === 'basic' || fx === 'big' || fx === 'top') play(fx);
}));
window.addEventListener('keydown', (e) => {
  const m = ({ '1': 'basic', '2': 'big', '3': 'top' } as Record<string, EffectName | undefined>)[e.key];
  if (m) play(m);
});
const muteBtn = mustEl<HTMLButtonElement>('mute');
muteBtn.addEventListener('click', () => {
  setMuted(!isMuted()); if (isMuted()) stopAudio();
  muteBtn.textContent = isMuted() ? '🔇 音效关' : '🔊 音效开';
});

// ---------------- 氛围尘埃 ----------------
let dustAcc = 0;
function ambientDust(dt: number): void {
  dustAcc += dt * 6;
  while (dustAcc > 1) {
    dustAcc--;
    sparks.emit({ x: rnd(-7, 7), y: rnd(0.2, 4), z: rnd(-5, 5), vx: rnd(-0.05, 0.05), vy: rnd(0.02, 0.12), vz: rnd(-0.05, 0.05),
      color: [0.9, 0.7, 0.35], size: rnd(0.03, 0.07), life: rnd(4, 7), gravity: 0, drag: 0, twinkle: 1 });
  }
}

// ---------------- 主循环 ----------------
function onResize(): void {
  if (visualCfg?.enabled) return;
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); composer.setSize(w, h);
  pointUniforms.uScale.value = h * renderer.getPixelRatio() * 0.5;
  updateCamBase();
}
window.addEventListener('resize', onResize);
onResize();

// 拖动画面环顾（第一人称）
let dragging = false, lastPX = 0, lastPY = 0;
canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  dragging = true;
  lastPX = e.clientX; lastPY = e.clientY;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e: PointerEvent) => {
  if (!dragging) return;
  look.yaw -= (e.clientX - lastPX) * 0.0028;
  look.pitch -= (e.clientY - lastPY) * 0.0022;
  lastPX = e.clientX; lastPY = e.clientY;
  look.yaw = THREE.MathUtils.clamp(look.yaw, -1.15, 1.15);
  look.pitch = THREE.MathUtils.clamp(look.pitch, -0.62, 0.42);
});
function endDrag(): void { dragging = false; canvas.classList.remove('dragging'); }
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
const keys = new Set();
window.addEventListener('keydown', (e: KeyboardEvent) => { keys.add(e.key); });
window.addEventListener('keyup', (e: KeyboardEvent) => { keys.delete(e.key); });

const clock = new THREE.Clock();
const camDir = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let elapsed = 0;
/** Scene-local clock in seconds (visual harness drives this with fixed steps). */
let sceneTime = 0;

function simulate(dt: number, opts: { render: boolean }): void {
  sceneTime += dt;
  elapsed = sceneTime;
  if (st.effect) {
    st.effect.update(dt);
    if (st.effect.done) resetAll();
  }
  if (!visualCfg?.enabled) ambientDust(dt * st.timeScale);
  sparks.update(dt * st.timeScale);
  court.update(dt);

  if (!visualCfg?.enabled) {
    if (keys.has('ArrowLeft')) look.yaw += dt * 0.9;
    if (keys.has('ArrowRight')) look.yaw -= dt * 0.9;
    if (keys.has('ArrowUp')) look.pitch += dt * 0.7;
    if (keys.has('ArrowDown')) look.pitch -= dt * 0.7;
  }
  look.yaw = THREE.MathUtils.clamp(look.yaw, -1.15, 1.15);
  look.pitch = THREE.MathUtils.clamp(look.pitch, -0.62, 0.42);

  camDir.copy(camBase).sub(CAM_TARGET).normalize();
  camera.position.copy(camBase).addScaledVector(camDir, st.dolly * 0.45);
  camera.position.y += st.camLift * 0.35;
  camera.position.x += Math.sin(elapsed * 0.55) * 0.008;
  camera.position.y += Math.sin(elapsed * 0.8) * 0.004;
  _fwd.copy(CAM_TARGET).sub(camBase).normalize();
  _lookEuler.set(look.pitch, look.yaw, 0);
  _fwd.applyEuler(_lookEuler);
  const target = _v.copy(camera.position).add(_fwd);
  if (st.shake > 0.001) {
    camera.position.x += (visualRandom() - 0.5) * st.shake;
    camera.position.y += (visualRandom() - 0.5) * st.shake;
    target.x += (visualRandom() - 0.5) * st.shake * 0.4;
    target.y += (visualRandom() - 0.5) * st.shake * 0.4;
    st.shake *= Math.exp(-dt * 5);
  }
  camera.lookAt(target);

  bloom.strength = BLOOM_BASE + st.bloomBoost;
  fxLight.intensity = st.fxLight;
  ui.flash.style.opacity = st.flash.toFixed(3);
  st.flash *= Math.exp(-dt * 5);

  if (opts.render) composer.render();
}

function frame(): void {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  simulate(dt, { render: true });
}

function seekToMs(ms: number): void {
  const step = (visualCfg?.stepMs ?? 1000 / 60) / 1000;
  const target = ms / 1000;
  // Simulate without per-step GPU presents — one final render at the capture point.
  while (sceneTime + 1e-9 < target) {
    const dt = Math.min(step, target - sceneTime);
    simulate(dt, { render: false });
  }
  composer.render();
}

window.__app = { play, st, ready: false };
window.__visual = {
  ready: false,
  config: visualCfg,
  sceneTimeMs: () => sceneTime * 1000,
  seekToMs,
  playTier: (tier) => {
    play(tier);
  },
  captureDataUrl: () => canvas.toDataURL('image/png'),
};

if (visualCfg?.enabled) {
  setMuted(true);
  look.yaw = 0;
  look.pitch = 0;
  pointUniforms.uScale.value = VIEW_H * VIEW_DPR * 0.5;
  composer.setSize(VIEW_W, VIEW_H);
  play(visualCfg.tier);
  seekToMs(visualCfg.captureAt);
  window.__app.ready = true;
  window.__visual.ready = true;
  document.body.classList.add('ready');
  document.body.dataset.captureReady = '1';
} else {
  frame();
  window.__app.ready = true;
  window.__visual.ready = true;
  document.body.classList.add('ready');
}
