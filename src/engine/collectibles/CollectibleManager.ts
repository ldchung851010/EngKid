import * as THREE from 'three';
import { addBox, addLocalBox, createTextSprite, disposeObject3D } from '../renderer/ScenePrimitives.js';
import type { MapConfig, SceneConfig } from '../schema/SceneConfig.js';
import type { TTSEngine } from '../voice/TTSEngine.js';
import { SpeechPipeline } from '../voice/SpeechPipeline.js';
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
  rotationY?: number;
  anchored?: boolean;
}

export interface ProximityCollectible {
  word: string;
  position: Vector3Like;
  collected?: boolean;
}

interface CollectibleMarker {
  word: string;
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  halo: THREE.Sprite;
  position: Vector3Like;
  anchored: boolean;
  collected: boolean;
}

interface CollectedApiItem {
  word: string;
  sceneId: string;
  collectedAt: string;
}

const COLLECTIBLE_NPC_CLEARANCE = 3.25;

export function computeCollectiblePlacements(config: SceneConfig): CollectiblePlacement[] {
  const overrides = new Map((config.collectibles ?? []).map((item) => [normalizeWord(item.word), item]));
  const words = uniqueWords([
    ...config.targetVocabulary,
    ...(config.collectibles ?? []).map((item) => item.word),
  ]);
  const sceneAnchors = getSceneAnchoredPlacements(config.name);
  const candidates = findPlacementCandidates(config.map, config.npcs.map((npc) => npc.position));
  let candidateIndex = 0;

  return words.flatMap((word) => {
    const normalizedWord = normalizeWord(word);
    const override = overrides.get(normalizedWord);
    if (override?.position) {
      return [{ word, position: override.position, anchored: true }];
    }

    const sceneAnchor = sceneAnchors[normalizedWord];
    if (sceneAnchor) {
      return [{ word, ...sceneAnchor, anchored: true }];
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
      if (npcPositions.some((npc) => horizontalDistance(position, { x: npc.x + 0.5, y: npc.y, z: npc.z + 0.5 }) <= COLLECTIBLE_NPC_CLEARANCE)) {
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

export function doesTranscriptMatchWord(transcript: string | null | undefined, word: string): boolean {
  return normalizeSpokenText(transcript ?? '') === normalizeSpokenText(word);
}

export class CollectibleManager {
  private markers: CollectibleMarker[] = [];
  private activeMarker: CollectibleMarker | null = null;
  private overlay = new CollectOverlay();
  private pronunciationPipeline = new SpeechPipeline({
    onStateChange: (state) => console.log(`[collectibles:pipeline] ${state}`),
    onTranscript: (text) => console.log(`[collectibles:asr] "${text}"`),
  });
  private isOverlayOpen = false;
  private cooldownUntil = 0;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private tts: TTSEngine,
    private sceneId: string,
    private config: SceneConfig
  ) {}

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
      if (!marker.anchored) {
        marker.group.rotation.y += delta * 0.55;
        marker.group.position.y = marker.position.y + Math.sin(elapsed * 2.4 + marker.position.x) * 0.06;
      }
      marker.halo.material.opacity = marker.halo.visible ? 0.45 + Math.sin(elapsed * 5) * 0.18 : 0;
    }
  }

  checkProximity(cameraPosition: Vector3Like): void {
    if (this.isOverlayOpen || Date.now() < this.cooldownUntil) return;

    this.activeMarker = getActiveCollectible(this.markers, cameraPosition, 2);
    this.syncMarkerPrompts();
  }

  getNearestCollectible(cameraPosition: Vector3Like, radius = 2): ProximityCollectible & { distance: number } | null {
    if (this.isOverlayOpen || Date.now() < this.cooldownUntil) return null;

    const marker = getActiveCollectible(this.markers, cameraPosition, radius);
    if (!marker) return null;

    return {
      word: marker.word,
      position: marker.position,
      collected: marker.collected,
      distance: horizontalDistance(cameraPosition, marker.position),
    };
  }

  setActiveCollectible(word: string | null): void {
    this.activeMarker = word ? this.markers.find((marker) => marker.word === word && !marker.collected) ?? null : null;
    this.syncMarkerPrompts();
  }

  private syncMarkerPrompts(): void {
    for (const marker of this.markers) {
      const isActive = marker === this.activeMarker;
      for (const material of marker.materials) {
        material.emissiveIntensity = isActive ? 0.28 : 0;
      }
      marker.halo.visible = isActive;
    }
  }

  dispose(): void {
    this.pronunciationPipeline.reset();
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
    group.rotation.y = placement.rotationY ?? 0;
    group.userData = {
      collectibleWord: placement.word,
      collectibleSceneId: this.sceneId,
      collected: false,
    };

    const materials: THREE.MeshStandardMaterial[] = [];
    group.add(createCollectibleObject(placement.word, materials));

    const halo = createHaloSprite();
    halo.position.set(0, 0.28, 0);
    halo.scale.set(1.45, 1.45, 1);
    halo.visible = false;
    group.add(halo);

    this.scene.add(group);
    this.markers.push({
      word: placement.word,
      group,
      materials,
      halo,
      position: placement.position,
      anchored: placement.anchored ?? false,
      collected: false,
    });
  }

  async openActiveCollectible(): Promise<void> {
    if (!this.activeMarker || this.isOverlayOpen || Date.now() < this.cooldownUntil) return;

    const marker = this.activeMarker;
    this.isOverlayOpen = true;
    document.exitPointerLock?.();
    this.overlay.show(marker.word, {
      onReplay: async () => {
        await this.speakWord(marker.word);
      },
      onPronunciationStart: async () => {
        return this.pronunciationPipeline.startRecording();
      },
      onPronunciationStop: async () => {
        const transcript = await this.pronunciationPipeline.stopRecording({
          prompt: [
            'A child is reading one short English vocabulary word or phrase.',
            'Transcribe only what the child actually says in English.',
            'Do not translate the speech into Chinese.',
            'Do not guess or autocorrect unclear speech.',
          ].join(' '),
        });
        return {
          transcript,
          matched: doesTranscriptMatchWord(transcript, marker.word),
        };
      },
      onConfirm: async () => {
        await this.confirmCollect(marker);
      },
      onClose: () => {
        this.pronunciationPipeline.reset();
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

function normalizeSpokenText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSceneAnchoredPlacements(sceneName: string): Record<string, Omit<CollectiblePlacement, 'word'>> {
  switch (normalizeWord(sceneName)) {
    case 'restaurant':
      return {
        hamburger: { position: { x: 4, y: 1.68, z: 8.5 }, rotationY: 0.2 },
        pizza: { position: { x: 14, y: 1.68, z: 8.5 }, rotationY: -0.35 },
        salad: { position: { x: 4.5, y: 1.68, z: 12 }, rotationY: 0.1 },
        pasta: { position: { x: 13.5, y: 1.68, z: 12 }, rotationY: -0.15 },
        water: { position: { x: 3.52, y: 1.68, z: 8.18 }, rotationY: 0.05 },
        juice: { position: { x: 14.45, y: 1.68, z: 8.18 }, rotationY: -0.1 },
        cola: { position: { x: 13.05, y: 1.68, z: 12.28 }, rotationY: 0.2 },
      };
    case 'airport':
      return {
        ticket: { position: { x: 7.0, y: 2.1, z: 5.76 }, rotationY: -0.1 },
        passport: { position: { x: 9.35, y: 2.1, z: 5.76 }, rotationY: 0.25 },
        'boarding pass': { position: { x: 12.3, y: 2.1, z: 5.76 }, rotationY: -0.25 },
        gate: { position: { x: 20.18, y: 2.38, z: 9.4 }, rotationY: Math.PI / 2 },
        flight: { position: { x: 3.7, y: 3.62, z: 2.45 }, rotationY: -0.45 },
        bag: { position: { x: 14.2, y: 2.05, z: 6.7 }, rotationY: 0.15 },
        please: { position: { x: 17.2, y: 2.1, z: 5.76 }, rotationY: 0.1 },
      };
    case 'school':
      return {
        teacher: { position: { x: 11.2, y: 2.22, z: 3.6 }, rotationY: 0.1 },
        book: { position: { x: 4, y: 1.6, z: 7 }, rotationY: -0.2 },
        pencil: { position: { x: 7, y: 1.6, z: 7 }, rotationY: 0.55 },
        desk: { position: { x: 10, y: 1.62, z: 7 }, rotationY: 0 },
        chair: { position: { x: 13, y: 1.62, z: 7.92 }, rotationY: Math.PI },
        please: { position: { x: 8.7, y: 2.08, z: 3.52 }, rotationY: -0.1 },
        classroom: { position: { x: 16, y: 1.6, z: 10 }, rotationY: 0.2 },
      };
    case 'hotel':
      return {
        room: { position: { x: 8.6, y: 2.02, z: 5.1 }, rotationY: 0.15 },
        key: { position: { x: 10.2, y: 2.06, z: 5.05 }, rotationY: -0.2 },
        night: { position: { x: 11.4, y: 2.02, z: 5.12 }, rotationY: 0.15 },
        reservation: { position: { x: 9.2, y: 2.06, z: 5.64 }, rotationY: -0.15 },
        passport: { position: { x: 10.8, y: 2.08, z: 5.64 }, rotationY: 0.25 },
        please: { position: { x: 12.1, y: 2.06, z: 5.64 }, rotationY: 0 },
        'thank you': { position: { x: 7.8, y: 2.06, z: 5.64 }, rotationY: -0.2 },
      };
    case 'zoo':
      return {
        lion: { position: { x: 9.4, y: 1.08, z: 4.6 }, rotationY: 0.2 },
        monkey: { position: { x: 12.5, y: 1.08, z: 5.2 }, rotationY: -0.25 },
        elephant: { position: { x: 9.2, y: 1.08, z: 8.6 }, rotationY: 0.35 },
        bird: { position: { x: 12.8, y: 1.55, z: 8.8 }, rotationY: -0.2 },
        tiger: { position: { x: 9.5, y: 1.08, z: 12 }, rotationY: -0.3 },
        big: { position: { x: 13.1, y: 1.08, z: 11.8 }, rotationY: 0.15 },
        small: { position: { x: 10.2, y: 1.08, z: 14.5 }, rotationY: -0.15 },
        where: { position: { x: 11.8, y: 1.08, z: 15.1 }, rotationY: 0.1 },
      };
    default:
      return {};
  }
}

function createCollectibleObject(word: string, materials: THREE.MeshStandardMaterial[]): THREE.Group {
  const item = new THREE.Group();
  const normalized = normalizeWord(word);

  if (['hamburger', 'pizza', 'salad', 'pasta'].includes(normalized)) {
    addPlateBase(item, materials);
  }

  switch (normalized) {
    case 'hamburger':
      addBurger(item, materials);
      break;
    case 'pizza':
      addPizza(item, materials);
      break;
    case 'salad':
      addSalad(item, materials);
      break;
    case 'pasta':
      addPasta(item, materials);
      break;
    case 'water':
    case 'juice':
    case 'cola':
      addDrink(item, materials, normalized);
      break;
    case 'book':
    case 'passport':
    case 'reservation':
    case 'classroom':
      addBookLike(item, materials, normalized);
      break;
    case 'ticket':
    case 'boarding pass':
    case 'please':
    case 'thank you':
      addPaperCard(item, materials, normalized);
      break;
    case 'pencil':
      addPencil(item, materials);
      break;
    case 'key':
      addKey(item, materials);
      break;
    case 'bag':
      addMiniSuitcase(item, materials);
      break;
    case 'flight':
      addMiniPlane(item, materials);
      break;
    case 'gate':
      addMiniSign(item, materials, 'B');
      break;
    case 'room':
      addMiniDoor(item, materials);
      break;
    case 'night':
      addMoon(item, materials);
      break;
    case 'desk':
      addMiniDesk(item, materials);
      break;
    case 'chair':
      addMiniChair(item, materials);
      break;
    case 'teacher':
      addMiniPerson(item, materials);
      break;
    case 'lion':
    case 'monkey':
    case 'elephant':
    case 'bird':
    case 'tiger':
      addAnimalToy(item, materials, normalized);
      break;
    case 'big':
    case 'small':
    case 'where':
      addWordBlock(item, materials, normalized);
      break;
    default:
      addWordBlock(item, materials, normalized);
      break;
  }

  return item;
}

function collectibleMaterial(materials: THREE.MeshStandardMaterial[], color: number, roughness = 0.62): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    emissive: color,
    emissiveIntensity: 0,
  });
  materials.push(material);
  return material;
}

function addPlateBase(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.035, 24),
    collectibleMaterial(materials, 0xfffbeb, 0.45)
  );
  plate.position.set(0, 0, 0);
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);
}

function addBurger(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  addLocalBox(group, [0, 0.06, 0], [0.45, 0.08, 0.32], collectibleMaterial(materials, 0xd97706));
  addLocalBox(group, [0, 0.13, 0], [0.42, 0.07, 0.3], collectibleMaterial(materials, 0x6b3f1d));
  addLocalBox(group, [0, 0.19, 0], [0.46, 0.05, 0.33], collectibleMaterial(materials, 0x22c55e));
  addLocalBox(group, [0, 0.25, 0], [0.44, 0.08, 0.31], collectibleMaterial(materials, 0xf59e0b));
}

function addPizza(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  const crust = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.045, 32), collectibleMaterial(materials, 0xd97706));
  crust.position.set(0, 0.055, 0);
  group.add(crust);
  const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 32), collectibleMaterial(materials, 0xffd54f));
  cheese.position.set(0, 0.09, 0);
  group.add(cheese);
  for (const [x, z] of [[-0.09, -0.04], [0.1, 0.05], [0.02, -0.13]]) {
    const pepperoni = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 14), collectibleMaterial(materials, 0xef4444));
    pepperoni.position.set(x, 0.13, z);
    group.add(pepperoni);
  }
}

function addSalad(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  addLocalBox(group, [0, 0.08, 0], [0.42, 0.1, 0.3], collectibleMaterial(materials, 0x16a34a));
  addLocalBox(group, [-0.1, 0.16, 0.03], [0.18, 0.08, 0.14], collectibleMaterial(materials, 0x84cc16));
  addLocalBox(group, [0.12, 0.16, -0.04], [0.15, 0.07, 0.13], collectibleMaterial(materials, 0xfb7185));
}

function addPasta(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  addLocalBox(group, [0, 0.08, 0], [0.46, 0.08, 0.3], collectibleMaterial(materials, 0xfacc15));
  addLocalBox(group, [-0.08, 0.15, 0.03], [0.28, 0.05, 0.08], collectibleMaterial(materials, 0xfbbf24));
  addLocalBox(group, [0.1, 0.18, -0.04], [0.22, 0.05, 0.08], collectibleMaterial(materials, 0xef4444));
}

function addDrink(group: THREE.Group, materials: THREE.MeshStandardMaterial[], kind: string): void {
  const color = kind === 'water' ? 0x38bdf8 : kind === 'juice' ? 0xfb923c : 0x7f1d1d;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.42, 18), collectibleMaterial(materials, color, 0.35));
  cup.position.set(0, 0.21, 0);
  cup.castShadow = true;
  group.add(cup);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 18), collectibleMaterial(materials, 0xf8fafc, 0.4));
  rim.position.set(0, 0.44, 0);
  group.add(rim);
  addLocalBox(group, [0.12, 0.62, 0], [0.04, 0.28, 0.04], collectibleMaterial(materials, 0xffffff, 0.3));
}

function addBookLike(group: THREE.Group, materials: THREE.MeshStandardMaterial[], kind: string): void {
  const color = kind === 'passport' ? 0x1d4ed8 : kind === 'reservation' ? 0x7c3aed : kind === 'classroom' ? 0x16a34a : 0x2563eb;
  addLocalBox(group, [0, 0.04, 0], [0.5, 0.08, 0.36], collectibleMaterial(materials, color));
  addLocalBox(group, [-0.03, 0.095, 0], [0.04, 0.025, 0.32], collectibleMaterial(materials, 0xf8fafc));
  addLocalBox(group, [0.12, 0.11, 0], [0.17, 0.03, 0.22], collectibleMaterial(materials, 0xfacc15));
}

function addPaperCard(group: THREE.Group, materials: THREE.MeshStandardMaterial[], kind: string): void {
  const color = kind === 'please' || kind === 'thank you' ? 0xfff7ed : 0xf8fafc;
  addLocalBox(group, [0, 0.035, 0], [0.52, 0.045, 0.32], collectibleMaterial(materials, color, 0.85));
  addLocalBox(group, [-0.12, 0.07, 0], [0.08, 0.025, 0.25], collectibleMaterial(materials, 0x38bdf8));
  addLocalBox(group, [0.12, 0.07, -0.06], [0.18, 0.025, 0.045], collectibleMaterial(materials, 0x64748b));
  addLocalBox(group, [0.12, 0.07, 0.06], [0.18, 0.025, 0.045], collectibleMaterial(materials, 0x64748b));
}

function addPencil(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  addLocalBox(group, [0, 0.06, 0], [0.64, 0.08, 0.08], collectibleMaterial(materials, 0xfacc15));
  addLocalBox(group, [0.34, 0.06, 0], [0.12, 0.08, 0.08], collectibleMaterial(materials, 0xfca5a5));
  addLocalBox(group, [-0.36, 0.06, 0], [0.12, 0.08, 0.08], collectibleMaterial(materials, 0x92400e));
}

function addKey(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  const gold = collectibleMaterial(materials, 0xfacc15, 0.35);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 18), gold);
  ring.position.set(-0.15, 0.08, 0);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  addLocalBox(group, [0.12, 0.08, 0], [0.38, 0.055, 0.055], gold);
  addLocalBox(group, [0.3, 0.05, 0.06], [0.08, 0.05, 0.08], gold);
}

function addMiniSuitcase(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  addLocalBox(group, [0, 0.18, 0], [0.46, 0.34, 0.24], collectibleMaterial(materials, 0x2563eb));
  addLocalBox(group, [0, 0.38, 0], [0.2, 0.05, 0.08], collectibleMaterial(materials, 0x94a3b8));
  addLocalBox(group, [-0.14, -0.02, 0.1], [0.08, 0.08, 0.08], collectibleMaterial(materials, 0x111827));
  addLocalBox(group, [0.14, -0.02, 0.1], [0.08, 0.08, 0.08], collectibleMaterial(materials, 0x111827));
}

function addMiniPlane(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  addLocalBox(group, [0, 0.08, 0], [0.64, 0.1, 0.14], collectibleMaterial(materials, 0xf8fafc));
  addLocalBox(group, [0.08, 0.08, 0], [0.28, 0.045, 0.48], collectibleMaterial(materials, 0x60a5fa));
  addLocalBox(group, [-0.28, 0.18, 0], [0.14, 0.08, 0.28], collectibleMaterial(materials, 0x2563eb));
}

function addMiniSign(group: THREE.Group, materials: THREE.MeshStandardMaterial[], label: string): void {
  addLocalBox(group, [0, 0.32, 0], [0.5, 0.32, 0.06], collectibleMaterial(materials, 0x2563eb));
  addLocalBox(group, [0, 0.08, 0], [0.06, 0.28, 0.06], collectibleMaterial(materials, 0x64748b));
  const sprite = createTextSprite(label, 96, 96, '#ffffff', 'bold 48px sans-serif');
  sprite.position.set(0, 0.34, -0.04);
  sprite.scale.set(0.32, 0.32, 1);
  group.add(sprite);
}

function addMiniDoor(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  addLocalBox(group, [0, 0.26, 0], [0.36, 0.52, 0.08], collectibleMaterial(materials, 0x92400e));
  addLocalBox(group, [0.1, 0.25, -0.06], [0.045, 0.045, 0.035], collectibleMaterial(materials, 0xfacc15));
}

function addMoon(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 12), collectibleMaterial(materials, 0xfef3c7, 0.42));
  moon.position.set(0, 0.22, 0);
  group.add(moon);
  addLocalBox(group, [0.16, 0.3, 0], [0.08, 0.08, 0.08], collectibleMaterial(materials, 0x1e293b));
}

function addMiniDesk(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  addLocalBox(group, [0, 0.24, 0], [0.52, 0.08, 0.34], collectibleMaterial(materials, 0x9a6a3a));
  for (const [x, z] of [[-0.2, -0.12], [0.2, -0.12], [-0.2, 0.12], [0.2, 0.12]]) {
    addLocalBox(group, [x, 0.08, z], [0.05, 0.28, 0.05], collectibleMaterial(materials, 0x6d4c41));
  }
}

function addMiniChair(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  addLocalBox(group, [0, 0.16, 0], [0.34, 0.08, 0.32], collectibleMaterial(materials, 0x42a5f5));
  addLocalBox(group, [0, 0.36, 0.16], [0.34, 0.32, 0.06], collectibleMaterial(materials, 0x42a5f5));
  addLocalBox(group, [-0.12, 0.04, -0.1], [0.04, 0.18, 0.04], collectibleMaterial(materials, 0x1565c0));
  addLocalBox(group, [0.12, 0.04, -0.1], [0.04, 0.18, 0.04], collectibleMaterial(materials, 0x1565c0));
}

function addMiniPerson(group: THREE.Group, materials: THREE.MeshStandardMaterial[]): void {
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), collectibleMaterial(materials, 0xffd7a8));
  head.position.set(0, 0.44, 0);
  group.add(head);
  addLocalBox(group, [0, 0.22, 0], [0.24, 0.28, 0.16], collectibleMaterial(materials, 0x22c55e));
}

function addAnimalToy(group: THREE.Group, materials: THREE.MeshStandardMaterial[], kind: string): void {
  const color = kind === 'elephant' ? 0x94a3b8 : kind === 'tiger' ? 0xf97316 : kind === 'bird' ? 0x38bdf8 : kind === 'monkey' ? 0x8b5a2b : 0xd97706;
  const body = new THREE.Mesh(new THREE.SphereGeometry(kind === 'elephant' ? 0.22 : 0.18, 18, 12), collectibleMaterial(materials, color));
  body.position.set(0, 0.22, 0);
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), collectibleMaterial(materials, color));
  head.position.set(0.2, 0.28, 0);
  group.add(head);
  if (kind === 'tiger') {
    addLocalBox(group, [0.02, 0.36, -0.16], [0.24, 0.04, 0.035], collectibleMaterial(materials, 0x111827));
  }
}

function addWordBlock(group: THREE.Group, materials: THREE.MeshStandardMaterial[], word: string): void {
  const color = word === 'big' ? 0x22c55e : word === 'small' ? 0x60a5fa : 0xa855f7;
  addLocalBox(group, [0, 0.12, 0], [word === 'big' ? 0.5 : 0.34, word === 'small' ? 0.2 : 0.28, 0.32], collectibleMaterial(materials, color));
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
