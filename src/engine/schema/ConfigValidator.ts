export interface ConfigError {
  path: string;
  message: string;
  keyword: string;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ConfigError[] };

/**
 * Lightweight config validator.
 * For production, replace with Ajv + JSON Schema.
 * For V1, manual checks are sufficient for the small schema surface.
 */
export function validateConfig(config: unknown): ValidationResult {
  const errors: ConfigError[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: [{ path: '$', message: 'Config must be an object', keyword: 'type' }] };
  }

  const c = config as Record<string, unknown>;

  // schemaVersion
  if (c.schemaVersion !== '1.0') {
    errors.push({
      path: '$/schemaVersion',
      message: `Expected "1.0", got "${String(c.schemaVersion)}"`,
      keyword: 'enum',
    });
  }

  // name (required string)
  if (typeof c.name !== 'string' || c.name.trim() === '') {
    errors.push({ path: '$/name', message: 'Missing required field: name', keyword: 'required' });
  }

  // description
  if (typeof c.description !== 'string' || c.description.trim() === '') {
    errors.push({ path: '$/description', message: 'Missing required field: description', keyword: 'required' });
  }

  // cefrLevel
  if (c.cefrLevel !== 'A1' && c.cefrLevel !== 'A2') {
    errors.push({
      path: '$/cefrLevel',
      message: `Must be "A1" or "A2", got "${String(c.cefrLevel)}"`,
      keyword: 'enum',
    });
  }

  // targetVocabulary
  if (!Array.isArray(c.targetVocabulary)) {
    errors.push({ path: '$/targetVocabulary', message: 'Must be an array', keyword: 'type' });
  }

  // map
  if (!c.map || typeof c.map !== 'object') {
    errors.push({ path: '$/map', message: 'Missing required field: map', keyword: 'required' });
  }

  // npcs
  if (!Array.isArray(c.npcs)) {
    errors.push({ path: '$/npcs', message: 'Must be an array', keyword: 'type' });
  } else {
    (c.npcs as unknown[]).forEach((npc, i) => validateNPC(npc, i, errors));
  }

  // tasks
  if (!Array.isArray(c.tasks)) {
    errors.push({ path: '$/tasks', message: 'Must be an array', keyword: 'type' });
  } else {
    (c.tasks as unknown[]).forEach((task, i) => validateTask(task, i, errors));
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

function validateNPC(npc: unknown, index: number, errors: ConfigError[]): void {
  if (!npc || typeof npc !== 'object') {
    errors.push({ path: `$/npcs/${index}`, message: 'NPC must be an object', keyword: 'type' });
    return;
  }
  const n = npc as Record<string, unknown>;
  const base = `$/npcs/${index}`;

  for (const field of ['id', 'name', 'role', 'appearance', 'voice']) {
    if (typeof n[field] !== 'string' || (n[field] as string).trim() === '') {
      errors.push({ path: `${base}/${field}`, message: `Missing required NPC field: ${field}`, keyword: 'required' });
    }
  }

  if (!n.position || typeof n.position !== 'object') {
    errors.push({ path: `${base}/position`, message: 'Missing required NPC field: position', keyword: 'required' });
  } else {
    const pos = n.position as Record<string, unknown>;
    for (const axis of ['x', 'y', 'z']) {
      if (typeof pos[axis] !== 'number') {
        errors.push({ path: `${base}/position/${axis}`, message: `NPC position.${axis} must be a number`, keyword: 'type' });
      }
    }
  }

  if (!Array.isArray(n.dialogueTree) || (n.dialogueTree as unknown[]).length === 0) {
    errors.push({ path: `${base}/dialogueTree`, message: 'NPC dialogueTree must be a non-empty array', keyword: 'type' });
  }
}

function validateTask(task: unknown, index: number, errors: ConfigError[]): void {
  if (!task || typeof task !== 'object') {
    errors.push({ path: `$/tasks/${index}`, message: 'Task must be an object', keyword: 'type' });
    return;
  }
  const t = task as Record<string, unknown>;
  const base = `$/tasks/${index}`;

  if (typeof t.id !== 'string') {
    errors.push({ path: `${base}/id`, message: 'Missing required task field: id', keyword: 'required' });
  }
  if (typeof t.targetIntent !== 'string') {
    errors.push({ path: `${base}/targetIntent`, message: 'Missing required task field: targetIntent', keyword: 'required' });
  }
  if (typeof t.scoreReward !== 'number') {
    errors.push({ path: `${base}/scoreReward`, message: 'Task scoreReward must be a number', keyword: 'type' });
  }
}
