import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore } from "../../src/store.js";

interface MockTable {
  listIndices(): Promise<Array<{ name: string }>>;
  createIndex(column: string, options?: Record<string, unknown>): Promise<void>;
  add(rows: unknown[]): Promise<void>;
  delete(filter: string): Promise<void>;
  schema(): Promise<{ fields: Array<{ name: string }> }>;
  query(): {
    where(expr: string): ReturnType<MockTable["query"]>;
    select(columns: string[]): ReturnType<MockTable["query"]>;
    limit(n: number): ReturnType<MockTable["query"]>;
    toArray(): Promise<Array<Record<string, unknown>>>;
  };
}

function makeMockTable(overrides: Partial<MockTable> = {}): MockTable {
  const q: ReturnType<MockTable["query"]> = {
    where(_: string) { return q; },
    select(_: string[]) { return q; },
    limit(_: number) { return q; },
    async toArray() { return []; },
  };
  const base: MockTable = {
    async listIndices() { return []; },
    async createIndex() {},
    async add() {},
    async delete() {},
    async schema() { return { fields: [] }; },
    query() { return q; },
  };
  return { ...base, ...overrides };
}

function asInternal(store: MemoryStore): Record<string, unknown> {
  return store as unknown as Record<string, unknown>;
}

function makeStore(): MemoryStore {
  const store = new MemoryStore("/tmp/unused-no-init");
  const internal = asInternal(store);
  internal.indexState = { vector: false, fts: false, ftsError: "", vectorRetries: 0, ftsRetries: 0 };
  internal.lancedb = null;
  return store;
}

test("isCommitConflict: detects 'Retryable commit conflict' message", () => {
  const store = makeStore();
  const fn = (asInternal(store).isCommitConflict as (msg: string) => boolean).bind(store);

  assert.ok(fn("lance error: Retryable commit conflict for version 3010: This CreateIndex transaction was preempted by concurrent transaction"));
  assert.ok(fn("Retryable commit conflict"));
  assert.ok(!fn("Not enough rows to train PQ"));
  assert.ok(!fn("Creating empty vector indices with train=False"));
});

test("isCommitConflict: detects 'preempted by concurrent transaction' message", () => {
  const store = makeStore();
  const fn = (asInternal(store).isCommitConflict as (msg: string) => boolean).bind(store);

  assert.ok(fn("preempted by concurrent transaction CreateIndex at version 42"));
  assert.ok(!fn("timeout error"));
});

test("createVectorIndexWithRetry: commit-conflict on first attempt, index exists on re-verify → vector = true", async () => {
  const store = makeStore();

  let listCallCount = 0;
  const table = makeMockTable({
    async listIndices() {
      listCallCount++;
      if (listCallCount === 1) return [];
      return [{ name: "vector" }];
    },
    async createIndex() {
      throw new Error("Retryable commit conflict for version 99: preempted by concurrent transaction CreateIndex");
    },
  });

  const internal = asInternal(store);
  await (internal.createVectorIndexWithRetry as (t: MockTable) => Promise<void>).call(store, table);

  const indexState = internal.indexState as { vector: boolean };
  assert.strictEqual(indexState.vector, true, "vector index should be adopted after commit-conflict re-verify");
});

test("createFtsIndexWithRetry: commit-conflict on first attempt, index exists on re-verify → fts = true", async () => {
  const store = makeStore();

  let listCallCount = 0;
  const table = makeMockTable({
    async listIndices() {
      listCallCount++;
      if (listCallCount === 1) return [];
      return [{ name: "text" }];
    },
    async createIndex() {
      throw new Error("Retryable commit conflict for version 42: preempted by concurrent transaction");
    },
  });

  const internal = asInternal(store);
  await (internal.createFtsIndexWithRetry as (t: MockTable) => Promise<void>).call(store, table);

  const indexState = internal.indexState as { fts: boolean; ftsError: string };
  assert.strictEqual(indexState.fts, true, "FTS index should be adopted after commit-conflict re-verify");
  assert.strictEqual(indexState.ftsError, "", "ftsError should be cleared");
});

test("createFtsIndexWithRetry: non-conflict error with absent index on final check → fts = false", async () => {
  const store = makeStore();

  const table = makeMockTable({
    async listIndices() { return []; },
    async createIndex() {
      throw new Error("Not enough rows to train PQ. Requires 256 rows but only 1 available");
    },
  });

  const internal = asInternal(store);
  await (internal.createFtsIndexWithRetry as (t: MockTable) => Promise<void>).call(store, table);

  const indexState = internal.indexState as { fts: boolean; ftsError: string };
  assert.strictEqual(indexState.fts, false, "FTS index should be false when all retries fail with non-conflict error");
  assert.ok(indexState.ftsError.includes("Not enough rows"), "ftsError should contain the last error message");
});

test("createFtsIndexWithRetry: final-pass check adopts index created by concurrent process after retries exhausted", async () => {
  const store = makeStore();

  let listCallCount = 0;
  const table = makeMockTable({
    async listIndices() {
      listCallCount++;
      if (listCallCount <= 4) return [];
      return [{ name: "text" }];
    },
    async createIndex() {
      throw new Error("Retryable commit conflict for version 77");
    },
  });

  const internal = asInternal(store);
  await (internal.createFtsIndexWithRetry as (t: MockTable) => Promise<void>).call(store, table);

  const indexState = internal.indexState as { fts: boolean; ftsError: string };
  assert.strictEqual(indexState.fts, true, "FTS index should be adopted via final-pass check after all retries exhausted");
  assert.strictEqual(indexState.ftsError, "", "ftsError should be cleared when adopted via final-pass");
});
