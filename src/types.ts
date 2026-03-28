export type EmbeddingProvider = "ollama" | "openai";

export type RetrievalMode = "hybrid" | "vector";

export type InjectionMode = "fixed" | "budget" | "adaptive";

export type SummarizationMode = "none" | "truncate" | "extract" | "auto";

export type CodeTruncationMode = "smart" | "signature" | "preserve";

export type ContentType = "text" | "code" | "mixed";

export interface ContentDetection {
  hasCode: boolean;
  isPureCode: boolean;
}

export interface SummarizedContent {
  type: "kept" | "truncated" | "summarized" | "mixed";
  content: string;
  originalLength: number;
  estimatedTokens: number;
}

export type MemoryCategory = "preference" | "fact" | "decision" | "entity" | "other";

export type CaptureOutcome = "considered" | "skipped" | "stored";

export type CaptureSkipReason =
  | "empty-buffer"
  | "below-min-chars"
  | "no-positive-signal"
  | "initialization-unavailable"
  | "embedding-unavailable"
  | "empty-embedding"
  | "duplicate-similarity"
  | "duplicate-exact";

export type FeedbackType = "missing" | "wrong" | "useful";

export type RecallSource = "system-transform" | "manual-search";

export type MemoryScope = "project" | "global";

export type SchemaVersion = 1 | 2;

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

export interface CodeSummarizationConfig {
  enabled: boolean;
  pureCodeThreshold: number;
  maxCodeLines: number;
  codeTruncationMode: CodeTruncationMode;
  preserveComments: boolean;
  preserveImports: boolean;
}

export interface InjectionConfig {
  mode: InjectionMode;
  maxMemories: number;
  minMemories: number;
  budgetTokens: number;
  maxCharsPerMemory: number;
  summarization: SummarizationMode;
  summaryTargetChars: number;
  scoreDropTolerance: number;
  injectionFloor: number;
  codeSummarization: CodeSummarizationConfig;
}

export interface SummarizationConfig {
  mode: SummarizationMode;
  textThreshold: number;
  codeThreshold: number;
  summaryTargetChars: number;
  maxCodeLines: number;
  codeTruncationMode: CodeTruncationMode;
  preserveComments: boolean;
  preserveImports: boolean;
}

export interface DedupConfig {
  enabled: boolean;
  writeThreshold: number;
  consolidateThreshold: number;
}

export interface MemoryRuntimeConfig {
  provider: string;
  dbPath: string;
  embedding: EmbeddingConfig;
  retrieval: RetrievalConfig;
  injection: InjectionConfig;
  dedup: DedupConfig;
  includeGlobalScope: boolean;
  globalDetectionThreshold: number;
  globalDiscountFactor: number;
  unusedDaysThreshold: number;
  minCaptureChars: number;
  maxEntriesPerScope: number;
}

export type MemoryStatus = "active" | "disabled" | "merged";

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
  // Extended fields (optional for backward compatibility)
  userId?: string;
  teamId?: string;
  sourceSessionId?: string;
  confidence?: number;
  tags?: string[];
  status?: MemoryStatus;
  parentId?: string;
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
  // Extended fields (optional for backward compatibility)
  sourceSessionId?: string;
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
  // Extended fields (optional for backward compatibility)
  sourceSessionId?: string;
  confidenceDelta?: number;
  relatedMemoryId?: string;
  context?: Record<string, unknown>;
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
  duplicates: {
    flaggedCount: number;
    consolidatedCount: number;
  };
}

export type PreferenceCategory = "language" | "tool" | "style" | "workflow" | "other";
export type PreferenceScope = "project" | "global";
export type PreferenceSource = "explicit" | "inferred";

export interface PreferenceSignal {
  key: string;
  value: string;
  category: PreferenceCategory;
  source: PreferenceSource;
  timestamp: number;
  memoryId: string;
}

export interface Preference {
  key: string;
  value: string;
  category: PreferenceCategory;
  confidence: number;
  scope: PreferenceScope;
  lastUpdated: number;
  sourceCount: number;
}

export interface PreferenceProfile {
  scope: string;
  preferences: Preference[];
  updatedAt: number;
}

export type TaskState = "pending" | "running" | "success" | "failed" | "timeout";
export type FailureType = "syntax" | "runtime" | "logic" | "resource" | "unknown";
export type ValidationType = "type-check" | "build" | "test";
export type ValidationStatus = "pass" | "fail" | "skipped";

export interface ValidationOutcome {
  type: ValidationType;
  status: ValidationStatus;
  timestamp: number;
  errorCount?: number;
  errorTypes?: string[];
  passedCount?: number;
  failedCount?: number;
  output?: string;
}

export interface SuccessPattern {
  commands: string[];
  tools: string[];
  confidence: number;
  extractedAt: number;
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: number;
  outcome: "success" | "failed" | "abandoned";
  errorMessage?: string;
  failureType?: FailureType;
}

export interface RecoveryStrategy {
  name: string;
  attemptedAt: number;
  succeeded: boolean;
}

export interface RetryBudgetSuggestion {
  suggestedRetries: number;
  confidence: number;
  basedOnCount: number;
  shouldStop: boolean;
  stopReason?: string;
}

export interface StrategySuggestion {
  strategy: string;
  reason: string;
  confidence: number;
  basedOnTask?: string;
}

export interface EpisodicTaskRecord {
  id: string;
  sessionId: string;
  scope: string;
  taskId: string;
  state: TaskState;
  startTime: number;
  endTime?: number;
  failureType?: FailureType;
  errorMessage?: string;
  commandsJson: string;
  validationOutcomesJson: string;
  successPatternsJson: string;
  retryAttemptsJson: string;
  recoveryStrategiesJson: string;
  metadataJson: string;
}
