import * as THREE from 'three';
import { FACE_CODES, type TileCode } from '../core';
import { areFontsReady } from '../fonts/loadFonts';
import {
  backMat,
  drawFace,
  sideMat,
  TILE_D,
  TILE_H,
  TILE_W,
} from '../preview/tiles';

const ATLAS_COLS = 8;
const ATLAS_ROWS = 5; // 8*5 = 40 > 34
const CELL_W = 128;
const CELL_H = 168;

export type TileInstancePose = {
  code: TileCode;
  position: THREE.Vector3;
  /** World orientation; prefer quaternion composition over Euler yaw addition. */
  quaternion: THREE.Quaternion;
  /** Legacy face-swap; concealed hands must not rely on this — use back-facing pose instead. */
  faceDown?: boolean;
  selected?: boolean;
};

let atlasTex: THREE.CanvasTexture | null = null;
let atlasIndex = new Map<TileCode, number>();

function ensureAtlas(): { texture: THREE.CanvasTexture; index: Map<TileCode, number> } {
  if (atlasTex && atlasIndex.size) {
    return { texture: atlasTex, index: atlasIndex };
  }
  if (!areFontsReady()) {
    throw new Error('tile atlas requires bundled fonts');
  }
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * CELL_W;
  canvas.height = ATLAS_ROWS * CELL_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const index = new Map<TileCode, number>();
  FACE_CODES.forEach((code, i) => {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    const x = col * CELL_W;
    const y = row * CELL_H;
    ctx.save();
    ctx.translate(x, y);
    drawFace(ctx, code, CELL_W, CELL_H);
    ctx.restore();
    index.set(code, i);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  atlasTex = texture;
  atlasIndex = index;
  return { texture, index };
}

/** Drop atlas so faces can be rebuilt after font load / tests. */
export function clearTileAtlas(): void {
  atlasTex?.dispose();
  atlasTex = null;
  atlasIndex = new Map();
}

function makeBatchMaterial(
  atlas: THREE.CanvasTexture,
  backColor: THREE.Color,
  backMap: THREE.Texture | null,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlas },
      uCols: { value: ATLAS_COLS },
      uRows: { value: ATLAS_ROWS },
      uSide: { value: sideMat.color.clone() },
      uBack: { value: backColor },
      uBackMap: { value: backMap },
      uUseBackMap: { value: backMap ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aAtlasIndex;
      attribute float aFaceDown;
      varying vec3 vLocalNormal;
      varying vec2 vUv;
      varying float vAtlasIndex;
      varying float vFaceDown;
      void main() {
        vLocalNormal = normal;
        vUv = uv;
        vAtlasIndex = aAtlasIndex;
        vFaceDown = aFaceDown;
        vec4 world = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform float uCols;
      uniform float uRows;
      uniform vec3 uSide;
      uniform vec3 uBack;
      uniform sampler2D uBackMap;
      uniform float uUseBackMap;
      varying vec3 vLocalNormal;
      varying vec2 vUv;
      varying float vAtlasIndex;
      varying float vFaceDown;
      void main() {
        vec3 n = normalize(vLocalNormal);
        bool front = n.z > 0.55;
        bool back = n.z < -0.55;
        if (vFaceDown > 0.5) {
          bool tmp = front;
          front = back;
          back = tmp;
        }
        if (front) {
          float col = mod(vAtlasIndex, uCols);
          float row = floor(vAtlasIndex / uCols);
          vec2 atlasUv = vec2((col + vUv.x) / uCols, 1.0 - (row + 1.0 - vUv.y) / uRows);
          gl_FragColor = texture2D(uAtlas, atlasUv);
          return;
        }
        if (back) {
          if (uUseBackMap > 0.5) {
            gl_FragColor = texture2D(uBackMap, vUv) * vec4(uBack, 1.0);
          } else {
            gl_FragColor = vec4(uBack, 1.0);
          }
          return;
        }
        gl_FragColor = vec4(uSide, 1.0);
      }
    `,
  });
}

/**
 * Batched mahjong tiles (InstancedMesh + atlas). One draw call for the batch body;
 * optional second InstancedMesh for selection outlines.
 */
export class TileInstanceBatch {
  readonly mesh: THREE.InstancedMesh;
  readonly outlines: THREE.InstancedMesh;
  private readonly capacity: number;
  private readonly atlasIndex: Map<TileCode, number>;
  private readonly material: THREE.ShaderMaterial;
  private readonly outlineMat: THREE.MeshBasicMaterial;
  private readonly geometry: THREE.BoxGeometry;
  private readonly dummy = new THREE.Object3D();

  constructor(capacity: number) {
    this.capacity = capacity;
    const { texture, index } = ensureAtlas();
    this.atlasIndex = index;
    this.geometry = new THREE.BoxGeometry(TILE_W, TILE_H, TILE_D);
    const backColor = backMat.color.clone();
    const backMap = backMat.map;
    this.material = makeBatchMaterial(texture, backColor, backMap);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    const atlasAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    const faceDownAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.mesh.geometry.setAttribute('aAtlasIndex', atlasAttr);
    this.mesh.geometry.setAttribute('aFaceDown', faceDownAttr);

    this.outlineMat = new THREE.MeshBasicMaterial({
      color: 0xffd27a,
      transparent: true,
      opacity: 0.7,
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
    });
    this.outlines = new THREE.InstancedMesh(this.geometry, this.outlineMat, capacity);
    this.outlines.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.outlines.count = 0;
    this.outlines.frustumCulled = false;
  }

  /** Sync back color/map from shared theme materials. */
  syncBackAppearance(): void {
    this.material.uniforms.uBack.value.copy(backMat.color);
    this.material.uniforms.uBackMap.value = backMat.map;
    this.material.uniforms.uUseBackMap.value = backMat.map ? 1 : 0;
    this.material.uniforms.uSide.value.copy(sideMat.color);
    this.material.uniformsNeedUpdate = true;
  }

  setInstances(poses: readonly TileInstancePose[]): void {
    const atlasAttr = this.mesh.geometry.getAttribute('aAtlasIndex') as THREE.InstancedBufferAttribute;
    const faceDownAttr = this.mesh.geometry.getAttribute('aFaceDown') as THREE.InstancedBufferAttribute;
    let outlineCount = 0;
    const n = Math.min(poses.length, this.capacity);
    for (let i = 0; i < n; i++) {
      const pose = poses[i]!;
      const idx = this.atlasIndex.get(pose.code) ?? 0;
      this.dummy.position.copy(pose.position);
      this.dummy.quaternion.copy(pose.quaternion);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      atlasAttr.setX(i, idx);
      faceDownAttr.setX(i, pose.faceDown ? 1 : 0);
      if (pose.selected) {
        this.dummy.scale.set(1.13, 1.1, 1.16);
        this.dummy.updateMatrix();
        this.outlines.setMatrixAt(outlineCount, this.dummy.matrix);
        outlineCount += 1;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    atlasAttr.needsUpdate = true;
    faceDownAttr.needsUpdate = true;
    this.outlines.count = outlineCount;
    this.outlines.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.mesh.count = 0;
    this.outlines.count = 0;
  }

  /** Update one instance pose (drag / selection lift). */
  setInstancePose(index: number, pose: TileInstancePose): void {
    if (index < 0 || index >= this.mesh.count) return;
    const atlasAttr = this.mesh.geometry.getAttribute('aAtlasIndex') as THREE.InstancedBufferAttribute;
    const faceDownAttr = this.mesh.geometry.getAttribute('aFaceDown') as THREE.InstancedBufferAttribute;
    const idx = this.atlasIndex.get(pose.code) ?? 0;
    this.dummy.position.copy(pose.position);
    this.dummy.quaternion.copy(pose.quaternion);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    atlasAttr.setX(index, idx);
    faceDownAttr.setX(index, pose.faceDown ? 1 : 0);
    atlasAttr.needsUpdate = true;
    faceDownAttr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.dispose();
    this.outlines.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.outlineMat.dispose();
  }
}
