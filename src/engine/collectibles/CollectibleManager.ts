import * as THREE from 'three';
import { addBox, createTextSprite, disposeObject3D } from '../renderer/ScenePrimitives.js';
import type { MapConfig, SceneConfig } from '../schema/SceneConfig.js';
import type { TTSEngine } from '../voice/TTSEngine.js';
import { playCollectSound } from './celebration-sound.js';
import { CollectOverlay } from './collect-overlay.js';

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface CollectiblePlacement {
  word: string;
  position: Vector3Like;
}

export interface ProximityCollectible {
  word: string;
  position: Vector3Like;
  collected?: boolean;
}

interface CollectibleMarker {
  word: string;
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  halo: THREE.Sprite;
  prompt: THREE.Sprite;
  position: Vector3Like;
  collected: boolean;
}

interface CollectedApiItem {
  word: string;
  sceneId: string;
  collectedAt: string;
}

export function computeCollectiblePlacements(config: SceneConfig): CollectiblePlacement[] {
  const overrides = new Map((config.collectibles ?? []).map((item) => [normalizeWord(item.word), item]));
  const words = uniqueWords([
    ...config.targetVocabulary,
    ...(config.collectibles ?? []).map((item) => item.word),
  ]);
  const candidates = findPlacementCandidates(config.map, config.npcs.map((npc) => npc.position));
  let candidateIndex = 0;

  return words.flatMap((word) => {
    const override = overrides.get(normalizeWord(word));
    if (override?.position) {
      return [{ word, position: override.position }];
    }

    const candidate = candidates[candidateIndex++];
    if (!candidate) {
      console.warn(`[collectibles] no valid placement for "${word}"`);
      return [];
    }
    return [{ word, position: candidate }];
  });
}

export function findPlacementCandidates(map: MapConfig, npcPositions: Vector3Like[]): Vector3Like[] {
  const floorLayer = map.layers.find((layer) => layer.y === 0);
  if (!floorLayer) return [];

  const center = { x: map.width / 2, z: map.depth / 2 };
  const candidates: Vector3Like[] = [];

  for (let z = 0; z < map.depth; z++) {
    const row = floorLayer.grid[z];
    if (!row) continue;
    for (let x = 0; x < map.width; x++) {
      if (row[x] !== 'FLOOR') continue;
      if (isBlockedAbove(map, x, z)) continue;
      const position = { x: x + 0.5, y: 0.75, z: z + 0.5 };
      if (npcPositions.some((npc) => horizontalDistance(position, { x: npc.x + 0.5, y: npc.y, z: npc.z + 0.5 }) <= 2)) {
        continue;
      }
      candidates.push(position);
    }
  }

  return candidates.sort((a, b) => {
    const da = Math.hypot(a.x - center.x, a.z - center.z);
    const db = Math.hypot(b.x - center.x, b.z - center.z);
    return da - db || a.z - b.z || a.x - b.x;
  });
}

export function isInRange(cameraPosition: Vector3Like, itemPosition: Vector3Like, radius = 2): boolean {
  return horizontalDistance(cameraPosition, itemPosition) <= radius;
}

export function getActiveCollectible<T extends ProximityCollectible>(
  items: T[],
  cameraPosition: Vector3Like,
  radius = 2
): T | null {
  let active: T | null = null;
  let activeDistance = Infinity;

  for (const item of items) {
    if (item.collected) continue;
    const distance = horizontalDistance(cameraPosition, item.position);
    if (distance <= radius && distance < activeDistance) {
      active = item;
      activeDistance = distance;
    }
  }

  return active;
}

export class CollectibleManager {
  private markers: CollectibleMarker[] = [];
  private activeMarker: CollectibleMarker | null = null;
  private overlay = new CollectOverlay();
  private isOverlayOpen = false;
  private cooldownUntil = 0;
  private keyHandler = (event: KeyboardEvent) => {
    if (event.code === 'KeyE') {
      void this.openActiveCollectible();
    }
  };

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private tts: TTSEngine,
    private sceneId: string,
    private config: SceneConfig
  ) {
    document.addEventListener('keydown', this.keyHandler);
  }

  async init(): Promise<void> {
    const collected = await this.fetchCollectedWords();
    const placements = computeCollectiblePlacements(this.config)
      .filter((placement) => !collected.has(normalizeWord(placement.word)));

    for (const placement of placements) {
      this.addMarker(placement);
    }
  }

  update(delta: number): void {
    const elapsed = performance.now() / 1000;
    for (const marker of this.markers) {
      marker.group.rotation.y += delta * 0.8;
      marker.group.position.y = marker.position.y + Math.sin(elapsed * 2.4 + marker.position.x) * 0.08;
      marker.halo.material.opacity = marker.halo.visible ? 0.45 + Math.sin(elapsed * 5) * 0.18 : 0;
    }
  }

  checkProximity(cameraPosition: Vector3Like): void {
    if (this.isOverlayOpen || Date.now() < this.cooldownUntil) return;

    this.activeMarker = getActiveCollectible(this.markers, cameraPosition, 2);
    for (const marker of this.markers) {
      const isActive = marker === this.activeMarker;
      marker.material.emissiveIntensity = isActive ? 0.65 : 0;
      marker.halo.visible = isActive;
      marker.prompt.visible = isActive;
    }
  }

  dispose(): void {
    document.removeEventListener('keydown', this.keyHandler);
    this.overlay.destroy();
    for (const marker of this.markers) {
      this.scene.remove(marker.group);
      disposeObject3D(marker.group);
    }
    this.markers = [];
    this.activeMarker = null;
  }

  private addMarker(placement: CollectiblePlacement): void {
    const group = new THREE.Group();
    group.position.set(placement.position.x, placement.position.y, placement.position.z);
    group.userData = {
      collectibleWord: placement.word,
      collectibleSceneId: this.sceneId,
      collected: false,
    };

    const material = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xffc300,
      emissiveIntensity: 0,
      roughness: 0.45,
      metalness: 0.05,
    });
    addBox(group, [0, 0, 0], [0.62, 0.62, 0.18], material);

    const halo = createHaloSprite();
    halo.position.set(0, 0.08, 0);
    halo.scale.set(1.7, 1.7, 1);
    halo.visible = false;
    group.add(halo);

    const prompt = createTextSprite('E', 96, 96, '#ffffff', 'bold 54px sans-serif');
    prompt.position.set(0, 1.0, 0);
    prompt.scale.set(0.58, 0.58, 1);
    prompt.visible = false;
    prompt.renderOrder = 1000;
    prompt.material.depthTest = false;
    prompt.material.depthWrite = false;
    group.add(prompt);

    this.scene.add(group);
    this.markers.push({
      word: placement.word,
      group,
      material,
      halo,
      prompt,
      position: placement.position,
      collected: false,
    });
  }

  private async openActiveCollectible(): Promise<void> {
    if (!this.activeMarker || this.isOverlayOpen || Date.now() < this.cooldownUntil) return;

    const marker = this.activeMarker;
    this.isOverlayOpen = true;
    document.exitPointerLock?.();
    this.overlay.show(marker.word, {
      onReplay: async () => {
        await this.speakWord(marker.word);
      },
      onConfirm: async () => {
        await this.confirmCollect(marker);
      },
      onClose: () => {
        this.isOverlayOpen = false;
      },
    });

    try {
      await this.speakWord(marker.word);
    } catch (error) {
      console.warn('[collectibles] word TTS failed', error);
    } finally {
      this.overlay.revealConfirm();
    }
  }

  private async confirmCollect(marker: CollectibleMarker): Promise<void> {
    const response = await fetch('/api/collectibles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: marker.word, sceneId: this.sceneId }),
    });
    if (!response.ok) {
      throw new Error(`Collectible save failed: ${response.status}`);
    }

    playCollectSound();
    this.overlay.markCollected();
    marker.collected = true;
    marker.group.userData.collected = true;
    this.scene.remove(marker.group);
    disposeObject3D(marker.group);
    this.markers = this.markers.filter((item) => item !== marker);
    this.activeMarker = null;
    this.cooldownUntil = Date.now() + 500;
    window.setTimeout(() => {
      this.overlay.hide();
      this.isOverlayOpen = false;
    }, 360);
  }

  private async speakWord(word: string): Promise<void> {
    await this.tts.speak(word, 'Kiki', 0.75);
  }

  private async fetchCollectedWords(): Promise<Set<string>> {
    try {
      const response = await fetch(`/api/collectibles?sceneId=${encodeURIComponent(this.sceneId)}`);
      if (!response.ok) throw new Error(`Collectibles fetch failed: ${response.status}`);
      const payload = await response.json() as { items?: CollectedApiItem[] };
      return new Set((payload.items ?? []).map((item) => normalizeWord(item.word)));
    } catch (error) {
      console.warn('[collectibles] failed to load collected words', error);
      return new Set();
    }
  }
}

function createHaloSprite(): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255, 232, 130, 0.95)');
  gradient.addColorStop(0.45, 'rgba(255, 209, 102, 0.45)');
  gradient.addColorStop(1, 'rgba(255, 209, 102, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  return new THREE.Sprite(material);
}

function uniqueWords(words: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    const normalized = normalizeWord(word);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(word.trim());
  }
  return result;
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function horizontalDistance(a: Vector3Like, b: Vector3Like): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function isBlockedAbove(map: MapConfig, x: number, z: number): boolean {
  return map.layers.some((layer) => {
    if (layer.y <= 0) return false;
    const cell = layer.grid[z]?.[x];
    return cell !== undefined && cell !== 'AIR';
  });
}
