import * as THREE from 'three';
import type { NPCConfig } from '../schema/SceneConfig.js';
import { addLocalBox } from './ScenePrimitives.js';

/** Create a MeshStandardMaterial with flatShading enabled for low-poly look */
function mat(color: number, opts?: { roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number }): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.6,
    metalness: opts?.metalness ?? 0,
    emissive: opts?.emissive,
    emissiveIntensity: opts?.emissiveIntensity,
    flatShading: true,
  });
}

export type FaceExpression = 'idle' | 'happy' | 'curious' | 'talking' | 'thinking';

export function createVoxelCharacter(npc: NPCConfig): THREE.Group {
  switch (npc.appearance) {
    case 'waiter_male_01':
      return createWaiterModel(npc);
    case 'airport_agent_male_01':
      return createAirportAgentModel(npc);
    case 'receptionist_female_01':
      return createReceptionistModel(npc);
    case 'teacher_female_01':
      return createTeacherModel(npc);
    case 'zookeeper_female_01':
      return createZookeeperModel(npc);
    default:
      return createDefaultCharacter(npc);
  }
}

/** Create a canvas-based face sprite with expression support */
function createFaceSprite(): { sprite: THREE.Sprite; canvas: HTMLCanvasElement } {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  material.depthTest = false;
  material.depthWrite = false;
  const sprite = new THREE.Sprite(material);
  sprite.raycast = () => {};
  sprite.scale.set(0.56, 0.56, 1);
  sprite.renderOrder = 999;

  // Draw default idle face immediately
  drawFaceExpression(canvas, 'idle');

  return { sprite, canvas };
}

/** Draw a face expression on the given canvas */
export function drawFaceExpression(canvas: HTMLCanvasElement, expression: FaceExpression): void {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  const cx = 64;
  const cy = 62;

  // Expression params
  const params: Record<FaceExpression, {
    eyeOpenY: number;
    eyeClosed: boolean;
    pupilDx: number;
    pupilDy: number;
    mouthType: 'smile' | 'open' | 'neutral' | 'bigsmile';
    mouthAmt: number;
    blushAlpha: number;
  }> = {
    idle:    { eyeOpenY: 8,  eyeClosed: false, pupilDx: 0,  pupilDy: 0, mouthType: 'smile',   mouthAmt: 0.3,  blushAlpha: 0.15 },
    happy:   { eyeOpenY: 5,  eyeClosed: false, pupilDx: 0,  pupilDy: 1, mouthType: 'bigsmile', mouthAmt: 0.55, blushAlpha: 0.35 },
    curious: { eyeOpenY: 10, eyeClosed: false, pupilDx: -2, pupilDy: -1, mouthType: 'open',    mouthAmt: 0.2,  blushAlpha: 0.1 },
    talking: { eyeOpenY: 8,  eyeClosed: false, pupilDx: 0,  pupilDy: 0, mouthType: 'open',    mouthAmt: 0.4,  blushAlpha: 0.2 },
    thinking:{ eyeOpenY: 6,  eyeClosed: false, pupilDx: 0,  pupilDy: -3, mouthType: 'neutral', mouthAmt: 0,    blushAlpha: 0.1 },
  };

  const p = params[expression];

  // Blush circles
  if (p.blushAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = p.blushAlpha;
    ctx.fillStyle = '#ff8a80';
    ctx.beginPath();
    ctx.ellipse(cx - 26, cy + 4, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 26, cy + 4, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Eyes
  const eyeY = cy - 6;
  const leftEyeX = cx - 18;
  const rightEyeX = cx + 18;

  if (p.eyeClosed) {
    // Happy closed eyes (arcs)
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY - 2, 10, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightEyeX, eyeY - 2, 10, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
  } else {
    // Open eyes (white + pupil)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(leftEyeX, eyeY, 9, p.eyeOpenY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rightEyeX, eyeY, 9, p.eyeOpenY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#3e2723';
    ctx.beginPath();
    ctx.arc(leftEyeX + p.pupilDx, eyeY + p.pupilDy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX + p.pupilDx, eyeY + p.pupilDy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(leftEyeX + p.pupilDx + 2, eyeY + p.pupilDy - 2.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX + p.pupilDx + 2, eyeY + p.pupilDy - 2.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth
  const mouthY = cy + 12;
  ctx.strokeStyle = '#e57373';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  switch (p.mouthType) {
    case 'bigsmile': {
      ctx.beginPath();
      ctx.arc(cx, mouthY - 2, 16, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
      // Inner mouth
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath();
      ctx.arc(cx, mouthY - 2, 8, Math.PI * 0.1, Math.PI * 0.9);
      ctx.fill();
      break;
    }
    case 'smile': {
      ctx.beginPath();
      ctx.arc(cx, mouthY - 4, 14, Math.PI * 0.08, Math.PI * 0.92);
      ctx.stroke();
      break;
    }
    case 'open': {
      // Open mouth (oval)
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, 8, 6 + p.mouthAmt * 10, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'neutral': {
      // Slight straight mouth
      ctx.beginPath();
      ctx.moveTo(cx - 10, mouthY - 2);
      ctx.lineTo(cx + 10, mouthY - 2);
      ctx.stroke();
      break;
    }
  }
}

function createWaiterModel(npc: NPCConfig): THREE.Group {
  const group = new THREE.Group();
  positionCharacter(group, npc);

  const skin = mat(0xffc7a3, { roughness: 0.7 });
  const hair = mat(0x3d2a1f, { roughness: 0.8 });
  const shirt = mat(0xffffff, { roughness: 0.55 });
  const apron = mat(0xff6f61, { roughness: 0.55 });
  const pants = mat(0x263238, { roughness: 0.7 });
  const shoes = mat(0x111111, { roughness: 0.5 });
  const black = mat(0x111111, { roughness: 0.6 });
  const tray = mat(0xcfd8dc, { roughness: 0.35, metalness: 0.2 });

  addLocalBox(group, [0, 0.34, 0], [0.22, 0.68, 0.22], pants);
  addLocalBox(group, [-0.16, 0.34, 0], [0.2, 0.68, 0.22], pants);
  addLocalBox(group, [0.08, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addLocalBox(group, [-0.2, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addLocalBox(group, [-0.04, 0.95, 0], [0.66, 0.78, 0.34], shirt);
  addLocalBox(group, [-0.04, 0.96, 0.18], [0.45, 0.62, 0.05], apron);
  addLocalBox(group, [-0.04, 1.22, 0.22], [0.12, 0.08, 0.04], black);
  addLocalBox(group, [-0.48, 0.98, 0], [0.18, 0.68, 0.18], skin);
  addLocalBox(group, [0.4, 0.98, 0], [0.18, 0.68, 0.18], skin);
  addLocalBox(group, [0.54, 0.88, 0.22], [0.5, 0.06, 0.32], tray);
  addLocalBox(group, [0.54, 0.95, 0.22], [0.18, 0.08, 0.18], mat(0xfff176, { roughness: 0.5 }));
  addLocalBox(group, [0, 1.55, 0], [0.52, 0.52, 0.52], skin);
  addLocalBox(group, [0, 1.84, 0], [0.58, 0.18, 0.58], hair);

  // Face sprite replaces static eye/mouth boxes
  const face = createFaceSprite();
  face.sprite.position.set(0, 1.55, 0.27);
  face.sprite.userData.isFace = true;
  group.add(face.sprite);
  group.userData.faceCanvas = face.canvas;

  return group;
}

function createDefaultCharacter(npc: NPCConfig): THREE.Group {
  const group = new THREE.Group();
  positionCharacter(group, npc);

  const skin = mat(0xffc7a3, { roughness: 0.7 });
  const shirt = mat(0x64b5f6, { roughness: 0.6 });
  const pants = mat(0x455a64, { roughness: 0.7 });
  const shoes = mat(0x111111, { roughness: 0.5 });
  const hair = mat(0x4e342e, { roughness: 0.75 });

  addLocalBox(group, [-0.14, 0.34, 0], [0.2, 0.68, 0.22], pants);
  addLocalBox(group, [0.14, 0.34, 0], [0.2, 0.68, 0.22], pants);
  addLocalBox(group, [-0.14, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addLocalBox(group, [0.14, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addLocalBox(group, [0, 0.95, 0], [0.64, 0.76, 0.34], shirt);
  addLocalBox(group, [-0.47, 0.98, 0], [0.18, 0.64, 0.18], skin);
  addLocalBox(group, [0.47, 0.98, 0], [0.18, 0.64, 0.18], skin);
  addLocalBox(group, [0, 1.55, 0], [0.52, 0.52, 0.52], skin);
  addLocalBox(group, [0, 1.84, 0], [0.58, 0.18, 0.58], hair);

  // Face sprite replaces static eye/mouth boxes
  const face = createFaceSprite();
  face.sprite.position.set(0, 1.55, 0.27);
  face.sprite.userData.isFace = true;
  group.add(face.sprite);
  group.userData.faceCanvas = face.canvas;

  return group;
}

// ── Airport Agent (male) ───────────────────────────────────
function createAirportAgentModel(npc: NPCConfig): THREE.Group {
  const group = new THREE.Group();
  positionCharacter(group, npc);

  const skin = mat(0xffc7a3, { roughness: 0.7 });
  const hair = mat(0x2c1810, { roughness: 0.8 });
  const blazer = mat(0x1a237e, { roughness: 0.45 });
  const shirtW = mat(0xf5f5f5, { roughness: 0.5 });
  const tie = mat(0xc62828, { roughness: 0.5 });
  const pantsN = mat(0x263238, { roughness: 0.7 });
  const shoesN = mat(0x1b1b1b, { roughness: 0.45, metalness: 0.1 });
  const badge = mat(0xffd54f, { roughness: 0.4, metalness: 0.3, emissive: 0x3e2700, emissiveIntensity: 0.2 });
  const cap = mat(0x1a237e, { roughness: 0.45 });

  // Legs + shoes
  addLocalBox(group, [-0.16, 0.34, 0], [0.2, 0.68, 0.22], pantsN);
  addLocalBox(group, [0.16, 0.34, 0], [0.2, 0.68, 0.22], pantsN);
  addLocalBox(group, [-0.16, 0.03, 0.08], [0.28, 0.12, 0.34], shoesN);
  addLocalBox(group, [0.16, 0.03, 0.08], [0.28, 0.12, 0.34], shoesN);
  // Torso (blazer over white shirt)
  addLocalBox(group, [0, 0.95, 0], [0.68, 0.78, 0.34], blazer);
  addLocalBox(group, [0, 0.95, 0.12], [0.36, 0.62, 0.06], shirtW);
  // Tie
  addLocalBox(group, [0, 1.16, 0.22], [0.1, 0.28, 0.04], tie);
  // Badge
  addLocalBox(group, [0.18, 1.28, 0.22], [0.12, 0.1, 0.03], badge);
  // Arms
  addLocalBox(group, [-0.50, 0.98, 0], [0.18, 0.68, 0.18], blazer);
  addLocalBox(group, [0.50, 0.98, 0], [0.18, 0.68, 0.18], blazer);
  // Head
  addLocalBox(group, [0, 1.55, 0], [0.52, 0.52, 0.52], skin);
  addLocalBox(group, [0, 1.84, 0], [0.58, 0.18, 0.58], hair);
  // Cap brim
  addLocalBox(group, [0, 1.83, 0.27], [0.7, 0.06, 0.16], cap);

  const face = createFaceSprite();
  face.sprite.position.set(0, 1.55, 0.27);
  face.sprite.userData.isFace = true;
  group.add(face.sprite);
  group.userData.faceCanvas = face.canvas;

  return group;
}

// ── Hotel Receptionist (female) ────────────────────────────
function createReceptionistModel(npc: NPCConfig): THREE.Group {
  const group = new THREE.Group();
  positionCharacter(group, npc);

  const skin = mat(0xffcc99, { roughness: 0.7 });
  const hair = mat(0xbf8f5a, { roughness: 0.8 });
  const blazerR = mat(0x37474f, { roughness: 0.45 });
  const blouse = mat(0xfff9e6, { roughness: 0.5 });
  const skirt = mat(0x37474f, { roughness: 0.5 });
  const heels = mat(0x263238, { roughness: 0.45, metalness: 0.1 });
  const nametag = mat(0xffffff, { roughness: 0.4 });

  // Legs/skirt + shoes
  addLocalBox(group, [0, 0.34, 0], [0.42, 0.56, 0.22], skirt);
  addLocalBox(group, [-0.14, 0.03, 0.08], [0.24, 0.1, 0.3], heels);
  addLocalBox(group, [0.14, 0.03, 0.08], [0.24, 0.1, 0.3], heels);
  // Torso
  addLocalBox(group, [0, 0.95, 0], [0.62, 0.74, 0.32], blazerR);
  addLocalBox(group, [0, 0.95, 0.1], [0.36, 0.58, 0.06], blouse);
  // Nametag
  addLocalBox(group, [0.16, 1.30, 0.2], [0.14, 0.08, 0.03], nametag);
  // Arms
  addLocalBox(group, [-0.47, 0.98, 0], [0.18, 0.66, 0.18], blazerR);
  addLocalBox(group, [0.47, 0.98, 0], [0.18, 0.66, 0.18], blazerR);
  // Head
  addLocalBox(group, [0, 1.53, 0], [0.5, 0.5, 0.5], skin);
  addLocalBox(group, [0, 1.78, 0], [0.58, 0.22, 0.58], hair);

  const face = createFaceSprite();
  face.sprite.position.set(0, 1.53, 0.26);
  face.sprite.userData.isFace = true;
  group.add(face.sprite);
  group.userData.faceCanvas = face.canvas;

  return group;
}

// ── Teacher (female) ───────────────────────────────────────
function createTeacherModel(npc: NPCConfig): THREE.Group {
  const group = new THREE.Group();
  positionCharacter(group, npc);

  const skin = mat(0xffcc99, { roughness: 0.7 });
  const hair = mat(0x5d4037, { roughness: 0.8 });
  const cardigan = mat(0x2e7d32, { roughness: 0.6 });
  const dress = mat(0xfff3e0, { roughness: 0.55 });
  const pantsG = mat(0x455a64, { roughness: 0.7 });
  const flats = mat(0x5d4037, { roughness: 0.55 });
  const glasses = mat(0x263238, { roughness: 0.35, metalness: 0.1 });
  const book = mat(0xef5350, { roughness: 0.6 });
  const bookPage = mat(0xfff8e1, { roughness: 0.55 });

  // Legs + shoes
  addLocalBox(group, [-0.14, 0.34, 0], [0.2, 0.66, 0.22], pantsG);
  addLocalBox(group, [0.14, 0.34, 0], [0.2, 0.66, 0.22], pantsG);
  addLocalBox(group, [-0.14, 0.03, 0.08], [0.26, 0.1, 0.3], flats);
  addLocalBox(group, [0.14, 0.03, 0.08], [0.26, 0.1, 0.3], flats);
  // Torso (cardigan over dress)
  addLocalBox(group, [0, 0.94, 0], [0.64, 0.76, 0.33], cardigan);
  addLocalBox(group, [0, 0.94, 0.08], [0.38, 0.6, 0.06], dress);
  // Arms
  addLocalBox(group, [-0.48, 0.98, 0], [0.18, 0.64, 0.18], cardigan);
  addLocalBox(group, [0.48, 0.98, 0], [0.18, 0.64, 0.18], cardigan);
  // Book in right arm area
  addLocalBox(group, [0.52, 0.98, -0.22], [0.24, 0.16, 0.18], book);
  addLocalBox(group, [0.52, 0.98, -0.18], [0.2, 0.12, 0.04], bookPage);
  // Head
  addLocalBox(group, [0, 1.53, 0], [0.5, 0.5, 0.5], skin);
  addLocalBox(group, [0, 1.78, 0.1], [0.14, 0.04, 0.36], glasses);
  addLocalBox(group, [0, 1.81, 0], [0.56, 0.2, 0.56], hair);

  const face = createFaceSprite();
  face.sprite.position.set(0, 1.53, 0.28);
  face.sprite.userData.isFace = true;
  group.add(face.sprite);
  group.userData.faceCanvas = face.canvas;

  return group;
}

// ── Zookeeper (female) ─────────────────────────────────────
function createZookeeperModel(npc: NPCConfig): THREE.Group {
  const group = new THREE.Group();
  positionCharacter(group, npc);

  const skin = mat(0xffcc99, { roughness: 0.7 });
  const hair = mat(0xffb74d, { roughness: 0.75 });
  const tee = mat(0x66bb6a, { roughness: 0.6 });
  const shorts = mat(0x8d6e63, { roughness: 0.7 });
  const boots = mat(0x5d4037, { roughness: 0.6 });
  const hat = mat(0xdfc47a, { roughness: 0.7 });
  const hatBand = mat(0x5d4037, { roughness: 0.65 });
  const khakiGreen = mat(0x9ccc65, { roughness: 0.65 });

  // Legs + boots
  addLocalBox(group, [-0.14, 0.34, 0], [0.2, 0.62, 0.22], shorts);
  addLocalBox(group, [0.14, 0.34, 0], [0.2, 0.62, 0.22], shorts);
  addLocalBox(group, [-0.14, 0.03, 0.08], [0.26, 0.16, 0.32], boots);
  addLocalBox(group, [0.14, 0.03, 0.08], [0.26, 0.16, 0.32], boots);
  // Torso (green t-shirt)
  addLocalBox(group, [0, 0.93, 0], [0.62, 0.72, 0.32], tee);
  addLocalBox(group, [0, 0.93, 0.15], [0.3, 0.28, 0.05], khakiGreen);
  // Arms (short sleeves)
  addLocalBox(group, [-0.47, 0.96, 0], [0.18, 0.56, 0.18], tee);
  addLocalBox(group, [0.47, 0.96, 0], [0.18, 0.56, 0.18], tee);
  // Feed bucket
  addLocalBox(group, [0.46, 0.86, -0.16], [0.2, 0.22, 0.2], mat(0x78909c, { roughness: 0.5, metalness: 0.2 }));
  // Head
  addLocalBox(group, [0, 1.53, 0], [0.5, 0.5, 0.5], skin);
  addLocalBox(group, [0, 1.78, 0], [0.54, 0.2, 0.54], hair);
  // Safari hat
  addLocalBox(group, [0, 1.88, 0], [0.66, 0.08, 0.6], hatBand);
  addLocalBox(group, [0, 1.96, 0], [0.6, 0.12, 0.54], hat);

  const face = createFaceSprite();
  face.sprite.position.set(0, 1.53, 0.26);
  face.sprite.userData.isFace = true;
  group.add(face.sprite);
  group.userData.faceCanvas = face.canvas;

  return group;
}

function positionCharacter(group: THREE.Group, npc: NPCConfig): void {
  group.position.set(npc.position.x + 0.5, npc.position.y + 1, npc.position.z + 0.5);
}
