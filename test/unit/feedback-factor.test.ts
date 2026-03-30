import assert from "node:assert";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { MemoryStore } from "../../src/store.js";
import type { MemoryRecord, FeedbackEvent } from "../../src/types.js";

const TEST_DB = join(import.meta.dirname, "../.test-db-feedback");

async function createTestStore(): Promise<{ store: MemoryStore; cleanup: () => Promise<void> }> {
  await mkdir(TEST_DB, { recursive: true });
  const store = new MemoryStore(TEST_DB);
  await store.init(384);
  return {
    store,
    cleanup: async () => {
      await rm(TEST_DB, { recursive: true, force: true });
    },
  };
}

function makeMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    text: overrides.text ?? "Test memory",
    scope: overrides.scope ?? "project:test",
    timestamp: overrides.timestamp ?? Date.now(),
    vector: overrides.vector ?? new Array(384).fill(0),
    category: overrides.category ?? "decision",
    importance: overrides.importance ?? 0.5,
    lastRecalled: 0,
    recallCount: 0,
    projectCount: 1,
    schemaVersion: 1,
    embeddingModel: "test",
    vectorDim: 384,
    metadataJson: "{}",
  };
}

function makeFeedbackEvent(memoryId: string, feedbackType: "useful" | "wrong", helpful?: boolean): FeedbackEvent {
  return {
    id: Math.random().toString(36).slice(2),
    scope: "project:test",
    type: "feedback",
    feedbackType,
    helpful,
    memoryId,
    timestamp: Date.now(),
    metadataJson: "{}",
  };
}

test("getMemoryFeedbackStatsMap returns empty for no feedback", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    await store.put(makeMemory({ id: "mem-1", text: "Memory 1" }));
    const result = await store.getMemoryFeedbackStatsMap(["mem-1"], ["project:test"]);
    assert.equal(result.size, 0);
  } finally {
    await cleanup();
  }
});

test("getMemoryFeedbackStatsMap calculates helpful rate correctly", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const memId = "mem-helpful";
    await store.put(makeMemory({ id: memId, text: "Helpful memory" }));
    await store.putEvent(makeFeedbackEvent(memId, "useful", true));
    await store.putEvent(makeFeedbackEvent(memId, "useful", true));
    await store.putEvent(makeFeedbackEvent(memId, "useful", true));
    await store.putEvent(makeFeedbackEvent(memId, "useful", false));

    const result = await store.getMemoryFeedbackStatsMap([memId], ["project:test"]);
    assert.equal(result.size, 1);
    const stats = result.get(memId)!;
    assert.equal(stats.helpful, 3);
    assert.equal(stats.unhelpful, 1);
    assert.equal(stats.wrong, 0);
    assert.equal(stats.helpfulRate, 0.75);
  } finally {
    await cleanup();
  }
});

test("getMemoryFeedbackStatsMap applies wrong penalty", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const memId = "mem-wrong";
    await store.put(makeMemory({ id: memId, text: "Wrong memory" }));
    await store.putEvent(makeFeedbackEvent(memId, "wrong"));
    await store.putEvent(makeFeedbackEvent(memId, "wrong"));
    await store.putEvent(makeFeedbackEvent(memId, "wrong"));

    const result = await store.getMemoryFeedbackStatsMap([memId], ["project:test"]);
    assert.equal(result.size, 1);
    const stats = result.get(memId)!;
    assert.equal(stats.wrong, 3);
    assert.equal(stats.feedbackFactor < 1, true);
  } finally {
    await cleanup();
  }
});

test("search applies feedback factor when feedbackWeight > 0", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const memHelpfulId = "mem-feedback-helpful";
    const memNeutralId = "mem-neutral";

    await store.put(makeMemory({ id: memHelpfulId, text: "Helpful memory", vector: new Array(384).fill(0.1) }));
    await store.put(makeMemory({ id: memNeutralId, text: "Neutral memory", vector: new Array(384).fill(0.1) }));

    await store.putEvent(makeFeedbackEvent(memHelpfulId, "useful", true));
    await store.putEvent(makeFeedbackEvent(memHelpfulId, "useful", true));

    const resultsNoFeedback = await store.search({
      query: "memory",
      queryVector: new Array(384).fill(0.1),
      scopes: ["project:test"],
      limit: 2,
      vectorWeight: 1,
      bm25Weight: 0,
      minScore: 0,
      feedbackWeight: 0,
    });

    const resultsWithFeedback = await store.search({
      query: "memory",
      queryVector: new Array(384).fill(0.1),
      scopes: ["project:test"],
      limit: 2,
      vectorWeight: 1,
      bm25Weight: 0,
      minScore: 0,
      feedbackWeight: 0.5,
    });

    const helpfulNoFeedback = resultsNoFeedback.find((r) => r.record.id === memHelpfulId);
    const helpfulWithFeedback = resultsWithFeedback.find((r) => r.record.id === memHelpfulId);

    assert.equal(helpfulWithFeedback!.score > helpfulNoFeedback!.score, true);
  } finally {
    await cleanup();
  }
});

test("search with feedbackWeight=0 ignores feedback", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const memId = "mem-ignore-feedback";
    await store.put(makeMemory({ id: memId, text: "Test memory", vector: new Array(384).fill(0.1) }));
    await store.putEvent(makeFeedbackEvent(memId, "useful", true));

    const results = await store.search({
      query: "memory",
      queryVector: new Array(384).fill(0.1),
      scopes: ["project:test"],
      limit: 1,
      vectorWeight: 1,
      bm25Weight: 0,
      minScore: 0,
      feedbackWeight: 0,
    });

    assert.equal(results.length, 1);
  } finally {
    await cleanup();
  }
});
