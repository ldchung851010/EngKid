import * as THREE from 'three';
import './space-rescue.css';
import { TutorEngine } from './TutorEngine.js';
import { LearnerStore } from './LearnerStore.js';
import { SessionLogger } from './SessionLogger.js';
import type { ConceptId, MissionId, ScaffoldLevel } from './types.js';

type Stage = 'find-mars' | 'ask-robot' | 'find-battery' | 'prepare' | 'transfer' | 'complete';
type SupplyId = 'water' | 'pizza' | 'teddy bear' | 'flashlight' | 'phone' | 'jacket';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

interface InteractiveObject {
  id: string;
  root: THREE.Object3D;
  anchor: THREE.Vector3;
  enabled: boolean;
}

const tutor = new TutorEngine();
const learner = new LearnerStore();
const session = new SessionLogger();

const ui = {
  root: document.querySelector<HTMLDivElement>('#scene-root')!,
  missionKicker: document.querySelector<HTMLDivElement>('#mission-kicker')!,
  missionTitle: document.querySelector<HTMLDivElement>('#mission-title')!,
  missionInstruction: document.querySelector<HTMLDivElement>('#mission-instruction')!,
  progress: document.querySelector<HTMLDivElement>('#progress')!,
  status: document.querySelector<HTMLDivElement>('#status-pill')!,
  robotLine: document.querySelector<HTMLDivElement>('#robot-line')!,
  transcript: document.querySelector<HTMLDivElement>('#transcript')!,
  ptt: document.querySelector<HTMLButtonElement>('#ptt')!,
  hint: document.querySelector<HTMLButtonElement>('#hint-btn')!,
  typeToggle: document.querySelector<HTMLButtonElement>('#type-toggle')!,
  typeRow: document.querySelector<HTMLDivElement>('#type-row')!,
  textInput: document.querySelector<HTMLInputElement>('#text-input')!,
  send: document.querySelector<HTMLButtonElement>('#send-btn')!,
  hintCard: document.querySelector<HTMLDivElement>('#hint-card')!,
  parent: document.querySelector<HTMLButtonElement>('#parent-btn')!,
  parentModal: document.querySelector<HTMLDivElement>('#parent-modal')!,
  parentBody: document.querySelector<HTMLDivElement>('#parent-body')!,
  parentClose: document.querySelector<HTMLButtonElement>('#parent-close')!,
  export: document.querySelector<HTMLButtonElement>('#export-btn')!,
  reset: document.querySelector<HTMLButtonElement>('#reset-btn')!,
  completeModal: document.querySelector<HTMLDivElement>('#complete-modal')!,
  completeBody: document.querySelector<HTMLDivElement>('#complete-body')!,
  replay: document.querySelector<HTMLButtonElement>('#replay-btn')!,
  startScreen: document.querySelector<HTMLDivElement>('#start-screen')!,
  startButton: document.querySelector<HTMLButtonElement>('#start-btn')!,
  flash: document.querySelector<HTMLDivElement>('#flash')!,
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
ui.root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071126);
scene.fog = new THREE.Fog(0x071126, 19, 38);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 100);
camera.position.set(13.5, 13.5, 17.5);
camera.lookAt(0, 1.2, 0);

scene.add(new THREE.HemisphereLight(0xb7d9ff, 0x10152b, 1.45));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(8, 14, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);
const cyanLight = new THREE.PointLight(0x49d9ff, 24, 15, 2);
cyanLight.position.set(4.5, 4, -2.5);
scene.add(cyanLight);
const purpleLight = new THREE.PointLight(0x8d70ff, 18, 13, 2);
purpleLight.position.set(-4, 3, -3.5);
scene.add(purpleLight);

const world = new THREE.Group();
scene.add(world);
const interactive = new Map<string, InteractiveObject>();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const room = createRoom();
world.add(room);
const robot = createRobot();
robot.position.set(0, 0, -3.3);
world.add(robot);
registerInteractive('robot', robot, robot.position.clone());
const rocket = createRocket();
rocket.position.set(-4.6, 0, -3.2);
world.add(rocket);
registerInteractive('rocket', rocket, rocket.position.clone());
const controlPanel = createControlPanel();
controlPanel.position.set(4.3, 0, -2.7);
world.add(controlPanel);
registerInteractive('control-panel', controlPanel, controlPanel.position.clone());
const battery = createBattery();
battery.position.set(4.1, 0.5, -1.35);
battery.visible = false;
world.add(battery);
registerInteractive('battery', battery, battery.position.clone(), false);

const planets = new Map<string, THREE.Group>();
[
  ['earth', 0x4aa8ff, new THREE.Vector3(-3.6, 1.3, 1.0)],
  ['mars', 0xe85d4a, new THREE.Vector3(0, 1.3, 0.55)],
  ['jupiter', 0xd5a15c, new THREE.Vector3(3.6, 1.45, 1.0)],
].forEach(([name, color, pos]) => {
  const planet = createPlanet(Number(color), String(name));
  planet.position.copy(pos as THREE.Vector3);
  world.add(planet);
  planets.set(String(name), planet);
  registerInteractive(`planet:${String(name)}`, planet, planet.position.clone());
});

const supplyTable = createSupplyTable();
supplyTable.position.set(0, 0, 3.0);
world.add(supplyTable);
const supplies = new Map<SupplyId, THREE.Group>();
const supplySpec: Array<[SupplyId, number, THREE.Vector3, string]> = [
  ['water', 0x46b9ff, new THREE.Vector3(-2.5, 1.5, 2.45), '💧'],
  ['pizza', 0xffb44b, new THREE.Vector3(-1.5, 1.5, 3.5), '🍕'],
  ['teddy bear', 0xbd7a4f, new THREE.Vector3(-0.5, 1.5, 2.45), '🧸'],
  ['flashlight', 0xffed75, new THREE.Vector3(0.7, 1.5, 3.5), '🔦'],
  ['phone', 0x5d6d8d, new THREE.Vector3(1.7, 1.5, 2.45), '📱'],
  ['jacket', 0x7a8cff, new THREE.Vector3(2.7, 1.5, 3.5), '🧥'],
];
for (const [id, color, pos, emoji] of supplySpec) {
  const item = createSupplyItem(id, color, emoji);
  item.position.copy(pos);
  item.visible = false;
  world.add(item);
  supplies.set(id, item);
  registerInteractive(`supply:${id}`, item, item.position.clone(), false);
}

const player = createAstronaut();
player.position.set(0, 0, 6.0);
world.add(player);
let moveTarget: THREE.Vector3 | null = null;
let pendingInteraction: string | null = null;

let stage: Stage = 'find-mars';
let askStep = 0;
let currentSupply: SupplyId | null = null;
const selectedSupplies = new Set<SupplyId>();
const justifiedSupplies = new Set<SupplyId>();
const scaffold: Record<MissionId, ScaffoldLevel> = {
  'listen-explore': 0,
  'ask-robot': 0,
  'prepare-rocket': 0,
  transfer: 0,
};
const successStreak: Record<MissionId, number> = { 'listen-explore': 0, 'ask-robot': 0, 'prepare-rocket': 0, transfer: 0 };
const failureStreak: Record<MissionId, number> = { 'listen-explore': 0, 'ask-robot': 0, 'prepare-rocket': 0, transfer: 0 };
let recognition: SpeechRecognitionLike | null = null;
let recognitionResult = '';
let speechBusy = false;
let typingVisible = false;

setupSpeechRecognition();
setupUI();
setMissionUI('SPACE RESCUE', 'Ready for Launch?', 'Tap Start Mission, then listen to NOVA and explore the lab.', 0);
ui.robotLine.textContent = 'NOVA is ready when you are.';
setSpeechControls(false);
requestAnimationFrame(animate);

function createRoom(): THREE.Group {
  const group = new THREE.Group();
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x17284d, roughness: 0.75, metalness: 0.12 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.28, 12.5), floorMat);
  floor.position.set(0, -0.14, 0);
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x13254a, roughness: 0.7, metalness: 0.18 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(13.5, 5.2, 0.25), wallMat);
  back.position.set(0, 2.5, -6.05);
  group.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.2, 12.2), wallMat);
  left.position.set(-6.6, 2.5, 0);
  group.add(left);
  const right = left.clone();
  right.position.x = 6.6;
  group.add(right);

  const stripMat = new THREE.MeshBasicMaterial({ color: 0x42d9ff });
  for (const x of [-5.4, -2.7, 0, 2.7, 5.4]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.035, 0.035), stripMat);
    strip.position.set(x, 0.03, -5.86);
    group.add(strip);
  }

  const windowMat = new THREE.MeshBasicMaterial({ color: 0x050914 });
  const window = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.5), windowMat);
  window.position.set(0, 3.1, -5.91);
  group.add(window);
  const stars = new THREE.Group();
  for (let i = 0; i < 38; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.025 + Math.random() * 0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.position.set(-2.6 + Math.random() * 5.2, 2.05 + Math.random() * 2.1, -5.82);
    stars.add(dot);
  }
  group.add(stars);

  return group;
}

function createRobot(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xeaf7ff, roughness: 0.35, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17233b, roughness: 0.3, metalness: 0.6 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x53e2ff, emissive: 0x1e7896, emissiveIntensity: 1.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.58, 0.72, 6, 14), white);
  body.position.y = 1.0;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.65, 20, 16), white);
  head.scale.y = 0.78;
  head.position.y = 2.05;
  head.castShadow = true;
  g.add(head);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.3, 0.07), dark);
  face.position.set(0, 2.06, 0.57);
  g.add(face);
  for (const x of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), cyan);
    eye.position.set(x, 2.08, 0.63);
    g.add(eye);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8), dark);
  antenna.position.y = 2.72;
  g.add(antenna);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), cyan);
  tip.position.y = 2.98;
  g.add(tip);
  for (const x of [-0.72, 0.72]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.65, 4, 8), white);
    arm.position.set(x, 1.1, 0);
    arm.rotation.z = x > 0 ? -0.28 : 0.28;
    g.add(arm);
  }
  return g;
}

function createRocket(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.32, metalness: 0.4 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xff6573, roughness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x67d9ff, emissive: 0x164f6a, emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.92, 3.2, 20), bodyMat);
  body.position.y = 1.85;
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.35, 20), redMat);
  nose.position.y = 4.12;
  g.add(nose);
  const window = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), glassMat);
  window.rotation.x = Math.PI / 2;
  window.position.set(0, 2.45, 0.78);
  g.add(window);
  for (const x of [-0.85, 0.85]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.2, 0.18), redMat);
    fin.position.set(x, 0.75, 0);
    fin.rotation.z = x > 0 ? -0.22 : 0.22;
    g.add(fin);
  }
  return g;
}

function createControlPanel(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.8), new THREE.MeshStandardMaterial({ color: 0x243c72, roughness: 0.45, metalness: 0.38 }));
  base.position.y = 0.7;
  base.castShadow = true;
  g.add(base);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.72), new THREE.MeshBasicMaterial({ color: 0x36cfff }));
  screen.position.set(0, 1.28, 0.415);
  screen.rotation.x = -0.1;
  g.add(screen);
  for (let i = 0; i < 4; i++) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x72f1a6 : 0xffd166 }));
    light.position.set(-0.55 + i * 0.36, 0.66, 0.43);
    g.add(light);
  }
  return g;
}

function createBattery(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.45), new THREE.MeshStandardMaterial({ color: 0xffd85a, roughness: 0.38, metalness: 0.22, emissive: 0x5f4c08, emissiveIntensity: 0.5 }));
  shell.position.y = 0.46;
  shell.castShadow = true;
  g.add(shell);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), new THREE.MeshStandardMaterial({ color: 0xdde7ef, metalness: 0.8, roughness: 0.2 }));
  top.position.y = 0.98;
  g.add(top);
  return g;
}

function createPlanet(color: number, name: string): THREE.Group {
  const g = new THREE.Group();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(name === 'jupiter' ? 0.72 : 0.58, 24, 18), new THREE.MeshStandardMaterial({ color, roughness: 0.68, emissive: color, emissiveIntensity: 0.08 }));
  orb.castShadow = true;
  g.add(orb);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x263b69, roughness: 0.55, metalness: 0.35 }));
  stand.position.y = -0.75;
  g.add(stand);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.025, 8, 40), new THREE.MeshBasicMaterial({ color: 0x75e9ff, transparent: true, opacity: 0 }));
  halo.rotation.x = Math.PI / 2;
  g.add(halo);
  halo.userData.halo = true;
  return g;
}

function createSupplyTable(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x324d7c, roughness: 0.5, metalness: 0.32 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.2, 2.6), mat);
  top.position.y = 1.05;
  top.receiveShadow = true;
  g.add(top);
  for (const x of [-2.85, 2.85]) {
    for (const z of [-0.9, 0.9]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.05, 0.18), mat);
      leg.position.set(x, 0.5, z);
      g.add(leg);
    }
  }
  return g;
}

function createSupplyItem(id: SupplyId, color: number, emoji: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.12, emissive: color, emissiveIntensity: 0.05 }));
  body.castShadow = true;
  g.add(body);
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '82px Apple Color Emoji, Segoe UI Emoji, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 66);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
  sprite.position.y = 0.75; sprite.scale.set(0.72, 0.72, 1);
  g.add(sprite);
  g.userData.supplyId = id;
  return g;
}

function createAstronaut(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.5 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x5ccfff, roughness: 0.25, metalness: 0.25 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.52, 5, 10), white);
  body.position.y = 0.74; body.castShadow = true; g.add(body);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), white);
  helmet.position.y = 1.55; helmet.castShadow = true; g.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0.3, 1.3), blue);
  visor.position.set(0, 1.56, 0.25); visor.scale.z = 0.55; g.add(visor);
  return g;
}

function registerInteractive(id: string, root: THREE.Object3D, anchor: THREE.Vector3, enabled = true): void {
  root.traverse((obj) => { obj.userData.interactionId = id; });
  interactive.set(id, { id, root, anchor, enabled });
}

function setInteractive(id: string, enabled: boolean): void {
  const item = interactive.get(id);
  if (item) item.enabled = enabled;
}

function setObjectGlow(root: THREE.Object3D, active: boolean): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.emissiveIntensity = active ? Math.max(0.7, material.emissiveIntensity) : Math.min(0.12, material.emissiveIntensity);
      }
    }
    if (obj.userData.halo && obj.material instanceof THREE.MeshBasicMaterial) obj.material.opacity = active ? 0.95 : 0;
  });
}

function setupUI(): void {
  ui.parent.addEventListener('click', openParent);
  ui.parentClose.addEventListener('click', () => ui.parentModal.classList.remove('visible'));
  ui.export.addEventListener('click', exportSession);
  ui.reset.addEventListener('click', () => {
    learner.reset();
    showStatus('Learner progress reset.');
    renderParent();
  });
  ui.replay.addEventListener('click', () => location.reload());
  ui.startButton.addEventListener('click', () => {
    ui.startScreen.classList.remove('visible');
    startMissionOne();
  });
  ui.typeToggle.addEventListener('click', () => {
    typingVisible = !typingVisible;
    ui.typeRow.classList.toggle('visible', typingVisible);
    if (typingVisible) setTimeout(() => ui.textInput.focus(), 50);
  });
  ui.send.addEventListener('click', sendTyped);
  ui.textInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') sendTyped(); });
  ui.hint.addEventListener('click', () => requestHint());

  const startPTT = (event: Event) => { event.preventDefault(); void beginListening(); };
  const stopPTT = (event: Event) => { event.preventDefault(); endListening(); };
  ui.ptt.addEventListener('pointerdown', startPTT);
  ui.ptt.addEventListener('pointerup', stopPTT);
  ui.ptt.addEventListener('pointercancel', stopPTT);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !event.repeat && document.activeElement !== ui.textInput) {
      event.preventDefault(); void beginListening();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space' && document.activeElement !== ui.textInput) { event.preventDefault(); endListening(); }
  });

  renderer.domElement.addEventListener('pointerup', onWorldPointerUp);
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) recognition?.abort(); });

  document.querySelectorAll<HTMLButtonElement>('[data-rating]').forEach((button) => {
    button.addEventListener('click', () => {
      const rating = button.dataset.rating as 'loved' | 'okay' | 'hard';
      session.setRating(rating);
      document.querySelectorAll('[data-rating]').forEach((el) => el.classList.remove('selected'));
      button.classList.add('selected');
      renderParent();
    });
  });
}

function setupSpeechRecognition(): void {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) {
    ui.ptt.style.display = 'none';
    ui.typeToggle.textContent = '⌨️ Type answer';
    typingVisible = true;
    ui.typeRow.classList.add('visible');
    showStatus('Voice recognition is unavailable here — type answers instead.');
    return;
  }
  recognition = new Ctor();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const last = event.results[event.results.length - 1];
    recognitionResult = last?.[0]?.transcript?.trim() ?? '';
  };
  recognition.onerror = (event) => {
    speechBusy = false;
    ui.ptt.classList.remove('listening', 'processing');
    ui.ptt.textContent = '🎙️ Hold to speak';
    if (event.error !== 'aborted') showStatus('I could not hear that. Try again or type your answer.');
  };
  recognition.onend = () => {
    const result = recognitionResult;
    recognitionResult = '';
    speechBusy = false;
    ui.ptt.classList.remove('listening', 'processing');
    ui.ptt.textContent = '🎙️ Hold to speak';
    if (result) void handleSpeech(result);
  };
}

async function beginListening(): Promise<void> {
  if (!recognition || speechBusy || !canSpeakNow()) return;
  speechBusy = true;
  recognitionResult = '';
  ui.ptt.classList.add('listening');
  ui.ptt.textContent = '🔴 Listening…';
  ui.transcript.textContent = 'Speak in English…';
  try { recognition.start(); }
  catch {
    speechBusy = false;
    ui.ptt.classList.remove('listening');
  }
}

function endListening(): void {
  if (!recognition || !speechBusy) return;
  ui.ptt.classList.remove('listening');
  ui.ptt.classList.add('processing');
  ui.ptt.textContent = 'Thinking…';
  try { recognition.stop(); } catch { /* already stopped */ }
}

function sendTyped(): void {
  const text = ui.textInput.value.trim();
  if (!text || !canSpeakNow()) return;
  ui.textInput.value = '';
  void handleSpeech(text);
}

function canSpeakNow(): boolean {
  return stage === 'ask-robot' || (stage === 'prepare' && currentSupply !== null) || stage === 'transfer';
}

async function handleSpeech(text: string): Promise<void> {
  ui.transcript.textContent = `You: “${text}”`;
  hideHint();
  if (stage === 'ask-robot') {
    await handleAskRobot(text);
  } else if (stage === 'prepare' && currentSupply) {
    await handleSupplyReason(text, currentSupply);
  } else if (stage === 'transfer') {
    await handleTransfer(text);
  }
}

async function handleAskRobot(text: string): Promise<void> {
  const mission: MissionId = 'ask-robot';
  const analysis = tutor.analyze({ missionId: mission, transcript: text, scaffoldLevel: scaffold[mission] });
  const normalized = analysis.normalized;
  const isWhereQuestion = analysis.questionDetected && (normalized.includes('where') || normalized.includes('battery') || normalized.includes('it'));

  if (askStep === 0 && isWhereQuestion) {
    askStep = 1;
    adapt(mission, true);
    learner.recordSuccess(analysis.conceptsUsed.length ? analysis.conceptsUsed : ['wh_question'], scaffold[mission]);
    session.recordSpeech(mission, text, analysis.productionLevel, scaffold[mission], true);
    await say("Good question! It's near something blue. Ask me: is it near something you can see?");
    ui.robotLine.textContent = "It's near something blue. Ask another question.";
    setObjectGlow(controlPanel, scaffold[mission] <= 1);
    return;
  }

  if (askStep === 1 && analysis.questionDetected) {
    const asksPanel = normalized.includes('panel') || normalized.includes('screen') || normalized.includes('blue');
    const asksRocket = normalized.includes('rocket');
    session.recordSpeech(mission, text, analysis.productionLevel, scaffold[mission], true);
    learner.recordSuccess(analysis.conceptsUsed.length ? analysis.conceptsUsed : ['yes_no_question', 'prepositions'], scaffold[mission]);
    if (asksPanel) {
      adapt(mission, true);
      await say('Yes! It is near the blue control panel. Look — I found a signal!');
      ui.robotLine.textContent = 'Yes! The battery is near the blue control panel. Tap it!';
      revealBattery();
      return;
    }
    if (asksRocket) {
      adapt(mission, true);
      await say('No, not near the rocket. Try another place.');
      ui.robotLine.textContent = 'No, not near the rocket. Try another question.';
      return;
    }
    adapt(mission, true);
    await say('Not there. Ask about the blue control panel.');
    ui.robotLine.textContent = 'Not there. What blue object could you ask about?';
    return;
  }

  session.recordSpeech(mission, text, analysis.productionLevel, scaffold[mission], false);
  learner.recordFailure(askStep === 0 ? ['wh_question'] : ['yes_no_question', 'prepositions'], scaffold[mission]);
  adapt(mission, false);
  const decision = tutor.evaluate({ missionId: mission, transcript: text, scaffoldLevel: scaffold[mission] });
  showHint(decision.hint ?? 'Try asking a question.');
  await say(decision.reply);
  ui.robotLine.textContent = decision.reply;
}

function revealBattery(): void {
  stage = 'find-battery';
  battery.visible = true;
  setInteractive('battery', true);
  setObjectGlow(battery, true);
  setObjectGlow(controlPanel, true);
  setMissionUI('MISSION 2', 'Recover the Battery', 'Tap the glowing battery beside the blue control panel.', 1);
  session.log('world_interaction', 'ask-robot', { batteryRevealed: true });
  setSpeechControls(false);
}

async function handleSupplyReason(text: string, item: SupplyId): Promise<void> {
  const mission: MissionId = 'prepare-rocket';
  const decision = tutor.evaluate({ missionId: mission, transcript: text, scaffoldLevel: scaffold[mission], targetItem: item });
  session.recordSpeech(mission, text, decision.analysis.productionLevel, scaffold[mission], decision.success);

  if (!decision.success) {
    learner.recordFailure(['because', 'need'], scaffold[mission]);
    adapt(mission, false);
    const retry = tutor.evaluate({ missionId: mission, transcript: text, scaffoldLevel: scaffold[mission], targetItem: item });
    if (retry.hint) showHint(retry.hint);
    await say(retry.reply);
    ui.robotLine.textContent = retry.reply;
    return;
  }

  adapt(mission, true);
  const evidence: ConceptId[] = decision.analysis.conceptsUsed.length ? decision.analysis.conceptsUsed : ['need'];
  learner.recordSuccess(evidence, scaffold[mission]);
  justifiedSupplies.add(item);
  setObjectGlow(supplies.get(item)!, true);
  await say(decision.reply);
  flashSuccess();
  currentSupply = null;

  if (justifiedSupplies.size >= 3) {
    await delay(450);
    void startTransfer();
    return;
  }

  const left = 3 - justifiedSupplies.size;
  ui.robotLine.textContent = `${decision.reply} Choose ${left} more ${left === 1 ? 'thing' : 'things'} for Mars.`;
  setSpeechControls(false);
  setMissionUI('MISSION 3', 'Prepare the Rocket', `Choose ${left} more item${left === 1 ? '' : 's'}, then explain why.`, 2);
}

async function handleTransfer(text: string): Promise<void> {
  const mission: MissionId = 'transfer';
  const decision = tutor.evaluate({ missionId: mission, transcript: text, scaffoldLevel: scaffold[mission], transfer: true });
  session.recordSpeech(mission, text, decision.analysis.productionLevel, scaffold[mission], decision.success);
  if (!decision.success) {
    learner.recordFailure(['because', 'should', 'need'], scaffold[mission]);
    adapt(mission, false);
    const retry = tutor.evaluate({ missionId: mission, transcript: text, scaffoldLevel: scaffold[mission], transfer: true });
    if (retry.hint) showHint(retry.hint);
    await say(retry.reply);
    ui.robotLine.textContent = retry.reply;
    return;
  }

  adapt(mission, true);
  const used: ConceptId[] = decision.analysis.conceptsUsed.length ? decision.analysis.conceptsUsed : ['space_vocab'];
  learner.recordSuccess(used, scaffold[mission], true);
  session.completeTransfer();
  session.completeSession();
  stage = 'complete';
  setSpeechControls(false);
  await say(decision.reply);
  ui.robotLine.textContent = decision.reply;
  flashSuccess();
  showCompletion();
}

function adapt(mission: MissionId, success: boolean): void {
  if (success) {
    successStreak[mission] += 1;
    failureStreak[mission] = 0;
    if (successStreak[mission] >= 2 && scaffold[mission] > 0) {
      scaffold[mission] = (scaffold[mission] - 1) as ScaffoldLevel;
      successStreak[mission] = 0;
    }
  } else {
    failureStreak[mission] += 1;
    successStreak[mission] = 0;
    if (failureStreak[mission] >= 2 && scaffold[mission] < 4) {
      scaffold[mission] = (scaffold[mission] + 1) as ScaffoldLevel;
      failureStreak[mission] = 0;
    }
  }
}

function requestHint(): void {
  const mission = currentMission();
  if (!mission) return;
  if (scaffold[mission] < 4) scaffold[mission] = (scaffold[mission] + 1) as ScaffoldLevel;
  session.recordHint(mission, scaffold[mission]);
  const item = currentSupply ?? undefined;
  const decision = tutor.evaluate({ missionId: mission, transcript: '', scaffoldLevel: scaffold[mission], targetItem: item, transfer: mission === 'transfer' });
  const hint = decision.hint ?? decision.reply;
  showHint(hint);
  ui.robotLine.textContent = decision.reply;
  void say(decision.reply);
  if (mission === 'listen-explore') setObjectGlow(planets.get('mars')!, true);
  if (mission === 'ask-robot' && askStep === 1) setObjectGlow(controlPanel, true);
}

function currentMission(): MissionId | null {
  if (stage === 'find-mars') return 'listen-explore';
  if (stage === 'ask-robot' || stage === 'find-battery') return 'ask-robot';
  if (stage === 'prepare') return 'prepare-rocket';
  if (stage === 'transfer') return 'transfer';
  return null;
}

function startMissionOne(): void {
  stage = 'find-mars';
  session.log('mission_started', 'listen-explore');
  setMissionUI('MISSION 1', 'Listen & Explore', 'Listen to NOVA, then tap the correct planet.', 0);
  setSpeechControls(false);
  ui.robotLine.textContent = 'Emergency! The navigation system is offline. Find the red planet.';
  setPlanetVisibility(true);
  hideSupplies();
  void say('Emergency! The navigation system is offline. Find the red planet.');
}

async function completeMissionOne(): Promise<void> {
  session.log('mission_completed', 'listen-explore', { target: 'mars', success: true });
  learner.recordSuccess(['space_vocab'], 0);
  flashSuccess();
  setObjectGlow(planets.get('mars')!, true);
  await say('Yes! Mars is the red planet. Now we have another problem. Our rocket battery is missing. Ask me where it is.');
  setPlanetVisibility(false);
  stage = 'ask-robot';
  askStep = 0;
  session.log('mission_started', 'ask-robot');
  setMissionUI('MISSION 2', 'Ask the Robot', 'Use English questions to find the missing rocket battery.', 1);
  ui.robotLine.textContent = 'Our rocket battery is missing. Ask me where it is.';
  setSpeechControls(true);
}

async function startMissionThree(): Promise<void> {
  stage = 'prepare';
  session.log('mission_completed', 'ask-robot');
  session.log('mission_started', 'prepare-rocket');
  setObjectGlow(battery, false);
  battery.visible = false;
  setInteractive('battery', false);
  setObjectGlow(controlPanel, false);
  showSupplies();
  setMissionUI('MISSION 3', 'Prepare the Rocket', 'We can take only three things. Tap an item and explain why we need it.', 2);
  ui.robotLine.textContent = 'Great! The rocket works. But we can take only three things to Mars. What should we take?';
  setSpeechControls(false);
  await say('Great! The rocket works. But we can take only three things to Mars. What should we take? Tap one item.');
}

async function startTransfer(): Promise<void> {
  stage = 'transfer';
  currentSupply = null;
  session.log('mission_completed', 'prepare-rocket', { selected: [...selectedSupplies] });
  session.log('mission_started', 'transfer');
  setMissionUI('FINAL CHALLENGE', 'New Destination: The Moon', 'Use what you learned in a new situation.', 3);
  setSpeechControls(true);
  ui.robotLine.textContent = "Oh no! Navigation changed. We're going to the Moon instead. Would you take the same things? Why?";
  await say("Oh no! Navigation changed. We're going to the Moon instead. Would you take the same things? Why?");
}

function onWorldPointerUp(event: PointerEvent): void {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const roots = [...interactive.values()].filter((item) => item.enabled && item.root.visible).map((item) => item.root);
  const hits = raycaster.intersectObjects(roots, true);
  if (hits.length) {
    let obj: THREE.Object3D | null = hits[0].object;
    let id: string | undefined;
    while (obj) {
      id = obj.userData.interactionId as string | undefined;
      if (id) break;
      obj = obj.parent;
    }
    if (id && interactive.get(id)?.enabled) {
      walkToInteraction(id);
      return;
    }
  }

  const target = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(floorPlane, target)) {
    target.x = THREE.MathUtils.clamp(target.x, -5.8, 5.8);
    target.z = THREE.MathUtils.clamp(target.z, -5.2, 5.7);
    moveTarget = target;
    pendingInteraction = null;
  }
}

function walkToInteraction(id: string): void {
  const item = interactive.get(id);
  if (!item) return;
  const direction = player.position.clone().sub(item.anchor).setY(0);
  if (direction.lengthSq() < 0.01) direction.set(0, 0, 1);
  direction.normalize();
  moveTarget = item.anchor.clone().add(direction.multiplyScalar(1.25)).setY(0);
  pendingInteraction = id;
  showStatus('Moving…');
}

function processInteraction(id: string): void {
  session.log('world_interaction', currentMission() ?? undefined, { id });
  if (stage === 'find-mars' && id.startsWith('planet:')) {
    const planet = id.split(':')[1];
    if (planet === 'mars') {
      void completeMissionOne();
    } else {
      showStatus(`${capitalize(planet)} is not the red planet. Try again!`);
      ui.robotLine.textContent = `Not ${capitalize(planet)}. Look carefully for the red planet.`;
      setObjectGlow(planets.get(planet)!, true);
      setTimeout(() => setObjectGlow(planets.get(planet)!, false), 650);
    }
    return;
  }

  if (stage === 'find-battery' && id === 'battery') {
    flashSuccess();
    void say('You found the battery! Put it in the rocket.').then(() => startMissionThree());
    return;
  }

  if (stage === 'prepare' && id.startsWith('supply:')) {
    const item = id.slice('supply:'.length) as SupplyId;
    if (justifiedSupplies.has(item)) {
      showStatus(`${capitalize(item)} is already packed.`);
      return;
    }
    if (currentSupply && currentSupply !== item) {
      showStatus(`First explain why we need ${currentSupply}.`);
      return;
    }
    if (!selectedSupplies.has(item) && selectedSupplies.size >= 3) {
      showStatus('Only three things fit in the rocket.');
      return;
    }
    selectedSupplies.add(item);
    currentSupply = item;
    setObjectGlow(supplies.get(item)!, true);
    setSpeechControls(true);
    ui.robotLine.textContent = `You chose ${item}. Why should we take ${item}?`;
    void say(`You chose ${item}. Why should we take ${item}?`);
    return;
  }
}

function setPlanetVisibility(visible: boolean): void {
  for (const [name, planet] of planets) {
    planet.visible = visible;
    setInteractive(`planet:${name}`, visible);
    if (!visible) setObjectGlow(planet, false);
  }
}

function showSupplies(): void {
  supplyTable.visible = true;
  for (const [id, item] of supplies) {
    item.visible = true;
    setInteractive(`supply:${id}`, true);
  }
}

function hideSupplies(): void {
  supplyTable.visible = false;
  for (const [id, item] of supplies) {
    item.visible = false;
    setInteractive(`supply:${id}`, false);
  }
}

function setMissionUI(kicker: string, title: string, instruction: string, activeIndex: number): void {
  ui.missionKicker.textContent = kicker;
  ui.missionTitle.textContent = title;
  ui.missionInstruction.textContent = instruction;
  ui.progress.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement('span');
    dot.className = `progress-dot ${i < activeIndex ? 'done' : i === activeIndex ? 'active' : ''}`;
    ui.progress.appendChild(dot);
  }
}

function setSpeechControls(visible: boolean): void {
  ui.ptt.style.display = visible && recognition ? '' : 'none';
  ui.typeToggle.style.display = visible ? '' : 'none';
  ui.hint.style.display = visible || stage === 'find-mars' ? '' : 'none';
  if (!visible) {
    ui.typeRow.classList.remove('visible');
  } else if (typingVisible || !recognition) {
    ui.typeRow.classList.add('visible');
  }
}

function showHint(text: string): void {
  ui.hintCard.textContent = text;
  ui.hintCard.classList.add('visible');
}
function hideHint(): void { ui.hintCard.classList.remove('visible'); }

function showStatus(text: string): void {
  ui.status.textContent = text;
  ui.status.classList.add('visible');
  window.setTimeout(() => ui.status.classList.remove('visible'), 1800);
}

async function say(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.88;
  utterance.pitch = 1.08;
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find((voice) => /en-US/i.test(voice.lang) && /Samantha|Ava|Allison|Google US English|Microsoft/i.test(voice.name))
    ?? voices.find((voice) => /en-US/i.test(voice.lang))
    ?? voices.find((voice) => /^en/i.test(voice.lang));
  if (preferred) utterance.voice = preferred;
  await new Promise<void>((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);
  });
}

function openParent(): void {
  renderParent();
  ui.parentModal.classList.add('visible');
}

function renderParent(): void {
  const summary = session.snapshot;
  const state = learner.snapshot;
  const concepts = Object.values(state.concepts).sort((a, b) => b.mastery - a.mastery);
  const strong = concepts.filter((c) => c.mastery >= 0.45).slice(0, 4);
  const developing = concepts.filter((c) => c.mastery < 0.45 && (c.independentSuccesses + c.scaffoldedSuccesses + c.failures > 0)).slice(0, 4);
  const generativeRatio = summary.speakingTurns ? Math.round((summary.independentGenerated / summary.speakingTurns) * 100) : 0;
  ui.parentBody.innerHTML = `
    <div class="summary-grid">
      <div class="metric"><strong>${summary.speakingTurns}</strong><span>Speaking turns</span></div>
      <div class="metric"><strong>${summary.independentGenerated}</strong><span>Independent R3/R4</span></div>
      <div class="metric"><strong>${generativeRatio}%</strong><span>Independent generative ratio</span></div>
      <div class="metric"><strong>${summary.hintsUsed}</strong><span>Hints requested</span></div>
    </div>
    <h3>Concept evidence</h3>
    <div class="concept-list">
      ${strong.map((c) => `<div class="concept-row"><span>✓ ${prettyConcept(c.conceptId)}</span><strong>${Math.round(c.mastery * 100)}%</strong></div>`).join('') || '<div class="concept-row"><span>No strong concepts yet</span><span>—</span></div>'}
      ${developing.map((c) => `<div class="concept-row"><span>△ ${prettyConcept(c.conceptId)}</span><strong>${Math.round(c.mastery * 100)}%</strong></div>`).join('')}
      <div class="concept-row"><span>Transfer</span><strong>${summary.transferSuccess ? '✓' : '—'}</strong></div>
    </div>
    <p>No raw microphone recording is stored by EngKid. The prototype stores transcripts, scaffold level and learning evidence in this browser.</p>
  `;
}

function showCompletion(): void {
  const summary = session.snapshot;
  const ratio = summary.speakingTurns ? Math.round((summary.independentGenerated / summary.speakingTurns) * 100) : 0;
  ui.completeBody.innerHTML = `
    <p>You repaired the rocket, chose supplies and adapted your plan for the Moon.</p>
    <div class="summary-grid">
      <div class="metric"><strong>${summary.speakingTurns}</strong><span>Speaking turns</span></div>
      <div class="metric"><strong>${summary.independentGenerated}</strong><span>Generated independently</span></div>
      <div class="metric"><strong>${ratio}%</strong><span>Generative ratio</span></div>
      <div class="metric"><strong>✓</strong><span>Transfer challenge</span></div>
    </div>
  `;
  ui.completeModal.classList.add('visible');
}

function exportSession(): void {
  const payload = { session: session.snapshot, learner: learner.snapshot };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `engkid-space-rescue-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function flashSuccess(): void {
  ui.flash.classList.remove('go');
  void ui.flash.offsetWidth;
  ui.flash.classList.add('go');
}

function prettyConcept(id: ConceptId): string {
  return id.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
function capitalize(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
function delay(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }

function onResize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

let lastTime = performance.now();
function animate(now: number): void {
  const delta = Math.min(0.04, (now - lastTime) / 1000);
  lastTime = now;

  if (moveTarget) {
    const direction = moveTarget.clone().sub(player.position).setY(0);
    const distance = direction.length();
    if (distance < 0.08) {
      player.position.x = moveTarget.x;
      player.position.z = moveTarget.z;
      moveTarget = null;
      if (pendingInteraction) {
        const id = pendingInteraction;
        pendingInteraction = null;
        processInteraction(id);
      }
    } else {
      direction.normalize();
      player.position.addScaledVector(direction, Math.min(distance, delta * 4.2));
      player.rotation.y = Math.atan2(direction.x, direction.z);
      player.position.y = Math.abs(Math.sin(now * 0.012)) * 0.035;
    }
  } else {
    player.position.y *= 0.8;
  }

  robot.position.y = Math.sin(now * 0.0023) * 0.05;
  robot.rotation.y = Math.sin(now * 0.0009) * 0.08;
  rocket.rotation.y = Math.sin(now * 0.00035) * 0.04;
  battery.rotation.y += delta * 1.7;
  for (const planet of planets.values()) planet.rotation.y += delta * 0.22;
  for (const item of supplies.values()) if (item.visible) item.rotation.y += delta * 0.12;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
