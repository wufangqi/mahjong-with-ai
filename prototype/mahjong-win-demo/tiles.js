// 麻将牌：CanvasTexture 牌面 + 圆角立方体
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const TILE_W = 0.6, TILE_H = 0.8, TILE_D = 0.42;

export const FONT_SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC","Source Han Sans SC","WenQuanYi Micro Hei",sans-serif';
export const FONT_SERIF = '"STKaiti","KaiTi","Kaiti SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","SimSun",serif';

const NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONOR = { E: '东', S: '南', W: '西', N: '北', C: '中', F: '發' };

// 筒 / 索 图案布局（归一化坐标）
const LAYOUT = {
  1: [[.5, .5]],
  2: [[.5, .27], [.5, .73]],
  3: [[.26, .2], [.5, .5], [.74, .8]],
  4: [[.3, .28], [.7, .28], [.3, .72], [.7, .72]],
  5: [[.27, .24], [.73, .24], [.5, .5], [.27, .76], [.73, .76]],
  6: [[.3, .2], [.7, .2], [.3, .5], [.7, .5], [.3, .8], [.7, .8]],
  7: [[.24, .14], [.5, .27], [.76, .4], [.3, .62], [.7, .62], [.3, .86], [.7, .86]],
  8: [[.3, .14], [.7, .14], [.3, .38], [.7, .38], [.3, .62], [.7, .62], [.3, .86], [.7, .86]],
  9: [[.2, .18], [.5, .18], [.8, .18], [.2, .5], [.5, .5], [.8, .5], [.2, .82], [.5, .82], [.8, .82]],
};
const BLUE = '#1d4396', GREEN = '#17733a', RED = '#b8141f', INK = '#152454';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawDot(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbf6e8'; ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * 0.52, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbf6e8'; ctx.beginPath(); ctx.arc(x, y, r * 0.18, 0, Math.PI * 2); ctx.fill();
}

function drawStick(ctx, x, y, w, h, color) {
  roundRect(ctx, x - w / 2, y - h / 2, w, h, w / 2.2);
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
  for (const k of [-0.18, 0.18]) {
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 2, y + h * k); ctx.lineTo(x + w / 2 - 2, y + h * k); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(x - w * 0.15, y - h / 2 + 5, w * 0.12, h - 10);
}

export function drawFace(ctx, code, W, H) {
  // 象牙底
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#efe6cf');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120,100,60,.25)'; ctx.lineWidth = 4;
  roundRect(ctx, 10, 10, W - 20, H - 20, 18); ctx.stroke();

  const pad = 26, aw = W - pad * 2, ah = H - pad * 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const suit = code[0], n = +code[1];

  if (suit === 'm') {
    ctx.fillStyle = INK; ctx.font = `900 108px ${FONT_SERIF}`;
    ctx.fillText(NUMS[n - 1], W / 2, H * 0.3);
    ctx.fillStyle = RED; ctx.font = `900 120px ${FONT_SERIF}`;
    ctx.fillText('萬', W / 2, H * 0.7);
  } else if (suit === 'p') {
    const rs = { 1: 88, 2: 50, 3: 40, 4: 42, 5: 38, 6: 32, 7: 26, 8: 26, 9: 26 };
    const cols = [BLUE, GREEN, RED];
    LAYOUT[n].forEach(([u, v], i) => {
      const c = n === 1 ? RED : n === 5 && i === 2 ? RED : n === 7 && i < 3 ? GREEN : cols[(i + n) % 3];
      drawDot(ctx, pad + u * aw, pad + v * ah, rs[n], c);
    });
    if (n === 1) { // 一筒加花纹
      ctx.strokeStyle = GREEN; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 98, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (suit === 's') {
    if (n === 1) { // 幺鸡简化为一根华丽竹
      drawStick(ctx, W / 2, H / 2, 46, 220, GREEN);
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(W / 2, H / 2 - 120, 18, 0, Math.PI * 2); ctx.fill();
    } else {
      const h = n >= 7 ? 58 : n >= 5 ? 72 : 96;
      LAYOUT[n].forEach(([u, v], i) => {
        const c = (n === 5 && i === 2) || (n === 7 && i === 0) || (n === 9 && i % 3 === 1) ? RED : GREEN;
        drawStick(ctx, pad + u * aw, pad + v * ah, 24, h, c);
      });
    }
  } else if (code === 'P') { // 白板
    ctx.strokeStyle = BLUE; ctx.lineWidth = 9;
    roundRect(ctx, 46, 60, W - 92, H - 120, 12); ctx.stroke();
    ctx.lineWidth = 4; roundRect(ctx, 62, 76, W - 124, H - 152, 8); ctx.stroke();
  } else {
    const ch = HONOR[code];
    ctx.fillStyle = code === 'C' ? RED : code === 'F' ? GREEN : INK;
    ctx.font = `900 176px ${FONT_SERIF}`;
    ctx.fillText(ch, W / 2, H / 2 + 6);
  }
}

// ---- 材质 ----
const texCache = new Map();
let maxAniso = 4;
export function setAnisotropy(a) { maxAniso = a; }

function faceTexture(code) {
  if (texCache.has(code)) return texCache.get(code);
  const W = 240, H = 320;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  drawFace(c.getContext('2d'), code, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  texCache.set(code, t);
  return t;
}

export const sideMat = new THREE.MeshStandardMaterial({ color: 0xf2ead4, roughness: 0.35, metalness: 0.0 });
export const backMat = new THREE.MeshStandardMaterial({ color: 0x0f7a4f, roughness: 0.3, metalness: 0.05 });
const frontMats = new Map();
export function frontMaterial(code) {
  if (!frontMats.has(code)) {
    frontMats.set(code, new THREE.MeshStandardMaterial({ map: faceTexture(code), roughness: 0.32, emissive: 0xffffff, emissiveMap: faceTexture(code), emissiveIntensity: 0.0 }));
  }
  return frontMats.get(code);
}
// BoxGeometry 面顺序：+x, -x, +y, -y, +z(正面), -z(背面)
export function tileMaterials(code) {
  return [sideMat, sideMat, sideMat, sideMat, frontMaterial(code), backMat];
}

export const tileGeometry = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_D, 3, 0.06);

export const GOLD = new THREE.Color(3.2, 2.1, 0.6); // HDR 金色，配合 Bloom 发光

export function createTile(code) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(tileGeometry, tileMaterials(code));
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  // 描边外壳（背面渲染 + 加法混合），用于金边闪光
  const outlineMat = new THREE.MeshBasicMaterial({
    color: GOLD.clone(), transparent: true, opacity: 0, side: THREE.BackSide,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const outline = new THREE.Mesh(tileGeometry, outlineMat);
  outline.scale.set(1.13, 1.1, 1.16);
  outline.renderOrder = 2;
  group.add(outline);
  return { group, mesh, outline, code };
}

export function setTileCode(tile, code) {
  tile.code = code;
  tile.mesh.material = tileMaterials(code);
}
