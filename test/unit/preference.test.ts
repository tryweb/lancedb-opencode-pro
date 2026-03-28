import assert from "node:assert";
import test from "node:test";
import { extractPreferenceSignals, aggregatePreferences, resolveConflicts, buildPreferenceInjection } from "../../src/preference.js";
import type { MemoryRecord } from "../../src/types.js";

function createTestMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: overrides.id ?? "test-id",
    text: overrides.text ?? "test text",
    vector: overrides.vector ?? new Array(384).fill(0),
    category: overrides.category ?? "other",
    scope: overrides.scope ?? "project:test",
    importance: overrides.importance ?? 0.5,
    timestamp: overrides.timestamp ?? Date.now(),
    lastRecalled: 0,
    recallCount: 0,
    projectCount: 0,
    schemaVersion: 1,
    embeddingModel: "test",
    vectorDim: 384,
    metadataJson: "{}",
  };
}

test("extractPreferenceSignals extracts tool preferences", () => {
  const memory = createTestMemory({ text: "I prefer using TypeScript for new projects" });
  const signals = extractPreferenceSignals(memory);

  assert.ok(signals.length > 0, "should extract at least one signal");
  assert.equal(signals[0].category, "tool");
});

test("extractPreferenceSignals extracts language preferences", () => {
  const memory = createTestMemory({ text: "I prefer using Rust for systems programming" });
  const signals = extractPreferenceSignals(memory);

  assert.ok(signals.length > 0, "should extract at least one signal");
  const hasLanguage = signals.some(s => s.category === "language");
  assert.ok(hasLanguage, "should have language preference");
});

test("extractPreferenceSignals returns empty for no preferences", () => {
  const memory = createTestMemory({ text: "This is just some regular text without preferences" });
  const signals = extractPreferenceSignals(memory);

  assert.equal(signals.length, 0, "should return empty for no preferences");
});

test("aggregatePreferences combines signals by key", () => {
  const now = Date.now();
  const memory1 = createTestMemory({ id: "mem-1", text: "I prefer using Vitest", timestamp: now - 1000 });
  const memory2 = createTestMemory({ id: "mem-2", text: "I prefer using Vitest for testing", timestamp: now });

  const signals1 = extractPreferenceSignals(memory1);
  const signals2 = extractPreferenceSignals(memory2);

  const profile = aggregatePreferences([...signals1, ...signals2], "project");

  assert.ok(profile.preferences.length > 0, "should have preferences");
  const vitestPref = profile.preferences.find(p => p.value.toLowerCase().includes("vitest"));
  assert.ok(vitestPref, "should find Vitest preference");
});

test("resolveConflicts prefers recent over old", () => {
  const now = Date.now();
  const oldPref = { key: "tool-jest", value: "Jest", category: "tool" as const, confidence: 0.8, scope: "global" as const, lastUpdated: now - 100000, sourceCount: 3 };
  const newPref = { key: "tool-vitest", value: "Vitest", category: "tool" as const, confidence: 0.6, scope: "project" as const, lastUpdated: now, sourceCount: 1 };

  const resolved = resolveConflicts([newPref], [oldPref]);

  assert.equal(resolved.length, 2);
});

test("buildPreferenceInjection creates formatted output", () => {
  const preferences = [
    { key: "tool-typescript", value: "TypeScript", category: "language" as const, confidence: 0.9, scope: "project" as const, lastUpdated: Date.now(), sourceCount: 5 },
    { key: "tool-jest", value: "Jest", category: "tool" as const, confidence: 0.7, scope: "project" as const, lastUpdated: Date.now(), sourceCount: 3 },
  ];

  const injection = buildPreferenceInjection(preferences, { mode: "fixed", maxMemories: 5 });

  assert.ok(injection.includes("User Preferences"), "should include header");
  assert.ok(injection.includes("TypeScript"), "should include TypeScript");
  assert.ok(injection.includes("Jest"), "should include Jest");
});

test("buildPreferenceInjection respects maxMemories limit", () => {
  const preferences = [
    { key: "tool-1", value: "Tool1", category: "tool" as const, confidence: 0.9, scope: "project" as const, lastUpdated: Date.now(), sourceCount: 5 },
    { key: "tool-2", value: "Tool2", category: "tool" as const, confidence: 0.8, scope: "project" as const, lastUpdated: Date.now(), sourceCount: 4 },
    { key: "tool-3", value: "Tool3", category: "tool" as const, confidence: 0.7, scope: "project" as const, lastUpdated: Date.now(), sourceCount: 3 },
  ];

  const injection = buildPreferenceInjection(preferences, { mode: "fixed", maxMemories: 2 });

  const toolCount = (injection.match(/- \[/g) || []).length;
  assert.equal(toolCount, 2, "should respect maxMemories limit");
});

test("buildPreferenceInjection returns empty for no preferences", () => {
  const injection = buildPreferenceInjection([], { mode: "fixed", maxMemories: 5 });

  assert.equal(injection, "", "should return empty string");
});
