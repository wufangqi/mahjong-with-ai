// 中国风天庭：云海、玉台、金柱、琉璃飞檐
import * as THREE from 'three';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function skyTexture() {
  return canvasTex(32, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#160c30');
    g.addColorStop(0.18, '#3a2070');
    g.addColorStop(0.36, '#7a3d78');
    g.addColorStop(0.5, '#d48462');
    g.addColorStop(0.64, '#f0c48a');
    g.addColorStop(0.8, '#f7e2c0');
    g.addColorStop(1, '#efe0cc');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.28;
    for (const [x, y, rx, ry, rot, col] of [[6, 210, 16, 36, 0.2, '#ffe6c4'], [22, 250, 14, 28, -0.4, '#ffd0dc'], [12, 160, 12, 22, 0.6, '#f8d8ff'], [26, 190, 10, 18, 0.1, '#ffe8c8']]) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function moonTexture() {
  return canvasTex(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,250,230,1)');
    g.addColorStop(0.42, 'rgba(255,236,190,0.95)');
    g.addColorStop(0.62, 'rgba(255,210,140,0.28)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

function cloudTexture() {
  return canvasTex(512, 512, (ctx) => {
    ctx.clearRect(0, 0, 512, 512);
    for (let i = 0; i < 28; i++) {
      const x = 40 + Math.random() * 432, y = 40 + Math.random() * 432;
      const r = 30 + Math.random() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,252,248,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function jadeTexture() {
  return canvasTex(1024, 1024, (ctx, S) => {
    const g = ctx.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S * 0.5);
    g.addColorStop(0, '#f7f1e4');
    g.addColorStop(0.55, '#e6d8c0');
    g.addColorStop(1, '#c9b48e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 16) {
      const n = (Math.random() - 0.5) * 10;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(176,132,62,.55)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, 470, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, 448, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(176,132,62,.28)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(S / 2 + Math.cos(a) * 390, S / 2 + Math.sin(a) * 390, 54, 22, a, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

function lanternTexture() {
  return canvasTex(64, 96, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#ffb45a');
    g.addColorStop(0.5, '#ff4a3a');
    g.addColorStop(1, '#9a1c24');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 96);
    ctx.strokeStyle = 'rgba(255,220,140,.8)';
    ctx.lineWidth = 3;
    for (let y = 16; y < 90; y += 16) {
      ctx.beginPath(); ctx.moveTo(6, y); ctx.lineTo(58, y); ctx.stroke();
    }
  });
}

export function createHeavenCourt(scene) {
  const gold = new THREE.MeshStandardMaterial({ color: 0xf0d39a, metalness: 0.78, roughness: 0.28 });
  const glaze = new THREE.MeshStandardMaterial({ color: 0x1c6d78, metalness: 0.42, roughness: 0.38 });
  const glazeDark = new THREE.MeshStandardMaterial({ color: 0x134e58, metalness: 0.35, roughness: 0.45 });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x7c2430, metalness: 0.22, roughness: 0.48 });
  const marble = new THREE.MeshStandardMaterial({ color: 0xefe4d2, roughness: 0.62, metalness: 0.06 });

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(96, 32, 20),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false })
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const starN = 420;
  const starPos = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(0.15 + Math.random() * 0.85);
    const r = 78;
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.cos(ph);
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xfff4d2, size: 0.55, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  scene.add(stars);

  const moon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonTexture(), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  }));
  moon.position.set(16, 28, -36);
  moon.scale.set(14, 14, 1);
  scene.add(moon);
  const moonLight = new THREE.DirectionalLight(0xd0dcff, 0.4);
  moonLight.position.set(16, 28, -36);
  scene.add(moonLight);

  const terraceGeo = new THREE.CylinderGeometry(10.5, 10.05, 0.55, 64);
  const terrace = new THREE.Mesh(terraceGeo, [
    marble,
    new THREE.MeshStandardMaterial({ map: jadeTexture(), roughness: 0.7, metalness: 0.08 }),
    marble,
  ]);
  terrace.position.y = -0.32;
  terrace.receiveShadow = true;
  scene.add(terrace);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.07, 8, 72), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.02;
  scene.add(rim);

  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0.92, side: THREE.DoubleSide,
  });
  const cloudSea = new THREE.Mesh(new THREE.CircleGeometry(52, 48), cloudMat);
  cloudSea.rotation.x = -Math.PI / 2;
  cloudSea.position.y = -1.45;
  scene.add(cloudSea);

  const puffGeo = new THREE.SphereGeometry(1, 8, 6);
  const puffMat = new THREE.MeshStandardMaterial({ color: 0xfff8f0, roughness: 1, transparent: true, opacity: 0.82, depthWrite: false });
  const puffN = 18;
  const puffs = new THREE.InstancedMesh(puffGeo, puffMat, puffN);
  const dummy = new THREE.Object3D();
  const puffBase = [];
  for (let i = 0; i < puffN; i++) {
    const a = (i / puffN) * Math.PI * 2 + (i % 3) * 0.2;
    const rad = 22 + (i % 5) * 3.1;
    const y = -0.15 + (i % 4) * 0.28;
    puffBase.push({ a, rad, y, sx: 4.2 + (i % 4) * 0.8, sy: 1.05 + (i % 3) * 0.28, sz: 3.2 + (i % 5) * 0.55 });
    dummy.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
    dummy.scale.set(puffBase[i].sx, puffBase[i].sy, puffBase[i].sz);
    dummy.updateMatrix();
    puffs.setMatrixAt(i, dummy.matrix);
  }
  scene.add(puffs);

  const court = new THREE.Group();
  const hornGeo = new THREE.ConeGeometry(0.16, 1.15, 5);
  hornGeo.rotateX(-Math.PI / 2);
  const stone = new THREE.MeshStandardMaterial({ color: 0xe7dcc8, roughness: 0.78, metalness: 0.04 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0xcbbfa8, roughness: 0.82, metalness: 0.05 });
  const voidMat = new THREE.MeshStandardMaterial({ color: 0x2a1c22, roughness: 1 });
  const SEGS = 40;
  const GAP = 0.62;
  function inGap(a) {
    const d = a > Math.PI ? a - Math.PI * 2 : a;
    return Math.abs(d) < GAP;
  }
  function ringMesh(geo, mat, segs, place) {
    const mesh = new THREE.InstancedMesh(geo, mat, segs);
    let n = 0;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      if (inGap(a)) continue;
      place(dummy, a);
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  // 阶梯看台，朝向场心逐层升高
  const tiers = [
    { r: 11.7, y: 0.05, h: 0.72, depth: 1.45 },
    { r: 13.35, y: 0.78, h: 0.76, depth: 1.5 },
    { r: 15.05, y: 1.56, h: 0.8, depth: 1.55 },
    { r: 16.8, y: 2.4, h: 0.86, depth: 1.6 },
  ];
  tiers.forEach((tier, ti) => {
    const w = (2 * Math.PI * tier.r / SEGS) * 0.94;
    const geo = new THREE.BoxGeometry(w, tier.h, tier.depth);
    court.add(ringMesh(geo, ti % 2 ? stoneDark : stone, SEGS, (o, a) => {
      o.position.set(Math.sin(a) * tier.r, tier.y + tier.h / 2, Math.cos(a) * tier.r);
      o.rotation.set(0, a, 0);
      o.scale.set(1, 1, 1);
    }));
    const nose = new THREE.BoxGeometry(w * 0.98, 0.06, 0.08);
    court.add(ringMesh(nose, gold, SEGS, (o, a) => {
      o.position.set(Math.sin(a) * (tier.r - tier.depth * 0.48), tier.y + tier.h, Math.cos(a) * (tier.r - tier.depth * 0.48));
      o.rotation.set(0, a, 0);
      o.scale.set(1, 1, 1);
    }));
  });

  // 外圈拱廊：石柱、券洞、琉璃檐
  const BAYS = 24;
  const pierH = 4.6;
  const pierR = 18.7;
  const pierW = 0.62;
  court.add(ringMesh(new THREE.BoxGeometry(pierW, pierH, 0.78), marble, BAYS, (o, a) => {
    o.position.set(Math.sin(a) * pierR, pierH / 2, Math.cos(a) * pierR);
    o.rotation.set(0, a, 0);
    o.scale.set(1, 1, 1);
  }));
  const bayW = (2 * Math.PI * pierR / BAYS);
  court.add(ringMesh(new THREE.BoxGeometry(bayW * 0.72, bayW * 0.55, 0.35), voidMat, BAYS, (o, a) => {
    const mid = a + Math.PI / BAYS;
    if (inGap(mid)) { o.scale.set(0, 0, 0); o.position.set(0, -20, 0); return; }
    o.scale.set(1, 1, 1);
    o.position.set(Math.sin(mid) * (pierR + 0.15), 1.7, Math.cos(mid) * (pierR + 0.15));
    o.rotation.set(0, mid, 0);
  }));
  const archGeo = new THREE.TorusGeometry(bayW * 0.3, 0.09, 6, 10, Math.PI);
  court.add(ringMesh(archGeo, gold, BAYS, (o, a) => {
    const mid = a + Math.PI / BAYS;
    if (inGap(mid)) { o.scale.set(0, 0, 0); o.position.set(0, -20, 0); return; }
    o.scale.set(1, 1, 1);
    o.position.set(Math.sin(mid) * pierR, 1.7 + bayW * 0.28, Math.cos(mid) * pierR);
    o.rotation.set(0, mid + Math.PI / 2, 0);
  }));
  court.add(ringMesh(new THREE.BoxGeometry(bayW * 0.98, 0.28, 0.9), stone, BAYS, (o, a) => {
    const mid = a + Math.PI / BAYS;
    if (inGap(mid)) { o.scale.set(0, 0, 0); o.position.set(0, -20, 0); return; }
    o.scale.set(1, 1, 1);
    o.position.set(Math.sin(mid) * pierR, pierH + 0.1, Math.cos(mid) * pierR);
    o.rotation.set(0, mid, 0);
  }));
  const eave = new THREE.Mesh(
    new THREE.RingGeometry(18.15, 20.3, BAYS, 1, -Math.PI / 2 + GAP, Math.PI * 2 - GAP * 2),
    glaze
  );
  eave.rotation.x = -Math.PI / 2;
  eave.position.y = pierH + 0.42;
  court.add(eave);
  const eave2 = new THREE.Mesh(
    new THREE.RingGeometry(17.7, 19.3, BAYS, 1, -Math.PI / 2 + GAP, Math.PI * 2 - GAP * 2),
    glazeDark
  );
  eave2.rotation.x = -Math.PI / 2;
  eave2.position.y = pierH + 0.72;
  court.add(eave2);

  const lanternMap = lanternTexture();
  const lanternMat = new THREE.MeshStandardMaterial({
    map: lanternMap, emissive: 0xff5530, emissiveMap: lanternMap, emissiveIntensity: 1.4, roughness: 0.45,
  });
  const lanternGeo = new THREE.SphereGeometry(0.2, 8, 6);
  let lanterns = 0;
  for (let i = 0; i < BAYS; i += 4) {
    const a = (i / BAYS) * Math.PI * 2;
    if (inGap(a)) continue;
    const hang = new THREE.Mesh(lanternGeo, lanternMat);
    hang.scale.set(1, 1.3, 1);
    hang.position.set(Math.sin(a) * 12.4, 2.15, Math.cos(a) * 12.4);
    court.add(hang);
    if (lanterns < 4) {
      const light = new THREE.PointLight(0xff7a48, 5, 8, 2);
      light.position.copy(hang.position);
      scene.add(light);
      lanterns++;
    }
  }

  function hall(x, z, w, h, d, rotY) {
    const g = new THREE.Group();
    g.position.set(x, -0.55, z);
    g.rotation.y = rotY;
    const podium = new THREE.Mesh(new THREE.BoxGeometry(w * 1.15, 0.45, d * 1.2), marble);
    podium.position.y = 0.22;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lacquer);
    body.position.y = 0.45 + h / 2;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.38, 0.22, d * 1.5), glaze);
    roof.position.y = 0.45 + h + 0.16;
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, h * 0.42, d * 0.55), lacquer);
    ridge.position.y = roof.position.y + h * 0.22;
    const roof2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.16, d * 0.85), glazeDark);
    roof2.position.y = ridge.position.y + h * 0.22;
    const goldRidge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, d * 0.9), gold);
    goldRidge.position.y = roof2.position.y + 0.12;
    g.add(podium, body, roof, ridge, roof2, goldRidge);
    for (const cx of [-0.34, -0.12, 0.12, 0.34]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, h * 0.92, 6), lacquer);
      col.position.set(w * cx, 0.45 + h * 0.46, d * 0.38);
      g.add(col);
    }
    const hw = w * 0.72, hd = d * 0.78, hy = roof.position.y + 0.15;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tip = new THREE.Mesh(hornGeo, gold);
      tip.position.set(sx * hw, hy, sz * hd);
      tip.lookAt(sx * hw * 1.8, hy + 1.4, sz * hd * 1.6);
      g.add(tip);
    }
    return g;
  }
  court.add(hall(0, -26, 11, 6.2, 7.2, 0));
  court.add(hall(-20, -24, 7, 4.6, 5, 0.35));
  court.add(hall(21, -25, 7.5, 5, 5.2, -0.3));
  court.add(hall(-28, -16, 5, 3.4, 4, 0.7));
  court.add(hall(29, -17, 5.2, 3.6, 4, -0.6));
  scene.add(court);

  let t = 0;
  return {
    update(dt) {
      t += dt;
      cloudSea.rotation.y += dt * 0.012;
      lanternMat.emissiveIntensity = 1.25 + Math.sin(t * 2.2) * 0.35;
      for (let i = 0; i < puffN; i++) {
        const b = puffBase[i];
        const a = b.a + t * 0.02;
        dummy.position.set(Math.cos(a) * b.rad, b.y + Math.sin(t * 0.4 + i) * 0.12, Math.sin(a) * b.rad);
        dummy.scale.set(b.sx, b.sy, b.sz);
        dummy.rotation.y = a;
        dummy.updateMatrix();
        puffs.setMatrixAt(i, dummy.matrix);
      }
      puffs.instanceMatrix.needsUpdate = true;
    },
  };
}
