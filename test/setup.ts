import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStore } from "../src/store.js";
import type { EffectivenessSummary, MemoryCategory, MemoryEffectivenessEvent, MemoryRecord, RecallSource } from "../src/types.js";

const DEFAULT_VECTOR_DIM = 384;
const DEFAULT_EMBEDDING_MODEL = "test-embedding-model";

export async function createTempDbPath(prefix = "lancedb-opencode-pro-test-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function createTestStore(dbPath?: string): Promise<{ store: MemoryStore; dbPath: string }> {
  const resolvedPath = dbPath ?? (await createTempDbPath());
  const store = new MemoryStore(resolvedPath);
  await store.init(DEFAULT_VECTOR_DIM);
  return { store, dbPath: resolvedPath };
}

export async function cleanupDbPath(dbPath: string): Promise<void> {
  // Small delay to allow LanceDB to finish any pending I/O operations
  await new Promise((resolve) => setTimeout(resolve, 50));
  try {
    await rm(dbPath, { recursive: true, force: true });
  } catch (error: unknown) {
    // Retry once after a longer delay if ENOTEMPTY (race condition with LanceDB)
    if (error instanceof Error && error.message.includes("ENOTEMPTY")) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await rm(dbPath, { recursive: true, force: true });
    } else {
      throw error;
    }
  }
}

export async function seedLegacyMemoriesTable(dbPath: string, scope = "project:legacy"): Promise<void> {
  const lancedb = await import("@lancedb/lancedb");
  const connection = await lancedb.connect(dbPath);
  await connection.createTable("memories", [
    {
      id: "legacy-memory-1",
      text: "Legacy memory without usage tracking fields",
      vector: Array.from({ length: DEFAULT_VECTOR_DIM }, () => 0.1),
      category: "fact",
      scope,
      importance: 0.5,
      timestamp: 1_000,
      schemaVersion: 1,
      embeddingModel: "test-embedding-model",
      vectorDim: DEFAULT_VECTOR_DIM,
      metadataJson: "{}",
    },
  ]);
}

export async function seedLegacyEffectivenessEventsTable(dbPath: string, scope = "project:legacy"): Promise<void> {
  const lancedb = await import("@lancedb/lancedb");
  const connection = await lancedb.connect(dbPath);
  await connection.createTable("effectiveness_events", [
    {
      id: "legacy-recall-1",
      type: "recall",
      scope,
      sessionID: "sess-legacy",
      timestamp: 1_000,
      memoryId: "",
      text: "",
      outcome: "",
      skipReason: "",
      resultCount: 0,
      injected: false,
      feedbackType: "",
      helpful: -1,
      reason: "",
      labelsJson: "[]",
      metadataJson: "{}",
    },
  ]);
}

export function createVector(dim = DEFAULT_VECTOR_DIM, seed = 0.1): number[] {
  return Array.from({ length: dim }, (_, index) => Number((seed + index * 0.0001).toFixed(6)));
}

export function createTestRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const vector = overrides.vector ?? createVector();
  return {
    id: overrides.id ?? randomUUID(),
    text: overrides.text ?? "Test record content",
    vector,
    category: overrides.category ?? "fact",
    scope: overrides.scope ?? "project:test",
    importance: overrides.importance ?? 0.5,
    timestamp: overrides.timestamp ?? Date.now(),
    lastRecalled: overrides.lastRecalled ?? 0,
    recallCount: overrides.recallCount ?? 0,
    projectCount: overrides.projectCount ?? 0,
    schemaVersion: overrides.schemaVersion ?? 1,
    embeddingModel: overrides.embeddingModel ?? DEFAULT_EMBEDDING_MODEL,
    vectorDim: overrides.vectorDim ?? vector.length,
    metadataJson: overrides.metadataJson ?? "{}",
  };
}

export function assertRecordsMatch(actual: MemoryRecord, expected: MemoryRecord): void {
  assert.equal(actual.id, expected.id);
  assert.equal(actual.text, expected.text);
  assert.equal(actual.category, expected.category);
  assert.equal(actual.scope, expected.scope);
  assert.equal(actual.importance, expected.importance);
  assert.equal(actual.timestamp, expected.timestamp);
  assert.equal(actual.lastRecalled, expected.lastRecalled);
  assert.equal(actual.recallCount, expected.recallCount);
  assert.equal(actual.projectCount, expected.projectCount);
  assert.equal(actual.schemaVersion, expected.schemaVersion);
  assert.equal(actual.embeddingModel, expected.embeddingModel);
  assert.equal(actual.vectorDim, expected.vectorDim);
  assert.equal(actual.metadataJson, expected.metadataJson);
  assert.equal(actual.vector.length, expected.vector.length);
  actual.vector.forEach((value, index) => {
    assert.ok(Math.abs(value - expected.vector[index]) < 0.00001, `vector mismatch at index ${index}`);
  });
}

export function createScopedRecords(scope: string, count: number, category: MemoryCategory = "fact"): MemoryRecord[] {
  return Array.from({ length: count }, (_, index) =>
    createTestRecord({
      id: `${scope}-${index}`,
      text: `Record ${index} for ${scope}`,
      scope,
      category,
      timestamp: 1_000 + index,
      metadataJson: JSON.stringify({ scope, index }),
    }),
  );
}

export function createTestEvent(overrides: Partial<MemoryEffectivenessEvent> = {}): MemoryEffectivenessEvent {
  const base = {
    id: randomUUID(),
    scope: "project:test",
    sessionID: "sess-test",
    timestamp: Date.now(),
    metadataJson: "{}",
  };

  if (overrides.type === "recall") {
    const sourceRaw = overrides.source;
    const source: RecallSource = sourceRaw === "manual-search" ? "manual-search" : "system-transform";
    return {
      id: overrides.id ?? base.id,
      scope: overrides.scope ?? base.scope,
      sessionID: overrides.sessionID ?? base.sessionID,
      timestamp: overrides.timestamp ?? base.timestamp,
      memoryId: overrides.memoryId,
      text: overrides.text,
      metadataJson: overrides.metadataJson ?? base.metadataJson,
      type: "recall",
      resultCount: overrides.resultCount ?? 1,
      injected: overrides.injected ?? true,
      source,
    };
  }

  if (overrides.type === "feedback") {
    return {
      id: overrides.id ?? base.id,
      scope: overrides.scope ?? base.scope,
      sessionID: overrides.sessionID ?? base.sessionID,
      timestamp: overrides.timestamp ?? base.timestamp,
      memoryId: overrides.memoryId,
      text: overrides.text,
      metadataJson: overrides.metadataJson ?? base.metadataJson,
      type: "feedback",
      feedbackType: overrides.feedbackType ?? "missing",
      helpful: overrides.helpful,
      labels: overrides.labels ?? [],
      reason: overrides.reason,
    };
  }

  return {
    id: overrides.id ?? base.id,
    scope: overrides.scope ?? base.scope,
    sessionID: overrides.sessionID ?? base.sessionID,
    timestamp: overrides.timestamp ?? base.timestamp,
    memoryId: overrides.memoryId,
    text: overrides.text ?? "Captured memory",
    metadataJson: overrides.metadataJson ?? base.metadataJson,
    type: "capture",
    outcome: overrides.type === "capture" ? overrides.outcome ?? "stored" : "stored",
    skipReason: overrides.type === "capture" ? overrides.skipReason : undefined,
  };
}

export function createEffectivenessSummary(overrides: Partial<EffectivenessSummary> = {}): EffectivenessSummary {
  return {
    scope: "project:test",
    totalEvents: 0,
    capture: {
      considered: 0,
      stored: 0,
      skipped: 0,
      successRate: 0,
      skipReasons: {},
    },
    recall: {
      requested: 0,
      injected: 0,
      returnedResults: 0,
      hitRate: 0,
      injectionRate: 0,
      auto: {
        requested: 0,
        injected: 0,
        returnedResults: 0,
        hitRate: 0,
        injectionRate: 0,
      },
      manual: {
        requested: 0,
        returnedResults: 0,
        hitRate: 0,
      },
      manualRescueRatio: 0,
    },
    feedback: {
      missing: 0,
      wrong: 0,
      useful: {
        positive: 0,
        negative: 0,
        helpfulRate: 0,
      },
      falsePositiveRate: 0,
      falseNegativeRate: 0,
    },
    ...overrides,
  };
}
