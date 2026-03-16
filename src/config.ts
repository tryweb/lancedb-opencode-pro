import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "@opencode-ai/sdk";
import type { MemoryRuntimeConfig, RetrievalMode } from "./types.js";
import { clamp, expandHomePath, parseJsonObject, toBoolean, toNumber } from "./utils.js";

const DEFAULT_DB_PATH = "~/.opencode/memory/lancedb";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
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

  return {
    provider,
    dbPath,
    embedding: {
      provider: "ollama",
      model: firstString(process.env.LANCEDB_OPENCODE_PRO_EMBEDDING_MODEL, embeddingRaw.model) ?? "nomic-embed-text",
      baseUrl: firstString(process.env.LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL, embeddingRaw.baseUrl) ?? DEFAULT_OLLAMA_BASE_URL,
      timeoutMs: Math.max(
        500,
        Math.floor(toNumber(process.env.LANCEDB_OPENCODE_PRO_EMBEDDING_TIMEOUT_MS ?? embeddingRaw.timeoutMs, 6000)),
      ),
    },
    retrieval: {
      mode,
      vectorWeight: normalizedVectorWeight,
      bm25Weight: normalizedBm25Weight,
      minScore: clamp(toNumber(process.env.LANCEDB_OPENCODE_PRO_MIN_SCORE ?? retrievalRaw.minScore, 0.2), 0, 1),
    },
    includeGlobalScope: toBoolean(process.env.LANCEDB_OPENCODE_PRO_INCLUDE_GLOBAL_SCOPE ?? raw.includeGlobalScope, true),
    minCaptureChars: Math.max(
      30,
      Math.floor(toNumber(process.env.LANCEDB_OPENCODE_PRO_MIN_CAPTURE_CHARS ?? raw.minCaptureChars, 80)),
    ),
    maxEntriesPerScope: Math.max(
      50,
      Math.floor(toNumber(process.env.LANCEDB_OPENCODE_PRO_MAX_ENTRIES_PER_SCOPE ?? raw.maxEntriesPerScope, 3000)),
    ),
  };
}

function loadSidecarConfig(worktree?: string): Record<string, unknown> {
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
