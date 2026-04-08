import { tool } from "@opencode-ai/plugin";
import { deriveProjectScope, buildScopeFilter } from "../scope.js";
import { generateId } from "../utils.js";
import { getEmbedderHealth, type Embedder } from "../embedder.js";
import type { MemoryStore } from "../store.js";
import type { MemoryRuntimeConfig, MemoryCategory, CitationStatus, ValidationOutcome } from "../types.js";

export interface ToolRuntimeState {
  config: MemoryRuntimeConfig;
  embedder: Embedder;
  store: MemoryStore;
  defaultScope: string;
  initialized: boolean;
  lastRecall: {
    timestamp: number;
    query: string;
    results: {
      memoryId: string;
      score: number;
      factors: {
        relevance: { overall: number; vectorScore: number; bm25Score: number };
        recency: { timestamp: number; ageHours: number; withinHalfLife: boolean; decayFactor: number };
        citation?: { source: string; status: CitationStatus };
        importance: number;
        scope: { memoryScope: string; matchesCurrentScope: boolean; isGlobal: boolean };
      };
    }[];
  } | null;
  consolidationInProgress: Map<string, boolean>;
  ensureInitialized: () => Promise<void>;
}

export type ToolContext = {
  worktree: string;
  sessionID: string;
};

function unavailableMessage(provider: string): string {
  return `Memory store unavailable (${provider} embedding may be offline). Will retry automatically.`;
}

export function createMemoryTools(state: ToolRuntimeState) {
  return {
    memory_search: tool({
      description: "Search long-term memory using hybrid retrieval",
      args: {
        query: tool.schema.string().min(1),
        limit: tool.schema.number().int().min(1).max(20).default(5),
        scope: tool.schema.string().optional(),
      },
      execute: async (args: { query: string; limit?: number; scope?: string }, context: ToolContext) => {
        await state.ensureInitialized();
        if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
        const activeScope = args.scope ?? deriveProjectScope(context.worktree);
        const scopes = buildScopeFilter(activeScope, state.config.includeGlobalScope);

        let queryVector: number[] = [];
        let embedderFailed = false;
        try {
          queryVector = await state.embedder.embed(args.query);
        } catch (error) {
          embedderFailed = true;
          queryVector = [];
        }

        const isFallback = embedderFailed || queryVector.length === 0;
        const effectiveVectorWeight = isFallback ? 0 : (state.config.retrieval.mode === "vector" ? 1 : state.config.retrieval.vectorWeight);
        const effectiveBm25Weight = isFallback ? 1 : (state.config.retrieval.mode === "vector" ? 0 : state.config.retrieval.bm25Weight);

        if (isFallback) {
          console.info(`[lancedb-opencode-pro] Using BM25-only search (embedder unavailable)`);
        }

        const results = await state.store.search({
          query: args.query,
          queryVector,
          scopes,
          limit: args.limit ?? 5,
          vectorWeight: effectiveVectorWeight,
          bm25Weight: effectiveBm25Weight,
          minScore: state.config.retrieval.minScore,
          rrfK: state.config.retrieval.rrfK,
          recencyBoost: state.config.retrieval.recencyBoost,
          recencyHalfLifeHours: state.config.retrieval.recencyHalfLifeHours,
          importanceWeight: state.config.retrieval.importanceWeight,
          feedbackWeight: state.config.retrieval.feedbackWeight,
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
              citation: r.record.citationSource ? { source: r.record.citationSource, status: r.record.citationStatus ?? "pending" } : undefined,
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
          try {
            await state.store.updateMemoryUsage(result.record.id, activeScope, scopes);
          } catch {
          }
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
      execute: async (args: { id: string; scope?: string; confirm?: boolean }, context: ToolContext) => {
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
      execute: async (args: { scope: string; confirm?: boolean }) => {
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
      execute: async (args: { scope?: string }, context: ToolContext) => {
        await state.ensureInitialized();
        if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
        const scope = args.scope ?? deriveProjectScope(context.worktree);
        const entries = await state.store.list(scope, 20);
        const incompatibleVectors = await state.store.countIncompatibleVectors(
          buildScopeFilter(scope, state.config.includeGlobalScope),
          await state.embedder.dim(),
        );
        const health = state.store.getIndexHealth();

        const embedderHealth = getEmbedderHealth();
        const searchMode = embedderHealth.fallbackActive ? "bm25-only" : state.config.retrieval.mode;

        const eventTtl = state.config.retention
          ? await state.store.getEventTtlStatus()
          : { enabled: false, retentionDays: 90, expiredCount: 0, scopeBreakdown: {} };

        return JSON.stringify(
          {
            provider: state.config.provider,
            dbPath: state.config.dbPath,
            scope,
            recentCount: entries.length,
            incompatibleVectors,
            index: health,
            embeddingModel: state.config.embedding.model,
            searchMode,
            embedderHealth,
            eventTtl,
          },
          null,
          2,
        );
      },
    }),
    memory_event_cleanup: tool({
      description: "Clean up expired effectiveness events with optional archival export",
      args: {
        scope: tool.schema.string().optional(),
        dryRun: tool.schema.boolean().optional().default(false),
        archivePath: tool.schema.string().optional(),
      },
      execute: async (args: { scope?: string; dryRun?: boolean; archivePath?: string }, context: ToolContext) => {
        await state.ensureInitialized();
        if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

        if (!state.config.retention || state.config.retention.effectivenessEventsDays <= 0) {
          return JSON.stringify(
            { error: "Event TTL is disabled. Configure retention.effectivenessEventsDays in config." },
            null,
            2,
          );
        }

        const status = await state.store.getEventTtlStatus();

        if (args.dryRun) {
          return JSON.stringify(
            {
              wouldDelete: status.expiredCount,
              scopeBreakdown: status.scopeBreakdown,
              retentionDays: status.retentionDays,
              message: "Dry run - no events deleted",
            },
            null,
            2,
          );
        }

        let archivedCount = 0;
        if (args.archivePath && status.expiredCount > 0) {
          try {
            const eventsToArchive = await state.store.getEventTtlStatus();
            const fs = await import("node:fs");
            await fs.promises.writeFile(
              args.archivePath,
              JSON.stringify(
                {
                  exportedAt: new Date().toISOString(),
                  retentionDays: status.retentionDays,
                  count: status.expiredCount,
                  scopeBreakdown: status.scopeBreakdown,
                  events: status,
                },
                null,
                2,
              ),
            );
            archivedCount = status.expiredCount;
          } catch (error) {
            return JSON.stringify(
              { error: `Archive failed: ${error instanceof Error ? error.message : String(error)}` },
              null,
              2,
            );
          }
        }

        const deletedCount = await state.store.cleanupExpiredEvents(args.scope, status.retentionDays);
        const remainingStatus = await state.store.getEventTtlStatus();

        return JSON.stringify(
          {
            deletedCount,
            archivedCount,
            remainingCount: remainingStatus.expiredCount,
            retentionDays: status.retentionDays,
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
      execute: async (args: { text: string; category?: string; scope?: string }, context: ToolContext) => {
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
          category: (args.category as MemoryCategory) ?? "other",
          scope: activeScope,
          importance: 0.7,
          timestamp: now,
          lastRecalled: 0,
          recallCount: 0,
          projectCount: 0,
          schemaVersion: 1,
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
      execute: async (args: { id: string; force?: boolean; scope?: string }, context: ToolContext) => {
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
      execute: async (args: { id: string; status?: string; scope?: string }, context: ToolContext) => {
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
          const updated = await state.store.updateCitation(args.id, scopes, { status: args.status as CitationStatus });
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
      execute: async (args: { id: string; scope?: string }, context: ToolContext) => {
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
      execute: async (args: { days?: number; scope?: string }, context: ToolContext) => {
        await state.ensureInitialized();
        if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

        const activeScope = args.scope ?? deriveProjectScope(context.worktree);
        const sinceTimestamp = Date.now() - (args.days ?? 7) * 24 * 60 * 60 * 1000;

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
    memory_why: tool({
      description: "Explain why a specific memory was recalled",
      args: {
        id: tool.schema.string().min(8),
        scope: tool.schema.string().optional(),
      },
      execute: async (args: { id: string; scope?: string }, context: ToolContext) => {
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
      execute: async (args: { scope?: string }, context: ToolContext) => {
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
    memory_scope_promote: tool({
      description: "Promote a memory from project scope to global scope for cross-project sharing",
      args: {
        id: tool.schema.string().min(8),
        confirm: tool.schema.boolean().default(false),
      },
      execute: async (args: { id: string; confirm?: boolean }, context: ToolContext) => {
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
      execute: async (args: { id: string; confirm?: boolean; scope?: string }, context: ToolContext) => {
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
      execute: async (args: { query?: string; filter?: string; limit?: number }) => {
        await state.ensureInitialized();
        if (!state.initialized) return unavailableMessage(state.config.embedding.provider);

        let records: import("../types.js").MemoryRecord[];
        if (args.filter === "unused") {
          records = await state.store.getUnusedGlobalMemories(state.config.unusedDaysThreshold, args.limit ?? 20);
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
            limit: args.limit ?? 20,
            vectorWeight: 0.7,
            bm25Weight: 0.3,
            minScore: 0.2,
            globalDiscountFactor: 1.0,
          }).then((results) => results.map((r) => r.record));
        } else {
          records = await state.store.readGlobalMemories(args.limit ?? 20);
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
      execute: async (args: { scope?: string; confirm?: boolean }, context: ToolContext) => {
        await state.ensureInitialized();
        if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
        if (!args.confirm) {
          return "Rejected: memory_consolidate requires confirm=true.";
        }
        const targetScope = args.scope ?? deriveProjectScope(context.worktree);
        if (state.consolidationInProgress.get(targetScope)) {
          return JSON.stringify({ scope: targetScope, status: "already_in_progress", message: "Consolidation already in progress for this scope" });
        }
        state.consolidationInProgress.set(targetScope, true);
        try {
          const result = await state.store.consolidateDuplicates(targetScope, state.config.dedup.consolidateThreshold, state.config.dedup.candidateLimit);
          return JSON.stringify({ scope: targetScope, ...result }, null, 2);
        } finally {
          state.consolidationInProgress.delete(targetScope);
        }
      },
    }),
    memory_consolidate_all: tool({
      description: "Consolidate duplicates across global scope and current project scope. Used by external cron jobs for daily cleanup.",
      args: {
        confirm: tool.schema.boolean().default(false),
      },
      execute: async (args: { confirm?: boolean }, context: ToolContext) => {
        await state.ensureInitialized();
        if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
        if (!args.confirm) {
          return "Rejected: memory_consolidate_all requires confirm=true.";
        }
        const projectScope = deriveProjectScope(context.worktree);
        const globalInProgress = state.consolidationInProgress.get("global");
        const projectInProgress = state.consolidationInProgress.get(projectScope);
        if (globalInProgress || projectInProgress) {
          return JSON.stringify({
            global: { scope: "global", status: globalInProgress ? "already_in_progress" : "pending" },
            project: { scope: projectScope, status: projectInProgress ? "already_in_progress" : "pending" },
            message: "Consolidation already in progress for one or more scopes",
          });
        }
        state.consolidationInProgress.set("global", true);
        state.consolidationInProgress.set(projectScope, true);
        try {
          const globalResult = await state.store.consolidateDuplicates("global", state.config.dedup.consolidateThreshold, state.config.dedup.candidateLimit);
          const projectResult = await state.store.consolidateDuplicates(projectScope, state.config.dedup.consolidateThreshold, state.config.dedup.candidateLimit);
          return JSON.stringify({
            global: { scope: "global", ...globalResult },
            project: { scope: projectScope, ...projectResult },
          }, null, 2);
        } finally {
          state.consolidationInProgress.delete("global");
          state.consolidationInProgress.delete(projectScope);
        }
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
      execute: async (args: {
        project?: string;
        services: { name: string; containerPort: number; preferredHostPort?: number }[];
        rangeStart?: number;
        rangeEnd?: number;
        persist?: boolean;
      }, context: ToolContext) => {
        await state.ensureInitialized();
        if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
        if ((args.rangeStart ?? 20000) > (args.rangeEnd ?? 39999)) {
          return "Invalid range: rangeStart must be <= rangeEnd.";
        }

        const project = args.project?.trim() || deriveProjectScope(context.worktree);
        const globalRecords = await state.store.list("global", 100000);
        
        const reservations: Array<{ id: string; project: string; service: string; protocol: string }> = [];
        for (const record of globalRecords) {
          try {
            const meta = JSON.parse(record.metadataJson || "{}");
            if (meta.type === "port-reservation") {
              reservations.push({
                id: record.id,
                project: meta.project,
                service: meta.service,
                protocol: meta.protocol,
              });
            }
          } catch {
            // skip invalid records
          }
        }

        const assignments: Array<{ project: string; service: string; containerPort: number; hostPort: number; protocol: string }> = [];
        const usedPorts = new Set<number>();
        
        for (const res of reservations) {
          try {
            const record = globalRecords.find(r => r.id === res.id);
            if (record) {
              const meta = JSON.parse(record.metadataJson || "{}");
              usedPorts.add(meta.hostPort);
            }
          } catch {
            // skip
          }
        }
        
        for (const service of args.services) {
          let hostPort = service.preferredHostPort;
          if (!hostPort || usedPorts.has(hostPort)) {
            hostPort = 0;
            for (let port = args.rangeStart ?? 20000; port <= (args.rangeEnd ?? 39999); port++) {
              if (!usedPorts.has(port)) {
                hostPort = port;
                break;
              }
            }
          }
          if (hostPort > 0) {
            usedPorts.add(hostPort);
            assignments.push({
              project,
              service: service.name,
              containerPort: service.containerPort,
              hostPort,
              protocol: "tcp",
            });
          }
        }

        let persisted = 0;
        const warnings: string[] = [];

        if (args.persist) {
          const keyToOldIds = new Map<string, string[]>();
          for (const reservation of reservations) {
            const key = `${reservation.project}:${reservation.service}:${reservation.protocol}`;
            if (!keyToOldIds.has(key)) {
              keyToOldIds.set(key, []);
            }
            keyToOldIds.get(key)?.push(reservation.id);
          }

          for (const assignment of assignments) {
            const key = `${assignment.project}:${assignment.service}:${assignment.protocol}`;
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
                schemaVersion: 1,
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
              warnings.push(`Failed to persist ${assignment.service}: ${error instanceof Error ? error.message : String(error)}`);
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
    memory_dashboard: tool({
      description: "Show weekly learning dashboard with trends and insights",
      args: {
        days: tool.schema.number().int().min(1).max(90).default(7),
        scope: tool.schema.string().optional(),
      },
      execute: async (args: { days?: number; scope?: string }, context: ToolContext) => {
        await state.ensureInitialized();
        if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
        const scope = args.scope ?? deriveProjectScope(context.worktree);
        const dashboard = await state.store.getWeeklyEffectivenessSummary(scope, state.config.includeGlobalScope, args.days ?? 7);
        return JSON.stringify(dashboard, null, 2);
      },
    }),
    memory_kpi: tool({
      description: "Show learning KPI metrics (retry-to-success rate and memory lift)",
      args: {
        days: tool.schema.number().int().min(1).max(365).default(30),
        scope: tool.schema.string().optional(),
      },
      execute: async (args: { days?: number; scope?: string }, context: ToolContext) => {
        await state.ensureInitialized();
        if (!state.initialized) return unavailableMessage(state.config.embedding.provider);
        const scope = args.scope ?? deriveProjectScope(context.worktree);
        const kpi = await state.store.getKpiSummary(scope, args.days ?? 30);
        return JSON.stringify(kpi, null, 2);
      },
    }),
  };
}
