import type { MissionId, SessionEvent, SessionSummary } from './types.js';

const LAST_SESSION_KEY = 'engkid.last-session.v1';

export class SessionLogger {
  private summary: SessionSummary;

  constructor() {
    const now = new Date().toISOString();
    this.summary = {
      sessionId: crypto.randomUUID?.() ?? `session-${Date.now()}`,
      startedAt: now,
      speakingTurns: 0,
      independentGenerated: 0,
      hintsUsed: 0,
      transferSuccess: false,
      events: [],
    };
    this.log('session_started');
  }

  log(type: SessionEvent['type'], missionId?: MissionId, payload?: Record<string, unknown>): void {
    this.summary.events.push({ type, missionId, payload, timestamp: new Date().toISOString() });
    this.persist();
  }

  recordSpeech(missionId: MissionId, transcript: string, productionLevel: string, scaffoldLevel: number, success: boolean): void {
    this.summary.speakingTurns += 1;
    if ((productionLevel === 'R3' || productionLevel === 'R4') && scaffoldLevel <= 1 && success) {
      this.summary.independentGenerated += 1;
    }
    this.log('child_speech', missionId, { transcript, productionLevel, scaffoldLevel, success });
  }

  recordHint(missionId: MissionId, scaffoldLevel: number): void {
    this.summary.hintsUsed += 1;
    this.log('scaffold', missionId, { scaffoldLevel });
  }

  completeTransfer(): void {
    this.summary.transferSuccess = true;
    this.log('transfer_completed', 'transfer');
  }

  completeSession(): void {
    this.summary.completedAt = new Date().toISOString();
    this.log('session_completed');
    this.persist();
  }

  setRating(rating: 'loved' | 'okay' | 'hard'): void {
    this.summary.rating = rating;
    this.log('rating', undefined, { rating });
  }

  get snapshot(): SessionSummary {
    return structuredClone(this.summary);
  }

  exportJson(): string {
    return JSON.stringify(this.summary, null, 2);
  }

  private persist(): void {
    try {
      localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(this.summary));
    } catch {
      // Keep running if browser storage is unavailable.
    }
  }
}
