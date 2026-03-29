import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupDbPath,
  createTestStore,
  createTestRecord,
} from "../setup.js";

test("explainMemory returns explanation for existing memory", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const now = Date.now();
    const record = createTestRecord({
      id: "explain-test-1",
      scope: "project:explain-test",
      timestamp: now,
      importance: 0.8,
      citationSource: "explicit-remember",
      citationTimestamp: now,
      citationStatus: "verified",
    });

    await store.put(record);

    const explanation = await store.explainMemory(
      "explain-test-1",
      ["project:explain-test"],
      "project:explain-test",
      72,
      0.7,
    );

    assert.ok(explanation, "Explanation should be returned");
    assert.equal(explanation!.memoryId, "explain-test-1");
    assert.equal(explanation!.factors.importance, 0.8);
    assert.equal(explanation!.factors.citation?.source, "explicit-remember");
    assert.equal(explanation!.factors.citation?.status, "verified");
    assert.equal(explanation!.factors.scope.matchesCurrentScope, true);
    assert.equal(explanation!.factors.scope.isGlobal, false);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("explainMemory returns null for non-existing memory", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const explanation = await store.explainMemory(
      "non-existing-id",
      ["project:explain-test"],
      "project:explain-test",
      72,
      0.7,
    );

    assert.equal(explanation, null, "Should return null for non-existing memory");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("explainMemory calculates recency correctly", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const record = createTestRecord({
      id: "explain-test-2",
      scope: "project:explain-test",
      timestamp: oneDayAgo,
      importance: 0.5,
    });

    await store.put(record);

    const explanation = await store.explainMemory(
      "explain-test-2",
      ["project:explain-test"],
      "project:explain-test",
      72,
      0.7,
    );

    assert.ok(explanation, "Explanation should be returned");
    assert.equal(explanation!.factors.recency.withinHalfLife, true, "Should be within half-life (24h < 72h)");
    assert.ok(explanation!.factors.recency.ageHours > 23 && explanation!.factors.recency.ageHours < 25, "Age should be around 24 hours");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("explainMemory handles global scope correctly", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const record = createTestRecord({
      id: "explain-test-3",
      scope: "global",
      timestamp: Date.now(),
      importance: 0.6,
    });

    await store.put(record);

    const explanation = await store.explainMemory(
      "explain-test-3",
      ["global"],
      "project:explain-test",
      72,
      0.7,
    );

    assert.ok(explanation, "Explanation should be returned");
    assert.equal(explanation!.factors.scope.isGlobal, true, "Should be global");
    assert.equal(explanation!.factors.scope.matchesCurrentScope, false, "Should not match project scope");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("explainMemory handles missing citation gracefully", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const record = createTestRecord({
      id: "explain-test-4",
      scope: "project:explain-test",
      timestamp: Date.now(),
      importance: 0.5,
    });

    await store.put(record);

    const explanation = await store.explainMemory(
      "explain-test-4",
      ["project:explain-test"],
      "project:explain-test",
      72,
      0.7,
    );

    assert.ok(explanation, "Explanation should be returned");
    assert.equal(explanation!.factors.citation, undefined, "Citation should be undefined when not set");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("explainMemory handles older than half-life correctly", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    const record = createTestRecord({
      id: "explain-test-5",
      scope: "project:explain-test",
      timestamp: fiveDaysAgo,
      importance: 0.5,
    });

    await store.put(record);

    const explanation = await store.explainMemory(
      "explain-test-5",
      ["project:explain-test"],
      "project:explain-test",
      72,
      0.7,
    );

    assert.ok(explanation, "Explanation should be returned");
    assert.equal(explanation!.factors.recency.withinHalfLife, false, "Should be beyond half-life (5 days > 72h)");
    assert.ok(explanation!.factors.recency.decayFactor < 1, "Decay factor should be less than 1");
  } finally {
    await cleanupDbPath(dbPath);
  }
});
