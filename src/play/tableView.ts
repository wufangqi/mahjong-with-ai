import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  displayHand,
  PLAYER_SEAT,
  totalTileCount,
  type HandState,
  type PhysicalTile,
  type Seat,
} from '../core';
import { createParticleSystem } from '../particles/particleSystem';
import type { ParticleSystem } from '../particles/types';
import {
  createTile,
  getTileBackPattern,
  setTileBackAppearance,
  setTileCode,
  TILE_D,
  TILE_H,
  TILE_W,
  type PreviewTile,
} from '../preview/tiles';
import type { QualitySettings } from '../quality/types';
import { settingsForTier } from '../quality/presets';
import { blendSkyColumn, rgbToHex } from '../theme/skyBlend';
import type { ThemeModules } from '../theme/types';

type TileUserData = {
  tileId: string;
  seat: Seat;
  kind: 'hand' | 'river' | 'opponent';
};

const SEAT_YAW: Record<Seat, number> = {
  0: 0,
  1: -Math.PI / 2,
  2: Math.PI,
  3: Math.PI / 2,
};

export class TableView {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly riverZone: THREE.Mesh;

  private root = new THREE.Group();
  private playerTiles: PreviewTile[] = [];
  private opponentGroups: THREE.Group[] = [];
  private riverGroups: THREE.Group[] = [];
  private meldGroups: THREE.Group[] = [];
  private dealerMarker: THREE.Mesh;
  private feltMat: THREE.MeshStandardMaterial;
  private railMat: THREE.MeshStandardMaterial;
  private trimMat: THREE.MeshStandardMaterial;
  private markSprite: THREE.Sprite;
  private hemi: THREE.HemisphereLight;
  private key: THREE.DirectionalLight;
  private skyGradientTex: THREE.CanvasTexture | null = null;
  private skyBlendCanvas: HTMLCanvasElement | null = null;
  private skyBlendCtx: CanvasRenderingContext2D | null = null;
  private transitionFrom: ThemeModules | null = null;
  private transitionTo: ThemeModules | null = null;
  private transitionStartedAt = 0;
  private transitionMs = 450;
  private ambientSys: ParticleSystem | null = null;
  private particleVel: Float32Array | null = null;
  private particleKind: 'dust' | 'petals' | null = null;
  private lastParticleTick = 0;
  private markGlyph = '雀';
  private markColorHex = -1;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private dragTileId: string | null = null;
  private dragOrigin: THREE.Vector3 | null = null;
  private quality: QualitySettings = settingsForTier('mid');
  private gpuParticlesAvailable = true;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private lastThemeModules: ThemeModules | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.dprCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(0x14261c);
    this.scene.fog = new THREE.Fog(0x14261c, 24, 55);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 80);
    this.camera.position.set(0, 9.2, 11.5);
    this.camera.lookAt(0, 0.2, 0.4);

    this.hemi = new THREE.HemisphereLight(0xfff2d8, 0x1a3024, 0.85);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xfff1dc, 1.35);
    this.key.position.set(4, 12, 6);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
    this.scene.add(this.key);

    this.feltMat = new THREE.MeshStandardMaterial({ color: 0x0d5a3c, roughness: 0.92 });
    this.railMat = new THREE.MeshStandardMaterial({ color: 0x5a2e18, roughness: 0.5 });
    this.trimMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.4, metalness: 0.35 });
    this.buildTable();
    this.scene.add(this.root);

    this.riverZone = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 2.4),
      new THREE.MeshBasicMaterial({
        color: 0xf5c46a,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      }),
    );
    this.riverZone.rotation.x = -Math.PI / 2;
    this.riverZone.position.set(0, 0.02, 1.6);
    this.riverZone.name = 'river-zone';
    this.scene.add(this.riverZone);

    this.dealerMarker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.4 }),
    );
    this.dealerMarker.position.set(0, 0.05, 0);
    this.root.add(this.dealerMarker);

    const markMat = new THREE.SpriteMaterial({
      map: this.makeMarkTexture('雀', 0xc9a227),
      transparent: true,
      depthWrite: false,
    });
    this.markSprite = new THREE.Sprite(markMat);
    this.markSprite.scale.set(1.4, 1.4, 1);
    this.markSprite.position.set(0, 0.04, 0);
    this.root.add(this.markSprite);

    for (let seat = 0; seat < 4; seat++) {
      this.opponentGroups.push(new THREE.Group());
      this.riverGroups.push(new THREE.Group());
      this.meldGroups.push(new THREE.Group());
      this.root.add(this.opponentGroups[seat]!);
      this.root.add(this.riverGroups[seat]!);
      this.root.add(this.meldGroups[seat]!);
    }

    window.addEventListener('resize', () => this.onResize());
  }

  private buildTable(): void {
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), this.feltMat);
    felt.rotation.x = -Math.PI / 2;
    felt.receiveShadow = true;
    this.root.add(felt);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.35, 11.2), this.railMat);
    rail.position.y = -0.2;
    this.root.add(rail);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.06, 10.4), this.trimMat);
    trim.position.y = 0.01;
    this.root.add(trim);
  }

  /** Apply theme appearance; optional cross-fade over transitionMs (no black frame). */
  applyTheme(modules: ThemeModules, opts?: { transitionMs?: number; from?: ThemeModules }): void {
    this.lastThemeModules = modules;
    const ms = opts?.transitionMs ?? 0;
    if (ms > 0 && opts?.from) {
      this.transitionFrom = opts.from;
      this.transitionTo = modules;
      this.transitionStartedAt = performance.now();
      this.transitionMs = ms;
      this.applyThemeAt(opts.from, modules, 0);
      return;
    }
    this.transitionFrom = null;
    this.transitionTo = null;
    this.applyThemeAt(modules, modules, 1);
  }

  ambientParticleKind(): 'dust' | 'petals' | null {
    return this.particleKind;
  }

  ambientParticleBackend(): 'gpu' | 'cpu' | null {
    return this.ambientSys?.backend ?? null;
  }

  qualitySettings(): QualitySettings {
    return { ...this.quality };
  }

  tileBackPattern(): 'solid' | 'cloud' {
    return getTileBackPattern();
  }

  /** Apply 画质档 to DPR, shadows, Bloom, particles, and sky simplification. */
  applyQuality(settings: QualitySettings, opts?: { gpuParticlesAvailable?: boolean }): void {
    this.quality = { ...settings };
    if (opts?.gpuParticlesAvailable != null) {
      this.gpuParticlesAvailable = opts.gpuParticlesAvailable;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, settings.dprCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const shadowsOn = settings.shadows !== 'off';
    this.renderer.shadowMap.enabled = shadowsOn;
    this.key.castShadow = shadowsOn;
    if (shadowsOn) {
      this.renderer.shadowMap.type =
        settings.shadows === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
      this.key.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
    }

    this.syncBloom(settings);
    if (this.lastThemeModules) {
      this.applyThemeAt(this.lastThemeModules, this.lastThemeModules, 1);
    }
    this.onResize();
  }

  /** Interpolate all appearance fields — sky/fog/lights/mark/tileBack included (story 90). */
  private applyThemeAt(from: ThemeModules, to: ThemeModules, t: number): void {
    const u = Math.min(1, Math.max(0, t));
    this.feltMat.color.setHex(this.lerpHex(from.table.felt, to.table.felt, u));
    this.railMat.color.setHex(this.lerpHex(from.table.rail, to.table.rail, u));
    this.trimMat.color.setHex(this.lerpHex(from.table.trim, to.table.trim, u));
    (this.dealerMarker.material as THREE.MeshStandardMaterial).color.setHex(
      this.lerpHex(from.table.trim, to.table.trim, u),
    );

    this.applyBlendedSky(from, to, u);

    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.setHex(this.lerpHex(from.fog.color, to.fog.color, u));
      fog.near = from.fog.near + (to.fog.near - from.fog.near) * u;
      fog.far = from.fog.far + (to.fog.far - from.fog.far) * u;
    }

    this.hemi.color.setHex(this.lerpHex(from.lights.hemiSky, to.lights.hemiSky, u));
    this.hemi.groundColor.setHex(this.lerpHex(from.lights.hemiGround, to.lights.hemiGround, u));
    this.hemi.intensity =
      from.lights.hemiIntensity + (to.lights.hemiIntensity - from.lights.hemiIntensity) * u;
    this.key.color.setHex(this.lerpHex(from.lights.key, to.lights.key, u));
    this.key.intensity =
      from.lights.keyIntensity + (to.lights.keyIntensity - from.lights.keyIntensity) * u;

    const pattern = u < 0.5 ? from.tileBack.pattern : to.tileBack.pattern;
    setTileBackAppearance({
      color: this.lerpHex(from.tileBack.color, to.tileBack.color, u),
      pattern,
    });

    const glyph = u < 0.5 ? from.mark.glyph : to.mark.glyph;
    const markColor = this.lerpHex(from.mark.color, to.mark.color, u);
    if (glyph !== this.markGlyph || markColor !== this.markColorHex) {
      this.markGlyph = glyph;
      this.markColorHex = markColor;
      const mat = this.markSprite.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.map = this.makeMarkTexture(glyph, markColor);
      mat.needsUpdate = true;
    }

    const particleSrc = u < 0.5 ? from : to;
    const particleStrength = u < 0.5 ? 1 - u * 2 : (u - 0.5) * 2;
    this.syncAmbientParticles(particleSrc, u === 0 || u === 1 ? 1 : particleStrength);
  }

  private applyBlendedSky(from: ThemeModules, to: ThemeModules, t: number): void {
    const skySteps = this.quality.sky === 'simplified' ? 8 : 256;

    if (this.quality.sky === 'simplified' && t >= 1) {
      // Low 画质档: collapse gradient skies to a single mid-band color.
      if (to.sky.kind === 'color') {
        if (this.skyGradientTex) {
          this.skyGradientTex.dispose();
          this.skyGradientTex = null;
        }
        this.scene.background = new THREE.Color(to.sky.color);
        return;
      }
      const column = blendSkyColumn(to.sky, to.sky, 1, skySteps);
      const mid = column[Math.floor(column.length / 2)] ?? [20, 30, 40];
      if (this.skyGradientTex) {
        this.skyGradientTex.dispose();
        this.skyGradientTex = null;
      }
      this.scene.background = new THREE.Color(rgbToHex(mid));
      return;
    }

    if (t <= 0 && from.sky.kind === 'color' && to.sky.kind === 'color' && from.sky.color === to.sky.color) {
      if (this.skyGradientTex) {
        this.skyGradientTex.dispose();
        this.skyGradientTex = null;
      }
      this.scene.background = new THREE.Color(from.sky.color);
      return;
    }
    if (t >= 1 && to.sky.kind === 'color') {
      if (this.skyGradientTex) {
        this.skyGradientTex.dispose();
        this.skyGradientTex = null;
      }
      this.scene.background = new THREE.Color(to.sky.color);
      return;
    }
    if (t >= 1 && to.sky.kind === 'gradient') {
      this.writeSkyColumn(blendSkyColumn(to.sky, to.sky, 1, skySteps));
      return;
    }

    const column = blendSkyColumn(from.sky, to.sky, t, skySteps);
    this.writeSkyColumn(column);
  }

  private writeSkyColumn(column: readonly (readonly [number, number, number])[]): void {
    if (!this.skyBlendCanvas) {
      this.skyBlendCanvas = document.createElement('canvas');
      this.skyBlendCanvas.width = 4;
      this.skyBlendCanvas.height = column.length;
      this.skyBlendCtx = this.skyBlendCanvas.getContext('2d');
    }
    const ctx = this.skyBlendCtx;
    const canvas = this.skyBlendCanvas;
    if (!ctx || !canvas) {
      this.scene.background = new THREE.Color(rgbToHex(column[0] ?? [0, 0, 0]));
      return;
    }
    if (canvas.height !== column.length) canvas.height = column.length;
    const img = ctx.createImageData(4, column.length);
    for (let y = 0; y < column.length; y++) {
      const [r, g, b] = column[y]!;
      for (let x = 0; x < 4; x++) {
        const i = (y * 4 + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (!this.skyGradientTex) {
      this.skyGradientTex = new THREE.CanvasTexture(canvas);
      this.skyGradientTex.colorSpace = THREE.SRGBColorSpace;
    } else {
      this.skyGradientTex.needsUpdate = true;
    }
    this.scene.background = this.skyGradientTex;
  }

  private syncAmbientParticles(modules: ThemeModules, strength: number): void {
    const kind = modules.ambientParticles.kind;
    const preferGpu = this.quality.preferGpuParticles;
    const needRebuild =
      !this.ambientSys ||
      this.particleKind !== kind ||
      this.ambientSys.capacity !== this.quality.particleBudget ||
      this.ambientSys.backend !== (preferGpu && this.gpuParticlesAvailable ? 'gpu' : 'cpu');

    if (needRebuild) {
      this.disposeParticles();
      this.createParticles(kind, modules.ambientParticles.color);
    }
    if (!this.ambientSys) return;

    const opacity = Math.max(0.12, 0.55 * Math.min(1, Math.max(0, strength)));
    const mat = this.ambientSys.points.material;
    if (mat instanceof THREE.PointsMaterial) {
      mat.color.setHex(modules.ambientParticles.color);
      mat.opacity = opacity;
      mat.size = kind === 'petals' ? 0.14 : 0.06;
    } else if (mat instanceof THREE.ShaderMaterial && mat.uniforms.uScale) {
      mat.uniforms.uScale.value = kind === 'petals' ? 520 : 360;
      mat.opacity = opacity;
    }
  }

  private createParticles(kind: 'dust' | 'petals', color: number): void {
    const count = this.quality.particleBudget;
    const preferGpu = this.quality.preferGpuParticles;
    const sys = createParticleSystem({
      capacity: Math.max(1, count),
      preferGpu,
      gpuAvailable: this.gpuParticlesAvailable,
    });
    sys.setBudget(count);
    sys.points.name = `ambient-${kind}-${sys.backend}`;

    const vel = new Float32Array(count * 3);
    const pos = sys.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const col = sys.points.geometry.getAttribute('aColor') as THREE.BufferAttribute | undefined;
    const r = ((color >> 16) & 0xff) / 255;
    const g = ((color >> 8) & 0xff) / 255;
    const b = (color & 0xff) / 255;

    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = 0.4 + Math.random() * 4.5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 9;
      if (kind === 'petals') {
        vel[i * 3] = (Math.random() - 0.5) * 0.25;
        vel[i * 3 + 1] = -0.15 - Math.random() * 0.35;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
      } else {
        vel[i * 3] = (Math.random() - 0.5) * 0.08;
        vel[i * 3 + 1] = 0.04 + Math.random() * 0.08;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
      }
      if (col) {
        col.setXYZ(i, r, g, b);
      }
      // Keep ambient particles continuously visible via alpha attribute.
      const alpha = sys.points.geometry.getAttribute('aAlpha');
      if (alpha) alpha.setX(i, 0.55);
      const size = sys.points.geometry.getAttribute('aSize');
      if (size) size.setX(i, kind === 'petals' ? 0.14 : 0.06);
    }
    pos.needsUpdate = true;
    if (col) col.needsUpdate = true;

    this.ambientSys = sys;
    this.particleVel = vel;
    this.particleKind = kind;
    this.scene.add(sys.points);
  }

  private disposeParticles(): void {
    if (!this.ambientSys) return;
    this.scene.remove(this.ambientSys.points);
    this.ambientSys.dispose();
    this.ambientSys = null;
    this.particleVel = null;
    this.particleKind = null;
  }

  private tickParticles(now: number): void {
    if (!this.ambientSys || !this.particleVel) return;
    const dt = this.lastParticleTick ? Math.min(0.05, (now - this.lastParticleTick) / 1000) : 0.016;
    this.lastParticleTick = now;
    const pos = this.ambientSys.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const n = Math.min(arr.length, this.particleVel.length);
    for (let i = 0; i < n; i += 3) {
      arr[i]! += this.particleVel[i]! * dt * 60 * 0.016;
      arr[i + 1]! += this.particleVel[i + 1]! * dt * 60 * 0.016;
      arr[i + 2]! += this.particleVel[i + 2]! * dt * 60 * 0.016;
      if (this.particleKind === 'petals' && arr[i + 1]! < 0.05) {
        arr[i]! = (Math.random() - 0.5) * 12;
        arr[i + 1]! = 3.5 + Math.random() * 1.5;
        arr[i + 2]! = (Math.random() - 0.5) * 9;
      }
      if (this.particleKind === 'dust' && arr[i + 1]! > 5) {
        arr[i + 1]! = 0.3 + Math.random() * 0.5;
      }
    }
    pos.needsUpdate = true;
  }

  private syncBloom(settings: QualitySettings): void {
    if (settings.bloom === 'off') {
      this.composer = null;
      this.bloomPass = null;
      return;
    }
    if (!this.composer || !this.bloomPass) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.28,
        0.5,
        0.92,
      );
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }
    const scale = settings.bloom === 'half' ? 0.5 : 1;
    this.bloomPass.strength = 0.28 * scale;
    this.composer.setSize(window.innerWidth * scale, window.innerHeight * scale);
  }

  private makeMarkTexture(glyph: string, color: number): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 100, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 128, 84, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = 'bold 110px "STKaiti","KaiTi","Noto Serif CJK SC",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, 128, 138);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private lerpHex(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.dprCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.composer && this.quality.bloom !== 'off') {
      const scale = this.quality.bloom === 'half' ? 0.5 : 1;
      this.composer.setSize(window.innerWidth * scale, window.innerHeight * scale);
    }
  }

  sync(state: HandState | null, selectedTileId: string | null): void {
    this.clearDynamic();
    if (!state) return;

    this.placeDealerMarker(state.dealer);

    for (const seat of [0, 1, 2, 3] as Seat[]) {
      this.layoutRiver(seat, state.seats[seat].river);
      this.layoutMelds(seat, state.seats[seat].melds);
      if (seat === PLAYER_SEAT) {
        this.layoutPlayerHand(displayHand(state.seats[seat]), selectedTileId);
      } else {
        this.layoutOpponentHand(seat, displayHand(state.seats[seat]).length);
      }
    }

    void totalTileCount(state);
  }

  private clearDynamic(): void {
    for (const tile of this.playerTiles) this.root.remove(tile.group);
    this.playerTiles = [];
    for (const g of this.opponentGroups) {
      while (g.children.length) g.remove(g.children[0]!);
    }
    for (const g of this.riverGroups) {
      while (g.children.length) g.remove(g.children[0]!);
    }
    for (const g of this.meldGroups) {
      while (g.children.length) g.remove(g.children[0]!);
    }
  }

  private placeDealerMarker(dealer: Seat): void {
    const dist = 3.4;
    const yaw = SEAT_YAW[dealer];
    const pos = new THREE.Vector3(0, 0.05, dist).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    // Pull slightly toward center from each seat edge
    this.dealerMarker.position.set(pos.x * 0.55, 0.05, pos.z * 0.55);
  }

  private layoutPlayerHand(tiles: PhysicalTile[], selectedTileId: string | null): void {
    const n = tiles.length;
    tiles.forEach((tile, i) => {
      const preview = createTile(tile.code);
      const gap = i === n - 1 && n === 14 ? 0.22 : 0;
      const x = (i - (n - 1) / 2) * (TILE_W + 0.04) + gap;
      const selected = tile.id === selectedTileId;
      preview.group.position.set(x, TILE_H / 2 + (selected ? 0.18 : 0.02), 4.2);
      preview.outline.material.opacity = selected ? 0.7 : 0;
      const data: TileUserData = { tileId: tile.id, seat: PLAYER_SEAT, kind: 'hand' };
      preview.group.userData = data;
      preview.mesh.userData = data;
      this.root.add(preview.group);
      this.playerTiles.push(preview);
    });
  }

  private layoutOpponentHand(seat: Seat, count: number): void {
    const group = this.opponentGroups[seat]!;
    const yaw = SEAT_YAW[seat];
    for (let i = 0; i < count; i++) {
      const tile = createTile('P');
      // Face down: rotate so back faces up-ish toward table center look
      tile.group.rotation.x = Math.PI / 2;
      const x = (i - (count - 1) / 2) * (TILE_W * 0.72);
      tile.group.position.set(x, TILE_D / 2 + 0.02, 4.05);
      group.add(tile.group);
    }
    group.rotation.y = yaw;
  }

  private layoutRiver(seat: Seat, river: PhysicalTile[]): void {
    const group = this.riverGroups[seat]!;
    const yaw = SEAT_YAW[seat];
    river.forEach((tile, i) => {
      const preview = createTile(tile.code);
      const col = i % 6;
      const row = Math.floor(i / 6);
      preview.group.rotation.x = -Math.PI / 2;
      preview.group.position.set(
        (col - 2.5) * (TILE_W * 0.95),
        TILE_D / 2 + 0.01,
        1.35 + row * (TILE_H * 0.55),
      );
      group.add(preview.group);
    });
    group.rotation.y = yaw;
  }

  private layoutMelds(seat: Seat, melds: HandState['seats'][Seat]['melds']): void {
    const group = this.meldGroups[seat]!;
    const yaw = SEAT_YAW[seat];
    let xCursor = -3.2;
    melds.forEach((meld) => {
      meld.tiles.forEach((tile, i) => {
        const preview = createTile(tile.code);
        preview.group.rotation.x = -Math.PI / 2;
        const claimed = tile.id === meld.claimedTileId;
        preview.group.position.set(
          xCursor + i * (TILE_W * 0.92),
          TILE_D / 2 + 0.01,
          3.35,
        );
        if (claimed) {
          preview.outline.material.opacity = 0.55;
          preview.outline.material.color.setHex(0xf5c46a);
        }
        group.add(preview.group);
      });
      xCursor += meld.tiles.length * (TILE_W * 0.92) + 0.18;
    });
    group.rotation.y = yaw;
  }

  pickPlayerTile(clientX: number, clientY: number): string | null {
    this.setPointer(clientX, clientY);
    const meshes = this.playerTiles.map((t) => t.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    const hit = hits[0]?.object;
    if (!hit) return null;
    const data = hit.userData as TileUserData;
    return data.kind === 'hand' ? data.tileId : null;
  }

  isOverRiver(clientX: number, clientY: number): boolean {
    this.setPointer(clientX, clientY);
    const hits = this.raycaster.intersectObject(this.riverZone, false);
    return hits.length > 0;
  }

  beginDrag(tileId: string): void {
    this.dragTileId = tileId;
    const tile = this.playerTiles.find((t) => (t.group.userData as TileUserData).tileId === tileId);
    this.dragOrigin = tile ? tile.group.position.clone() : null;
  }

  moveDrag(clientX: number, clientY: number): void {
    if (!this.dragTileId) return;
    const tile = this.playerTiles.find((t) => (t.group.userData as TileUserData).tileId === this.dragTileId);
    if (!tile) return;
    this.setPointer(clientX, clientY);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, target);
    if (target) tile.group.position.set(target.x, 0.35, target.z);
  }

  endDrag(clientX: number, clientY: number): { tileId: string; intoRiver: boolean } | null {
    if (!this.dragTileId) return null;
    const tileId = this.dragTileId;
    const intoRiver = this.isOverRiver(clientX, clientY);
    const tile = this.playerTiles.find((t) => (t.group.userData as TileUserData).tileId === tileId);
    if (tile && this.dragOrigin && !intoRiver) {
      tile.group.position.copy(this.dragOrigin);
    }
    this.dragTileId = null;
    this.dragOrigin = null;
    return { tileId, intoRiver };
  }

  private setPointer(clientX: number, clientY: number): void {
    this.pointer.x = (clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  render(): void {
    const now = performance.now();
    if (this.transitionFrom && this.transitionTo) {
      const t = Math.min(1, (now - this.transitionStartedAt) / this.transitionMs);
      this.applyThemeAt(this.transitionFrom, this.transitionTo, t);
      if (t >= 1) {
        this.transitionFrom = null;
        this.transitionTo = null;
      }
    }
    this.tickParticles(now);
    if (this.composer && this.quality.bloom !== 'off') {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

/** Re-skin a tile mesh when codes change without recreating geometry. */
export function updateTileCode(tile: PreviewTile, code: PhysicalTile['code']): void {
  setTileCode(tile, code);
}
