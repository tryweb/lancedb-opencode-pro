import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { CaptureSkipReason, EffectivenessSummary, MemoryEffectivenessEvent, MemoryRecord, RecallSource, SearchResult } from "./types.js";
import { cosineSimilarity, tokenize } from "./utils.js";

type LanceModule = typeof import("@lancedb/lancedb");

type LanceConnection = {
  openTable(name: string): Promise<LanceTable>;
  createTable(name: string, rows: unknown[]): Promise<LanceTable>;
};

type LanceTable = {
  add(rows: unknown[]): Promise<void>;
  delete(filter: string): Promise<void>;
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

interface ScopeCache {
  records: MemoryRecord[];
  tokenized: string[][];
  idf: Map<string, number>;
  norms: Map<string, number>;
}

export class MemoryStore {
  private lancedb: LanceModule | null = null;
  private connection: LanceConnection | null = null;
  private table: LanceTable | null = null;
  private eventTable: LanceTable | null = null;
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
        schemaVersion: 1,
        embeddingModel: "bootstrap",
        vectorDim,
        metadataJson: "{}",
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

    await this.ensureIndexes();
  }

  async put(record: MemoryRecord): Promise<void> {
    const table = this.requireTable();
    await table.add([record]);
    this.invalidateScope(record.scope);
  }

  async putEvent(event: MemoryEffectivenessEvent): Promise<void> {
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

    const candidates = cached.records
      .filter((record) => params.queryVector.length === 0 || record.vector.length === params.queryVector.length)
      .map((record, index) => {
        const recordNorm = cached.norms.get(record.id) ?? vecNorm(record.vector);
        const vectorScore = useVectorChannel ? fastCosine(params.queryVector, record.vector, queryNorm, recordNorm) : 0;
        const bm25Score = useBm25Channel ? bm25LikeScore(queryTokens, cached.tokenized[index], cached.idf) : 0;
        return { record, vectorScore, bm25Score };
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
        const score = rrfScore * recencyFactor * importanceFactor;
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
    const match = rows.find((row) => row.id === id);
    if (!match) return false;
    await this.requireTable().delete(`id = '${escapeSql(match.id)}'`);
    this.invalidateScope(match.scope);
    return true;
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

  async pruneScope(scope: string, maxEntries: number): Promise<number> {
    const rows = await this.list(scope, 100000);
    if (rows.length <= maxEntries) return 0;
    const toDelete = rows.slice(maxEntries);
    for (const row of toDelete) {
      await this.requireTable().delete(`id = '${escapeSql(row.id)}'`);
    }
    this.invalidateScope(scope);
    return toDelete.length;
  }

  async countIncompatibleVectors(scopes: string[], expectedDim: number): Promise<number> {
    const rows = await this.readByScopes(scopes);
    return rows.filter((row) => row.vectorDim !== expectedDim).length;
  }

  async hasMemory(id: string, scopes: string[]): Promise<boolean> {
    const rows = await this.readByScopes(scopes);
    return rows.some((row) => row.id === id);
  }

  async listEvents(scopes: string[], limit: number): Promise<MemoryEffectivenessEvent[]> {
    const rows = await this.readEventsByScopes(scopes);
    return rows.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  async summarizeEvents(scope: string, includeGlobalScope: boolean): Promise<EffectivenessSummary> {
    const scopes = includeGlobalScope && scope !== "global" ? [scope, "global"] : [scope];
    const events = await this.readEventsByScopes(scopes);

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

  private async readEventsByScopes(scopes: string[]): Promise<MemoryEffectivenessEvent[]> {
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
      ])
      .limit(100000)
      .toArray();

    return rows
      .map((row) => normalizeEventRow(row))
      .filter((row): row is MemoryEffectivenessEvent => row !== null);
  }

  private async readByScopes(scopes: string[]): Promise<MemoryRecord[]> {
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
        "schemaVersion",
        "embeddingModel",
        "vectorDim",
        "metadataJson",
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
}

function normalizeRow(row: Record<string, unknown>): MemoryRecord | null {
  const vectorRaw = row.vector;
  const vector =
    Array.isArray(vectorRaw) ? vectorRaw.map((item) => Number(item)) : Array.from((vectorRaw ?? []) as Iterable<number>);

  if (typeof row.id !== "string" || typeof row.text !== "string" || typeof row.scope !== "string") {
    return null;
  }

  return {
    id: row.id,
    text: row.text,
    vector,
    category: (row.category as MemoryRecord["category"]) ?? "other",
    scope: row.scope,
    importance: Number(row.importance ?? 0.5),
    timestamp: Number(row.timestamp ?? Date.now()),
    schemaVersion: Number(row.schemaVersion ?? 1),
    embeddingModel: String(row.embeddingModel ?? "unknown"),
    vectorDim: Number(row.vectorDim ?? vector.length),
    metadataJson: String(row.metadataJson ?? "{}"),
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
    return {
      ...base,
      type: "feedback",
      feedbackType: row.feedbackType === "missing" || row.feedbackType === "wrong" ? row.feedbackType : "useful",
      helpful: helpfulValue < 0 ? undefined : helpfulValue === 1,
      labels: Array.isArray(labels) ? labels.filter((item): item is string => typeof item === "string") : [],
      reason: typeof row.reason === "string" && row.reason.length > 0 ? row.reason : undefined,
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
