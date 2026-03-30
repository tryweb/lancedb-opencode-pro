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

test("findSimilarTasks falls back to keyword matching when no queryVector provided", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const now = Date.now();

    await store.createTaskEpisode({
      id: "ep-kw-1",
      sessionId: "s1",
      scope: "project:keyword",
      taskId: "typescript-type-fix",
      state: "success",
      startTime: now,
      commandsJson: '["npm run build"]',
      validationOutcomesJson: "[]",
      successPatternsJson: "[]",
      retryAttemptsJson: "[]",
      recoveryStrategiesJson: "[]",
      metadataJson: '{"description": "Fixed TypeScript type error in store.ts"}',
    });

    const similar = await store.findSimilarTasks("project:keyword", "typescript type error", 0.5);
    assert.equal(similar.length, 1, "should find similar task by keywords");
    assert.equal(similar[0].taskId, "typescript-type-fix");

    const unrelated = await store.findSimilarTasks("project:keyword", "docker nginx", 0.5);
    assert.equal(unrelated.length, 0, "should not find task with unrelated keywords");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("getTaskEpisode retrieves episode by taskId and scope", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode({
      id: "ep-get-1",
      sessionId: "s1",
      scope: "project:get",
      taskId: "get-task-1",
      state: "running",
      startTime: now,
      commandsJson: "[]",
      validationOutcomesJson: "[]",
      successPatternsJson: "[]",
      retryAttemptsJson: "[]",
      recoveryStrategiesJson: "[]",
      metadataJson: '{"description": "Test episode for get"}',
    });

    const retrieved = await store.getTaskEpisode("get-task-1", "project:get");
    assert.ok(retrieved, "should retrieve episode");
    assert.equal(retrieved?.taskId, "get-task-1");
    assert.equal(retrieved?.state, "running");

    const notFound = await store.getTaskEpisode("nonexistent", "project:get");
    assert.equal(notFound, null, "should return null for nonexistent episode");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("extractSuccessPatternsFromScope extracts patterns from successful episodes", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode({
      id: "ep-pattern-1",
      sessionId: "s1",
      scope: "project:pattern",
      taskId: "pattern-task-1",
      state: "success",
      startTime: now,
      commandsJson: '["npm run build", "npm test", "git commit"]',
      validationOutcomesJson: '[{"type": "build", "status": "pass", "timestamp": ' + now + '}]',
      successPatternsJson: "[]",
      retryAttemptsJson: "[]",
      recoveryStrategiesJson: "[]",
      metadataJson: '{"description": "Successful build and test workflow"}',
    });

    const patterns = await store.extractSuccessPatternsFromScope("project:pattern");
    assert.ok(patterns.length > 0, "should extract at least one pattern");
    assert.ok(patterns[0].pattern.commands.length > 0, "pattern should have commands");
    assert.equal(patterns[0].count, 1, "pattern count should be 1");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("addCommandToEpisode appends a command to an existing episode", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode({
      id: "ep-cmd-1",
      sessionId: "s1",
      scope: "project:addcmd",
      taskId: "task-addcmd",
      state: "running",
      startTime: now,
      commandsJson: "[]",
      validationOutcomesJson: "[]",
      successPatternsJson: "[]",
      retryAttemptsJson: "[]",
      recoveryStrategiesJson: "[]",
      metadataJson: "{}",
    });

    const result = await store.addCommandToEpisode("task-addcmd", "project:addcmd", "git commit -m 'fix bug'");
    assert.equal(result, true, "should return true for successful append");

    const retrieved = await store.getTaskEpisode("task-addcmd", "project:addcmd");
    const commands: string[] = JSON.parse(retrieved!.commandsJson);
    assert.equal(commands.length, 1, "should have 1 command");
    assert.equal(commands[0], "git commit -m 'fix bug'");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("addCommandToEpisode accumulates multiple commands", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode({
      id: "ep-cmd-2",
      sessionId: "s1",
      scope: "project:addcmds",
      taskId: "task-addcmds",
      state: "running",
      startTime: now,
      commandsJson: "[]",
      validationOutcomesJson: "[]",
      successPatternsJson: "[]",
      retryAttemptsJson: "[]",
      recoveryStrategiesJson: "[]",
      metadataJson: "{}",
    });

    await store.addCommandToEpisode("task-addcmds", "project:addcmds", "npm test");
    await store.addCommandToEpisode("task-addcmds", "project:addcmds", "npm run build");

    const retrieved = await store.getTaskEpisode("task-addcmds", "project:addcmds");
    const commands: string[] = JSON.parse(retrieved!.commandsJson);
    assert.equal(commands.length, 2, "should have 2 commands");
    assert.equal(commands[0], "npm test");
    assert.equal(commands[1], "npm run build");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("addCommandToEpisode returns false for nonexistent episode", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const result = await store.addCommandToEpisode("nonexistent-task", "project:addcmd", "git commit");
    assert.equal(result, false, "should return false when episode not found");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("addValidationOutcome appends a validation outcome to an existing episode", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode({
      id: "ep-val-1",
      sessionId: "s1",
      scope: "project:addval",
      taskId: "task-addval",
      state: "running",
      startTime: now,
      commandsJson: "[]",
      validationOutcomesJson: "[]",
      successPatternsJson: "[]",
      retryAttemptsJson: "[]",
      recoveryStrategiesJson: "[]",
      metadataJson: "{}",
    });

    const outcome = { type: "build" as const, status: "pass" as const, timestamp: now, passedCount: 5 };
    const result = await store.addValidationOutcome("task-addval", "project:addval", outcome);
    assert.equal(result, true, "should return true for successful append");

    const retrieved = await store.getTaskEpisode("task-addval", "project:addval");
    const outcomes = JSON.parse(retrieved!.validationOutcomesJson);
    assert.equal(outcomes.length, 1, "should have 1 outcome");
    assert.equal(outcomes[0].type, "build");
    assert.equal(outcomes[0].status, "pass");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("addSuccessPatterns merges patterns into existing episode", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode({
      id: "ep-suc-1",
      sessionId: "s1",
      scope: "project:addsuc",
      taskId: "task-addsuc",
      state: "success",
      startTime: now,
      commandsJson: "[]",
      validationOutcomesJson: "[]",
      successPatternsJson: '[{"commands":["npm run build"],"tools":["npm"],"confidence":0.8,"extractedAt":' + (now - 1000) + '}]',
      retryAttemptsJson: "[]",
      recoveryStrategiesJson: "[]",
      metadataJson: "{}",
    });

    const newPatterns = [
      { commands: ["git commit"], tools: ["git"], confidence: 0.9, extractedAt: now },
    ];
    const result = await store.addSuccessPatterns("task-addsuc", "project:addsuc", newPatterns);
    assert.equal(result, true, "should return true for successful merge");

    const retrieved = await store.getTaskEpisode("task-addsuc", "project:addsuc");
    const patterns = JSON.parse(retrieved!.successPatternsJson);
    assert.equal(patterns.length, 2, "should have 2 patterns after merge");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("addRetryAttempt appends retry attempt with timestamp enrichment", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode({
      id: "ep-retry-1",
      sessionId: "s1",
      scope: "project:addretry",
      taskId: "task-addretry",
      state: "failed",
      startTime: now,
      commandsJson: "[]",
      validationOutcomesJson: "[]",
      successPatternsJson: "[]",
      retryAttemptsJson: "[]",
      recoveryStrategiesJson: "[]",
      metadataJson: "{}",
    });

    const before = Date.now();
    const result = await store.addRetryAttempt("task-addretry", "project:addretry", {
      attemptNumber: 1,
      outcome: "failed",
      errorMessage: "timeout",
    });
    const after = Date.now();
    assert.equal(result, true, "should return true for successful append");

    const retrieved = await store.getTaskEpisode("task-addretry", "project:addretry");
    const attempts = JSON.parse(retrieved!.retryAttemptsJson);
    assert.equal(attempts.length, 1, "should have 1 retry attempt");
    assert.equal(attempts[0].attemptNumber, 1);
    assert.equal(attempts[0].outcome, "failed");
    assert.equal(attempts[0].errorMessage, "timeout");
    assert.ok(attempts[0].timestamp >= before && attempts[0].timestamp <= after, "timestamp should be enriched by helper");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("addRecoveryStrategy appends recovery strategy with attemptedAt enrichment", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const now = Date.now();
    await store.createTaskEpisode({
      id: "ep-rec-1",
      sessionId: "s1",
      scope: "project:addrec",
      taskId: "task-addrec",
      state: "failed",
      startTime: now,
      commandsJson: "[]",
      validationOutcomesJson: "[]",
      successPatternsJson: "[]",
      retryAttemptsJson: "[]",
      recoveryStrategiesJson: "[]",
      metadataJson: "{}",
    });

    const before = Date.now();
    const result = await store.addRecoveryStrategy("task-addrec", "project:addrec", {
      name: "Exponential backoff",
      succeeded: false,
    });
    const after = Date.now();
    assert.equal(result, true, "should return true for successful append");

    const retrieved = await store.getTaskEpisode("task-addrec", "project:addrec");
    const strategies = JSON.parse(retrieved!.recoveryStrategiesJson);
    assert.equal(strategies.length, 1, "should have 1 recovery strategy");
    assert.equal(strategies[0].name, "Exponential backoff");
    assert.equal(strategies[0].succeeded, false);
    assert.ok(strategies[0].attemptedAt >= before && strategies[0].attemptedAt <= after, "attemptedAt should be enriched by helper");
  } finally {
    await cleanupDbPath(dbPath);
  }
});
