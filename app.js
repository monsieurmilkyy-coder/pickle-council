/* ══════════════════════════════════════════════════════════════
   대항해시대 백작의 회의실 · 합동 비서실 (Pickle Council)
   3D: three.js · 실시간: Firebase Realtime Database
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getDatabase, ref, set, update, remove, push, onValue, onChildAdded,
  onDisconnect, query, limitToLast
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

/* ── 0. 설정 ─────────────────────────────────────────────── */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAtpYHg_xjz4t39ZGmKE3k-UzWczgT1iIY",
  authDomain: "pickle-council.firebaseapp.com",
  databaseURL: "https://pickle-council-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pickle-council",
  appId: "1:852655816212:web:a2c4b9ab9fe31a07fdf101"
};
const ROOM = 'main';
const JAMO_POOL = ['ㅂ', 'ㅍ', 'ㅋ', 'ㅎ', 'ㅁ', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅅ', 'ㅇ', 'ㅈ'];
const COLORS = [
  { key: 'blue',   name: '항해청', hex: 0x5aa9e6 },
  { key: 'gold',   name: '황동',   hex: 0xf0b64a },
  { key: 'coral',  name: '산호',   hex: 0xf07a63 },
  { key: 'mint',   name: '민트',   hex: 0x62cba2 },
  { key: 'violet', name: '자주',   hex: 0xa98bde },
  { key: 'pink',   name: '분홍',   hex: 0xf58fb6 },
  { key: 'teal',   name: '심해',   hex: 0x3fb3b2 },
  { key: 'cream',  name: '밀랍',   hex: 0xe8d9b0 }
];
const SEATS = 8;
const TABLE_R = 1.85;
const TABLE_Y = 0.98;
const CHAIR_R = 2.92;
const CHAR_R = 2.52;

const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const colorOf = (key) => (COLORS.find(c => c.key === key) || COLORS[0]);

/* ── 1. 3D 기본 ──────────────────────────────────────────── */
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d12);
scene.fog = new THREE.FogExp2(0x0a0d12, 0.026);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(0, 4.25, 7.35);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.28, 0.05);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.rotateSpeed = 0.75;
controls.zoomSpeed = 0.85;
controls.panSpeed = 0.6;
controls.minDistance = 2.0;
controls.maxDistance = 15;
controls.minPolarAngle = 0.22;
controls.maxPolarAngle = Math.PI * 0.492;
controls.enablePan = false;

let camGoal = null;
controls.addEventListener('start', () => { camGoal = null; });

/* ── 2. 텍스처 헬퍼 ──────────────────────────────────────── */
function canvasOf(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function texOf(w, h, draw, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(canvasOf(w, h, draw));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (rx !== 1 || ry !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
  return t;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* 바닥 마루 */
const floorTex = texOf(1024, 1024, (c, w, h) => {
  c.fillStyle = '#3d2615'; c.fillRect(0, 0, w, h);
  const plankH = h / 10;
  for (let i = 0; i < 10; i++) {
    const y = i * plankH;
    const base = 34 + Math.random() * 22;
    c.fillStyle = `rgb(${base + 26},${base + 2},${Math.max(12, base - 14)})`;
    c.fillRect(0, y, w, plankH - 3);
    // grain
    for (let g = 0; g < 60; g++) {
      c.strokeStyle = `rgba(${20 + Math.random() * 40},${12 + Math.random() * 20},6,${0.08 + Math.random() * 0.12})`;
      c.lineWidth = 0.6 + Math.random();
      const gy = y + Math.random() * plankH;
      c.beginPath(); c.moveTo(0, gy);
      for (let x = 0; x <= w; x += 64) c.lineTo(x, gy + Math.sin(x * 0.01 + i) * 2.4 + rand(-1.5, 1.5));
      c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, y + plankH - 3, w, 3);
    // plank seams
    const seam = Math.random() * w;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(seam, y, 3, plankH);
  }
}, 5, 4);

/* 벽 회벽 + 목재 패널 */
const wallTex = texOf(512, 512, (c, w, h) => {
  c.fillStyle = '#4a3322'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(${180 + Math.random() * 50},${140 + Math.random() * 40},${100 + Math.random() * 30},${Math.random() * 0.05})`;
    c.fillRect(Math.random() * w, Math.random() * h, rand(1, 5), rand(1, 5));
  }
  const grad = c.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,.35)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,.45)');
  c.fillStyle = grad; c.fillRect(0, 0, w, h);
}, 4, 2);

/* 양피지 해도 */
const mapTex = texOf(1200, 840, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#f2e3bd'); g.addColorStop(0.45, '#e6d1a4'); g.addColorStop(1, '#d3b884');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) {
    c.beginPath(); c.arc(rand(0, w), rand(0, h), rand(8, 80), 0, 7);
    c.fillStyle = `rgba(150,110,55,${rand(0.008, 0.05)})`; c.fill();
  }
  // 테두리
  c.strokeStyle = 'rgba(120,84,38,.6)'; c.lineWidth = 4; c.strokeRect(16, 16, w - 32, h - 32);
  c.strokeStyle = 'rgba(120,84,38,.38)'; c.lineWidth = 1.5; c.strokeRect(26, 26, w - 52, h - 52);

  // 위선 · 경선
  c.strokeStyle = 'rgba(120,92,48,.22)'; c.lineWidth = 1;
  for (let x = 60; x < w - 40; x += 62) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x, h - 30); c.stroke(); }
  for (let y = 60; y < h - 40; y += 62) { c.beginPath(); c.moveTo(34, y); c.lineTo(w - 34, y); c.stroke(); }

  // 룸바선 (나침반 중심에서 방사)
  const cx = w * 0.235, cy = h * 0.66;
  c.strokeStyle = 'rgba(130,100,55,.3)';
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    c.beginPath(); c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(ang) * 900, cy + Math.sin(ang) * 900); c.stroke();
  }

  // 대륙
  const land = [
    [[0.10,0.20],[0.19,0.13],[0.29,0.17],[0.33,0.28],[0.30,0.39],[0.34,0.49],[0.28,0.58],[0.30,0.70],[0.22,0.79],[0.13,0.73],[0.10,0.61],[0.06,0.50],[0.09,0.39],[0.06,0.30]],
    [[0.46,0.18],[0.55,0.14],[0.62,0.20],[0.61,0.30],[0.66,0.38],[0.63,0.47],[0.68,0.57],[0.62,0.66],[0.53,0.62],[0.50,0.52],[0.44,0.46],[0.45,0.35],[0.42,0.26]],
    [[0.74,0.22],[0.85,0.18],[0.93,0.26],[0.90,0.40],[0.94,0.50],[0.88,0.62],[0.80,0.58],[0.78,0.46],[0.72,0.36]],
    [[0.30,0.86],[0.44,0.82],[0.58,0.86],[0.70,0.83],[0.78,0.89],[0.62,0.93],[0.42,0.93],[0.30,0.90]]
  ];
  land.forEach((poly, idx) => {
    c.beginPath();
    poly.forEach(([x, y], i) => {
      const px = x * w, py = y * h;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    });
    c.closePath();
    c.fillStyle = idx === 3 ? 'rgba(186,158,104,.55)' : 'rgba(196,170,116,.62)';
    c.fill();
    c.strokeStyle = 'rgba(96,66,28,.75)'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = 'rgba(96,66,28,.22)'; c.lineWidth = 10; c.stroke();
  });
  // 해칭
  c.strokeStyle = 'rgba(110,80,36,.3)'; c.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const x = rand(w * 0.05, w * 0.95), y = rand(h * 0.08, h * 0.92);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + rand(6, 16), y + rand(6, 16)); c.stroke();
  }
  // 항로 점선
  c.setLineDash([7, 9]); c.strokeStyle = 'rgba(140,60,40,.55)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(w * 0.30, h * 0.56); c.bezierCurveTo(w * 0.42, h * 0.42, w * 0.52, h * 0.62, w * 0.70, h * 0.44); c.stroke();
  c.setLineDash([]);

  // 나침반 장미
  c.save(); c.translate(cx, cy);
  c.fillStyle = 'rgba(120,84,38,.30)'; c.beginPath(); c.arc(0, 0, 62, 0, 7); c.fill();
  c.strokeStyle = 'rgba(105,70,26,.85)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 62, 0, 7); c.stroke();
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2 - Math.PI / 2;
    const len = a % 2 === 0 ? 56 : 34;
    c.beginPath(); c.moveTo(0, 0);
    c.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
    c.lineTo(Math.cos(ang + 0.22) * 10, Math.sin(ang + 0.22) * 10);
    c.closePath();
    c.fillStyle = a === 0 ? 'rgba(150,52,40,.85)' : 'rgba(110,76,30,.72)';
    c.fill();
  }
  c.restore();

  // 라벨
  c.fillStyle = 'rgba(78,52,20,.72)';
  c.textAlign = 'center';
  c.font = 'italic 700 34px "Cinzel", Georgia, serif';
  c.fillText('MARE  INCOGNITUM', w * 0.52, h * 0.72);
  c.font = 'italic 600 22px "Cinzel", Georgia, serif';
  c.fillText('TERRA  AUSTRALIS', w * 0.5, h * 0.925);
  c.fillText('NOVA  HISPANIA', w * 0.20, h * 0.085);
  c.fillText('OST  INDIES', w * 0.80, h * 0.12);
  c.save();
  c.translate(w * 0.09, h * 0.62); c.rotate(-Math.PI / 2);
  c.font = 'italic 600 18px "Cinzel", serif'; c.fillText('OCEANUS  ORIENTALIS', 0, 0);
  c.restore();

  // 카르투슈
  c.strokeStyle = 'rgba(95,62,22,.85)'; c.lineWidth = 3;
  roundRect(c, w * 0.575, h * 0.795, w * 0.30, h * 0.135, 12); c.stroke();
  c.fillStyle = 'rgba(232,214,172,.75)'; c.fill();
  c.fillStyle = 'rgba(70,46,16,.88)';
  c.font = 'italic 700 26px "Cinzel", serif';
  c.fillText('CARTA  DEL  CONSEJO', w * 0.725, h * 0.845);
  c.font = 'italic 500 17px "Cinzel", serif';
  c.fillText('Anno Domini  MDCLXXXVII', w * 0.725, h * 0.895);

  // 접힌 자국
  c.strokeStyle = 'rgba(120,90,45,.16)'; c.lineWidth = 2;
  [0.33, 0.66].forEach(f => { c.beginPath(); c.moveTo(w * f, 0); c.lineTo(w * f, h); c.stroke(); });
  c.beginPath(); c.moveTo(0, h * 0.5); c.lineTo(w, h * 0.5); c.stroke();
});

/* 창밖 밤바다 */
const skyTex = texOf(640, 800, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#081128'); g.addColorStop(0.42, '#173a63');
  g.addColorStop(0.62, '#2b5c7d'); g.addColorStop(0.72, '#356f8c'); g.addColorStop(1, '#122436');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // 별
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * w, y = Math.random() * h * 0.6;
    c.fillStyle = `rgba(255,248,220,${rand(0.15, 0.9)})`;
    c.fillRect(x, y, rand(1, 2.2), rand(1, 2.2));
  }
  // 달
  const mx = w * 0.68, my = h * 0.24;
  const glow = c.createRadialGradient(mx, my, 0, mx, my, 200);
  glow.addColorStop(0, 'rgba(255,252,235,.95)'); glow.addColorStop(0.22, 'rgba(240,244,235,.45)');
  glow.addColorStop(1, 'rgba(180,200,255,0)');
  c.fillStyle = glow; c.beginPath(); c.arc(mx, my, 200, 0, 7); c.fill();
  c.fillStyle = '#fffdf0'; c.beginPath(); c.arc(mx, my, 54, 0, 7); c.fill();
  c.fillStyle = 'rgba(210,205,180,.5)';
  c.beginPath(); c.arc(mx - 12, my - 8, 8, 0, 7); c.fill();
  c.beginPath(); c.arc(mx + 14, my + 10, 6, 0, 7); c.fill();
  // 바다
  c.fillStyle = '#0b1b2a'; c.fillRect(0, h * 0.66, w, h * 0.34);
  for (let i = 0; i < 200; i++) {
    const y = h * 0.67 + Math.random() * h * 0.32;
    c.strokeStyle = `rgba(150,190,230,${rand(0.04, 0.22)})`;
    c.lineWidth = rand(0.6, 2);
    const x = Math.random() * w, len = rand(10, 60);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y + rand(-2, 2)); c.stroke();
  }
  // 달빛 반사
  const refl = c.createLinearGradient(mx, h * 0.66, mx, h);
  refl.addColorStop(0, 'rgba(255,248,220,.5)'); refl.addColorStop(1, 'rgba(255,248,220,0)');
  c.fillStyle = refl; c.beginPath();
  c.moveTo(mx - 26, h * 0.66); c.lineTo(mx + 26, h * 0.66); c.lineTo(mx + 62, h); c.lineTo(mx - 62, h);
  c.closePath(); c.fill();
  // 배 실루엣
  c.fillStyle = '#050a12';
  const bx = w * 0.24, by = h * 0.70;
  c.beginPath();
  c.moveTo(bx - 46, by); c.quadraticCurveTo(bx, by + 24, bx + 46, by);
  c.lineTo(bx + 38, by + 12); c.quadraticCurveTo(bx, by + 30, bx - 38, by + 12);
  c.closePath(); c.fill();
  c.fillRect(bx - 2, by - 74, 4, 74);
  c.beginPath(); c.moveTo(bx + 2, by - 72); c.quadraticCurveTo(bx + 46, by - 46, bx + 2, by - 18); c.fill();
  c.beginPath(); c.moveTo(bx - 3, by - 64); c.quadraticCurveTo(bx - 38, by - 40, bx - 3, by - 16); c.fill();
});

/* 러그 */
const rugTex = texOf(768, 768, (c, w, h) => {
  const cx = w / 2, cy = h / 2;
  c.fillStyle = '#1d2c3d'; c.beginPath(); c.arc(cx, cy, w * 0.49, 0, 7); c.fill();
  c.strokeStyle = '#8f6b2c'; c.lineWidth = 16; c.beginPath(); c.arc(cx, cy, w * 0.455, 0, 7); c.stroke();
  c.strokeStyle = '#c9a24a'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, w * 0.415, 0, 7); c.stroke();
  c.fillStyle = '#2a3f55'; c.beginPath(); c.arc(cx, cy, w * 0.39, 0, 7); c.fill();
  // 별 문양
  c.save(); c.translate(cx, cy);
  for (let a = 0; a < 8; a++) {
    c.rotate(Math.PI / 4);
    c.fillStyle = a % 2 ? 'rgba(201,162,74,.55)' : 'rgba(201,162,74,.30)';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(w * 0.045, -w * 0.16); c.lineTo(0, -w * 0.20); c.lineTo(-w * 0.045, -w * 0.16);
    c.closePath(); c.fill();
  }
  c.restore();
  c.strokeStyle = 'rgba(201,162,74,.35)'; c.lineWidth = 3;
  c.beginPath(); c.arc(cx, cy, w * 0.24, 0, 7); c.stroke();
  // 테두리 무늬
  for (let a = 0; a < 72; a++) {
    const ang = (a / 72) * Math.PI * 2;
    c.fillStyle = a % 2 ? 'rgba(201,162,74,.5)' : 'rgba(140,100,40,.35)';
    c.beginPath();
    c.arc(cx + Math.cos(ang) * w * 0.435, cy + Math.sin(ang) * w * 0.435, 7, 0, 7);
    c.fill();
  }
});

/* 작은 지구본 */
const globeTex = texOf(512, 256, (c, w, h) => {
  c.fillStyle = '#255f8a'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(90,140,110,${rand(0.05, 0.16)})`;
    c.beginPath(); c.arc(rand(0, w), rand(0, h), rand(20, 70), 0, 7); c.fill();
  }
  const blobs = [[0.12, 0.3, 0.09], [0.2, 0.55, 0.07], [0.34, 0.32, 0.1], [0.48, 0.4, 0.12], [0.56, 0.62, 0.07], [0.7, 0.35, 0.11], [0.82, 0.55, 0.09], [0.9, 0.3, 0.06]];
  blobs.forEach(([x, y, r]) => {
    c.fillStyle = 'rgba(168,182,116,.85)';
    c.beginPath(); c.ellipse(x * w, y * h, r * w, r * h * 1.4, rand(-0.4, 0.4), 0, 7); c.fill();
  });
  c.strokeStyle = 'rgba(240,232,200,.28)'; c.lineWidth = 1.5;
  for (let i = 0; i <= 12; i++) { c.beginPath(); c.moveTo(i * w / 12, 0); c.lineTo(i * w / 12, h); c.stroke(); }
  for (let i = 0; i <= 6; i++) { c.beginPath(); c.moveTo(0, i * h / 6); c.lineTo(w, i * h / 6); c.stroke(); }
});

/* ── 3. 재질 ─────────────────────────────────────────────── */
const M = {
  floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.62, metalness: 0.05 }),
  wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.92, metalness: 0.02, color: 0xb59a7c }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.55, metalness: 0.08 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4526, roughness: 0.5, metalness: 0.06 }),
  lightWood: new THREE.MeshStandardMaterial({ color: 0x8a5c33, roughness: 0.55, metalness: 0.05 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.26, metalness: 0.95 }),
  brassDark: new THREE.MeshStandardMaterial({ color: 0x8d6c2a, roughness: 0.4, metalness: 0.9 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.55, metalness: 0.85 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x4a453f, roughness: 0.95, metalness: 0.03 }),
  candle: new THREE.MeshStandardMaterial({ color: 0xf0e4c4, roughness: 0.72, metalness: 0.02 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffbe5c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x9fd2e8, roughness: 0.08, metalness: 0, transmission: 0.85, thickness: 0.4, transparent: true, opacity: 0.55 }),
  wax: new THREE.MeshStandardMaterial({ color: 0xa8352c, roughness: 0.42, metalness: 0.05 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xe8dcbe, roughness: 0.85, metalness: 0 }),
  ink: new THREE.MeshStandardMaterial({ color: 0x161a1f, roughness: 0.3, metalness: 0.1 }),
  rope: new THREE.MeshStandardMaterial({ color: 0xb99b6a, roughness: 0.95 })
};

const g3 = {
  box: (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m; },
  cyl: (rt, rb, h, mat, seg = 20) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; },
  sph: (r, mat, seg = 24) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg * 0.7), mat); m.castShadow = true; m.receiveShadow = true; return m; },
  tor: (r, t, mat, rs = 10, ts = 40) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, rs, ts), mat); m.castShadow = true; return m; },
  cap: (r, len, mat) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 14), mat); m.castShadow = true; return m; }
};

/* ── 4. 방 ───────────────────────────────────────────────── */
const world = new THREE.Group();
scene.add(world);

// 바닥
const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 13, 1, 1), M.floor);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
world.add(floor);

// 러그
const rug = new THREE.Mesh(new THREE.CircleGeometry(3.55, 64), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95 }));
rug.rotation.x = -Math.PI / 2; rug.position.y = 0.012; rug.receiveShadow = true;
world.add(rug);

// 벽
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 6.4), M.wall);
backWall.position.set(0, 3.2, -6.4); backWall.receiveShadow = true; world.add(backWall);

const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.4), M.wall);
leftWall.position.set(-7.85, 3.2, 0); leftWall.rotation.y = Math.PI / 2; leftWall.receiveShadow = true; world.add(leftWall);

const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.4), M.wall);
rightWall.position.set(7.85, 3.2, 0); rightWall.rotation.y = -Math.PI / 2; rightWall.receiveShadow = true; world.add(rightWall);

// 바닥 몰딩 · 벽 기둥
[-7.7, 7.7].forEach(x => {
  const w = g3.box(0.36, 0.36, 13, M.darkWood); w.position.set(x, 0.18, 0); world.add(w);
});
const skirt = g3.box(16, 0.34, 0.3, M.darkWood); skirt.position.set(0, 0.17, -6.25); world.add(skirt);
// 벽 패널 기둥
[-7.6, 2.1, 7.6].forEach(x => {
  const p = g3.box(0.22, 6.2, 0.22, M.darkWood); p.position.set(x, 3.1, -6.3); world.add(p);
});
// 천장 들보
[-3.4, 3.4].forEach(x => {
  const b = g3.box(0.5, 0.5, 13, M.darkWood); b.position.set(x, 6.05, 0); world.add(b);
});
// 천장
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 13), new THREE.MeshStandardMaterial({ color: 0x2b1c11, roughness: 1 }));
ceil.rotation.x = Math.PI / 2; ceil.position.y = 6.3; world.add(ceil);

/* 창문 */
function buildWindow(w, h) {
  const g = new THREE.Group();
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: skyTex }));
  pane.position.z = 0.02; g.add(pane);
  const fm = M.darkWood;
  const top = g3.box(w + 0.44, 0.2, 0.26, fm); top.position.set(0, h / 2 + 0.06, 0.06); g.add(top);
  const bot = g3.box(w + 0.44, 0.24, 0.4, fm); bot.position.set(0, -h / 2 - 0.06, 0.1); g.add(bot);
  const lf = g3.box(0.22, h + 0.32, 0.26, fm); lf.position.set(-w / 2 - 0.1, 0, 0.06); g.add(lf);
  const rt = g3.box(0.22, h + 0.32, 0.26, fm); rt.position.set(w / 2 + 0.1, 0, 0.06); g.add(rt);
  const mullV = g3.box(0.09, h, 0.14, fm); mullV.position.set(0, 0, 0.08); g.add(mullV);
  const mullH = g3.box(w, 0.09, 0.14, fm); mullH.position.set(0, h * 0.3, 0.08); g.add(mullH);
  const mullH2 = g3.box(w, 0.09, 0.14, fm); mullH2.position.set(0, -h * 0.18, 0.08); g.add(mullH2);
  const sill = g3.box(w + 0.56, 0.13, 0.54, M.lightWood); sill.position.set(0, -h / 2 - 0.2, 0.2); g.add(sill);
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0x6d1f1c, roughness: 0.95 });
  [-1, 1].forEach(s => {
    const cur = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.2, h * 1.1, 6, 2), curtainMat);
    cur.position.set(s * (w / 2 + 0.12), 0.02, 0.3);
    const pos = cur.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 10) * 0.085);
    pos.needsUpdate = true; cur.geometry.computeVertexNormals();
    g.add(cur);
  });
  return g;
}
// 뒤벽 큰 창 (밤바다)
const backWindow = buildWindow(3.2, 4.2);
backWindow.position.set(0.15, 3.05, -6.34);
world.add(backWindow);
// 왼쪽 벽 작은 창
const sideWindow = buildWindow(2.4, 3.2);
sideWindow.position.set(-7.78, 3.0, -1.2);
sideWindow.rotation.y = Math.PI / 2;
world.add(sideWindow);

/* 벽난로 (오른쪽 뒤) */
const fireplace = new THREE.Group();
fireplace.position.set(4.5, 0, -6.15);
{
  const stoneMat = M.stone;
  const colL = g3.box(0.5, 2.1, 0.7, stoneMat); colL.position.set(-1.25, 1.05, 0); fireplace.add(colL);
  const colR = g3.box(0.5, 2.1, 0.7, stoneMat); colR.position.set(1.25, 1.05, 0); fireplace.add(colR);
  const mantel = g3.box(3.2, 0.34, 0.95, M.lightWood); mantel.position.set(0, 2.12, 0.05); fireplace.add(mantel);
  const mantelTop = g3.box(3.5, 0.14, 1.1, M.darkWood); mantelTop.position.set(0, 2.34, 0.05); fireplace.add(mantelTop);
  // 아궁이
  const cavity = g3.box(2.2, 2.0, 0.2, new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 1 }));
  cavity.position.set(0, 1.0, 0.32); fireplace.add(cavity);
  // 벽돌 아치
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.12 + 0.76 * (i / 5));
    const b = g3.box(0.28, 0.34, 0.3, new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.95 }));
    b.position.set(Math.cos(a) * 1.05, 1.95 + Math.sin(a) * 0.3, 0.35);
    b.rotation.z = a - Math.PI / 2;
    fireplace.add(b);
  }
  // 장작
  [-0.42, 0, 0.42].forEach((x, i) => {
    const log = g3.cyl(0.16, 0.16, 1.5, new THREE.MeshStandardMaterial({ color: 0x2e1c10, roughness: 0.95 }), 10);
    log.rotation.x = Math.PI / 2; log.rotation.z = rand(-0.2, 0.2);
    log.position.set(x * 0.8, 0.2 + i * 0.12, 0.3);
    fireplace.add(log);
  });
  // 불꽃
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(rand(0.16, 0.3), rand(0.5, 1.0), 8), M.flame.clone());
    f.material.color.setHex(i % 2 ? 0xffd27a : 0xff8a3a);
    f.position.set(rand(-0.45, 0.45), rand(0.45, 0.7), 0.32);
    fireplace.add(f); flames.push(f);
  }
  // 불씨
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0x8a2a08, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending }));
  ember.position.set(0, 0.3, 0.4); ember.scale.y = 0.4; fireplace.add(ember);
  // 촛대 2개 + 장식
  [-1.35, 1.35].forEach(x => {
    const c = g3.cyl(0.05, 0.09, 0.3, M.brass); c.position.set(x, 2.56, 0.1); fireplace.add(c);
    const w = g3.cyl(0.06, 0.06, 0.3, M.candle); w.position.set(x, 2.85, 0.1); fireplace.add(w);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), M.flame.clone());
    fl.position.set(x, 3.05, 0.1); fireplace.add(fl);
  });
  // 위 장식: 해골 대신 낡은 시계
  const clock = g3.cyl(0.3, 0.3, 0.12, M.brass); clock.rotation.x = Math.PI / 2; clock.position.set(0, 2.85, 0.12); fireplace.add(clock);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.25, 28), new THREE.MeshStandardMaterial({ color: 0xe8dcbe, roughness: 0.8 }));
  dial.position.set(0, 2.85, 0.19); fireplace.add(dial);
  const hand = g3.box(0.02, 0.18, 0.01, M.ink); hand.position.set(0, 2.9, 0.2); fireplace.add(hand);
  fireplace.userData.flames = flames;
  fireplace.userData.ember = ember;
  fireplace.userData.light = new THREE.PointLight(0xff8a3a, 16, 13, 2);
  fireplace.userData.light.position.set(0, 1.1, 1.1);
  fireplace.userData.light.castShadow = false;
  fireplace.add(fireplace.userData.light);
}
world.add(fireplace);

/* 벽 촛대 */
function buildSconce(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const plate = g3.cyl(0.1, 0.13, 0.05, M.brass, 12); plate.rotation.x = Math.PI / 2; g.add(plate);
  const arm = g3.cyl(0.024, 0.024, 0.22, M.brass, 8); arm.rotation.x = Math.PI / 2; arm.position.set(0, 0, 0.11); g.add(arm);
  const cup = g3.cyl(0.09, 0.05, 0.06, M.brass, 12); cup.position.set(0, 0.04, 0.24); g.add(cup);
  const candle = g3.cyl(0.042, 0.042, 0.24, M.candle, 10); candle.position.set(0, 0.19, 0.24); g.add(candle);
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 8), M.flame.clone());
  fl.position.set(0, 0.38, 0.24); g.add(fl);
  const lt = new THREE.PointLight(0xffb070, 5, 6, 2); lt.position.set(0, 0.4, 0.34); g.add(lt);
  g.userData = { flame: fl, light: lt };
  return g;
}
const wallSconces = [buildSconce(-2.15, 3.35, -6.18), buildSconce(7.0, 3.35, -6.18)];
wallSconces.forEach(s => world.add(s));

/* 책장 */
function buildShelf(x) {
  const g = new THREE.Group(); g.position.set(x, 0, -6.05);
  const case_ = g3.box(2.3, 3.3, 0.6, M.darkWood); case_.position.y = 1.65; g.add(case_);
  const inner = g3.box(2.06, 3.06, 0.5, new THREE.MeshStandardMaterial({ color: 0x2c1c10, roughness: 1 }));
  inner.position.set(0, 1.65, 0.06); g.add(inner);
  const bookColors = [0x8c3a2c, 0x36537a, 0x4f6a3f, 0x8a6626, 0x5f3a5f, 0xa9832f, 0x2f4d4d];
  for (let s = 0; s < 4; s++) {
    const shelfY = 0.55 + s * 0.76;
    const board = g3.box(2.1, 0.06, 0.52, M.lightWood); board.position.set(0, shelfY - 0.06, 0.06); g.add(board);
    let bx = -0.96;
    while (bx < 0.9) {
      const bw = rand(0.06, 0.13), bh = rand(0.32, 0.56);
      if (Math.random() < 0.12) { bx += rand(0.1, 0.2); continue; }
      const book = g3.box(bw, bh, rand(0.3, 0.42), new THREE.MeshStandardMaterial({ color: bookColors[(Math.random() * bookColors.length) | 0], roughness: 0.85 }));
      book.position.set(bx + bw / 2, shelfY + bh / 2, 0.1);
      book.rotation.z = Math.random() < 0.1 ? rand(-0.12, 0.12) : 0;
      g.add(book);
      bx += bw + 0.008;
    }
  }
  return g;
}
world.add(buildShelf(-6.0));
world.add(buildShelf(-3.6));

/* 샹들리에 */
const chandelier = new THREE.Group();
chandelier.position.set(0, 4.35, 0);
{
  const chain = g3.cyl(0.03, 0.03, 1.6, M.brassDark, 8); chain.position.y = 0.8; chandelier.add(chain);
  const ring = g3.tor(0.72, 0.055, M.brass, 12, 48); ring.rotation.x = Math.PI / 2; chandelier.add(ring);
  const hub = g3.sph(0.14, M.brass); chandelier.add(hub);
  const spikes = new THREE.Group(); chandelier.add(spikes);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * 0.72, z = Math.sin(a) * 0.72;
    const arm = g3.cyl(0.025, 0.025, 0.72, M.brass, 6);
    arm.position.set(x / 2, -0.02, z / 2);
    arm.rotation.z = Math.PI / 2; arm.rotation.y = -a;
    chandelier.add(arm);
    const cup = g3.cyl(0.09, 0.06, 0.09, M.brass, 10); cup.position.set(x, 0.05, z); chandelier.add(cup);
    const candle = g3.cyl(0.045, 0.045, 0.28, M.candle, 10); candle.position.set(x, 0.23, z); chandelier.add(candle);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.14, 8), M.flame.clone());
    fl.position.set(x, 0.44, z); spikes.add(fl);
  }
  chandelier.userData.flames = spikes.children;
  const mainLight = new THREE.PointLight(0xffbe7a, 26, 15, 2);
  mainLight.position.set(0, -0.15, 0);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(1024, 1024);
  mainLight.shadow.bias = -0.0025;
  mainLight.shadow.camera.near = 0.4;
  mainLight.shadow.camera.far = 16;
  chandelier.add(mainLight);
  chandelier.userData.light = mainLight;
}
world.add(chandelier);

/* 조명 */
const moon = new THREE.DirectionalLight(0x9dc0ff, 1.5);
moon.position.set(0.8, 6.6, -9.0);
moon.target.position.set(0, 1.0, 1.2);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -7; moon.shadow.camera.right = 7;
moon.shadow.camera.top = 6; moon.shadow.camera.bottom = -6;
moon.shadow.camera.near = 0.5; moon.shadow.camera.far = 24;
moon.shadow.bias = -0.0015;
scene.add(moon, moon.target);

const hemi = new THREE.HemisphereLight(0x5d7fa8, 0x3a2818, 0.85);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0x30384a, 0.55));

const fillWarm = new THREE.PointLight(0xffb070, 9, 11, 2);
fillWarm.position.set(-1.6, 3.0, 4.2);
scene.add(fillWarm);
const fillFront = new THREE.PointLight(0xbcd2ff, 6, 12, 2);
fillFront.position.set(1.5, 2.4, 5.4);
scene.add(fillFront);

/* 달빛 창 광선 */
const beamTex = texOf(256, 512, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(180,210,255,.30)'); g.addColorStop(1, 'rgba(180,210,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(220,235,255,${rand(0.02, 0.06)})`;
    c.fillRect(0, Math.random() * h, w, rand(4, 30));
  }
});
const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 6.4), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22, side: THREE.DoubleSide }));
beam.position.set(0.2, 2.7, -3.5);
beam.rotation.x = -0.46;
world.add(beam);

/* 먼지 입자 */
const dustGeo = new THREE.BufferGeometry();
const dustCount = 320;
const dpos = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  dpos[i * 3] = rand(-7, 7);
  dpos[i * 3 + 1] = rand(0.2, 5.6);
  dpos[i * 3 + 2] = rand(-6, 5);
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
const dustTex = texOf(32, 32, (c, w, h) => {
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,240,200,.9)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
});
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.055, map: dustTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
world.add(dust);

/* ── 5. 원탁과 소품 ──────────────────────────────────────── */
const table = new THREE.Group();
{
  const top = g3.cyl(TABLE_R, TABLE_R, 0.14, M.wood, 64);
  top.position.y = TABLE_Y - 0.07; table.add(top);
  const edge = g3.tor(TABLE_R - 0.02, 0.055, M.lightWood, 8, 64);
  edge.rotation.x = Math.PI / 2; edge.position.y = TABLE_Y - 0.07; table.add(edge);
  // 받침
  const apron = g3.cyl(0.55, 0.7, 0.5, M.darkWood, 24); apron.position.y = TABLE_Y - 0.38; table.add(apron);
  const stem = g3.cyl(0.24, 0.3, 0.36, M.darkWood, 16); stem.position.y = TABLE_Y - 0.78; table.add(stem);
  const base = g3.cyl(0.95, 1.05, 0.12, M.darkWood, 32); base.position.y = 0.09; table.add(base);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const foot = g3.box(0.16, 0.12, 0.62, M.darkWood);
    foot.position.set(Math.cos(a) * 0.55, 0.09, Math.sin(a) * 0.55);
    foot.rotation.y = -a;
    table.add(foot);
  }
  // 해도
  const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.58), new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.9, metalness: 0.02 }));
  mapMesh.rotation.x = -Math.PI / 2; mapMesh.rotation.z = -0.06;
  mapMesh.position.set(0, TABLE_Y + 0.006, 0.02);
  mapMesh.receiveShadow = true; table.add(mapMesh);
  // 해도 가장자리 말림
  const mapEdge = g3.box(2.32, 0.012, 0.05, M.paper); mapEdge.position.set(0, TABLE_Y + 0.012, 0.82); mapEdge.rotation.z = -0.06; table.add(mapEdge);

  // 나침반
  const comp = new THREE.Group(); comp.position.set(1.36, TABLE_Y + 0.03, -0.78);
  const cRim = g3.tor(0.16, 0.028, M.brass, 8, 32); cRim.rotation.x = Math.PI / 2; comp.add(cRim);
  const cFace = g3.cyl(0.145, 0.145, 0.03, new THREE.MeshStandardMaterial({ color: 0xf0e6cc, roughness: 0.5 }), 28); cFace.position.y = 0.005; comp.add(cFace);
  const needle = g3.box(0.02, 0.02, 0.24, M.wax); needle.position.y = 0.03; needle.rotation.y = 0.6; comp.add(needle);
  const needle2 = g3.box(0.02, 0.02, 0.24, M.ink); needle2.position.y = 0.03; needle2.rotation.y = 0.6; needle2.position.z = -0.12; comp.add(needle2);
  const knob = g3.sph(0.03, M.brass); knob.position.y = 0.035; comp.add(knob);
  table.add(comp);

  // 지구본
  const globe = new THREE.Group(); globe.position.set(-1.32, TABLE_Y + 0.02, -0.72);
  const gbase = g3.cyl(0.15, 0.19, 0.05, M.brassDark, 20); globe.add(gbase);
  const gstem = g3.cyl(0.02, 0.02, 0.18, M.brass, 8); gstem.position.y = 0.11; globe.add(gstem);
  const armT = g3.tor(0.24, 0.014, M.brass, 6, 32); armT.position.y = 0.34; armT.rotation.y = Math.PI / 2; globe.add(armT);
  const ball = g3.sph(0.21, new THREE.MeshStandardMaterial({ map: globeTex, roughness: 0.55, metalness: 0.05 }));
  ball.position.y = 0.34; ball.rotation.z = 0.35; globe.add(ball);
  table.add(globe);

  // 범선 미니어처 (해도 위)
  const ship = new THREE.Group(); ship.position.set(0.62, TABLE_Y + 0.03, 0.44); ship.rotation.y = -0.5;
  const hull = g3.box(0.34, 0.1, 0.13, M.darkWood); hull.position.y = 0.05; ship.add(hull);
  const hull2 = g3.box(0.28, 0.06, 0.1, M.wood); hull2.position.set(0.01, 0.11, 0); ship.add(hull2);
  const bow = g3.cyl(0.02, 0.05, 0.16, M.darkWood, 8); bow.rotation.z = Math.PI / 2; bow.position.set(0.19, 0.06, 0); ship.add(bow);
  const mast1 = g3.cyl(0.008, 0.008, 0.42, M.lightWood, 6); mast1.position.set(-0.05, 0.29, 0); ship.add(mast1);
  const mast2 = g3.cyl(0.007, 0.007, 0.32, M.lightWood, 6); mast2.position.set(0.11, 0.24, 0); ship.add(mast2);
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.9, side: THREE.DoubleSide });
  [[-0.05, 0.36, 0.15, 0.2], [-0.05, 0.2, 0.18, 0.16], [0.11, 0.28, 0.1, 0.16]].forEach(([x, y, w, h]) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 4, 2), sailMat);
    s.position.set(x + w / 2 - 0.02, y, 0);
    s.rotation.y = Math.PI / 2;
    const p = s.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.cos(p.getX(i) * 6) * 0.03);
    p.needsUpdate = true; s.geometry.computeVertexNormals();
    ship.add(s);
  });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.04), new THREE.MeshStandardMaterial({ color: 0xa8352c, side: THREE.DoubleSide }));
  flag.position.set(-0.05, 0.52, 0.035); ship.add(flag);
  table.add(ship);

  // 깃펜 · 잉크병
  const ink = new THREE.Group(); ink.position.set(-1.25, TABLE_Y + 0.02, 0.72);
  const pot = g3.cyl(0.075, 0.06, 0.11, M.ink, 16); pot.position.y = 0.055; ink.add(pot);
  const potRim = g3.tor(0.07, 0.012, M.brass, 6, 20); potRim.rotation.x = Math.PI / 2; potRim.position.y = 0.115; ink.add(potRim);
  const quill = g3.cyl(0.006, 0.006, 0.42, M.paper, 6);
  quill.position.set(0.03, 0.24, 0); quill.rotation.z = -0.35; ink.add(quill);
  const feather = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xf6efdc, roughness: 0.95 }));
  feather.position.set(0.09, 0.44, 0); feather.rotation.z = -0.35; feather.scale.z = 0.3; ink.add(feather);
  table.add(ink);

  // 밀랍 인장
  const seal = new THREE.Group(); seal.position.set(1.02, TABLE_Y + 0.02, -0.18);
  const sBase = g3.cyl(0.075, 0.08, 0.022, M.wax, 20); seal.add(sBase);
  const sStar = g3.tor(0.035, 0.008, new THREE.MeshStandardMaterial({ color: 0x7c1f19, roughness: 0.5 }), 6, 16); sStar.rotation.x = Math.PI / 2; sStar.position.y = 0.014; seal.add(sStar);
  table.add(seal);

  // 촛대
  function candleStand(x, z, h) {
    const g = new THREE.Group(); g.position.set(x, TABLE_Y, z);
    const base = g3.cyl(0.12, 0.16, 0.03, M.brass, 18); g.add(base);
    const stem = g3.cyl(0.025, 0.035, h, M.brass, 10); stem.position.y = h / 2 + 0.015; g.add(stem);
    const cup = g3.cyl(0.085, 0.05, 0.05, M.brass, 14); cup.position.y = h + 0.03; g.add(cup);
    const candle = g3.cyl(0.042, 0.042, 0.3, M.candle, 12); candle.position.y = h + 0.2; g.add(candle);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 8), M.flame.clone());
    fl.position.y = h + 0.42; g.add(fl);
    const lt = new THREE.PointLight(0xffb060, 2.6, 3.4, 2); lt.position.y = h + 0.42; g.add(lt);
    g.userData.flame = fl; g.userData.light = lt;
    return g;
  }
  const c1 = candleStand(-0.28, 1.12, 0.3); table.add(c1);
  const c2 = candleStand(1.18, 0.56, 0.26); table.add(c2);
  table.userData.candles = [c1, c2];

  // 두루마리
  const scroll = g3.cyl(0.055, 0.055, 0.5, M.paper, 12);
  scroll.rotation.z = Math.PI / 2; scroll.rotation.y = 0.4;
  scroll.position.set(-0.55, TABLE_Y + 0.06, -1.18); table.add(scroll);
  const scroll2 = g3.cyl(0.045, 0.045, 0.42, M.paper, 12);
  scroll2.rotation.z = Math.PI / 2; scroll2.rotation.y = -0.2;
  scroll2.position.set(-0.35, TABLE_Y + 0.14, -1.05); table.add(scroll2);
}
world.add(table);

/* 의자 8개 */
const chairGroups = [];
function buildChair() {
  const g = new THREE.Group();
  const seat = g3.box(0.62, 0.1, 0.58, M.wood); seat.position.y = 0.56; g.add(seat);
  const cushion = g3.box(0.58, 0.07, 0.54, new THREE.MeshStandardMaterial({ color: 0x5a1f1c, roughness: 0.95 }));
  cushion.position.y = 0.63; g.add(cushion);
  const back = g3.box(0.62, 0.8, 0.09, M.lightWood); back.position.set(0, 0.98, -0.25); g.add(back);
  const backTop = g3.box(0.68, 0.1, 0.12, M.brass); backTop.position.set(0, 1.4, -0.25); g.add(backTop);
  [-0.24, 0.24].forEach(x => {
    const post = g3.box(0.07, 0.86, 0.07, M.darkWood); post.position.set(x, 0.98, -0.25); g.add(post);
    const legF = g3.box(0.075, 0.58, 0.075, M.darkWood); legF.position.set(x, 0.29, 0.24); g.add(legF);
    const legB = g3.box(0.075, 1.05, 0.075, M.darkWood); legB.position.set(x, 0.52, -0.25); g.add(legB);
  });
  const cross = g3.box(0.5, 0.05, 0.05, M.darkWood); cross.position.set(0, 0.22, 0.24); g.add(cross);
  return g;
}
for (let i = 0; i < SEATS; i++) {
  const a = chairAngle(i);
  const ch = buildChair();
  ch.position.set(Math.cos(a) * CHAIR_R, 0, Math.sin(a) * CHAIR_R);
  ch.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
  world.add(ch);
  chairGroups.push(ch);
}
function chairAngle(i) { return (i / SEATS) * Math.PI * 2 + Math.PI * 1.5 + Math.PI / 8; }

/* ── 6. 캐릭터 ───────────────────────────────────────────── */
const JAMO_SHAPES = {
  'ㅂ': [[-0.30, -0.40, -0.30, 0.38], [0.30, -0.40, 0.30, 0.38], [-0.40, 0.38, 0.40, 0.38], [-0.40, 0.02, 0.40, 0.02]],
  'ㅍ': [[-0.44, 0.40, 0.44, 0.40], [-0.44, -0.44, 0.44, -0.44], [-0.21, 0.40, -0.21, -0.44], [0.21, 0.40, 0.21, -0.44]],
  'ㅋ': [[-0.42, 0.40, 0.40, 0.40], [-0.36, 0.40, -0.36, -0.42], [-0.24, -0.02, 0.36, -0.02]],
  'ㅎ': [[-0.17, 0.52, 0.17, 0.52], [-0.44, 0.30, 0.44, 0.30]],
  'ㅁ': [[-0.36, 0.40, 0.36, 0.40], [-0.36, -0.42, 0.36, -0.42], [-0.36, 0.40, -0.36, -0.42], [0.36, 0.40, 0.36, -0.42]],
  'ㄱ': [[-0.40, 0.42, 0.38, 0.42], [0.38, 0.42, 0.38, -0.42]],
  'ㄴ': [[-0.36, 0.42, -0.36, -0.42], [-0.36, -0.42, 0.42, -0.42]],
  'ㄷ': [[-0.36, 0.42, 0.42, 0.42], [-0.36, 0.42, -0.36, -0.42], [-0.36, -0.42, 0.42, -0.42]],
  'ㄹ': [[-0.40, 0.42, 0.40, 0.42], [-0.40, 0.42, -0.40, 0.04], [-0.40, 0.04, 0.40, 0.04], [0.40, 0.04, 0.40, -0.42], [-0.40, -0.42, 0.40, -0.42]],
  'ㅅ': [[0, 0.44, -0.34, -0.44], [0, 0.44, 0.34, -0.44]],
  'ㅈ': [[-0.42, 0.44, 0.42, 0.44], [0.04, 0.44, -0.34, -0.44], [0.04, 0.44, 0.34, -0.44]],
  'ㅇ': []
};
const CIRCLE_JAMO = { 'ㅇ': { x: 0, y: 0, r: 0.28 }, 'ㅎ': { x: 0, y: -0.16, r: 0.21 } };

function makeJamoMesh(jamo, mat) {
  const g = new THREE.Group();
  const strokes = JAMO_SHAPES[jamo] || JAMO_SHAPES['ㅂ'];
  const strokeR = 0.088;
  strokes.forEach(([x1, y1, x2, y2]) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const cap = g3.cap(strokeR, Math.max(0.02, len), mat);
    cap.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
    cap.rotation.z = Math.atan2(-(x2 - x1), (y2 - y1));
    g.add(cap);
  });
  const circle = CIRCLE_JAMO[jamo];
  if (circle) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(circle.r, strokeR, 10, 40), mat);
    ring.position.set(circle.x, circle.y, 0);
    ring.castShadow = true;
    g.add(ring);
  }
  return g;
}

function makeBubble(text) {
  const fs = 38, pad = 26, maxW = 520;
  const measure = canvasOf(10, 10, () => {}).getContext('2d');
  measure.font = `600 ${fs}px "Noto Serif KR", Georgia, serif`;
  const words = String(text).split('');
  const lines = [];
  let line = '';
  for (const ch of words) {
    if (ch === '\n') { lines.push(line); line = ''; continue; }
    const test = line + ch;
    if (measure.measureText(test).width > maxW && line) { lines.push(line); line = ch; }
    else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > 4) { lines.length = 4; lines[3] = lines[3].slice(0, 18) + '…'; }
  const textW = Math.max(...lines.map(l => measure.measureText(l).width), 60);
  const w = Math.min(maxW + pad * 2, Math.ceil(textW + pad * 2));
  const h = Math.ceil(lines.length * fs * 1.36 + pad * 2 + 26);
  const c = canvasOf(w, h, (ctx) => {
    ctx.clearRect(0, 0, w, h);
    // 꼬리
    ctx.fillStyle = '#f6ecd2';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 16, h - 30); ctx.lineTo(w / 2, h - 4); ctx.lineTo(w / 2 + 16, h - 30);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,86,34,.85)'; ctx.lineWidth = 3; ctx.stroke();
    // 몸통
    roundRect(ctx, 3, 3, w - 6, h - 30, 22);
    ctx.fillStyle = '#f8f0da'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,86,34,.9)'; ctx.lineWidth = 3; ctx.stroke();
    roundRect(ctx, 9, 9, w - 18, h - 42, 16);
    ctx.strokeStyle = 'rgba(160,120,50,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    // 글자
    ctx.fillStyle = '#2b1d08';
    ctx.font = `600 ${fs}px "Noto Serif KR", Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, w / 2, pad + fs * 0.7 + i * fs * 1.36));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(w * 0.0034, h * 0.0034, 1);
  sp.center.set(0.5, 0);
  sp.renderOrder = 10;
  sp.userData.size = { w, h };
  return sp;
}

function buildCharacter(name, jamo, colorKey) {
  const col = colorOf(colorKey);
  const mat = new THREE.MeshPhysicalMaterial({
    color: col.hex, roughness: 0.28, metalness: 0.06,
    clearcoat: 0.9, clearcoatRoughness: 0.25,
    sheen: 0.5, sheenColor: new THREE.Color(0xffffff),
    emissive: new THREE.Color(col.hex).multiplyScalar(0.12)
  });
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(makeJamoMesh(jamo, mat));
  root.add(body);

  // 볼
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xf26a7a, transparent: true, opacity: 0.45 });
  [-1, 1].forEach(s => {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.062, 14), blushMat);
    b.position.set(s * 0.27, -0.1, 0.075);
    b.scale.y = 0.7;
    body.add(b);
  });

  // 눈
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x14100c, roughness: 0.08, metalness: 0.1, clearcoat: 1 });
  const eyes = [];
  [-1, 1].forEach(s => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.082, 18, 14), eyeMat);
    e.position.set(s * 0.155, 0.12, 0.075);
    e.scale.set(1, 1.12, 0.65);
    body.add(e);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(s * 0.155 + 0.022, 0.155, 0.115);
    body.add(shine);
    eyes.push(e);
  });
  // 입
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.011, 6, 14, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2a1a10 }));
  mouth.rotation.z = Math.PI; mouth.position.set(0, -0.02, 0.08);
  body.add(mouth);

  // 작은 깃펜 모자 (왕관 대신)
  const hat = new THREE.Group();
  const brim = g3.cyl(0.14, 0.15, 0.02, M.brassDark, 16); hat.add(brim);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0xf0e0b8, roughness: 0.9 }));
  plume.position.set(0.03, 0.09, 0); plume.rotation.z = -0.4; hat.add(plume);
  hat.position.set(0, 0.6, 0);
  hat.visible = false;
  root.add(hat);

  // 이름표
  const plateCanvas = canvasOf(256, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e8d9b0'); g.addColorStop(1, '#c9a24a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(90,62,20,.7)'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = '#33230a'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 30px "Noto Serif KR", Georgia, serif';
    c.fillText(name.slice(0, 10), w / 2, h / 2 + 2);
  });
  const plateTex = new THREE.CanvasTexture(plateCanvas);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.17), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5, metalness: 0.2, emissive: 0xffffff, emissiveMap: plateTex, emissiveIntensity: 0.55 }));
  plate.name = 'plate';
  root.add(plate);

  root.userData = {
    name, jamo, colorKey, body, eyes, hat, plate, plateTex, mat,
    seat: 0, phase: rand(0, 6.28), talkUntil: 0, bubble: null, bubbleUntil: 0,
    blinkAt: rand(2, 5), y: 0
  };
  root.scale.setScalar(1.14);
  return root;
}

const characters = new Map(); // clientId -> {group, ...}
const charLayer = new THREE.Group();
world.add(charLayer);

function seatAngle(i, total) {
  return chairAngle(i);
}

function placeChar(group, index, total, instant = false) {
  const a = chairAngle(index);
  const tx = Math.cos(a) * CHAR_R, tz = Math.sin(a) * CHAR_R;
  const ry = Math.atan2(-Math.cos(a), -Math.sin(a));
  if (instant) {
    group.position.x = tx; group.position.z = tz;
    group.rotation.y = ry;
    group.userData.y = 1.16;
    group.position.y = 1.16;
  }
  group.userData.target = new THREE.Vector3(tx, 1.16, tz);
  group.userData.targetRy = ry;
  // 이름표: 원탁 안쪽, 카메라(바깥) 쪽을 향해 살짝 세움
  const plate = group.getObjectByName('plate');
  if (plate) {
    const pr = TABLE_R - 0.45;
    plate.position.set(Math.cos(a) * pr - tx, TABLE_Y + 0.014 - 1.16, Math.sin(a) * pr - tz);
    plate.rotation.set(-Math.PI / 2, 0, 0);
  }
}

function syncCharacters(seatMap) {
  const entries = Object.entries(seatMap || {})
    .filter(([, v]) => v && v.name)
    .sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
  const total = Math.max(entries.length, 1);
  const seen = new Set();
  entries.forEach(([id, v], i) => {
    seen.add(id);
    const jamo = JAMO_POOL.includes(v.jamo) ? v.jamo : 'ㅂ';
    let c = characters.get(id);
    if (!c || c.userData.jamo !== jamo || c.userData.colorKey !== v.color || c.userData.name !== v.name) {
      if (c) charLayer.remove(c);
      c = buildCharacter(v.name, jamo, v.color || 'blue');
      c.userData.id = id;
      charLayer.add(c);
      characters.set(id, c);
      placeChar(c, i % SEATS, total, true);
    }
    c.userData.seat = i;
    placeChar(c, i % SEATS, total);
  });
  for (const [id, c] of characters) {
    if (!seen.has(id)) {
      charLayer.remove(c);
      if (c.userData.bubble) c.remove(c.userData.bubble);
      characters.delete(id);
    }
  }
}

function speak(id, text) {
  const c = characters.get(id);
  if (!c) return;
  if (c.userData.bubble) { c.remove(c.userData.bubble); c.userData.bubble.material.map.dispose(); }
  const b = makeBubble(text);
  b.position.set(0, 0.62, 0);
  c.add(b);
  c.userData.bubble = b;
  c.userData.bubbleUntil = performance.now() + 8200;
  c.userData.talkUntil = performance.now() + 4200;
}

function speakBySeat(name, text) {
  for (const [, c] of characters) if (c.userData.name === name) { speak(c.userData.id, text); return; }
}

/* 내 캐릭터 표시 */
let myId = sessionStorage.getItem('pc.cid');
if (!myId) { myId = 'c' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('pc.cid', myId); }

/* ── 7. 카메라 프리셋 ────────────────────────────────────── */
const VIEWS = {
  room: { pos: new THREE.Vector3(0, 4.6, 8.0), target: new THREE.Vector3(0, 1.35, 0) },
  map:  { pos: new THREE.Vector3(0.15, 2.35, 3.05), target: new THREE.Vector3(0, 1.02, -0.08) }
};
function setView(name) {
  document.querySelectorAll('.views button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'me') {
    const me = characters.get(myId);
    if (me) {
      const a = Math.atan2(me.position.z, me.position.x);
      const outward = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const p = me.position.clone().add(outward.multiplyScalar(1.9)).add(new THREE.Vector3(0, 1.45, 0));
      const t = me.position.clone().add(new THREE.Vector3(0, 0.95, 0)).add(outward.clone().multiplyScalar(-2.4));
      camGoal = { pos: p, target: t };
      return;
    }
    camGoal = { pos: VIEWS.map.pos.clone(), target: VIEWS.map.target.clone() };
    return;
  }
  const v = VIEWS[name] || VIEWS.room;
  camGoal = { pos: v.pos.clone(), target: v.target.clone() };
}

/* ── 8. 실시간 데이터 ────────────────────────────────────── */
let db = null;
let roomRef = null;
let seats = {};
let myIdentity = null;
let seatsBound = false;
const chatLog = $('#chatLog');
const agendaList = $('#agendaList');
const presenceEl = $('#presence');
const pageOpenedAt = Date.now();

try {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getDatabase(app);
  roomRef = ref(db, `council/${ROOM}`);
} catch (e) {
  console.error('[firebase]', e);
}

function bindRoom() {
  if (!db || seatsBound) return;
  seatsBound = true;

  onValue(ref(db, `council/${ROOM}/seats`), (snap) => {
    seats = snap.val() || {};
    syncCharacters(seats);
    renderPresence();
    renderAgenda(agendaData);
    refreshOwnerOptions();
  });

  onValue(ref(db, `council/${ROOM}/agenda`), (snap) => {
    agendaData = snap.val() || {};
    renderAgenda(agendaData);
  });

  onChildAdded(query(ref(db, `council/${ROOM}/chat`), limitToLast(60)), (snap) => {
    const v = snap.val();
    if (!v) return;
    appendChat(snap.key, v, v.ts && v.ts < pageOpenedAt - 4000 ? false : true);
  });
}

let agendaData = {};
let myJoinTs = Date.now();
let connectedBound = false;

function registerSeat() {
  if (!db || !myIdentity) return;
  const mySeat = ref(db, `council/${ROOM}/seats/${myId}`);
  onDisconnect(mySeat).remove();
  set(mySeat, { ...myIdentity, ts: myJoinTs });
}

function joinRoom(identity) {
  myIdentity = identity;
  myJoinTs = Date.now();
  localStorage.setItem('pc.identity', JSON.stringify(identity));
  if (!db) { syncCharacters({ [myId]: { ...identity, ts: Date.now() } }); renderMe(); return; }
  bindRoom();
  registerSeat();
  // 네트워크가 끊겼다 돌아오면 자리를 다시 세운다
  if (!connectedBound) {
    connectedBound = true;
    onValue(ref(db, '.info/connected'), (snap) => {
      if (snap.val() === true) registerSeat();
    });
  }
  renderMe();
}

function leaveRoom() {
  if (db) {
    const mySeat = ref(db, `council/${ROOM}/seats/${myId}`);
    onDisconnect(mySeat).cancel();
    remove(mySeat);
  }
  const c = characters.get(myId);
  if (c) { charLayer.remove(c); characters.delete(myId); }
  myIdentity = null;
  localStorage.removeItem('pc.identity');
  renderMe();
  renderPresence();
}

/* ── 9. UI ───────────────────────────────────────────────── */
const esc = (s) => String(s == null ? '' : s);

function renderPresence() {
  const list = Object.entries(seats).filter(([, v]) => v && v.name).sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
  presenceEl.innerHTML = '';
  list.forEach(([id, v]) => {
    const col = colorOf(v.color);
    const el = document.createElement('div');
    el.className = 'chip' + (id === myId ? ' me' : '');
    const j = document.createElement('span');
    j.className = 'j';
    j.textContent = v.jamo || 'ㅂ';
    j.style.background = `#${col.hex.toString(16).padStart(6, '0')}`;
    const n = document.createElement('span');
    n.textContent = v.name;
    el.append(j, n);
    presenceEl.appendChild(el);
  });
}

function refreshOwnerOptions() {
  const sel = $('#agendaOwner');
  const prev = sel.value;
  const names = Object.values(seats).filter(v => v && v.name).map(v => v.name);
  sel.innerHTML = '';
  const all = document.createElement('option');
  all.value = '*'; all.textContent = '담당 · 전체';
  sel.appendChild(all);
  [...new Set(names)].forEach(n => {
    const o = document.createElement('option');
    o.value = n; o.textContent = n;
    sel.appendChild(o);
  });
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}

const STATUS = {
  '대기': { cls: 'waiting', next: '항해중' },
  '항해중': { cls: 'sailing', next: '완료' },
  '완료': { cls: 'done', next: '대기' }
};

function renderAgenda(data) {
  const items = Object.entries(data || {})
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  $('#agendaCount').textContent = items.filter(i => i.status !== '완료').length;
  agendaList.innerHTML = '';
  $('#agendaEmpty').style.display = items.length ? 'none' : 'block';
  items.forEach(it => {
    const st = STATUS[it.status] || STATUS['대기'];
    const card = document.createElement('div');
    card.className = 'card' + (it.status === '완료' ? ' s-done' : '');

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = it.title;
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'meta';
    if (it.owner && it.owner !== '*') {
      const seat = Object.values(seats).find(s => s && s.name === it.owner);
      const owner = document.createElement('span');
      owner.className = 'owner';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = seat ? `#${colorOf(seat.color).hex.toString(16).padStart(6, '0')}` : '#8a6d3d';
      const nm = document.createElement('span');
      nm.textContent = it.owner;
      owner.append(dot, nm);
      meta.appendChild(owner);
    } else {
      const o = document.createElement('span');
      o.className = 'owner';
      o.textContent = '전체';
      meta.appendChild(o);
    }

    const btn = document.createElement('button');
    btn.className = `pill status ${st.cls}`;
    btn.textContent = it.status || '대기';
    btn.title = '눌러서 상태 바꾸기';
    btn.addEventListener('click', () => {
      if (!db) return;
      update(ref(db, `council/${ROOM}/agenda/${it.id}`), { status: st.next });
    });
    meta.appendChild(btn);

    card.appendChild(meta);

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = '안건 지우기';
    del.addEventListener('click', () => {
      if (!db) return;
      remove(ref(db, `council/${ROOM}/agenda/${it.id}`));
    });
    card.appendChild(del);

    agendaList.appendChild(card);
  });
}

function appendChat(key, v, live) {
  const mine = v.name === (myIdentity && myIdentity.name);
  const el = document.createElement('div');
  el.className = 'msg' + (mine ? ' mine' : '');
  const ava = document.createElement('div');
  ava.className = 'ava';
  ava.textContent = v.jamo || 'ㅂ';
  ava.style.background = `#${colorOf(v.color).hex.toString(16).padStart(6, '0')}`;
  const body = document.createElement('div');
  body.className = 'body';
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = v.name;
  const text = document.createElement('div');
  text.className = 'text';
  text.textContent = v.text;
  body.append(who, text);
  el.append(ava, body);
  chatLog.appendChild(el);
  while (chatLog.children.length > 80) chatLog.removeChild(chatLog.firstChild);
  chatLog.scrollTop = chatLog.scrollHeight;

  if (live && v.name) {
    const target = Object.entries(seats).find(([, s]) => s && s.name === v.name);
    if (target) speak(target[0], v.text);
  }
}

function renderMe() {
  const box = $('#meAvatar');
  const nameEl = $('#meName');
  const ownerEl = $('#meOwner');
  if (!myIdentity) {
    box.textContent = '?';
    box.style.background = 'rgba(120,90,45,.18)';
    nameEl.textContent = '아직 입장 전';
    ownerEl.textContent = '이름과 모습을 정하면 원탁에 자리가 생깁니다.';
    $('#btnLeave').disabled = true;
    return;
  }
  const col = colorOf(myIdentity.color);
  box.textContent = myIdentity.jamo;
  box.style.background = `#${col.hex.toString(16).padStart(6, '0')}`;
  nameEl.textContent = myIdentity.name;
  ownerEl.textContent = myIdentity.owner || `${col.name} 깃발 · 원탁 좌석`;
  $('#btnLeave').disabled = false;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

/* 탭 */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + tab.dataset.tab));
    if (tab.dataset.tab === 'chat') chatLog.scrollTop = chatLog.scrollHeight;
  });
});

function openPanel(tabName) {
  const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (tab) tab.click();
}

/* 시점 버튼 */
document.querySelectorAll('.views button').forEach(b => {
  b.addEventListener('click', () => setView(b.dataset.view));
});
$('#btnMe').addEventListener('click', () => { openPanel('me'); });

/* 초대 주소 */
$('#btnInvite').addEventListener('click', async () => {
  const url = location.origin + location.pathname;
  const text = `대항해시대 백작의 회의실에 초대합니다 ⚓\n${url}\n\n이름과 자음을 정하면 원탁에 앉습니다.`;
  try {
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      await navigator.share({ title: '합동 비서실 · 대항해시대 백작의 회의실', text: `대항해시대 백작의 회의실에 초대합니다 ⚓\n${url}`, url });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast('초대 주소를 복사했습니다 ⚓');
  } catch (e) {
    try {
      await navigator.clipboard.writeText(url);
      toast('초대 주소를 복사했습니다 ⚓');
    } catch (e2) {
      window.prompt('이 주소를 복사해 전달하세요', url);
    }
  }
});

/* 안건 등록 */
$('#agendaForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#agendaTitle');
  const title = input.value.trim();
  if (!title) { input.focus(); return; }
  if (!db) { toast('아직 바다와 연결되지 않았습니다'); return; }
  const owner = $('#agendaOwner').value || '*';
  push(ref(db, `council/${ROOM}/agenda`), {
    title,
    owner,
    status: '대기',
    by: (myIdentity && myIdentity.name) || '알 수 없음',
    ts: Date.now()
  }).catch(err => { console.error(err); toast('안건을 올리지 못했습니다'); });
  input.value = '';
  input.focus();
});

/* 전서구 */
$('#chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#chatInput');
  const text = input.value.trim();
  if (!text) return;
  if (!myIdentity) { toast('먼저 원탁에 앉아 주세요'); openJoin(); return; }
  if (!db) { toast('아직 바다와 연결되지 않았습니다'); return; }
  push(ref(db, `council/${ROOM}/chat`), {
    name: myIdentity.name,
    jamo: myIdentity.jamo,
    color: myIdentity.color,
    text,
    ts: Date.now()
  }).catch(err => { console.error(err); toast('전서구가 돌아오지 않았습니다'); });
  input.value = '';
});

/* ── 10. 입장 모달 ──────────────────────────────────────── */
const joinEl = $('#join');
let pickJamo = 'ㅂ';
let pickColor = 'blue';

(function buildJoinUI() {
  const grid = $('#jamoGrid');
  JAMO_POOL.forEach(j => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = j;
    b.dataset.jamo = j;
    if (j === pickJamo) b.classList.add('on');
    b.addEventListener('click', () => {
      pickJamo = j;
      grid.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.jamo === j));
    });
    grid.appendChild(b);
  });
  const sw = $('#swatches');
  COLORS.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.background = `#${c.hex.toString(16).padStart(6, '0')}`;
    b.title = c.name;
    b.dataset.color = c.key;
    if (c.key === pickColor) b.classList.add('on');
    b.addEventListener('click', () => {
      pickColor = c.key;
      sw.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.color === c.key));
    });
    sw.appendChild(b);
  });
})();

function openJoin(prefill) {
  const id = prefill || myIdentity || {};
  $('#joinName').value = id.name || '';
  $('#joinOwner').value = id.owner || '';
  pickJamo = JAMO_POOL.includes(id.jamo) ? id.jamo : 'ㅂ';
  pickColor = COLORS.some(c => c.key === id.color) ? id.color : 'blue';
  document.querySelectorAll('#jamoGrid button').forEach(b => b.classList.toggle('on', b.dataset.jamo === pickJamo));
  document.querySelectorAll('#swatches button').forEach(b => b.classList.toggle('on', b.dataset.color === pickColor));
  joinEl.hidden = false;
  setTimeout(() => $('#joinName').focus(), 120);
}

$('#joinCancel').addEventListener('click', () => {
  joinEl.hidden = true;
  if (!myIdentity) toast('구경만 하셔도 좋습니다. 앉으려면 [내 피클]을 눌러 주세요');
});
$('#joinGo').addEventListener('click', doJoin);
$('#joinName').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
$('#btnChange').addEventListener('click', () => openJoin());
$('#btnLeave').addEventListener('click', () => { leaveRoom(); toast('원탁에서 일어났습니다'); });

function doJoin() {
  const name = $('#joinName').value.trim();
  if (!name) { $('#joinName').focus(); $('#joinName').style.outline = '2px solid rgba(168,53,44,.6)'; return; }
  $('#joinName').style.outline = '';
  const identity = { name, jamo: pickJamo, color: pickColor, owner: $('#joinOwner').value.trim() };
  joinEl.hidden = true;
  joinRoom(identity);
  toast(`${name}, 원탁에 앉았습니다 ⚓`);
}

/* URL 파라미터 · 저장된 신원 */
(function boot() {
  const q = new URLSearchParams(location.search);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('pc.identity') || 'null'); } catch { return null; } })();
  const fromUrl = q.get('name') ? {
    name: q.get('name').slice(0, 12),
    jamo: JAMO_POOL.includes(q.get('char')) ? q.get('char') : 'ㅂ',
    color: COLORS.some(c => c.key === q.get('color')) ? q.get('color') : 'blue',
    owner: (q.get('owner') || '').slice(0, 30)
  } : null;

  renderMe();
  refreshOwnerOptions();

  if (fromUrl) {
    joinRoom(fromUrl);
    if (db) bindRoom();
  } else if (saved && saved.name) {
    joinRoom(saved);
  } else {
    openJoin();
  }
  if (db) bindRoom();
})();

/* ── 11. 애니메이션 루프 ────────────────────────────────── */
const clock = new THREE.Clock();
let mouseX = 0, mouseY = 0;
window.addEventListener('pointermove', (e) => {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = (e.clientY / window.innerHeight) * 2 - 1;
});

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const now = performance.now();

  // 불꽃
  fireplace.userData.flames.forEach((f, i) => {
    const s = 0.85 + Math.sin(t * (7 + i * 1.7) + i) * 0.18 + Math.random() * 0.08;
    f.scale.set(s, s * (1 + Math.sin(t * 9 + i * 2) * 0.12), s);
    f.material.opacity = 0.72 + Math.sin(t * 11 + i) * 0.22;
  });
  fireplace.userData.light.intensity = 14 + Math.sin(t * 8.3) * 2.4 + Math.random() * 2.2;
  fireplace.userData.ember.material.opacity = 0.28 + Math.sin(t * 3.1) * 0.08;

  // 촛불
  const flick = (o, base, amp) => { o.intensity = base + Math.sin(t * 9.1 + o.id) * amp + Math.random() * amp * 0.5; };
  table.userData.candles.forEach((c, i) => {
    flick(c.userData.light, 2.4, 0.5);
    c.userData.flame.scale.y = 0.9 + Math.sin(t * 8 + i * 2) * 0.2;
  });
  chandelier.userData.light.intensity = 24 + Math.sin(t * 2.2) * 2.2;
  chandelier.userData.flames.forEach((f, i) => {
    f.scale.y = 0.9 + Math.sin(t * 7 + i) * 0.18;
  });
  fillWarm.intensity = 8.4 + Math.sin(t * 1.6) * 0.7;
  wallSconces.forEach((s, i) => {
    s.userData.light.intensity = 4.6 + Math.sin(t * 7.3 + i * 2) * 0.9;
    s.userData.flame.scale.y = 0.92 + Math.sin(t * 8 + i) * 0.16;
  });

  // 먼지
  const dp = dust.geometry.attributes.position;
  for (let i = 0; i < dustCount; i++) {
    dp.array[i * 3 + 1] += 0.0016 + Math.sin(t * 0.4 + i) * 0.0008;
    dp.array[i * 3] += Math.sin(t * 0.3 + i * 1.7) * 0.0016;
    if (dp.array[i * 3 + 1] > 6) dp.array[i * 3 + 1] = 0.15;
  }
  dp.needsUpdate = true;

  // 캐릭터
  for (const [id, c] of characters) {
    const u = c.userData;
    const tgt = u.target;
    if (tgt) {
      c.position.x += (tgt.x - c.position.x) * 0.08;
      c.position.z += (tgt.z - c.position.z) * 0.08;
      let dry = u.targetRy - c.rotation.y;
      while (dry > Math.PI) dry -= Math.PI * 2;
      while (dry < -Math.PI) dry += Math.PI * 2;
      c.rotation.y += dry * 0.08;
      u.y += (tgt.y - u.y) * 0.1;
    }
    const talking = now < u.talkUntil;
    const bob = Math.sin(t * 1.7 + u.phase) * 0.032;
    const jump = talking ? Math.abs(Math.sin(t * 8.5)) * 0.1 : 0;
    c.position.y = u.y + bob + jump;
    const squash = 1 + Math.sin(t * 2.1 + u.phase) * 0.018 - jump * 0.18;
    u.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    u.body.rotation.z = Math.sin(t * 0.9 + u.phase) * 0.035;
    u.body.rotation.y = Math.sin(t * 0.6 + u.phase) * 0.14 + mouseX * 0.12;

    // 눈 깜빡임
    if (now > u.blinkAt) {
      const p = (now - u.blinkAt) / 150;
      if (p < 1) u.eyes.forEach(e => { e.scale.y = 1.12 * (1 - Math.sin(p * Math.PI) * 0.92); });
      else { u.eyes.forEach(e => { e.scale.y = 1.12; }); u.blinkAt = now + rand(2600, 6200); }
    }

    // 말풍선
    if (u.bubble) {
      const left = u.bubbleUntil - now;
      if (left <= 0) {
        c.remove(u.bubble);
        u.bubble.material.map.dispose();
        u.bubble.material.dispose();
        u.bubble = null;
      } else {
        u.bubble.material.opacity = Math.min(1, left / 900);
        u.bubble.position.y = 0.62 + Math.min(0.09, (8200 - left) * 0.00012);
        const s = u.bubble.userData.size;
        const pop = Math.min(1, (8200 - left) / 180);
        u.bubble.scale.set(s.w * 0.0034 * (0.9 + pop * 0.1), s.h * 0.0034 * (0.9 + pop * 0.1), 1);
      }
    }
  }

  // 카메라 이동
  if (camGoal) {
    camera.position.lerp(camGoal.pos, 0.075);
    controls.target.lerp(camGoal.target, 0.075);
    if (camera.position.distanceTo(camGoal.pos) < 0.02) camGoal = null;
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();

/* 리사이즈 */
let resizeT = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, 120);
});

/* 콘솔 진단용 */
window.__council = {
  get chars() { return characters.size; },
  get seats() { return Object.keys(seats).length; },
  view: setView,
  identity: () => myIdentity
};
