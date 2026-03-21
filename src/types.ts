export type EmbeddingProvider = "ollama" | "openai";

export type RetrievalMode = "hybrid" | "vector";

export type MemoryCategory = "preference" | "fact" | "decision" | "entity" | "other";

export type CaptureOutcome = "considered" | "skipped" | "stored";

export type CaptureSkipReason =
  | "empty-buffer"
  | "below-min-chars"
  | "no-positive-signal"
  | "initialization-unavailable"
  | "embedding-unavailable"
  | "empty-embedding";

export type FeedbackType = "missing" | "wrong" | "useful";

export type RecallSource = "system-transform" | "manual-search";

export type MemoryScope = "project" | "global";

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface RetrievalConfig {
  mode: RetrievalMode;
  vectorWeight: number;
  bm25Weight: number;
  minScore: number;
  rrfK: number;
  recencyBoost: boolean;
  recencyHalfLifeHours: number;
  importanceWeight: number;
}

export interface MemoryRuntimeConfig {
  provider: string;
  dbPath: string;
  embedding: EmbeddingConfig;
  retrieval: RetrievalConfig;
  includeGlobalScope: boolean;
  globalDetectionThreshold: number;
  globalDiscountFactor: number;
  unusedDaysThreshold: number;
  minCaptureChars: number;
  maxEntriesPerScope: number;
}

export interface MemoryRecord {
  id: string;
  text: string;
  vector: number[];
  category: MemoryCategory;
  scope: string;
  importance: number;
  timestamp: number;
  lastRecalled: number;
  recallCount: number;
  projectCount: number;
  schemaVersion: number;
  embeddingModel: string;
  vectorDim: number;
  metadataJson: string;
}

export interface SearchResult {
  record: MemoryRecord;
  score: number;
  vectorScore: number;
  bm25Score: number;
}

export interface CaptureCandidate {
  text: string;
  category: MemoryCategory;
  importance: number;
}

export interface CaptureCandidateResult {
  candidate: CaptureCandidate | null;
  skipReason?: CaptureSkipReason;
}

interface MemoryEffectivenessEventBase {
  id: string;
  scope: string;
  sessionID?: string;
  timestamp: number;
  memoryId?: string;
  text?: string;
  metadataJson: string;
}

export interface CaptureEvent extends MemoryEffectivenessEventBase {
  type: "capture";
  outcome: CaptureOutcome;
  skipReason?: CaptureSkipReason;
}

export interface RecallEvent extends MemoryEffectivenessEventBase {
  type: "recall";
  resultCount: number;
  injected: boolean;
  source?: RecallSource;
}

export interface FeedbackEvent extends MemoryEffectivenessEventBase {
  type: "feedback";
  feedbackType: FeedbackType;
  helpful?: boolean;
  labels?: string[];
  reason?: string;
}

export type MemoryEffectivenessEvent = CaptureEvent | RecallEvent | FeedbackEvent;

export interface EffectivenessSummary {
  scope: string;
  totalEvents: number;
  capture: {
    considered: number;
    stored: number;
    skipped: number;
    successRate: number;
    skipReasons: Partial<Record<CaptureSkipReason, number>>;
  };
  recall: {
    requested: number;
    injected: number;
    returnedResults: number;
    hitRate: number;
    injectionRate: number;
    auto: {
      requested: number;
      injected: number;
      returnedResults: number;
      hitRate: number;
      injectionRate: number;
    };
    manual: {
      requested: number;
      returnedResults: number;
      hitRate: number;
    };
    manualRescueRatio: number;
  };
  feedback: {
    missing: number;
    wrong: number;
    useful: {
      positive: number;
      negative: number;
      helpfulRate: number;
    };
    falsePositiveRate: number;
    falseNegativeRate: number;
  };
}
