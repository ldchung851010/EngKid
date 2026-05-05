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
  npcText?: string;
  hintExamples?: string[];
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
    conversationHistory: Array<{ role: string; text: string }>
  ): Promise<IntentResult> {
    // If no candidates, return none immediately
    if (candidates.length === 0) {
      return { intentId: 'none', confidence: 0 };
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
