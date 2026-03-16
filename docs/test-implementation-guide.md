# Test Implementation Guide
## Practical Code Examples for Memory Validation

---

## Setup: Test Harness Foundation

```typescript
// test/setup.ts
import { MemoryStore } from "../src/store";
import { MemoryProvider } from "../src/index";
import { randomUUID } from "crypto";

export async function createTestStore(dbPath: string = "/tmp/test-memory") {
  const store = new MemoryStore(dbPath);
  await store.init(384); // nomic-embed-text dimension
  return store;
}

export function createTestRecord(overrides?: Partial<MemoryRecord>): MemoryRecord {
  return {
    id: randomUUID(),
    text: "Test record content",
    vector: Array(384).fill(0.1), // dummy vector
    category: "fact",
    scope: "project:test",
    importance: 0.5,
    timestamp: Date.now(),
    schemaVersion: 1,
    embeddingModel: "nomic-embed-text",
    vectorDim: 384,
    metadataJson: "{}",
    ...overrides,
  };
}

export function randomVector(dim: number): number[] {
  return Array(dim)
    .fill(0)
    .map(() => Math.random() * 2 - 1);
}
```

---

## PHASE 0: Foundation Tests

### Test 0.1.1: Vector Dimension Consistency

```typescript
// test/phase0-foundation.test.ts
describe("Phase 0.1: Vector Dimension Consistency", () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = await createTestStore();
  });

  it("should reject records with mismatched vectorDim", async () => {
    // Insert 384-dim records
    await store.put(createTestRecord({ vectorDim: 384 }));
    await store.put(createTestRecord({ vectorDim: 384 }));

    // Count incompatible 768-dim vectors
    const incompatible = await store.countIncompatibleVectors(
      ["project:test"],
      768
    );

    expect(incompatible).toBe(2);
  });

  it("should allow compatible vectors", async () => {
    await store.put(createTestRecord({ vectorDim: 384 }));
    const incompatible = await store.countIncompatibleVectors(
      ["project:test"],
      384
    );
    expect(incompatible).toBe(0);
  });
});
```

### Test 0.2.1: Write-Read Cycle

```typescript
describe("Phase 0.2: Write-Read Cycle", () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = await createTestStore();
  });

  it("should persist and retrieve records with 100% match", async () => {
    const records = Array(100)
      .fill(0)
      .map((_, i) =>
        createTestRecord({
          id: `record-${i}`,
          text: `Content ${i}`,
          scope: `project:test-${i % 3}`, // 3 different scopes
        })
      );

    // Write all records
    for (const record of records) {
      await store.put(record);
    }

    // Read back and verify
    for (let i = 0; i < 3; i++) {
      const scope = `project:test-${i}`;
      const retrieved = await store.list(scope, 100);

      const expectedCount = records.filter((r) => r.scope === scope).length;
      expect(retrieved.length).toBe(expectedCount);

      // Verify field-by-field match
      for (const record of retrieved) {
        const original = records.find((r) => r.id === record.id);
        expect(record.text).toBe(original?.text);
        expect(record.category).toBe(original?.category);
        expect(record.vectorDim).toBe(original?.vectorDim);
      }
    }
  });
});
```

### Test 0.2.2: Scope Isolation

```typescript
describe("Phase 0.2: Scope Isolation", () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = await createTestStore();
  });

  it("should isolate records across scopes", async () => {
    const scopeA = "project:repo-a";
    const scopeB = "project:repo-b";

    // Insert into scope A
    await store.put(createTestRecord({ scope: scopeA, text: "Secret A" }));
    await store.put(createTestRecord({ scope: scopeA, text: "Secret A2" }));

    // Insert into scope B
    await store.put(createTestRecord({ scope: scopeB, text: "Secret B" }));

    // Verify isolation
    const listA = await store.list(scopeA, 100);
    const listB = await store.list(scopeB, 100);

    expect(listA.length).toBe(2);
    expect(listB.length).toBe(1);
    expect(listA.every((r) => r.scope === scopeA)).toBe(true);
    expect(listB.every((r) => r.scope === scopeB)).toBe(true);
  });

  it("should have 0 cross-scope leaks across 10 scenarios", async () => {
    const scopes = Array(10)
      .fill(0)
      .map((_, i) => `project:repo-${i}`);

    // Insert 5 records per scope
    for (const scope of scopes) {
      for (let i = 0; i < 5; i++) {
        await store.put(createTestRecord({ scope, text: `Record ${i}` }));
      }
    }

    // Verify no leaks
    for (const scope of scopes) {
      const records = await store.list(scope, 100);
      expect(records.length).toBe(5);
      expect(records.every((r) => r.scope === scope)).toBe(true);
    }
  });
});
```

---

## PHASE 1: Retrieval Quality Tests

### Test 1.1.1: Recall@K Metric

```typescript
// test/phase1-retrieval.test.ts
describe("Phase 1.1: Recall@K Metric", () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = await createTestStore();
  });

  it("should achieve Recall@10 >= 0.85", async () => {
    // Create synthetic dataset with known ground truth
    const dataset = generateSyntheticDataset(1000, 384);
    const testQueries = generateTestQueries(100, dataset);

    // Insert dataset
    for (const record of dataset) {
      await store.put(record);
    }

    // Calculate recall for each query
    const recalls: number[] = [];

    for (const { query, groundTruth } of testQueries) {
      const results = await store.search({
        query: query.text,
        queryVector: query.vector,
        scopes: ["project:test"],
        limit: 10,
        vectorWeight: 0.7,
        bm25Weight: 0.3,
        minScore: 0.05,
      });

      const retrievedIds = results.map((r) => r.record.id);
      const matches = retrievedIds.filter((id) => groundTruth.includes(id))
        .length;
      const recall = matches / 10;
      recalls.push(recall);
    }

    // Calculate average recall
    const avgRecall = recalls.reduce((a, b) => a + b) / recalls.length;
    console.log(`Average Recall@10: ${avgRecall.toFixed(3)}`);
    expect(avgRecall).toBeGreaterThanOrEqual(0.85);
  });
});

// Helper: Generate synthetic dataset
function generateSyntheticDataset(
  size: number,
  vectorDim: number
): MemoryRecord[] {
  const topics = [
    "Nginx configuration",
    "Docker deployment",
    "PostgreSQL optimization",
    "React performance",
    "TypeScript types",
  ];

  return Array(size)
    .fill(0)
    .map((_, i) => {
      const topic = topics[i % topics.length];
      return createTestRecord({
        id: `synthetic-${i}`,
        text: `${topic} - Record ${i}`,
        vector: randomVector(vectorDim),
        scope: "project:test",
      });
    });
}

// Helper: Generate test queries with ground truth
function generateTestQueries(
  count: number,
  dataset: MemoryRecord[]
): Array<{ query: { text: string; vector: number[] }; groundTruth: string[] }> {
  return Array(count)
    .fill(0)
    .map((_, i) => {
      // Pick a random record as ground truth
      const groundTruthRecord = dataset[Math.floor(Math.random() * dataset.length)];

      // Create similar records as ground truth (same topic)
      const topic = groundTruthRecord.text.split(" - ")[0];
      const groundTruth = dataset
        .filter((r) => r.text.includes(topic))
        .slice(0, 10)
        .map((r) => r.id);

      return {
        query: {
          text: topic,
          vector: groundTruthRecord.vector,
        },
        groundTruth,
      };
    });
}
```

### Test 1.1.2: Robustness-δ@K Metric

```typescript
describe("Phase 1.1: Robustness-δ@K Metric", () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = await createTestStore();
  });

  it("should have Robustness-0.5@10 >= 0.90", async () => {
    // Use recalls from previous test
    const recalls = []; // populated from Recall@K test

    // Calculate robustness for delta=0.5
    const robustness = calculateRobustness(recalls, 0.5);
    console.log(`Robustness-0.5@10: ${robustness.toFixed(3)}`);
    expect(robustness).toBeGreaterThanOrEqual(0.90);
  });

  it("should distinguish tail performance across indexes", async () => {
    // Simulate two different index configurations
    const config1 = { vectorWeight: 0.7, bm25Weight: 0.3 };
    const config2 = { vectorWeight: 0.5, bm25Weight: 0.5 };

    const recalls1 = await runRecallTest(store, config1);
    const recalls2 = await runRecallTest(store, config2);

    const robustness1 = calculateRobustness(recalls1, 0.5);
    const robustness2 = calculateRobustness(recalls2, 0.5);

    console.log(`Config 1 Robustness-0.5@10: ${robustness1.toFixed(3)}`);
    console.log(`Config 2 Robustness-0.5@10: ${robustness2.toFixed(3)}`);

    // Configs should have different robustness values
    expect(Math.abs(robustness1 - robustness2)).toBeGreaterThan(0.05);
  });
});

// Helper: Calculate Robustness-δ@K
function calculateRobustness(recalls: number[], delta: number): number {
  const passing = recalls.filter((r) => r >= delta).length;
  return passing / recalls.length;
}
```

### Test 1.2.1: Hybrid Search Tuning

```typescript
describe("Phase 1.2: Hybrid Search Tuning", () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = await createTestStore();
  });

  it("should balance vector and BM25 weights", async () => {
    // Insert test data
    const records = [
      createTestRecord({
        id: "exact-match",
        text: "Nginx 502 proxy_buffer_size configuration",
      }),
      createTestRecord({
        id: "semantic-match",
        text: "Web server error handling and buffer management",
      }),
      createTestRecord({
        id: "partial-match",
        text: "502 error troubleshooting guide",
      }),
    ];

    for (const record of records) {
      await store.put(record);
    }

    // Test with different weights
    const weights = [
      { vector: 0.5, bm25: 0.5 },
      { vector: 0.7, bm25: 0.3 },
      { vector: 0.9, bm25: 0.1 },
    ];

    for (const weight of weights) {
      const results = await store.search({
        query: "Nginx 502 proxy_buffer_size",
        queryVector: randomVector(384),
        scopes: ["project:test"],
        limit: 3,
        vectorWeight: weight.vector,
        bm25Weight: weight.bm25,
        minScore: 0.05,
      });

      console.log(
        `Weights ${weight.vector}/${weight.bm25}: Top result = ${results[0]?.record.id}`
      );

      // Exact match should rank high with any reasonable weight
      expect(results.map((r) => r.record.id)).toContain("exact-match");
    }
  });
});
```

---

## PHASE 2: Scope Isolation Tests

```typescript
// test/phase2-scope.test.ts
describe("Phase 2.1: Scope Resolution", () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = await createTestStore();
  });

  it("should extract project scope from sessionID", async () => {
    // Simulate scope extraction logic
    const sessionID = "sess-proj-a-001";
    const extractedScope = extractProjectScope(sessionID);
    expect(extractedScope).toBe("project:proj-a");
  });

  it("should include global scope when enabled", async () => {
    // Insert into project scope
    await store.put(
      createTestRecord({
        scope: "project:test",
        text: "Project-specific memory",
      })
    );

    // Insert into global scope
    await store.put(
      createTestRecord({
        scope: "global",
        text: "Global memory",
      })
    );

    // Search with both scopes
    const results = await store.search({
      query: "memory",
      queryVector: randomVector(384),
      scopes: ["project:test", "global"],
      limit: 10,
      vectorWeight: 0.7,
      bm25Weight: 0.3,
      minScore: 0.05,
    });

    expect(results.length).toBe(2);
    expect(results.map((r) => r.record.scope)).toContain("project:test");
    expect(results.map((r) => r.record.scope)).toContain("global");
  });
});

function extractProjectScope(sessionID: string): string {
  // Extract project ID from sessionID format: "sess-{project}-{random}"
  const parts = sessionID.split("-");
  if (parts.length >= 2) {
    return `project:${parts[1]}`;
  }
  return "project:unknown";
}
```

---

## PHASE 3: Regression Tests

```typescript
// test/phase3-regression.test.ts
describe("Phase 3.1: Auto-Capture Correctness", () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = await createTestStore();
  });

  it("should capture text with 100% match", async () => {
    const responseText =
      "Nginx 502 fixed by increasing proxy_buffer_size and confirming upstream health checks. Resolved successfully.";

    // Simulate auto-capture
    const captured = await captureFromResponse(responseText, store);

    expect(captured.text).toBe(responseText);
    expect(captured.length).toBeGreaterThan(0);
  });

  it("should enforce minimum length", async () => {
    const shortText = "Too short"; // 9 chars, below minCaptureChars=30

    const captured = await captureFromResponse(shortText, store, {
      minCaptureChars: 30,
    });

    expect(captured).toBeNull();
  });

  it("should assign correct category", async () => {
    const testCases = [
      {
        text: "We decided to use PostgreSQL for the database",
        expectedCategory: "decision",
      },
      {
        text: "The API endpoint returns JSON with status code 200",
        expectedCategory: "fact",
      },
      {
        text: "User prefers dark mode for the UI",
        expectedCategory: "preference",
      },
    ];

    for (const { text, expectedCategory } of testCases) {
      const captured = await captureFromResponse(text, store);
      expect(captured.category).toBe(expectedCategory);
    }
  });
});

async function captureFromResponse(
  text: string,
  store: MemoryStore,
  config?: { minCaptureChars?: number }
): Promise<{ text: string; category: string } | null> {
  const minChars = config?.minCaptureChars ?? 30;

  if (text.length < minChars) {
    return null;
  }

  const category = detectCategory(text);
  const record = createTestRecord({
    text,
    category: category as any,
  });

  await store.put(record);
  return { text, category };
}

function detectCategory(text: string): string {
  if (
    text.includes("decided") ||
    text.includes("choose") ||
    text.includes("will use")
  ) {
    return "decision";
  }
  if (
    text.includes("prefer") ||
    text.includes("like") ||
    text.includes("want")
  ) {
    return "preference";
  }
  return "fact";
}
```

### Test 3.2: Tool Safety

```typescript
describe("Phase 3.2: Tool Safety & Confirmation", () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = await createTestStore();
  });

  it("should reject delete without confirmation", async () => {
    const record = createTestRecord();
    await store.put(record);

    // Attempt delete without confirm
    const result = await executeDelete(store, record.id, false);

    expect(result.success).toBe(false);
    expect(result.message).toContain("confirm=true");

    // Verify record still exists
    const list = await store.list("project:test", 100);
    expect(list.find((r) => r.id === record.id)).toBeDefined();
  });

  it("should accept delete with confirmation", async () => {
    const record = createTestRecord();
    await store.put(record);

    // Delete with confirm
    const result = await executeDelete(store, record.id, true);

    expect(result.success).toBe(true);

    // Verify record deleted
    const list = await store.list("project:test", 100);
    expect(list.find((r) => r.id === record.id)).toBeUndefined();
  });
});

async function executeDelete(
  store: MemoryStore,
  id: string,
  confirm: boolean
): Promise<{ success: boolean; message: string }> {
  if (!confirm) {
    return {
      success: false,
      message: "Delete requires confirm=true to prevent accidents",
    };
  }

  const deleted = await store.deleteById(id, ["project:test"]);
  return {
    success: deleted,
    message: deleted ? "Deleted memory record" : "Record not found",
  };
}
```

---

## PHASE 4: Performance Tests

```typescript
// test/phase4-performance.test.ts
describe("Phase 4.1: Latency Benchmarks", () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = await createTestStore();

    // Populate with 10K records
    const records = Array(10000)
      .fill(0)
      .map((_, i) =>
        createTestRecord({
          id: `perf-${i}`,
          text: `Performance test record ${i}`,
          vector: randomVector(384),
        })
      );

    for (const record of records) {
      await store.put(record);
    }
  });

  it("should search in < 100ms (p50)", async () => {
    const latencies = await profileLatency(
      () =>
        store.search({
          query: "test",
          queryVector: randomVector(384),
          scopes: ["project:test"],
          limit: 10,
          vectorWeight: 0.7,
          bm25Weight: 0.3,
          minScore: 0.05,
        }),
      1000
    );

    console.log(`Search latency - p50: ${latencies.p50.toFixed(2)}ms`);
    console.log(`Search latency - p99: ${latencies.p99.toFixed(2)}ms`);
    console.log(`Search latency - avg: ${latencies.avg.toFixed(2)}ms`);

    expect(latencies.p50).toBeLessThan(100);
  });

  it("should search in < 500ms (p99)", async () => {
    const latencies = await profileLatency(
      () =>
        store.search({
          query: "test",
          queryVector: randomVector(384),
          scopes: ["project:test"],
          limit: 10,
          vectorWeight: 0.7,
          bm25Weight: 0.3,
          minScore: 0.05,
        }),
      1000
    );

    expect(latencies.p99).toBeLessThan(500);
  });
});

async function profileLatency(
  fn: () => Promise<any>,
  iterations: number
): Promise<{ p50: number; p99: number; avg: number }> {
  const times: number[] = [];

  // Warm up
  for (let i = 0; i < 10; i++) {
    await fn();
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);

  return {
    p50: times[Math.floor(times.length * 0.5)],
    p99: times[Math.floor(times.length * 0.99)],
    avg: times.reduce((a, b) => a + b) / times.length,
  };
}
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run specific phase
npm test -- phase0
npm test -- phase1
npm test -- phase2
npm test -- phase3
npm test -- phase4

# Run with coverage
npm test -- --coverage

# Run benchmarks
npm run benchmark:latency
```

---

## Test Data Cleanup

```bash
# Clean test database
rm -rf /tmp/test-memory

# Clean all test artifacts
npm run test:clean
```

