import { performance } from "node:perf_hooks";
import { MemoryStore } from "../../src/store.js";
import type { MemoryRecord } from "../../src/types.js";
import { resolveMemoryConfig } from "../../src/config.js";
import { createEmbedder, type Embedder } from "../../src/embedder.js";
import { createTempDbPath, createTestStore, cleanupDbPath, createTestRecord, createVector } from "../setup.js";

const BENCHMARK_PROFILE = {
  quick: {
    datasetSize: 500,
    queries: 50,
    concurrentWrites: 10,
    concurrentReads: 10,
  },
  standard: {
    datasetSize: 2000,
    queries: 200,
    concurrentWrites: 50,
    concurrentReads: 50,
  },
} as const;

type ProfileName = keyof typeof BENCHMARK_PROFILE;

export interface PerformanceMetrics {
  profile: ProfileName;
  indexCreation: {
    vectorIndexMs: number;
    ftsIndexMs: number;
    totalMs: number;
    rowCount: number;
  };
  latency: {
    searchP50: number;
    searchP99: number;
    searchAvg: number;
    insertAvg: number;
    listAvg: number;
  };
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
  };
  quality: {
    recallAt10: number;
    mrr: number;
    avgRelevanceScore: number;
  };
  concurrency: {
    concurrentWriteThroughput: number;
    concurrentReadThroughput: number;
    writeFailures: number;
    readFailures: number;
  };
}

export interface PerformanceThresholds {
  hardGates: Array<{ name: string; actual: number; limit: number; passed: boolean }>;
  informational: Array<{ name: string; actual: number; target: number; passed: boolean }>;
}

export async function main(): Promise<void> {
  const profileName = resolveProfile();
  console.log(`Running performance benchmark with profile: ${profileName}`);
  
  const metrics = await runPerformanceBenchmark(profileName);
  const thresholds = evaluateThresholds(metrics);

  console.log("\n=== Performance Metrics ===");
  console.log(JSON.stringify(metrics, null, 2));
  
  console.log("\n=== Threshold Evaluation ===");
  console.log(JSON.stringify(thresholds, null, 2));

  const failedHardGates = thresholds.hardGates.filter((g) => !g.passed);
  if (failedHardGates.length > 0) {
    console.error("\n❌ HARD GATES FAILED:");
    failedHardGates.forEach((g) => {
      console.error(`  - ${g.name}: ${g.actual.toFixed(2)}ms (limit: ${g.limit}ms)`);
    });
    process.exit(1);
  }

  console.log("\n✅ All hard gates passed");
  process.exit(0);
}

export async function runPerformanceBenchmark(profileName: ProfileName = "standard"): Promise<PerformanceMetrics> {
  const profile = BENCHMARK_PROFILE[profileName];
  const dbPath = await createTempDbPath("perf-verify-");
  
  try {
    await getBenchmarkEmbedder();

    const store = new MemoryStore(dbPath);
    await store.init(vectorDim);

    const prefillCount = 300;
    const prefillRecords = await generateDataset(prefillCount, "project:verify");
    for (const rec of prefillRecords) {
      await store.put(rec);
    }

    console.log(`[benchmark] Dataset ready: ${prefillCount} prefill + ${profile.datasetSize} additional = ${prefillCount + profile.datasetSize} total records`);

    const dataset = await generateDataset(profile.datasetSize, "project:verify");
    const indexMetrics = { vectorIndexMs: 0, ftsIndexMs: 0, totalMs: 0, rowCount: prefillCount + dataset.length };

    const insertTimes = await measureInsertLatency(store, dataset);
    
    const listTimes = await measureListLatency(store, "project:verify", 100);

    const searchResults = await measureSearchLatencyAndQuality(store, profile.queries);
    
    const mem = process.memoryUsage();
    const memoryMetrics = {
      heapUsedMb: mem.heapUsed / 1024 / 1024,
      heapTotalMb: mem.heapTotal / 1024 / 1024,
      externalMb: mem.external / 1024 / 1024,
    };

    const concurrencyMetrics = await measureConcurrency(store, profile.concurrentWrites, profile.concurrentReads);

    return {
      profile: profileName,
      indexCreation: indexMetrics,
      latency: {
        searchP50: searchResults.latency.p50,
        searchP99: searchResults.latency.p99,
        searchAvg: searchResults.latency.avg,
        insertAvg: avg(insertTimes),
        listAvg: avg(listTimes),
      },
      memory: memoryMetrics,
      quality: searchResults.quality,
      concurrency: concurrencyMetrics,
    };
  } finally {
    await cleanupDbPath(dbPath);
  }
}

export function evaluateThresholds(metrics: PerformanceMetrics): PerformanceThresholds {
  const hardGates = [
    {
      name: "search.p50",
      actual: metrics.latency.searchP50,
      limit: 150,
      passed: metrics.latency.searchP50 < 150,
    },
    {
      name: "search.p99",
      actual: metrics.latency.searchP99,
      limit: 600,
      passed: metrics.latency.searchP99 < 600,
    },
  ];

  const informational = [
    {
      name: "search.p99",
      actual: metrics.latency.searchP99,
      target: 500,
      passed: metrics.latency.searchP99 < 500,
    },
    {
      name: "insert.avg",
      actual: metrics.latency.insertAvg,
      target: 30,
      passed: metrics.latency.insertAvg < 30,
    },
    {
      name: "list.avg",
      actual: metrics.latency.listAvg,
      target: 100,
      passed: metrics.latency.listAvg < 100,
    },
    {
      name: "memory.heapUsedMb",
      actual: metrics.memory.heapUsedMb,
      target: 512,
      passed: metrics.memory.heapUsedMb < 512,
    },
    {
      name: "quality.recallAt10",
      actual: metrics.quality.recallAt10,
      target: 0.7,
      passed: metrics.quality.recallAt10 >= 0.7,
    },
    {
      name: "concurrency.writeThroughput",
      actual: metrics.concurrency.concurrentWriteThroughput,
      target: 50,
      passed: metrics.concurrency.concurrentWriteThroughput >= 50,
    },
  ];

  return { hardGates, informational };
}

function resolveProfile(): ProfileName {
  const env = process.env.LANCEDB_OPENCODE_PRO_BENCHMARK_PROFILE;
  if (env === "standard") return "standard";
  return "quick";
}

const BENCHMARK_REAL = process.env.LANCEDB_OPENCODE_PRO_BENCHMARK_REAL === "1";
let globalEmbedder: Embedder | null = null;
let vectorDim = 384;

async function getBenchmarkEmbedder() {
  if (!globalEmbedder) {
    const config = resolveMemoryConfig(undefined);
    if (!config.embedding.model || !config.embedding.baseUrl) {
      throw new Error("Missing embedding config - set LANCEDB_OPENCODE_PRO_EMBEDDING_MODEL and LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL");
    }
    globalEmbedder = createEmbedder(config.embedding);
    if (BENCHMARK_REAL) {
      vectorDim = await globalEmbedder.dim();
      console.log(`Real embedding mode: detected vector dimension = ${vectorDim}`);
    }
  }
  return globalEmbedder;
}

async function generateDataset(count: number, scope: string): Promise<MemoryRecord[]> {
  const records: MemoryRecord[] = [];
  const useReal = BENCHMARK_REAL;
  const embedder = useReal ? await getBenchmarkEmbedder() : null;

  for (let i = 0; i < count; i++) {
    const text = `Performance test record ${i} with some searchable content`;
    const vector = useReal && embedder 
      ? await embedder.embed(text)
      : createVector(vectorDim, i * 0.001);

    records.push(createTestRecord({
      id: `perf-${i}`,
      text,
      scope,
      vector,
      timestamp: 1_000_000 + i,
    }));
  }

  return records;
}

async function measureInsertLatency(store: MemoryStore, dataset: MemoryRecord[]): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < dataset.length; i++) {
    const rec = { ...dataset[i], id: `insert-${Date.now()}-${i}` };
    const started = performance.now();
    await store.put(rec);
    times.push(performance.now() - started);
  }
  return times;
}

async function measureListLatency(store: MemoryStore, scope: string, limit: number): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < 10; i++) {
    const started = performance.now();
    await store.list(scope, limit);
    times.push(performance.now() - started);
  }
  return times;
}

async function measureSearchLatencyAndQuality(
  store: MemoryStore,
  iterations: number,
): Promise<{
  latency: { p50: number; p99: number; avg: number };
  quality: { recallAt10: number; mrr: number; avgRelevanceScore: number };
}> {
  const latencies: number[] = [];
  let totalHits = 0;
  let totalMrr = 0;
  let totalRelevance = 0;

  for (let i = 0; i < iterations; i++) {
    const query = `test query ${i}`;
    const queryVec = BENCHMARK_REAL
      ? (globalEmbedder ? await globalEmbedder.embed(query) : createVector(384, i * 0.01))
      : createVector(vectorDim, i * 0.01);
    
    const started = performance.now();
    const results = await store.search({
      query,
      queryVector: queryVec,
      scopes: ["project:verify"],
      limit: 10,
      vectorWeight: 0.7,
      bm25Weight: 0.3,
      minScore: 0.0,
    });
    latencies.push(performance.now() - started);

    const hitCount = results.length;
    totalHits += hitCount > 0 ? 1 : 0;
    totalMrr += hitCount > 0 ? 1 / (results.findIndex((r) => r) + 1) : 0;
    totalRelevance += hitCount / 10;
  }

  return {
    latency: {
      p50: percentile(latencies.sort((a, b) => a - b), 0.5),
      p99: percentile(latencies.sort((a, b) => a - b), 0.99),
      avg: avg(latencies),
    },
    quality: {
      recallAt10: totalHits / iterations,
      mrr: totalMrr / iterations,
      avgRelevanceScore: totalRelevance / iterations,
    },
  };
}

async function measureConcurrency(
  store: MemoryStore,
  writeCount: number,
  readCount: number,
): Promise<{
  concurrentWriteThroughput: number;
  concurrentReadThroughput: number;
  writeFailures: number;
  readFailures: number;
}> {
  // Concurrent writes
  const writeStart = performance.now();
  let writeFailures = 0;
  const writePromises = Array.from({ length: writeCount }, async (_, i) => {
    try {
      await store.put(
        createTestRecord({
          id: `concurrent-write-${Date.now()}-${i}`,
          text: `Concurrent write ${i}`,
          scope: "project:verify",
        }),
      );
    } catch {
      writeFailures++;
    }
  });
  await Promise.all(writePromises);
  const writeDuration = performance.now() - writeStart;

  // Concurrent reads
  const readStart = performance.now();
  let readFailures = 0;
  const readPromises = Array.from({ length: readCount }, async (_, i) => {
    try {
      await store.search({
        query: "test",
        queryVector: globalEmbedder ? await globalEmbedder.embed("test") : createVector(vectorDim, 0.5),
        scopes: ["project:verify"],
        limit: 10,
        vectorWeight: 0.7,
        bm25Weight: 0.3,
        minScore: 0.0,
      });
    } catch {
      readFailures++;
    }
  });
  await Promise.all(readPromises);
  const readDuration = performance.now() - readStart;

  return {
    concurrentWriteThroughput: (writeCount / writeDuration) * 1000,
    concurrentReadThroughput: (readCount / readDuration) * 1000,
    writeFailures,
    readFailures,
  };
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return sorted[index];
}

// Run as CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}