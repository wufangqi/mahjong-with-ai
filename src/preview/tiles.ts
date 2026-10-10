// 麻将牌：CanvasTexture 牌面 + 圆角立方体
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FONT_SANS, FONT_SERIF } from '../fonts/families';
import { areFontsReady } from '../fonts/loadFonts';
import type { TileCode } from './fixedHands';

export const TILE_W = 0.6,
  TILE_H = 0.8,
  TILE_D = 0.42;

export { FONT_SANS, FONT_SERIF };

const NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;
const HONOR: Record<string, string> = { E: '东', S: '南', W: '西', N: '北', C: '中', F: '發' };

const LAYOUT: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.5, 0.27],
    [0.5, 0.73],
  ],
  3: [
    [0.26, 0.2],
    [0.5, 0.5],
    [0.74, 0.8],
  ],
  4: [
    [0.3, 0.28],
    [0.7, 0.28],
    [0.3, 0.72],
    [0.7, 0.72],
  ],
  5: [
    [0.27, 0.24],
    [0.73, 0.24],
    [0.5, 0.5],
    [0.27, 0.76],
    [0.73, 0.76],
  ],
  6: [
    [0.3, 0.2],
    [0.7, 0.2],
    [0.3, 0.5],
    [0.7, 0.5],
    [0.3, 0.8],
    [0.7, 0.8],
  ],
  7: [
    [0.24, 0.14],
    [0.5, 0.27],
    [0.76, 0.4],
    [0.3, 0.62],
    [0.7, 0.62],
    [0.3, 0.86],
    [0.7, 0.86],
  ],
  8: [
    [0.3, 0.14],
    [0.7, 0.14],
    [0.3, 0.38],
    [0.7, 0.38],
    [0.3, 0.62],
    [0.7, 0.62],
    [0.3, 0.86],
    [0.7, 0.86],
  ],
  9: [
    [0.2, 0.18],
    [0.5, 0.18],
    [0.8, 0.18],
    [0.2, 0.5],
    [0.5, 0.5],
    [0.8, 0.5],
    [0.2, 0.82],
    [0.5, 0.82],
    [0.8, 0.82],
  ],
};
const BLUE = '#1d4396',
  GREEN = '#17733a',
  RED = '#b8141f',
  INK = '#152454';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbf6e8';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbf6e8';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawStick(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  roundRect(ctx, x - w / 2, y - h / 2, w, h, w / 2.2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 2;
  for (const k of [-0.18, 0.18]) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 2, y + h * k);
    ctx.lineTo(x + w / 2 - 2, y + h * k);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(x - w * 0.15, y - h / 2 + 5, w * 0.12, h - 10);
}

export function drawFace(
  ctx: CanvasRenderingContext2D,
  code: TileCode,
  W: number,
  H: number,
): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#fffaf0');
  g.addColorStop(1, '#efe6cf');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120,100,60,.25)';
  ctx.lineWidth = 4;
  roundRect(ctx, 10, 10, W - 20, H - 20, 18);
  ctx.stroke();

  const pad = 26,
    aw = W - pad * 2,
    ah = H - pad * 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const suit = code[0];
  const n = +code[1];

  if (suit === 'm') {
    ctx.fillStyle = INK;
    ctx.font = `900 108px ${FONT_SERIF}`;
    ctx.fillText(NUMS[n - 1], W / 2, H * 0.3);
    ctx.fillStyle = RED;
    ctx.font = `900 120px ${FONT_SERIF}`;
    ctx.fillText('萬', W / 2, H * 0.7);
  } else if (suit === 'p') {
    const rs: Record<number, number> = {
      1: 88,
      2: 50,
      3: 40,
      4: 42,
      5: 38,
      6: 32,
      7: 26,
      8: 26,
      9: 26,
    };
    const cols = [BLUE, GREEN, RED];
    LAYOUT[n].forEach(([u, v], i) => {
      const c =
        n === 1
          ? RED
          : n === 5 && i === 2
            ? RED
            : n === 7 && i < 3
              ? GREEN
              : cols[(i + n) % 3];
      drawDot(ctx, pad + u * aw, pad + v * ah, rs[n], c);
    });
    if (n === 1) {
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 98, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (suit === 's') {
    if (n === 1) {
      drawStick(ctx, W / 2, H / 2, 46, 220, GREEN);
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2 - 120, 18, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const h = n >= 7 ? 58 : n >= 5 ? 72 : 96;
      LAYOUT[n].forEach(([u, v], i) => {
        const c =
          (n === 5 && i === 2) || (n === 7 && i === 0) || (n === 9 && i % 3 === 1)
            ? RED
            : GREEN;
        drawStick(ctx, pad + u * aw, pad + v * ah, 24, h, c);
      });
    }
  } else if (code === 'P') {
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 9;
    roundRect(ctx, 46, 60, W - 92, H - 120, 12);
    ctx.stroke();
    ctx.lineWidth = 4;
    roundRect(ctx, 62, 76, W - 124, H - 152, 8);
    ctx.stroke();
  } else {
    const ch = HONOR[code];
    ctx.fillStyle = code === 'C' ? RED : code === 'F' ? GREEN : INK;
    ctx.font = `900 176px ${FONT_SERIF}`;
    ctx.fillText(ch, W / 2, H / 2 + 6);
  }
}

const texCache = new Map<TileCode, THREE.CanvasTexture>();
const frontMats = new Map<TileCode, THREE.MeshStandardMaterial>();
let maxAniso = 4;
export function setAnisotropy(a: number): void {
  maxAniso = a;
}

/** Drop cached faces so they can be redrawn after bundled fonts finish loading. */
export function clearFaceTextureCache(): void {
  for (const tex of texCache.values()) tex.dispose();
  texCache.clear();
  for (const mat of frontMats.values()) mat.dispose();
  frontMats.clear();
}

function faceTexture(code: TileCode): THREE.CanvasTexture {
  if (!areFontsReady()) {
    throw new Error('refuse to draw tile faces before bundled fonts are ready');
  }
  const cached = texCache.get(code);
  if (cached) return cached;
  const W = 240,
    H = 320;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  drawFace(ctx, code, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  texCache.set(code, t);
  return t;
}

export const sideMat = new THREE.MeshStandardMaterial({
  color: 0xf2ead4,
  roughness: 0.35,
  metalness: 0.0,
});
export const backMat = new THREE.MeshStandardMaterial({
  color: 0x0f7a4f,
  roughness: 0.3,
  metalness: 0.05,
});

let backPatternTex: THREE.CanvasTexture | null = null;
let backPatternKind: 'solid' | 'cloud' = 'solid';
let backPatternColor = -1;

function makeCloudBackTexture(baseHex: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const base = `#${baseHex.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  // Gold cloud / ruyi scrolls on crimson — procedural, no external assets
  ctx.strokeStyle = 'rgba(212,175,55,0.78)';
  ctx.fillStyle = 'rgba(255,220,140,0.22)';
  ctx.lineWidth = 3;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const cx = 32 + col * 64;
      const cy = 32 + row * 64;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 22, 12, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx + 14, cy - 6, 14, 8, -0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Theme seam: update shared tile-back appearance without touching face materials.
 * `cloud` applies a procedural gold cloud pattern (中式宫廷).
 */
export function setTileBackAppearance(opts: {
  color: number;
  pattern: 'solid' | 'cloud';
}): void {
  if (opts.pattern === 'cloud') {
    if (backPatternKind !== 'cloud' || backPatternColor !== opts.color || !backPatternTex) {
      backPatternTex?.dispose();
      backPatternTex = makeCloudBackTexture(opts.color);
      backPatternKind = 'cloud';
      backPatternColor = opts.color;
    }
    backMat.map = backPatternTex;
    backMat.color.setHex(0xffffff);
    backMat.needsUpdate = true;
    return;
  }
  if (backPatternTex) {
    backPatternTex.dispose();
    backPatternTex = null;
  }
  backPatternKind = 'solid';
  backPatternColor = opts.color;
  backMat.map = null;
  backMat.color.setHex(opts.color);
  backMat.needsUpdate = true;
}

/** @deprecated prefer setTileBackAppearance */
export function setTileBackColor(hex: number): void {
  setTileBackAppearance({ color: hex, pattern: 'solid' });
}

export function getTileBackPattern(): 'solid' | 'cloud' {
  return backPatternKind;
}

export function frontMaterial(code: TileCode): THREE.MeshStandardMaterial {
  let mat = frontMats.get(code);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      map: faceTexture(code),
      roughness: 0.32,
      emissive: 0xffffff,
      emissiveMap: faceTexture(code),
      emissiveIntensity: 0.0,
    });
    frontMats.set(code, mat);
  }
  return mat;
}

export function tileMaterials(code: TileCode): THREE.Material[] {
  return [sideMat, sideMat, sideMat, sideMat, frontMaterial(code), backMat];
}

export const tileGeometry = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_D, 3, 0.06);

export const GOLD = new THREE.Color(3.2, 2.1, 0.6);

export type PreviewTile = {
  group: THREE.Group;
  mesh: THREE.Mesh;
  outline: THREE.Mesh<RoundedBoxGeometry, THREE.MeshBasicMaterial>;
  code: TileCode;
  basePos: THREE.Vector3;
  baseQuat: THREE.Quaternion;
};

export function createTile(code: TileCode): PreviewTile {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(tileGeometry, tileMaterials(code));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  const outlineMat = new THREE.MeshBasicMaterial({
    color: GOLD.clone(),
    transparent: true,
    opacity: 0,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const outline = new THREE.Mesh(tileGeometry, outlineMat);
  outline.scale.set(1.13, 1.1, 1.16);
  outline.renderOrder = 2;
  group.add(outline);
  return {
    group,
    mesh,
    outline,
    code,
    basePos: new THREE.Vector3(),
    baseQuat: new THREE.Quaternion(),
  };
}

export function setTileCode(tile: PreviewTile, code: TileCode): void {
  tile.code = code;
  tile.mesh.material = tileMaterials(code);
}
