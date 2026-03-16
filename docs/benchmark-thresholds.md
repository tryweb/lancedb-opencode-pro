# Benchmark Thresholds

This document defines the initial latency threshold policy for `lancedb-opencode-pro` validation.

## Hard Gates

These thresholds fail `npm run benchmark:latency` when exceeded.

- `search.p50 < 100ms`
- `search.p99 < 500ms`

Reasoning:

- These two values match the existing guidance in `docs/validation-priority-summary.md` and `docs/memory-validation-checklist.md`.
- Search responsiveness is the most user-visible benchmark in the current release scope.

## Informational Metrics

These values are reported in the benchmark output but do not fail the command in the current release workflow.

- `insert.avg < 50ms`
- `list.avg < 200ms`

Reasoning:

- Insert and scope-list timings are useful operational signals, but the current project phase prioritizes search responsiveness as the release gate.
- These values should still be reviewed and can be promoted to hard gates in a later release once the benchmark becomes more stable across environments.

## Benchmark Profile

- Default `release` profile:
  - Search benchmark: `200` searches on `1000` records
  - Insert benchmark: `100` sequential inserts
  - Scope listing benchmark: `10` list operations at limit `1000`
- Optional `full` profile:
  - Search benchmark: `1000` searches on `10000` records
  - Insert benchmark: `100` sequential inserts
  - Scope listing benchmark: `10` list operations at limit `1000`

Reasoning:

- The `release` profile is the default hard-gate workflow because it is fast enough to run consistently in local and containerized validation.
- The `full` profile remains available for deeper profiling and capacity analysis without making everyday release checks impractical.

## Execution

Use the supported Docker workflow:

```bash
docker compose build --no-cache && docker compose up -d
docker compose exec app npm run benchmark:latency
```

To run the larger profiling mode:

```bash
docker compose exec app sh -lc 'LANCEDB_OPENCODE_PRO_BENCHMARK_PROFILE=full npm run benchmark:latency'
```
