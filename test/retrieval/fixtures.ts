import type { MemoryRecord } from "../../src/types.js";
import { createTestRecord } from "../setup.js";

const VECTOR_DIM = 384;
const RECORDS_PER_TOPIC = 10;
const QUERY_COUNT_PER_TOPIC = 10;
const DEFAULT_SCOPE = "project:retrieval";

const TOPICS = [
  "nginx proxy buffers",
  "docker layer caching",
  "postgres connection pooling",
  "react render memoization",
  "typescript discriminated unions",
  "redis cache invalidation",
  "kubernetes rollout health",
  "python asyncio backpressure",
  "terraform remote state locking",
  "graphql resolver batching",
] as const;

export interface RetrievalQuery {
  id: string;
  text: string;
  vector: number[];
  groundTruth: string[];
}

export interface RetrievalFixture {
  scope: string;
  dataset: MemoryRecord[];
  queries: RetrievalQuery[];
}

export function createRetrievalFixture(
  scope = DEFAULT_SCOPE,
  options?: {
    recordsPerTopic?: number;
    queriesPerTopic?: number;
  },
): RetrievalFixture {
  const recordsPerTopic = options?.recordsPerTopic ?? RECORDS_PER_TOPIC;
  const queriesPerTopic = options?.queriesPerTopic ?? QUERY_COUNT_PER_TOPIC;
  const dataset: MemoryRecord[] = [];
  const queries: RetrievalQuery[] = [];

  TOPICS.forEach((topic, topicIndex) => {
    const topicVector = createTopicVector(topicIndex, VECTOR_DIM);
    const topicRecords = Array.from({ length: recordsPerTopic }, (_, recordIndex) =>
      createTestRecord({
        id: `${slugify(topic)}-record-${recordIndex}`,
        text: `${topic} guide ${recordIndex} durable fix reference`,
        scope,
        vector: topicVector,
        vectorDim: topicVector.length,
        timestamp: topicIndex * 1_000 + recordIndex,
        metadataJson: JSON.stringify({ topic, recordIndex }),
      }),
    );

    dataset.push(...topicRecords);

    const groundTruth = topicRecords.slice(0, Math.min(10, topicRecords.length)).map((record) => record.id);
    for (let queryIndex = 0; queryIndex < queriesPerTopic; queryIndex += 1) {
      queries.push({
        id: `${slugify(topic)}-query-${queryIndex}`,
        text: topic,
        vector: topicVector,
        groundTruth,
      });
    }
  });

  return { scope, dataset, queries };
}

export function createBenchmarkFixture(
  scope = "project:benchmark",
  options?: {
    recordsPerTopic?: number;
    queriesPerTopic?: number;
  },
): RetrievalFixture {
  return createRetrievalFixture(scope, {
    recordsPerTopic: options?.recordsPerTopic ?? 1000,
    queriesPerTopic: options?.queriesPerTopic ?? 100,
  });
}

function createTopicVector(topicIndex: number, dim: number): number[] {
  const vector = new Array<number>(dim).fill(0);
  const primary = topicIndex * 3;
  vector[primary] = 1;
  vector[primary + 1] = 0.5;
  vector[primary + 2] = 0.25;
  return vector;
}

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
