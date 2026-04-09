import type { Hooks, Plugin } from "@opencode-ai/plugin";
import type { Part, TextPart } from "@opencode-ai/sdk";
import { resolveMemoryConfig } from "./config.js";
import { createEmbedder } from "./embedder.js";
import type { Embedder } from "./embedder.js";
import { extractCaptureCandidate, isGlobalCandidate } from "./extract.js";
import { extractPreferenceSignals, aggregatePreferences, resolveConflicts, buildPreferenceInjection } from "./preference.js";
import { buildScopeFilter, deriveProjectScope } from "./scope.js";
import { MemoryStore } from "./store.js";
import type { CaptureOutcome, CaptureSkipReason, EpisodicTaskRecord, FailureType, LastRecallSession, MemoryRuntimeConfig, PreferenceProfile, SearchResult, SuccessPattern, TaskState, TaskType, ValidationOutcome, ValidationType } from "./types.js";
import { validateEpisodicRecordArray } from "./types.js";
import { generateId } from "./utils.js";
import { initLogger, log } from "./logger.js";
import { calculateInjectionLimit, createSummarizationConfig, summarizeContent } from "./summarize.js";
import { createMemoryTools, createFeedbackTools, createEpisodicTools, type ToolRuntimeState } from "./tools/index.js";

const PLUGIN_VERSION = "0.7.0";

const SCHEMA_VERSION = 1;

// Task-type detection keywords
const TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
  coding: ["code", "function", "class", "implement", "debug", "fix", "refactor", "api", "bug", "error", "test", "寫程式", "程式", "代碼", "函數"],
  documentation: ["doc", "document", "readme", "comment", "guide", "tutorial", "說明", "文檔", "文"],
  review: ["review", "review code", "pull request", "pr", "merge", "審查", "檢視"],
  release: ["release", "publish", "deploy", "version", "build", "npm", "publish", "發布", "版本"],
  general: [],
};

/**
 * Detect task type from user message
 */
function detectTaskType(messages: { info?: { role?: string }; parts?: Part[] }[]): TaskType {
  // Find the last user message
  let userText = "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.info?.role === "user" && msg.parts) {
      userText = msg.parts.filter((p): p is TextPart => p.type === "text").map((p) => p.text).join(" ").toLowerCase();
      break;
    }
  }

  // Score each task type
  const scores: Record<TaskType, number> = { coding: 0, documentation: 0, review: 0, release: 0, general: 0 };

  for (const [taskType, keywords] of Object.entries(TASK_TYPE_KEYWORDS) as [TaskType, string[]][]) {
    for (const keyword of keywords) {
      if (userText.includes(keyword.toLowerCase())) {
        scores[taskType] += 1;
      }
    }
  }

  // Find the task type with highest score (excluding general)
  let maxScore = 0;
  let detectedType: TaskType = "general";

  for (const [taskType, score] of Object.entries(scores) as [TaskType, number][]) {
    if (taskType !== "general" && score > maxScore) {
      maxScore = score;
      detectedType = taskType;
    }
  }

  return maxScore > 0 ? detectedType : "general";
}

/**
 * Get category weights for a specific task type
 */
function getCategoryWeights(taskType: TaskType, profiles: Record<TaskType, { categoryWeights: Record<string, number> }>): Record<string, number> {
  return profiles[taskType]?.categoryWeights ?? profiles.general.categoryWeights;
}

const plugin: Plugin = async (input) => {
  initLogger(input.client);
  log("info", `Plugin v${PLUGIN_VERSION} initialized`);

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
          state.store.consolidateDuplicates(activeScope, state.config.dedup.consolidateThreshold, state.config.dedup.candidateLimit).catch(() => {});
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

      let messages: { info?: { role?: string }; parts?: Part[] }[] = [];
      try {
        const rawMessages = await input.client.session.messages({ path: { id: eventInput.sessionID } });
        const unwrapped = (rawMessages as { data?: unknown }).data;
        if (Array.isArray(unwrapped)) {
          messages = unwrapped as { info?: { role?: string }; parts?: Part[] }[];
        }
      } catch {
        messages = [];
      }
      const taskType = detectTaskType(messages);
      const profile = state.config.injection.taskTypeProfiles[taskType] ?? state.config.injection.taskTypeProfiles.general;
      const categoryWeights = getCategoryWeights(taskType, state.config.injection.taskTypeProfiles);

      let queryVector: number[] = [];
      let embedderFailed = false;
      try {
        queryVector = await state.embedder.embed(query);
      } catch (error) {
        embedderFailed = true;
        log("warn", `embedding unavailable during recall: ${toErrorMessage(error)}`);
        queryVector = [];
      }

      const isFallback = embedderFailed || queryVector.length === 0;
      const effectiveVectorWeight = isFallback ? 0 : (state.config.retrieval.mode === "vector" ? 1 : state.config.retrieval.vectorWeight);
      const effectiveBm25Weight = isFallback ? 1 : (state.config.retrieval.mode === "vector" ? 0 : state.config.retrieval.bm25Weight);

      if (isFallback) {
        log("info", "Using BM25-only search (embedder unavailable)");
      }

      const results = await state.store.search({
        query,
        queryVector,
        scopes,
        limit: profile.maxMemories * 2,
        vectorWeight: effectiveVectorWeight,
        bm25Weight: effectiveBm25Weight,
        minScore: Math.max(state.config.retrieval.minScore, state.config.injection.injectionFloor),
        rrfK: state.config.retrieval.rrfK,
        recencyBoost: state.config.retrieval.recencyBoost,
        recencyHalfLifeHours: state.config.retrieval.recencyHalfLifeHours,
        importanceWeight: state.config.retrieval.importanceWeight,
        feedbackWeight: state.config.retrieval.feedbackWeight,
        globalDiscountFactor: state.config.globalDiscountFactor,
      });

      const weightedResults = results.map((r) => {
        const catWeight = categoryWeights[r.record.category] ?? 1.0;
        return { ...r, score: r.score * catWeight };
      }).sort((a, b) => b.score - a.score);

      state.lastRecall = {
        timestamp: Date.now(),
        query,
        results: weightedResults.map((r) => ({
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
        maxMemories: profile.maxMemories,
        tokenBudget: 300,
      });

      // Apply injection control with task-type profile
      const injectionConfig = {
        ...state.config.injection,
        maxMemories: profile.maxMemories,
        budgetTokens: profile.budgetTokens,
        summaryTargetChars: profile.summaryTargetChars,
      };
      const injectionLimit = calculateInjectionLimit(weightedResults, injectionConfig);
      const limitedResults = weightedResults.slice(0, injectionLimit);

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
        log("warn", `similar task recall failed: ${toErrorMessage(error)}`);
      }

      eventOutput.system.push(blocks.join("\n\n"));
    },
    tool: {
      ...createMemoryTools(state as ToolRuntimeState),
      ...createFeedbackTools(state as ToolRuntimeState),
      ...createEpisodicTools(state as ToolRuntimeState),
    },
  };

  return hooks;
};

async function createRuntimeState(input: Parameters<Plugin>[0]): Promise<RuntimeState> {
  const resolved = resolveMemoryConfig(undefined, input.worktree);
  const embedder = createEmbedder(resolved.embedding);
  const store = new MemoryStore(resolved.dbPath);

  if (resolved.retention) {
    store.setRetentionConfig(resolved.retention);
  }

  const state: RuntimeState = {
    config: resolved,
    embedder,
    store,
    defaultScope: deriveProjectScope(input.worktree),
    initialized: false,
    captureBuffer: new Map(),
    activeEpisodes: new Map(),
    lastRecall: null,
    consolidationInProgress: new Map(),
    ensureInitialized: async () => {
      if (state.initialized) return;
      try {
        const dim = await state.embedder.dim();
        await state.store.init(dim);
        state.initialized = true;
      } catch (error) {
        log("warn", `initialization deferred: ${toErrorMessage(error)}`);
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
    log("warn", `embedding unavailable during auto-capture: ${toErrorMessage(error)}`);
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
    log("warn", "auto-capture skipped because embedding vector is empty");
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
  consolidationInProgress: Map<string, boolean>;
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
