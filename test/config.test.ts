import assert from "node:assert/strict";
import test from "node:test";
import { resolveMemoryConfig } from "../src/config.js";

async function withPatchedEnv<T>(values: Record<string, string>, run: () => T): Promise<T> {
  const oldValues: Record<string, string | undefined> = {};
  for (const key of Object.keys(values)) {
    oldValues[key] = process.env[key];
    process.env[key] = values[key];
  }
  try {
    return run();
  } finally {
    for (const key of Object.keys(values)) {
      if (oldValues[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = oldValues[key];
      }
    }
  }
}

test("dedup config: default thresholds are 0.92 (write) and 0.95 (consolidate) when config is empty", async () => {
  await withPatchedEnv({ LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true" }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.dedup.enabled, true);
    assert.equal(config.dedup.writeThreshold, 0.92);
    assert.equal(config.dedup.consolidateThreshold, 0.95);
  });
});

test("dedup config: env vars override sidecar config", async () => {
  await withPatchedEnv({
    LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    LANCEDB_OPENCODE_PRO_DEDUP_ENABLED: "false",
    LANCEDB_OPENCODE_PRO_DEDUP_WRITE_THRESHOLD: "0.85",
    LANCEDB_OPENCODE_PRO_DEDUP_CONSOLIDATE_THRESHOLD: "0.99",
  }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.dedup.enabled, false);
    assert.equal(config.dedup.writeThreshold, 0.85);
    assert.equal(config.dedup.consolidateThreshold, 0.99);
  });
});

test("dedup config: invalid threshold values are clamped to [0.0, 1.0]", async () => {
  await withPatchedEnv({
    LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    LANCEDB_OPENCODE_PRO_DEDUP_WRITE_THRESHOLD: "1.5",
    LANCEDB_OPENCODE_PRO_DEDUP_CONSOLIDATE_THRESHOLD: "-0.5",
  }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.dedup.writeThreshold, 1.0);
    assert.equal(config.dedup.consolidateThreshold, 0.0);
  });
});
