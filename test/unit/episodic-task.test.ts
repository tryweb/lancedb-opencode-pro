import assert from "node:assert";
import test from "node:test";
import { MemoryStore } from "../../src/store.js";

async function createTestStore() {
  const dbPath = await createTempDbPath();
  const store = new MemoryStore(dbPath);
  await store.init(384);
  return { store, dbPath };
}

async function createTempDbPath(): Promise<string> {
  const tmp = await import("node:fs/promises").then(m => m.mkdtemp("/tmp/test-episodic-"));
  return tmp;
}

async function cleanupDbPath(dbPath: string) {
  try {
    await import("node:fs/promises").then(m => m.rm(dbPath, { recursive: true, force: true }));
  } catch {}
}

test("createTaskEpisode creates a new task episode record", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const record = {
      id: "ep-1",
      sessionId: "session-1",
      scope: "project:test",
      taskId: "task-1",
      state: "running" as const,
      startTime: Date.now(),
      commandsJson: "[]",
      validationOutcomesJson: "[]",
      successPatternsJson: "[]",
      retryAttemptsJson: "[]",
      recoveryStrategiesJson: "[]",
      metadataJson: "{}",
    };

    await store.createTaskEpisode(record);

    const retrieved = await store.getTaskEpisode("task-1", "project:test");
    assert.ok(retrieved, "should retrieve created task episode");
    assert.equal(retrieved?.taskId, "task-1");
    assert.equal(retrieved?.state, "running");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("updateTaskState updates task state", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const record = {
      id: "ep-2",
      sessionId: "session-1",
      scope: "project:test",
      taskId: "task-2",
      state: "running" as const,
      startTime: Date.now(),
      commandsJson: "[]",
      validationOutcomesJson: "[]",
      successPatternsJson: "[]",
      retryAttemptsJson: "[]",
      recoveryStrategiesJson: "[]",
      metadataJson: "{}",
    };

    await store.createTaskEpisode(record);

    const updated = await store.updateTaskState("task-2", "success", "project:test");
    assert.equal(updated, true, "should return true for successful update");

    const retrieved = await store.getTaskEpisode("task-2", "project:test");
    assert.equal(retrieved?.state, "success");
    assert.ok(retrieved?.endTime, "should have endTime set");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("queryTaskEpisodes filters by state", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode({ id: "ep-3", sessionId: "s1", scope: "project:test", taskId: "t1", state: "success", startTime: now, commandsJson: "[]", validationOutcomesJson: "[]", successPatternsJson: "[]", retryAttemptsJson: "[]", recoveryStrategiesJson: "[]", metadataJson: "{}" });
    await store.createTaskEpisode({ id: "ep-4", sessionId: "s2", scope: "project:test", taskId: "t2", state: "failed", startTime: now, commandsJson: "[]", validationOutcomesJson: "[]", successPatternsJson: "[]", retryAttemptsJson: "[]", recoveryStrategiesJson: "[]", metadataJson: "{}" });
    await store.createTaskEpisode({ id: "ep-5", sessionId: "s3", scope: "project:test", taskId: "t3", state: "failed", startTime: now, commandsJson: "[]", validationOutcomesJson: "[]", successPatternsJson: "[]", retryAttemptsJson: "[]", recoveryStrategiesJson: "[]", metadataJson: "{}" });

    const failedTasks = await store.queryTaskEpisodes("project:test", "failed");
    assert.equal(failedTasks.length, 2, "should return 2 failed tasks");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("queryTaskEpisodes filters by timestamp", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const newTime = Date.now();

    await store.createTaskEpisode({ id: "ep-6", sessionId: "s1", scope: "project:time", taskId: "old-task", state: "success", startTime: oldTime, commandsJson: "[]", validationOutcomesJson: "[]", successPatternsJson: "[]", retryAttemptsJson: "[]", recoveryStrategiesJson: "[]", metadataJson: "{}" });
    await store.createTaskEpisode({ id: "ep-7", sessionId: "s2", scope: "project:time", taskId: "new-task", state: "success", startTime: newTime, commandsJson: "[]", validationOutcomesJson: "[]", successPatternsJson: "[]", retryAttemptsJson: "[]", recoveryStrategiesJson: "[]", metadataJson: "{}" });

    const recentTasks = await store.queryTaskEpisodes("project:time", undefined, Date.now() - 5 * 24 * 60 * 60 * 1000);
    assert.equal(recentTasks.length, 1, "should return only recent tasks");
    assert.equal(recentTasks[0].taskId, "new-task");
  } finally {
    await cleanupDbPath(dbPath);
  }
});
