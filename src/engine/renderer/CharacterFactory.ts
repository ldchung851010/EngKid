import * as THREE from 'three';
import type { NPCConfig } from '../schema/SceneConfig.js';
import { addBox } from './ScenePrimitives.js';

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

// ── Minecraft-style face on head mesh ──────────────────────────

/**
 * Add a head mesh with face texture on the front face (+Z).
 * Other 5 faces use the skin-colored material.
 * Minecraft-style pixel art: blocky eyes, simple mouth, cute proportions.
 */
function addFaceHead(
  group: THREE.Group,
  yPos: number,
  size: number,
  skinColor: number,
): void {
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 64;
  faceCanvas.height = 64;

  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.minFilter = THREE.NearestFilter;
  faceTexture.magFilter = THREE.NearestFilter;

  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.7,
    flatShading: true,
  });

  const skinMat = mat(skinColor, { roughness: 0.7 });

  // BoxGeometry face order: +X, -X, +Y, -Y, +Z (front), -Z (back)
  const headGeo = new THREE.BoxGeometry(size, size, size);
  const head = new THREE.Mesh(headGeo, [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat]);
  head.position.set(0, yPos, 0);
  head.castShadow = true;
  group.add(head);

  // Store references for expression updates
  head.userData.isFace = true;
  head.userData.faceCanvas = faceCanvas;
  head.userData.faceTexture = faceTexture;
  head.userData.skinColor = skinColor;

  // Draw default idle face
  drawFaceExpression(faceCanvas, 'idle', skinColor);
}

/** Draw a Minecraft-style face expression on the given canvas (64x64) */
export function drawFaceExpression(canvas: HTMLCanvasElement, expression: FaceExpression, skinColor: number): void {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);

  // Fill entire canvas with skin color as base
  const r = (skinColor >> 16) & 0xff;
  const g = (skinColor >> 8) & 0xff;
  const b = skinColor & 0xff;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 64, 64);

  // ── Eyes ──
  // Eye area: rows 18-36, centered around x=20 and x=44
  const eyeY = 24;
  const leftEyeX = 20;
  const rightEyeX = 44;

  switch (expression) {
    case 'happy': {
      // Happy arc eyes (like ^_^)
      ctx.strokeStyle = '#2d1b0e';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY + 2, 5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightEyeX, eyeY + 2, 5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      break;
    }
    case 'thinking': {
      // Half-closed eyes looking up
      ctx.fillStyle = '#2d1b0e';
      ctx.fillRect(leftEyeX - 4, eyeY + 1, 8, 3);
      ctx.fillRect(rightEyeX - 4, eyeY + 1, 8, 3);
      break;
    }
    case 'idle':
    case 'curious':
    case 'talking':
    default: {
      // Open pixel eyes: 6x7 dark blocks with white highlight
      ctx.fillStyle = '#2d1b0e';
      ctx.fillRect(leftEyeX - 3, eyeY - 3, 6, 7);
      ctx.fillRect(rightEyeX - 3, eyeY - 3, 6, 7);

      // White pupils (looking slightly down for curious)
      const pupilOffset = expression === 'curious' ? 1 : -1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(leftEyeX - 1, eyeY + pupilOffset, 2, 2);
      ctx.fillRect(rightEyeX - 1, eyeY + pupilOffset, 2, 2);

      // Eye shine
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(leftEyeX + 1, eyeY - 2, 2, 2);
      ctx.fillRect(rightEyeX + 1, eyeY - 2, 2, 2);
      break;
    }
  }

  // ── Blush (rosy cheeks) ──
  const blushAlpha = expression === 'happy' ? 0.4 : expression === 'curious' ? 0.15 : 0.2;
  if (blushAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = blushAlpha;
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(leftEyeX - 9, eyeY + 5, 7, 4);
    ctx.fillRect(rightEyeX + 2, eyeY + 5, 7, 4);
    ctx.restore();
  }

  // ── Mouth ──
  const mouthY = 38;
  const mouthCX = 32;

  switch (expression) {
    case 'happy': {
      // Wide open smile
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(mouthCX - 6, mouthY, 12, 5);
      // Teeth
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mouthCX - 5, mouthY, 10, 2);
      break;
    }
    case 'talking': {
      // Open oval mouth
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(mouthCX - 4, mouthY - 1, 8, 6);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(mouthCX - 3, mouthY, 6, 4);
      break;
    }
    case 'curious': {
      // Small "o" mouth
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(mouthCX - 2, mouthY, 4, 4);
      break;
    }
    case 'thinking': {
      // Wavy line mouth
      ctx.fillStyle = '#2d1b0e';
      ctx.fillRect(mouthCX - 5, mouthY + 1, 4, 2);
      ctx.fillRect(mouthCX - 1, mouthY, 4, 2);
      ctx.fillRect(mouthCX + 3, mouthY + 1, 4, 2);
      break;
    }
    case 'idle':
    default: {
      // Simple smile line
      ctx.fillStyle = '#2d1b0e';
      ctx.fillRect(mouthCX - 5, mouthY, 10, 2);
      ctx.fillRect(mouthCX - 6, mouthY - 1, 2, 2);
      ctx.fillRect(mouthCX + 4, mouthY - 1, 2, 2);
      break;
    }
  }
}

// ── Character Models ────────────────────────────────────────────

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

  addBox(group, [0, 0.34, 0], [0.22, 0.68, 0.22], pants);
  addBox(group, [-0.16, 0.34, 0], [0.2, 0.68, 0.22], pants);
  addBox(group, [0.08, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addBox(group, [-0.2, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addBox(group, [-0.04, 0.95, 0], [0.66, 0.78, 0.34], shirt);
  addBox(group, [-0.04, 0.96, 0.18], [0.45, 0.62, 0.05], apron);
  addBox(group, [-0.04, 1.22, 0.22], [0.12, 0.08, 0.04], black);
  addBox(group, [-0.48, 0.98, 0], [0.18, 0.68, 0.18], skin);
  addBox(group, [0.4, 0.98, 0], [0.18, 0.68, 0.18], skin);
  addBox(group, [0.54, 0.88, 0.22], [0.5, 0.06, 0.32], tray);
  addBox(group, [0.54, 0.95, 0.22], [0.18, 0.08, 0.18], mat(0xfff176, { roughness: 0.5 }));

  // Head with face texture
  addFaceHead(group, 1.55, 0.52, 0xffc7a3);
  addBox(group, [0, 1.84, 0], [0.58, 0.18, 0.58], hair);

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

  addBox(group, [-0.14, 0.34, 0], [0.2, 0.68, 0.22], pants);
  addBox(group, [0.14, 0.34, 0], [0.2, 0.68, 0.22], pants);
  addBox(group, [-0.14, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addBox(group, [0.14, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addBox(group, [0, 0.95, 0], [0.64, 0.76, 0.34], shirt);
  addBox(group, [-0.47, 0.98, 0], [0.18, 0.64, 0.18], skin);
  addBox(group, [0.47, 0.98, 0], [0.18, 0.64, 0.18], skin);

  // Head with face texture
  addFaceHead(group, 1.55, 0.52, 0xffc7a3);
  addBox(group, [0, 1.84, 0], [0.58, 0.18, 0.58], hair);

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
  addBox(group, [-0.16, 0.34, 0], [0.2, 0.68, 0.22], pantsN);
  addBox(group, [0.16, 0.34, 0], [0.2, 0.68, 0.22], pantsN);
  addBox(group, [-0.16, 0.03, 0.08], [0.28, 0.12, 0.34], shoesN);
  addBox(group, [0.16, 0.03, 0.08], [0.28, 0.12, 0.34], shoesN);
  // Torso (blazer over white shirt)
  addBox(group, [0, 0.95, 0], [0.68, 0.78, 0.34], blazer);
  addBox(group, [0, 0.95, 0.12], [0.36, 0.62, 0.06], shirtW);
  // Tie
  addBox(group, [0, 1.16, 0.22], [0.1, 0.28, 0.04], tie);
  // Badge
  addBox(group, [0.18, 1.28, 0.22], [0.12, 0.1, 0.03], badge);
  // Arms
  addBox(group, [-0.50, 0.98, 0], [0.18, 0.68, 0.18], blazer);
  addBox(group, [0.50, 0.98, 0], [0.18, 0.68, 0.18], blazer);

  // Head with face texture
  addFaceHead(group, 1.55, 0.52, 0xffc7a3);
  addBox(group, [0, 1.84, 0], [0.58, 0.18, 0.58], hair);
  // Cap brim
  addBox(group, [0, 1.83, 0.27], [0.7, 0.06, 0.16], cap);

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
  addBox(group, [0, 0.34, 0], [0.42, 0.56, 0.22], skirt);
  addBox(group, [-0.14, 0.03, 0.08], [0.24, 0.1, 0.3], heels);
  addBox(group, [0.14, 0.03, 0.08], [0.24, 0.1, 0.3], heels);
  // Torso
  addBox(group, [0, 0.95, 0], [0.62, 0.74, 0.32], blazerR);
  addBox(group, [0, 0.95, 0.1], [0.36, 0.58, 0.06], blouse);
  // Nametag
  addBox(group, [0.16, 1.30, 0.2], [0.14, 0.08, 0.03], nametag);
  // Arms
  addBox(group, [-0.47, 0.98, 0], [0.18, 0.66, 0.18], blazerR);
  addBox(group, [0.47, 0.98, 0], [0.18, 0.66, 0.18], blazerR);

  // Head with face texture
  addFaceHead(group, 1.53, 0.5, 0xffcc99);
  addBox(group, [0, 1.78, 0], [0.58, 0.22, 0.58], hair);

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
  const book = mat(0xef5350, { roughness: 0.6 });
  const bookPage = mat(0xfff8e1, { roughness: 0.55 });

  // Legs + shoes
  addBox(group, [-0.14, 0.34, 0], [0.2, 0.66, 0.22], pantsG);
  addBox(group, [0.14, 0.34, 0], [0.2, 0.66, 0.22], pantsG);
  addBox(group, [-0.14, 0.03, 0.08], [0.26, 0.1, 0.3], flats);
  addBox(group, [0.14, 0.03, 0.08], [0.26, 0.1, 0.3], flats);
  // Torso (cardigan over dress)
  addBox(group, [0, 0.94, 0], [0.64, 0.76, 0.33], cardigan);
  addBox(group, [0, 0.94, 0.08], [0.38, 0.6, 0.06], dress);
  // Arms
  addBox(group, [-0.48, 0.98, 0], [0.18, 0.64, 0.18], cardigan);
  addBox(group, [0.48, 0.98, 0], [0.18, 0.64, 0.18], cardigan);
  // Book in right arm area
  addBox(group, [0.52, 0.98, -0.22], [0.24, 0.16, 0.18], book);
  addBox(group, [0.52, 0.98, -0.18], [0.2, 0.12, 0.04], bookPage);

  // Head with face texture
  addFaceHead(group, 1.53, 0.5, 0xffcc99);
  addBox(group, [0, 1.81, 0], [0.56, 0.2, 0.56], hair);

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
  addBox(group, [-0.14, 0.34, 0], [0.2, 0.62, 0.22], shorts);
  addBox(group, [0.14, 0.34, 0], [0.2, 0.62, 0.22], shorts);
  addBox(group, [-0.14, 0.03, 0.08], [0.26, 0.16, 0.32], boots);
  addBox(group, [0.14, 0.03, 0.08], [0.26, 0.16, 0.32], boots);
  // Torso (green t-shirt)
  addBox(group, [0, 0.93, 0], [0.62, 0.72, 0.32], tee);
  addBox(group, [0, 0.93, 0.15], [0.3, 0.28, 0.05], khakiGreen);
  // Arms (short sleeves)
  addBox(group, [-0.47, 0.96, 0], [0.18, 0.56, 0.18], tee);
  addBox(group, [0.47, 0.96, 0], [0.18, 0.56, 0.18], tee);
  // Feed bucket
  addBox(group, [0.46, 0.86, -0.16], [0.2, 0.22, 0.2], mat(0x78909c, { roughness: 0.5, metalness: 0.2 }));

  // Head with face texture
  addFaceHead(group, 1.53, 0.5, 0xffcc99);
  addBox(group, [0, 1.78, 0], [0.54, 0.2, 0.54], hair);
  // Safari hat
  addBox(group, [0, 1.88, 0], [0.66, 0.08, 0.6], hatBand);
  addBox(group, [0, 1.96, 0], [0.6, 0.12, 0.54], hat);

  return group;
}

function positionCharacter(group: THREE.Group, npc: NPCConfig): void {
  group.position.set(npc.position.x + 0.5, npc.position.y + 1, npc.position.z + 0.5);
}
