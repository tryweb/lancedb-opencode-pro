import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLatencyThresholds, runLatencyBenchmark } from "./latency.js";

test("latency benchmark reports search, insert, and list metrics", async () => {
  const metrics = await runLatencyBenchmark("release");
  const thresholds = evaluateLatencyThresholds(metrics);

  console.log(`search p50=${metrics.search.p50.toFixed(2)}ms p99=${metrics.search.p99.toFixed(2)}ms avg=${metrics.search.avg.toFixed(2)}ms`);
  console.log(`insert avg=${metrics.insert.avg.toFixed(2)}ms`);
  console.log(`list avg=${metrics.list.avg.toFixed(2)}ms`);

  assert.equal(metrics.profile, "release");
  assert.equal(metrics.search.iterations, 200);
  assert.equal(metrics.search.datasetSize, 1000);
  assert.equal(metrics.insert.iterations, 100);
  assert.equal(metrics.list.limit, 1000);
  assert.equal(thresholds.hardGates.length, 2);
  assert.equal(thresholds.informational.length, 2);
});
