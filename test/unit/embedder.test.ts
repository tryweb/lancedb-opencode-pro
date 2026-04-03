import assert from "node:assert/strict";
import test from "node:test";
import { getEmbedderHealth, setEmbedderHealth, resetEmbedderHealth } from "../../src/embedder.js";
import type { EmbeddingConfig, Embedder } from "../../src/embedder.js";

test("getEmbedderHealth: returns default healthy state", () => {
  resetEmbedderHealth();
  const health = getEmbedderHealth();
  assert.strictEqual(health.status, "healthy");
  assert.strictEqual(health.lastError, null);
  assert.strictEqual(health.lastSuccess, null);
  assert.strictEqual(health.retryCount, 0);
  assert.strictEqual(health.fallbackActive, false);
});

test("setEmbedderHealth: updates health fields", () => {
  resetEmbedderHealth();
  setEmbedderHealth({ status: "degraded", lastError: "connection refused", fallbackActive: true });
  const health = getEmbedderHealth();
  assert.strictEqual(health.status, "degraded");
  assert.strictEqual(health.lastError, "connection refused");
  assert.strictEqual(health.fallbackActive, true);
});

test("resetEmbedderHealth: restores default state", () => {
  setEmbedderHealth({ status: "unavailable", lastError: "failed", retryCount: 5, fallbackActive: true });
  resetEmbedderHealth();
  const health = getEmbedderHealth();
  assert.strictEqual(health.status, "healthy");
  assert.strictEqual(health.lastError, null);
  assert.strictEqual(health.retryCount, 0);
  assert.strictEqual(health.fallbackActive, false);
});
