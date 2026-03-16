export function calculateRecallAtK(retrievedIds: string[], groundTruth: string[], k: number): number {
  const relevant = new Set(groundTruth);
  const topK = retrievedIds.slice(0, k);
  const hits = topK.filter((id) => relevant.has(id)).length;
  return hits / Math.min(k, groundTruth.length);
}

export function calculateRobustness(recalls: number[], delta: number): number {
  if (recalls.length === 0) return 0;
  const passing = recalls.filter((recall) => recall >= delta).length;
  return passing / recalls.length;
}

export function summarizeRetrievalMetrics(recalls: number[], delta: number) {
  const avgRecall = recalls.length === 0 ? 0 : recalls.reduce((sum, value) => sum + value, 0) / recalls.length;
  return {
    avgRecall,
    robustness: calculateRobustness(recalls, delta),
    totalQueries: recalls.length,
  };
}
