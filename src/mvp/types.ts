export type ScaffoldLevel = 0 | 1 | 2 | 3 | 4;
export type ProductionLevel = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
export type TutorAction = 'continue' | 'follow_up' | 'scaffold' | 'recast' | 'challenge' | 'transfer' | 'complete';

export type ConceptId =
  | 'because'
  | 'should'
  | 'need'
  | 'wh_question'
  | 'yes_no_question'
  | 'prepositions'
  | 'comparative'
  | 'space_vocab';

export interface ConceptState {
  conceptId: ConceptId;
  mastery: number;
  independentSuccesses: number;
  scaffoldedSuccesses: number;
  failures: number;
  transferSuccesses: number;
  lastSeen: string | null;
  lastScaffoldLevel: ScaffoldLevel;
}

export interface LearnerState {
  version: 1;
  concepts: Record<ConceptId, ConceptState>;
}

export interface TurnAnalysis {
  transcript: string;
  normalized: string;
  conceptsUsed: ConceptId[];
  productionLevel: ProductionLevel;
  meaningful: boolean;
  reasonDetected: boolean;
  questionDetected: boolean;
  targetMeaningDetected: boolean;
}

export interface TutorDecision {
  action: TutorAction;
  scaffoldLevel: ScaffoldLevel;
  reply: string;
  hint?: string;
  analysis: TurnAnalysis;
  success: boolean;
}

export type MissionId = 'listen-explore' | 'ask-robot' | 'prepare-rocket' | 'transfer';

export interface SessionEvent {
  type:
    | 'session_started'
    | 'mission_started'
    | 'world_interaction'
    | 'child_speech'
    | 'scaffold'
    | 'tutor_reply'
    | 'mission_completed'
    | 'transfer_completed'
    | 'session_completed'
    | 'rating';
  timestamp: string;
  missionId?: MissionId;
  payload?: Record<string, unknown>;
}

export interface SessionSummary {
  sessionId: string;
  startedAt: string;
  completedAt?: string;
  speakingTurns: number;
  independentGenerated: number;
  hintsUsed: number;
  transferSuccess: boolean;
  rating?: 'loved' | 'okay' | 'hard';
  events: SessionEvent[];
}
