import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRecordsMatch,
  cleanupDbPath,
  createScopedRecords,
  createTestRecord,
  createTestStore,
  createVector,
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
