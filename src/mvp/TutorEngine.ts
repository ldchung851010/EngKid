import type { ConceptId, MissionId, ProductionLevel, ScaffoldLevel, TutorDecision, TurnAnalysis } from './types.js';

export interface EvaluateInput {
  missionId: MissionId;
  transcript: string;
  scaffoldLevel: ScaffoldLevel;
  targetItem?: string;
  transfer?: boolean;
}

const REASON_WORDS = ['because', 'so ', 'need', 'want', 'important', 'use', 'help', 'for ', 'to '];
const SPACE_WORDS = ['mars', 'moon', 'rocket', 'planet', 'space', 'battery', 'control panel'];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function includesAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(value));
}

function conceptsFor(text: string): ConceptId[] {
  const concepts = new Set<ConceptId>();
  if (/\bbecause\b/.test(text)) concepts.add('because');
  if (/\bshould\b/.test(text)) concepts.add('should');
  if (/\bneed(?:s|ed)?\b/.test(text)) concepts.add('need');
  if (/\b(where|what|why|who|when|how)\b/.test(text)) concepts.add('wh_question');
  if (/^(is|are|do|does|can|could|will|would)\b/.test(text)) concepts.add('yes_no_question');
  if (/\b(near|behind|under|on|in|next to|between|beside)\b/.test(text)) concepts.add('prepositions');
  if (/\b(more|less|better|worse|same|different|important than)\b/.test(text)) concepts.add('comparative');
  if (includesAny(text, SPACE_WORDS)) concepts.add('space_vocab');
  return [...concepts];
}

function itemMeaningDetected(text: string, item?: string): boolean {
  if (!item) return false;
  const patterns: Record<string, string[]> = {
    water: ['drink', 'thirst', 'live', 'survive', 'hydr', 'need water'],
    pizza: ['eat', 'food', 'hungry', 'energy'],
    'teddy bear': ['sleep', 'comfort', 'scared', 'friend', 'feel better'],
    flashlight: ['dark', 'see', 'light', 'look'],
    phone: ['call', 'contact', 'communicat', 'photo', 'message'],
    jacket: ['cold', 'warm', 'freeze', 'temperature'],
  };
  return includesAny(text, patterns[item] ?? []);
}

function productionLevel(text: string, scaffold: ScaffoldLevel, missionId: MissionId): ProductionLevel {
  const words = text.split(' ').filter(Boolean).length;
  if (scaffold === 4) return 'R0';
  if (scaffold === 3) return 'R1';
  if (scaffold === 2) return 'R2';
  if (missionId === 'ask-robot' || missionId === 'transfer') return words >= 4 ? 'R4' : 'R3';
  return words >= 4 ? 'R3' : 'R2';
}

export class TutorEngine {
  analyze(input: EvaluateInput): TurnAnalysis {
    const normalized = normalize(input.transcript);
    const reasonDetected = includesAny(` ${normalized} `, REASON_WORDS) || itemMeaningDetected(normalized, input.targetItem);
    const questionDetected = /\?$/.test(input.transcript.trim()) || /^(where|what|why|who|when|how|is|are|do|does|can|could|will|would)\b/.test(normalized);

    let targetMeaningDetected = false;
    if (input.missionId === 'ask-robot') {
      targetMeaningDetected = questionDetected && (normalized.includes('battery') || normalized.includes('it') || normalized.includes('where') || normalized.includes('near'));
    } else if (input.missionId === 'prepare-rocket') {
      targetMeaningDetected = itemMeaningDetected(normalized, input.targetItem) || reasonDetected;
    } else if (input.missionId === 'transfer') {
      targetMeaningDetected = normalized.length >= 5 && (reasonDetected || includesAny(normalized, ['same', 'change', 'take', 'leave', 'yes', 'no']));
    } else {
      targetMeaningDetected = normalized.length > 0;
    }

    return {
      transcript: input.transcript,
      normalized,
      conceptsUsed: conceptsFor(normalized),
      productionLevel: productionLevel(normalized, input.scaffoldLevel, input.missionId),
      meaningful: normalized.split(' ').filter(Boolean).length >= 2,
      reasonDetected,
      questionDetected,
      targetMeaningDetected,
    };
  }

  evaluate(input: EvaluateInput): TutorDecision {
    const analysis = this.analyze(input);
    if (!analysis.meaningful || !analysis.targetMeaningDetected) {
      return {
        action: 'scaffold',
        scaffoldLevel: input.scaffoldLevel,
        reply: this.scaffoldReply(input.missionId, input.scaffoldLevel, input.targetItem),
        hint: this.scaffoldHint(input.missionId, input.scaffoldLevel, input.targetItem),
        analysis,
        success: false,
      };
    }

    if (input.missionId === 'prepare-rocket') {
      const item = input.targetItem ?? 'it';
      const cleanGrammar = this.recast(input.transcript, item);
      return {
        action: cleanGrammar ? 'recast' : 'continue',
        scaffoldLevel: input.scaffoldLevel,
        reply: cleanGrammar ?? `That makes sense. ${this.affirmItem(item)}`,
        analysis,
        success: true,
      };
    }

    if (input.missionId === 'transfer') {
      return {
        action: 'complete',
        scaffoldLevel: input.scaffoldLevel,
        reply: 'Great thinking! You changed your plan for a new place. Mission complete!',
        analysis,
        success: true,
      };
    }

    return {
      action: 'continue',
      scaffoldLevel: input.scaffoldLevel,
      reply: 'Good question. Keep going!',
      analysis,
      success: true,
    };
  }

  private scaffoldReply(mission: MissionId, level: ScaffoldLevel, item?: string): string {
    if (mission === 'ask-robot') {
      const messages: Record<ScaffoldLevel, string> = {
        0: 'Ask me where the battery is.',
        1: 'Look at me and ask about the missing battery.',
        2: 'Do you want to ask “Where is it?” or “What color is it?”',
        3: 'Start with: “Where is…”',
        4: 'Try: “Where is the battery?” Then ask a new question after I answer.',
      };
      return messages[level];
    }
    if (mission === 'transfer') {
      const messages: Record<ScaffoldLevel, string> = {
        0: 'Would you take the same things to the Moon? Why?',
        1: 'Think about what is different on the Moon.',
        2: 'Same things, or change something?',
        3: 'Start with: “I would…” or “We should…”',
        4: 'Try: “We should take a jacket because the Moon is cold.” Now make your own choice.',
      };
      return messages[level];
    }
    const subject = item ?? 'it';
    const messages: Record<ScaffoldLevel, string> = {
      0: `Why should we take ${subject}?`,
      1: `Look at ${subject}. What can it help us do?`,
      2: `Is ${subject} useful because we need it, or because it is fun?`,
      3: 'Start with: “Because we need…”',
      4: `For example: “We should take ${subject} because we need it.” Now give me your own reason.`,
    };
    return messages[level];
  }

  private scaffoldHint(mission: MissionId, level: ScaffoldLevel, item?: string): string | undefined {
    if (level === 0) return undefined;
    if (mission === 'ask-robot') return level <= 1 ? '👀 Look for the robot and the blue control panel.' : '💬 Where is the battery?';
    if (mission === 'transfer') return level <= 1 ? '🌙 The Moon is colder and darker.' : '💬 We should… because…';
    if (level <= 1) return `👀 Think: what is ${item ?? 'this'} used for?`;
    if (level === 2) return 'Choose a reason, then say it in your own words.';
    return '💬 Because we need…';
  }

  private recast(transcript: string, item: string): string | null {
    const text = normalize(transcript);
    if (/\bwe need (drink|eat|see|call)\b/.test(text)) {
      const fixed = text
        .replace('we need drink', 'we need it to drink')
        .replace('we need eat', 'we need it to eat')
        .replace('we need see', 'we need it to see')
        .replace('we need call', 'we need it to call');
      return `Yes — ${fixed}. Good reason for ${item}.`;
    }
    if (text.startsWith('because') && !text.includes('we ')) {
      return `Yes. You can say: “We should take ${item} ${text}.” What else should we take?`;
    }
    return null;
  }

  private affirmItem(item: string): string {
    const lines: Record<string, string> = {
      water: 'Water can help us stay alive.',
      pizza: 'Food can give us energy.',
      'teddy bear': 'Comfort can matter on a long trip.',
      flashlight: 'A flashlight is useful when it is dark.',
      phone: 'A phone can help us communicate.',
      jacket: 'A jacket can keep us warm.',
    };
    return lines[item] ?? 'That could be useful.';
  }
}
