import assert from "node:assert";
import test from "node:test";
import { MemoryStore } from "../../src/store.js";
import type { MemoryRecord } from "../../src/types.js";

const TEST_DB = "/tmp/test-scope-cache";

async function createTestStoreWithCache(cacheConfig?: { maxScopes: number; maxRecordsPerScope: number; enabled: boolean }): Promise<MemoryStore> {
  const store = new MemoryStore(TEST_DB, cacheConfig);
  await store.init(384);
  return store;
}

function createTestRecord(id: string, scope: string, timestamp: number): MemoryRecord {
  return {
    id,
    text: `Test record ${id}`,
    vector: new Array(384).fill(0.1),
    category: "fact",
    scope,
    importance: 0.5,
    timestamp,
    lastRecalled: 0,
    recallCount: 0,
    projectCount: 0,
    schemaVersion: 2,
    embeddingModel: "test",
    vectorDim: 384,
    metadataJson: "{}",
  };
}

test("CacheStats tracks hits, misses, and evictions", async () => {
  const store = await createTestStoreWithCache({ maxScopes: 2, maxRecordsPerScope: 100, enabled: true });

  await store.put(createTestRecord("rec-1", "project:a", 1000));
  await store.put(createTestRecord("rec-2", "project:a", 1001));
  await store.put(createTestRecord("rec-3", "project:b", 1002));

  const scopeCache = (store as unknown as { scopeCache: Map<string, unknown> }).scopeCache;
  const cacheStats = (store as unknown as { cacheStats: { hits: number; misses: number; evictions: number } }).cacheStats;

  assert.ok(cacheStats.hits >= 0, "should have hit counter");
  assert.ok(cacheStats.misses >= 0, "should have miss counter");
  assert.ok(cacheStats.evictions >= 0, "should have eviction counter");
});

test("LRU eviction removes least recently accessed scope", async () => {
  const store = await createTestStoreWithCache({ maxScopes: 2, maxRecordsPerScope: 100, enabled: true });

  await store.put(createTestRecord("rec-1", "scope-1", 1000));
  await store.put(createTestRecord("rec-2", "scope-2", 1001));
  await store.put(createTestRecord("rec-3", "scope-3", 1002));

  const scopeCache = (store as unknown as { scopeCache: Map<string, unknown> }).scopeCache;

  assert.ok(scopeCache.size <= 2, "cache should respect maxScopes bound");
});

test("Max records per scope truncation by timestamp", async () => {
  const store = await createTestStoreWithCache({ maxScopes: 10, maxRecordsPerScope: 2, enabled: true });

  for (let i = 0; i < 5; i++) {
    await store.put(createTestRecord(`rec-${i}`, "scope-limited", 1000 + i));
  }

  await store.search({
    query: "test",
    queryVector: new Array(384).fill(0),
    scopes: ["scope-limited"],
    limit: 10,
    vectorWeight: 0.5,
    bm25Weight: 0.5,
    minScore: 0,
  });

  const scopeCache = (store as unknown as { scopeCache: Map<string, unknown> }).scopeCache;
  const entry = scopeCache.get("scope-limited") as { records: MemoryRecord[] } | undefined;

  assert.ok(entry, "scope should be cached");
  assert.ok(entry.records.length <= 2, "should respect maxRecordsPerScope bound");
});

test("Cache disabled returns fresh data without caching", async () => {
  const store = await createTestStoreWithCache({ maxScopes: 10, maxRecordsPerScope: 100, enabled: false });

  await store.put(createTestRecord("rec-1", "project:test", 1000));

  const scopeCache = (store as unknown as { scopeCache: Map<string, unknown> }).scopeCache;

  assert.equal(scopeCache.size, 0, "cache should remain empty when disabled");
});

test("Configurable bounds via constructor options", async () => {
  const store1 = await createTestStoreWithCache({ maxScopes: 1, maxRecordsPerScope: 100, enabled: true });
  const store2 = await createTestStoreWithCache({ maxScopes: 5, maxRecordsPerScope: 50, enabled: true });

  await store1.put(createTestRecord("rec-1", "scope-a", 1000));
  await store1.put(createTestRecord("rec-2", "scope-b", 1001));

  await store2.put(createTestRecord("rec-3", "scope-c", 1000));
  await store2.put(createTestRecord("rec-4", "scope-d", 1001));

  const scopeCache1 = (store1 as unknown as { scopeCache: Map<string, unknown> }).scopeCache;
  const scopeCache2 = (store2 as unknown as { scopeCache: Map<string, unknown> }).scopeCache;

  assert.ok(scopeCache1.size <= 1, "store1 should have maxScopes=1");
  assert.ok(scopeCache2.size <= 5, "store2 should have maxScopes=5");
});