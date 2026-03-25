import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "@opencode-ai/sdk";
import type { EmbeddingProvider, InjectionMode, SummarizationMode, CodeTruncationMode, MemoryRuntimeConfig, RetrievalMode } from "./types.js";
import { clamp, expandHomePath, parseJsonObject, toBoolean, toNumber } from "./utils.js";

const DEFAULT_DB_PATH = "~/.opencode/memory/lancedb";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const SIDECAR_FILE = "lancedb-opencode-pro.json";

export function resolveMemoryConfig(config: Config | undefined, worktree?: string): MemoryRuntimeConfig {
  const legacyRaw = ((config as unknown as Record<string, unknown> | undefined)?.memory ?? {}) as Record<string, unknown>;
  const sidecarRaw = loadSidecarConfig(worktree);
  const raw = mergeMemoryConfig(legacyRaw, sidecarRaw);
  const embeddingRaw = (raw.embedding ?? {}) as Record<string, unknown>;
  const retrievalRaw = (raw.retrieval ?? {}) as Record<string, unknown>;

  const modeRaw = firstString(process.env.LANCEDB_OPENCODE_PRO_RETRIEVAL_MODE, retrievalRaw.mode) ?? "hybrid";
  const mode: RetrievalMode = modeRaw === "vector" ? "vector" : "hybrid";

  const provider = firstString(process.env.LANCEDB_OPENCODE_PRO_PROVIDER, raw.provider) ?? "lancedb-opencode-pro";

  const dbPath = expandHomePath(firstString(process.env.LANCEDB_OPENCODE_PRO_DB_PATH, raw.dbPath) ?? DEFAULT_DB_PATH);

  const vectorWeight = clamp(toNumber(process.env.LANCEDB_OPENCODE_PRO_VECTOR_WEIGHT ?? retrievalRaw.vectorWeight, 0.7), 0, 1);
  const bm25Weight = clamp(toNumber(process.env.LANCEDB_OPENCODE_PRO_BM25_WEIGHT ?? retrievalRaw.bm25Weight, 0.3), 0, 1);
  const weightSum = vectorWeight + bm25Weight;
  const normalizedVectorWeight = weightSum > 0 ? vectorWeight / weightSum : 0.7;
  const normalizedBm25Weight = weightSum > 0 ? bm25Weight / weightSum : 0.3;
  const rrfK = Math.max(1, Math.floor(toNumber(process.env.LANCEDB_OPENCODE_PRO_RRF_K ?? retrievalRaw.rrfK, 60)));
  const recencyBoost = toBoolean(process.env.LANCEDB_OPENCODE_PRO_RECENCY_BOOST ?? retrievalRaw.recencyBoost, true);
  const recencyHalfLifeHours = Math.max(
    1,
    toNumber(process.env.LANCEDB_OPENCODE_PRO_RECENCY_HALF_LIFE_HOURS ?? retrievalRaw.recencyHalfLifeHours, 72),
  );
  const importanceWeight = clamp(
    toNumber(process.env.LANCEDB_OPENCODE_PRO_IMPORTANCE_WEIGHT ?? retrievalRaw.importanceWeight, 0.4),
    0,
    2,
  );

  const embeddingProvider = resolveEmbeddingProvider(
    firstString(process.env.LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER, embeddingRaw.provider),
  );
  const embeddingModel =
    embeddingProvider === "openai"
      ? firstString(
          process.env.LANCEDB_OPENCODE_PRO_OPENAI_MODEL,
          process.env.LANCEDB_OPENCODE_PRO_EMBEDDING_MODEL,
          embeddingRaw.model,
        )
      : firstString(process.env.LANCEDB_OPENCODE_PRO_EMBEDDING_MODEL, embeddingRaw.model) ?? "nomic-embed-text";
  const embeddingBaseUrl =
    embeddingProvider === "openai"
      ? firstString(process.env.LANCEDB_OPENCODE_PRO_OPENAI_BASE_URL, embeddingRaw.baseUrl) ?? DEFAULT_OPENAI_BASE_URL
      : firstString(process.env.LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL, embeddingRaw.baseUrl) ?? DEFAULT_OLLAMA_BASE_URL;
  const embeddingApiKey =
    embeddingProvider === "openai"
      ? firstString(process.env.LANCEDB_OPENCODE_PRO_OPENAI_API_KEY, embeddingRaw.apiKey)
      : undefined;
  const timeoutEnv =
    embeddingProvider === "openai"
      ? process.env.LANCEDB_OPENCODE_PRO_OPENAI_TIMEOUT_MS ?? process.env.LANCEDB_OPENCODE_PRO_EMBEDDING_TIMEOUT_MS
      : process.env.LANCEDB_OPENCODE_PRO_EMBEDDING_TIMEOUT_MS;
  const timeoutRaw = timeoutEnv ?? embeddingRaw.timeoutMs;

  const injection = resolveInjectionConfig(raw, process.env);

  const resolvedConfig: MemoryRuntimeConfig = {
    provider,
    dbPath,
    embedding: {
      provider: embeddingProvider,
      model: embeddingModel ?? "",
      baseUrl: embeddingBaseUrl,
      apiKey: embeddingApiKey,
      timeoutMs: Math.max(
        500,
        Math.floor(toNumber(timeoutRaw, 6000)),
      ),
    },
    retrieval: {
      mode,
      vectorWeight: normalizedVectorWeight,
      bm25Weight: normalizedBm25Weight,
      minScore: clamp(toNumber(process.env.LANCEDB_OPENCODE_PRO_MIN_SCORE ?? retrievalRaw.minScore, 0.2), 0, 1),
      rrfK,
      recencyBoost,
      recencyHalfLifeHours,
      importanceWeight,
    },
    injection,
    includeGlobalScope: toBoolean(process.env.LANCEDB_OPENCODE_PRO_INCLUDE_GLOBAL_SCOPE ?? raw.includeGlobalScope, true),
    globalDetectionThreshold: Math.max(
      1,
      Math.floor(toNumber(process.env.LANCEDB_OPENCODE_PRO_GLOBAL_DETECTION_THRESHOLD ?? raw.globalDetectionThreshold, 2)),
    ),
    globalDiscountFactor: clamp(
      toNumber(process.env.LANCEDB_OPENCODE_PRO_GLOBAL_DISCOUNT_FACTOR ?? raw.globalDiscountFactor, 0.7),
      0,
      1,
    ),
    unusedDaysThreshold: Math.max(
      1,
      Math.floor(toNumber(process.env.LANCEDB_OPENCODE_PRO_UNUSED_DAYS_THRESHOLD ?? raw.unusedDaysThreshold, 30)),
    ),
    minCaptureChars: Math.max(
      30,
      Math.floor(toNumber(process.env.LANCEDB_OPENCODE_PRO_MIN_CAPTURE_CHARS ?? raw.minCaptureChars, 80)),
    ),
    maxEntriesPerScope: Math.max(
      50,
      Math.floor(toNumber(process.env.LANCEDB_OPENCODE_PRO_MAX_ENTRIES_PER_SCOPE ?? raw.maxEntriesPerScope, 3000)),
    ),
  };

  validateEmbeddingConfig(resolvedConfig.embedding);
  return resolvedConfig;
}

function resolveEmbeddingProvider(raw: string | undefined): EmbeddingProvider {
  if (!raw || raw === "ollama") return "ollama";
  if (raw === "openai") return "openai";
  throw new Error(
    `[lancedb-opencode-pro] Invalid embedding provider "${raw}". Expected "ollama" or "openai".`,
  );
}

function resolveInjectionMode(raw: unknown): InjectionMode {
  if (raw === "fixed" || raw === "budget" || raw === "adaptive") return raw;
  return "fixed";
}

function resolveSummarizationMode(raw: unknown): SummarizationMode {
  if (raw === "none" || raw === "truncate" || raw === "extract" || raw === "auto") return raw;
  return "none";
}

function resolveCodeTruncationMode(raw: unknown): CodeTruncationMode {
  if (raw === "smart" || raw === "signature" || raw === "preserve") return raw;
  return "smart";
}

function resolveInjectionConfig(
  raw: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): import("./types.js").InjectionConfig {
  const injectionRaw = (raw.injection ?? {}) as Record<string, unknown>;
  const codeSummarizationRaw = (injectionRaw.codeSummarization ?? {}) as Record<string, unknown>;

  return {
    mode: resolveInjectionMode(env.LANCEDB_OPENCODE_PRO_INJECTION_MODE ?? injectionRaw.mode),
    maxMemories: Math.max(1, Math.floor(toNumber(env.LANCEDB_OPENCODE_PRO_INJECTION_MAX_MEMORIES ?? injectionRaw.maxMemories, 3))),
    minMemories: Math.max(1, Math.floor(toNumber(env.LANCEDB_OPENCODE_PRO_INJECTION_MIN_MEMORIES ?? injectionRaw.minMemories, 1))),
    budgetTokens: Math.max(256, Math.floor(toNumber(env.LANCEDB_OPENCODE_PRO_INJECTION_BUDGET_TOKENS ?? injectionRaw.budgetTokens, 4096))),
    maxCharsPerMemory: Math.max(100, Math.floor(toNumber(env.LANCEDB_OPENCODE_PRO_INJECTION_MAX_CHARS ?? injectionRaw.maxCharsPerMemory, 1200))),
    summarization: resolveSummarizationMode(env.LANCEDB_OPENCODE_PRO_INJECTION_SUMMARIZATION ?? injectionRaw.summarization),
    summaryTargetChars: Math.max(50, Math.floor(toNumber(env.LANCEDB_OPENCODE_PRO_INJECTION_SUMMARY_TARGET_CHARS ?? injectionRaw.summaryTargetChars, 300))),
    scoreDropTolerance: clamp(toNumber(env.LANCEDB_OPENCODE_PRO_INJECTION_SCORE_DROP_TOLERANCE ?? injectionRaw.scoreDropTolerance, 0.15), 0, 1),
    injectionFloor: clamp(toNumber(env.LANCEDB_OPENCODE_PRO_INJECTION_FLOOR ?? injectionRaw.injectionFloor, 0.2), 0, 1),
    codeSummarization: {
      enabled: toBoolean(env.LANCEDB_OPENCODE_PRO_CODE_SUMMARIZATION_ENABLED ?? codeSummarizationRaw.enabled, true),
      pureCodeThreshold: Math.max(100, Math.floor(toNumber(codeSummarizationRaw.pureCodeThreshold, 500))),
      maxCodeLines: Math.max(5, Math.floor(toNumber(codeSummarizationRaw.maxCodeLines, 15))),
      codeTruncationMode: resolveCodeTruncationMode(codeSummarizationRaw.codeTruncationMode),
      preserveComments: toBoolean(codeSummarizationRaw.preserveComments, true),
      preserveImports: toBoolean(codeSummarizationRaw.preserveImports, false),
    },
  };
}

function validateEmbeddingConfig(embedding: MemoryRuntimeConfig["embedding"]): void {
  if (embedding.provider !== "openai") return;
  if (!embedding.apiKey) {
    throw new Error(
      "[lancedb-opencode-pro] OpenAI embedding provider requires apiKey. Set embedding.apiKey or LANCEDB_OPENCODE_PRO_OPENAI_API_KEY.",
    );
  }
  if (!embedding.model) {
    throw new Error(
      "[lancedb-opencode-pro] OpenAI embedding provider requires model. Set embedding.model or LANCEDB_OPENCODE_PRO_OPENAI_MODEL.",
    );
  }
}

function loadSidecarConfig(worktree?: string): Record<string, unknown> {
  if (process.env.LANCEDB_OPENCODE_PRO_SKIP_SIDECAR === "true") {
    return {};
  }

  const configPath = firstString(process.env.LANCEDB_OPENCODE_PRO_CONFIG_PATH);
  const candidates = [
    join(expandHomePath("~/.opencode"), SIDECAR_FILE),
    join(expandHomePath("~/.config/opencode"), SIDECAR_FILE),
    worktree ? join(worktree, ".opencode", SIDECAR_FILE) : undefined,
    configPath,
  ];

  let merged: Record<string, unknown> = {};

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = readConfigFile(candidate);
    if (parsed) {
      merged = mergeMemoryConfig(merged, parsed);
    }
  }

  return merged;
}

function readConfigFile(filePath: string): Record<string, unknown> | null {
  const expanded = expandHomePath(filePath);
  if (!existsSync(expanded)) return null;
  try {
    return parseJsonObject<Record<string, unknown>>(readFileSync(expanded, "utf8"), {});
  } catch {
    return null;
  }
}

function mergeMemoryConfig(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...base,
    ...override,
    embedding: {
      ...((base.embedding ?? {}) as Record<string, unknown>),
      ...((override.embedding ?? {}) as Record<string, unknown>),
    },
    retrieval: {
      ...((base.retrieval ?? {}) as Record<string, unknown>),
      ...((override.retrieval ?? {}) as Record<string, unknown>),
    },
    injection: {
      ...((base.injection ?? {}) as Record<string, unknown>),
      ...((override.injection ?? {}) as Record<string, unknown>),
      codeSummarization: {
        ...(((base.injection ?? {}) as Record<string, unknown>).codeSummarization ?? {}) as Record<string, unknown>,
        ...(((override.injection ?? {}) as Record<string, unknown>).codeSummarization ?? {}) as Record<string, unknown>,
      },
    },
  };
}

function firstString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}