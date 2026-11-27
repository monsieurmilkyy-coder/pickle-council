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
controls.maxDistance = 24;
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
  candleFlame: new THREE.MeshBasicMaterial({ color: 0xff9424, transparent: true, opacity: 0.92 }),
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
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), M.candleFlame.clone());
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
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 8), M.candleFlame.clone());
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
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.14, 8), M.candleFlame.clone());
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
beam.visible = false;
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
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 8), M.candleFlame.clone());
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

/* ── 6-1. 아바타 종류 ─────────────────────────────────────── */
const AVATARS = [
  { key: 'count', icon: '👑', label: '백작 카르마', hint: '삼각모 · 망토 · 금장' },
  { key: 'llama', icon: '🦙', label: '라마', hint: '긴 목 · 폭신한 털' },
  { key: 'hippo', icon: '🦛', label: '하마', hint: '둥근 주둥이 · 콧구멍' },
  { key: 'jamo',  icon: '✨', label: '자음 피클', hint: '한글 획 기본형' }
];
const AVATAR_INFO = AVATARS.reduce((m, a) => (m[a.key] = a, m), {});

function inferAvatarByName(name) {
  const n = String(name || '');
  if (/카르마/.test(n) || /karma/i.test(n)) return 'count';
  if (/라마/.test(n) || /llama/i.test(n)) return 'llama';
  if (/하마/.test(n) || /hippo/i.test(n)) return 'hippo';
  return null;
}
/* 저장된 avatar → 이름 추론 → 자음 순으로 결정 (기존 데이터 하위 호환) */
function resolveAvatar(name, avatar) {
  const k = String(avatar || '').toLowerCase();
  if (AVATAR_INFO[k]) return k;
  return inferAvatarByName(name) || 'jamo';
}
function avatarIcon(name, avatar) {
  const k = resolveAvatar(name, avatar);
  return k === 'jamo' ? null : AVATAR_INFO[k].icon;
}

/* ── 6-2. 캐릭터 재료 · 헬퍼 ─────────────────────────────── */
const EYE_MAT = new THREE.MeshPhysicalMaterial({
  color: 0x171019, roughness: 0.05, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04
});
const WHITE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
const BLUSH_MAT = new THREE.MeshBasicMaterial({ color: 0xf4788c, transparent: true, opacity: 0.42 });
const MOUTH_MAT = new THREE.MeshBasicMaterial({ color: 0x2a1a16 });

function matOf(hex, o = {}) {
  return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, metalness: 0.02, flatShading: true, ...o });
}
function lowSph(r, mat, sx = 1, sy = 1, sz = 1, seg = 12, ring = 9) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, ring), mat);
  m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
/* 큰 반짝이는 눈: 검은 눈알 + 흰 하이라이트 두 점 */
function addEyes(body, { x = 0.06, y = 0.3, z = 0.2, r = 0.048, sy = 1, sz = 0.86 } = {}) {
  const eyes = [];
  [-1, 1].forEach(s => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), EYE_MAT);
    e.position.set(s * x, y, z);
    e.scale.set(1, sy, sz);
    e.userData.baseY = sy;
    body.add(e); eyes.push(e);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 8, 8), WHITE_MAT);
    shine.position.set(s * x + r * 0.3, y + r * 0.34, z + r * 0.6);
    body.add(shine);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(r * 0.17, 6, 6), WHITE_MAT);
    spark.position.set(s * x - r * 0.3, y - r * 0.24, z + r * 0.68);
    body.add(spark);
  });
  return eyes;
}
function addBlush(body, x, y, z, r = 0.04) {
  [-1, 1].forEach(s => {
    const b = new THREE.Mesh(new THREE.CircleGeometry(r, 16), BLUSH_MAT);
    b.position.set(s * x, y, z);
    b.scale.y = 0.68;
    body.add(b);
  });
}
function addSmile(body, x, y, z, r = 0.024) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0085, 6, 14, Math.PI), MOUTH_MAT);
  m.rotation.z = Math.PI;
  m.position.set(x, y, z);
  body.add(m);
}

/* 폭신한 라마 털 텍스처 */
const woolTex = texOf(256, 256, (c, w, h) => {
  c.fillStyle = '#fbf5e7'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 620; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = rand(7, 24);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() < 0.55;
    g.addColorStop(0, dark ? 'rgba(214,199,172,.40)' : 'rgba(255,255,255,.55)');
    g.addColorStop(1, dark ? 'rgba(214,199,172,0)' : 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  for (let i = 0; i < 220; i++) {
    c.strokeStyle = `rgba(206,190,162,${rand(0.08, 0.22)})`;
    c.lineWidth = rand(0.7, 1.8);
    const x = Math.random() * w, y = Math.random() * h;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + rand(-6, 6), y + rand(6, 16), x + rand(-8, 8), y + rand(14, 26)); c.stroke();
  }
}, 2, 2);

/* ── 6-3. 자음 피클 (기본형) ─────────────────────────────── */
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

/* 자음 피클: 한글 획 몸통 + 눈·볼·입 */
function buildJamoPickle(jamo, col) {
  const body = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: col.hex, roughness: 0.28, metalness: 0.06,
    clearcoat: 0.9, clearcoatRoughness: 0.25,
    sheen: 0.5, sheenColor: new THREE.Color(0xffffff),
    emissive: new THREE.Color(col.hex).multiplyScalar(0.12)
  });
  body.add(makeJamoMesh(jamo, mat));

  const blushMat = new THREE.MeshBasicMaterial({ color: 0xf26a7a, transparent: true, opacity: 0.45 });
  [-1, 1].forEach(s => {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.062, 14), blushMat);
    b.position.set(s * 0.27, -0.1, 0.075);
    b.scale.y = 0.7;
    body.add(b);
  });

  const eyes = [];
  [-1, 1].forEach(s => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.082, 18, 14), EYE_MAT);
    e.position.set(s * 0.155, 0.12, 0.075);
    e.scale.set(1, 1.12, 0.65);
    e.userData.baseY = 1.12;
    body.add(e);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), WHITE_MAT);
    shine.position.set(s * 0.155 + 0.022, 0.155, 0.115);
    body.add(shine);
    eyes.push(e);
  });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.011, 6, 14, Math.PI), MOUTH_MAT);
  mouth.rotation.z = Math.PI; mouth.position.set(0, -0.02, 0.08);
  body.add(mouth);

  return { body, eyes, mat };
}

/* ── 6-4. 🦙 라마 ─────────────────────────────────────────── */
function buildLlama(col) {
  const body = new THREE.Group();
  const wool = matOf(0xfaf4e6, { map: woolTex, roughness: 0.96 });
  const woolShade = matOf(0xe9dcc6, { roughness: 0.96 });
  const muzzleMat = matOf(0xf3e3ce, { roughness: 0.9 });
  const innerEar = matOf(0xf0ada7, { roughness: 0.9 });
  const hoof = matOf(0x6d5a47, { roughness: 0.8 });
  const accent = matOf(col.hex, { roughness: 0.5, metalness: 0.08 });

  // 몸통 (폭신한 덩어리)
  const torso = lowSph(0.27, wool, 1.02, 0.94, 1.16, 14, 10);
  torso.position.set(0, -0.17, -0.03);
  body.add(torso);
  // 털 볼륨: 몸통 둘레에 솜뭉치
  [[0.20, -0.09, 0.15], [-0.21, -0.05, 0.13], [0.16, -0.26, 0.21], [-0.15, -0.25, 0.21],
   [0.19, -0.30, -0.15], [-0.19, -0.32, -0.13], [0, -0.02, -0.28], [0.11, 0.03, 0.19],
   [-0.11, 0.02, -0.22], [0.02, -0.40, 0.06]].forEach(([x, y, z], i) => {
    const p = lowSph(rand(0.085, 0.115), i % 3 ? wool : woolShade, 1, 0.95, 1, 8, 6);
    p.position.set(x, y, z);
    body.add(p);
  });
  // 다리
  [[-0.11, 0.10], [0.11, 0.10], [-0.11, -0.17], [0.11, -0.17]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.15, 4, 8), woolShade);
    leg.position.set(x, -0.40, z); leg.castShadow = true; body.add(leg);
    const foot = lowSph(0.047, hoof, 1.1, 0.6, 1.15, 8, 6);
    foot.position.set(x, -0.478, z + 0.005); body.add(foot);
  });
  // 목
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.074, 0.20, 4, 10), wool);
  neck.position.set(0, 0.08, 0.05); neck.rotation.x = -0.17; neck.castShadow = true;
  body.add(neck);
  // 머리 (카메라 쪽으로 살짝 돌아보는 피벗)
  const headAll = new THREE.Group();
  const head = lowSph(0.135, wool, 1.0, 1.06, 0.94, 14, 10);
  head.position.set(0, 0.34, 0.11);
  headAll.add(head);
  // 머리 위 솜
  const tuft = lowSph(0.055, woolShade, 1, 0.8, 1, 8, 6);
  tuft.position.set(0, 0.455, 0.10); headAll.add(tuft);
  // 주둥이
  const muzzle = lowSph(0.072, muzzleMat, 1.18, 0.9, 1.0, 12, 8);
  muzzle.position.set(0, 0.285, 0.225); headAll.add(muzzle);
  [-1, 1].forEach(s => {
    const n = lowSph(0.014, hoof, 1, 1, 0.8, 6, 5);
    n.position.set(s * 0.028, 0.30, 0.292); headAll.add(n);
  });
  // 쫑긋한 두 귀
  [-1, 1].forEach(s => {
    const outer = new THREE.Mesh(new THREE.CapsuleGeometry(0.033, 0.075, 4, 8), wool);
    outer.position.set(s * 0.072, 0.50, 0.055);
    outer.rotation.z = s * 0.27; outer.rotation.x = -0.12; outer.castShadow = true;
    headAll.add(outer);
    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.05, 4, 8), innerEar);
    inner.position.set(s * 0.077, 0.497, 0.077);
    inner.rotation.z = s * 0.27; inner.rotation.x = -0.12;
    headAll.add(inner);
  });
  const eyes = addEyes(headAll, { x: 0.063, y: 0.362, z: 0.198, r: 0.049, sy: 1.06 });
  addBlush(headAll, 0.113, 0.30, 0.192, 0.042);
  addSmile(headAll, 0, 0.243, 0.256, 0.023);
  // 스카프 (고른 색)
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.031, 8, 20), accent);
  scarf.position.set(0, 0.19, 0.055);
  scarf.rotation.x = Math.PI / 2 - 0.12;
  scarf.castShadow = true;
  body.add(scarf);
  const knot = lowSph(0.036, accent, 1, 1, 1, 8, 6);
  knot.position.set(0.098, 0.148, 0.128); body.add(knot);
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.085, 4, 8), accent);
  tail.position.set(0.132, 0.088, 0.118); tail.rotation.z = 0.55; body.add(tail);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.06, 0.05);
  headAll.position.set(0, -0.06, -0.05);
  headPivot.add(headAll);
  body.add(headPivot);

  return { body, eyes, head: headPivot, scale: 0.98 };
}

/* ── 6-5. 🦛 하마 ─────────────────────────────────────────── */
function buildHippo(col) {
  const body = new THREE.Group();
  const skin = matOf(0xa79ec0, { roughness: 0.72 });
  const skinDeep = matOf(0x8d84a8, { roughness: 0.75 });
  const belly = matOf(0xc7bcd8, { roughness: 0.78 });
  const snout = matOf(0xdccddd, { roughness: 0.7 });
  const innerEar = matOf(0xe9a3b6, { roughness: 0.85 });
  const dark = matOf(0x5b4a66, { roughness: 0.6 });
  const tooth = matOf(0xfbf7ec, { roughness: 0.5 });
  const accent = matOf(col.hex, { roughness: 0.5, metalness: 0.08 });

  // 통통한 몸통
  const torso = lowSph(0.29, skin, 1.22, 0.98, 1.04, 14, 10);
  torso.position.set(0, -0.15, -0.01); body.add(torso);
  const tummy = lowSph(0.2, belly, 1.1, 0.9, 0.62, 12, 8);
  tummy.position.set(0, -0.18, 0.19); body.add(tummy);
  // 짧은 다리
  [[-0.14, 0.14], [0.14, 0.14], [-0.14, -0.14], [0.14, -0.14]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.07, 4, 8), skinDeep);
    leg.position.set(x, -0.40, z); leg.castShadow = true; body.add(leg);
  });
  // 머리 (몸통과 이어진 둥근 덩어리) + 카메라 쪽으로 돌아보는 피벗
  const headAll = new THREE.Group();
  const head = lowSph(0.225, skin, 1.08, 0.96, 1.02, 14, 10);
  head.position.set(0, 0.18, 0.05); headAll.add(head);
  // 큰 주둥이
  const muzzle = lowSph(0.155, snout, 1.34, 0.84, 0.94, 14, 10);
  muzzle.position.set(0, 0.115, 0.235); headAll.add(muzzle);
  // 콧구멍
  [-1, 1].forEach(s => {
    const n = lowSph(0.031, dark, 1, 0.85, 1, 8, 6);
    n.position.set(s * 0.062, 0.185, 0.352); headAll.add(n);
  });
  // 입 · 앞니
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 16, Math.PI), MOUTH_MAT);
  mouth.rotation.z = Math.PI; mouth.rotation.x = 0.25;
  mouth.position.set(0, 0.088, 0.352); headAll.add(mouth);
  [-1, 1].forEach(s => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.036, 0.02), tooth);
    t.position.set(s * 0.02, 0.072, 0.352); t.rotation.z = s * 0.05; headAll.add(t);
  });
  // 작은 귀
  [-1, 1].forEach(s => {
    const e = lowSph(0.052, skinDeep, 1, 0.95, 0.65, 10, 8);
    e.position.set(s * 0.192, 0.375, 0.015); e.rotation.z = s * -0.2; headAll.add(e);
    const inner = lowSph(0.028, innerEar, 1, 1, 0.5, 8, 6);
    inner.position.set(s * 0.198, 0.378, 0.05); headAll.add(inner);
  });
  const eyes = addEyes(headAll, { x: 0.10, y: 0.285, z: 0.198, r: 0.056, sy: 1.0 });
  addBlush(headAll, 0.163, 0.215, 0.20, 0.045);
  // 꼬리
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 8), skinDeep);
  tail.position.set(0.04, -0.10, -0.31); tail.rotation.x = 1.15; body.add(tail);
  // 색 리본 (고른 색)
  const knotR = lowSph(0.03, accent, 1, 1, 1, 8, 6);
  knotR.position.set(-0.145, 0.44, 0.06); headAll.add(knotR);
  [-1, 1].forEach(s => {
    const loop = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.075, 6), accent);
    loop.position.set(-0.145 + s * 0.055, 0.452, 0.06);
    loop.rotation.z = s * 1.35; headAll.add(loop);
  });

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.03, 0.03);
  headAll.position.set(0, -0.03, -0.03);
  headPivot.add(headAll);
  body.add(headPivot);

  return { body, eyes, head: headPivot, scale: 1.02 };
}

/* ── 6-6. 👑 백작 카르마 ─────────────────────────────────── */
function buildCount(col) {
  const body = new THREE.Group();
  const coat = matOf(0x22334c, { roughness: 0.74 });
  const coatDeep = matOf(0x18243a, { roughness: 0.78 });
  const capeMat = new THREE.MeshStandardMaterial({ color: 0x6d1f2c, roughness: 0.86, flatShading: true, side: THREE.DoubleSide });
  const brassMat = matOf(0xd8b05a, { roughness: 0.32, metalness: 0.85, flatShading: false });
  const accent = matOf(col.hex, { roughness: 0.35, metalness: 0.55 });
  const skin = matOf(0xf4cfa8, { roughness: 0.62 });
  const hair = matOf(0xf1eadf, { roughness: 0.9 });
  const white = matOf(0xfaf6ec, { roughness: 0.85 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe6f5, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.35, transmission: 0.6 });

  // 망토 (뒤를 감싸고 앞은 열림)
  const capeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.235, 0.335, 0.48, 18, 1, true, Math.PI * 0.16, Math.PI * 1.68), capeMat);
  capeMesh.position.set(0, -0.13, -0.02); capeMesh.castShadow = true; body.add(capeMesh);
  const capeTrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.332, 0.339, 0.04, 18, 1, true, Math.PI * 0.16, Math.PI * 1.68), brassMat);
  capeTrim.position.set(0, -0.35, -0.02); body.add(capeTrim);
  // 코트
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.215, 0.36, 16, 1), coat);
  torso.position.set(0, -0.12, 0); torso.castShadow = true; body.add(torso);
  // 벨트 · 금장 단추
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.203, 0.212, 0.036, 16), brassMat);
  belt.position.set(0, -0.205, 0); body.add(belt);
  [[0.03, 0.155], [-0.05, 0.172], [-0.13, 0.19]].forEach(([y, z]) => {
    const b = lowSph(0.017, brassMat, 1, 1, 0.7, 8, 6);
    b.position.set(0, y, z); body.add(b);
  });
  // 옷깃(금장 라펠)
  [-1, 1].forEach(s => {
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.02), brassMat);
    lapel.position.set(s * 0.085, 0.0, 0.135);
    lapel.rotation.z = s * 0.24; lapel.rotation.y = s * -0.35; body.add(lapel);
  });
  // 견장
  [-1, 1].forEach(s => {
    const ep = lowSph(0.055, brassMat, 1.25, 0.5, 1.0, 10, 8);
    ep.position.set(s * 0.155, 0.055, 0.0); body.add(ep);
  });
  // 목 · 크라바트
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.09, 10), skin);
  neck.position.set(0, 0.115, 0.02); body.add(neck);
  const cravat = lowSph(0.062, white, 1.25, 0.9, 0.75, 12, 8);
  cravat.position.set(0, 0.10, 0.10); body.add(cravat);
  // 머리 + 카메라 쪽으로 돌아보는 피벗
  const headAll = new THREE.Group();
  const head = lowSph(0.165, skin, 1.0, 1.02, 0.95, 16, 12);
  head.position.set(0, 0.285, 0.005); headAll.add(head);
  // 백발 (옆·뒤)
  const hairBack = lowSph(0.13, hair, 1.06, 0.82, 0.8, 12, 9);
  hairBack.position.set(0, 0.315, -0.10); headAll.add(hairBack);
  [-1, 1].forEach(s => {
    const curl = lowSph(0.062, hair, 0.9, 1.1, 0.85, 10, 8);
    curl.position.set(s * 0.155, 0.245, -0.02); headAll.add(curl);
  });
  const eyes = addEyes(headAll, { x: 0.062, y: 0.30, z: 0.135, r: 0.042, sy: 1.02, sz: 0.8 });
  addBlush(headAll, 0.105, 0.255, 0.135, 0.036);
  // 코 · 미소 · 작은 콧수염
  const nose = lowSph(0.018, matOf(0xe7b48f, { roughness: 0.7 }), 1, 0.8, 1, 8, 6);
  nose.position.set(0, 0.272, 0.157); headAll.add(nose);
  addSmile(headAll, 0, 0.238, 0.152, 0.02);
  [-1, 1].forEach(s => {
    const mo = lowSph(0.026, hair, 1.5, 0.5, 0.6, 8, 6);
    mo.position.set(s * 0.03, 0.252, 0.15); mo.rotation.z = s * -0.25; headAll.add(mo);
  });
  // 외알 안경(모노클)
  const mono = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 20), brassMat);
  mono.position.set(0.062, 0.30, 0.157); headAll.add(mono);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), glass);
  lens.position.set(0.062, 0.30, 0.154); headAll.add(lens);

  // 삼각모 (꼭짓점이 앞으로 온 삼각 프리즘 + 금장 테)
  const hat = new THREE.Group();
  hat.position.set(0, 0.40, 0.015); hat.rotation.x = -0.05;
  const brimTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.232, 0.238, 0.016, 3), brassMat);
  brimTrim.position.y = -0.026; hat.add(brimTrim);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.222, 0.05, 3), coatDeep);
  brim.position.y = 0.0; brim.castShadow = true; hat.add(brim);
  const crown = lowSph(0.118, coatDeep, 1.0, 0.88, 1.0, 12, 9);
  crown.position.y = 0.058; hat.add(crown);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.013, 6, 24), accent);
  band.rotation.x = Math.PI / 2; band.position.y = 0.035; hat.add(band);
  const cockade = lowSph(0.028, accent, 1, 1, 0.6, 10, 8);
  cockade.position.set(0, 0.048, 0.135); hat.add(cockade);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.17, 6), white);
  plume.position.set(0.10, 0.135, 0.02); plume.rotation.z = -0.35; plume.rotation.x = -0.12; hat.add(plume);
  headAll.add(hat);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.10, 0.02);
  headAll.position.set(0, -0.10, -0.02);
  headPivot.add(headAll);
  body.add(headPivot);

  return { body, eyes, head: headPivot, scale: 1.02 };
}

function buildCharacter(name, jamo, colorKey, avatar) {
  const col = colorOf(colorKey);
  const kind = resolveAvatar(name, avatar);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  let built;
  if (kind === 'llama') built = buildLlama(col);
  else if (kind === 'hippo') built = buildHippo(col);
  else if (kind === 'count') built = buildCount(col);
  else built = buildJamoPickle(jamo, col);
  body.add(built.body);

  // (이름표는 3D에서 쓰지 않습니다 — 상단 접속자 칩과 캐릭터 색으로 구분)
  root.userData = {
    name, jamo, colorKey, avatar: kind, body, eyes: built.eyes, head: built.head || null, mat: built.mat || null,
    seat: 0, phase: rand(0, 6.28), talkUntil: 0, bubble: null, bubbleUntil: 0,
    blinkAt: rand(2, 5), y: 0, scale: built.scale || 1.1,
    bubbleY: kind === 'count' ? 0.74 : kind === 'hippo' ? 0.57 : kind === 'llama' ? 0.64 : 0.62
  };
  root.scale.setScalar(root.userData.scale);
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
    const avatar = resolveAvatar(v.name, v.avatar);
    let c = characters.get(id);
    if (!c || c.userData.jamo !== jamo || c.userData.colorKey !== v.color || c.userData.name !== v.name || c.userData.avatar !== avatar) {
      if (c) charLayer.remove(c);
      c = buildCharacter(v.name, jamo, v.color || 'blue', avatar);
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
  b.position.set(0, c.userData.bubbleY || 0.62, 0);
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
let currentView = 'room';
/* 세로 화면(폰)은 가로 화각이 좁아 원탁이 잘린다 — 시점을 타깃에서 밀어낸다 */
function fitPortrait(pos, target) {
  const a = window.innerWidth / Math.max(1, window.innerHeight);
  const t = target.clone();
  if (a >= 1.05 || !window.innerWidth) return { pos: pos.clone(), target: t };
  const k = Math.min(2.4, Math.pow(1.15 / a, 0.75));
  t.y -= 1.3;
  return { pos: t.clone().add(pos.clone().sub(target).multiplyScalar(k)), target: t };
}
function setView(name) {
  currentView = name;
  document.querySelectorAll('.views button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'me') {
    const me = characters.get(myId);
    if (me) {
      const a = Math.atan2(me.position.z, me.position.x);
      const outward = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const p = me.position.clone().add(outward.multiplyScalar(1.3)).add(new THREE.Vector3(0, 1.5, 0));
      camGoal = { pos: p, target: new THREE.Vector3(0, 1.05, 0) };
      return;
    }
    const f = fitPortrait(VIEWS.map.pos, VIEWS.map.target);
    camGoal = { pos: f.pos, target: f.target };
    return;
  }
  const v = VIEWS[name] || VIEWS.room;
  const f = fitPortrait(v.pos, v.target);
  camGoal = { pos: f.pos, target: f.target };
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
    renderChatTargets();
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

let presenceSig = '';
function renderPresence() {
  const list = Object.entries(seats).filter(([, v]) => v && v.name).sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
  const sig = list.map(([id, v]) => id + ':' + v.name + ':' + v.color + ':' + (v.jamo || '') + ':' + (v.avatar || '')).join('|');
  if (sig === presenceSig) return;
  presenceSig = sig;
  presenceEl.innerHTML = '';
  list.forEach(([id, v]) => {
    const col = colorOf(v.color);
    const el = document.createElement('div');
    el.className = 'chip' + (id === myId ? ' me' : '');
    const j = document.createElement('span');
    j.className = 'j';
    const icon = avatarIcon(v.name, v.avatar);
    j.textContent = icon || v.jamo || 'ㅂ';
    j.style.background = `#${col.hex.toString(16).padStart(6, '0')}`;
    if (icon) j.classList.add('emo');
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

let agendaSig = '';
function renderAgenda(data) {
  const items = Object.entries(data || {})
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const sig = items.map(i => [i.id, i.status, i.title, i.owner].join('~')).join('|') + '@' + presenceSig;
  if (sig === agendaSig) return;
  agendaSig = sig;
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
  const cIcon = avatarIcon(v.name, v.avatar);
  ava.textContent = cIcon || v.jamo || 'ㅂ';
  if (cIcon) ava.classList.add('emo');
  ava.style.background = `#${colorOf(v.color).hex.toString(16).padStart(6, '0')}`;
  const body = document.createElement('div');
  body.className = 'body';
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = v.name;
  if (v.to) {
    const badge = document.createElement('span');
    badge.className = 'to';
    badge.textContent = '→ ' + v.to;
    who.appendChild(badge);
  }
  const text = document.createElement('div');
  text.className = 'text';
  text.textContent = v.text;
  body.append(who, text);
  el.append(ava, body);
  chatLog.appendChild(el);
  while (chatLog.children.length > 80) chatLog.removeChild(chatLog.firstChild);
  chatLog.scrollTop = chatLog.scrollHeight;

  if (live && v.name) {
    // 수신 대상이 있으면 그 캐릭터가 받아 읽고, 없으면 보낸 이가 말한다
    let speakerId = null;
    if (v.to) {
      const t = Object.entries(seats).find(([, s]) => s && s.name === v.to);
      if (t) speakerId = t[0];
    }
    if (!speakerId) {
      const t = Object.entries(seats).find(([, s]) => s && s.name === v.name);
      if (t) speakerId = t[0];
    }
    if (speakerId) speak(speakerId, v.text);
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
    box.classList.remove('emo');
    renderSender();
    return;
  }
  const col = colorOf(myIdentity.color);
  const icon = avatarIcon(myIdentity.name, myIdentity.avatar);
  box.textContent = icon || myIdentity.jamo;
  box.style.background = `#${col.hex.toString(16).padStart(6, '0')}`;
  box.classList.toggle('emo', !!icon);
  nameEl.textContent = myIdentity.name;
  ownerEl.textContent = myIdentity.owner || `${col.name} 깃발 · 원탁 좌석`;
  $('#btnLeave').disabled = false;
  renderSender();
}

/* 전서구 발신자 표시 — "내가 누구로 말하는지" 항상 보이게 */
function renderSender() {
  const box = $('#chatSender');
  if (!box) return;
  box.innerHTML = '';
  const label = document.createElement('span');
  label.className = 'who-label';
  if (myIdentity) {
    const ic = avatarIcon(myIdentity.name, myIdentity.avatar);
    label.textContent = `발신: ${ic ? ic + ' ' : ''}${myIdentity.name}`;
  } else {
    label.textContent = '발신: 아직 입장 전';
    label.classList.add('off');
  }
  box.appendChild(label);

  const isKarma = myIdentity && resolveAvatar(myIdentity.name, myIdentity.avatar) === 'count' && myIdentity.name === '카르마';
  if (!isKarma) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mini brass';
    b.textContent = myIdentity ? '👑 카르마로 전환' : '👑 카르마로 입장';
    b.addEventListener('click', becomeKarma);
    box.appendChild(b);
  }
  const c = document.createElement('button');
  c.type = 'button';
  c.className = 'mini';
  c.textContent = '내 피클 변경';
  c.addEventListener('click', () => openJoin());
  box.appendChild(c);
}

function becomeKarma() {
  const identity = {
    name: '카르마',
    jamo: JAMO_POOL.includes(pickJamo) ? pickJamo : 'ㅂ',
    avatar: 'count',
    color: 'gold',
    owner: '대표 · 라마웍스'
  };
  joinRoom(identity);
  renderSender();
  toast('👑 카르마로 발신합니다');
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
  const text = `대항해시대 백작의 회의실에 초대합니다 ⚓\n${url}\n\n이름과 모습을 정하면 원탁에 앉습니다.`;
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
let chatTo = '*';
let chatToSig = '';
function renderChatTargets() {
  const box = $('#chatTo');
  if (!box) return;
  const names = [...new Set(Object.values(seats).filter(v => v && v.name).map(v => v.name))];
  const base = ['카르마', '라마', '하마'];
  const extra = names.filter(n => !base.includes(n));
  const opts = [{ v: '*', label: '전체', icon: '📜' }].concat(
    [...base, ...extra].slice(0, 6).map(n => {
      const seat = Object.values(seats).find(s => s && s.name === n);
      return { v: n, label: '@' + n, icon: avatarIcon(n, seat && seat.avatar) || '·' };
    })
  );
  if (chatTo !== '*' && !opts.some(o => o.v === chatTo)) chatTo = '*';
  const sig = opts.map(o => o.v + ':' + o.icon).join('|');
  if (sig === chatToSig) {
    box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.to === chatTo));
    return;
  }
  chatToSig = sig;
  box.innerHTML = '';
  opts.forEach(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'to-chip' + (chatTo === o.v ? ' on' : '');
    b.dataset.to = o.v;
    b.title = o.v === '*' ? '모두에게' : o.v + '에게만';
    const ic = document.createElement('span');
    ic.className = 'ic';
    ic.textContent = o.icon;
    b.append(ic, document.createTextNode(o.label));
    b.addEventListener('click', () => {
      chatTo = o.v;
      box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.to === chatTo));
      $('#chatInput').focus();
    });
    box.appendChild(b);
  });
}

$('#chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#chatInput');
  let text = input.value.trim();
  if (!text) return;
  if (!myIdentity) { toast('먼저 원탁에 앉아 주세요'); openJoin(); return; }
  if (!db) { toast('아직 바다와 연결되지 않았습니다'); return; }
  // 본문이 @이름 으로 시작하면 그 사람 앞으로
  let to = chatTo === '*' ? null : chatTo;
  const m = text.match(/^@(\S+)\s+([\s\S]+)$/);
  if (m) {
    const nm = m[1];
    const known = ['카르마', '라마', '하마'].includes(nm) || Object.values(seats).some(s => s && s.name === nm);
    if (known) { to = nm; text = m[2].trim(); }
  }
  push(ref(db, `council/${ROOM}/chat`), {
    name: myIdentity.name,
    jamo: myIdentity.jamo,
    avatar: myIdentity.avatar || resolveAvatar(myIdentity.name),
    color: myIdentity.color,
    text,
    to: to || null,
    ts: Date.now()
  }).catch(err => { console.error(err); toast('전서구가 돌아오지 않았습니다'); });
  input.value = '';
  input.focus();
});

/* ── 10. 입장 모달 ──────────────────────────────────────── */
const joinEl = $('#join');
let pickJamo = 'ㅂ';
let pickColor = 'blue';
let pickAvatar = 'jamo';

const ROLE_PRESETS = [
  { key: 'count', icon: '👑', label: '카르마', sub: '대표', name: '카르마', avatar: 'count', color: 'gold', owner: '대표 · 라마웍스' },
  { key: 'llama', icon: '🦙', label: '라마', sub: '비서실', name: '라마', avatar: 'llama', color: 'blue', owner: '' },
  { key: 'hippo', icon: '🦛', label: '하마', sub: '비서실', name: '하마', avatar: 'hippo', color: 'violet', owner: '' },
  { key: 'jamo', icon: '✨', label: '직접 입력', sub: '자음 피클', name: '', avatar: 'jamo', color: null, owner: '' }
];

function applyPreset(key) {
  const p = ROLE_PRESETS.find(r => r.key === key);
  if (!p) return;
  document.querySelectorAll('.preset').forEach(x => x.classList.toggle('on', x.dataset.role === p.key));
  $('#joinName').value = p.name;
  $('#joinOwner').value = p.owner || '';
  pickAvatar = p.avatar;
  if (p.color) pickColor = p.color;
  if (p.avatar === 'jamo' && !p.name) pickJamo = 'ㅂ';
  setAvatarUI(); setJamoUI(); setColorUI();
}

function setAvatarUI() {
  document.querySelectorAll('#avatarGrid button').forEach(b => b.classList.toggle('on', b.dataset.avatar === pickAvatar));
  const wrap = $('#jamoWrap');
  if (wrap) wrap.hidden = pickAvatar !== 'jamo';
}
function setJamoUI() {
  document.querySelectorAll('#jamoGrid button').forEach(b => b.classList.toggle('on', b.dataset.jamo === pickJamo));
}
function setColorUI() {
  document.querySelectorAll('#swatches button').forEach(b => b.classList.toggle('on', b.dataset.color === pickColor));
}

(function buildJoinUI() {
  const presets = $('#presets');
  ROLE_PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.dataset.role = p.key;
    const ic = document.createElement('span');
    ic.className = 'pic';
    ic.textContent = p.icon;
    const tx = document.createElement('span');
    tx.className = 'ptx';
    const nm = document.createElement('b');
    nm.textContent = p.label;
    const sb = document.createElement('i');
    sb.textContent = p.sub;
    tx.append(nm, sb);
    b.append(ic, tx);
    b.addEventListener('click', () => {
      applyPreset(p.key);
      $('#joinName').focus();
    });
    presets.appendChild(b);
  });

  const grid = $('#jamoGrid');
  JAMO_POOL.forEach(j => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = j;
    b.dataset.jamo = j;
    if (j === pickJamo) b.classList.add('on');
    b.addEventListener('click', () => {
      pickJamo = j;
      pickAvatar = 'jamo';
      setJamoUI(); setAvatarUI();
    });
    grid.appendChild(b);
  });

  const ag = $('#avatarGrid');
  AVATARS.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.avatar = a.key;
    if (a.key === pickAvatar) b.classList.add('on');
    const ic = document.createElement('span');
    ic.className = 'aic';
    ic.textContent = a.icon;
    const nm = document.createElement('b');
    nm.textContent = a.label;
    const hint = document.createElement('i');
    hint.textContent = a.hint;
    b.append(ic, nm, hint);
    b.addEventListener('click', () => {
      pickAvatar = a.key;
      setAvatarUI();
    });
    ag.appendChild(b);
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
      setColorUI();
    });
    sw.appendChild(b);
  });

  // 이름을 치면 그에 맞는 모습을 미리 골라 준다
  $('#joinName').addEventListener('input', () => {
    const inf = inferAvatarByName($('#joinName').value);
    if (!inf || inf === pickAvatar) return;
    pickAvatar = inf;
    setAvatarUI();
  });
})();

function openJoin(prefill) {
  const id = prefill || myIdentity || {};
  $('#joinName').value = id.name || '';
  $('#joinOwner').value = id.owner || '';
  pickJamo = JAMO_POOL.includes(id.jamo) ? id.jamo : 'ㅂ';
  pickColor = COLORS.some(c => c.key === id.color) ? id.color : 'blue';
  pickAvatar = resolveAvatar(id.name, id.avatar);
  document.querySelectorAll('.preset').forEach(x => x.classList.remove('on'));
  document.querySelectorAll('.preset').forEach(x => {
    const p = ROLE_PRESETS.find(r => r.key === x.dataset.role);
    if (p && p.avatar === pickAvatar && (!p.name || p.name === id.name)) x.classList.add('on');
  });
  setJamoUI(); setAvatarUI(); setColorUI();
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
  const identity = {
    name,
    jamo: pickJamo,
    avatar: resolveAvatar(name, pickAvatar),
    color: pickColor,
    owner: $('#joinOwner').value.trim()
  };
  joinEl.hidden = true;
  joinRoom(identity);
  setView('room');
  const ic = avatarIcon(identity.name, identity.avatar);
  toast(`${ic ? ic + ' ' : ''}${name}, 원탁에 앉았습니다 ⚓`);
}

/* URL 파라미터 · 저장된 신원 */
(function boot() {
  const q = new URLSearchParams(location.search);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('pc.identity') || 'null'); } catch { return null; } })();
  const urlName = q.get('name');
  const fromUrl = urlName ? {
    name: urlName.slice(0, 12),
    jamo: JAMO_POOL.includes(q.get('char')) ? q.get('char') : 'ㅂ',
    avatar: resolveAvatar(urlName, q.get('avatar')),
    color: COLORS.some(c => c.key === q.get('color')) ? q.get('color') : 'blue',
    owner: (q.get('owner') || '').slice(0, 30)
  } : null;

  renderMe();
  refreshOwnerOptions();
  renderChatTargets();
  renderSender();

  if (fromUrl) {
    // URL 파라미터가 저장된 신원보다 먼저다 (카르마 전용 링크로 들어오면 무조건 카르마)
    joinRoom(fromUrl);
    if (db) bindRoom();
    setView('room');
  } else if (saved && saved.name && saved.avatar) {
    joinRoom({ ...saved, avatar: resolveAvatar(saved.name, saved.avatar) });
  } else {
    // 예전 저장값(모습 없이 저장된 라마 등)은 자동 착석하지 않는다
    openJoin(saved && saved.name ? saved : undefined);
    const legacyRole = saved && saved.name && ['카르마', '라마', '하마'].includes(saved.name);
    if (!saved || !saved.name || legacyRole) applyPreset('count');
  }
  if (db) bindRoom();
})();

/* 자리 자가 복구: 탭이 잠깐 얼거나 네트워크가 끊긴 뒤에도 의자가 남아 있게 */
setInterval(() => {
  if (db && myIdentity && !seats[myId]) registerSeat();
}, 20000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && db && myIdentity && !seats[myId]) registerSeat();
});

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

    // 머리는 보는 사람 쪽으로 살짝 돌아본다 (동물 얼굴이 보이도록)
    if (u.head) {
      const dx = camera.position.x - c.position.x;
      const dz = camera.position.z - c.position.z;
      let want = Math.atan2(dx, dz) - c.rotation.y - u.body.rotation.y;
      while (want > Math.PI) want -= Math.PI * 2;
      while (want < -Math.PI) want += Math.PI * 2;
      want = Math.max(-0.8, Math.min(0.8, want));
      u.head.rotation.y += (want - u.head.rotation.y) * 0.055;
      u.head.rotation.x += ((-0.05 + Math.sin(t * 1.2 + u.phase) * 0.025) - u.head.rotation.x) * 0.05;
    }

    // 눈 깜빡임
    if (now > u.blinkAt) {
      const p = (now - u.blinkAt) / 150;
      const base = (e) => e.userData.baseY || 1.12;
      if (p < 1) u.eyes.forEach(e => { e.scale.y = base(e) * (1 - Math.sin(p * Math.PI) * 0.92); });
      else { u.eyes.forEach(e => { e.scale.y = base(e); }); u.blinkAt = now + rand(2600, 6200); }
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
        u.bubble.position.y = (u.bubbleY || 0.62) + Math.min(0.09, (8200 - left) * 0.00012);
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
    setView(currentView === 'me' ? 'room' : currentView);
  }, 120);
});

/* 콘솔 진단용 */
window.__council = {
  get chars() { return characters.size; },
  get seats() { return Object.keys(seats).length; },
  view: setView,
  identity: () => myIdentity
};
