/** Build-time script: read scene configs and write scenes-metadata.json */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenesDir = path.resolve(__dirname, '../../../src/scenes');
const outPath = path.resolve(__dirname, '../../data/scenes-metadata.json');

const dirs = fs.readdirSync(scenesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory());

const scenes: Array<{
  id: string;
  name: string;
  description: string;
  cefrLevel: string;
  targetVocabulary: string[];
}> = [];

for (const dir of dirs) {
  const configPath = path.resolve(scenesDir, dir.name, 'config.ts');
  if (!fs.existsSync(configPath)) continue;

  const mod = await import(configPath);
  const config = mod[Object.keys(mod).find((k) => k.endsWith('Config') || k === 'config') ?? ''];
  if (!config?.name) {
    console.warn(`[generate-scenes] skipping ${dir.name}: no config found`);
    continue;
  }

  scenes.push({
    id: dir.name,
    name: config.name,
    description: config.description ?? '',
    cefrLevel: config.cefrLevel ?? 'A1',
    targetVocabulary: Array.isArray(config.targetVocabulary) ? config.targetVocabulary : [],
  });
}

scenes.sort((a, b) => a.cefrLevel.localeCompare(b.cefrLevel) || a.name.localeCompare(b.name));

fs.writeFileSync(outPath, JSON.stringify({ scenes }, null, 2));
console.log(`[generate-scenes] wrote ${scenes.length} scenes to ${outPath}`);
