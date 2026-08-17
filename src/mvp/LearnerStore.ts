import type { ConceptId, ConceptState, LearnerState, ScaffoldLevel } from './types.js';

const STORAGE_KEY = 'engkid.learner-state.v1';
const CONCEPTS: ConceptId[] = [
  'because',
  'should',
  'need',
  'wh_question',
  'yes_no_question',
  'prepositions',
  'comparative',
  'space_vocab',
];

function emptyConcept(conceptId: ConceptId): ConceptState {
  return {
    conceptId,
    mastery: 0,
    independentSuccesses: 0,
    scaffoldedSuccesses: 0,
    failures: 0,
    transferSuccesses: 0,
    lastSeen: null,
    lastScaffoldLevel: 0,
  };
}

export function createLearnerState(): LearnerState {
  const concepts = Object.fromEntries(CONCEPTS.map((id) => [id, emptyConcept(id)])) as Record<ConceptId, ConceptState>;
  return { version: 1, concepts };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function recomputeMastery(state: ConceptState): number {
  const evidence =
    state.independentSuccesses * 1.0 +
    state.scaffoldedSuccesses * 0.45 +
    state.transferSuccesses * 1.25 -
    state.failures * 0.35;
  return clamp01(1 - Math.exp(-Math.max(0, evidence) / 4));
}

export class LearnerStore {
  private state: LearnerState;

  constructor() {
    this.state = this.load();
  }

  get snapshot(): LearnerState {
    return structuredClone(this.state);
  }

  recordSuccess(concepts: ConceptId[], scaffoldLevel: ScaffoldLevel, transfer = false): void {
    const now = new Date().toISOString();
    for (const id of concepts) {
      const concept = this.state.concepts[id];
      if (!concept) continue;
      if (scaffoldLevel <= 1) concept.independentSuccesses += 1;
      else concept.scaffoldedSuccesses += 1;
      if (transfer) concept.transferSuccesses += 1;
      concept.lastSeen = now;
      concept.lastScaffoldLevel = scaffoldLevel;
      concept.mastery = recomputeMastery(concept);
    }
    this.save();
  }

  recordFailure(concepts: ConceptId[], scaffoldLevel: ScaffoldLevel): void {
    const now = new Date().toISOString();
    for (const id of concepts) {
      const concept = this.state.concepts[id];
      if (!concept) continue;
      concept.failures += 1;
      concept.lastSeen = now;
      concept.lastScaffoldLevel = scaffoldLevel;
      concept.mastery = recomputeMastery(concept);
    }
    this.save();
  }

  reset(): void {
    this.state = createLearnerState();
    this.save();
  }

  private load(): LearnerState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createLearnerState();
      const parsed = JSON.parse(raw) as LearnerState;
      if (parsed?.version !== 1 || !parsed.concepts) return createLearnerState();
      const fresh = createLearnerState();
      for (const id of CONCEPTS) {
        const existing = parsed.concepts[id];
        if (existing) fresh.concepts[id] = { ...fresh.concepts[id], ...existing, conceptId: id };
      }
      return fresh;
    } catch {
      return createLearnerState();
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Storage can be unavailable in private browsing; the session still works in memory.
    }
  }
}
