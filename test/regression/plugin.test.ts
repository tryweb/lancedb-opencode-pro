import assert from "node:assert/strict";
import test from "node:test";
import plugin from "../../src/index.js";
import { cleanupDbPath, createScopedRecords, createTempDbPath, createTestStore, createVector } from "../setup.js";

const SESSION_ID = "sess-test-001";
const WORKTREE = "/workspace/project-under-test";

type MessagePart = { type: "text"; text: string };
type SessionMessage = { info: { role: string }; parts: MessagePart[] };
type PluginInput = Parameters<typeof plugin>[0];

function makeEmbedding(prompt: string, dim = 384): number[] {
  const base = Math.max(1, prompt.length % 10) / 10;
  return createVector(dim, base);
}

function createFetchMock() {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as { prompt?: string } : {};
    const prompt = body.prompt ?? String(input);
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
}) {
  const dbPath = await createTempDbPath("lancedb-opencode-pro-regression-");
  const memoryConfig = {
    memory: {
      provider: "lancedb-opencode-pro",
      dbPath,
      embedding: {
        provider: "ollama" as const,
        model: "all-minilm",
        baseUrl: "http://127.0.0.1:11434",
      },
      retrieval: {
        mode: "hybrid" as const,
        vectorWeight: 0.7,
        bm25Weight: 0.3,
        minScore: 0.01,
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

  const hooks = await withPatchedEnv(
    {
      LANCEDB_OPENCODE_PRO_DB_PATH: dbPath,
      LANCEDB_OPENCODE_PRO_EMBEDDING_MODEL: memoryConfig.memory.embedding.model,
      LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL: memoryConfig.memory.embedding.baseUrl,
      LANCEDB_OPENCODE_PRO_MIN_CAPTURE_CHARS: String(memoryConfig.memory.minCaptureChars),
      LANCEDB_OPENCODE_PRO_MAX_ENTRIES_PER_SCOPE: String(memoryConfig.memory.maxEntriesPerScope),
    },
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
  if (hooks.config) {
    await hooks.config(memoryConfig as unknown as Parameters<NonNullable<typeof hooks.config>>[0]);
  }

  const toolHooks = hooks.tool;
  const eventHook = hooks.event;
  const textCompleteHook = hooks["experimental.text.complete"];

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

  return {
    hooks,
    toolHooks,
    dbPath,
    context,
    capture,
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

    assert.match(searchOutput, /^1\. \[[^\]]+\] \([^\)]+\) /m);
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
    assert.match(lines[0], /^1\. \[[^\]]+\] \([^\)]+\) .+ \[\d+%\]$/);
    assert.match(searchOutput, /proxy_buffer_size|Nginx 502/);
  } finally {
    await harness.cleanup();
  }
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

    const deleteRejected = await withPatchedFetch(() =>
      harness.toolHooks.memory_delete.execute({ id: recordId!, confirm: false }, harness.context),
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
    assert.match(searchAfterRejections, new RegExp(recordId!));
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
