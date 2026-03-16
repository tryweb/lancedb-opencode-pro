export type EmbeddingProvider = "ollama";

export type RetrievalMode = "hybrid" | "vector";

export type MemoryCategory = "preference" | "fact" | "decision" | "entity" | "other";

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface RetrievalConfig {
  mode: RetrievalMode;
  vectorWeight: number;
  bm25Weight: number;
  minScore: number;
}

export interface MemoryRuntimeConfig {
  provider: string;
  dbPath: string;
  embedding: EmbeddingConfig;
  retrieval: RetrievalConfig;
  includeGlobalScope: boolean;
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
