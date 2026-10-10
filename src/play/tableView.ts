import * as THREE from 'three';
import {
  displayHand,
  PLAYER_SEAT,
  totalTileCount,
  type HandState,
  type PhysicalTile,
  type Seat,
} from '../core';
import {
  createTile,
  setTileBackColor,
  setTileCode,
  TILE_D,
  TILE_H,
  TILE_W,
  type PreviewTile,
} from '../preview/tiles';
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
  private transitionFrom: ThemeModules | null = null;
  private transitionTo: ThemeModules | null = null;
  private transitionStartedAt = 0;
  private transitionMs = 450;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private dragTileId: string | null = null;
  private dragOrigin: THREE.Vector3 | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

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
    const ms = opts?.transitionMs ?? 0;
    if (ms > 0 && opts?.from) {
      this.transitionFrom = opts.from;
      this.transitionTo = modules;
      this.transitionStartedAt = performance.now();
      this.transitionMs = ms;
      this.applyThemeInstant(opts.from);
      return;
    }
    this.transitionFrom = null;
    this.transitionTo = null;
    this.applyThemeInstant(modules);
  }

  private applyThemeInstant(modules: ThemeModules): void {
    this.feltMat.color.setHex(modules.table.felt);
    this.railMat.color.setHex(modules.table.rail);
    this.trimMat.color.setHex(modules.table.trim);
    (this.dealerMarker.material as THREE.MeshStandardMaterial).color.setHex(modules.table.trim);

    this.applySky(modules);
    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.setHex(modules.fog.color);
      fog.near = modules.fog.near;
      fog.far = modules.fog.far;
    }

    this.hemi.color.setHex(modules.lights.hemiSky);
    this.hemi.groundColor.setHex(modules.lights.hemiGround);
    this.hemi.intensity = modules.lights.hemiIntensity;
    this.key.color.setHex(modules.lights.key);
    this.key.intensity = modules.lights.keyIntensity;

    setTileBackColor(modules.tileBack);

    const mat = this.markSprite.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.map = this.makeMarkTexture(modules.mark.glyph, modules.mark.color);
    mat.needsUpdate = true;
  }

  private applySky(modules: ThemeModules): void {
    if (this.skyGradientTex) {
      this.skyGradientTex.dispose();
      this.skyGradientTex = null;
    }
    if (modules.sky.kind === 'color') {
      this.scene.background = new THREE.Color(modules.sky.color);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.scene.background = new THREE.Color(0x2a1028);
      return;
    }
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    for (const stop of modules.sky.stops) g.addColorStop(stop.t, stop.color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    this.skyGradientTex = new THREE.CanvasTexture(canvas);
    this.skyGradientTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyGradientTex;
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
    this.renderer.setSize(window.innerWidth, window.innerHeight);
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
    if (this.transitionFrom && this.transitionTo) {
      const t = Math.min(1, (performance.now() - this.transitionStartedAt) / this.transitionMs);
      const from = this.transitionFrom;
      const to = this.transitionTo;
      this.feltMat.color.setHex(this.lerpHex(from.table.felt, to.table.felt, t));
      this.railMat.color.setHex(this.lerpHex(from.table.rail, to.table.rail, t));
      this.trimMat.color.setHex(this.lerpHex(from.table.trim, to.table.trim, t));
      this.hemi.intensity = from.lights.hemiIntensity + (to.lights.hemiIntensity - from.lights.hemiIntensity) * t;
      this.key.intensity = from.lights.keyIntensity + (to.lights.keyIntensity - from.lights.keyIntensity) * t;
      if (t >= 1) {
        this.applyThemeInstant(to);
        this.transitionFrom = null;
        this.transitionTo = null;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}

/** Re-skin a tile mesh when codes change without recreating geometry. */
export function updateTileCode(tile: PreviewTile, code: PhysicalTile['code']): void {
  setTileCode(tile, code);
}
