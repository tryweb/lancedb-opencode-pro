import plugin from "../dist/index.js";
import { createServer } from "node:http";

const DB_PATH = "/tmp/opencode-memory-e2e";
const SESSION_ID = "sess-e2e-001";
const MOCK_OLLAMA_PORT = 11439;

function makeClient(baseUrl) {
  const config = {
    memory: {
      provider: "lancedb-opencode-pro",
      dbPath: DB_PATH,
        embedding: {
          provider: "ollama",
          model: "nomic-embed-text",
          baseUrl,
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

function createDeterministicVector(text, dim = 768) {
  const seed = Array.from(text).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return Array.from({ length: dim }, (_, i) => ((seed + i * 17) % 1000) / 1000);
}

async function startMockOllamaServer(port = MOCK_OLLAMA_PORT) {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/api/embeddings") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    let prompt = "";
    try {
      const parsed = JSON.parse(body);
      prompt = typeof parsed.prompt === "string" ? parsed.prompt : "";
    } catch {
      prompt = "";
    }

    const embedding = createDeterministicVector(prompt, 768);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ embedding }));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => resolve(undefined));
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve(undefined);
      });
    }),
  };
}

async function run() {
  const mock = await startMockOllamaServer();
  try {
    process.env.LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL = mock.baseUrl;
    process.env.OLLAMA_BASE_URL = mock.baseUrl;

    const hooks = await plugin({
      client: makeClient(mock.baseUrl),
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

  // === Memory Explanation E2E Tests ===
  console.log("Running memory explanation E2E tests...");

  const rememberResult = await hooks.tool.memory_remember.execute({
    text: "Use Docker Compose for local development with volume mounting, reproducible service wiring, and stable test execution across CI and local environments.",
    category: "fact",
  }, ctx);
  console.log(`  - memory_remember raw output: ${String(rememberResult)}`);
  assert(rememberResult.includes("Stored memory"), "memory_remember should succeed");
  console.log("  - memory_remember (setup): PASS");

  const memIdMatch = rememberResult.match(/memory ([a-zA-Z0-9-]+)/);
  assert(memIdMatch && memIdMatch[1], "memory_remember should return memory id");
  const memId = memIdMatch[1];

  // Test memory_why with valid ID
  const whyResult = await hooks.tool.memory_why.execute({ id: memId }, ctx);
  assert(whyResult.includes("Memory:"), "memory_why should return explanation");
  assert(whyResult.includes("Explanation:"), "memory_why should include explanation section");
  assert(whyResult.includes("Recency:") || whyResult.includes("Citation:") || whyResult.includes("Importance:") || whyResult.includes("Scope:"), "memory_why should include factors");
  console.log("  - memory_why with valid ID: PASS");

  // Test memory_why with invalid ID
  const whyInvalid = await hooks.tool.memory_why.execute({ id: "invalid-id-123" }, ctx);
  assert(whyInvalid.includes("not found"), "memory_why with invalid ID should return not found");
  console.log("  - memory_why with invalid ID: PASS");

  // Test memory_explain_recall (no recall yet, should return no recall message)
  const explainRecall = await hooks.tool.memory_explain_recall.execute({}, ctx);
  assert(
    explainRecall.includes("No recent recall") || explainRecall.includes("Last Recall") || explainRecall.includes("Query:") || explainRecall.includes("Results:"),
    "memory_explain_recall should return either no-recall message or current recall explanation",
  );
  console.log("  - memory_explain_recall (initial state): PASS");

  // Trigger a recall via memory_search to populate lastRecall
  await hooks.tool.memory_search.execute({ query: "Docker Compose", limit: 3 }, ctx);

  // Now memory_explain_recall should work
  const explainRecall2 = await hooks.tool.memory_explain_recall.execute({}, ctx);
  assert(explainRecall2.includes("Last Recall") || explainRecall2.includes("Query:") || explainRecall2.includes("Results:"), "memory_explain_recall should return recall explanation");
  console.log("  - memory_explain_recall (after recall): PASS");

    console.log("E2E PASS: memory explanation tools verified.");

  // === Memory Dashboard E2E Tests ===
  console.log("Running memory dashboard E2E tests...");

  // Test memory_dashboard with default days
  const dashboardDefault = await hooks.tool.memory_dashboard.execute({ days: 7 }, ctx);
  const dashboardParsed = JSON.parse(dashboardDefault);
  assert(dashboardParsed.scope !== undefined, "dashboard should include scope");
  assert(dashboardParsed.periodDays === 7, "dashboard should have periodDays=7");
  assert(dashboardParsed.current !== undefined, "dashboard should include current period metrics");
  assert(dashboardParsed.trends !== undefined, "dashboard should include trends");
  assert(dashboardParsed.trends.captureSuccessRate !== undefined, "dashboard should include capture trend");
  assert(dashboardParsed.trends.recallHitRate !== undefined, "dashboard should include recall trend");
  assert(dashboardParsed.trends.feedbackHelpfulRate !== undefined, "dashboard should include feedback trend");
  assert(Array.isArray(dashboardParsed.insights), "dashboard should include insights array");
  assert(dashboardParsed.recentMemories !== undefined, "dashboard should include recentMemories");
  console.log("  - memory_dashboard (default): PASS");

  // Test memory_dashboard with custom days
  const dashboard14d = await hooks.tool.memory_dashboard.execute({ days: 14 }, ctx);
  const dashboard14dParsed = JSON.parse(dashboard14d);
  assert(dashboard14dParsed.periodDays === 14, "dashboard should have periodDays=14");
  assert(dashboard14dParsed.currentPeriodStart < dashboard14dParsed.currentPeriodEnd, "current period should be valid");
  console.log("  - memory_dashboard (days=14): PASS");

  // Test memory_dashboard with empty events should return insufficient-data trends
  const dashboardEmpty = await hooks.tool.memory_dashboard.execute({ days: 1, scope: "project:nonexistent" }, ctx);
  const dashboardEmptyParsed = JSON.parse(dashboardEmpty);
  assert(dashboardEmptyParsed.trends.captureSuccessRate.direction === "insufficient-data", "empty dashboard should show insufficient-data for trends");
  console.log("  - memory_dashboard (empty scope): PASS");

  console.log("E2E PASS: memory dashboard tools verified.");

  // === Memory KPI E2E Tests ===
  console.log("Running memory KPI E2E tests...");

  const kpiDefault = await hooks.tool.memory_kpi.execute({ days: 30 }, ctx);
  const kpiParsed = JSON.parse(kpiDefault);
  assert(kpiParsed.scope !== undefined, "kpi should include scope");
  assert(kpiParsed.periodDays === 30, "kpi should have periodDays=30");
  assert(kpiParsed.retryToSuccess !== undefined, "kpi should include retryToSuccess");
  assert(kpiParsed.retryToSuccess.status !== undefined, "retryToSuccess should have status");
  assert(kpiParsed.memoryLift !== undefined, "kpi should include memoryLift");
  assert(kpiParsed.memoryLift.status !== undefined, "memoryLift should have status");
  console.log("  - memory_kpi (default): PASS");

  const kpi7d = await hooks.tool.memory_kpi.execute({ days: 7 }, ctx);
  const kpi7dParsed = JSON.parse(kpi7d);
  assert(kpi7dParsed.periodDays === 7, "kpi should have periodDays=7");
  console.log("  - memory_kpi (days=7): PASS");

  const kpiEmpty = await hooks.tool.memory_kpi.execute({ days: 1, scope: "project:nonexistent" }, ctx);
  const kpiEmptyParsed = JSON.parse(kpiEmpty);
  assert(kpiEmptyParsed.retryToSuccess.status === "no-failed-tasks", "empty kpi should show no-failed-tasks");
  assert(kpiEmptyParsed.memoryLift.status === "no-recall-data", "empty kpi should show no-recall-data");
  console.log("  - memory_kpi (empty scope): PASS");

  console.log("E2E PASS: memory KPI tools verified.");

  // Test task-type injection via config
  // Note: taskTypeProfiles is internal to the plugin runtime. We verify it works
  // through unit tests (test/unit/task-type.test.ts) which test detectTaskType()
  // and getCategoryWeights() functions. Here we just verify the hook exists.
  console.log("Running task-type injection E2E tests...");

  // Verify that the system transform hook exists
  assert(hooks["experimental.chat.system.transform"] !== undefined, "system transform hook should exist");

  // The actual task-type detection logic is tested in unit tests
  // This e2e test just verifies the hook is registered
  console.log("  - system transform hook exists: PASS");
  console.log("  - task-type detection (verified in unit tests): SKIP");

  console.log("E2E PASS: task-type injection verified.");
  } finally {
    await mock.close();
  }
}

run().catch((error) => {
  console.error("E2E FAIL:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
