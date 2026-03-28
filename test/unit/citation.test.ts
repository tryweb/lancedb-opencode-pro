import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupDbPath,
  createTestStore,
  createTestRecord,
  createVector,
} from "../setup.js";

test("citation storage and retrieval", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const record = createTestRecord({
      id: "citation-test-1",
      scope: "project:citation-test",
      citationSource: "auto-capture",
      citationTimestamp: Date.now(),
      citationStatus: "pending",
      citationChain: [],
    });

    await store.put(record);

    const citation = await store.getCitation("citation-test-1", ["project:citation-test"]);
    assert.ok(citation, "Citation should be retrievable");
    assert.equal(citation!.source, "auto-capture");
    assert.equal(citation!.status, "pending");
    assert.deepEqual(citation!.chain, []);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("citation update changes status", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const record = createTestRecord({
      id: "citation-test-2",
      scope: "project:citation-test",
      citationSource: "explicit-remember",
      citationTimestamp: Date.now(),
      citationStatus: "pending",
    });

    await store.put(record);

    const updated = await store.updateCitation("citation-test-2", ["project:citation-test"], { status: "verified" });
    assert.ok(updated, "Update should succeed");

    const citation = await store.getCitation("citation-test-2", ["project:citation-test"]);
    assert.equal(citation!.status, "verified");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("validateCitation returns valid for verified citation", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const record = createTestRecord({
      id: "citation-test-3",
      scope: "project:citation-test",
      citationSource: "auto-capture",
      citationTimestamp: Date.now(),
      citationStatus: "verified",
    });

    await store.put(record);

    const result = await store.validateCitation("citation-test-3", ["project:citation-test"]);
    assert.ok(result.valid, "Verified citation should be valid");
    assert.equal(result.status, "verified");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("validateCitation returns invalid for invalid citation", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const record = createTestRecord({
      id: "citation-test-4",
      scope: "project:citation-test",
      citationSource: "auto-capture",
      citationTimestamp: Date.now(),
      citationStatus: "invalid",
    });

    await store.put(record);

    const result = await store.validateCitation("citation-test-4", ["project:citation-test"]);
    assert.ok(!result.valid, "Invalid citation should be invalid");
    assert.equal(result.status, "invalid");
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test.skip("citation chain can be extended on update - skipped due to LanceDB array serialization", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const record = createTestRecord({
      id: "citation-test-6",
      scope: "project:citation-test",
      citationSource: "auto-capture",
      citationTimestamp: Date.now(),
      citationStatus: "pending",
    });

    await store.put(record);

    await store.updateCitation("citation-test-6", ["project:citation-test"], { chain: ["source-1", "source-2"] });

    const citation = await store.getCitation("citation-test-6", ["project:citation-test"]);
    assert.deepEqual(citation!.chain, ["source-1", "source-2"]);
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("memory search results include citation info", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const records = [
      createTestRecord({
        id: "citation-search-1",
        scope: "project:citation-test",
        text: "unique citation search test content",
        vector: createVector(384, 1),
        citationSource: "auto-capture",
        citationTimestamp: Date.now(),
        citationStatus: "verified",
      }),
    ];

    for (const record of records) {
      await store.put(record);
    }

    const results = await store.search({
      query: "unique citation search test content",
      queryVector: createVector(384, 1),
      scopes: ["project:citation-test"],
      limit: 10,
      vectorWeight: 1,
      bm25Weight: 0,
      minScore: 0,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].record.citationSource, "auto-capture");
    assert.equal(results[0].record.citationStatus, "verified");
  } finally {
    await cleanupDbPath(dbPath);
  }
});
