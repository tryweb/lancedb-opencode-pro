import plugin from "../dist/index.js";

const DB_PATH = "/tmp/opencode-memory-e2e";
const SESSION_ID = "sess-e2e-001";

function makeClient() {
  const config = {
    memory: {
      provider: "lancedb-opencode-pro",
      dbPath: DB_PATH,
      embedding: {
        provider: "ollama",
        model: "nomic-embed-text",
        baseUrl: "http://192.168.11.206:11434",
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
  assert(statsJson.recentCount >= 1, "auto-capture should create at least one record");

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
}

run().catch((error) => {
  console.error("E2E FAIL:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
