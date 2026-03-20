import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRecordsMatch,
  cleanupDbPath,
  createScopedRecords,
  createTempDbPath,
  createTestEvent,
  createTestRecord,
  createTestStore,
  createVector,
  seedLegacyEffectivenessEventsTable,
} from "../setup.js";

test("write-read persistence keeps field integrity across multiple scopes", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const scopes = ["project:test-a", "project:test-b", "project:test-c"];
    const records = scopes.flatMap((scope, scopeIndex) =>
      Array.from({ length: 3 }, (_, recordIndex) =>
        createTestRecord({
          id: `${scope}-record-${recordIndex}`,
          text: `Content ${scopeIndex}-${recordIndex}`,
          scope,
          category: recordIndex % 2 === 0 ? "fact" : "decision",
          importance: 0.4 + recordIndex * 0.1,
          timestamp: 10_000 + scopeIndex * 100 + recordIndex,
          vector: createVector(384, scopeIndex + recordIndex / 10),
          metadataJson: JSON.stringify({ scope, recordIndex }),
        }),
      ),
    );

    for (const record of records) {
      await store.put(record);
    }

    for (const scope of scopes) {
      const expectedRecords = records
        .filter((record) => record.scope === scope)
        .sort((left, right) => right.timestamp - left.timestamp);
      const actualRecords = await store.list(scope, 10);

      assert.equal(actualRecords.length, expectedRecords.length);
      actualRecords.forEach((actualRecord, index) => {
        assertRecordsMatch(actualRecord, expectedRecords[index]);
      });
    }
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("scope-isolation search and listing do not leak unrelated project records", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const scopeARecords = [
      createTestRecord({
        id: "scope-a-1",
        scope: "project:repo-a",
        text: "shared troubleshooting phrase repo-a secret",
        timestamp: 2_001,
      }),
      createTestRecord({
        id: "scope-a-2",
        scope: "project:repo-a",
        text: "another repo-a only record",
        timestamp: 2_002,
      }),
    ];
    const scopeBRecords = [
      createTestRecord({
        id: "scope-b-1",
        scope: "project:repo-b",
        text: "shared troubleshooting phrase repo-b secret",
        timestamp: 3_001,
      }),
    ];

    for (const record of [...scopeARecords, ...scopeBRecords]) {
      await store.put(record);
    }

    const listA = await store.list("project:repo-a", 10);
    const listB = await store.list("project:repo-b", 10);
    assert.equal(listA.length, scopeARecords.length);
    assert.equal(listB.length, scopeBRecords.length);
    assert.ok(listA.every((record) => record.scope === "project:repo-a"));
    assert.ok(listB.every((record) => record.scope === "project:repo-b"));

    const searchA = await store.search({
      query: "shared troubleshooting phrase secret",
      queryVector: [],
      scopes: ["project:repo-a"],
      limit: 10,
      vectorWeight: 0,
      bm25Weight: 1,
      minScore: 0.01,
    });
    const searchB = await store.search({
      query: "shared troubleshooting phrase secret",
      queryVector: [],
      scopes: ["project:repo-b"],
      limit: 10,
      vectorWeight: 0,
      bm25Weight: 1,
      minScore: 0.01,
    });

    assert.ok(searchA.length > 0);
    assert.ok(searchB.length > 0);
    assert.ok(searchA.every((item) => item.record.scope === "project:repo-a"));
    assert.ok(searchB.every((item) => item.record.scope === "project:repo-b"));
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("vector compatibility checks report incompatible dimensions and allow matching dimensions", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    await store.put(
      createTestRecord({
        id: "compatible-384-1",
        scope: "project:test",
        vector: createVector(384, 0.2),
        vectorDim: 384,
      }),
    );
    await store.put(
      createTestRecord({
        id: "incompatible-768-1",
        scope: "project:test",
        vector: createVector(768, 0.3),
        vectorDim: 768,
      }),
    );
    await store.put(
      createTestRecord({
        id: "compatible-384-2",
        scope: "project:other",
        vector: createVector(384, 0.4),
        vectorDim: 384,
      }),
    );

    const incompatibleInScope = await store.countIncompatibleVectors(["project:test"], 384);
    const incompatibleEverywhere = await store.countIncompatibleVectors(["project:test", "project:other"], 384);
    const compatibleInScope = await store.countIncompatibleVectors(["project:test"], 768);

    assert.equal(incompatibleInScope, 1);
    assert.equal(incompatibleEverywhere, 1);
    assert.equal(compatibleInScope, 1);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("scope listing returns newest records first with deterministic limit handling", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const records = createScopedRecords("project:ordered", 5).map((record, index) => ({
      ...record,
      timestamp: 10_000 + index * 10,
    }));

    for (const record of records) {
      await store.put(record);
    }

    const listed = await store.list("project:ordered", 3);
    assert.deepEqual(
      listed.map((record) => record.id),
      [records[4].id, records[3].id, records[2].id],
    );
    assert.ok(listed.every((record, index, items) => index === 0 || items[index - 1].timestamp >= record.timestamp));
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("effectiveness events persist across scopes without leaking unrelated data", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const scopeAEvents = [
      createTestEvent({ id: "capture-a", type: "capture", scope: "project:repo-a", outcome: "stored", text: "repo-a capture" }),
      createTestEvent({ id: "feedback-a", type: "feedback", scope: "project:repo-a", feedbackType: "wrong", memoryId: "mem-a" }),
    ];
    const scopeBEvents = [
      createTestEvent({ id: "recall-b", type: "recall", scope: "project:repo-b", resultCount: 0, injected: false }),
    ];

    for (const event of [...scopeAEvents, ...scopeBEvents]) {
      await store.putEvent(event);
    }

    const listA = await store.listEvents(["project:repo-a"], 10);
    const listB = await store.listEvents(["project:repo-b"], 10);

    assert.equal(listA.length, 2);
    assert.equal(listB.length, 1);
    assert.ok(listA.every((event) => event.scope === "project:repo-a"));
    assert.ok(listB.every((event) => event.scope === "project:repo-b"));
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("effectiveness summary aggregates capture recall and feedback metrics", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    await store.putEvent(createTestEvent({ type: "capture", scope: "project:metrics", outcome: "considered", text: "candidate" }));
    await store.putEvent(createTestEvent({ type: "capture", scope: "project:metrics", outcome: "stored", memoryId: "mem-1", text: "stored" }));
    await store.putEvent(createTestEvent({ type: "capture", scope: "project:metrics", outcome: "skipped", skipReason: "below-min-chars", text: "short" }));
    await store.putEvent(createTestEvent({ type: "recall", scope: "project:metrics", resultCount: 2, injected: true }));
    await store.putEvent(createTestEvent({ type: "recall", scope: "project:metrics", resultCount: 0, injected: false }));
    await store.putEvent(createTestEvent({ type: "feedback", scope: "project:metrics", feedbackType: "missing", text: "missing fact" }));
    await store.putEvent(createTestEvent({ type: "feedback", scope: "project:metrics", feedbackType: "wrong", memoryId: "mem-1" }));
    await store.putEvent(createTestEvent({ type: "feedback", scope: "project:metrics", feedbackType: "useful", memoryId: "mem-1", helpful: true }));
    await store.putEvent(createTestEvent({ type: "feedback", scope: "project:metrics", feedbackType: "useful", memoryId: "mem-1", helpful: false }));

    const summary = await store.summarizeEvents("project:metrics", false);

    assert.equal(summary.totalEvents, 9);
    assert.equal(summary.capture.considered, 1);
    assert.equal(summary.capture.stored, 1);
    assert.equal(summary.capture.skipped, 1);
    assert.equal(summary.capture.skipReasons["below-min-chars"], 1);
    assert.equal(summary.recall.requested, 2);
    assert.equal(summary.recall.returnedResults, 1);
    assert.equal(summary.recall.injected, 1);
    assert.equal(summary.feedback.missing, 1);
    assert.equal(summary.feedback.wrong, 1);
    assert.equal(summary.feedback.useful.positive, 1);
    assert.equal(summary.feedback.useful.negative, 1);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("auto and manual recall events are stored and scoped correctly and summarize separately", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    await store.putEvent(createTestEvent({ type: "recall", scope: "project:split", source: "system-transform", resultCount: 2, injected: true }));
    await store.putEvent(createTestEvent({ type: "recall", scope: "project:split", source: "manual-search", resultCount: 3, injected: false }));
    await store.putEvent(createTestEvent({ type: "recall", scope: "project:split", source: "manual-search", resultCount: 0, injected: false }));

    const summary = await store.summarizeEvents("project:split", false);

    assert.equal(summary.recall.requested, 3);
    assert.equal(summary.recall.injected, 1);
    assert.equal(summary.recall.returnedResults, 2);

    assert.equal(summary.recall.auto.requested, 1);
    assert.equal(summary.recall.auto.injected, 1);
    assert.equal(summary.recall.auto.returnedResults, 1);
    assert.ok(Math.abs(summary.recall.auto.hitRate - 1) < 1e-9);
    assert.ok(Math.abs(summary.recall.auto.injectionRate - 1) < 1e-9);

    assert.equal(summary.recall.manual.requested, 2);
    assert.equal(summary.recall.manual.returnedResults, 1);
    assert.ok(Math.abs(summary.recall.manual.hitRate - 0.5) < 1e-9);

    assert.ok(Math.abs(summary.recall.manualRescueRatio - 2) < 1e-9);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("store init patches legacy effectiveness_events schema before writing recall source", async () => {
  const dbPath = await createTempDbPath();

  try {
    await seedLegacyEffectivenessEventsTable(dbPath);
    const { store } = await createTestStore(dbPath);

    await store.putEvent(
      createTestEvent({
        id: "patched-recall",
        type: "recall",
        scope: "project:legacy",
        source: "manual-search",
        resultCount: 2,
        injected: false,
      }),
    );

    const events = await store.listEvents(["project:legacy"], 10);
    const patchedEvent = events.find((event) => event.id === "patched-recall");
    assert.ok(patchedEvent);
    assert.equal(patchedEvent?.type, "recall");
    assert.equal(patchedEvent?.source, "manual-search");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("search scoring uses normalized RRF fusion when recency and importance boosts are disabled", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const scope = "project:rrf";
    const queryVector = createVector(384, 0.9);
    const records = [
      createTestRecord({
        id: "rrf-a",
        scope,
        text: "alpha alpha alpha",
        vector: createVector(384, 0.91),
        vectorDim: 384,
        importance: 0.5,
        timestamp: 10_000,
      }),
      createTestRecord({
        id: "rrf-b",
        scope,
        text: "alpha",
        vector: createVector(384, 0.85),
        vectorDim: 384,
        importance: 0.5,
        timestamp: 10_000,
      }),
      createTestRecord({
        id: "rrf-c",
        scope,
        text: "alpha alpha",
        vector: createVector(384, 0.8),
        vectorDim: 384,
        importance: 0.5,
        timestamp: 10_000,
      }),
    ];

    for (const record of records) {
      await store.put(record);
    }

    const results = await store.search({
      query: "alpha",
      queryVector,
      scopes: [scope],
      limit: 10,
      vectorWeight: 0.7,
      bm25Weight: 0.3,
      minScore: 0,
      rrfK: 10,
      recencyBoost: false,
      importanceWeight: 0,
    });

    assert.equal(results.length, 3);

    const vectorRank = new Map(
      [...results]
        .sort((a, b) => b.vectorScore - a.vectorScore)
        .map((item, index) => [item.record.id, index + 1] as const),
    );
    const bm25Rank = new Map(
      [...results]
        .sort((a, b) => b.bm25Score - a.bm25Score)
        .map((item, index) => [item.record.id, index + 1] as const),
    );

    for (const item of results) {
      const vr = vectorRank.get(item.record.id) ?? 0;
      const br = bm25Rank.get(item.record.id) ?? 0;
      const expected = 11 * (0.7 / (10 + vr) + 0.3 / (10 + br));
      assert.ok(Math.abs(item.score - expected) < 1e-9, `unexpected RRF score for ${item.record.id}`);
    }
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("recency and importance multipliers influence ranking order", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const scope = "project:boost";
    await store.put(
      createTestRecord({
        id: "boost-old-high-importance",
        scope,
        text: "gateway timeout resolved",
        vector: createVector(384, 0.7),
        vectorDim: 384,
        timestamp: Date.now() - 14 * 24 * 3_600_000,
        importance: 1,
      }),
    );
    await store.put(
      createTestRecord({
        id: "boost-new-low-importance",
        scope,
        text: "gateway timeout resolved",
        vector: createVector(384, 0.7),
        vectorDim: 384,
        timestamp: Date.now(),
        importance: 0,
      }),
    );

    const query = "gateway timeout resolved";
    const queryVector = createVector(384, 0.7);

    const noRecency = await store.search({
      query,
      queryVector,
      scopes: [scope],
      limit: 2,
      vectorWeight: 0.5,
      bm25Weight: 0.5,
      minScore: 0,
      recencyBoost: false,
      importanceWeight: 1,
      rrfK: 60,
    });

    assert.equal(noRecency[0]?.record.id, "boost-old-high-importance");

    const withRecency = await store.search({
      query,
      queryVector,
      scopes: [scope],
      limit: 2,
      vectorWeight: 0.5,
      bm25Weight: 0.5,
      minScore: 0,
      recencyBoost: true,
      recencyHalfLifeHours: 24,
      importanceWeight: 0,
      rrfK: 60,
    });

    assert.equal(withRecency[0]?.record.id, "boost-new-low-importance");
  } finally {
    await cleanupDbPath(dbPath);
  }
});
