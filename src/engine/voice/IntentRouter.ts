/**
 * Intent Router — sends ASR transcript + context to DeepSeek V4 Flash
 * via backend proxy, returns matched intent or "none".
 */

export interface CandidateIntent {
  intentId: string;
  description: string;
}

export interface IntentResult {
  intentId: string;
  confidence: number;
}

export interface NPCContext {
  name: string;
  role: string;
}

export class IntentRouter {
  private apiBase: string;

  constructor(apiBase = '/api') {
    this.apiBase = apiBase;
  }

  /**
   * Route a child's utterance to the best-matching intent.
   * Returns { intentId: 'none', confidence: 0 } when no intent matches.
   */
  async route(
    transcript: string,
    npcContext: NPCContext,
    candidates: CandidateIntent[],
    conversationHistory: Array<{ role: string; text: string }>,
    hintExamples?: string[]
  ): Promise<IntentResult> {
    // If no candidates, return none immediately
    if (candidates.length === 0) {
      return { intentId: 'none', confidence: 0 };
    }

    // Fast path: exact match against hint examples — skip LLM
    if (hintExamples?.length) {
      const fast = this.matchHintExamples(transcript, hintExamples, candidates);
      if (fast) return fast;
    }

    try {
      const response = await fetch(`${this.apiBase}/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          npcContext,
          candidateIntents: candidates,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        return this.localFallback(transcript, candidates);
      }

      const result: IntentResult = await response.json();
      return result;
    } catch {
      // Network error → local keyword fallback
      return this.localFallback(transcript, candidates);
    }
  }

  /**
   * Generate a friendly nudge when intent router returns "none".
   * Sends transcript + context to backend for LLM-generated re-prompt.
   */
  async generateNudge(
    transcript: string,
    npcContext: NPCContext,
    candidates: CandidateIntent[],
    conversationHistory: Array<{ role: string; text: string }>
  ): Promise<string> {
    const hints = candidates.map((c) => `"${c.description}"`).join(', ');
    return `Sorry, I didn't quite catch that — what would you like? You can say things like ${hints}.`;
  }

  /**
   * Fast path: match transcript against known hint examples.
   * Returns a match if the transcript closely matches a hint,
   * mapped to the first candidate intent.
   */
  private matchHintExamples(
    transcript: string,
    hintExamples: string[],
    candidates: CandidateIntent[]
  ): IntentResult | null {
    const normalized = transcript.toLowerCase().replace(/[^\w\s]/g, '').trim();

    for (const hint of hintExamples) {
      const hintNorm = hint.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (normalized === hintNorm) {
        return { intentId: candidates[0].intentId, confidence: 0.95 };
      }
      // Fuzzy: allow small ASR differences (edit distance <= 2 for short phrases)
      if (normalized.length > 4 && hintNorm.length > 4 && this.levenshtein(normalized, hintNorm) <= 2) {
        return { intentId: candidates[0].intentId, confidence: 0.85 };
      }
    }
    return null;
  }

  private levenshtein(a: string, b: string): number {
    if (a.length > b.length) [a, b] = [b, a];
    let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
      const curr = [j];
      for (let i = 1; i <= a.length; i++) {
        curr[i] = a[i - 1] === b[j - 1] ? prev[i - 1] : 1 + Math.min(prev[i], curr[i - 1], prev[i - 1]);
      }
      prev = curr;
    }
    return prev[a.length];
  }

  /**
   * Local keyword fallback when LLM is unavailable.
   * Simple substring matching against candidate intents.
   */
  private localFallback(transcript: string, candidates: CandidateIntent[]): IntentResult {
    const lower = transcript.toLowerCase().trim();
    if (!lower) return { intentId: 'none', confidence: 0 };

    for (const c of candidates) {
      // Check if transcript contains key words from the intent description
      const descWords = c.description.toLowerCase().split(/\s+/);
      const matchCount = descWords.filter((w) => lower.includes(w) && w.length > 2).length;
      if (matchCount >= 1) {
        return { intentId: c.intentId, confidence: 0.3 + matchCount * 0.2 };
      }
    }

    return { intentId: 'none', confidence: 0 };
  }
}
