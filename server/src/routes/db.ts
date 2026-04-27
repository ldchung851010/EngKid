import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.SCENE_ENGINE_DB_PATH
  ? path.resolve(process.env.SCENE_ENGINE_DB_PATH)
  : path.resolve(import.meta.dirname ?? 'data', '../../data/progress.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS progress (
    scene_id TEXT PRIMARY KEY,
    completed INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    last_played_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS collectibles (
    word TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    PRIMARY KEY (word, scene_id)
  )
`);

export interface ProgressRow {
  scene_id: string;
  completed: number;
  score: number;
  last_played_at: string | null;
}

export interface CollectibleRow {
  word: string;
  scene_id: string;
  collected_at: string;
}

export function getProgress(): ProgressRow[] {
  return db.prepare('SELECT * FROM progress').all() as ProgressRow[];
}

export function upsertProgress(sceneId: string, completed: boolean, score: number): void {
  db.prepare(`
    INSERT INTO progress (scene_id, completed, score, last_played_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(scene_id) DO UPDATE SET
      completed = excluded.completed,
      score = excluded.score,
      last_played_at = excluded.last_played_at
  `).run(sceneId, completed ? 1 : 0, score, new Date().toISOString());
}

export function getCollectibles(sceneId?: string): CollectibleRow[] {
  if (sceneId) {
    return db.prepare('SELECT * FROM collectibles WHERE scene_id = ? ORDER BY collected_at DESC')
      .all(sceneId) as CollectibleRow[];
  }
  return db.prepare('SELECT * FROM collectibles ORDER BY collected_at DESC').all() as CollectibleRow[];
}

export function upsertCollectible(word: string, sceneId: string): CollectibleRow {
  const collectedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO collectibles (word, scene_id, collected_at)
    VALUES (?, ?, ?)
    ON CONFLICT(word, scene_id) DO UPDATE SET
      collected_at = excluded.collected_at
  `).run(word, sceneId, collectedAt);

  return db.prepare('SELECT * FROM collectibles WHERE word = ? AND scene_id = ?')
    .get(word, sceneId) as CollectibleRow;
}

export { db };
