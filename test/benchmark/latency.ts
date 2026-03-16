import { performance } from "node:perf_hooks";
import { createBenchmarkFixture } from "../retrieval/fixtures.js";
import { cleanupDbPath, createTestStore, createTestRecord, createVector } from "../setup.js";

const BENCHMARK_PROFILES = {
  release: {
    recordsPerTopic: 100,
    queriesPerTopic: 20,
    searchIterations: 200,
    insertIterations: 100,
    listLimit: 1000,
    listIterations: 10,
  },
  full: {
    recordsPerTopic: 1000,
    queriesPerTopic: 100,
    searchIterations: 1000,
    insertIterations: 100,
    listLimit: 1000,
    listIterations: 10,
  },
} as const;

type BenchmarkProfileName = keyof typeof BENCHMARK_PROFILES;

export interface LatencyMetrics {
  profile: BenchmarkProfileName;
  search: { p50: number; p99: number; avg: number; iterations: number; datasetSize: number };
  insert: { avg: number; iterations: number };
  list: { avg: number; iterations: number; limit: number };
}

export interface LatencyThresholdSummary {
  hardGates: Array<{ name: string; actual: number; limit: number; passed: boolean }>;
  informational: Array<{ name: string; actual: number; target: number; passed: boolean }>;
}

export async function runLatencyBenchmark(profile: BenchmarkProfileName = resolveProfile()): Promise<LatencyMetrics> {
  const { store, dbPath } = await createTestStore();
  const config = BENCHMARK_PROFILES[profile];
  const fixture = createBenchmarkFixture("project:benchmark", {
    recordsPerTopic: config.recordsPerTopic,
    queriesPerTopic: config.queriesPerTopic,
  });

  try {
    for (const record of fixture.dataset) {
      await store.put(record);
    }

    const searchTimes = await measureIterations(config.searchIterations, async (iteration) => {
      const query = fixture.queries[iteration % fixture.queries.length];
      await store.search({
        query: query.text,
        queryVector: query.vector,
        scopes: [fixture.scope],
        limit: 10,
        vectorWeight: 0.7,
        bm25Weight: 0.3,
        minScore: 0.01,
      });
    });

    const insertTimes = await measureIterations(config.insertIterations, async (iteration) => {
      await store.put(
        createTestRecord({
          id: `benchmark-insert-${iteration}`,
          text: `insert benchmark record ${iteration}`,
          scope: fixture.scope,
          timestamp: 10_000_000 + iteration,
          vector: createVector(384, 0.6 + iteration * 0.0001),
        }),
      );
    });

    const listTimes = await measureIterations(config.listIterations, async () => {
      await store.list(fixture.scope, config.listLimit);
    });

    return {
      profile,
      search: {
        ...summarize(searchTimes),
        iterations: config.searchIterations,
        datasetSize: fixture.dataset.length,
      },
      insert: {
        avg: summarize(insertTimes).avg,
        iterations: config.insertIterations,
      },
      list: {
        avg: summarize(listTimes).avg,
        iterations: config.listIterations,
        limit: config.listLimit,
      },
    };
  } finally {
    await cleanupDbPath(dbPath);
  }
}

export function evaluateLatencyThresholds(metrics: LatencyMetrics): LatencyThresholdSummary {
  const hardGates = [
    {
      name: "search.p50",
      actual: metrics.search.p50,
      limit: 100,
      passed: metrics.search.p50 < 100,
    },
    {
      name: "search.p99",
      actual: metrics.search.p99,
      limit: 500,
      passed: metrics.search.p99 < 500,
    },
  ];

  const informational = [
    {
      name: "insert.avg",
      actual: metrics.insert.avg,
      target: 50,
      passed: metrics.insert.avg < 50,
    },
    {
      name: "list.avg",
      actual: metrics.list.avg,
      target: 200,
      passed: metrics.list.avg < 200,
    },
  ];

  return { hardGates, informational };
}

export async function main(): Promise<void> {
  const metrics = await runLatencyBenchmark();
  const thresholds = evaluateLatencyThresholds(metrics);

  console.log(JSON.stringify({ metrics, thresholds }, null, 2));

  const failedHardGates = thresholds.hardGates.filter((gate) => !gate.passed);
  if (failedHardGates.length > 0) {
    const summary = failedHardGates.map((gate) => `${gate.name}=${gate.actual.toFixed(2)}ms limit=${gate.limit}ms`).join(", ");
    throw new Error(`Latency hard gates failed: ${summary}`);
  }
}

function resolveProfile(): BenchmarkProfileName {
  return process.env.LANCEDB_OPENCODE_PRO_BENCHMARK_PROFILE === "full" ? "full" : "release";
}

async function measureIterations(iterations: number, fn: (iteration: number) => Promise<void>): Promise<number[]> {
  const times: number[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const started = performance.now();
    await fn(iteration);
    times.push(performance.now() - started);
  }
  return times;
}

function summarize(times: number[]) {
  const sorted = [...times].sort((left, right) => left - right);
  return {
    p50: percentile(sorted, 0.5),
    p99: percentile(sorted, 0.99),
    avg: sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length),
  };
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return sorted[index];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
