import * as THREE from 'three';
import { drawFaceExpression } from './CharacterFactory.js';

export interface PlayerLimbs {
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
}

export interface PlayerCharacter {
  group: THREE.Group;
  limbs: PlayerLimbs;
  faceCanvas: HTMLCanvasElement;
  faceTexture: THREE.CanvasTexture;
}

export function createPlayerCharacter(): PlayerCharacter {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccbc, roughness: 0.6, flatShading: true });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.6, flatShading: true });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7, flatShading: true });
  const shoesMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.5, flatShading: true });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8, flatShading: true });

  // Torso
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.72, 0.36), shirtMat);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);

  // Head with face texture (Minecraft-style)
  const SKIN_COLOR = 0xffccbc;
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 64;
  faceCanvas.height = 64;
  drawFaceExpression(faceCanvas, 'idle', SKIN_COLOR);
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.minFilter = THREE.NearestFilter;
  faceTex.magFilter = THREE.NearestFilter;
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.6, flatShading: true });
  const headSize = 0.5;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(headSize, headSize, headSize),
    [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat],
  );
  head.position.y = 1.6;
  head.castShadow = true;
  group.add(head);

  // Hair
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.56), hairMat);
  hair.position.y = 1.88;
  hair.castShadow = true;
  group.add(hair);

  // Legs (pivot at hip via Group)
  const legL = new THREE.Group();
  legL.position.set(-0.17, 0.55, 0);
  group.add(legL);
  const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.51, 0.22), pantsMat);
  legLMesh.position.y = -0.255;
  legLMesh.castShadow = true;
  legL.add(legLMesh);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.28), shoesMat);
  shoeL.position.set(0, -0.51, 0.03);
  legL.add(shoeL);

  const legR = new THREE.Group();
  legR.position.set(0.17, 0.55, 0);
  group.add(legR);
  const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.51, 0.22), pantsMat);
  legRMesh.position.y = -0.255;
  legRMesh.castShadow = true;
  legR.add(legRMesh);
  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.28), shoesMat);
  shoeR.position.set(0, -0.51, 0.03);
  legR.add(shoeR);

  // Arms (pivot at shoulder via Group)
  const armL = new THREE.Group();
  armL.position.set(-0.42, 1.32, 0);
  group.add(armL);
  const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.56, 0.2), skinMat);
  armLMesh.position.y = -0.28;
  armLMesh.castShadow = true;
  armL.add(armLMesh);

  const armR = new THREE.Group();
  armR.position.set(0.42, 1.32, 0);
  group.add(armR);
  const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.56, 0.2), skinMat);
  armRMesh.position.y = -0.28;
  armRMesh.castShadow = true;
  armR.add(armRMesh);

  return {
    group,
    limbs: { legL, legR, armL, armR },
    faceCanvas,
    faceTexture: faceTex,
  };
}

export function animatePlayerWalk(limbs: PlayerLimbs, isMoving: boolean, walkPhase: number): void {
  if (isMoving) {
    const legSwing = Math.sin(walkPhase) * 0.45;
    const armSwing = Math.sin(walkPhase) * 0.35;
    limbs.legL.rotation.x = legSwing;
    limbs.legR.rotation.x = -legSwing;
    limbs.armL.rotation.x = -armSwing;
    limbs.armR.rotation.x = armSwing;
  } else {
    limbs.legL.rotation.x = 0;
    limbs.legR.rotation.x = 0;
    limbs.armL.rotation.x = 0;
    limbs.armR.rotation.x = 0;
  }
}
