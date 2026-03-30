import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { CaptureSkipReason, CitationSource, CitationStatus, EffectivenessSummary, EpisodicTaskRecord, LastRecallSession, MemoryEffectivenessEvent, MemoryExplanation, MemoryRecord, RecallFactors, RecallSource, SearchResult, SuccessPattern, TaskState, ValidationOutcome } from "./types.js";
import { generateId } from "./utils.js";
import { cosineSimilarity, tokenize } from "./utils.js";

type LanceModule = typeof import("@lancedb/lancedb");

type LanceConnection = {
  openTable(name: string): Promise<LanceTable>;
  createTable(name: string, rows: unknown[]): Promise<LanceTable>;
};

type LanceTable = {
  add(rows: unknown[]): Promise<void>;
  addColumns(transforms: Array<{ name: string; valueSql: string }>): Promise<unknown>;
  delete(filter: string): Promise<void>;
  schema(): Promise<{ fields: Array<{ name: string }> }>;
  query(): {
    where(expr: string): ReturnType<LanceTable["query"]>;
    select(columns: string[]): ReturnType<LanceTable["query"]>;
    limit(n: number): ReturnType<LanceTable["query"]>;
    toArray(): Promise<Array<Record<string, unknown>>>;
  };
  createIndex(column: string, options?: Record<string, unknown>): Promise<void>;
};

const TABLE_NAME = "memories";
const EVENTS_TABLE_NAME = "effectiveness_events";
const EVENTS_SOURCE_COLUMN = "source";

interface ScopeCache {
  records: MemoryRecord[];
  tokenized: string[][];
  idf: Map<string, number>;
  norms: Map<string, number>;
}

// Exported for use by consolidateDuplicates
export function storeFastCosine(a: number[], b: number[], normA: number, normB: number): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  const denom = normA * normB;
  if (denom === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot / denom;
}

export class MemoryStore {
  private lancedb: LanceModule | null = null;
  private connection: LanceConnection | null = null;
  private table: LanceTable | null = null;
  private eventTable: LanceTable | null = null;
  private episodicTaskTable: LanceTable | null = null;
  private indexState = {
    vector: false,
    fts: false,
    ftsError: "",
  };
  private scopeCache = new Map<string, ScopeCache>();

  constructor(private readonly dbPath: string) {}

  async init(vectorDim: number): Promise<void> {
    await mkdir(this.dbPath, { recursive: true });
    await mkdir(dirname(this.dbPath), { recursive: true });

    this.lancedb = await import("@lancedb/lancedb");
    this.connection = (await this.lancedb.connect(this.dbPath)) as unknown as LanceConnection;

    try {
      this.table = await this.connection.openTable(TABLE_NAME);
    } catch {
      const bootstrap: MemoryRecord = {
        id: "__bootstrap__",
        text: "",
        vector: new Array<number>(vectorDim).fill(0),
        category: "other",
        scope: "global",
        importance: 0,
        timestamp: 0,
        lastRecalled: 0,
        recallCount: 0,
        projectCount: 0,
        schemaVersion: 2,
        embeddingModel: "bootstrap",
        vectorDim,
        metadataJson: "{}",
        userId: undefined,
        teamId: undefined,
        sourceSessionId: undefined,
        confidence: undefined,
        tags: undefined,
        status: "active",
        parentId: undefined,
        citationSource: undefined,
        citationTimestamp: undefined,
        citationStatus: undefined,
        citationChain: undefined,
      };
      this.table = await this.connection.createTable(TABLE_NAME, [bootstrap]);
      await this.table.delete("id = '__bootstrap__'");
    }

    try {
      this.eventTable = await this.connection.openTable(EVENTS_TABLE_NAME);
    } catch {
      const bootstrapEvent = {
        id: "__bootstrap__",
        type: "capture",
        scope: "global",
        sessionID: "",
        timestamp: 0,
        memoryId: "",
        text: "",
        outcome: "considered",
        skipReason: "",
        resultCount: 0,
        injected: false,
        source: "",
        feedbackType: "",
        helpful: -1,
        reason: "",
        labelsJson: "[]",
        metadataJson: "{}",
      };
      this.eventTable = await this.connection.createTable(EVENTS_TABLE_NAME, [bootstrapEvent]);
      await this.eventTable.delete("id = '__bootstrap__'");
    }

    await this.ensureMemoriesTableCompatibility();
    await this.ensureEventTableCompatibility();

    await this.ensureIndexes();
  }

  async put(record: MemoryRecord): Promise<void> {
    const table = this.requireTable();
    const recordWithDefaults: MemoryRecord = {
      ...record,
      userId: record.userId ?? undefined,
      teamId: record.teamId ?? undefined,
      sourceSessionId: record.sourceSessionId ?? undefined,
      confidence: record.confidence ?? undefined,
      tags: record.tags ?? undefined,
      status: record.status ?? "active",
      parentId: record.parentId ?? undefined,
    };
    await table.add([recordWithDefaults]);
    this.invalidateScope(record.scope);
  }

  async putEvent(event: MemoryEffectivenessEvent): Promise<void> {
    const feedbackEvent = event.type === "feedback" ? event : null;
    const captureEvent = event.type === "capture" ? event : null;
    await this.requireEventTable().add([
      {
        id: event.id,
        type: event.type,
        scope: event.scope,
        sessionID: event.sessionID ?? "",
        timestamp: event.timestamp,
        memoryId: event.memoryId ?? "",
        text: event.text ?? "",
        outcome: event.type === "capture" ? event.outcome : "",
        skipReason: event.type === "capture" ? event.skipReason ?? "" : "",
        resultCount: event.type === "recall" ? event.resultCount : 0,
        injected: event.type === "recall" ? event.injected : false,
        source: event.type === "recall" ? event.source ?? "" : "",
        feedbackType: event.type === "feedback" ? event.feedbackType : "",
        helpful: event.type === "feedback" ? (event.helpful === undefined ? -1 : event.helpful ? 1 : 0) : -1,
        reason: event.type === "feedback" ? event.reason ?? "" : "",
        labelsJson: event.type === "feedback" ? JSON.stringify(event.labels ?? []) : "[]",
        metadataJson: event.metadataJson,
        sourceSessionId: feedbackEvent?.sourceSessionId ?? captureEvent?.sourceSessionId ?? "",
        confidenceDelta: feedbackEvent?.confidenceDelta ?? null,
        relatedMemoryId: feedbackEvent?.relatedMemoryId ?? "",
        context: feedbackEvent?.context ? JSON.stringify(feedbackEvent.context) : null,
      },
    ]);
  }

  async search(params: {
    query: string;
    queryVector: number[];
    scopes: string[];
    limit: number;
    vectorWeight: number;
    bm25Weight: number;
    minScore: number;
    rrfK?: number;
    recencyBoost?: boolean;
    recencyHalfLifeHours?: number;
    importanceWeight?: number;
    globalDiscountFactor?: number;
  }): Promise<SearchResult[]> {
    const cached = await this.getCachedScopes(params.scopes);
    if (cached.records.length === 0) return [];

    const queryTokens = tokenize(params.query);
    const queryNorm = vecNorm(params.queryVector);
    const useVectorChannel = params.queryVector.length > 0 && params.vectorWeight > 0;
    const useBm25Channel = queryTokens.length > 0 && params.bm25Weight > 0;
    const { vectorWeight, bm25Weight } = normalizeChannelWeights(
      useVectorChannel ? params.vectorWeight : 0,
      useBm25Channel ? params.bm25Weight : 0,
    );
    const rrfK = Math.max(1, Math.floor(params.rrfK ?? 60));
    const recencyBoostEnabled = params.recencyBoost ?? true;
    const recencyHalfLifeHours = Math.max(1, params.recencyHalfLifeHours ?? 72);
    const importanceWeight = clampImportanceWeight(params.importanceWeight ?? 0.4);
    const globalDiscountFactor = params.globalDiscountFactor ?? 1.0;

    const candidates = cached.records
      .filter((record) => params.queryVector.length === 0 || record.vector.length === params.queryVector.length)
      .map((record, index) => {
        const recordNorm = cached.norms.get(record.id) ?? vecNorm(record.vector);
        const vectorScore = useVectorChannel ? fastCosine(params.queryVector, record.vector, queryNorm, recordNorm) : 0;
        const bm25Score = useBm25Channel ? bm25LikeScore(queryTokens, cached.tokenized[index], cached.idf) : 0;
        const isGlobal = record.scope === "global";
        return { record, vectorScore, bm25Score, isGlobal };
      });

    if (candidates.length === 0) return [];

    const vectorRanks = useVectorChannel ? buildRankMap(candidates, (item) => item.vectorScore) : null;
    const bm25Ranks = useBm25Channel ? buildRankMap(candidates, (item) => item.bm25Score) : null;

    const scored = candidates
      .map((item) => {
        let rrfScore = 0;
        if (vectorRanks) {
          const rank = vectorRanks.get(item.record.id);
          if (rank !== undefined) rrfScore += vectorWeight / (rrfK + rank);
        }
        if (bm25Ranks) {
          const rank = bm25Ranks.get(item.record.id);
          if (rank !== undefined) rrfScore += bm25Weight / (rrfK + rank);
        }
        rrfScore *= rrfK + 1;

        const recencyFactor = recencyBoostEnabled
          ? computeRecencyMultiplier(item.record.timestamp, recencyHalfLifeHours)
          : 1;
        const importanceFactor = 1 + importanceWeight * clampImportance(item.record.importance);
        const scopeFactor = item.isGlobal ? globalDiscountFactor : 1.0;
        const score = rrfScore * recencyFactor * importanceFactor * scopeFactor;
        return {
          record: item.record,
          score,
          vectorScore: item.vectorScore,
          bm25Score: item.bm25Score,
        };
      })
      .filter((item) => item.score >= params.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit);

    return scored;
  }

  async deleteById(id: string, scopes: string[]): Promise<boolean> {
    const rows = await this.readByScopes(scopes);
    const match = rows.find((row) => this.matchesId(row.id, id));
    if (!match) return false;
    await this.requireTable().delete(`id = '${escapeSql(match.id)}'`);
    this.invalidateScope(match.scope);
    return true;
  }

  async softDeleteMemory(id: string, scopes: string[]): Promise<boolean> {
    const rows = await this.readByScopes(scopes);
    const match = rows.find((row) => this.matchesId(row.id, id));
    if (!match) return false;
    await this.requireTable().delete(`id = '${escapeSql(match.id)}'`);
    await this.requireTable().add([{ ...match, status: "disabled" }]);
    this.invalidateScope(match.scope);
    return true;
  }

  async updateMemoryScope(id: string, newScope: string, scopes: string[]): Promise<boolean> {
    const rows = await this.readByScopes(scopes);
    const match = rows.find((row) => this.matchesId(row.id, id));
    if (!match) return false;

    await this.requireTable().delete(`id = '${escapeSql(match.id)}'`);
    this.invalidateScope(match.scope);

    await this.requireTable().add([{ ...match, scope: newScope }]);
    this.invalidateScope(newScope);
    return true;
  }

  async readGlobalMemories(limit: number = 100): Promise<MemoryRecord[]> {
    const rows = await this.readByScopes(["global"]);
    return rows.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  async getUnusedGlobalMemories(unusedDaysThreshold: number, limit: number = 100): Promise<MemoryRecord[]> {
    const cutoffTime = Date.now() - unusedDaysThreshold * 24 * 60 * 60 * 1000;
    const rows = await this.readByScopes(["global"]);
    return rows.filter((row) => row.lastRecalled > 0 && row.lastRecalled < cutoffTime).slice(0, limit);
  }

  async clearScope(scope: string): Promise<number> {
    const rows = await this.readByScopes([scope]);
    if (rows.length === 0) return 0;
    await this.requireTable().delete(`scope = '${escapeSql(scope)}'`);
    this.invalidateScope(scope);
    return rows.length;
  }

  async list(scope: string, limit: number): Promise<MemoryRecord[]> {
    const rows = await this.readByScopes([scope]);
    return rows.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  async listSince(scope: string, sinceTimestamp: number, limit: number = 100): Promise<MemoryRecord[]> {
    const rows = await this.readByScopesIncludingMerged([scope]);
    return rows
      .filter((row) => row.timestamp >= sinceTimestamp)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async pruneScope(scope: string, maxEntries: number): Promise<number> {
    const rows = await this.list(scope, 100000);
    if (rows.length <= maxEntries) return 0;

    const flagged = rows.filter((r) => {
      const meta = parseMetadata(r.metadataJson);
      return meta.isPotentialDuplicate === true;
    });
    const unflagged = rows.filter((r) => {
      const meta = parseMetadata(r.metadataJson);
      return meta.isPotentialDuplicate !== true;
    });

    const sortedFlagged = flagged.sort((a, b) => a.timestamp - b.timestamp);
    const sortedUnflagged = unflagged.sort((a, b) => a.timestamp - b.timestamp);

    const toDeleteCount = rows.length - maxEntries;
    const deleteFromFlagged = Math.min(sortedFlagged.length, toDeleteCount);
    const toDelete = [
      ...sortedFlagged.slice(0, deleteFromFlagged),
      ...sortedUnflagged.slice(0, toDeleteCount - deleteFromFlagged),
    ];

    for (const row of toDelete) {
      await this.requireTable().delete(`id = '${escapeSql(row.id)}'`);
    }
    this.invalidateScope(scope);
    return toDelete.length;
  }

  async consolidateDuplicates(scope: string, threshold: number): Promise<{
    mergedPairs: number;
    updatedRecords: number;
    skippedRecords: number;
  }> {
    const rows = await this.readByScopesIncludingMerged([scope]);
    if (rows.length === 0) {
      return { mergedPairs: 0, updatedRecords: 0, skippedRecords: 0 };
    }

    let mergedPairs = 0;
    let updatedRecords = 0;
    let skippedRecords = 0;
    const now = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    const rowsWithNorms = rows.map((row) => ({
      row,
      norm: this.scopeCache.get(scope)?.norms.get(row.id) ?? vecNorm(row.vector),
    }));

    for (let i = 0; i < rowsWithNorms.length; i += 1) {
      const a = rowsWithNorms[i];
      for (let j = i + 1; j < rowsWithNorms.length; j += 1) {
        const b = rowsWithNorms[j];
        const sim = storeFastCosine(a.row.vector, b.row.vector, a.norm, b.norm);
        if (sim < threshold) continue;

        const aMeta = parseMetadata(a.row.metadataJson);
        if (aMeta.status === "merged") {
          skippedRecords += 1;
          continue;
        }
        if (a.row.lastRecalled > 0 && now - a.row.lastRecalled < FIVE_MINUTES_MS) {
          skippedRecords += 1;
          continue;
        }

        const older = a.row.timestamp <= b.row.timestamp ? a.row : b.row;
        const newer = a.row.timestamp <= b.row.timestamp ? b.row : a.row;

        // Skip self-merge: when timestamps are equal, both could reference the same record
        if (older.id === newer.id) {
          continue;
        }

        const newerMeta = parseMetadata(newer.metadataJson);

        const mergedIntoId = newer.id;
        const updatedOlderMeta = { status: "merged" as const, mergedInto: mergedIntoId };
        await this.requireTable().delete(`id = '${escapeSql(older.id)}'`);
        await this.requireTable().add([{
          ...older,
          status: "merged",
          metadataJson: JSON.stringify({ ...parseMetadata(older.metadataJson), ...updatedOlderMeta }),
        }]);

        const updatedNewerMeta = { ...newerMeta, mergedFrom: older.id };
        await this.requireTable().delete(`id = '${escapeSql(newer.id)}'`);
        await this.requireTable().add([{
          ...newer,
          metadataJson: JSON.stringify(updatedNewerMeta),
        }]);

        mergedPairs += 1;
        updatedRecords += 2;
      }
    }

    if (mergedPairs > 0) {
      this.invalidateScope(scope);
    }

    return { mergedPairs, updatedRecords, skippedRecords };
  }

  async countIncompatibleVectors(scopes: string[], expectedDim: number): Promise<number> {
    const rows = await this.readByScopes(scopes);
    return rows.filter((row) => row.vectorDim !== expectedDim).length;
  }

  private matchesId(candidateId: string, query: string): boolean {
    if (query.length >= 36) return candidateId === query;
    return candidateId.startsWith(query);
  }

  async hasMemory(id: string, scopes: string[]): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const rows = await this.readByScopes(scopes);
      if (rows.some((row) => this.matchesId(row.id, id))) {
        return true;
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    return false;
  }

  async updateMemoryUsage(id: string, projectScope: string, scopes: string[]): Promise<void> {
    const rows = await this.readByScopes(scopes);
    const match = rows.find((row) => this.matchesId(row.id, id));
    if (!match) return;

    const now = Date.now();
    const newRecallCount = match.recallCount + 1;

    let newProjectCount = match.projectCount;
    let metadataJson = match.metadataJson;

    if (match.scope === "global" && projectScope) {
      const projects = extractRecalledProjects(metadataJson);
      if (!projects.has(projectScope)) {
        projects.add(projectScope);
        if (projects.size > 100) {
          const arr = Array.from(projects);
          arr.splice(0, arr.length - 100);
          metadataJson = JSON.stringify({ recalledProjects: arr });
        } else {
          metadataJson = JSON.stringify({ recalledProjects: Array.from(projects) });
        }
        newProjectCount = projects.size;
      }
    }

    await this.requireTable().delete(`id = '${escapeSql(match.id)}'`);
    this.invalidateScope(match.scope);

    await this.requireTable().add([{
      ...match,
      lastRecalled: now,
      recallCount: newRecallCount,
      projectCount: newProjectCount,
      metadataJson,
    }]);

    this.invalidateScope(match.scope);
  }

  async getCitation(id: string, scopes: string[]): Promise<{ source: CitationSource; timestamp: number; status: CitationStatus; chain: string[] } | null> {
    const rows = await this.readByScopes(scopes);
    const match = rows.find((row) => this.matchesId(row.id, id));
    if (!match) return null;
    if (!match.citationSource) return null;
    return {
      source: match.citationSource,
      timestamp: match.citationTimestamp ?? match.timestamp,
      status: match.citationStatus ?? "pending",
      chain: match.citationChain ?? [],
    };
  }

  async updateCitation(
    id: string,
    scopes: string[],
    updates: {
      status?: CitationStatus;
      chain?: string[];
    },
  ): Promise<boolean> {
    const rows = await this.readByScopes(scopes);
    const match = rows.find((row) => this.matchesId(row.id, id));
    if (!match) return false;

    const existingChain = match.citationChain ?? [];
    const currentMeta = parseMetadata(match.metadataJson);
    const newMeta = {
      ...currentMeta,
      citationStatus: updates.status,
      citationVerifiedAt: updates.status === "verified" ? Date.now() : currentMeta.citationVerifiedAt,
    };

    await this.requireTable().delete(`id = '${escapeSql(match.id)}'`);
    this.invalidateScope(match.scope);

    await this.requireTable().add([{
      ...match,
      citationStatus: updates.status ?? match.citationStatus,
      citationChain: updates.chain ? [...existingChain, ...updates.chain] : existingChain,
      metadataJson: JSON.stringify(newMeta),
    }]);

    this.invalidateScope(match.scope);
    return true;
  }

  async validateCitation(id: string, scopes: string[]): Promise<{ valid: boolean; status: CitationStatus; reason?: string }> {
    const citation = await this.getCitation(id, scopes);
    if (!citation) {
      return { valid: false, status: "invalid", reason: "No citation found" };
    }

    if (citation.status === "verified") {
      return { valid: true, status: "verified" };
    }

    if (citation.status === "invalid") {
      return { valid: false, status: "invalid", reason: "Citation was marked invalid" };
    }

    if (citation.status === "pending") {
      const ageMs = Date.now() - citation.timestamp;
      const autoExpireMs = 7 * 24 * 60 * 60 * 1000;
      if (ageMs > autoExpireMs) {
        await this.updateCitation(id, scopes, { status: "expired" });
        return { valid: false, status: "expired", reason: "Citation expired (pending too long)" };
      }
      return { valid: true, status: "pending" };
    }

    if (citation.status === "expired") {
      return { valid: false, status: "expired", reason: "Citation has expired" };
    }

    return { valid: false, status: citation.status, reason: "Unknown citation status" };
  }

  async explainMemory(
    id: string,
    scopes: string[],
    currentScope: string,
    recencyHalfLifeHours: number = 72,
    globalDiscountFactor: number = 0.7,
  ): Promise<MemoryExplanation | null> {
    const rows = await this.readByScopes(scopes);
    const match = rows.find((row) => this.matchesId(row.id, id));
    if (!match) return null;

    const now = Date.now();
    const ageHours = (now - match.timestamp) / (1000 * 60 * 60);
    const halfLifeMs = recencyHalfLifeHours * 60 * 60 * 1000;
    const decayFactor = Math.exp(-ageHours / recencyHalfLifeHours);
    const isGlobal = match.scope === "global";

    const citation = match.citationSource
      ? {
          source: match.citationSource,
          status: match.citationStatus,
          timestamp: match.citationTimestamp,
        }
      : undefined;

    const factors: RecallFactors = {
      relevance: {
        overall: 0,
        vectorScore: 0,
        bm25Score: 0,
      },
      recency: {
        timestamp: match.timestamp,
        ageHours,
        withinHalfLife: ageHours <= recencyHalfLifeHours,
        decayFactor,
      },
      citation,
      importance: match.importance,
      scope: {
        memoryScope: match.scope,
        matchesCurrentScope: match.scope === currentScope,
        isGlobal,
      },
    };

    return {
      memoryId: match.id,
      text: match.text,
      factors,
      generatedAt: now,
    };
  }

  async refreshExpiredCitations(scope: string, maxAgeDays: number = 7): Promise<number> {
    const rows = await this.readByScopes([scope]);
    let expiredCount = 0;
    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    for (const row of rows) {
      if (row.citationStatus === "pending" && row.citationTimestamp && row.citationTimestamp < cutoffTime) {
        const updated = await this.updateCitation(row.id, [scope], { status: "expired" });
        if (updated) expiredCount++;
      }
    }

    return expiredCount;
  }

  async listEvents(scopes: string[], limit: number): Promise<MemoryEffectivenessEvent[]> {
    const rows = await this.readEventsByScopes(scopes);
    return rows.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  async summarizeEvents(scope: string, includeGlobalScope: boolean): Promise<EffectivenessSummary> {
    const scopes = includeGlobalScope && scope !== "global" ? [scope, "global"] : [scope];
    const events = await this.readEventsByScopes(scopes);
    // Read all memories including merged for duplicate counts
    const memories = await this.readByScopesIncludingMerged(scopes);

    const captureSkipReasons: Partial<Record<CaptureSkipReason, number>> = {};
    let captureConsidered = 0;
    let captureStored = 0;
    let captureSkipped = 0;
    let recallRequested = 0;
    let recallInjected = 0;
    let recallReturnedResults = 0;
    let autoRecallRequested = 0;
    let autoRecallInjected = 0;
    let autoRecallReturnedResults = 0;
    let manualRecallRequested = 0;
    let manualRecallReturnedResults = 0;
    let feedbackMissing = 0;
    let feedbackWrong = 0;
    let feedbackUsefulPositive = 0;
    let feedbackUsefulNegative = 0;

    for (const event of events) {
      if (event.type === "capture") {
        if (event.outcome === "considered") captureConsidered += 1;
        if (event.outcome === "stored") captureStored += 1;
        if (event.outcome === "skipped") {
          captureSkipped += 1;
          if (event.skipReason) {
            captureSkipReasons[event.skipReason] = (captureSkipReasons[event.skipReason] ?? 0) + 1;
          }
        }
      }

      if (event.type === "recall") {
        recallRequested += 1;
        if (event.resultCount > 0) recallReturnedResults += 1;
        if (event.injected) recallInjected += 1;
        const recallSource = event.source ?? "system-transform";
        if (recallSource === "manual-search") {
          manualRecallRequested += 1;
          if (event.resultCount > 0) manualRecallReturnedResults += 1;
        } else {
          autoRecallRequested += 1;
          if (event.resultCount > 0) autoRecallReturnedResults += 1;
          if (event.injected) autoRecallInjected += 1;
        }
      }

      if (event.type === "feedback") {
        if (event.feedbackType === "missing") feedbackMissing += 1;
        if (event.feedbackType === "wrong") feedbackWrong += 1;
        if (event.feedbackType === "useful") {
          if (event.helpful) feedbackUsefulPositive += 1;
          else feedbackUsefulNegative += 1;
        }
      }
    }

    const totalCaptureAttempts = captureStored + captureSkipped;
    const totalUsefulFeedback = feedbackUsefulPositive + feedbackUsefulNegative;

    // Count flagged (isPotentialDuplicate) and consolidated (status=merged) from memories table
    const flaggedCount = memories.filter((r) => {
      const meta = parseMetadata(r.metadataJson);
      return meta.isPotentialDuplicate === true;
    }).length;
    const consolidatedCount = memories.filter((r) => {
      const meta = parseMetadata(r.metadataJson);
      return meta.status === "merged";
    }).length;

    return {
      scope,
      totalEvents: events.length,
      capture: {
        considered: captureConsidered,
        stored: captureStored,
        skipped: captureSkipped,
        successRate: totalCaptureAttempts === 0 ? 0 : captureStored / totalCaptureAttempts,
        skipReasons: captureSkipReasons,
      },
      recall: {
        requested: recallRequested,
        injected: recallInjected,
        returnedResults: recallReturnedResults,
        hitRate: recallRequested === 0 ? 0 : recallReturnedResults / recallRequested,
        injectionRate: recallRequested === 0 ? 0 : recallInjected / recallRequested,
        auto: {
          requested: autoRecallRequested,
          injected: autoRecallInjected,
          returnedResults: autoRecallReturnedResults,
          hitRate: autoRecallRequested === 0 ? 0 : autoRecallReturnedResults / autoRecallRequested,
          injectionRate: autoRecallRequested === 0 ? 0 : autoRecallInjected / autoRecallRequested,
        },
        manual: {
          requested: manualRecallRequested,
          returnedResults: manualRecallReturnedResults,
          hitRate: manualRecallRequested === 0 ? 0 : manualRecallReturnedResults / manualRecallRequested,
        },
        manualRescueRatio: autoRecallRequested === 0 ? 0 : manualRecallRequested / autoRecallRequested,
      },
      feedback: {
        missing: feedbackMissing,
        wrong: feedbackWrong,
        useful: {
          positive: feedbackUsefulPositive,
          negative: feedbackUsefulNegative,
          helpfulRate: totalUsefulFeedback === 0 ? 0 : feedbackUsefulPositive / totalUsefulFeedback,
        },
        falsePositiveRate: captureStored === 0 ? 0 : feedbackWrong / captureStored,
        falseNegativeRate: totalCaptureAttempts === 0 ? 0 : feedbackMissing / totalCaptureAttempts,
      },
      duplicates: {
        flaggedCount,
        consolidatedCount,
      },
    };
  }

  getIndexHealth(): { vector: boolean; fts: boolean; ftsError?: string } {
    return {
      vector: this.indexState.vector,
      fts: this.indexState.fts,
      ftsError: this.indexState.ftsError || undefined,
    };
  }

  private invalidateScope(scope: string): void {
    this.scopeCache.delete(scope);
  }

  private async getCachedScopes(scopes: string[]): Promise<ScopeCache> {
    const allRecords: MemoryRecord[] = [];
    const allTokenized: string[][] = [];
    const allNorms = new Map<string, number>();

    for (const scope of scopes) {
      let entry = this.scopeCache.get(scope);
      if (!entry) {
        const records = await this.readByScopes([scope]);
        const tokenized = records.map((record) => tokenize(record.text));
        const idf = computeIdf(tokenized);
        const norms = new Map<string, number>();
        for (const record of records) {
          norms.set(record.id, vecNorm(record.vector));
        }
        entry = { records, tokenized, idf, norms };
        this.scopeCache.set(scope, entry);
      }
      allRecords.push(...entry.records);
      allTokenized.push(...entry.tokenized);
      for (const [id, norm] of entry.norms) {
        allNorms.set(id, norm);
      }
    }

    const idf = scopes.length === 1 && this.scopeCache.has(scopes[0])
      ? this.scopeCache.get(scopes[0])!.idf
      : computeIdf(allTokenized);

    return { records: allRecords, tokenized: allTokenized, idf, norms: allNorms };
  }

  private requireTable(): LanceTable {
    if (!this.table) {
      throw new Error("MemoryStore is not initialized");
    }
    return this.table;
  }

  private requireEventTable(): LanceTable {
    if (!this.eventTable) {
      throw new Error("MemoryStore event table is not initialized");
    }
    return this.eventTable;
  }

  private async ensureEpisodicTaskTable(vectorDim: number): Promise<void> {
    const EPISODIC_TABLE_NAME = "episodic_tasks";
    if (this.episodicTaskTable) return;

    try {
      this.episodicTaskTable = await this.connection!.openTable(EPISODIC_TABLE_NAME);
      const schema = await this.episodicTaskTable.schema();
      const fieldNames = schema.fields.map((f) => f.name);
      if (!fieldNames.includes("taskDescriptionVector")) {
        await this.episodicTaskTable.addColumns([{ name: "taskDescriptionVector", valueSql: "NULL" }]);
      }
    } catch {
      const bootstrap: EpisodicTaskRecord = {
        id: "__bootstrap__",
        sessionId: "",
        scope: "global",
        taskId: "",
        state: "pending",
        startTime: 0,
        endTime: 0,
        commandsJson: "[]",
        validationOutcomesJson: "[]",
        successPatternsJson: "[]",
        retryAttemptsJson: "[]",
        recoveryStrategiesJson: "[]",
        metadataJson: "{}",
        taskDescriptionVector: undefined,
      };
      this.episodicTaskTable = await this.connection!.createTable(EPISODIC_TABLE_NAME, [bootstrap]);
      await this.episodicTaskTable.delete("id = '__bootstrap__'");
      await this.episodicTaskTable.addColumns([{ name: "taskDescriptionVector", valueSql: "NULL" }]);
    }
  }

  private requireEpisodicTaskTable(): LanceTable {
    if (!this.episodicTaskTable) {
      throw new Error("MemoryStore episodic task table is not initialized");
    }
    return this.episodicTaskTable;
  }

  async createTaskEpisode(record: EpisodicTaskRecord): Promise<void> {
    await this.ensureEpisodicTaskTable(384);
    await this.requireEpisodicTaskTable().add([record]);
  }

  async updateTaskState(taskId: string, state: TaskState, scope: string, failureType?: string, errorMessage?: string): Promise<boolean> {
    await this.ensureEpisodicTaskTable(384);
    const table = this.requireEpisodicTaskTable();
    const rows = await table.query().where(`taskId = '${escapeSql(taskId)}' AND scope = '${escapeSql(scope)}'`).toArray();
    if (rows.length === 0) return false;

    const existing = rows[0] as unknown as EpisodicTaskRecord;
    const updated: EpisodicTaskRecord = {
      ...existing,
      state,
      endTime: state !== "running" && state !== "pending" ? Date.now() : undefined,
      failureType: failureType as EpisodicTaskRecord["failureType"],
      errorMessage,
    };
    await table.delete(`id = '${escapeSql(existing.id)}'`);
    await table.add([updated]);
    return true;
  }

  async getTaskEpisode(taskId: string, scope: string): Promise<EpisodicTaskRecord | null> {
    await this.ensureEpisodicTaskTable(384);
    const rows = await this.requireEpisodicTaskTable()
      .query()
      .where(`taskId = '${escapeSql(taskId)}' AND scope = '${escapeSql(scope)}'`)
      .toArray();
    if (rows.length === 0) return null;
    return rows[0] as unknown as EpisodicTaskRecord;
  }

  async queryTaskEpisodes(scope: string, state?: TaskState, sinceTimestamp?: number): Promise<EpisodicTaskRecord[]> {
    await this.ensureEpisodicTaskTable(384);
    const table = this.requireEpisodicTaskTable();
    let whereClause = `scope = '${escapeSql(scope)}'`;
    if (state) {
      whereClause += ` AND state = '${escapeSql(state)}'`;
    }
    if (sinceTimestamp) {
      whereClause += ` AND startTime >= ${sinceTimestamp}`;
    }
    const rows = await table.query().where(whereClause).toArray();
    return rows as unknown as EpisodicTaskRecord[];
  }

  /**
   * Generic helper for appending items to an episodic task's JSON array field.
   * Centralizes the read-parse-push-write pattern across all add*Episode methods.
   */
  private async appendToEpisodeField<T>(
    taskId: string,
    scope: string,
    fieldAccessor: (record: EpisodicTaskRecord) => string,
    fieldMutator: (record: EpisodicTaskRecord, value: string) => EpisodicTaskRecord,
    parser: (raw: string) => T[],
    serializer: (items: T[]) => string,
    newItem: T,
    itemEnricher?: (item: T) => T,
  ): Promise<boolean> {
    await this.ensureEpisodicTaskTable(384);
    const table = this.requireEpisodicTaskTable();
    const rows = await table.query().where(`taskId = '${escapeSql(taskId)}' AND scope = '${escapeSql(scope)}'`).toArray();
    if (rows.length === 0) return false;

    const existing = rows[0] as unknown as EpisodicTaskRecord;
    const items: T[] = parser(fieldAccessor(existing) || "[]");
    const enrichedItem = itemEnricher ? itemEnricher(newItem) : newItem;
    items.push(enrichedItem);

    const updated = fieldMutator(existing, serializer(items));
    await table.delete(`id = '${escapeSql(existing.id)}'`);
    await table.add([updated]);
    return true;
  }

  async addCommandToEpisode(taskId: string, scope: string, command: string): Promise<boolean> {
    return this.appendToEpisodeField(
      taskId,
      scope,
      (r) => r.commandsJson,
      (r, v) => ({ ...r, commandsJson: v }),
      (raw) => (raw ? JSON.parse(raw) : []),
      (items) => JSON.stringify(items),
      command,
    );
  }

  async addValidationOutcome(taskId: string, scope: string, outcome: ValidationOutcome): Promise<boolean> {
    return this.appendToEpisodeField(
      taskId,
      scope,
      (r) => r.validationOutcomesJson,
      (r, v) => ({ ...r, validationOutcomesJson: v }),
      (raw) => (raw ? JSON.parse(raw) : []),
      (items) => JSON.stringify(items),
      outcome,
    );
  }

  async addSuccessPatterns(taskId: string, scope: string, patterns: SuccessPattern[]): Promise<boolean> {
    await this.ensureEpisodicTaskTable(384);
    const table = this.requireEpisodicTaskTable();
    const rows = await table.query().where(`taskId = '${escapeSql(taskId)}' AND scope = '${escapeSql(scope)}'`).toArray();
    if (rows.length === 0) return false;

    const existing = rows[0] as unknown as EpisodicTaskRecord;
    const existingPatterns: SuccessPattern[] = existing.successPatternsJson ? JSON.parse(existing.successPatternsJson) : [];
    const allPatterns = [...existingPatterns, ...patterns];

    const updated: EpisodicTaskRecord = {
      ...existing,
      successPatternsJson: JSON.stringify(allPatterns),
    };
    await table.delete(`id = '${escapeSql(existing.id)}'`);
    await table.add([updated]);
    return true;
  }

  async findSimilarTasks(
    scope: string,
    taskDescription: string,
    minSimilarity: number = 0.85,
    queryVector?: number[],
  ): Promise<EpisodicTaskRecord[]> {
    await this.ensureEpisodicTaskTable(384);
    const table = this.requireEpisodicTaskTable();
    const rows = await table.query().where(`scope = '${escapeSql(scope)}' AND state = 'success'`).toArray();
    const episodes = rows as unknown as EpisodicTaskRecord[];

    // Vector similarity if query vector provided
    if (queryVector && queryVector.length > 0) {
      const scored = episodes
        .filter((ep) => ep.taskDescriptionVector && ep.taskDescriptionVector.length === queryVector.length)
        .map((ep) => {
          const similarity = cosineSimilarity(queryVector, ep.taskDescriptionVector!);
          return { episode: ep, similarity };
        });

      return scored
        .filter((s) => s.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .map((s) => s.episode);
    }

    // Fallback to keyword-based similarity
    const keywords = taskDescription.toLowerCase().split(/\s+/).filter((k) => k.length > 2);

    const scored = episodes.map((ep) => {
      const metadata = JSON.parse(ep.metadataJson || "{}");
      const description = (metadata.description || "").toLowerCase();
      const taskId = ep.taskId.toLowerCase();
      const commands = JSON.parse(ep.commandsJson || "[]").join(" ").toLowerCase();

      const text = `${taskId} ${description} ${commands}`;
      let matchCount = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) matchCount++;
      }
      const similarity = keywords.length > 0 ? matchCount / keywords.length : 0;
      return { episode: ep, similarity };
    });

    return scored
      .filter((s) => s.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .map((s) => s.episode);
  }

  async extractSuccessPatternsFromScope(scope: string): Promise<{ pattern: SuccessPattern; count: number }[]> {
    await this.ensureEpisodicTaskTable(384);
    const table = this.requireEpisodicTaskTable();
    const rows = await table.query().where(`scope = '${escapeSql(scope)}' AND state = 'success'`).toArray();
    const episodes = rows as unknown as EpisodicTaskRecord[];

    const commandSequenceCount = new Map<string, number>();
    const toolCount = new Map<string, number>();

    for (const ep of episodes) {
      const commands: string[] = JSON.parse(ep.commandsJson || "[]");
      if (commands.length > 0) {
        const seq = commands.join(" | ");
        commandSequenceCount.set(seq, (commandSequenceCount.get(seq) || 0) + 1);
      }

      // Extract tools from commands (simple heuristic)
      for (const cmd of commands) {
        const toolMatch = cmd.match(/^(npm|yarn|pnpm|npx|yarn|cargo|go|pytest|jest|tsc|eslint|prettier)/);
        if (toolMatch) {
          toolCount.set(toolMatch[1], (toolCount.get(toolMatch[1]) || 0) + 1);
        }
      }
    }

    const patterns: { pattern: SuccessPattern; count: number }[] = [];

    // Create patterns from frequent command sequences
    for (const [seq, count] of commandSequenceCount) {
      const commands = seq.split(" | ");
      const confidence = Math.min(0.5 + (count * 0.1), 1.0);
      patterns.push({
        pattern: {
          commands,
          tools: commands.map(c => c.split(" ")[0]).filter(Boolean),
          confidence,
          extractedAt: Date.now(),
        },
        count,
      });
    }

    return patterns.sort((a, b) => b.count - a.count);
  }

  async addRetryAttempt(taskId: string, scope: string, attempt: { attemptNumber: number; outcome: "success" | "failed" | "abandoned"; errorMessage?: string; failureType?: string }): Promise<boolean> {
    return this.appendToEpisodeField(
      taskId,
      scope,
      (r) => r.retryAttemptsJson,
      (r, v) => ({ ...r, retryAttemptsJson: v }),
      (raw) => JSON.parse(raw || "[]"),
      (items) => JSON.stringify(items),
      attempt,
      (item) => ({ ...item, timestamp: Date.now() }),
    );
  }

  async addRecoveryStrategy(taskId: string, scope: string, strategy: { name: string; succeeded: boolean }): Promise<boolean> {
    return this.appendToEpisodeField(
      taskId,
      scope,
      (r) => r.recoveryStrategiesJson,
      (r, v) => ({ ...r, recoveryStrategiesJson: v }),
      (raw) => JSON.parse(raw || "[]"),
      (items) => JSON.stringify(items),
      strategy,
      (item) => ({ ...item, attemptedAt: Date.now() }),
    );
  }

  async suggestRetryBudget(scope: string, minSamples: number = 3): Promise<{ suggestedRetries: number; confidence: number; basedOnCount: number; shouldStop: boolean; stopReason?: string } | null> {
    await this.ensureEpisodicTaskTable(384);
    const table = this.requireEpisodicTaskTable();
    const rows = await table.query().where(`scope = '${escapeSql(scope)}' AND state = 'failed'`).toArray();
    const failedEpisodes = rows as unknown as EpisodicTaskRecord[];

    if (failedEpisodes.length < minSamples) {
      return null;
    }

    const retryCounts: number[] = [];
    let sameErrorCount = 0;
    const firstError = failedEpisodes[0]?.errorMessage;

    for (const ep of failedEpisodes) {
      const attempts = JSON.parse(ep.retryAttemptsJson || "[]");
      retryCounts.push(attempts.length);

      if (ep.errorMessage === firstError && attempts.length > 0) {
        sameErrorCount++;
      }
    }

    if (retryCounts.length === 0) {
      return null;
    }

    const sorted = [...retryCounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const suggestedRetries = median + 1;
    const confidence = Math.min(0.5 + (retryCounts.length * 0.1), 1.0);

    const shouldStop = sameErrorCount >= 3;
    const stopReason = shouldStop ? "Multiple retries failed with same error" : undefined;

    return {
      suggestedRetries,
      confidence,
      basedOnCount: retryCounts.length,
      shouldStop,
      stopReason,
    };
  }

  async suggestRecoveryStrategies(scope: string, taskId: string): Promise<{ strategy: string; reason: string; confidence: number; basedOnTask?: string }[]> {
    await this.ensureEpisodicTaskTable(384);
    const table = this.requireEpisodicTaskTable();
    const suggestions: { strategy: string; reason: string; confidence: number; basedOnTask?: string }[] = [];

    const failedRows = await table.query().where(`scope = '${escapeSql(scope)}' AND state = 'failed'`).toArray();
    const failedEpisodes = failedRows as unknown as EpisodicTaskRecord[];

    const successRows = await table.query().where(`scope = '${escapeSql(scope)}' AND state = 'success'`).toArray();
    const successEpisodes = successRows as unknown as EpisodicTaskRecord[];

    if (failedEpisodes.length >= 3 && successEpisodes.length > 0) {
      const failedTaskIds = failedEpisodes.map(e => e.taskId);
      const similarSuccess = successEpisodes.find(e => {
        const eId = e.taskId.toLowerCase();
        return failedTaskIds.some(fId => eId.includes(fId) || fId.includes(eId));
      });

      if (similarSuccess) {
        const commands = JSON.parse(similarSuccess.commandsJson || "[]");
        if (commands.length > 0) {
          suggestions.push({
            strategy: `Try: ${commands[0]}`,
            reason: "Similar task succeeded with this approach",
            confidence: 0.7,
            basedOnTask: similarSuccess.taskId,
          });
        }
      }
    }

    const recentFailed = failedEpisodes.filter(e => Date.now() - e.startTime < 3600000);
    if (recentFailed.length >= 2) {
      suggestions.push({
        strategy: "Consider exponential backoff",
        reason: "Multiple failures in short timeframe",
        confidence: 0.6,
      });
    }

    return suggestions;
  }

  async readEventsByScopes(scopes: string[]): Promise<MemoryEffectivenessEvent[]> {
    const table = this.requireEventTable();
    if (scopes.length === 0) return [];
    const whereExpr = scopes.map((scope) => `scope = '${escapeSql(scope)}'`).join(" OR ");
    const rows = await table
      .query()
      .where(`(${whereExpr})`)
      .select([
        "id",
        "type",
        "scope",
        "sessionID",
        "timestamp",
        "memoryId",
        "text",
        "outcome",
        "skipReason",
        "resultCount",
        "injected",
        "source",
        "feedbackType",
        "helpful",
        "reason",
        "labelsJson",
        "metadataJson",
        "sourceSessionId",
        "confidenceDelta",
        "relatedMemoryId",
        "context",
      ])
      .limit(100000)
      .toArray();

    return rows
      .map((row) => normalizeEventRow(row))
      .filter((row): row is MemoryEffectivenessEvent => row !== null);
  }

  private async readByScopesIncludingMerged(scopes: string[]): Promise<MemoryRecord[]> {
    const table = this.requireTable();
    if (scopes.length === 0) return [];
    const whereExpr = scopes.map((scope) => `scope = '${escapeSql(scope)}'`).join(" OR ");
    const rows = await table
      .query()
      .where(`(${whereExpr})`)
      .select([
        "id",
        "text",
        "vector",
        "category",
        "scope",
        "importance",
        "timestamp",
        "lastRecalled",
        "recallCount",
        "projectCount",
        "schemaVersion",
        "embeddingModel",
        "vectorDim",
        "metadataJson",
        "userId",
        "teamId",
        "sourceSessionId",
        "confidence",
        "tags",
        "status",
        "parentId",
        "citationSource",
        "citationTimestamp",
        "citationStatus",
        "citationChain",
      ])
      .limit(100000)
      .toArray();

    return rows
      .map((row) => normalizeRow(row))
      .filter((row): row is MemoryRecord => row !== null);
  }

  private async readByScopes(scopes: string[]): Promise<MemoryRecord[]> {
    const table = this.requireTable();
    if (scopes.length === 0) return [];
    const whereExpr = scopes.map((scope) => `scope = '${escapeSql(scope)}'`).join(" OR ");
    const rows = await table
      .query()
      .where(`(${whereExpr}) AND (status != 'disabled' OR status IS NULL OR status = '') AND NOT (status = 'merged') AND NOT (metadataJson LIKE '%"status":"merged"%')`)
      .select([
        "id",
        "text",
        "vector",
        "category",
        "scope",
        "importance",
        "timestamp",
        "lastRecalled",
        "recallCount",
        "projectCount",
        "schemaVersion",
        "embeddingModel",
        "vectorDim",
        "metadataJson",
        "userId",
        "teamId",
        "sourceSessionId",
        "confidence",
        "tags",
        "status",
        "parentId",
        "citationSource",
        "citationTimestamp",
        "citationStatus",
        "citationChain",
      ])
      .limit(100000)
      .toArray();

    return rows
      .map((row) => normalizeRow(row))
      .filter((row): row is MemoryRecord => row !== null);
  }

  private async ensureIndexes(): Promise<void> {
    const table = this.requireTable();

    try {
      await table.createIndex("vector");
      this.indexState.vector = true;
    } catch {
      this.indexState.vector = false;
    }

    try {
      if (this.lancedb && "Index" in this.lancedb) {
        const anyLance = this.lancedb as unknown as { Index?: { fts?: () => unknown } };
        const cfg = anyLance.Index?.fts ? { config: anyLance.Index.fts() } : undefined;
        await table.createIndex("text", cfg as Record<string, unknown> | undefined);
      } else {
        await table.createIndex("text");
      }
      this.indexState.fts = true;
      this.indexState.ftsError = "";
    } catch (error) {
      this.indexState.fts = false;
      this.indexState.ftsError = error instanceof Error ? error.message : String(error);
    }
  }

  private async ensureMemoriesTableCompatibility(): Promise<void> {
    const table = this.requireTable();
    const schema = await table.schema();
    const fieldNames = new Set(schema.fields.map((field) => field.name));

    const missing: Array<{ name: string; valueSql: string }> = [];
    if (!fieldNames.has("lastRecalled")) {
      missing.push({ name: "lastRecalled", valueSql: "CAST(0 AS BIGINT)" });
    }
    if (!fieldNames.has("recallCount")) {
      missing.push({ name: "recallCount", valueSql: "CAST(0 AS INT)" });
    }
    if (!fieldNames.has("projectCount")) {
      missing.push({ name: "projectCount", valueSql: "CAST(0 AS INT)" });
    }
    if (!fieldNames.has("userId")) {
      missing.push({ name: "userId", valueSql: "CAST(NULL AS STRING)" });
    }
    if (!fieldNames.has("teamId")) {
      missing.push({ name: "teamId", valueSql: "CAST(NULL AS STRING)" });
    }
    if (!fieldNames.has("sourceSessionId")) {
      missing.push({ name: "sourceSessionId", valueSql: "CAST(NULL AS STRING)" });
    }
    if (!fieldNames.has("confidence")) {
      missing.push({ name: "confidence", valueSql: "CAST(NULL AS DOUBLE)" });
    }
    if (!fieldNames.has("tags")) {
      missing.push({ name: "tags", valueSql: "CAST(NULL AS STRING)" });
    }
    if (!fieldNames.has("status")) {
      missing.push({ name: "status", valueSql: "CAST('active' AS STRING)" });
    }
    if (!fieldNames.has("parentId")) {
      missing.push({ name: "parentId", valueSql: "CAST(NULL AS STRING)" });
    }
    if (!fieldNames.has("citationSource")) {
      missing.push({ name: "citationSource", valueSql: "CAST(NULL AS STRING)" });
    }
    if (!fieldNames.has("citationTimestamp")) {
      missing.push({ name: "citationTimestamp", valueSql: "CAST(NULL AS BIGINT)" });
    }
    if (!fieldNames.has("citationStatus")) {
      missing.push({ name: "citationStatus", valueSql: "CAST(NULL AS STRING)" });
    }
    if (!fieldNames.has("citationChain")) {
      missing.push({ name: "citationChain", valueSql: "CAST(NULL AS STRING)" });
    }

    if (missing.length === 0) {
      return;
    }

    try {
      await table.addColumns(missing);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const names = missing.map((col) => col.name).join(", ");
      throw new Error(
        `Failed to patch ${TABLE_NAME} schema for columns [${names}]: ${reason}`,
      );
    }
  }

  private async ensureEventTableCompatibility(): Promise<void> {
    const table = this.requireEventTable();
    const schema = await table.schema();
    const fieldNames = new Set(schema.fields.map((field) => field.name));

    const missing: Array<{ name: string; valueSql: string }> = [];
    if (!fieldNames.has(EVENTS_SOURCE_COLUMN)) {
      missing.push({ name: EVENTS_SOURCE_COLUMN, valueSql: "CAST(NULL AS STRING)" });
    }
    if (!fieldNames.has("sourceSessionId")) {
      missing.push({ name: "sourceSessionId", valueSql: "CAST(NULL AS STRING)" });
    }
    if (!fieldNames.has("confidenceDelta")) {
      missing.push({ name: "confidenceDelta", valueSql: "CAST(NULL AS DOUBLE)" });
    }
    if (!fieldNames.has("relatedMemoryId")) {
      missing.push({ name: "relatedMemoryId", valueSql: "CAST(NULL AS STRING)" });
    }
    if (!fieldNames.has("context")) {
      missing.push({ name: "context", valueSql: "CAST(NULL AS STRING)" });
    }

    if (missing.length === 0) {
      return;
    }

    try {
      await table.addColumns(missing);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const names = missing.map((col) => col.name).join(", ");
      throw new Error(
        `Failed to patch ${EVENTS_TABLE_NAME} schema for columns [${names}]: ${reason}`,
      );
    }
  }
}

function normalizeRow(row: Record<string, unknown>): MemoryRecord | null {
  const vectorRaw = row.vector;
  const vector =
    Array.isArray(vectorRaw) ? vectorRaw.map((item) => Number(item)) : Array.from((vectorRaw ?? []) as Iterable<number>);

  if (typeof row.id !== "string" || typeof row.text !== "string" || typeof row.scope !== "string") {
    return null;
  }

  const tagsRaw = row.tags;
  const parsedTags = typeof tagsRaw === "string" && tagsRaw.length > 0
    ? JSON.parse(tagsRaw) as string[]
    : Array.isArray(tagsRaw)
      ? tagsRaw as string[]
      : undefined;

  return {
    id: row.id,
    text: row.text,
    vector,
    category: (row.category as MemoryRecord["category"]) ?? "other",
    scope: row.scope,
    importance: Number(row.importance ?? 0.5),
    timestamp: Number(row.timestamp ?? Date.now()),
    lastRecalled: Number(row.lastRecalled ?? 0),
    recallCount: Number(row.recallCount ?? 0),
    projectCount: Number(row.projectCount ?? 0),
    schemaVersion: Number(row.schemaVersion ?? 1),
    embeddingModel: String(row.embeddingModel ?? "unknown"),
    vectorDim: Number(row.vectorDim ?? vector.length),
    metadataJson: String(row.metadataJson ?? "{}"),
    userId: typeof row.userId === "string" && row.userId.length > 0 ? row.userId : undefined,
    teamId: typeof row.teamId === "string" && row.teamId.length > 0 ? row.teamId : undefined,
    sourceSessionId: typeof row.sourceSessionId === "string" && row.sourceSessionId.length > 0 ? row.sourceSessionId : undefined,
    confidence: typeof row.confidence === "number" ? row.confidence : undefined,
    tags: parsedTags,
    status: (row.status as MemoryRecord["status"]) ?? "active",
    parentId: typeof row.parentId === "string" && row.parentId.length > 0 ? row.parentId : undefined,
    citationSource: typeof row.citationSource === "string" && row.citationSource.length > 0 ? row.citationSource as CitationSource : undefined,
    citationTimestamp: typeof row.citationTimestamp === "number" ? row.citationTimestamp : undefined,
    citationStatus: typeof row.citationStatus === "string" && row.citationStatus.length > 0 ? row.citationStatus as CitationStatus : undefined,
    citationChain: (() => {
      if (!row.citationChain) return undefined;
      if (Array.isArray(row.citationChain)) return row.citationChain as string[];
      if (typeof row.citationChain === "string" && row.citationChain.length > 0) {
        try {
          return JSON.parse(row.citationChain) as string[];
        } catch {
          return undefined;
        }
      }
      return undefined;
    })(),
  };
}

function normalizeEventRow(row: Record<string, unknown>): MemoryEffectivenessEvent | null {
  if (typeof row.id !== "string" || typeof row.type !== "string" || typeof row.scope !== "string") {
    return null;
  }

  const base = {
    id: row.id,
    scope: row.scope,
    sessionID: typeof row.sessionID === "string" && row.sessionID.length > 0 ? row.sessionID : undefined,
    timestamp: Number(row.timestamp ?? Date.now()),
    memoryId: typeof row.memoryId === "string" && row.memoryId.length > 0 ? row.memoryId : undefined,
    text: typeof row.text === "string" && row.text.length > 0 ? row.text : undefined,
    metadataJson: String(row.metadataJson ?? "{}"),
  };

  if (row.type === "capture") {
    return {
      ...base,
      type: "capture",
      outcome: row.outcome === "stored" || row.outcome === "skipped" ? row.outcome : "considered",
      skipReason: typeof row.skipReason === "string" && row.skipReason.length > 0
        ? row.skipReason as CaptureSkipReason
        : undefined,
    };
  }

  if (row.type === "recall") {
    const sourceRaw = typeof row.source === "string" && row.source.length > 0 ? row.source : "system-transform";
    const source: RecallSource = sourceRaw === "manual-search" ? "manual-search" : "system-transform";
    return {
      ...base,
      type: "recall",
      resultCount: Number(row.resultCount ?? 0),
      injected: Boolean(row.injected),
      source,
    };
  }

  if (row.type === "feedback") {
    const labelsJson = typeof row.labelsJson === "string" ? row.labelsJson : "[]";
    const labels = JSON.parse(labelsJson) as string[];
    const helpfulValue = Number(row.helpful ?? -1);
    const contextRaw = row.context;
    const parsedContext = typeof contextRaw === "string" && contextRaw.length > 0
      ? JSON.parse(contextRaw) as Record<string, unknown>
      : undefined;
    return {
      ...base,
      type: "feedback",
      feedbackType: row.feedbackType === "missing" || row.feedbackType === "wrong" ? row.feedbackType : "useful",
      helpful: helpfulValue < 0 ? undefined : helpfulValue === 1,
      labels: Array.isArray(labels) ? labels.filter((item): item is string => typeof item === "string") : [],
      reason: typeof row.reason === "string" && row.reason.length > 0 ? row.reason : undefined,
      sourceSessionId: typeof row.sourceSessionId === "string" && row.sourceSessionId.length > 0 ? row.sourceSessionId : undefined,
      confidenceDelta: typeof row.confidenceDelta === "number" ? row.confidenceDelta : undefined,
      relatedMemoryId: typeof row.relatedMemoryId === "string" && row.relatedMemoryId.length > 0 ? row.relatedMemoryId : undefined,
      context: parsedContext,
    };
  }

  return null;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function buildRankMap<T extends { record: { id: string } }>(
  items: T[],
  scoreOf: (item: T) => number,
): Map<string, number> {
  const ranked = [...items].sort((a, b) => scoreOf(b) - scoreOf(a));
  const ranks = new Map<string, number>();
  for (let i = 0; i < ranked.length; i += 1) {
    ranks.set(ranked[i].record.id, i + 1);
  }
  return ranks;
}

function normalizeChannelWeights(vectorWeight: number, bm25Weight: number): { vectorWeight: number; bm25Weight: number } {
  const sum = vectorWeight + bm25Weight;
  if (sum <= 0) {
    return { vectorWeight: 0.5, bm25Weight: 0.5 };
  }
  return {
    vectorWeight: vectorWeight / sum,
    bm25Weight: bm25Weight / sum,
  };
}

function computeRecencyMultiplier(timestamp: number, halfLifeHours: number): number {
  const now = Date.now();
  const ageMs = Math.max(0, now - timestamp);
  const ageHours = ageMs / 3_600_000;
  if (ageHours === 0) return 1;
  const decay = Math.pow(0.5, ageHours / halfLifeHours);
  return 0.5 + 0.5 * decay;
}

function clampImportance(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampImportanceWeight(value: number): number {
  if (!Number.isFinite(value)) return 0.4;
  return Math.max(0, Math.min(2, value));
}

function computeIdf(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set(doc);
    for (const token of seen) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }
  const totalDocs = Math.max(1, docs.length);
  const idf = new Map<string, number>();
  for (const [token, count] of df.entries()) {
    idf.set(token, Math.log(1 + (totalDocs - count + 0.5) / (count + 0.5)));
  }
  return idf;
}

function vecNorm(v: number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i += 1) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

function fastCosine(a: number[], b: number[], normA: number, normB: number): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  const denom = normA * normB;
  if (denom === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot / denom;
}

function bm25LikeScore(query: string[], doc: string[], idf: Map<string, number>): number {
  if (query.length === 0 || doc.length === 0) return 0;
  const tf = new Map<string, number>();
  for (const token of doc) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  const avgDocLen = 120;
  const k1 = 1.2;
  const b = 0.75;

  let score = 0;
  for (const token of query) {
    const freq = tf.get(token) ?? 0;
    if (freq === 0) continue;
    const tokenIdf = idf.get(token) ?? 0.1;
    const numerator = freq * (k1 + 1);
    const denominator = freq + k1 * (1 - b + (b * doc.length) / avgDocLen);
    score += tokenIdf * (numerator / denominator);
  }

  return 1 - Math.exp(-score);
}

function extractRecalledProjects(metadataJson: string): Set<string> {
  try {
    const metadata = JSON.parse(metadataJson);
    if (metadata && Array.isArray(metadata.recalledProjects)) {
      return new Set(metadata.recalledProjects);
    }
  } catch {
    // ignore parse errors
  }
  return new Set();
}

function parseMetadata(metadataJson: string): Record<string, unknown> {
  try {
    return JSON.parse(metadataJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}
