/**
 * Session-scoped score tracker.
 * Tracks task attempts, completions, and computes session totals.
 */

export interface TaskScore {
  taskId: string;
  attempts: number;
  completed: boolean;
  degraded: boolean;
  score: number;
  vocabularyCoverage?: number; // 0-1, fraction of targetVocabulary words used
}

export interface SessionScore {
  total: number;
  tasks: TaskScore[];
  completedCount: number;
  totalTasks: number;
}

export class ScoreTracker {
  private tasks = new Map<string, TaskScore>();
  private totalScore = 0;

  /** Record an attempt on a task */
  recordAttempt(taskId: string): void {
    const task = this.getOrCreate(taskId);
    task.attempts++;
  }

  /**
   * Mark a task complete with scoring details.
   *
   * @param taskId - Task identifier
   * @param scoreReward - Base score from scene config
   * @param confidence - Intent matching confidence (0-1)
   * @param degraded - True if completed via fallback after retry exhaustion
   * @param transcript - Child's ASR transcript (for vocabulary check)
   * @param targetVocabulary - Target words to check coverage
   */
  completeTask(
    taskId: string,
    scoreReward: number,
    confidence: number,
    degraded: boolean,
    transcript?: string,
    targetVocabulary?: string[]
  ): TaskScore {
    const task = this.getOrCreate(taskId);
    task.completed = true;
    task.degraded = degraded;

    // Compute vocabulary coverage — bonus, not penalty. Matched words boost score.
    let vocabCoverage = 1.0;
    if (targetVocabulary && targetVocabulary.length > 0 && transcript) {
      const lower = transcript.toLowerCase();
      const matched = targetVocabulary.filter((w) => lower.includes(w.toLowerCase()));
      // Bonus: up to +50% for matching all target words
      vocabCoverage = 1.0 + 0.5 * (matched.length / targetVocabulary.length);
    }

    // Score = base × confidence × vocabulary-coverage, halved if degraded
    const multiplier = degraded ? 0.5 : 1.0;
    const rawScore = scoreReward * confidence * vocabCoverage;
    task.score = Math.max(1, Math.round(rawScore * multiplier));
    task.vocabularyCoverage = vocabCoverage;

    this.totalScore += task.score;
    return task;
  }

  /** Get the current session score summary */
  getSessionScore(totalTasks: number): SessionScore {
    const tasks = Array.from(this.tasks.values());
    return {
      total: this.totalScore,
      tasks,
      completedCount: tasks.filter((t) => t.completed).length,
      totalTasks,
    };
  }

  /** Reset tracker for a new session */
  reset(): void {
    this.tasks.clear();
    this.totalScore = 0;
  }

  private getOrCreate(taskId: string): TaskScore {
    if (!this.tasks.has(taskId)) {
      this.tasks.set(taskId, {
        taskId,
        attempts: 0,
        completed: false,
        degraded: false,
        score: 0,
      });
    }
    return this.tasks.get(taskId)!;
  }
}
