import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/store.js";
import type { MemoryCategory, MemoryRecord } from "../src/types.js";

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
  await rm(dbPath, { recursive: true, force: true });
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
