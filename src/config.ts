import type { Config } from "@opencode-ai/sdk";
import type { MemoryRuntimeConfig, RetrievalMode } from "./types.js";
import { clamp, expandHomePath, toNumber } from "./utils.js";

const DEFAULT_DB_PATH = "~/.opencode/memory/lancedb";

export function resolveMemoryConfig(config: Config | undefined): MemoryRuntimeConfig {
  const raw = ((config as unknown as Record<string, unknown> | undefined)?.memory ?? {}) as Record<string, unknown>;
  const embeddingRaw = (raw.embedding ?? {}) as Record<string, unknown>;
  const retrievalRaw = (raw.retrieval ?? {}) as Record<string, unknown>;

  const modeRaw = typeof retrievalRaw.mode === "string" ? retrievalRaw.mode : "hybrid";
  const mode: RetrievalMode = modeRaw === "vector" ? "vector" : "hybrid";

  const provider = typeof raw.provider === "string" && raw.provider.trim().length > 0
    ? raw.provider.trim()
    : "lancedb-opencode-pro";

  const dbPath = expandHomePath(
    typeof raw.dbPath === "string" && raw.dbPath.trim().length > 0 ? raw.dbPath.trim() : DEFAULT_DB_PATH,
  );

  const vectorWeight = clamp(toNumber(retrievalRaw.vectorWeight, 0.7), 0, 1);
  const bm25Weight = clamp(toNumber(retrievalRaw.bm25Weight, 0.3), 0, 1);
  const weightSum = vectorWeight + bm25Weight;
  const normalizedVectorWeight = weightSum > 0 ? vectorWeight / weightSum : 0.7;
  const normalizedBm25Weight = weightSum > 0 ? bm25Weight / weightSum : 0.3;

  return {
    provider,
    dbPath,
    embedding: {
      provider: "ollama",
      model:
        typeof embeddingRaw.model === "string" && embeddingRaw.model.trim().length > 0
          ? embeddingRaw.model.trim()
          : "nomic-embed-text",
      baseUrl:
        typeof embeddingRaw.baseUrl === "string" && embeddingRaw.baseUrl.trim().length > 0
          ? embeddingRaw.baseUrl.trim()
          : "http://127.0.0.1:11434",
      timeoutMs: Math.max(500, Math.floor(toNumber(embeddingRaw.timeoutMs, 6000))),
    },
    retrieval: {
      mode,
      vectorWeight: normalizedVectorWeight,
      bm25Weight: normalizedBm25Weight,
      minScore: clamp(toNumber(retrievalRaw.minScore, 0.2), 0, 1),
    },
    includeGlobalScope: raw.includeGlobalScope !== false,
    minCaptureChars: Math.max(30, Math.floor(toNumber(raw.minCaptureChars, 80))),
    maxEntriesPerScope: Math.max(50, Math.floor(toNumber(raw.maxEntriesPerScope, 3000))),
  };
}
