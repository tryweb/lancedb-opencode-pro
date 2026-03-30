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

export type TaskType = "coding" | "documentation" | "review" | "release" | "general";

export interface InjectionProfile {
  maxMemories: number;
  budgetTokens: number;
  summaryTargetChars: number;
  categoryWeights: Partial<Record<MemoryCategory, number>>;
}

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
  feedbackWeight: number;
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
  taskTypeProfiles: Record<TaskType, InjectionProfile>;
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

export type CitationSource = "auto-capture" | "explicit-remember" | "import" | "external";

export type CitationStatus = "verified" | "pending" | "invalid" | "expired";

export interface CitationRecord {
  source: CitationSource;
  timestamp: number;
  status: CitationStatus;
  chain: string[];
  verifiedAt?: number;
  expiresAt?: number;
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
  // Extended fields (optional for backward compatibility)
  userId?: string;
  teamId?: string;
  sourceSessionId?: string;
  confidence?: number;
  tags?: string[];
  status?: MemoryStatus;
  parentId?: string;
  // Citation fields
  citationSource?: CitationSource;
  citationTimestamp?: number;
  citationStatus?: CitationStatus;
  citationChain?: string[];
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

export type TrendDirection = "improving" | "stable" | "declining" | "insufficient-data";

export interface TrendIndicator {
  direction: TrendDirection;
  percentageChange: number;
}

export interface MemoryFeedbackStats {
  memoryId: string;
  helpful: number;
  unhelpful: number;
  wrong: number;
  helpfulRate: number;
  feedbackFactor: number;
}

export interface DashboardSummary {
  scope: string;
  periodDays: number;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  previousPeriodStart: number;
  previousPeriodEnd: number;
  current: EffectivenessSummary;
  previous: EffectivenessSummary | null;
  trends: {
    captureSuccessRate: TrendIndicator;
    recallHitRate: TrendIndicator;
    feedbackHelpfulRate: TrendIndicator;
  };
  insights: string[];
  recentMemories: {
    total: number;
    byCategory: Partial<Record<MemoryCategory, { count: number; samples: string[] }>>;
  };
}

export interface RetryToSuccessMetric {
  status: "ok" | "insufficient-data" | "no-failed-tasks";
  rate: number;
  totalFailedTasks: number;
  succeededAfterRetry: number;
  sampleCount: number;
}

export interface MemoryLiftMetric {
  status: "ok" | "insufficient-data" | "no-recall-data";
  lift: number;
  successRateWithRecall: number;
  successRateWithoutRecall: number;
  withRecallCount: number;
  withoutRecallCount: number;
}

export interface KpiSummary {
  scope: string;
  periodDays: number;
  retryToSuccess: RetryToSuccessMetric;
  memoryLift: MemoryLiftMetric;
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


// === Episodic Record Runtime Validation (BL-046) ===

import { z } from "zod";

const ValidationOutcomeSchema = z.object({
  type: z.enum(["type-check", "build", "test"]),
  status: z.enum(["pass", "fail", "skipped"]),
  timestamp: z.number(),
  errorCount: z.number().optional(),
  errorTypes: z.array(z.string()).optional(),
  passedCount: z.number().optional(),
  failedCount: z.number().optional(),
  output: z.string().optional(),
});

const SuccessPatternSchema = z.object({
  commands: z.array(z.string()),
  tools: z.array(z.string()),
  confidence: z.number(),
  extractedAt: z.number(),
});

const RetryAttemptSchema = z.object({
  attemptNumber: z.number(),
  timestamp: z.number(),
  outcome: z.enum(["success", "failed", "abandoned"]),
  errorMessage: z.string().nullish(),
  failureType: z.enum(["syntax", "runtime", "logic", "resource", "unknown"]).nullish(),
});

const RecoveryStrategySchema = z.object({
  name: z.string(),
  attemptedAt: z.number(),
  succeeded: z.boolean(),
});

const EpisodicTaskRecordBaseSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  scope: z.string(),
  taskId: z.string(),
  state: z.enum(["pending", "running", "success", "failed", "timeout"]),
  startTime: z.number(),
  endTime: z.number().nullish(),
  failureType: z.enum(["syntax", "runtime", "logic", "resource", "unknown"]).nullish(),
  errorMessage: z.string().nullish(),
  commandsJson: z.string(),
  validationOutcomesJson: z.string(),
  successPatternsJson: z.string(),
  retryAttemptsJson: z.string(),
  recoveryStrategiesJson: z.string(),
  metadataJson: z.string(),
  taskDescriptionVector: z.array(z.number()).nullish(),
});

// JSON fields stay as strings — use parseMetadata() / JSON.parse() at call sites
export type EpisodicTaskRecord = z.infer<typeof EpisodicTaskRecordBaseSchema>;

export function validateEpisodicRecord(raw: unknown): EpisodicTaskRecord {
  return EpisodicTaskRecordBaseSchema.parse(raw);
}

export function validateEpisodicRecordArray(raw: unknown): EpisodicTaskRecord[] {
  return z.array(EpisodicTaskRecordBaseSchema).parse(raw);
}

// === Memory Explanation Types ===

export interface RecallFactors {
  relevance: {
    overall: number;
    vectorScore: number;
    bm25Score: number;
  };
  recency: {
    timestamp: number;
    ageHours: number;
    withinHalfLife: boolean;
    decayFactor: number;
  };
  citation?: {
    source?: CitationSource;
    status?: CitationStatus;
    timestamp?: number;
  };
  importance: number;
  scope: {
    memoryScope: string;
    matchesCurrentScope: boolean;
    isGlobal: boolean;
  };
}

export interface MemoryExplanation {
  memoryId: string;
  text: string;
  factors: RecallFactors;
  generatedAt: number;
}

export interface LastRecallSession {
  timestamp: number;
  query: string;
  results: Array<{
    memoryId: string;
    score: number;
    factors: RecallFactors;
  }>;
}
