import assert from "node:assert/strict";
import test from "node:test";
import { calculateRecallAtK, summarizeRetrievalMetrics } from "./metrics.js";
import { createRetrievalFixture } from "./fixtures.js";
import { cleanupDbPath, createTestStore } from "../setup.js";

const RECALL_THRESHOLD = 0.85;
const ROBUSTNESS_DELTA = 0.5;
const ROBUSTNESS_THRESHOLD = 0.9;
const LIMIT = 10;

async function runRetrievalWorkflow() {
  const { store, dbPath } = await createTestStore();
  const fixture = createRetrievalFixture();

  try {
    for (const record of fixture.dataset) {
      await store.put(record);
    }

    const recalls: number[] = [];
    for (const query of fixture.queries) {
      const results = await store.search({
        query: query.text,
        queryVector: query.vector,
        scopes: [fixture.scope],
        limit: LIMIT,
        vectorWeight: 0.7,
        bm25Weight: 0.3,
        minScore: 0.01,
      });

      const retrievedIds = results.map((result) => result.record.id);
      recalls.push(calculateRecallAtK(retrievedIds, query.groundTruth, LIMIT));
    }

    return summarizeRetrievalMetrics(recalls, ROBUSTNESS_DELTA);
  } finally {
    await cleanupDbPath(dbPath);
  }
}

test("retrieval workflow uses repeatable synthetic fixtures", async () => {
  const fixture = createRetrievalFixture();

  assert.equal(fixture.dataset.length, 100);
  assert.equal(fixture.queries.length, 100);
  assert.ok(fixture.dataset.every((record) => record.scope === fixture.scope));
  assert.ok(fixture.queries.every((query) => query.groundTruth.length === 10));
});

test("retrieval workflow reports Recall@10 and Robustness-0.5@10 above thresholds", async () => {
  const metrics = await runRetrievalWorkflow();

  console.log(`Recall@10: ${metrics.avgRecall.toFixed(3)}`);
  console.log(`Robustness-0.5@10: ${metrics.robustness.toFixed(3)}`);
  console.log(`Queries evaluated: ${metrics.totalQueries}`);

  assert.ok(metrics.avgRecall >= RECALL_THRESHOLD, `expected Recall@10 >= ${RECALL_THRESHOLD}`);
  assert.ok(metrics.robustness >= ROBUSTNESS_THRESHOLD, `expected Robustness-0.5@10 >= ${ROBUSTNESS_THRESHOLD}`);
});
