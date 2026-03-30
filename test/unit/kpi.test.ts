import assert from "node:assert";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { MemoryStore } from "../../src/store.js";
import type { EpisodicTaskRecord } from "../../src/types.js";

const TEST_DB = join(import.meta.dirname, "../.test-db-kpi");

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

function makeTask(overrides: Partial<EpisodicTaskRecord> = {}): EpisodicTaskRecord {
  return {
    id: Math.random().toString(36).slice(2),
    sessionId: "sess-test",
    scope: overrides.scope ?? "project:test",
    taskId: overrides.taskId ?? `task-${Math.random().toString(36).slice(2)}`,
    state: overrides.state ?? "pending",
    startTime: overrides.startTime ?? Date.now(),
    endTime: overrides.endTime,
    commandsJson: overrides.commandsJson ?? "[]",
    validationOutcomesJson: overrides.validationOutcomesJson ?? "[]",
    successPatternsJson: overrides.successPatternsJson ?? "[]",
    retryAttemptsJson: overrides.retryAttemptsJson ?? "[]",
    recoveryStrategiesJson: overrides.recoveryStrategiesJson ?? "[]",
    metadataJson: overrides.metadataJson ?? "{}",
    failureType: overrides.failureType,
    errorMessage: overrides.errorMessage,
  };
}

test("retry-to-success returns no-failed-tasks when no failures", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const result = await store.calculateRetryToSuccessRate("project:test", 30);
    assert.equal(result.status, "no-failed-tasks");
    assert.equal(result.totalFailedTasks, 0);
  } finally {
    await cleanup();
  }
});

test("retry-to-success calculates rate for failed tasks with retries", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode(makeTask({ state: "failed", startTime: now - 1000 }));
    await store.createTaskEpisode(makeTask({ state: "failed", startTime: now - 2000 }));
    await store.createTaskEpisode(makeTask({ state: "success", startTime: now - 3000, retryAttemptsJson: JSON.stringify([{ outcome: "failed" }, { outcome: "success" }]) }));
    await store.createTaskEpisode(makeTask({ state: "success", startTime: now - 4000, retryAttemptsJson: JSON.stringify([{ outcome: "success" }]) }));
    await store.createTaskEpisode(makeTask({ state: "success", startTime: now - 5000, retryAttemptsJson: JSON.stringify([{ outcome: "success" }]) }));
    await store.createTaskEpisode(makeTask({ state: "success", startTime: now - 6000 }));

    const result = await store.calculateRetryToSuccessRate("project:test", 30);
    assert.equal(result.status, "ok");
    assert.equal(result.totalFailedTasks, 2);
    assert.equal(result.succeededAfterRetry, 3);
  } finally {
    await cleanup();
  }
});

test("retry-to-success returns insufficient-data for low samples", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode(makeTask({ state: "failed", startTime: now - 1000 }));
    await store.createTaskEpisode(makeTask({ state: "failed", startTime: now - 2000 }));

    const result = await store.calculateRetryToSuccessRate("project:test", 30);
    assert.equal(result.status, "insufficient-data");
  } finally {
    await cleanup();
  }
});

test("memory lift returns no-recall-data when no recall usage", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const result = await store.calculateMemoryLift("project:test", 30);
    assert.equal(result.status, "no-recall-data");
  } finally {
    await cleanup();
  }
});

test("memory lift calculates lift for tasks with and without recall", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const now = Date.now();
    for (let i = 0; i < 6; i++) {
      await store.createTaskEpisode(makeTask({
        state: "success",
        startTime: now - i * 1000,
        metadataJson: JSON.stringify({ recallUsed: true }),
      }));
    }
    for (let i = 0; i < 6; i++) {
      await store.createTaskEpisode(makeTask({
        state: i < 2 ? "success" : "failed",
        startTime: now - (10 + i) * 1000,
        metadataJson: "{}",
      }));
    }

    const result = await store.calculateMemoryLift("project:test", 30);
    assert.equal(result.status, "ok");
    assert.equal(result.withRecallCount, 6);
    assert.equal(result.withoutRecallCount, 6);
    assert.ok(result.lift > 0, "lift should be positive when recall improves success");
  } finally {
    await cleanup();
  }
});

test("memory lift returns insufficient-data for low samples", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode(makeTask({ state: "success", startTime: now - 1000, metadataJson: JSON.stringify({ recallUsed: true }) }));
    await store.createTaskEpisode(makeTask({ state: "success", startTime: now - 2000 }));

    const result = await store.calculateMemoryLift("project:test", 30);
    assert.equal(result.status, "insufficient-data");
  } finally {
    await cleanup();
  }
});

test("getKpiSummary returns combined metrics", async () => {
  const { store, cleanup } = await createTestStore();
  try {
    const now = Date.now();
    for (let i = 0; i < 6; i++) {
      await store.createTaskEpisode(makeTask({
        state: "success",
        startTime: now - i * 1000,
        retryAttemptsJson: JSON.stringify([{ outcome: "success" }]),
        metadataJson: JSON.stringify({ recallUsed: true }),
      }));
    }
    for (let i = 0; i < 6; i++) {
      await store.createTaskEpisode(makeTask({
        state: "failed",
        startTime: now - (10 + i) * 1000,
      }));
    }

    const result = await store.getKpiSummary("project:test", 30);
    assert.equal(result.scope, "project:test");
    assert.equal(result.periodDays, 30);
    assert.ok(result.retryToSuccess !== undefined);
    assert.ok(result.memoryLift !== undefined);
  } finally {
    await cleanup();
  }
});
