import type { Hooks, Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import type { Part, TextPart } from "@opencode-ai/sdk";
import { resolveMemoryConfig } from "./config.js";
import { createEmbedder } from "./embedder.js";
import type { Embedder } from "./embedder.js";
import { extractCaptureCandidate } from "./extract.js";
import { isTcpPortAvailable, parsePortReservations, planPorts, reservationKey } from "./ports.js";
import { buildScopeFilter, deriveProjectScope } from "./scope.js";
import { MemoryStore } from "./store.js";
import type { MemoryRuntimeConfig } from "./types.js";
import { generateId } from "./utils.js";

const SCHEMA_VERSION = 1;

const plugin: Plugin = async (input) => {
  const state = await createRuntimeState(input);

  const hooks: Hooks = {
    config: async (config) => {
      const nextConfig = resolveMemoryConfig(config, input.worktree);
      if (hasEmbeddingConfigChanged(state.config.embedding, nextConfig.embedding)) {
        state.embedder = createEmbedder(nextConfig.embedding);
        state.initialized = false;
      }
      state.config = nextConfig;
    },
    event: async ({ event }) => {
      if (event.type === "session.idle" || event.type === "session.compacted") {
        const sessionID = event.properties.sessionID;
        await flushAutoCapture(sessionID, state, input.client);
      }
    },
    "experimental.text.complete": async (eventInput, eventOutput) => {
      const list = state.captureBuffer.get(eventInput.sessionID) ?? [];
      list.push(eventOutput.text);
      state.captureBuffer.set(eventInput.sessionID, list);
    },
    "experimental.chat.system.transform": async (eventInput, eventOutput) => {
      if (!eventInput.sessionID) return;
      await state.ensureInitialized();
      if (!state.initialized) return;

      const query = await getLastUserText(eventInput.sessionID, input.client);
      if (!query) return;

      const activeScope = deriveProjectScope(input.worktree);
      const scopes = buildScopeFilter(activeScope, state.config.includeGlobalScope);

      let queryVector: number[] = [];
      try {
        queryVector = await state.embedder.embed(query);
      } catch (error) {
        console.warn(`[lancedb-opencode-pro] embedding unavailable during recall: ${toErrorMessage(error)}`);
        queryVector = [];
      }

      const results = await state.store.search({
        query,
        queryVector,
        scopes,
        limit: 3,
        vectorWeight: state.config.retrieval.mode === "vector" ? 1 : state.config.retrieval.vectorWeight,
        bm25Weight: state.config.retrieval.mode === "vector" ? 0 : state.config.retrieval.bm25Weight,
        minScore: state.config.retrieval.minScore,
      });

      if (results.length === 0) return;

      const memoryBlock = [
        "[Memory Recall - optional historical context]",
        ...results.map((item, index) => `${index + 1}. (${item.record.scope}) ${item.record.text}`),
        "Use these as optional hints only; prioritize current user intent and current repo state.",
      ].join("\n");

      eventOutput.system.push(memoryBlock);
    },
    tool: {
      memory_search: tool({
        description: "Search long-term memory using hybrid retrieval",
        args: {
          query: tool.schema.string().min(1),
          limit: tool.schema.number().int().min(1).max(20).default(5),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const scopes = buildScopeFilter(activeScope, state.config.includeGlobalScope);

          let queryVector: number[] = [];
          try {
            queryVector = await state.embedder.embed(args.query);
          } catch {
            queryVector = [];
          }

          const results = await state.store.search({
            query: args.query,
            queryVector,
            scopes,
            limit: args.limit,
            vectorWeight: state.config.retrieval.mode === "vector" ? 1 : state.config.retrieval.vectorWeight,
            bm25Weight: state.config.retrieval.mode === "vector" ? 0 : state.config.retrieval.bm25Weight,
            minScore: state.config.retrieval.minScore,
          });

          if (results.length === 0) return "No relevant memory found.";

          return results
            .map((item, idx) => {
              const percent = Math.round(item.score * 100);
              return `${idx + 1}. [${item.record.id}] (${item.record.scope}) ${item.record.text} [${percent}%]`;
            })
            .join("\n");
        },
      }),
      memory_delete: tool({
        description: "Delete one memory entry by id",
        args: {
          id: tool.schema.string().min(6),
          scope: tool.schema.string().optional(),
          confirm: tool.schema.boolean().default(false),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          if (!args.confirm) {
            return "Rejected: memory_delete requires confirm=true.";
          }
          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const scopes = buildScopeFilter(activeScope, state.config.includeGlobalScope);
          const deleted = await state.store.deleteById(args.id, scopes);
          return deleted ? `Deleted memory ${args.id}.` : `Memory ${args.id} not found in current scope.`;
        },
      }),
      memory_clear: tool({
        description: "Clear all memories in a scope (requires confirm=true)",
        args: {
          scope: tool.schema.string(),
          confirm: tool.schema.boolean().default(false),
        },
        execute: async (args) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          if (!args.confirm) {
            return "Rejected: destructive clear requires confirm=true.";
          }
          const count = await state.store.clearScope(args.scope);
          return `Cleared ${count} memories from scope ${args.scope}.`;
        },
      }),
      memory_stats: tool({
        description: "Show memory provider status and index health",
        args: {
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          const scope = args.scope ?? deriveProjectScope(context.worktree);
          const entries = await state.store.list(scope, 20);
          const incompatibleVectors = await state.store.countIncompatibleVectors(
            buildScopeFilter(scope, state.config.includeGlobalScope),
            await state.embedder.dim(),
          );
          const health = state.store.getIndexHealth();
          return JSON.stringify(
            {
              provider: state.config.provider,
              dbPath: state.config.dbPath,
              scope,
              recentCount: entries.length,
              incompatibleVectors,
              index: health,
              embeddingModel: state.config.embedding.model,
            },
            null,
            2,
          );
        },
      }),
      memory_port_plan: tool({
        description: "Plan non-conflicting host ports for compose services and optionally persist reservations",
        args: {
          project: tool.schema.string().min(1).optional(),
          services: tool.schema
            .array(
              tool.schema.object({
                name: tool.schema.string().min(1),
                containerPort: tool.schema.number().int().min(1).max(65535),
                preferredHostPort: tool.schema.number().int().min(1).max(65535).optional(),
              }),
            )
            .min(1),
          rangeStart: tool.schema.number().int().min(1).max(65535).default(20000),
          rangeEnd: tool.schema.number().int().min(1).max(65535).default(39999),
          persist: tool.schema.boolean().default(true),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          if (args.rangeStart > args.rangeEnd) {
            return "Invalid range: rangeStart must be <= rangeEnd.";
          }

          const project = args.project?.trim() || deriveProjectScope(context.worktree);
          const globalRecords = await state.store.list("global", 100000);
          const reservations = parsePortReservations(globalRecords);

          const assignments = await planPorts(
            {
              project,
              services: args.services,
              rangeStart: args.rangeStart,
              rangeEnd: args.rangeEnd,
              reservations,
            },
            isTcpPortAvailable,
          );

          let persisted = 0;
          const warnings: string[] = [];

          if (args.persist) {
            const keyToOldIds = new Map<string, string[]>();
            for (const reservation of reservations) {
              const key = reservationKey(reservation.project, reservation.service, reservation.protocol);
              if (!keyToOldIds.has(key)) {
                keyToOldIds.set(key, []);
              }
              keyToOldIds.get(key)?.push(reservation.id);
            }

            for (const assignment of assignments) {
              const key = reservationKey(assignment.project, assignment.service, assignment.protocol);
              const oldIds = keyToOldIds.get(key) ?? [];
              const text = `PORT_RESERVATION ${assignment.project} ${assignment.service} host=${assignment.hostPort} container=${assignment.containerPort} protocol=${assignment.protocol}`;
              try {
                const vector = await state.embedder.embed(text);
                if (vector.length === 0) {
                  warnings.push(`Skipped persistence for ${assignment.service}: empty embedding vector.`);
                  continue;
                }

                await state.store.put({
                  id: generateId(),
                  text,
                  vector,
                  category: "entity",
                  scope: "global",
                  importance: 0.8,
                  timestamp: Date.now(),
                  schemaVersion: SCHEMA_VERSION,
                  embeddingModel: state.config.embedding.model,
                  vectorDim: vector.length,
                  metadataJson: JSON.stringify({
                    source: "port-plan",
                    type: "port-reservation",
                    project: assignment.project,
                    service: assignment.service,
                    hostPort: assignment.hostPort,
                    containerPort: assignment.containerPort,
                    protocol: assignment.protocol,
                  }),
                });

                for (const id of oldIds) {
                  await state.store.deleteById(id, ["global"]);
                }
                persisted += 1;
              } catch (error) {
                warnings.push(`Failed to persist ${assignment.service}: ${toErrorMessage(error)}`);
              }
            }
          }

          return JSON.stringify(
            {
              project,
              persistRequested: args.persist,
              persisted,
              assignments,
              warnings,
            },
            null,
            2,
          );
        },
      }),
    },
  };

  return hooks;
};

async function createRuntimeState(input: Parameters<Plugin>[0]): Promise<RuntimeState> {
  const resolved = resolveMemoryConfig(undefined, input.worktree);
  const embedder = createEmbedder(resolved.embedding);
  const store = new MemoryStore(resolved.dbPath);

  const state: RuntimeState = {
    config: resolved,
    embedder,
    store,
    defaultScope: deriveProjectScope(input.worktree),
    initialized: false,
    captureBuffer: new Map(),
    ensureInitialized: async () => {
      if (state.initialized) return;
      try {
        const dim = await state.embedder.dim();
        await state.store.init(dim);
        state.initialized = true;
      } catch (error) {
        console.warn(
          `[lancedb-opencode-pro] initialization deferred: ${toErrorMessage(error)}`,
        );
      }
    },
  };

  return state;
}

async function getLastUserText(
  sessionID: string,
  client: { session: { messages: (input: { path: { id: string } }) => Promise<unknown> } },
): Promise<string> {
  try {
    const response = await client.session.messages({ path: { id: sessionID } });
    const payload = unwrapData(response);
    if (!Array.isArray(payload)) return "";

    for (let i = payload.length - 1; i >= 0; i -= 1) {
      const item = payload[i] as { info?: { role?: string }; parts?: Part[] };
      if (item.info?.role !== "user" || !Array.isArray(item.parts)) continue;
      const textParts = item.parts.filter((part): part is TextPart => part.type === "text" && typeof part.text === "string");
      const text = textParts.map((part) => part.text).join("\n").trim();
      if (text.length > 0) return text;
    }
    return "";
  } catch {
    return "";
  }
}

async function flushAutoCapture(
  sessionID: string,
  state: RuntimeState,
  client: { session: { get: (input: { path: { id: string } }) => Promise<unknown> } },
): Promise<void> {
  const fragments = state.captureBuffer.get(sessionID) ?? [];
  if (fragments.length === 0) return;
  state.captureBuffer.delete(sessionID);

  const combined = fragments.join("\n").trim();
  const candidate = extractCaptureCandidate(combined, state.config.minCaptureChars);
  if (!candidate) return;

  await state.ensureInitialized();
  if (!state.initialized) return;

  let vector: number[] = [];
  try {
    vector = await state.embedder.embed(candidate.text);
  } catch (error) {
    console.warn(`[lancedb-opencode-pro] embedding unavailable during auto-capture: ${toErrorMessage(error)}`);
    vector = [];
  }

  if (vector.length === 0) {
    console.warn("[lancedb-opencode-pro] auto-capture skipped because embedding vector is empty");
    return;
  }

  const activeScope = await resolveSessionScope(sessionID, client, state.defaultScope);

  await state.store.put({
    id: generateId(),
    text: candidate.text,
    vector,
    category: candidate.category,
    scope: activeScope,
    importance: candidate.importance,
    timestamp: Date.now(),
    schemaVersion: SCHEMA_VERSION,
    embeddingModel: state.config.embedding.model,
    vectorDim: vector.length,
    metadataJson: JSON.stringify({
      source: "auto-capture",
      sessionID,
    }),
  });

  await state.store.pruneScope(activeScope, state.config.maxEntriesPerScope);
}

async function resolveSessionScope(
  sessionID: string,
  client: { session: { get: (input: { path: { id: string } }) => Promise<unknown> } },
  fallback: string,
): Promise<string> {
  try {
    const response = await client.session.get({ path: { id: sessionID } });
    const payload = unwrapData(response) as { directory?: string } | undefined;
    if (payload?.directory && payload.directory.trim().length > 0) {
      return deriveProjectScope(payload.directory);
    }
  } catch {}
  return fallback;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unwrapData(value: unknown): unknown {
  if (value && typeof value === "object" && "data" in value) {
    return (value as { data: unknown }).data;
  }
  return value;
}

interface RuntimeState {
  config: MemoryRuntimeConfig;
  embedder: Embedder;
  store: MemoryStore;
  defaultScope: string;
  initialized: boolean;
  captureBuffer: Map<string, string[]>;
  ensureInitialized: () => Promise<void>;
}

function unavailableMessage(provider: string): string {
  return `Memory store unavailable (${provider} embedding may be offline). Will retry automatically.`;
}

function hasEmbeddingConfigChanged(current: MemoryRuntimeConfig["embedding"], next: MemoryRuntimeConfig["embedding"]): boolean {
  return (
    current.provider !== next.provider
    || current.model !== next.model
    || (current.baseUrl ?? "") !== (next.baseUrl ?? "")
    || (current.apiKey ?? "") !== (next.apiKey ?? "")
    || (current.timeoutMs ?? 0) !== (next.timeoutMs ?? 0)
  );
}

export default plugin;
export type { MemoryRuntimeConfig, MemoryRecord, SearchResult } from "./types.js";
