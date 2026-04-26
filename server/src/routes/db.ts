import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(import.meta.dirname ?? 'data', '../../data/progress.db');

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

export interface ProgressRow {
  scene_id: string;
  completed: number;
  score: number;
  last_played_at: string | null;
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

export { db };
