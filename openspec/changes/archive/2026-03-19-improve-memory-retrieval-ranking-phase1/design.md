## Context

The retrieval path currently ranks memories using a weighted sum of cosine similarity and BM25-like score, then applies a minimum score threshold. This is simple but sensitive to score-scale drift across lexical and semantic channels. The data model already stores `timestamp` and `importance`, but ranking does not currently consume either field. We need a low-risk phase-1 ranking upgrade that improves result ordering without introducing external reranker dependencies or changing storage backend.

## Goals / Non-Goals

**Goals:**
- Replace weighted-sum fusion with rank-based RRF fusion for vector and BM25 retrieval channels.
- Apply recency and importance factors as final ranking boosts with configurable controls.
- Preserve current operational behavior (scope filtering, min-score safety, graceful embedding fallback).
- Keep implementation lightweight and testable in current TypeScript/LanceDB architecture.

**Non-Goals:**
- Introducing cross-encoder reranking or external reranker APIs.
- Adding MMR diversity selection in this phase.
- Redesigning memory extraction, storage schema, or lifecycle event model.
- Migrating retrieval to a new storage engine.

## Decisions

### Decision: Use RRF for channel fusion instead of weighted score sum
We will compute independent rankings for vector score and BM25 score, then combine ranks with RRF:

`rrfScore = 1 / (k + rankVector) + 1 / (k + rankBm25)`

where `k` defaults to `60` and is configurable.

Rationale:
- Rank-based fusion is robust to score-range mismatch between cosine and BM25 channels.
- It is computationally cheap and deterministic.
- It avoids fragile per-channel score calibration.

Alternatives considered:
- Keep weighted-sum fusion and tune weights: rejected for scale-sensitivity and lower robustness under mixed query styles.

### Decision: Apply recency boost as multiplicative time decay
Final score will multiply by a recency factor computed from memory age and configurable half-life hours.

Rationale:
- Multiplicative boost preserves base relevance ordering while preferring fresher memories.
- Half-life parameter is interpretable and stable for operators.

Alternatives considered:
- Additive recency bonus: rejected because it can over-promote weakly relevant recent memories.

### Decision: Apply importance weighting as multiplicative factor
Final score will multiply by an importance-based factor controlled by `importanceWeight`.

Rationale:
- Importance is already captured at write time and should influence recall ranking.
- Multiplicative weighting stays bounded and composes cleanly with recency.

Alternatives considered:
- Hard filter by minimum importance: rejected because it can suppress useful low-importance records.

### Decision: Keep existing minScore and scope safety filters
The retrieval pipeline will preserve dimension-compatibility filtering, scope filtering, and minimum score threshold behavior.

Rationale:
- These guards are already production-proven and required by existing specs.
- Phase-1 should improve ranking quality without reducing retrieval safety.

## Risks / Trade-offs

- [RRF may change ranking order for known prompts] -> Mitigation: add deterministic regression tests with fixed fixtures for rank expectations.
- [Recency decay may over-prioritize fresh but less relevant memories] -> Mitigation: expose half-life config and keep conservative default.
- [Importance weighting may amplify noisy extraction labels] -> Mitigation: keep default weight moderate and validate with retrieval tests.
- [New config knobs increase operator complexity] -> Mitigation: provide safe defaults and backward-compatible behavior when omitted.

## Migration Plan

1. Add retrieval phase-1 config fields with defaults in runtime config resolution.
2. Implement RRF + recency + importance scoring in store search path.
3. Update tests to assert new ranking behavior and default compatibility.
4. Run existing verification and retrieval workflows in Docker environment.
5. Keep rollback path by disabling recency/importance via config and retaining deterministic RRF default.

## Open Questions

- Should recency decay apply uniformly across all categories, or should `decision` memories decay slower in a future phase?
- Should phase-2 add cross-encoder reranking only for top-N candidates behind a separate mode flag?
