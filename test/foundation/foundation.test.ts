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
  seedLegacyMemoriesTable,
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

test("store init patches legacy memories schema by adding lastRecalled recallCount and projectCount", async () => {
  const dbPath = await createTempDbPath();

  try {
    await seedLegacyMemoriesTable(dbPath);
    const { store } = await createTestStore(dbPath);

    const results = await store.search({
      query: "legacy memory",
      queryVector: createVector(384, 0.5),
      scopes: ["project:legacy"],
      limit: 5,
      vectorWeight: 0.7,
      bm25Weight: 0.3,
      minScore: 0,
    });

    assert.equal(results.length, 1);
    const record = results[0].record;
    assert.equal(record.id, "legacy-memory-1");
    assert.equal(record.lastRecalled, 0, "patched column should default to 0");
    assert.equal(record.recallCount, 0, "patched column should default to 0");
    assert.equal(record.projectCount, 0, "patched column should default to 0");
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

// ─────────────────────────────────────────────
// Dedup — Consolidation (§6)
// ─────────────────────────────────────────────

test("consolidateDuplicates returns zeros when scope is empty", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const result = await store.consolidateDuplicates("project:empty-scope", 0.95);
    assert.equal(result.mergedPairs, 0);
    assert.equal(result.updatedRecords, 0);
    assert.equal(result.skippedRecords, 0);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("consolidateDuplicates merges two similar memories (cosine >= 0.95), older deleted, newer retains mergedFrom", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:dedup-test";
    const now = Date.now();
    const sharedText = "gateway 502 bad gateway resolved by restarting nginx";
    const vec = createVector(384, 0.5);
    await store.put(createTestRecord({ id: "mem-older", scope, text: sharedText, vector: vec, timestamp: now - 10_000, lastRecalled: 0, metadataJson: JSON.stringify({}) }));
    await store.put(createTestRecord({ id: "mem-newer", scope, text: sharedText, vector: vec, timestamp: now, lastRecalled: 0, metadataJson: JSON.stringify({}) }));
    const result = await store.consolidateDuplicates(scope, 0.95);
    assert.equal(result.mergedPairs, 1);
    assert.equal(result.updatedRecords, 2);
    assert.equal(result.skippedRecords, 0);
    const listed = await store.list(scope, 10);
    const ids = listed.map((r) => r.id);
    assert.ok(ids.includes("mem-newer"), "newer record should still be present");
    assert.ok(!ids.includes("mem-older"), "older merged record should not appear in normal list");
    const newerRecord = listed.find((r) => r.id === "mem-newer")!;
    const newerMeta = JSON.parse(newerRecord.metadataJson);
    assert.equal(newerMeta.mergedFrom, "mem-older");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("consolidateDuplicates skips records recalled within last 5 minutes", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:recall-guard";
    const now = Date.now();
    const vec = createVector(384, 0.5);
    await store.put(createTestRecord({ id: "mem-recently-recalled", scope, text: "recently recalled memory", vector: vec, timestamp: now - 10_000, lastRecalled: now - 60_000, metadataJson: JSON.stringify({}) }));
    await store.put(createTestRecord({ id: "mem-not-recalled", scope, text: "not recalled memory", vector: vec, timestamp: now, lastRecalled: 0, metadataJson: JSON.stringify({}) }));
    const result = await store.consolidateDuplicates(scope, 0.95);
    assert.equal(result.skippedRecords, 1);
    assert.equal(result.mergedPairs, 0);
    assert.equal(result.updatedRecords, 0);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("consolidateDuplicates is idempotent (second call returns 0 merged)", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:idempotent";
    const now = Date.now();
    const vec = createVector(384, 0.5);
    await store.put(createTestRecord({ id: "mem-old", scope, text: "duplicate content", vector: vec, timestamp: now - 10_000, lastRecalled: 0, metadataJson: JSON.stringify({}) }));
    await store.put(createTestRecord({ id: "mem-new", scope, text: "duplicate content", vector: vec, timestamp: now, lastRecalled: 0, metadataJson: JSON.stringify({}) }));
    const first = await store.consolidateDuplicates(scope, 0.95);
    assert.equal(first.mergedPairs, 1);
    const second = await store.consolidateDuplicates(scope, 0.95);
    assert.equal(second.mergedPairs, 0);
    assert.equal(second.updatedRecords, 0);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("summarizeEvents returns duplicates.flaggedCount from flagged memory records", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:dedup-flags";
    const now = Date.now();
    await store.put(createTestRecord({ id: "mem-normal", scope, text: "normal memory", vector: createVector(384, 0.1), timestamp: now - 5_000, metadataJson: JSON.stringify({ isPotentialDuplicate: false }) }));
    await store.put(createTestRecord({ id: "mem-flagged", scope, text: "similar to above", vector: createVector(384, 0.1), timestamp: now, metadataJson: JSON.stringify({ isPotentialDuplicate: true, duplicateOf: "mem-normal" }) }));
    const summary = await store.summarizeEvents(scope, false);
    assert.equal(summary.duplicates.flaggedCount, 1);
    assert.equal(summary.duplicates.consolidatedCount, 0);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("summarizeEvents returns duplicates.consolidatedCount from merged memory records", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:dedup-merged";
    const now = Date.now();
    const vec = createVector(384, 0.5);
    await store.put(createTestRecord({ id: "mem-old", scope, text: "to be merged", vector: vec, timestamp: now - 10_000, lastRecalled: 0, metadataJson: JSON.stringify({}) }));
    await store.put(createTestRecord({ id: "mem-new", scope, text: "to be merged", vector: vec, timestamp: now, lastRecalled: 0, metadataJson: JSON.stringify({}) }));
    await store.consolidateDuplicates(scope, 0.95);
    const summary = await store.summarizeEvents(scope, false);
    assert.equal(summary.duplicates.consolidatedCount, 1);
    assert.equal(summary.duplicates.flaggedCount, 0);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("pruneScope keeps newest flagged duplicate when maxEntries forces deletion", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:prune-flagged";
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await store.put(createTestRecord({ id: `flagged-${i}`, scope, text: `flagged content ${i}`, vector: createVector(384, i * 0.1), timestamp: now - i * 10_000, metadataJson: JSON.stringify({ isPotentialDuplicate: true }) }));
    }
    const deleted = await store.pruneScope(scope, 1);
    assert.equal(deleted, 2);
    const remaining = await store.list(scope, 10);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, "flagged-0");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("pruneScope deletes unflagged records only after all flagged records are removed", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:prune-unflagged";
    const now = Date.now();
    await store.put(createTestRecord({ id: "flagged-old", scope, text: "old flagged", vector: createVector(384, 0.1), timestamp: now - 20_000, metadataJson: JSON.stringify({ isPotentialDuplicate: true }) }));
    await store.put(createTestRecord({ id: "unflagged-new", scope, text: "new unflagged", vector: createVector(384, 0.9), timestamp: now, metadataJson: JSON.stringify({ isPotentialDuplicate: false }) }));
    await store.put(createTestRecord({ id: "flagged-newer", scope, text: "newer flagged", vector: createVector(384, 0.2), timestamp: now - 10_000, metadataJson: JSON.stringify({ isPotentialDuplicate: true }) }));
    const deleted = await store.pruneScope(scope, 2);
    assert.equal(deleted, 1);
    const remaining = await store.list(scope, 10);
    const ids = remaining.map((r) => r.id);
    assert.ok(ids.includes("unflagged-new"), "unflagged newest should be kept");
    assert.ok(!ids.includes("flagged-old"), "oldest flagged should be deleted first");
    assert.ok(ids.includes("flagged-newer"), "newer flagged should be kept (newest among flagged)");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

// ─────────────────────────────────────────────
// Dedup — Search Display (§8)
// ─────────────────────────────────────────────

test("store.search returns records with isPotentialDuplicate=true for duplicate marker display", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:search-display";
    const now = Date.now();
    await store.put(createTestRecord({ id: "mem-normal", scope, text: "normal content abc", vector: createVector(384, 0.3), timestamp: now - 5_000, metadataJson: JSON.stringify({ isPotentialDuplicate: false }) }));
    await store.put(createTestRecord({ id: "mem-flagged", scope, text: "flagged content abc", vector: createVector(384, 0.3), timestamp: now, metadataJson: JSON.stringify({ isPotentialDuplicate: true, duplicateOf: "mem-normal" }) }));
    const results = await store.search({ query: "content abc", queryVector: createVector(384, 0.3), scopes: [scope], limit: 10, vectorWeight: 1.0, bm25Weight: 0.0, minScore: 0.0, rrfK: 60, recencyBoost: false, globalDiscountFactor: 1.0 });
    const flaggedRecord = results.find((r) => r.record.id === "mem-flagged");
    assert.ok(flaggedRecord, "flagged record should be returned by search");
    const meta = JSON.parse(flaggedRecord!.record.metadataJson);
    assert.equal(meta.isPotentialDuplicate, true);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("store.search returns records with isPotentialDuplicate=false without marker", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:search-no-marker";
    const now = Date.now();
    await store.put(createTestRecord({ id: "mem-unflagged", scope, text: "unflagged content xyz", vector: createVector(384, 0.4), timestamp: now, metadataJson: JSON.stringify({ isPotentialDuplicate: false }) }));
    const results = await store.search({ query: "content xyz", queryVector: createVector(384, 0.4), scopes: [scope], limit: 10, vectorWeight: 1.0, bm25Weight: 0.0, minScore: 0.0, rrfK: 60, recencyBoost: false, globalDiscountFactor: 1.0 });
    const unflaggedRecord = results.find((r) => r.record.id === "mem-unflagged");
    assert.ok(unflaggedRecord, "unflagged record should be returned");
    const meta = JSON.parse(unflaggedRecord!.record.metadataJson);
    assert.notEqual(meta.isPotentialDuplicate, true);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("store.search excludes records with status=merged", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:search-merged";
    const now = Date.now();
    await store.put(createTestRecord({ id: "mem-active", scope, text: "active content def", vector: createVector(384, 0.5), timestamp: now, metadataJson: JSON.stringify({}) }));
    await store.put(createTestRecord({ id: "mem-merged", scope, text: "merged content def", vector: createVector(384, 0.5), timestamp: now - 3_000, metadataJson: JSON.stringify({ status: "merged", mergedInto: "mem-active" }) }));
    const results = await store.search({ query: "content def", queryVector: createVector(384, 0.5), scopes: [scope], limit: 10, vectorWeight: 1.0, bm25Weight: 0.0, minScore: 0.0, rrfK: 60, recencyBoost: false, globalDiscountFactor: 1.0 });
    const ids = results.map((r) => r.record.id);
    assert.ok(ids.includes("mem-active"), "active record should be returned");
    assert.ok(!ids.includes("mem-merged"), "merged record should not be returned");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

// ─────────────────────────────────────────────
// Dedup — Capture Flagging Integration (§7)
// ─────────────────────────────────────────────

test("flushAutoCapture similarity check uses vectorWeight=1.0 bm25Weight=0.0 (cosine-only)", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:capture-similarity";
    const now = Date.now();
    const sharedText = "nginx 502 bad gateway resolved by restarting the server";
    const vec = createVector(384, 0.5);
    await store.put(createTestRecord({ id: "mem-first", scope, text: sharedText, vector: vec, timestamp: now - 5_000, metadataJson: JSON.stringify({}) }));
    const results = await store.search({ query: sharedText, queryVector: vec, scopes: [scope], limit: 5, vectorWeight: 1.0, bm25Weight: 0.0, minScore: 0.0, rrfK: 60, recencyBoost: false, globalDiscountFactor: 1.0 });
    assert.ok(results.length >= 1, "should find the first memory");
    // score includes importanceFactor (1 + 0.4 * 0.5 = 1.2), use vectorScore for raw cosine
    const topVectorScore = results[0]!.vectorScore;
    assert.ok(topVectorScore >= 0.99, `identical vectors should have cosine ~1.0, got ${topVectorScore}`);
    assert.ok(Math.abs(topVectorScore - 1.0) < 0.0001, `identical vectors should have raw cosine ≈ 1.0, got ${topVectorScore}`);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("consolidateDuplicates merges two records with cosine=1.0 (identical vectors)", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:consolidate-identical";
    const now = Date.now();
    const sharedText = "same content for duplicate detection";
    const vec = createVector(384, 0.5);
    await store.put(createTestRecord({ id: "mem-old", scope, text: sharedText, vector: vec, timestamp: now - 10_000, lastRecalled: 0, metadataJson: JSON.stringify({}) }));
    await store.put(createTestRecord({ id: "mem-new", scope, text: sharedText, vector: vec, timestamp: now, lastRecalled: 0, metadataJson: JSON.stringify({}) }));
    const result = await store.consolidateDuplicates(scope, 0.95);
    assert.equal(result.mergedPairs, 1, "should merge the identical pair");
    assert.equal(result.updatedRecords, 2, "should update both records");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("consolidateDuplicates does not merge records with very low cosine similarity", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:no-merge-dissimilar";
    const now = Date.now();
    await store.put(createTestRecord({ id: "mem-a", scope, text: "nginx 502 error resolved", vector: createVector(384, 0.1), timestamp: now - 5_000, lastRecalled: 0, metadataJson: JSON.stringify({}) }));
    await store.put(createTestRecord({ id: "mem-b", scope, text: "postgres pool exhausted fixed", vector: createVector(384, -0.1), timestamp: now, lastRecalled: 0, metadataJson: JSON.stringify({}) }));
    const result = await store.consolidateDuplicates(scope, 0.92);
    assert.equal(result.mergedPairs, 0, "should not merge records with very low cosine similarity");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("consolidateDuplicates skips self-merge when older.id === newer.id (issue #25)", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:self-merge-test";
    const testId = "ebb542a9-dfd2-4d77-aab8-cbecbe2e8998";
    const now = Date.now();
    
    await store.put(createTestRecord({
      id: testId,
      scope,
      text: "test content",
      vector: createVector(384, 0.5),
      timestamp: now,
      lastRecalled: 0,
      metadataJson: JSON.stringify({})
    }));
    
    const result = await store.consolidateDuplicates(scope, 0.95);
    
    assert.equal(result.mergedPairs, 0, "should not merge self");
    assert.equal(result.updatedRecords, 0, "should not update any records");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("consolidateDuplicates merges two similar records correctly after self-merge fix", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:merge-test";
    const now = Date.now();
    const sharedText = "This is a test content for duplicate detection";
    const vec = createVector(384, 0.5);
    
    await store.put(createTestRecord({
      id: "record-old",
      scope,
      text: sharedText,
      vector: vec,
      timestamp: now - 10_000,
      lastRecalled: 0,
      metadataJson: JSON.stringify({})
    }));
    
    await store.put(createTestRecord({
      id: "record-new",
      scope,
      text: sharedText,
      vector: vec,
      timestamp: now,
      lastRecalled: 0,
      metadataJson: JSON.stringify({})
    }));
    
    const result = await store.consolidateDuplicates(scope, 0.95);
    
    assert.equal(result.mergedPairs, 1, "should merge one pair");
    assert.equal(result.updatedRecords, 2, "should update both records");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

// ─────────────────────────────────────────────
// Explicit Memory Commands Support (§3)
// ─────────────────────────────────────────────
test("softDeleteMemory marks record as disabled instead of deleting", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:soft-delete";
    const now = Date.now();
    const record = createTestRecord({
      id: "mem-to-disable",
      scope,
      text: "This memory will be disabled",
      vector: createVector(384, 0.5),
      timestamp: now,
      metadataJson: JSON.stringify({}),
    });
    await store.put(record);

    const result = await store.softDeleteMemory("mem-to-disable", [scope]);
    assert.equal(result, true, "softDelete should return true");

    const listResult = await store.list(scope, 10);
    assert.equal(listResult.length, 0, "disabled memory should not appear in list");

    const searchResult = await store.search({
      query: "disabled",
      queryVector: createVector(384, 0.5),
      scopes: [scope],
      limit: 10,
      vectorWeight: 1.0,
      bm25Weight: 0.0,
      minScore: 0.0,
    });
    assert.equal(searchResult.length, 0, "disabled memory should not appear in search");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("softDeleteMemory returns false when record not found", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const result = await store.softDeleteMemory("non-existent-id", ["project:test"]);
    assert.equal(result, false, "should return false for non-existent record");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("listSince returns memories newer than timestamp", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:list-since";
    const now = Date.now();
    const oldTimestamp = now - 10 * 24 * 60 * 60 * 1000;
    const newTimestamp = now - 2 * 24 * 60 * 60 * 1000;

    await store.put(createTestRecord({
      id: "old-memory",
      scope,
      text: "Old memory",
      vector: createVector(384, 0.1),
      timestamp: oldTimestamp,
      metadataJson: JSON.stringify({}),
    }));
    await store.put(createTestRecord({
      id: "new-memory",
      scope,
      text: "New memory",
      vector: createVector(384, 0.2),
      timestamp: newTimestamp,
      metadataJson: JSON.stringify({}),
    }));

    const sinceTimestamp = now - 5 * 24 * 60 * 60 * 1000;
    const result = await store.listSince(scope, sinceTimestamp, 10);

    assert.equal(result.length, 1, "should return only memories newer than sinceTimestamp");
    assert.equal(result[0].id, "new-memory", "should return the newer memory");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("listSince respects limit parameter", async () => {
  const { store, dbPath } = await createTestStore();
  try {
    const scope = "project:list-since-limit";
    const now = Date.now();

    for (let i = 0; i < 10; i++) {
      await store.put(createTestRecord({
        id: `mem-${i}`,
        scope,
        text: `Memory ${i}`,
        vector: createVector(384, i / 10),
        timestamp: now - i * 60 * 60 * 1000,
        metadataJson: JSON.stringify({}),
      }));
    }

    const result = await store.listSince(scope, 0, 3);
    assert.equal(result.length, 3, "should respect limit");
  } finally {
    await cleanupDbPath(dbPath);
  }
});
