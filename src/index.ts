import type { Hooks, Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import type { Part, TextPart } from "@opencode-ai/sdk";
import { resolveMemoryConfig } from "./config.js";
import { createEmbedder } from "./embedder.js";
import type { Embedder } from "./embedder.js";
import { extractCaptureCandidate, isGlobalCandidate } from "./extract.js";
import { extractPreferenceSignals, aggregatePreferences, resolveConflicts, buildPreferenceInjection } from "./preference.js";
import { isTcpPortAvailable, parsePortReservations, planPorts, reservationKey } from "./ports.js";
import { buildScopeFilter, deriveProjectScope } from "./scope.js";
import { MemoryStore } from "./store.js";
import type { CaptureOutcome, CaptureSkipReason, EpisodicTaskRecord, FailureType, LastRecallSession, MemoryRuntimeConfig, PreferenceProfile, SearchResult, SuccessPattern, TaskState, ValidationOutcome, ValidationType } from "./types.js";
import { validateEpisodicRecordArray } from "./types.js";
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
      const evt = event as { type: string; properties: Record<string, unknown> };
      const sessionID = evt.properties?.sessionID as string | undefined;
      if (!sessionID) return;
      if (evt.type === "session.start") {
        await handleSessionStart(sessionID, state, input);
      } else if (evt.type === "session.end") {
        const outcome = evt.properties?.outcome as string | undefined;
        await handleSessionEnd(sessionID, state, outcome ?? "unknown");
      } else if (evt.type === "session.idle" || evt.type === "session.compacted") {
        await flushAutoCapture(sessionID, state, input.client);
        if (evt.type === "session.compacted" && state.config.dedup.enabled) {
          const activeScope = deriveProjectScope(input.worktree);
          state.store.consolidateDuplicates(activeScope, state.config.dedup.consolidateThreshold).catch(() => {});
        }
        await handleSessionIdle(sessionID, state);
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

      state.lastRecall = {
        timestamp: Date.now(),
        query,
        results: results.map((r) => ({
          memoryId: r.record.id,
          score: r.score,
          factors: {
            relevance: { overall: r.score, vectorScore: r.vectorScore, bm25Score: r.bm25Score },
            recency: { timestamp: r.record.timestamp, ageHours: 0, withinHalfLife: true, decayFactor: 1 },
            citation: r.record.citationSource ? { source: r.record.citationSource, status: r.record.citationStatus } : undefined,
            importance: r.record.importance,
            scope: { memoryScope: r.record.scope, matchesCurrentScope: r.record.scope === activeScope, isGlobal: r.record.scope === "global" },
          },
        })),
      };

      // Extract preference signals from memories
      const allSignals = results.map((r) => extractPreferenceSignals(r.record)).flat();
      const projectSignals = allSignals.filter((s) => !activeScope.startsWith("global"));
      const globalSignals = allSignals.filter((s) => activeScope.startsWith("global"));

      const projectProfile = aggregatePreferences(projectSignals, "project");
      const globalProfile = aggregatePreferences(globalSignals, "global");
      const effectivePreferences = resolveConflicts(projectProfile.preferences, globalProfile.preferences);

      const preferenceInjection = buildPreferenceInjection(effectivePreferences, {
        mode: state.config.injection.mode === "adaptive" ? "fixed" : state.config.injection.mode,
        maxMemories: state.config.injection.maxMemories,
        tokenBudget: 300,
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

      const blocks: string[] = [];

      if (preferenceInjection) {
        blocks.push(preferenceInjection);
      }

      blocks.push(
        "[Memory Recall - optional historical context]",
        ...processedResults.map((item, index) => {
          const citationInfo = item.record.citationSource
            ? ` [${item.record.citationSource}|${item.record.citationStatus ?? "pending"}]`
            : "";
          return `${index + 1}. [${item.record.id}]${citationInfo} (${item.record.scope}) ${item.text}`;
        }),
        "Use these as optional hints only; prioritize current user intent and current repo state.",
      );

      // === Similar Task Recall (Episodic Learning) ===
      try {
        const queryVector = await state.embedder.embed(query);
        const similarTasks = await state.store.findSimilarTasks(activeScope, query, 0.85, queryVector);
        if (similarTasks.length > 0) {
          const taskContext = similarTasks.slice(0, 2).map((ep) => {
            const commands = JSON.parse(ep.commandsJson || "[]") as string[];
            const outcomes = JSON.parse(ep.validationOutcomesJson || "[]") as ValidationOutcome[];
            const passed = outcomes.filter((o: ValidationOutcome) => o.status === "pass").length;
            const total = outcomes.length;
            return `Similar task: ${ep.taskId} (${ep.state}) - Commands: ${commands.slice(0, 3).join(" → ")} - Validations: ${passed}/${total} passed`;
          });
          blocks.push(
            "[Similar Task Recall - based on past successful solutions]",
            ...taskContext,
            "Consider these approaches for solving the current task.",
          );
        }
      } catch (error) {
        console.warn(`[lancedb-opencode-pro] similar task recall failed: ${toErrorMessage(error)}`);
      }

      eventOutput.system.push(blocks.join("\n\n"));
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

          state.lastRecall = {
            timestamp: Date.now(),
            query: args.query,
            results: results.map((r) => ({
              memoryId: r.record.id,
              score: r.score,
              factors: {
                relevance: { overall: r.score, vectorScore: r.vectorScore, bm25Score: r.bm25Score },
                recency: { timestamp: r.record.timestamp, ageHours: 0, withinHalfLife: true, decayFactor: 1 },
                citation: r.record.citationSource ? { source: r.record.citationSource, status: r.record.citationStatus } : undefined,
                importance: r.record.importance,
                scope: { memoryScope: r.record.scope, matchesCurrentScope: r.record.scope === activeScope, isGlobal: r.record.scope === "global" },
              },
            })),
          };

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
              const meta = JSON.parse(item.record.metadataJson || "{}");
              const duplicateMarker = meta.isPotentialDuplicate ? " (duplicate)" : "";
              const citationInfo = item.record.citationSource
                ? ` [${item.record.citationSource}|${item.record.citationStatus ?? "pending"}]`
                : "";
              return `${idx + 1}. [${item.record.id}]${duplicateMarker}${citationInfo} (${item.record.scope}) ${item.record.text} [${percent}%]`;
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
      memory_kpi: tool({
        description: "Show learning KPI metrics (retry-to-success rate and memory lift)",
        args: {
          days: tool.schema.number().int().min(1).max(365).default(30),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          const scope = args.scope ?? deriveProjectScope(context.worktree);
          const kpi = await state.store.getKpiSummary(scope, args.days);
          return JSON.stringify(kpi, null, 2);
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
      memory_consolidate: tool({
        description: "Scope-internally merge near-duplicate memories. Use to clean up accumulated duplicates.",
        args: {
          scope: tool.schema.string().optional(),
          confirm: tool.schema.boolean().default(false),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          if (!args.confirm) {
            return "Rejected: memory_consolidate requires confirm=true.";
          }
          const targetScope = args.scope ?? deriveProjectScope(context.worktree);
          const result = await state.store.consolidateDuplicates(targetScope, state.config.dedup.consolidateThreshold);
          return JSON.stringify({ scope: targetScope, ...result }, null, 2);
        },
      }),
      memory_consolidate_all: tool({
        description: "Consolidate duplicates across global scope and current project scope. Used by external cron jobs for daily cleanup.",
        args: {
          confirm: tool.schema.boolean().default(false),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
          if (!args.confirm) {
            return "Rejected: memory_consolidate_all requires confirm=true.";
          }
          const projectScope = deriveProjectScope(context.worktree);
          const globalResult = await state.store.consolidateDuplicates("global", state.config.dedup.consolidateThreshold);
          const projectResult = await state.store.consolidateDuplicates(projectScope, state.config.dedup.consolidateThreshold);
          return JSON.stringify({
            global: { scope: "global", ...globalResult },
            project: { scope: projectScope, ...projectResult },
          }, null, 2);
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
      memory_remember: tool({
        description: "Explicitly store a memory with optional category label",
        args: {
          text: tool.schema.string().min(1),
          category: tool.schema.string().optional(),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          if (args.text.length < state.config.minCaptureChars) {
            return `Content too short (minimum ${state.config.minCaptureChars} characters).`;
          }

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);

          let vector: number[] = [];
          try {
            vector = await state.embedder.embed(args.text);
          } catch {
            vector = [];
          }

          if (vector.length === 0) {
            return "Failed to create embedding vector.";
          }

          const memoryId = generateId();
          const now = Date.now();
          await state.store.put({
            id: memoryId,
            text: args.text,
            vector,
            category: (args.category as import("./types.js").MemoryCategory) ?? "other",
            scope: activeScope,
            importance: 0.7,
            timestamp: now,
            lastRecalled: 0,
            recallCount: 0,
            projectCount: 0,
            schemaVersion: SCHEMA_VERSION,
            embeddingModel: state.config.embedding.model,
            vectorDim: vector.length,
            metadataJson: JSON.stringify({ source: "explicit-remember", category: args.category }),
            sourceSessionId: context.sessionID,
            citationSource: "explicit-remember",
            citationTimestamp: now,
            citationStatus: "pending",
          });

          await state.store.putEvent({
            id: generateId(),
            type: "capture",
            outcome: "stored",
            scope: activeScope,
            sessionID: context.sessionID,
            timestamp: Date.now(),
            memoryId,
            text: args.text,
            metadataJson: JSON.stringify({ source: "explicit-remember", category: args.category }),
            sourceSessionId: context.sessionID,
          });

          return `Stored memory ${memoryId} in scope ${activeScope}.`;
        },
      }),
      memory_forget: tool({
        description: "Remove or disable a memory (soft-delete by default, hard-delete with confirm)",
        args: {
          id: tool.schema.string().min(8),
          force: tool.schema.boolean().default(false),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const scopes = buildScopeFilter(activeScope, state.config.includeGlobalScope);

          if (args.force) {
            const deleted = await state.store.deleteById(args.id, scopes);
            if (!deleted) {
              return `Memory ${args.id} not found in current scope.`;
            }
            await state.store.putEvent({
              id: generateId(),
              type: "feedback",
              feedbackType: "useful",
              scope: activeScope,
              sessionID: context.sessionID,
              timestamp: Date.now(),
              memoryId: args.id,
              helpful: false,
              metadataJson: JSON.stringify({ source: "explicit-forget", hardDelete: true }),
            });
            return `Permanently deleted memory ${args.id}.`;
          }

          const softDeleted = await state.store.softDeleteMemory(args.id, scopes);
          if (!softDeleted) {
            return `Memory ${args.id} not found in current scope.`;
          }
          await state.store.putEvent({
            id: generateId(),
            type: "feedback",
            feedbackType: "useful",
            scope: activeScope,
            sessionID: context.sessionID,
            timestamp: Date.now(),
            memoryId: args.id,
            helpful: false,
            metadataJson: JSON.stringify({ source: "explicit-forget", hardDelete: false }),
          });
          return `Soft-deleted (disabled) memory ${args.id}. Use force=true for permanent deletion.`;
        },
      }),
      memory_citation: tool({
        description: "View or update citation information for a memory",
        args: {
          id: tool.schema.string().min(8),
          status: tool.schema.string().optional(),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const scopes = buildScopeFilter(activeScope, state.config.includeGlobalScope);

          const citation = await state.store.getCitation(args.id, scopes);
          if (!citation) {
            return `Memory ${args.id} not found or has no citation information.`;
          }

          if (args.status) {
            const validStatuses = ["verified", "pending", "invalid", "expired"];
            if (!validStatuses.includes(args.status)) {
              return `Invalid status. Must be one of: ${validStatuses.join(", ")}`;
            }
            const updated = await state.store.updateCitation(args.id, scopes, { status: args.status as import("./types.js").CitationStatus });
            if (!updated) {
              return `Failed to update citation for ${args.id}.`;
            }
            return `Updated citation status for ${args.id} to ${args.status}.`;
          }

          return JSON.stringify({
            memoryId: args.id,
            source: citation.source,
            timestamp: new Date(citation.timestamp).toISOString(),
            status: citation.status,
            chain: citation.chain,
          }, null, 2);
        },
      }),
      memory_validate_citation: tool({
        description: "Validate a citation for a memory and update its status",
        args: {
          id: tool.schema.string().min(8),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const scopes = buildScopeFilter(activeScope, state.config.includeGlobalScope);

          const result = await state.store.validateCitation(args.id, scopes);
          return JSON.stringify({
            memoryId: args.id,
            valid: result.valid,
            status: result.status,
            reason: result.reason,
          }, null, 2);
        },
      }),
      memory_what_did_you_learn: tool({
        description: "Show recent learning summary with memory counts by category",
        args: {
          days: tool.schema.number().int().min(1).max(90).default(7),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const sinceTimestamp = Date.now() - args.days * 24 * 60 * 60 * 1000;

          const memories = await state.store.listSince(activeScope, sinceTimestamp, 1000);

          if (memories.length === 0) {
            return `No memories captured in the past ${args.days} days in scope ${activeScope}.`;
          }

          const categoryCounts: Record<string, number> = {};
          for (const mem of memories) {
            categoryCounts[mem.category] = (categoryCounts[mem.category] ?? 0) + 1;
          }

          const total = memories.length;
          const categoryBreakdown = Object.entries(categoryCounts)
            .map(([cat, count]) => `  - ${cat}: ${count}`)
            .join("\n");

          const recentSamples = memories.slice(0, 5).map((mem, idx) => {
            const date = new Date(mem.timestamp).toISOString().split("T")[0];
            return `  ${idx + 1}. [${date}] ${mem.text.slice(0, 60)}...`;
          }).join("\n");

          return `## Learning Summary (${args.days} days)

**Scope:** ${activeScope}
**Total memories:** ${total}

### By Category
${categoryBreakdown}

### Recent Captures
${recentSamples}
`;
        },
      }),
      // === Episodic Learning Tools ===
      task_episode_create: tool({
        description: "Create a new task episode record for tracking",
        args: {
          taskId: tool.schema.string().min(1),
          scope: tool.schema.string().optional(),
          description: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const episode: EpisodicTaskRecord = {
            id: generateId(),
            sessionId: context.sessionID,
            scope: activeScope,
            taskId: args.taskId,
            state: "pending",
            startTime: Date.now(),
            endTime: 0,
            commandsJson: "[]",
            validationOutcomesJson: "[]",
            successPatternsJson: "[]",
            retryAttemptsJson: "[]",
            recoveryStrategiesJson: "[]",
            metadataJson: JSON.stringify({ description: args.description }),
          };

          await state.store.createTaskEpisode(episode);
          return `Created task episode ${episode.id} for task ${args.taskId} in scope ${activeScope}`;
        },
      }),
      task_episode_query: tool({
        description: "Query task episodes by scope and state",
        args: {
          scope: tool.schema.string().optional(),
          state: tool.schema.string().optional(),
          limit: tool.schema.number().int().min(1).max(100).default(10),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const stateFilter = args.state as TaskState | undefined;
          const episodes = await state.store.queryTaskEpisodes(activeScope, stateFilter);

          if (episodes.length === 0) {
            return `No task episodes found in scope ${activeScope}`;
          }

          const limited = episodes.slice(0, args.limit);
          return limited.map((ep) => {
            const meta = (JSON.parse(ep.metadataJson || "{}")) as Record<string, unknown>;
            return `[${ep.id}] ${ep.taskId} - ${ep.state} (${new Date(ep.startTime).toISOString().split("T")[0]}) ${meta.description ? `- ${meta.description}` : ""}`;
          }).join("\n");
        },
      }),
      similar_task_recall: tool({
        description: "Find similar past tasks using semantic search",
        args: {
          query: tool.schema.string().min(1),
          threshold: tool.schema.number().min(0).max(1).default(0.85),
          limit: tool.schema.number().int().min(1).max(10).default(3),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          let queryVector: number[] = [];
          try {
            queryVector = await state.embedder.embed(args.query);
          } catch {
            queryVector = [];
          }
          const similar = await state.store.findSimilarTasks(activeScope, args.query, args.threshold, queryVector);

          if (similar.length === 0) {
            return `No similar tasks found for "${args.query}"`;
          }

          const limited = similar.slice(0, args.limit);
          return limited.map((ep) => {
            const commands = JSON.parse(ep.commandsJson || "[]") as string[];
            const outcomes = JSON.parse(ep.validationOutcomesJson || "[]") as ValidationOutcome[];
            return `Task: ${ep.taskId} (${ep.state})
  Commands: ${commands.slice(0, 3).join(" → ")}
  Validations: ${outcomes.map((o: ValidationOutcome) => `${o.type}:${o.status}`).join(", ") || "none"}
`;
          }).join("\n");
        },
      }),
      retry_budget_suggest: tool({
        description: "Get retry budget suggestion based on historical data",
        args: {
          errorType: tool.schema.string(),
          minSamples: tool.schema.number().int().min(1).default(3),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const result = await state.store.suggestRetryBudget(activeScope, args.minSamples);

          if (!result) {
            return `Insufficient data for retry budget suggestion (need at least ${args.minSamples} failed tasks)`;
          }

          return JSON.stringify({
            suggestedRetries: result.suggestedRetries,
            confidence: result.confidence.toFixed(2),
            basedOnCount: result.basedOnCount,
            shouldStop: result.shouldStop,
            stopReason: result.stopReason,
          }, null, 2);
        },
      }),
      recovery_strategy_suggest: tool({
        description: "Get recovery strategy suggestions after failures",
        args: {
          taskId: tool.schema.string().min(1),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const strategies = await state.store.suggestRecoveryStrategies(activeScope, args.taskId);

          if (strategies.length === 0) {
            return `No recovery strategies found for task ${args.taskId}`;
          }

          return strategies.map((s) => {
            return `- ${s.strategy}: ${s.reason} (confidence: ${s.confidence.toFixed(2)}${s.basedOnTask ? `, based on: ${s.basedOnTask}` : ""})`;
          }).join("\n");
        },
      }),
      memory_why: tool({
        description: "Explain why a specific memory was recalled",
        args: {
          id: tool.schema.string().min(8),
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const scopes = buildScopeFilter(activeScope, state.config.includeGlobalScope);

          const explanation = await state.store.explainMemory(
            args.id,
            scopes,
            activeScope,
            state.config.retrieval.recencyHalfLifeHours,
            state.config.globalDiscountFactor,
          );

          if (!explanation) {
            return `Memory ${args.id} not found in current scope.`;
          }

          const f = explanation.factors;
          const recencyText = f.recency.withinHalfLife
            ? `within ${f.recency.ageHours.toFixed(1)}h half-life`
            : `beyond half-life (${f.recency.ageHours.toFixed(1)}h old)`;
          const citationText = f.citation
            ? `${f.citation.source ?? "unknown"}/${f.citation.status ?? "n/a"}`
            : "N/A";
          const scopeText = f.scope.matchesCurrentScope
            ? "matches current project"
            : f.scope.isGlobal
              ? "from global scope"
              : "different project scope";

          return `Memory: "${explanation.text.slice(0, 80)}..."
Explanation:
- Recency: ${recencyText} (decay: ${(f.recency.decayFactor * 100).toFixed(0)}%)
- Citation: ${citationText}
- Importance: ${f.importance.toFixed(2)}
- Scope: ${scopeText}`;
        },
      }),
      memory_explain_recall: tool({
        description: "Explain the factors behind the last recall operation in this session",
        args: {
          scope: tool.schema.string().optional(),
        },
        execute: async (args, context) => {
          await state.ensureInitialized();
          if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

          const lastRecall = state.lastRecall;
          if (!lastRecall) {
            return "No recent recall to explain. Use memory_search or wait for auto-recall first.";
          }

          const activeScope = args.scope ?? deriveProjectScope(context.worktree);
          const scopes = buildScopeFilter(activeScope, state.config.includeGlobalScope);

          const explanations: string[] = [];
          for (const result of lastRecall.results) {
            const explanation = await state.store.explainMemory(
              result.memoryId,
              scopes,
              activeScope,
              state.config.retrieval.recencyHalfLifeHours,
              state.config.globalDiscountFactor,
            );
            if (!explanation) continue;

            const f = explanation.factors;
            const recencyText = f.recency.withinHalfLife
              ? "recent"
              : "older";
            explanations.push(
              `${result.memoryId.slice(0, 8)}: ${(result.score * 100).toFixed(0)}% relevance, ${recencyText}, ${f.citation?.status ?? "no citation"}`,
            );
          }

          return `## Last Recall Explanation
Query: "${lastRecall.query}"
Results: ${lastRecall.results.length}

${explanations.join("\n")}`;
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
    activeEpisodes: new Map(),
    lastRecall: null,
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

  let isPotentialDuplicate = false;
  let duplicateOf: string | null = null;

  if (state.config.dedup.enabled) {
    const similar = await state.store.search({
      query: result.candidate.text,
      queryVector: vector,
      scopes: [activeScope],
      limit: 1,
      vectorWeight: 1.0,
      bm25Weight: 0.0,
      minScore: 0.0,
      rrfK: 60,
      recencyBoost: false,
      globalDiscountFactor: 1.0,
    });
    if (similar.length > 0 && similar[0].score >= state.config.dedup.writeThreshold) {
      isPotentialDuplicate = true;
      duplicateOf = similar[0].record.id;
    }
  }

  const memoryId = generateId();
  const now = Date.now();

  await state.store.put({
    id: memoryId,
    text: result.candidate.text,
    vector,
    category: result.candidate.category,
    scope: activeScope,
    importance: result.candidate.importance,
    timestamp: now,
    lastRecalled: 0,
    recallCount: 0,
    projectCount: 0,
    schemaVersion: SCHEMA_VERSION,
    embeddingModel: state.config.embedding.model,
    vectorDim: vector.length,
    metadataJson: JSON.stringify({
      source: "auto-capture",
      sessionID,
      isPotentialDuplicate,
      duplicateOf,
    }),
    citationSource: "auto-capture",
    citationTimestamp: now,
    citationStatus: "pending",
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
  activeEpisodes: Map<string, string>;
  lastRecall: LastRecallSession | null;
  ensureInitialized: () => Promise<void>;
}

async function handleSessionStart(
  sessionID: string,
  state: RuntimeState,
  input: Parameters<Plugin>[0],
): Promise<void> {
  await state.ensureInitialized();
  if (!state.initialized) return;
  const activeScope = deriveProjectScope(input.worktree);
  const taskId = `session-${sessionID.slice(0, 8)}`;
  const episode: EpisodicTaskRecord = {
    id: generateId(),
    sessionId: sessionID,
    scope: activeScope,
    taskId,
    state: "running",
    startTime: Date.now(),
    commandsJson: "[]",
    validationOutcomesJson: "[]",
    successPatternsJson: "[]",
    retryAttemptsJson: "[]",
    recoveryStrategiesJson: "[]",
    metadataJson: "{}",
  };
  await state.store.createTaskEpisode(episode);
  state.activeEpisodes.set(sessionID, taskId);
}

async function handleSessionEnd(
  sessionID: string,
  state: RuntimeState,
  outcome: string,
): Promise<void> {
  await state.ensureInitialized();
  if (!state.initialized) return;
  const taskId = state.activeEpisodes.get(sessionID);
  if (!taskId) return;
  const activeScope = state.defaultScope;
  const finalState: TaskState = outcome === "success" ? "success" : "failed";
  await state.store.updateTaskState(taskId, finalState, activeScope);
  state.activeEpisodes.delete(sessionID);
}

async function handleSessionIdle(
  sessionID: string,
  state: RuntimeState,
): Promise<void> {
  await state.ensureInitialized();
  if (!state.initialized) return;
  const taskId = state.activeEpisodes.get(sessionID);
  if (!taskId) return;
  const activeScope = state.defaultScope;
  const patterns = await state.store.extractSuccessPatternsFromScope(activeScope);
  if (patterns.length > 0) {
    const episode = await state.store.getTaskEpisode(taskId, activeScope);
    if (episode) {
      await state.store.updateTaskState(taskId, episode.state, activeScope);
    }
  }
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
