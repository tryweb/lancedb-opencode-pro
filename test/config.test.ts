import assert from "node:assert/strict";
import test from "node:test";
import { resolveMemoryConfig } from "../src/config.js";

async function withPatchedEnv<T>(values: Record<string, string | undefined>, run: () => T): Promise<T> {
  const oldValues: Record<string, string | undefined> = {};
  for (const key of Object.keys(values)) {
    oldValues[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key] as string;
    }
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

test("dedup config: candidateLimit defaults to 50", async () => {
  await withPatchedEnv({ LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true" }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.dedup.candidateLimit, 50);
  });
});

test("dedup config: candidateLimit can be customized via env var", async () => {
  await withPatchedEnv({
    LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    LANCEDB_OPENCODE_PRO_DEDUP_CANDIDATE_LIMIT: "100",
  }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.dedup.candidateLimit, 100);
  });
});

test("dedup config: candidateLimit above max is clamped to 200", async () => {
  await withPatchedEnv({
    LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    LANCEDB_OPENCODE_PRO_DEDUP_CANDIDATE_LIMIT: "500",
  }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.dedup.candidateLimit, 200);
  });
});

test("dedup config: candidateLimit below min is clamped to 10", async () => {
  await withPatchedEnv({
    LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    LANCEDB_OPENCODE_PRO_DEDUP_CANDIDATE_LIMIT: "5",
  }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.dedup.candidateLimit, 10);
  });
});

test("retention config: default is undefined when not configured", async () => {
  await withPatchedEnv({ LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true" }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.retention, undefined);
  });
});

test("retention config: default 90 days when configured via sidecar", async () => {
  await withPatchedEnv({ 
    LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    LANCEDB_OPENCODE_PRO_RETENTION_EVENTS_DAYS: "60",
  }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.retention?.effectivenessEventsDays, 60);
  });
});

test("retention config: env var overrides sidecar config", async () => {
  await withPatchedEnv({
    LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    LANCEDB_OPENCODE_PRO_RETENTION_EVENTS_DAYS: "180",
  }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.retention?.effectivenessEventsDays, 180);
  });
});

test("retention config: negative values are rejected and default to 90", async () => {
  await withPatchedEnv({
    LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    LANCEDB_OPENCODE_PRO_RETENTION_EVENTS_DAYS: "-30",
  }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.retention?.effectivenessEventsDays, 90);
  });
});

test("retention config: zero value disables retention", async () => {
  await withPatchedEnv({
    LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    LANCEDB_OPENCODE_PRO_RETENTION_EVENTS_DAYS: "0",
  }, () => {
    const config = resolveMemoryConfig({}, undefined);
    assert.equal(config.retention?.effectivenessEventsDays, 0);
  });
});
