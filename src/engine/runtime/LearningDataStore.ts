export const LEARNING_DATA_VERSION = 1;
export const LEARNING_DATA_STORAGE_KEY = 'scene-engine.learning-data';
export const LEARNING_DATA_MAX_IMPORT_BYTES = 256 * 1024;

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SceneProgressData {
  sceneId: string;
  completed: boolean;
  score: number;
  lastPlayedAt: string;
}

export interface CollectibleData {
  word: string;
  sceneId: string;
  collectedAt: string;
}

export interface LearningDataDocument {
  version: 1;
  scenes: Record<string, SceneProgressData>;
  collectibles: Record<string, Record<string, CollectibleData>>;
  preferences?: Record<string, unknown>;
}

export type LearningDataError =
  | 'invalid_json'
  | 'invalid_schema'
  | 'unsupported_version'
  | 'too_large'
  | 'storage_unavailable';

export type LearningDataResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: LearningDataError; message: string };

export interface SaveSceneProgressInput {
  sceneId: string;
  completed: boolean;
  score: number;
  lastPlayedAt?: string;
}

export class LearningDataStore {
  constructor(
    private storage: StorageAdapter = getDefaultStorage(),
    private storageKey = LEARNING_DATA_STORAGE_KEY
  ) {}

  getData(): LearningDataDocument {
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.storageKey);
    } catch {
      return createEmptyDocument();
    }
    if (!raw) return createEmptyDocument();

    const parsed = parseDocument(raw);
    return parsed.ok ? parsed.value : createEmptyDocument();
  }

  getSceneProgress(sceneId: string): SceneProgressData | null {
    return this.getData().scenes[sceneId] ?? null;
  }

  getAllSceneProgress(): SceneProgressData[] {
    return Object.values(this.getData().scenes);
  }

  getTotalScore(): number {
    return this.getAllSceneProgress().reduce((sum, scene) => sum + scene.score, 0);
  }

  saveSceneProgress(input: SaveSceneProgressInput): LearningDataResult<SceneProgressData> {
    const sceneId = normalizeId(input.sceneId);
    if (!sceneId || !Number.isInteger(input.score) || input.score < 0) {
      return {
        ok: false,
        error: 'invalid_schema',
        message: 'Scene progress requires a scene id and a non-negative integer score.',
      };
    }

    const data = this.getData();
    const progress: SceneProgressData = {
      sceneId,
      completed: input.completed,
      score: input.score,
      lastPlayedAt: input.lastPlayedAt ?? new Date().toISOString(),
    };
    data.scenes[sceneId] = progress;

    const saved = this.save(data);
    return saved.ok ? { ok: true, value: progress } : saved;
  }

  getCollectibles(sceneId?: string): CollectibleData[] {
    const data = this.getData();
    if (sceneId) {
      return Object.values(data.collectibles[normalizeId(sceneId)] ?? {});
    }
    return Object.values(data.collectibles).flatMap((items) => Object.values(items));
  }

  addCollectible(word: string, sceneId: string, collectedAt = new Date().toISOString()): LearningDataResult<CollectibleData> {
    const normalizedSceneId = normalizeId(sceneId);
    const normalizedWord = normalizeWord(word);
    if (!normalizedSceneId || !normalizedWord) {
      return {
        ok: false,
        error: 'invalid_schema',
        message: 'Collectibles require a scene id and word.',
      };
    }

    const data = this.getData();
    data.collectibles[normalizedSceneId] ??= {};
    const item: CollectibleData = {
      word: normalizedWord,
      sceneId: normalizedSceneId,
      collectedAt,
    };
    data.collectibles[normalizedSceneId][normalizedWord] = item;

    const saved = this.save(data);
    return saved.ok ? { ok: true, value: item } : saved;
  }

  exportData(): string {
    return JSON.stringify(this.getData(), null, 2);
  }

  importData(json: string): LearningDataResult<LearningDataDocument> {
    if (byteLength(json) > LEARNING_DATA_MAX_IMPORT_BYTES) {
      return { ok: false, error: 'too_large', message: 'Learning data file is too large.' };
    }

    const parsed = parseDocument(json);
    if (!parsed.ok) return parsed;

    const saved = this.save(parsed.value);
    return saved.ok ? { ok: true, value: parsed.value } : saved;
  }

  reset(): LearningDataResult<LearningDataDocument> {
    const empty = createEmptyDocument();
    const saved = this.save(empty);
    return saved.ok ? { ok: true, value: empty } : saved;
  }

  private save(data: LearningDataDocument): LearningDataResult<LearningDataDocument> {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(data));
      return { ok: true, value: data };
    } catch {
      return {
        ok: false,
        error: 'storage_unavailable',
        message: 'Learning data could not be saved in this browser.',
      };
    }
  }
}

export const learningDataStore = new LearningDataStore();

export function createEmptyDocument(): LearningDataDocument {
  return {
    version: LEARNING_DATA_VERSION,
    scenes: {},
    collectibles: {},
    preferences: {},
  };
}

function parseDocument(json: string): LearningDataResult<LearningDataDocument> {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, error: 'invalid_json', message: 'Learning data file is not valid JSON.' };
  }

  return validateDocument(value);
}

function validateDocument(value: unknown): LearningDataResult<LearningDataDocument> {
  if (!isRecord(value)) {
    return invalidSchema('Learning data must be an object.');
  }

  if (value.version !== LEARNING_DATA_VERSION) {
    return value.version === undefined
      ? invalidSchema('Learning data is missing a version.')
      : { ok: false, error: 'unsupported_version', message: 'Learning data version is not supported.' };
  }

  if (!isRecord(value.scenes) || !isRecord(value.collectibles)) {
    return invalidSchema('Learning data must include scenes and collectibles.');
  }

  const scenes: Record<string, SceneProgressData> = {};
  for (const [sceneId, progress] of Object.entries(value.scenes)) {
    if (!isRecord(progress)) return invalidSchema('Scene progress entries must be objects.');
    const normalizedSceneId = normalizeId(String(progress.sceneId ?? sceneId));
    if (
      !normalizedSceneId ||
      typeof progress.completed !== 'boolean' ||
      !Number.isInteger(progress.score) ||
      Number(progress.score) < 0 ||
      typeof progress.lastPlayedAt !== 'string'
    ) {
      return invalidSchema('Scene progress entry is invalid.');
    }
    scenes[normalizedSceneId] = {
      sceneId: normalizedSceneId,
      completed: progress.completed,
      score: Number(progress.score),
      lastPlayedAt: progress.lastPlayedAt,
    };
  }

  const collectibles: Record<string, Record<string, CollectibleData>> = {};
  for (const [sceneId, entries] of Object.entries(value.collectibles)) {
    if (!isRecord(entries)) return invalidSchema('Collectible scene entries must be objects.');
    const normalizedSceneId = normalizeId(sceneId);
    if (!normalizedSceneId) return invalidSchema('Collectible scene id is invalid.');
    collectibles[normalizedSceneId] = {};
    for (const [word, item] of Object.entries(entries)) {
      if (!isRecord(item)) return invalidSchema('Collectible entries must be objects.');
      const normalizedWord = normalizeWord(String(item.word ?? word));
      const itemSceneId = normalizeId(String(item.sceneId ?? normalizedSceneId));
      if (!normalizedWord || itemSceneId !== normalizedSceneId || typeof item.collectedAt !== 'string') {
        return invalidSchema('Collectible entry is invalid.');
      }
      collectibles[normalizedSceneId][normalizedWord] = {
        word: normalizedWord,
        sceneId: normalizedSceneId,
        collectedAt: item.collectedAt,
      };
    }
  }

  const preferences = isRecord(value.preferences) ? value.preferences : {};
  return { ok: true, value: { version: LEARNING_DATA_VERSION, scenes, collectibles, preferences } };
}

function invalidSchema(message: string): LearningDataResult<LearningDataDocument> {
  return { ok: false, error: 'invalid_schema', message };
}

function normalizeId(value: string): string {
  return value.trim();
}

export function normalizeLearningWord(value: string): string {
  return normalizeWord(value);
}

function normalizeWord(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function getDefaultStorage(): StorageAdapter {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Browsers can throw here when storage is disabled for the origin.
  }
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('localStorage is unavailable');
    },
    removeItem: () => {},
  };
}
