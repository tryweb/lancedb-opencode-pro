import assert from "node:assert";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { MemoryStore } from "../../src/store.js";
import type { MemoryEffectivenessEvent, MemoryRecord } from "../../src/types.js";

const TEST_DB = join(import.meta.dirname, "../.test-db-dashboard");

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

function makeCaptureEvent(overrides: Partial<MemoryEffectivenessEvent> = {}): MemoryEffectivenessEvent {
  return {
    id: Math.random().toString(36).slice(2),
    scope: "project:test",
    timestamp: Date.now(),
    metadataJson: "{}",
    type: "capture",
    outcome: "stored",
    ...overrides,
  } as MemoryEffectivenessEvent;
}

function makeRecallEvent(overrides: Partial<MemoryEffectivenessEvent> = {}): MemoryEffectivenessEvent {
  return {
    id: Math.random().toString(36).slice(2),
    scope: "project:test",
    timestamp: Date.now(),
    metadataJson: "{}",
    type: "recall",
    resultCount: 1,
    injected: true,
    source: "system-transform",
    ...overrides,
  } as MemoryEffectivenessEvent;
}

function makeFeedbackEvent(overrides: Partial<MemoryEffectivenessEvent> = {}): MemoryEffectivenessEvent {
  return {
    id: Math.random().toString(36).slice(2),
    scope: "project:test",
    timestamp: Date.now(),
    metadataJson: "{}",
    type: "feedback",
    feedbackType: "useful",
    helpful: true,
    ...overrides,
  } as MemoryEffectivenessEvent;
}

function makeMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: Math.random().toString(36).slice(2),
    text: overrides.text ?? "test memory",
    vector: new Array(384).fill(0),
    category: overrides.category ?? "other",
    scope: overrides.scope ?? "project:test",
    importance: 0.5,
    timestamp: overrides.timestamp ?? Date.now(),
    lastRecalled: 0,
    recallCount: 0,
    projectCount: 0,
    schemaVersion: 1,
    embeddingModel: "test",
    vectorDim: 384,
    metadataJson: "{}",
    ...overrides,
  };
}

test("dashboard returns metrics for stored events", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const now = Date.now();
    await store.putEvent(makeCaptureEvent({ outcome: "stored", timestamp: now - 3600000 }));
    await store.putEvent(makeCaptureEvent({ outcome: "stored", timestamp: now - 7200000 }));
    await store.putEvent(makeRecallEvent({ resultCount: 3, injected: true, timestamp: now - 5000000 }));
    await store.putEvent(makeFeedbackEvent({ timestamp: now - 4000000 }));

    const dashboard = await store.getWeeklyEffectivenessSummary("project:test", false, 7);

    assert.equal(dashboard.scope, "project:test");
    assert.equal(dashboard.periodDays, 7);
    assert.ok(dashboard.currentPeriodStart > 0);
    assert.ok(dashboard.current.totalEvents >= 4);
    assert.ok(dashboard.current.capture.stored >= 2);
    assert.ok(dashboard.current.recall.requested >= 1);
    assert.ok(dashboard.current.feedback.useful.positive >= 1);
    assert.ok(Array.isArray(dashboard.insights));
    assert.ok(dashboard.insights.length > 0);
  } finally {
    await cleanup();
  }
});

test("dashboard calculates trends with sufficient data in both periods", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < 6; i++) {
      await store.putEvent(makeCaptureEvent({ outcome: "stored", timestamp: now - 10 * dayMs - i * 1000 }));
    }
    for (let i = 0; i < 6; i++) {
      await store.putEvent(makeRecallEvent({ resultCount: 1, injected: true, timestamp: now - 10 * dayMs - i * 1000 }));
    }
    for (let i = 0; i < 6; i++) {
      await store.putEvent(makeCaptureEvent({ outcome: "stored", timestamp: now - 2 * dayMs - i * 1000 }));
    }
    for (let i = 0; i < 6; i++) {
      await store.putEvent(makeRecallEvent({ resultCount: 3, injected: true, timestamp: now - 2 * dayMs - i * 1000 }));
    }

    const dashboard = await store.getWeeklyEffectivenessSummary("project:test", false, 7);

    assert.ok(dashboard.previous !== null, "previous period should exist");
    assert.notEqual(dashboard.trends.captureSuccessRate.direction, "insufficient-data");
  } finally {
    await cleanup();
  }
});

test("dashboard returns insufficient-data for low samples", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const now = Date.now();
    await store.putEvent(makeCaptureEvent({ outcome: "stored", timestamp: now - 3600000 }));
    await store.putEvent(makeRecallEvent({ resultCount: 1, injected: true, timestamp: now - 3600000 }));

    const dashboard = await store.getWeeklyEffectivenessSummary("project:test", false, 7);

    assert.equal(dashboard.trends.captureSuccessRate.direction, "insufficient-data");
    assert.equal(dashboard.trends.recallHitRate.direction, "insufficient-data");
  } finally {
    await cleanup();
  }
});

test("dashboard generates low recall hit rate insight", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const now = Date.now();
    for (let i = 0; i < 6; i++) {
      await store.putEvent(makeRecallEvent({
        resultCount: i < 2 ? 3 : 0,
        injected: false,
        timestamp: now - i * 1000,
      }));
    }

    const dashboard = await store.getWeeklyEffectivenessSummary("project:test", false, 7);

    assert.ok(dashboard.insights.some((x) => x.includes("refining")), "should have low recall insight");
  } finally {
    await cleanup();
  }
});

test("dashboard includes memory category breakdown", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const now = Date.now();
    await store.put(makeMemory({ category: "preference", text: "pref memory", timestamp: now - 3600000 }));
    await store.put(makeMemory({ category: "fact", text: "fact memory", timestamp: now - 7200000 }));
    await store.put(makeMemory({ category: "decision", text: "decision memory", timestamp: now - 10800000 }));

    const dashboard = await store.getWeeklyEffectivenessSummary("project:test", false, 7);

    assert.ok(dashboard.recentMemories.total >= 3);
    assert.ok(dashboard.recentMemories.byCategory.preference !== undefined);
    assert.ok(dashboard.recentMemories.byCategory.fact !== undefined);
    assert.ok(dashboard.recentMemories.byCategory.decision !== undefined);
    assert.ok(dashboard.recentMemories.byCategory.preference!.samples.length <= 3);
  } finally {
    await cleanup();
  }
});

test("dashboard returns healthy insight when all metrics good", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const now = Date.now();
    for (let i = 0; i < 6; i++) {
      await store.putEvent(makeRecallEvent({ resultCount: 3, injected: true, timestamp: now - i * 1000 }));
    }
    for (let i = 0; i < 6; i++) {
      await store.putEvent(makeFeedbackEvent({ timestamp: now - i * 1000 }));
    }

    const dashboard = await store.getWeeklyEffectivenessSummary("project:test", false, 7);

    assert.ok(dashboard.insights.some((x) => x.includes("healthy")), "should have healthy insight");
  } finally {
    await cleanup();
  }
});
