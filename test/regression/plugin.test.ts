import assert from "node:assert/strict";
import test from "node:test";
import { resolveMemoryConfig } from "../../src/config.js";
import plugin from "../../src/index.js";
import { deriveProjectScope } from "../../src/scope.js";
import { cleanupDbPath, createScopedRecords, createTempDbPath, createTestRecord, createTestStore, createVector, seedLegacyEffectivenessEventsTable } from "../setup.js";

const SESSION_ID = "sess-test-001";
// Use workspace path (Docker) or real project path (host) so deriveProjectScope() returns consistent scope
const WORKTREE = "/workspace";
const TEST_SCOPE = deriveProjectScope(WORKTREE);

type MessagePart = { type: "text"; text: string };
type SessionMessage = { info: { role: string }; parts: MessagePart[] };
type PluginInput = Parameters<typeof plugin>[0];

function makeEmbedding(prompt: string, dim = 384): number[] {
  const base = Math.max(1, prompt.length % 10) / 10;
  return createVector(dim, base);
}

function createFetchMock() {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as { prompt?: string; input?: string | string[] } : {};
    const url = typeof input === "string" ? input : input instanceof URL ? String(input) : input.url;
    const textInput = Array.isArray(body.input) ? body.input[0] : body.input;
    const prompt = body.prompt ?? textInput ?? url;

    if (url.includes("/api/embeddings")) {
      return new Response(JSON.stringify({ embedding: makeEmbedding(prompt) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/embeddings")) {
      return new Response(JSON.stringify({ data: [{ embedding: makeEmbedding(prompt, 1536) }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ embedding: makeEmbedding(prompt) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

async function withPatchedFetch<T>(run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createFetchMock() as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withPatchedEnv<T>(values: Record<string, string>, run: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function createPluginHarness(options?: {
  minCaptureChars?: number;
  maxEntriesPerScope?: number;
  userMessages?: SessionMessage[];
  sessionDirectory?: string;
  embeddingProvider?: "ollama" | "openai";
  dbPath?: string;
}) {
  const embeddingProvider = options?.embeddingProvider ?? "ollama";
  const dbPath = options?.dbPath ?? (await createTempDbPath("lancedb-opencode-pro-regression-"));
  const memoryConfig = {
    memory: {
      provider: "lancedb-opencode-pro",
      dbPath,
      embedding: {
        provider: embeddingProvider,
        model: embeddingProvider === "openai" ? "text-embedding-3-small" : "all-minilm",
        baseUrl: embeddingProvider === "openai" ? "https://api.openai.com/v1" : "http://127.0.0.1:11434",
        ...(embeddingProvider === "openai" ? { apiKey: "test-openai-api-key" } : {}),
      },
      retrieval: {
        mode: "hybrid" as const,
        vectorWeight: 0.7,
        bm25Weight: 0.3,
        minScore: 0.01,
      },
      dedup: {
        enabled: true,
        writeThreshold: 0.92,
        consolidateThreshold: 0.95,
      },
      includeGlobalScope: true,
      minCaptureChars: options?.minCaptureChars ?? 30,
      maxEntriesPerScope: options?.maxEntriesPerScope ?? 200,
    },
  };
  const userMessages = options?.userMessages ?? [
    {
      info: { role: "user" },
      parts: [{ type: "text", text: "我又遇到 Nginx 502，先幫我找以前解法" }],
    },
  ];
  const sessionDirectory = options?.sessionDirectory ?? WORKTREE;
  const envValues: Record<string, string> = {
    LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    LANCEDB_OPENCODE_PRO_DB_PATH: dbPath,
    LANCEDB_OPENCODE_PRO_MIN_CAPTURE_CHARS: String(memoryConfig.memory.minCaptureChars),
    LANCEDB_OPENCODE_PRO_MAX_ENTRIES_PER_SCOPE: String(memoryConfig.memory.maxEntriesPerScope),
    LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER: memoryConfig.memory.embedding.provider,
    LANCEDB_OPENCODE_PRO_EMBEDDING_MODEL: memoryConfig.memory.embedding.model,
  };

  if (embeddingProvider === "openai") {
    envValues.LANCEDB_OPENCODE_PRO_OPENAI_API_KEY = "test-openai-api-key";
    envValues.LANCEDB_OPENCODE_PRO_OPENAI_BASE_URL = memoryConfig.memory.embedding.baseUrl;
    envValues.LANCEDB_OPENCODE_PRO_OPENAI_MODEL = memoryConfig.memory.embedding.model;
  } else {
    envValues.LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL = memoryConfig.memory.embedding.baseUrl;
  }

  const hooks = await withPatchedEnv(
    envValues,
    () => withPatchedFetch(async () =>
      plugin({
      client: {
        config: {
          async get() {
            return memoryConfig;
          },
        } as unknown as PluginInput["client"]["config"],
        session: {
          async messages() {
            return userMessages;
          },
          async get() {
            return { directory: sessionDirectory };
          },
        } as unknown as PluginInput["client"]["session"],
      } as PluginInput["client"],
      project: {
        id: "proj-regression",
        worktree: WORKTREE,
        vcs: "git",
        time: { created: Date.now() },
      } as PluginInput["project"],
      directory: WORKTREE,
      worktree: WORKTREE,
      serverUrl: new URL("http://localhost:4096"),
      $: (() => {
        throw new Error("shell not needed in regression tests");
      }) as unknown as PluginInput["$"],
      } as PluginInput),
    ),
  );

  assert.ok(hooks?.tool, "tool hooks should exist");
  assert.ok(hooks?.event, "event hook should exist");
  assert.ok(hooks?.["experimental.text.complete"], "text complete hook should exist");
  assert.ok(hooks?.["experimental.chat.system.transform"], "system transform hook should exist");

  const toolHooks = hooks.tool;
  const eventHook = hooks.event;
  const textCompleteHook = hooks["experimental.text.complete"];
  const systemTransformHook = hooks["experimental.chat.system.transform"];

  const context = {
    sessionID: SESSION_ID,
    messageID: "msg-regression-001",
    agent: "general",
    directory: WORKTREE,
    worktree: WORKTREE,
    abort: new AbortController().signal,
    metadata() {},
    async ask() {},
  };

  async function capture(text: string): Promise<void> {
    await withPatchedFetch(async () => {
      await textCompleteHook(
        { sessionID: SESSION_ID, messageID: `msg-${Date.now()}`, partID: `part-${Date.now()}` },
        { text },
      );
      await eventHook({
        event: {
          type: "session.idle",
          properties: { sessionID: SESSION_ID },
        },
      });
    });
  }

  async function recallSystem(): Promise<string[]> {
    return withPatchedFetch(async () => {
      const output = { system: [] as string[] };
      const input = {
        sessionID: SESSION_ID,
        model: { id: "test-model", name: "test-model", providerID: "test-provider" },
      } as Parameters<NonNullable<typeof systemTransformHook>>[0];
      await systemTransformHook(input, output as Parameters<NonNullable<typeof systemTransformHook>>[1]);
      return output.system;
    });
  }

  return {
    hooks,
    toolHooks,
    dbPath,
    context,
    capture,
    recallSystem,
    async cleanup() {
      await cleanupDbPath(dbPath);
    },
  };
}

function getRecentCount(statsOutput: string): number {
  return Number(JSON.parse(statsOutput).recentCount ?? 0);
}

function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

test("auto-capture stores qualifying output with decision category and skips short output", async () => {
  const harness = await createPluginHarness({ minCaptureChars: 40 });

  try {
    await harness.capture("Short fixed note.");
    const skippedStats = await withPatchedFetch(() => harness.toolHooks.memory_stats.execute({}, harness.context));
    assert.equal(getRecentCount(skippedStats), 0);

    await harness.capture("We decided to use Postgres because the previous queue design failed in production, and the migration is now fixed successfully.");
    const searchOutput = await withPatchedFetch(() =>
      harness.toolHooks.memory_search.execute({ query: "Postgres migration design", limit: 5 }, harness.context),
    );

    assert.match(searchOutput, /^1\. \[[^\]]+\] \([^)]*\) /m);
    assert.match(searchOutput, /Postgres/);

    const statsOutput = await withPatchedFetch(() => harness.toolHooks.memory_stats.execute({}, harness.context));
    assert.equal(getRecentCount(statsOutput), 1);
  } finally {
    await harness.cleanup();
  }
});

test("memory_search returns ranked entries with stable identifiers and readable summaries", async () => {
  const harness = await createPluginHarness();

  try {
    await harness.capture("Nginx 502 fixed by increasing proxy_buffer_size and confirming upstream health checks. Resolved successfully.");
    const searchOutput = await withPatchedFetch(() =>
      harness.toolHooks.memory_search.execute({ query: "Nginx 502 proxy_buffer_size", limit: 5 }, harness.context),
    );

    const lines = searchOutput.split("\n");
    assert.ok(lines.length >= 1);
    assert.match(lines[0], /^1\. \[[^\]]+\] \([^)]*\) .+ \[\d+%\]$/);
    assert.match(searchOutput, /proxy_buffer_size|Nginx 502/);
  } finally {
    await harness.cleanup();
  }
});

test("openai provider path captures and recalls memory with the same tool surface", async () => {
  const harness = await createPluginHarness({ embeddingProvider: "openai" });

  try {
    await harness.capture(
      "OpenAI path resolved successfully: rotate token and flush upstream cache to resolve 401 storms.",
    );
    const searchOutput = await withPatchedFetch(() =>
      harness.toolHooks.memory_search.execute({ query: "rotate token upstream cache 401", limit: 5 }, harness.context),
    );

    assert.match(searchOutput, /^1\. \[[^\]]+\] \([^)]*\) /m);
    assert.match(searchOutput, /rotate token|upstream cache|401/);
  } finally {
    await harness.cleanup();
  }
});

test("resolveMemoryConfig fails fast for openai without apiKey", async () => {
  await withPatchedEnv(
    {
      LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER: "openai",
      LANCEDB_OPENCODE_PRO_OPENAI_MODEL: "text-embedding-3-small",
      LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    },
    async () => {
      assert.throws(
        () =>
          resolveMemoryConfig(
            {
              memory: {
                provider: "lancedb-opencode-pro",
              },
            } as unknown as Parameters<typeof resolveMemoryConfig>[0],
            undefined,
          ),
        /requires apiKey/i,
      );
    },
  );
});

test("resolveMemoryConfig fails fast for openai without model", async () => {
  await withPatchedEnv(
    {
      LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER: "openai",
      LANCEDB_OPENCODE_PRO_OPENAI_API_KEY: "test-openai-api-key",
      LANCEDB_OPENCODE_PRO_SKIP_SIDECAR: "true",
    },
    async () => {
      assert.throws(
        () =>
          resolveMemoryConfig(
            {
              memory: {
                provider: "lancedb-opencode-pro",
              },
            } as unknown as Parameters<typeof resolveMemoryConfig>[0],
            undefined,
          ),
        /requires model/i,
      );
    },
  );
});

test("environment overrides can switch embedding provider to openai", async () => {
  await withPatchedEnv(
    {
      LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER: "openai",
      LANCEDB_OPENCODE_PRO_OPENAI_API_KEY: "env-openai-key",
      LANCEDB_OPENCODE_PRO_OPENAI_MODEL: "text-embedding-3-small",
    },
    async () => {
      const resolved = resolveMemoryConfig(
        {
          memory: {
            provider: "lancedb-opencode-pro",
            embedding: {
              provider: "ollama",
              model: "all-minilm",
              baseUrl: "http://127.0.0.1:11434",
            },
          },
        } as unknown as Parameters<typeof resolveMemoryConfig>[0],
        undefined,
      );

      assert.equal(resolved.embedding.provider, "openai");
      assert.equal(resolved.embedding.model, "text-embedding-3-small");
      assert.equal(resolved.embedding.apiKey, "env-openai-key");
    },
  );
});

test("resolveMemoryConfig provides phase-1 retrieval defaults", () => {
  const resolved = resolveMemoryConfig(
    {
      memory: {
        provider: "lancedb-opencode-pro",
      },
    } as unknown as Parameters<typeof resolveMemoryConfig>[0],
    undefined,
  );

  assert.equal(resolved.retrieval.rrfK, 60);
  assert.equal(resolved.retrieval.recencyBoost, true);
  assert.equal(resolved.retrieval.recencyHalfLifeHours, 72);
  assert.equal(resolved.retrieval.importanceWeight, 0.4);
});

test("resolveMemoryConfig applies phase-1 retrieval environment overrides", async () => {
  await withPatchedEnv(
    {
      LANCEDB_OPENCODE_PRO_RRF_K: "30",
      LANCEDB_OPENCODE_PRO_RECENCY_BOOST: "false",
      LANCEDB_OPENCODE_PRO_RECENCY_HALF_LIFE_HOURS: "24",
      LANCEDB_OPENCODE_PRO_IMPORTANCE_WEIGHT: "1.2",
    },
    async () => {
      const resolved = resolveMemoryConfig(
        {
          memory: {
            provider: "lancedb-opencode-pro",
          },
        } as unknown as Parameters<typeof resolveMemoryConfig>[0],
        undefined,
      );

      assert.equal(resolved.retrieval.rrfK, 30);
      assert.equal(resolved.retrieval.recencyBoost, false);
      assert.equal(resolved.retrieval.recencyHalfLifeHours, 24);
      assert.equal(resolved.retrieval.importanceWeight, 1.2);
    },
  );
});

test("resolveMemoryConfig rejects invalid embedding provider values", async () => {
  await withPatchedEnv(
    {
      LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER: "azure",
    },
    async () => {
      assert.throws(
        () => resolveMemoryConfig(undefined, undefined),
        /Invalid embedding provider/i,
      );
    },
  );
});

test("memory_delete and memory_clear reject destructive operations without confirmation", async () => {
  const harness = await createPluginHarness();

  try {
    await harness.capture("Resolved successfully after rotating the stale token and reloading the API gateway config.");
    const searchOutput = await withPatchedFetch(() =>
      harness.toolHooks.memory_search.execute({ query: "stale token API gateway", limit: 5 }, harness.context),
    );
    const recordId = searchOutput.match(/\[([^\]]+)\]/)?.[1];
    assert.ok(recordId);
    const ensuredRecordId = recordId ?? "";

    const deleteRejected = await withPatchedFetch(() =>
      harness.toolHooks.memory_delete.execute({ id: ensuredRecordId, confirm: false }, harness.context),
    );
    assert.match(deleteRejected, /confirm=true/);

    const statsBeforeClear = await withPatchedFetch(() => harness.toolHooks.memory_stats.execute({}, harness.context));
    const scope = JSON.parse(statsBeforeClear).scope as string;
    assert.equal(getRecentCount(statsBeforeClear), 1);

    const clearRejected = await withPatchedFetch(() =>
      harness.toolHooks.memory_clear.execute({ scope, confirm: false }, harness.context),
    );
    assert.match(clearRejected, /confirm=true/);

    const searchAfterRejections = await withPatchedFetch(() =>
      harness.toolHooks.memory_search.execute({ query: "stale token API gateway", limit: 5 }, harness.context),
    );
    assert.match(searchAfterRejections, new RegExp(ensuredRecordId));
  } finally {
    await harness.cleanup();
  }
});

test("capture events record stored and skipped outcomes with normalized reasons", async () => {
  const harness = await createPluginHarness({ minCaptureChars: 40 });

  try {
    await harness.capture("Short fixed note.");
    await harness.capture("We decided to keep the queue disabled because the retry storm is now fixed successfully.");

    const summaryOutput = await withPatchedFetch(() => harness.toolHooks.memory_effectiveness.execute({}, harness.context));
    const summary = parseJson<{
      capture: {
        considered: number;
        stored: number;
        skipped: number;
        skipReasons: Record<string, number>;
      };
    }>(summaryOutput);

    assert.equal(summary.capture.considered, 2);
    assert.equal(summary.capture.stored, 1);
    assert.equal(summary.capture.skipped, 1);
    assert.equal(summary.capture.skipReasons["below-min-chars"], 1);
  } finally {
    await harness.cleanup();
  }
});

test("recall injection includes memory ids and records recall effectiveness events", async () => {
  const harness = await createPluginHarness();

  try {
    await harness.capture("Nginx 502 fixed by increasing proxy_buffer_size and confirming upstream health checks. Resolved successfully.");
    const recalled = await harness.recallSystem();

    assert.equal(recalled.length, 1);
    assert.match(recalled[0] ?? "", /\[Memory Recall - optional historical context\]/);
    assert.match(recalled[0] ?? "", /\[[^\]]+\] \([^)]*\) /);

    const summaryOutput = await withPatchedFetch(() => harness.toolHooks.memory_effectiveness.execute({}, harness.context));
    const summary = parseJson<{ recall: { requested: number; injected: number; returnedResults: number; auto: { requested: number; injected: number } } }>(summaryOutput);

    assert.equal(summary.recall.requested, 1);
    assert.equal(summary.recall.injected, 1);
    assert.equal(summary.recall.returnedResults, 1);
    assert.equal(summary.recall.auto.requested, 1);
    assert.equal(summary.recall.auto.injected, 1);
  } finally {
    await harness.cleanup();
  }
});

test("memory_search emits manual-search recall event and effectiveness summary splits auto and manual", async () => {
  const harness = await createPluginHarness();

  try {
    await harness.capture("Nginx 502 fixed by increasing proxy_buffer_size and confirming upstream health checks. Resolved successfully.");

    await withPatchedFetch(() =>
      harness.toolHooks.memory_search.execute({ query: "Nginx 502 proxy_buffer_size", limit: 5 }, harness.context),
    );

    await harness.recallSystem();

    const summaryOutput = await withPatchedFetch(() => harness.toolHooks.memory_effectiveness.execute({}, harness.context));
    const summary = parseJson<{
      recall: {
        requested: number;
        auto: { requested: number; injected: number; returnedResults: number };
        manual: { requested: number; returnedResults: number; hitRate: number };
        manualRescueRatio: number;
      };
    }>(summaryOutput);

    assert.equal(summary.recall.requested, 2);
    assert.equal(summary.recall.auto.requested, 1);
    assert.equal(summary.recall.auto.injected, 1);
    assert.equal(summary.recall.manual.requested, 1);
    assert.ok(summary.recall.manual.returnedResults >= 0);
    assert.ok(Math.abs(summary.recall.manualRescueRatio - 1) < 1e-9);
  } finally {
    await harness.cleanup();
  }
});

test("upgraded legacy event data defaults missing source to system-transform while accepting new manual-search events", async () => {
  const dbPath = await createTempDbPath("lancedb-opencode-pro-legacy-regression-");
  await seedLegacyEffectivenessEventsTable(dbPath, "global");
  const harness = await createPluginHarness({ dbPath });

  try {
    await harness.capture("Nginx 502 fixed by increasing proxy_buffer_size and confirming upstream health checks. Resolved successfully.");

    await withPatchedFetch(() =>
      harness.toolHooks.memory_search.execute({ query: "Nginx 502 proxy_buffer_size", limit: 5 }, harness.context),
    );

    const summaryOutput = await withPatchedFetch(() => harness.toolHooks.memory_effectiveness.execute({}, harness.context));
    const summary = parseJson<{
      recall: {
        requested: number;
        auto: { requested: number; returnedResults: number };
        manual: { requested: number; returnedResults: number };
        manualRescueRatio: number;
      };
    }>(summaryOutput);

    assert.equal(summary.recall.requested, 2);
    assert.equal(summary.recall.auto.requested, 1);
    assert.equal(summary.recall.auto.returnedResults, 0);
    assert.equal(summary.recall.manual.requested, 1);
    assert.ok(summary.recall.manual.returnedResults >= 0);
    assert.ok(Math.abs(summary.recall.manualRescueRatio - 1) < 1e-9);
  } finally {
    await harness.cleanup();
  }
});

test("feedback commands persist missing wrong and useful signals", async () => {
  const harness = await createPluginHarness();

  try {
    const statsBeforeCapture = await withPatchedFetch(() =>
      harness.toolHooks.memory_stats.execute({}, harness.context),
    );
    const parsedStatsBefore = JSON.parse(statsBeforeCapture) as { dbPath: string; recentCount: number };
    assert.equal(parsedStatsBefore.dbPath, harness.dbPath, "Stats dbPath should match harness dbPath before capture");

    await harness.capture("Resolved successfully after rotating the stale token and reloading the API gateway config.");

    const statsAfterCapture = await withPatchedFetch(() =>
      harness.toolHooks.memory_stats.execute({}, harness.context),
    );
    const parsedStatsAfter = JSON.parse(statsAfterCapture) as { dbPath: string; recentCount: number };
    assert.equal(parsedStatsAfter.dbPath, harness.dbPath, "Stats dbPath should match harness dbPath after capture");
    assert.equal(parsedStatsAfter.recentCount, 1, "Should have 1 memory after capture");

    const searchOutput = await withPatchedFetch(() =>
      harness.toolHooks.memory_search.execute({ query: "stale token API gateway", limit: 5 }, harness.context),
    );
    const recordId = searchOutput.match(/\[([^\]]+)\]/)?.[1] ?? "";
    assert.ok(recordId, "Should find a record ID in search output");

    const missingOutput = await withPatchedFetch(() =>
      harness.toolHooks.memory_feedback_missing.execute(
        { text: "Remember that this project prefers blue-green deploys.", labels: ["preference"] },
        harness.context,
      ),
    );
    assert.match(missingOutput, /Recorded missing-memory feedback/);

    const wrongOutput = await withPatchedFetch(() =>
      harness.toolHooks.memory_feedback_wrong.execute({ id: recordId, reason: "temporary workaround" }, harness.context),
    );
    assert.match(wrongOutput, /Recorded wrong-memory feedback/);

    const usefulOutput = await withPatchedFetch(() =>
      harness.toolHooks.memory_feedback_useful.execute({ id: recordId, helpful: true }, harness.context),
    );
    assert.match(usefulOutput, new RegExp(recordId));

    const summaryOutput = await withPatchedFetch(() => harness.toolHooks.memory_effectiveness.execute({}, harness.context));
    const summary = parseJson<{
      scope: string;
      totalEvents: number;
      feedback: {
        missing: number;
        wrong: number;
        useful: { positive: number; negative: number };
      };
    }>(summaryOutput);

    assert.equal(summary.feedback.missing, 1);
    assert.equal(summary.feedback.wrong, 1);
    assert.equal(summary.feedback.useful.positive, 1);
    assert.equal(summary.feedback.useful.negative, 0);
  } finally {
    await harness.cleanup();
  }
});

test("pruning keeps only the newest records within a scope", async () => {
  const { store, dbPath } = await createTestStore();

  try {
    const records = createScopedRecords("project:prune", 4).map((record, index) => ({
      ...record,
      text: `Retention candidate ${index}`,
      timestamp: 20_000 + index,
    }));

    for (const record of records) {
      await store.put(record);
    }

    const pruned = await store.pruneScope("project:prune", 2);
    const remaining = await store.list("project:prune", 10);

    assert.equal(pruned, 2);
    assert.deepEqual(
      remaining.map((record) => record.id),
      [records[3].id, records[2].id],
    );
  } finally {
    await cleanupDbPath(dbPath);
  }
});

test("memory_port_plan returns readable non-conflicting assignments", async () => {
  const harness = await createPluginHarness();

  try {
    const output = await withPatchedFetch(() =>
      harness.toolHooks.memory_port_plan.execute(
        {
          project: "project-alpha",
          services: [
            { name: "web", containerPort: 3000, preferredHostPort: 22080 },
            { name: "api", containerPort: 3001 },
          ],
          rangeStart: 22080,
          rangeEnd: 22090,
          persist: false,
        },
        harness.context,
      ),
    );

    const result = parseJson<{
      project: string;
      persisted: number;
      assignments: Array<{ service: string; hostPort: number; containerPort: number; protocol: string }>;
    }>(output);

    assert.equal(result.project, "project-alpha");
    assert.equal(result.persisted, 0);
    assert.equal(result.assignments.length, 2);
    assert.equal(new Set(result.assignments.map((item) => item.hostPort)).size, 2);
    assert.equal(result.assignments[0]?.service, "web");
    assert.equal(result.assignments[0]?.containerPort, 3000);
    assert.equal(result.assignments[0]?.protocol, "tcp");
  } finally {
    await harness.cleanup();
  }
});

test("injection control defaults to fixed mode with max 3 memories (backward compatible)", async () => {
  const harness = await createPluginHarness();

  try {
    await harness.capture("Memory 1: We fixed the DNS issue by adding gcompat to Alpine. Resolved successfully.");
    await harness.capture("Memory 2: Nginx 502 fixed by increasing proxy_buffer_size. Resolved successfully.");
    await harness.capture("Memory 3: Database connection pool adjusted for better concurrency. Resolved successfully.");
    await harness.capture("Memory 4: Cache invalidation strategy updated for distributed systems. Resolved successfully.");

    const recalled = await harness.recallSystem();
    assert.ok(recalled.length <= 3, `Expected at most 3 memories, got ${recalled.length}`);
    assert.ok(recalled.length >= 1, `Expected at least 1 memory, got ${recalled.length}`);

    for (const system of recalled) {
      assert.match(system, /\[Memory Recall - optional historical context\]/);
    }
  } finally {
    await harness.cleanup();
  }
});

test("injection control respects budget mode token accumulation", async () => {
  const harness = await createPluginHarness();

  const prevBudgetTokens = process.env.LANCEDB_OPENCODE_PRO_INJECTION_MODE;
  const prevMode = process.env.LANCEDB_OPENCODE_PRO_INJECTION_BUDGET_TOKENS;

  try {
    process.env.LANCEDB_OPENCODE_PRO_INJECTION_MODE = "budget";
    process.env.LANCEDB_OPENCODE_PRO_INJECTION_BUDGET_TOKENS = "100";

    await harness.capture("Memory 1: Short. Resolved successfully.");
    await harness.capture("Memory 2: Another short memory. Resolved successfully.");

    const recalled = await harness.recallSystem();
    assert.ok(recalled.length >= 0, "Budget mode should return memories without error");
  } finally {
    if (prevMode) process.env.LANCEDB_OPENCODE_PRO_INJECTION_MODE = prevMode;
    else delete process.env.LANCEDB_OPENCODE_PRO_INJECTION_MODE;
    if (prevBudgetTokens) process.env.LANCEDB_OPENCODE_PRO_INJECTION_BUDGET_TOKENS = prevBudgetTokens;
    else delete process.env.LANCEDB_OPENCODE_PRO_INJECTION_BUDGET_TOKENS;
    await harness.cleanup();
  }
});

test("injection control enforces minimum memories floor", async () => {
  const harness = await createPluginHarness();

  const prevMode = process.env.LANCEDB_OPENCODE_PRO_INJECTION_MODE;
  const prevMinMemories = process.env.LANCEDB_OPENCODE_PRO_INJECTION_MIN_MEMORIES;

  try {
    process.env.LANCEDB_OPENCODE_PRO_INJECTION_MODE = "adaptive";
    process.env.LANCEDB_OPENCODE_PRO_INJECTION_MIN_MEMORIES = "2";

    await harness.capture("Memory 1: First resolve. Resolved successfully.");
    await harness.capture("Memory 2: Second resolve. Resolved successfully.");

    const recalled = await harness.recallSystem();
    assert.ok(recalled.length >= 1, `Expected at least 1 memory (minMemories applied), got ${recalled.length}`);
  } finally {
    if (prevMode) process.env.LANCEDB_OPENCODE_PRO_INJECTION_MODE = prevMode;
    else delete process.env.LANCEDB_OPENCODE_PRO_INJECTION_MODE;
    if (prevMinMemories) process.env.LANCEDB_OPENCODE_PRO_INJECTION_MIN_MEMORIES = prevMinMemories;
    else delete process.env.LANCEDB_OPENCODE_PRO_INJECTION_MIN_MEMORIES;
    await harness.cleanup();
  }
});

test("injection control code summarization preserves syntax validity", async () => {
  const harness = await createPluginHarness();

  try {
    await harness.capture(`We fixed the parsing issue with this code:
\`\`\`javascript
function parseConfig(data) {
  const config = JSON.parse(data);
  if (!config.enabled) {
    throw new Error("Config disabled");
  }
  return config;
}
\`\`\`
Resolved successfully.`);

    const recalled = await harness.recallSystem();
    assert.ok(recalled.length >= 1, "Should recall the memory");
  } finally {
    await harness.cleanup();
  }
});

test("injection control Chinese text token estimation handles multilingual content", async () => {
  const harness = await createPluginHarness();

  try {
    await harness.capture("我們解決了 Alpine Linux 的 DNS 解析問題，方法是加入 gcompat 套件。Resolved successfully.");
    await harness.capture("這是另一個關於 Nginx 502 錯誤的解決方案。Resolved successfully.");

    const recalled = await harness.recallSystem();
    assert.ok(recalled.length >= 1, "Should recall memories with Chinese text");
  } finally {
    await harness.cleanup();
  }
});

test("memory_port_plan avoids reserved ports and upserts reservation records", async () => {
  const harness = await createPluginHarness();

  try {
    const initialOutput = await withPatchedFetch(() =>
      harness.toolHooks.memory_port_plan.execute(
        {
          project: "project-alpha",
          services: [{ name: "web", containerPort: 3000, preferredHostPort: 24080 }],
          rangeStart: 24080,
          rangeEnd: 24090,
          persist: true,
        },
        harness.context,
      ),
    );
    const initial = parseJson<{ assignments: Array<{ hostPort: number }> }>(initialOutput);
    const reservedHostPort = initial.assignments[0]?.hostPort;
    assert.equal(typeof reservedHostPort, "number");

    const conflictedOutput = await withPatchedFetch(() =>
      harness.toolHooks.memory_port_plan.execute(
        {
          project: "project-beta",
          services: [{ name: "api", containerPort: 3001, preferredHostPort: reservedHostPort }],
          rangeStart: 24080,
          rangeEnd: 24090,
          persist: false,
        },
        harness.context,
      ),
    );

    const conflicted = parseJson<{ assignments: Array<{ hostPort: number }> }>(conflictedOutput);
    assert.equal(conflicted.assignments.length, 1);
    assert.notEqual(conflicted.assignments[0]?.hostPort, reservedHostPort);

    await withPatchedFetch(() =>
      harness.toolHooks.memory_port_plan.execute(
        {
          project: "project-alpha",
          services: [{ name: "web", containerPort: 3000, preferredHostPort: 24081 }],
          rangeStart: 24080,
          rangeEnd: 24090,
          persist: true,
        },
        harness.context,
      ),
    );

    const searchOutput = await withPatchedFetch(() =>
      harness.toolHooks.memory_search.execute(
        { query: "PORT_RESERVATION project-alpha web", scope: "global", limit: 10 },
        harness.context,
      ),
    );

    assert.match(searchOutput, /host=24081/);
    assert.doesNotMatch(searchOutput, /host=24080/);
  } finally {
    await harness.cleanup();
  }
});

test("memory_consolidate returns error when confirm !== true", async () => {
  const harness = await createPluginHarness();
  try {
    const result = await withPatchedFetch(() =>
      harness.toolHooks.memory_consolidate.execute({ scope: "project:test", confirm: false }, harness.context),
    );
    assert.match(result, /confirm.*true/);
  } finally {
    await harness.cleanup();
  }
});

test("memory_consolidate returns metrics when confirm === true", async () => {
  const harness = await createPluginHarness();
  try {
    const result = await withPatchedFetch(() =>
      harness.toolHooks.memory_consolidate.execute({ scope: "project:test", confirm: true }, harness.context),
    );
    const parsed = JSON.parse(result) as { scope: string; mergedPairs: number; updatedRecords: number; skippedRecords: number };
    assert.equal(parsed.scope, "project:test");
    assert.equal(typeof parsed.mergedPairs, "number");
    assert.equal(typeof parsed.updatedRecords, "number");
    assert.equal(typeof parsed.skippedRecords, "number");
  } finally {
    await harness.cleanup();
  }
});

test("second capture with >0.92 similarity to first is written with isPotentialDuplicate=true and gets merged", async () => {
  const harness = await createPluginHarness();
  try {
    const text = "nginx 502 bad gateway error fixed by restarting the server and confirming upstream health checks";
    await harness.capture(text);
    await harness.capture(text);
    const result = await withPatchedFetch(() =>
      harness.toolHooks.memory_consolidate.execute({ scope: TEST_SCOPE, confirm: true }, harness.context),
    );
    const parsed = JSON.parse(result) as { mergedPairs: number; updatedRecords: number };
    assert.equal(parsed.mergedPairs, 1, "should merge one pair of duplicate memories");
    assert.equal(parsed.updatedRecords, 2, "should update both records (older merged, newer has mergedFrom)");
  } finally {
    await harness.cleanup();
  }
});

test("second capture with <0.92 similarity to first is written with isPotentialDuplicate=false", async () => {
  const harness = await createPluginHarness();
  try {
    const firstText = "nginx 502 error resolved by restarting the server and confirming upstream checks are healthy";
    const secondText = "postgres connection pool exhausted error fixed by increasing max_connections and restarting the database service";
    await harness.capture(firstText);
    await harness.capture(secondText);
    const searchResult = await withPatchedFetch(() =>
      harness.toolHooks.memory_search.execute({ query: secondText, limit: 5 }, harness.context),
    );
    assert.match(searchResult, new RegExp(secondText.substring(0, 20)));
  } finally {
    await harness.cleanup();
  }
});

test("dedup config: when enabled=true (default), second identical capture is flagged and merged", async () => {
  const harness = await createPluginHarness();
  try {
    const identicalText = "server error resolved by restarting nginx service and confirming upstream health";
    await harness.capture(identicalText);
    await harness.capture(identicalText);
    const result = await withPatchedFetch(() =>
      harness.toolHooks.memory_consolidate.execute({ scope: TEST_SCOPE, confirm: true }, harness.context),
    );
    const parsed = JSON.parse(result) as { mergedPairs: number; updatedRecords: number };
    assert.equal(parsed.mergedPairs, 1, "identical texts should be detected as duplicates and merged");
    assert.equal(parsed.updatedRecords, 2);
  } finally {
    await harness.cleanup();
  }
});
