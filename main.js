import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const WORLD_SIZE = 72;
const PLAYER_SPEED = 11.5;
const SPRINT_SPEED = 19;
const AUTHOR_SPEED = 8.1;
const SHOT_SPEED = 28;
const SEALS_REQUIRED = 7;
const INITIAL_AUTHOR_COUNT = 3;
const FINAL_AUTHOR_COUNT = 7;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7fc6df);
scene.fog = new THREE.Fog(0x7fc6df, 34, 105);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(18, 25, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfeaff, 0x486c44, 1.7));

const world = new THREE.Group();
scene.add(world);

const moai = new THREE.Group();
scene.add(moai);

const author = new THREE.Group();
scene.add(author);
const escapeGate = new THREE.Group();
scene.add(escapeGate);

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  fire: false,
  lookLeft: false,
  lookRight: false,
};

let gameStarted = false;
let gameOver = false;
let victory = false;
let playerHealth = 100;
let authorHealth = 140;
let energy = 100;
let crystals = 0;
let fireCooldown = 0;
let authorFireCooldown = 1.4;
let authorTauntTimer = 0;
let screenShake = 0;
let escapeOpen = false;
let finalSwarmActive = false;
let panicTimer = 0;
let cameraYaw = Math.PI;
let cameraPitch = 0.46;
let cameraDistance = 10.5;
let pointerLookActive = false;
let lastPointerX = 0;
let lastPointerY = 0;
const mobileMove = {
  active: false,
  pointerId: null,
  originX: 0,
  originY: 0,
  x: 0,
  z: 0,
};
const playerVelocity = new THREE.Vector3();

const playerShots = [];
const authorShots = [];
const pickupCrystals = [];
const props = [];
const authors = [];
const safetyZones = [];

const hud = {
  current: document.getElementById('current-score-val'),
  today: document.getElementById('today-best-val'),
  label: document.querySelector('.score-label'),
  bestLabel: document.querySelector('.best-label'),
  hint: document.getElementById('ui-text'),
  start: document.getElementById('start-screen'),
  left: document.getElementById('btn-left'),
  right: document.getElementById('btn-right'),
  up: document.getElementById('btn-up'),
  down: document.getElementById('btn-down'),
  fire: document.getElementById('btn-fire'),
  mobileStick: document.getElementById('mobile-stick'),
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let userVoiceBuffer = null;
let bgmTimer = null;
let bgmStep = 0;
let bgmRunning = false;
let bgmGain = null;
const bgmBass = [55, 55, 65.41, 55, 73.42, 65.41, 49, 55];
const bgmLead = [220, 0, 246.94, 0, 261.63, 0, 196, 0, 174.61, 0, 196, 0, 246.94, 0, 220, 0];

fetch('./uservoice.m4a')
  .then((res) => res.arrayBuffer())
  .then((buffer) => audioCtx.decodeAudioData(buffer))
  .then((buffer) => {
    userVoiceBuffer = buffer;
  })
  .catch(() => {});

function createFallbackMoai() {
  const stone = new THREE.MeshStandardMaterial({
    color: 0x8f9690,
    roughness: 0.82,
    metalness: 0.12,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x252b2b, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.1, 1.1), stone);
  body.position.y = 1.25;
  body.castShadow = true;
  moai.add(body);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.72, 0.55), stone);
  nose.position.set(0, 1.47, -0.72);
  nose.castShadow = true;
  moai.add(nose);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.04), dark);
  eyeL.position.set(-0.32, 1.82, -0.58);
  moai.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.32;
  moai.add(eyeR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.45), stone);
  legL.position.set(-0.36, 0.35, 0);
  legL.castShadow = true;
  moai.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.36;
  moai.add(legR);
}

function loadMoaiModel() {
  createFallbackMoai();
  gltfLoader.load(
    './moai.glb',
    (gltf) => {
      while (moai.children.length) moai.remove(moai.children[0]);
      const model = gltf.scene;
      model.scale.setScalar(1.35);
      model.rotation.y = -Math.PI / 2;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      moai.add(model);
    },
    undefined,
    () => {}
  );
}

function createAuthor() {
  const texture = textureLoader.load('./user.png');
  const spriteMat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    roughness: 0.55,
  });
  const sprite = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 4.2), spriteMat);
  sprite.position.y = 2.1;
  sprite.castShadow = true;
  author.add(sprite);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xff5f45,
    emissive: 0x8a1200,
    emissiveIntensity: 0.7,
    roughness: 0.45,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.08, 8, 36), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  author.add(ring);

  authors.push(author);
  for (let i = 1; i < FINAL_AUTHOR_COUNT; i++) {
    const clone = author.clone(true);
    scene.add(clone);
    authors.push(clone);
  }
  authors.forEach((enemy, index) => {
    enemy.userData.ai = createAuthorBrain(index);
  });
  resetAuthorPositions();
}

function createAuthorBrain(index) {
  const roles = ['direct', 'leftFlank', 'rightFlank', 'ambush', 'gateCut', 'wideLeft', 'rearPush'];
  return {
    role: roles[index % roles.length],
    phase: index * 1.73,
    speedBias: THREE.MathUtils.lerp(-0.25, 0.65, (index % FINAL_AUTHOR_COUNT) / Math.max(1, FINAL_AUTHOR_COUNT - 1)),
    prediction: 0.25 + (index % 4) * 0.18,
    orbit: 5.5 + index * 1.15,
    active: index < INITIAL_AUTHOR_COUNT,
  };
}

function createWorld() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 170, 60, 60),
    new THREE.MeshStandardMaterial({ color: 0x5ea760, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);

  const grid = new THREE.GridHelper(160, 40, 0xd4f7b1, 0x7fbf72);
  grid.position.y = 0.02;
  grid.material.opacity = 0.18;
  grid.material.transparent = true;
  world.add(grid);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0xcabf94, roughness: 0.9 });
  const roadA = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 150), roadMat);
  roadA.receiveShadow = true;
  world.add(roadA);
  const roadB = new THREE.Mesh(new THREE.BoxGeometry(150, 0.045, 7), roadMat);
  roadB.receiveShadow = true;
  world.add(roadB);

  addLandmark(-24, -18, 0x50b6df, 'atelier');
  addLandmark(25, 18, 0xf0b84d, 'forge');
  addLandmark(-28, 25, 0x96d56a, 'garden');
  addLandmark(24, -26, 0xdf6d63, 'arena');
  addSafetyZone(-24, -18, 7.4);
  addSafetyZone(25, 18, 7.4);
  addSafetyZone(-28, 25, 7.4);
  createEscapeGate();

  for (let i = 0; i < 95; i++) {
    const x = THREE.MathUtils.randFloatSpread(WORLD_SIZE * 1.55);
    const z = THREE.MathUtils.randFloatSpread(WORLD_SIZE * 1.55);
    if (Math.abs(x) < 6 || Math.abs(z) < 6) continue;
    const height = THREE.MathUtils.randFloat(1.6, 6.5);
    const rock = new THREE.Mesh(
      new THREE.CylinderGeometry(THREE.MathUtils.randFloat(0.45, 1.1), THREE.MathUtils.randFloat(0.55, 1.25), height, 6),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08, 0.25, THREE.MathUtils.randFloat(0.45, 0.62)), roughness: 0.88 })
    );
    rock.position.set(x, height / 2, z);
    rock.rotation.y = Math.random() * Math.PI;
    rock.castShadow = true;
    rock.receiveShadow = true;
    world.add(rock);
    props.push(rock);
  }

  for (let i = 0; i < SEALS_REQUIRED; i++) {
    const angle = (i / SEALS_REQUIRED) * Math.PI * 2;
    const radius = 18 + Math.sin(i * 1.7) * 14;
    addCrystal(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
}

function addSafetyZone(x, z, radius) {
  const zone = {
    center: new THREE.Vector3(x, 0, z),
    radius,
  };
  safetyZones.push(zone);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x65ff9b,
    emissive: 0x1dc66a,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.28,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), ringMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, 0.08, z);
  world.add(disc);

  const border = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.08, 8, 80),
    new THREE.MeshStandardMaterial({ color: 0x9dffbf, emissive: 0x32ff8a, emissiveIntensity: 0.9, roughness: 0.25 })
  );
  border.rotation.x = Math.PI / 2;
  border.position.set(x, 0.16, z);
  world.add(border);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 3.2, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8ffe5, emissive: 0x48ff93, emissiveIntensity: 0.45 })
  );
  post.position.set(x, 1.6, z);
  post.castShadow = true;
  world.add(post);
}

function createEscapeGate() {
  escapeGate.position.set(0, 0, 58);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x323d42, roughness: 0.78, metalness: 0.12 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x77f4ff,
    emissive: 0x1edcff,
    emissiveIntensity: 0.35,
    roughness: 0.22,
  });

  const left = new THREE.Mesh(new THREE.BoxGeometry(1.3, 7.8, 1.3), pillarMat);
  left.position.set(-3.2, 3.9, 0);
  left.castShadow = true;
  escapeGate.add(left);

  const right = left.clone();
  right.position.x = 3.2;
  escapeGate.add(right);

  const top = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.2, 1.2), pillarMat);
  top.position.set(0, 7.5, 0);
  top.castShadow = true;
  escapeGate.add(top);

  const portal = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 6.2), glowMat);
  portal.position.set(0, 3.7, 0.04);
  portal.userData.portal = true;
  escapeGate.add(portal);

  const marker = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.08, 8, 42), glowMat);
  marker.rotation.x = Math.PI / 2;
  marker.position.y = 0.15;
  escapeGate.add(marker);
}

function addLandmark(x, z, color, type) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  world.add(group);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 4.5, 0.45, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.08 })
  );
  base.position.y = 0.22;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(1.25, 4.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xf4f1db, emissive: color, emissiveIntensity: 0.13, roughness: 0.5 })
  );
  spire.position.y = 2.5;
  spire.castShadow = true;
  group.add(spire);

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 18, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.4, roughness: 0.2 })
  );
  orb.position.y = 4.7;
  orb.userData.type = type;
  group.add(orb);
}

function addCrystal(x, z) {
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.72, 0),
    new THREE.MeshStandardMaterial({
      color: 0x9ff7ff,
      emissive: 0x2ce8ff,
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.2,
    })
  );
  crystal.position.set(x, 1.0, z);
  crystal.userData.baseY = crystal.position.y;
  crystal.castShadow = true;
  world.add(crystal);
  pickupCrystals.push(crystal);
}

function setHud() {
  if (hud.label) hud.label.textContent = 'SEALS';
  if (hud.bestLabel) hud.bestLabel.textContent = 'STAMINA';
  if (hud.current) hud.current.textContent = `${Math.min(crystals, SEALS_REQUIRED)}/${SEALS_REQUIRED}`;
  if (hud.today) hud.today.textContent = String(Math.max(0, Math.round(energy)));
  if (hud.hint) {
    const distance = getNearestAuthorDistance();
    const safeZone = getCurrentSafetyZone();
    const danger = safeZone ? 'セーフティゾーン' : distance < 10 ? '近い！逃げろ' : distance < 24 ? '作者が追跡中' : '気配は遠い';
    const goal = escapeOpen ? '作者7体！ゲートへ逃げ込め' : `青い封印石を${SEALS_REQUIRED}個集めろ`;
    hud.hint.textContent = `左ドラッグ: 移動  右ドラッグ: 視点  DASH: ダッシュ  作者 ${getActiveAuthors().length}体  距離 ${distance.toFixed(0)}m  ${danger}  ${goal}`;
  }
}

function getNearestAuthorDistance() {
  const active = getActiveAuthors();
  if (!active.length) return moai.position.distanceTo(author.position);
  return active.reduce((nearest, enemy) => Math.min(nearest, moai.position.distanceTo(enemy.position)), Infinity);
}

function getNearestAuthor() {
  let nearest = author;
  let nearestDistance = Infinity;
  getActiveAuthors().forEach((enemy) => {
    const distance = moai.position.distanceTo(enemy.position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = enemy;
    }
  });
  return nearest;
}

function getActiveAuthors() {
  return authors.filter((enemy) => enemy.userData.ai?.active);
}

function getCurrentSafetyZone() {
  return safetyZones.find((zone) => moai.position.distanceTo(zone.center) < zone.radius) || null;
}

function resetAuthorPositions() {
  const starts = [
    [0, -42],
    [-34, -28],
    [35, -18],
    [-55, 4],
    [52, 8],
    [-38, 48],
    [42, 50],
  ];
  authors.forEach((enemy, index) => {
    const [x, z] = starts[index] || [THREE.MathUtils.randFloatSpread(50), -42 - index * 6];
    enemy.position.set(x, 0, z);
    if (!enemy.userData.ai) enemy.userData.ai = createAuthorBrain(index);
    enemy.userData.ai.active = index < INITIAL_AUTHOR_COUNT;
    enemy.visible = enemy.userData.ai.active;
  });
}

function playUserVoice() {
  if (!userVoiceBuffer) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const source = audioCtx.createBufferSource();
  source.buffer = userVoiceBuffer;
  source.connect(audioCtx.destination);
  source.start(0);
}

function blip(frequency, duration = 0.08, volume = 0.08, type = 'square') {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playBgmTone(frequency, duration, volume, type = 'square', detune = 0) {
  if (!frequency || !bgmGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audioCtx.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(bgmGain);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration + 0.02);
}

function startBgm() {
  if (bgmRunning) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  bgmRunning = true;
  bgmStep = 0;
  if (!bgmGain) {
    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = 0.12;
    bgmGain.connect(audioCtx.destination);
  }
  scheduleBgmStep();
}

function stopBgm() {
  bgmRunning = false;
  if (bgmTimer) {
    clearTimeout(bgmTimer);
    bgmTimer = null;
  }
  if (bgmGain) {
    bgmGain.gain.cancelScheduledValues(audioCtx.currentTime);
    bgmGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.08);
  }
}

function scheduleBgmStep() {
  if (!bgmRunning) return;
  const distance = getNearestAuthorDistance();
  const danger = THREE.MathUtils.clamp((34 - distance) / 34, 0, 1);
  const swarm = finalSwarmActive ? 1 : 0;
  const interval = Math.max(105, 230 - danger * 68 - swarm * 54);
  const master = 0.075 + danger * 0.065 + swarm * 0.04;

  if (bgmGain) {
    bgmGain.gain.setTargetAtTime(master, audioCtx.currentTime, 0.08);
  }

  const bass = bgmBass[bgmStep % bgmBass.length];
  const lead = bgmLead[bgmStep % bgmLead.length];
  playBgmTone(bass, 0.18, 0.22, 'sawtooth', -8);

  if (bgmStep % 2 === 0) {
    playBgmTone(bass * 2, 0.055, 0.07 + danger * 0.03, 'square', 5);
  }
  if ((danger > 0.35 || swarm) && lead) {
    playBgmTone(lead * (swarm ? 1.5 : 1), 0.075, 0.06, 'triangle');
  }
  if (swarm && bgmStep % 4 === 1) {
    playBgmTone(880, 0.045, 0.05, 'square', 12);
  }

  bgmStep++;
  bgmTimer = setTimeout(scheduleBgmStep, interval);
}

function makeShot(owner, position, direction) {
  const isPlayer = owner === 'player';
  const shot = new THREE.Mesh(
    new THREE.SphereGeometry(isPlayer ? 0.24 : 0.32, 16, 10),
    new THREE.MeshStandardMaterial({
      color: isPlayer ? 0x77f4ff : 0xff5f45,
      emissive: isPlayer ? 0x20d7ff : 0xff2200,
      emissiveIntensity: 1.8,
      roughness: 0.25,
    })
  );
  shot.position.copy(position);
  shot.position.y += isPlayer ? 1.25 : 2.2;
  shot.userData.velocity = direction.clone().normalize().multiplyScalar(isPlayer ? SHOT_SPEED : 16);
  shot.userData.life = isPlayer ? 1.5 : 2.4;
  scene.add(shot);
  (isPlayer ? playerShots : authorShots).push(shot);
  blip(isPlayer ? 720 : 180, isPlayer ? 0.055 : 0.12, isPlayer ? 0.05 : 0.075, isPlayer ? 'square' : 'sawtooth');
}

function firePlayerShot() {
  if (fireCooldown > 0 || energy < 8 || gameOver) return;
  const direction = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), moai.rotation.y);
  makeShot('player', moai.position, direction);
  fireCooldown = 0.18;
  energy -= 8;
}

function movePlayer(dt) {
  const xInput = Number(keys.right) - Number(keys.left) + mobileMove.x;
  const zInput = Number(keys.forward) - Number(keys.backward) + mobileMove.z;
  const input = new THREE.Vector3(xInput, 0, zInput);
  const hasInput = input.lengthSq() > 0;

  if (hasInput) {
    input.normalize();
    const cameraForward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const cameraRight = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const moveDir = cameraForward.multiplyScalar(input.z).add(cameraRight.multiplyScalar(input.x)).normalize();
    const sprinting = keys.fire && energy > 3;
    const speed = sprinting ? SPRINT_SPEED : PLAYER_SPEED;

    playerVelocity.lerp(moveDir.multiplyScalar(speed), 1 - Math.pow(0.0003, dt));
    moai.position.addScaledVector(playerVelocity, dt);
    moai.rotation.y = THREE.MathUtils.lerp(moai.rotation.y, Math.atan2(moveDir.x, moveDir.z), 1 - Math.pow(0.0001, dt));
    moai.rotation.z = Math.sin(performance.now() * 0.018) * (sprinting ? 0.09 : 0.055);
    energy = THREE.MathUtils.clamp(energy + (sprinting ? -22 : 6) * dt, 0, 100);
  } else {
    playerVelocity.multiplyScalar(Math.pow(0.02, dt));
    moai.rotation.z *= 0.86;
    energy = Math.min(100, energy + 12 * dt);
  }

  moai.position.x = THREE.MathUtils.clamp(moai.position.x, -WORLD_SIZE, WORLD_SIZE);
  moai.position.z = THREE.MathUtils.clamp(moai.position.z, -WORLD_SIZE, WORLD_SIZE);
}

function updateAuthors(dt) {
  getActiveAuthors().forEach((enemy, index) => updateAuthor(dt, enemy, index));
}

function updateAuthor(dt, enemy = author, index = 0) {
  if (!enemy.userData.ai?.active) return;
  const safeZone = getCurrentSafetyZone();
  const targetPoint = getAuthorTarget(enemy, index);
  const toTarget = targetPoint.clone().sub(enemy.position);
  const toPlayer = moai.position.clone().sub(enemy.position);
  const distance = toPlayer.length();
  const direction = toTarget.lengthSq() > 0.001 ? toTarget.normalize() : new THREE.Vector3(0, 0, 1);
  const nearBoost = THREE.MathUtils.clamp((28 - distance) / 28, 0, 1);
  const sealBoost = crystals * 0.32;
  const brain = enemy.userData.ai;
  const speed = AUTHOR_SPEED + sealBoost + nearBoost * 2.4 + brain.speedBias;
  const wobble = Math.sin(performance.now() * 0.004 + brain.phase) * 0.34;
  let chaseDir = direction
    .clone()
    .add(new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(wobble))
    .add(getSeparationVector(enemy).multiplyScalar(0.72))
    .normalize();

  if (safeZone) {
    const fromZone = enemy.position.clone().sub(safeZone.center);
    const zoneDistance = fromZone.length();
    if (zoneDistance < safeZone.radius + 4.2) {
      chaseDir = fromZone.lengthSq() > 0.001 ? fromZone.normalize() : new THREE.Vector3(0, 0, -1);
      enemy.position.addScaledVector(chaseDir, (speed + 2.2) * dt);
    } else {
      const guardPoint = safeZone.center.clone().add(direction.clone().multiplyScalar(safeZone.radius + 5.3 + index * 0.55));
      const toGuard = guardPoint.sub(enemy.position);
      if (toGuard.lengthSq() > 0.2) {
        enemy.position.addScaledVector(toGuard.normalize(), speed * 0.45 * dt);
      }
    }
  } else {
    enemy.position.addScaledVector(chaseDir, speed * dt);
  }

  if (!safeZone && distance < 2.15) {
    playerHealth = 0;
    screenShake = 0.7;
    finishGame(false);
    return;
  }

  enemy.position.x = THREE.MathUtils.clamp(enemy.position.x, -WORLD_SIZE, WORLD_SIZE);
  enemy.position.z = THREE.MathUtils.clamp(enemy.position.z, -WORLD_SIZE, WORLD_SIZE);
  enemy.lookAt(camera.position.x, enemy.position.y + 2, camera.position.z);
  enemy.children.forEach((child, childIndex) => {
    child.rotation.z += childIndex === 1 ? dt * (1.5 + index * 0.22) : 0;
  });

  authorTauntTimer -= dt;
  if (index === 0 && authorTauntTimer <= 0 && distance < 22) {
    playUserVoice();
    authorTauntTimer = distance < 9 ? 3.8 : 6.5;
  }

  panicTimer = Math.max(panicTimer, !safeZone && distance < 12 ? 0.35 : 0);
}

function getAuthorTarget(enemy, activeIndex) {
  const brain = enemy.userData.ai || createAuthorBrain(activeIndex);
  const velocity = playerVelocity.lengthSq() > 0.1
    ? playerVelocity.clone().normalize()
    : new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const side = new THREE.Vector3(-velocity.z, 0, velocity.x);
  const predicted = moai.position.clone().add(velocity.clone().multiplyScalar(brain.prediction * 8));
  const pulse = Math.sin(performance.now() * 0.0017 + brain.phase) * 2.2;

  if (brain.role === 'leftFlank') {
    return predicted.add(side.multiplyScalar(brain.orbit + pulse));
  }
  if (brain.role === 'rightFlank') {
    return predicted.add(side.multiplyScalar(-brain.orbit + pulse));
  }
  if (brain.role === 'ambush') {
    return moai.position.clone().add(velocity.multiplyScalar(13 + pulse)).add(side.multiplyScalar(Math.sin(brain.phase) * 4));
  }
  if (brain.role === 'gateCut') {
    const toGate = escapeGate.position.clone().sub(moai.position).setY(0);
    const gateDir = toGate.lengthSq() > 0.1 ? toGate.normalize() : velocity;
    return moai.position.clone().add(gateDir.multiplyScalar(12)).add(side.multiplyScalar(pulse));
  }
  if (brain.role === 'wideLeft') {
    return predicted.add(side.multiplyScalar(16 + pulse)).add(velocity.clone().multiplyScalar(-4));
  }
  if (brain.role === 'rearPush') {
    return moai.position.clone().add(velocity.multiplyScalar(-7)).add(side.multiplyScalar(pulse * 0.8));
  }
  return predicted;
}

function getSeparationVector(enemy) {
  const repel = new THREE.Vector3();
  getActiveAuthors().forEach((other) => {
    if (other === enemy) return;
    const away = enemy.position.clone().sub(other.position);
    const distanceSq = away.lengthSq();
    if (distanceSq > 0.001 && distanceSq < 36) {
      repel.add(away.normalize().multiplyScalar((36 - distanceSq) / 36));
    }
  });
  return repel;
}

function updateShots(dt) {
  updateShotArray(playerShots, dt, (shot, index) => {
    if (shot.position.distanceTo(author.position) < 2.2) {
      authorHealth -= 8 + crystals * 0.5;
      screenShake = 0.18;
      removeShot(playerShots, index);
      blip(95, 0.13, 0.12, 'sawtooth');
      if (authorHealth <= 0) finishGame(true);
    }
  });

  updateShotArray(authorShots, dt, (shot, index) => {
    if (shot.position.distanceTo(moai.position) < 1.25) {
      playerHealth -= 11;
      screenShake = 0.25;
      removeShot(authorShots, index);
      if (playerHealth <= 0) finishGame(false);
    }
  });
}

function updateShotArray(shots, dt, hitCheck) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const shot = shots[i];
    shot.position.addScaledVector(shot.userData.velocity, dt);
    shot.userData.life -= dt;
    shot.scale.setScalar(1 + Math.sin(performance.now() * 0.03 + i) * 0.12);
    hitCheck(shot, i);
    if (!shots.includes(shot)) continue;
    if (shot.userData.life <= 0 || Math.abs(shot.position.x) > WORLD_SIZE + 15 || Math.abs(shot.position.z) > WORLD_SIZE + 15) {
      removeShot(shots, i);
    }
  }
}

function removeShot(shots, index) {
  const [shot] = shots.splice(index, 1);
  if (shot) scene.remove(shot);
}

function updatePickups(dt) {
  for (let i = pickupCrystals.length - 1; i >= 0; i--) {
    const crystal = pickupCrystals[i];
    crystal.rotation.y += dt * 2.7;
    crystal.position.y = crystal.userData.baseY + Math.sin(performance.now() * 0.003 + i) * 0.18;
    if (crystal.position.distanceTo(moai.position) < 1.8) {
      crystals++;
      energy = 100;
      playerHealth = Math.min(100, playerHealth + 9);
      world.remove(crystal);
      pickupCrystals.splice(i, 1);
      blip(980, 0.16, 0.1, 'triangle');
      if (crystals >= SEALS_REQUIRED && !escapeOpen) {
        escapeOpen = true;
        activateFinalSwarm();
        blip(1240, 0.35, 0.12, 'triangle');
      }
    }
  }

  const portal = escapeGate.children.find((child) => child.userData.portal);
  if (portal && portal.material) {
    portal.material.emissiveIntensity = escapeOpen ? 1.8 + Math.sin(performance.now() * 0.01) * 0.45 : 0.18;
    portal.material.opacity = escapeOpen ? 0.92 : 0.32;
    portal.material.transparent = true;
  }
  escapeGate.rotation.y = Math.sin(performance.now() * 0.001) * 0.08;

  if (escapeOpen && moai.position.distanceTo(escapeGate.position) < 4.7) {
    finishGame(true);
  }
}

function activateFinalSwarm() {
  finalSwarmActive = true;
  const spawnAngles = [0.1, 0.95, 1.85, 2.75, 3.65, 4.55, 5.45];
  authors.forEach((enemy, index) => {
    if (!enemy.userData.ai) enemy.userData.ai = createAuthorBrain(index);
    enemy.userData.ai.active = true;
    enemy.visible = true;
    if (index >= INITIAL_AUTHOR_COUNT) {
      const angle = spawnAngles[index] || (index / FINAL_AUTHOR_COUNT) * Math.PI * 2;
      const radius = 34 + index * 1.8;
      const x = THREE.MathUtils.clamp(moai.position.x + Math.cos(angle) * radius, -WORLD_SIZE + 6, WORLD_SIZE - 6);
      const z = THREE.MathUtils.clamp(moai.position.z + Math.sin(angle) * radius, -WORLD_SIZE + 6, WORLD_SIZE - 6);
      enemy.position.set(x, 0, z);
    }
  });
  screenShake = 0.55;
  playUserVoice();
  blip(110, 0.22, 0.16, 'sawtooth');
  setTimeout(() => blip(92, 0.22, 0.16, 'sawtooth'), 180);
  setTimeout(() => blip(73, 0.32, 0.18, 'sawtooth'), 360);
}

function updateCamera(dt) {
  const desiredDistance = THREE.MathUtils.lerp(cameraDistance, keys.fire && energy > 3 ? 12.5 : 10.5, 1 - Math.pow(0.001, dt));
  cameraDistance = desiredDistance;
  const horizontal = Math.cos(cameraPitch) * desiredDistance;
  const desired = moai.position.clone().add(new THREE.Vector3(
    Math.sin(cameraYaw) * horizontal,
    2.2 + Math.sin(cameraPitch) * desiredDistance,
    Math.cos(cameraYaw) * horizontal
  ));

  if (screenShake > 0) {
    desired.x += THREE.MathUtils.randFloatSpread(screenShake);
    desired.y += THREE.MathUtils.randFloatSpread(screenShake);
    screenShake = Math.max(0, screenShake - dt);
  }
  camera.position.lerp(desired, 1 - Math.pow(0.00005, dt));
  const nearestAuthor = getNearestAuthor();
  const authorDistance = moai.position.distanceTo(nearestAuthor.position);
  const lookBlend = THREE.MathUtils.clamp((24 - authorDistance) / 44, 0, 0.28);
  const lookTarget = moai.position.clone().lerp(nearestAuthor.position, lookBlend).add(new THREE.Vector3(0, 1.85, 0));
  camera.lookAt(lookTarget);
}

function finishGame(won) {
  if (gameOver) return;
  gameOver = true;
  victory = won;
  stopBgm();
  if (window.logScore) window.logScore(Math.round(won ? 1000 + energy * 3 + crystals * 80 : crystals * 80));
  const title = won ? '脱出成功！' : '作者につかまった';
  const body = won
    ? '封印石を集めきり、ゲートから逃げ切った。もう一度タップで再挑戦。'
    : '足音が近い時は視点を回して進路を作り、SPACE/SHIFTでダッシュ。タップで再挑戦。';
  hud.start.style.display = 'flex';
  hud.start.style.opacity = '1';
  hud.start.innerHTML = `
    <div class="start-card open-world-card">
      <h1>${title}</h1>
      <p class="tap-msg">${body}</p>
      <div class="mission-readout">
        <span>封印石 ${Math.min(crystals, SEALS_REQUIRED)}/${SEALS_REQUIRED}</span>
        <span>スタミナ ${Math.max(0, Math.round(energy))}</span>
      </div>
      <button class="start-button" type="button">RESTART</button>
    </div>
  `;
}

function resetGame() {
  gameStarted = true;
  gameOver = false;
  victory = false;
  playerHealth = 100;
  authorHealth = 140;
  energy = 100;
  crystals = 0;
  escapeOpen = false;
  finalSwarmActive = false;
  panicTimer = 0;
  fireCooldown = 0;
  authorFireCooldown = 1.0;
  authorTauntTimer = 1.4;
  screenShake = 0;
  cameraYaw = Math.PI;
  cameraPitch = 0.46;
  cameraDistance = 10.5;
  playerVelocity.set(0, 0, 0);
  stopMobileMove();

  playerShots.splice(0).forEach((shot) => scene.remove(shot));
  authorShots.splice(0).forEach((shot) => scene.remove(shot));
  pickupCrystals.splice(0).forEach((crystal) => world.remove(crystal));

  moai.position.set(0, 0, 28);
  moai.rotation.set(0, 0, 0);
  resetAuthorPositions();

  for (let i = 0; i < SEALS_REQUIRED; i++) {
    const angle = (i / SEALS_REQUIRED) * Math.PI * 2;
    const radius = 18 + Math.sin(i * 1.7) * 14;
    addCrystal(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  if (hud.start) hud.start.style.display = 'none';
  if (window.logPlayerStart) window.logPlayerStart();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  startBgm();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);

  if (gameStarted && !gameOver) {
    fireCooldown = Math.max(0, fireCooldown - dt);
    cameraYaw += (Number(keys.lookLeft) - Number(keys.lookRight)) * 2.8 * dt;
    panicTimer = Math.max(0, panicTimer - dt);
    movePlayer(dt);
    updateAuthors(dt);
    updateShots(dt);
    updatePickups(dt);
  }

  props.forEach((prop, i) => {
    if (i % 13 === 0) prop.rotation.y += dt * 0.08;
  });

  updateCamera(dt);
  setHud();
  renderer.render(scene, camera);
}

function bindKey(code, pressed) {
  if (code === 'KeyW' || code === 'ArrowUp') keys.forward = pressed;
  if (code === 'KeyS' || code === 'ArrowDown') keys.backward = pressed;
  if (code === 'KeyA' || code === 'ArrowLeft') keys.left = pressed;
  if (code === 'KeyD' || code === 'ArrowRight') keys.right = pressed;
  if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyJ' || code === 'KeyK') keys.fire = pressed;
  if (code === 'KeyQ') keys.lookLeft = pressed;
  if (code === 'KeyE') keys.lookRight = pressed;
}

window.addEventListener('keydown', (event) => {
  bindKey(event.code, true);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  bindKey(event.code, false);
});

function isTouchUiTarget(event) {
  return Boolean(event.target.closest?.('#controls, #start-screen, #name-input-overlay, button'));
}

function updateMobileStickVisual(clientX, clientY) {
  if (!hud.mobileStick) return;
  const dx = mobileMove.x * 30;
  const dy = -mobileMove.z * 30;
  hud.mobileStick.style.display = mobileMove.active ? 'block' : 'none';
  hud.mobileStick.style.left = `${mobileMove.originX}px`;
  hud.mobileStick.style.top = `${mobileMove.originY}px`;
  hud.mobileStick.style.setProperty('--stick-x', `${dx}px`);
  hud.mobileStick.style.setProperty('--stick-y', `${dy}px`);
}

function stopMobileMove() {
  mobileMove.active = false;
  mobileMove.pointerId = null;
  mobileMove.x = 0;
  mobileMove.z = 0;
  if (hud.mobileStick) hud.mobileStick.style.display = 'none';
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (isTouchUiTarget(event) || !gameStarted || gameOver) return;
  event.preventDefault();
  renderer.domElement.setPointerCapture?.(event.pointerId);

  if (event.clientX < window.innerWidth * 0.48 && !mobileMove.active) {
    mobileMove.active = true;
    mobileMove.pointerId = event.pointerId;
    mobileMove.originX = event.clientX;
    mobileMove.originY = event.clientY;
    updateMobileStickVisual(event.clientX, event.clientY);
    return;
  }

  pointerLookActive = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (mobileMove.active && event.pointerId === mobileMove.pointerId) {
    event.preventDefault();
    const dx = THREE.MathUtils.clamp(event.clientX - mobileMove.originX, -52, 52);
    const dy = THREE.MathUtils.clamp(event.clientY - mobileMove.originY, -52, 52);
    mobileMove.x = Math.abs(dx) < 6 ? 0 : dx / 52;
    mobileMove.z = Math.abs(dy) < 6 ? 0 : -dy / 52;
    const len = Math.hypot(mobileMove.x, mobileMove.z);
    if (len > 1) {
      mobileMove.x /= len;
      mobileMove.z /= len;
    }
    updateMobileStickVisual(event.clientX, event.clientY);
    return;
  }

  if (!pointerLookActive) return;
  event.preventDefault();
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  cameraYaw -= dx * 0.006;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + dy * 0.0035, 0.18, 0.82);
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (event.pointerId === mobileMove.pointerId) stopMobileMove();
  pointerLookActive = false;
  renderer.domElement.releasePointerCapture?.(event.pointerId);
});

renderer.domElement.addEventListener('pointercancel', (event) => {
  if (event.pointerId === mobileMove.pointerId) stopMobileMove();
  pointerLookActive = false;
});

function setupTouchButton(button, keyName) {
  if (!button) return;
  const start = (event) => {
    event.preventDefault();
    keys[keyName] = true;
  };
  const end = (event) => {
    event.preventDefault();
    keys[keyName] = false;
  };
  button.addEventListener('touchstart', start, { passive: false });
  button.addEventListener('touchend', end, { passive: false });
  button.addEventListener('touchcancel', end, { passive: false });
  button.addEventListener('mousedown', start);
  button.addEventListener('mouseup', end);
  button.addEventListener('mouseleave', end);
}

setupTouchButton(hud.left, 'left');
setupTouchButton(hud.right, 'right');
setupTouchButton(hud.up, 'forward');
setupTouchButton(hud.down, 'backward');
setupTouchButton(hud.fire, 'fire');

if (hud.start) {
  hud.start.addEventListener('click', resetGame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

loadMoaiModel();
createAuthor();
createWorld();
moai.position.set(0, 0, 28);
moai.rotation.y = 0;
resetAuthorPositions();
updateCamera(1);
setHud();
animate();
