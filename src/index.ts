import type { Hooks, Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import type { Part, TextPart } from "@opencode-ai/sdk";
import { resolveMemoryConfig } from "./config.js";
import { createEmbedder } from "./embedder.js";
import type { Embedder } from "./embedder.js";
import { extractCaptureCandidate, isGlobalCandidate } from "./extract.js";
import { isTcpPortAvailable, parsePortReservations, planPorts, reservationKey } from "./ports.js";
import { buildScopeFilter, deriveProjectScope } from "./scope.js";
import { MemoryStore } from "./store.js";
import type { CaptureOutcome, CaptureSkipReason, MemoryRuntimeConfig, SearchResult } from "./types.js";
import { generateId } from "./utils.js";
import { calculateInjectionLimit, createSummarizationConfig, summarizeContent } from "./summarize.js";

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
        limit: state.config.injection.maxMemories * 2, // Fetch more than needed for filtering
        vectorWeight: state.config.retrieval.mode === "vector" ? 1 : state.config.retrieval.vectorWeight,
        bm25Weight: state.config.retrieval.mode === "vector" ? 0 : state.config.retrieval.bm25Weight,
        minScore: Math.max(state.config.retrieval.minScore, state.config.injection.injectionFloor),
        rrfK: state.config.retrieval.rrfK,
        recencyBoost: state.config.retrieval.recencyBoost,
        recencyHalfLifeHours: state.config.retrieval.recencyHalfLifeHours,
        importanceWeight: state.config.retrieval.importanceWeight,
        globalDiscountFactor: state.config.globalDiscountFactor,
      });

      // Apply injection control
      const injectionLimit = calculateInjectionLimit(results, state.config.injection);
      const limitedResults = results.slice(0, injectionLimit);

      await state.store.putEvent({
        id: generateId(),
        type: "recall",
        source: "system-transform",
        scope: activeScope,
        sessionID: eventInput.sessionID,
        timestamp: Date.now(),
        resultCount: limitedResults.length,
        injected: limitedResults.length > 0,
        metadataJson: JSON.stringify({
          source: "system-transform",
          includeGlobalScope: state.config.includeGlobalScope,
          injectionMode: state.config.injection.mode,
          injectionLimit: injectionLimit,
        }),
      });

      if (limitedResults.length === 0) return;

      for (const result of limitedResults) {
        state.store.updateMemoryUsage(result.record.id, activeScope, scopes).catch(() => {});
      }

      // Apply summarization if configured
      const summarizationConfig = createSummarizationConfig(state.config.injection);
      const processedResults = limitedResults.map((item) => {
        if (state.config.injection.summarization === "none") {
          return { ...item, text: item.record.text };
        }
        const summarized = summarizeContent(item.record.text, summarizationConfig);
        return { ...item, text: summarized.content };
      });

      const memoryBlock = [
        "[Memory Recall - optional historical context]",
        ...processedResults.map((item, index) => `${index + 1}. [${item.record.id}] (${item.record.scope}) ${item.text}`),
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
            rrfK: state.config.retrieval.rrfK,
            recencyBoost: state.config.retrieval.recencyBoost,
            recencyHalfLifeHours: state.config.retrieval.recencyHalfLifeHours,
            importanceWeight: state.config.retrieval.importanceWeight,
            globalDiscountFactor: state.config.globalDiscountFactor,
          });

          await state.store.putEvent({
            id: generateId(),
            type: "recall",
            source: "manual-search",
            scope: activeScope,
            sessionID: context.sessionID,
            timestamp: Date.now(),
            resultCount: results.length,
            injected: false,
            metadataJson: JSON.stringify({ source: "manual-search" }),
          });

          if (results.length === 0) return "No relevant memory found.";

          for (const result of results) {
            state.store.updateMemoryUsage(result.record.id, activeScope, scopes).catch(() => {});
          }

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
          id: tool.schema.string().min(8),
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
      memory_feedback_missing: tool({
        description: "Record feedback for memory that should have been stored",
        args: {
          text: tool.schema.string().min(1),
          labels: tool.schema.array(tool.schema.string().min(1)).default([]),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          const scope = args.scope ?? deriveProjectScope(context.worktree);
          await state.store.putEvent({
            id: generateId(),
            type: "feedback",
            feedbackType: "missing",
            scope,
            sessionID: context.sessionID,
            timestamp: Date.now(),
            text: args.text,
            labels: args.labels,
            metadataJson: JSON.stringify({ source: "memory_feedback_missing" }),
          });
          return "Recorded missing-memory feedback.";
        },
      }),
      memory_feedback_wrong: tool({
        description: "Record feedback for memory that should not be stored",
        args: {
          id: tool.schema.string().min(8),
          reason: tool.schema.string().optional(),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          const scope = args.scope ?? deriveProjectScope(context.worktree);
          const scopes = buildScopeFilter(scope, state.config.includeGlobalScope);
          const exists = await state.store.hasMemory(args.id, scopes);
          if (!exists) {
            return `Memory ${args.id} not found in current scope.`;
          }
          await state.store.putEvent({
            id: generateId(),
            type: "feedback",
            feedbackType: "wrong",
            scope,
            sessionID: context.sessionID,
            timestamp: Date.now(),
            memoryId: args.id,
            reason: args.reason,
            metadataJson: JSON.stringify({ source: "memory_feedback_wrong" }),
          });
          return `Recorded wrong-memory feedback for ${args.id}.`;
        },
      }),
      memory_feedback_useful: tool({
        description: "Record whether a recalled memory was helpful",
        args: {
          id: tool.schema.string().min(8),
          helpful: tool.schema.boolean(),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          const scope = args.scope ?? deriveProjectScope(context.worktree);
          const scopes = buildScopeFilter(scope, state.config.includeGlobalScope);
          const exists = await state.store.hasMemory(args.id, scopes);
          if (!exists) {
            return `Memory ${args.id} not found in current scope.`;
          }
          await state.store.putEvent({
            id: generateId(),
            type: "feedback",
            feedbackType: "useful",
            scope,
            sessionID: context.sessionID,
            timestamp: Date.now(),
            memoryId: args.id,
            helpful: args.helpful,
            metadataJson: JSON.stringify({ source: "memory_feedback_useful" }),
          });
          return `Recorded recall usefulness feedback for ${args.id}.`;
        },
      }),
      memory_effectiveness: tool({
        description: "Show effectiveness metrics for capture recall and feedback",
        args: {
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          const scope = args.scope ?? deriveProjectScope(context.worktree);
          const summary = await state.store.summarizeEvents(scope, state.config.includeGlobalScope);
          return JSON.stringify(summary, null, 2);
        },
      }),
      memory_scope_promote: tool({
        description: "Promote a memory from project scope to global scope for cross-project sharing",
        args: {
          id: tool.schema.string().min(8),
          confirm: tool.schema.boolean().default(false),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          if (!args.confirm) {
            return "Rejected: memory_scope_promote requires confirm=true.";
          }
          const activeScope = deriveProjectScope(context.worktree);
          const scopes = buildScopeFilter(activeScope, state.config.includeGlobalScope);
          const exists = await state.store.hasMemory(args.id, scopes);
          if (!exists) {
            return `Memory ${args.id} not found in current scope.`;
          }
          const updated = await state.store.updateMemoryScope(args.id, "global", scopes);
          if (!updated) {
            return `Failed to promote memory ${args.id}.`;
          }
          return `Promoted memory ${args.id} to global scope.`;
        },
      }),
      memory_scope_demote: tool({
        description: "Demote a memory from global scope to project scope",
        args: {
          id: tool.schema.string().min(8),
          confirm: tool.schema.boolean().default(false),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          if (!args.confirm) {
            return "Rejected: memory_scope_demote requires confirm=true.";
          }
          const projectScope = args.scope ?? deriveProjectScope(context.worktree);
          const globalExists = await state.store.hasMemory(args.id, ["global"]);
          if (!globalExists) {
            return `Memory ${args.id} not found in global scope or is not a global memory.`;
          }
          const updated = await state.store.updateMemoryScope(args.id, projectScope, ["global"]);
          if (!updated) {
            return `Failed to demote memory ${args.id}.`;
          }
          return `Demoted memory ${args.id} from global to ${projectScope}.`;
        },
      }),
      memory_global_list: tool({
        description: "List all global-scoped memories, optionally filtered by search query or unused status",
        args: {
          query: tool.schema.string().optional(),
          filter: tool.schema.string().optional(),
          limit: tool.schema.number().int().min(1).max(100).default(20),
        },
        execute: async (args) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          let records: import("./types.js").MemoryRecord[];
          if (args.filter === "unused") {
            records = await state.store.getUnusedGlobalMemories(state.config.unusedDaysThreshold, args.limit);
          } else if (args.query) {
            let queryVector: number[] = [];
            try {
              queryVector = await state.embedder.embed(args.query);
            } catch {
              queryVector = [];
            }
            records = await state.store.search({
              query: args.query,
              queryVector,
              scopes: ["global"],
              limit: args.limit,
              vectorWeight: 0.7,
              bm25Weight: 0.3,
              minScore: 0.2,
              globalDiscountFactor: 1.0,
            }).then((results) => results.map((r) => r.record));
          } else {
            records = await state.store.readGlobalMemories(args.limit);
          }

          if (records.length === 0) {
            return "No global memories found.";
          }

          return records
            .map((record, idx) => {
              const date = new Date(record.timestamp).toISOString().split("T")[0];
              const lastRecalled = record.lastRecalled > 0
                ? new Date(record.lastRecalled).toISOString().split("T")[0]
                : "never";
              return `${idx + 1}. [${record.id}] ${record.text.slice(0, 80)}...
  Stored: ${date} | Recalled: ${lastRecalled} | Count: ${record.recallCount} | Projects: ${record.projectCount}`;
            })
            .join("\n");
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
                  lastRecalled: 0,
                  recallCount: 0,
                  projectCount: 0,
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
  if (fragments.length === 0) {
    await recordCaptureEvent(state, {
      sessionID,
      scope: state.defaultScope,
      outcome: "skipped",
      skipReason: "empty-buffer",
      text: "",
    });
    return;
  }
  state.captureBuffer.delete(sessionID);

  const combined = fragments.join("\n").trim();
  const activeScope = await resolveSessionScope(sessionID, client, state.defaultScope);
  await state.ensureInitialized();
  if (!state.initialized) {
    return;
  }
  await recordCaptureEvent(state, {
    sessionID,
    scope: activeScope,
    outcome: "considered",
    text: combined,
  });

  const result = extractCaptureCandidate(combined, state.config.minCaptureChars);
  if (!result.candidate) {
    await recordCaptureEvent(state, {
      sessionID,
      scope: activeScope,
      outcome: "skipped",
      skipReason: result.skipReason,
      text: combined,
    });
    return;
  }

  let vector: number[] = [];
  try {
    vector = await state.embedder.embed(result.candidate.text);
  } catch (error) {
    console.warn(`[lancedb-opencode-pro] embedding unavailable during auto-capture: ${toErrorMessage(error)}`);
    await recordCaptureEvent(state, {
      sessionID,
      scope: activeScope,
      outcome: "skipped",
      skipReason: "embedding-unavailable",
      text: combined,
    });
    vector = [];
  }

  if (vector.length === 0) {
    console.warn("[lancedb-opencode-pro] auto-capture skipped because embedding vector is empty");
    await recordCaptureEvent(state, {
      sessionID,
      scope: activeScope,
      outcome: "skipped",
      skipReason: "empty-embedding",
      text: combined,
    });
    return;
  }

  const memoryId = generateId();

  await state.store.put({
    id: memoryId,
    text: result.candidate.text,
    vector,
    category: result.candidate.category,
    scope: activeScope,
    importance: result.candidate.importance,
    timestamp: Date.now(),
    lastRecalled: 0,
    recallCount: 0,
    projectCount: 0,
    schemaVersion: SCHEMA_VERSION,
    embeddingModel: state.config.embedding.model,
    vectorDim: vector.length,
    metadataJson: JSON.stringify({
      source: "auto-capture",
      sessionID,
    }),
  });

  await recordCaptureEvent(state, {
    sessionID,
    scope: activeScope,
    outcome: "stored",
    memoryId,
    text: result.candidate.text,
  });

  await state.store.pruneScope(activeScope, state.config.maxEntriesPerScope);
}

async function recordCaptureEvent(
  state: RuntimeState,
  input: {
    sessionID: string;
    scope: string;
    outcome: CaptureOutcome;
    skipReason?: CaptureSkipReason;
    memoryId?: string;
    text: string;
  },
): Promise<void> {
  if (!state.initialized) return;
  await state.store.putEvent({
    id: generateId(),
    type: "capture",
    scope: input.scope,
    sessionID: input.sessionID,
    timestamp: Date.now(),
    outcome: input.outcome,
    skipReason: input.skipReason,
    memoryId: input.memoryId,
    text: input.text,
    metadataJson: JSON.stringify({ source: "auto-capture" }),
  });
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
export type {
  EffectivenessSummary,
  FeedbackEvent,
  MemoryEffectivenessEvent,
  MemoryRecord,
  MemoryRuntimeConfig,
  RecallEvent,
  SearchResult,
} from "./types.js";
