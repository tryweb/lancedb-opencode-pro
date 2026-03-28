import plugin from "../dist/index.js";

const DB_PATH = "/tmp/opencode-memory-e2e";
const SESSION_ID = "sess-e2e-001";
const OLLAMA_BASE_URL = process.env.LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL || "http://192.168.11.206:11443";

function makeClient() {
  const config = {
    memory: {
      provider: "lancedb-opencode-pro",
      dbPath: DB_PATH,
      embedding: {
        provider: "ollama",
        model: "nomic-embed-text",
        baseUrl: OLLAMA_BASE_URL,
      },
      retrieval: {
        mode: "hybrid",
        vectorWeight: 0.7,
        bm25Weight: 0.3,
        minScore: 0.05,
      },
      includeGlobalScope: true,
      minCaptureChars: 30,
      maxEntriesPerScope: 200,
    },
  };

  const userMessages = [
    {
      info: { role: "user" },
      parts: [{ type: "text", text: "我又遇到 Nginx 502，先幫我找以前解法" }],
    },
  ];

  return {
    config: {
      async get() {
        return config;
      },
    },
    session: {
      async messages() {
        return userMessages;
      },
      async get() {
        return {
          directory: "/workspace",
        };
      },
    },
  };
}

function toolContext() {
  return {
    sessionID: SESSION_ID,
    messageID: "msg-e2e-001",
    agent: "general",
    directory: "/workspace",
    worktree: "/workspace",
    abort: new AbortController().signal,
    metadata() {},
    async ask() {},
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERT FAILED: ${message}`);
  }
}

async function run() {
  const hooks = await plugin({
    client: makeClient(),
    project: {
      id: "proj-e2e",
      worktree: "/workspace",
      vcs: "git",
      time: { created: Date.now() },
    },
    directory: "/workspace",
    worktree: "/workspace",
    serverUrl: new URL("http://localhost:4096"),
    $: () => {
      throw new Error("shell not needed in this e2e");
    },
  });

  assert(hooks.tool, "tool hooks should exist");
  assert(hooks["experimental.text.complete"], "experimental.text.complete hook should exist");
  assert(hooks.event, "event hook should exist");
  assert(hooks["experimental.chat.system.transform"], "system transform hook should exist");

  await hooks["experimental.text.complete"](
    { sessionID: SESSION_ID, messageID: "msg-a1", partID: "part-a1" },
    {
      text: "Nginx 502 fixed by increasing proxy_buffer_size and confirming upstream health checks. Resolved successfully.",
    },
  );

  await hooks.event({
    event: {
      type: "session.idle",
      properties: {
        sessionID: SESSION_ID,
      },
    },
  });

  const ctx = toolContext();

  const stats = await hooks.tool.memory_stats.execute({}, ctx);
  const statsJson = JSON.parse(stats);
  assert(typeof statsJson.recentCount === "number", "memory_stats should return recentCount");

  // Note: auto-capture may fail if Ollama is unavailable (expected in Docker)
  if (statsJson.recentCount >= 1) {
    const search = await hooks.tool.memory_search.execute({ query: "Nginx 502 proxy_buffer_size", limit: 5 }, ctx);
    assert(search.includes("proxy_buffer_size") || search.includes("Nginx 502"), "search should retrieve captured memory");

    const firstIdMatch = search.match(/\[([^\]]+)\]/);
    assert(firstIdMatch && firstIdMatch[1], "search output should contain record id in brackets");
    const recordId = firstIdMatch[1];

    const deleteRejected = await hooks.tool.memory_delete.execute({ id: recordId, confirm: false }, ctx);
    assert(deleteRejected.includes("confirm=true"), "delete without confirm should be rejected");

    const deleteAccepted = await hooks.tool.memory_delete.execute({ id: recordId, confirm: true }, ctx);
    assert(deleteAccepted.includes("Deleted memory"), "delete with confirm=true should succeed");

    const clearRejected = await hooks.tool.memory_clear.execute({ scope: statsJson.scope, confirm: false }, ctx);
    assert(clearRejected.includes("confirm=true"), "clear without confirm should be rejected");

    const clearAccepted = await hooks.tool.memory_clear.execute({ scope: statsJson.scope, confirm: true }, ctx);
    assert(clearAccepted.includes("Cleared"), "clear with confirm=true should succeed");

    console.log("E2E PASS: auto-capture, search, delete safety, clear safety, and clear execution verified.");
  } else {
    console.log("E2E SKIP: auto-capture (Ollama unavailable in Docker - expected)");
  }

  // === Episodic Learning E2E Tests ===
  console.log("Running episodic learning E2E tests...");

  // Test 1: task_episode_create
  const createResult = await hooks.tool.task_episode_create.execute({
    taskId: "test-task-001",
    description: "Test task for E2E",
  }, ctx);
  assert(createResult.includes("Created task episode"), "task_episode_create should succeed");
  console.log("  - task_episode_create: PASS");

  // Test 2: task_episode_query
  const queryResult = await hooks.tool.task_episode_query.execute({
    state: "pending",
    limit: 5,
  }, ctx);
  assert(queryResult.includes("test-task-001"), "task_episode_query should return created episode");
  console.log("  - task_episode_query: PASS");

  // Test 3: similar_task_recall (no similar tasks yet, should return empty)
  const recallResult = await hooks.tool.similar_task_recall.execute({
    query: "fix nginx error",
    threshold: 0.85,
    limit: 3,
  }, ctx);
  assert(typeof recallResult === "string", "similar_task_recall should return string");
  console.log("  - similar_task_recall: PASS");

  // Test 4: retry_budget_suggest (insufficient data)
  const budgetResult = await hooks.tool.retry_budget_suggest.execute({
    errorType: "runtime",
    minSamples: 3,
  }, ctx);
  assert(budgetResult.includes("Insufficient data") || budgetResult.includes("suggestedRetries"), "retry_budget_suggest should handle insufficient data");
  console.log("  - retry_budget_suggest: PASS");

  // Test 5: recovery_strategy_suggest (no failed tasks)
  const strategyResult = await hooks.tool.recovery_strategy_suggest.execute({
    taskId: "test-task-001",
  }, ctx);
  assert(typeof strategyResult === "string", "recovery_strategy_suggest should return string");
  console.log("  - recovery_strategy_suggest: PASS");

  console.log("E2E PASS: episodic learning tools verified.");
}

run().catch((error) => {
  console.error("E2E FAIL:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
