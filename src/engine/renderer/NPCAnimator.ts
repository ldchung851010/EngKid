import * as THREE from 'three';
import { drawFaceExpression, type FaceExpression } from './CharacterFactory.js';

export interface NPCAnimState {
  baseY: number;
  bobPhase: number;
  currentExpression: FaceExpression;
  proximity: number;
}

const AWARENESS_RADIUS = 10;
const HAPPY_RADIUS = 3;
const CURIOUS_RADIUS = 6;

export class NPCAnimator {
  private states = new Map<string, NPCAnimState>();

  initState(npcId: string, baseY: number): void {
    this.states.set(npcId, {
      baseY,
      bobPhase: Math.random() * Math.PI * 2,
      currentExpression: 'idle',
      proximity: 0,
    });
  }

  clear(): void {
    this.states.clear();
  }

  animate(
    delta: number,
    npcMeshes: THREE.Group[],
    playerPosition: { x: number; y: number; z: number },
    activeNpcId: string | null,
    activeNodeId: string | null,
  ): void {
    const now = performance.now() * 0.001;

    for (const group of npcMeshes) {
      const npcId = group.userData.npcId as string;
      if (!npcId) continue;

      const state = this.states.get(npcId);
      if (!state) continue;

      const npcPos = group.position;
      const dx = playerPosition.x - npcPos.x;
      const dz = playerPosition.z - npcPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const awarenessFactor = Math.max(0, 1 - dist / AWARENESS_RADIUS);

      // Smooth proximity (for expression transitions)
      const targetProx = Math.max(0, 1 - dist / CURIOUS_RADIUS);
      state.proximity += (targetProx - state.proximity) * delta * 3;

      // Auto-face player
      if (dist < AWARENESS_RADIUS && dist > 0.1) {
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        group.rotation.y += diff * delta * 3.5;
      }

      // Idle bobbing
      const bobIntensity = 0.03 + awarenessFactor * 0.015;
      const bob = Math.sin(now * 1.8 + state.bobPhase) * bobIntensity;
      group.position.y = state.baseY + bob;

      // Look up/down toward camera
      if (awarenessFactor > 0.3) {
        const headTarget = group.children.find(
          (c) => c instanceof THREE.Sprite && c.userData.isFace,
        );
        if (headTarget) {
          const dy = playerPosition.y - (npcPos.y + 1.55);
          const targetPitch = Math.atan2(dy, dist) * 0.3;
          const currentPitch = (headTarget as THREE.Sprite).userData.facePitch ?? 0;
          const newPitch = currentPitch + (targetPitch - currentPitch) * delta * 2;
          (headTarget as THREE.Sprite).userData.facePitch = newPitch;
          (headTarget as THREE.Sprite).position.y = 1.55 + newPitch * 0.3;
        }
      }

      // Face expression
      const expression = this.getExpression(npcId, dist, activeNpcId, activeNodeId);
      if (expression !== state.currentExpression) {
        state.currentExpression = expression;
        const headMesh = group.children.find(
          (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.userData.isFace === true,
        );
        if (headMesh) {
          const canvas = headMesh.userData.faceCanvas as HTMLCanvasElement | undefined;
          const skinColor = headMesh.userData.skinColor as number | undefined;
          if (canvas && skinColor !== undefined) {
            drawFaceExpression(canvas, expression, skinColor);
            const tex = headMesh.userData.faceTexture as THREE.CanvasTexture | undefined;
            if (tex) tex.needsUpdate = true;
          }
        }
      }
    }
  }

  private getExpression(
    npcId: string,
    distance: number,
    activeNpcId: string | null,
    activeNodeId: string | null,
  ): FaceExpression {
    if (activeNpcId === npcId) {
      if (activeNodeId) return 'talking';
      return 'curious';
    }
    if (distance < HAPPY_RADIUS) return 'happy';
    if (distance < CURIOUS_RADIUS) return 'curious';
    return 'idle';
  }
}
