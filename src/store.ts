import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { MemoryRecord, SearchResult } from "./types.js";
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

    await this.ensureIndexes();
  }

  async put(record: MemoryRecord): Promise<void> {
    const table = this.requireTable();
    await table.add([record]);
    this.invalidateScope(record.scope);
  }

  async search(params: {
    query: string;
    queryVector: number[];
    scopes: string[];
    limit: number;
    vectorWeight: number;
    bm25Weight: number;
    minScore: number;
  }): Promise<SearchResult[]> {
    const cached = await this.getCachedScopes(params.scopes);
    if (cached.records.length === 0) return [];

    const queryTokens = tokenize(params.query);

    const queryNorm = vecNorm(params.queryVector);

    const scored = cached.records
      .filter((record) => params.queryVector.length === 0 || record.vector.length === params.queryVector.length)
      .map((record, index) => {
        const recordNorm = cached.norms.get(record.id) ?? vecNorm(record.vector);
        const vectorScore = fastCosine(params.queryVector, record.vector, queryNorm, recordNorm);
        const bm25Score = bm25LikeScore(queryTokens, cached.tokenized[index], cached.idf);
        const score = params.vectorWeight * vectorScore + params.bm25Weight * bm25Score;
        return { record, score, vectorScore, bm25Score };
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

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
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
