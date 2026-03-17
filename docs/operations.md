# Operations

## Embedding Model Migration Behavior

- Records persist `schemaVersion`, `embeddingModel`, and `vectorDim`.
- On startup, the store initializes against the configured embedding dimension.
- Query-time vector similarity is only meaningful when query vector dimension matches record vector dimension.
- If embedding backend is unavailable, retrieval degrades to lexical scoring only.

## Index Health And Stale Recovery

- Store exposes index status via `memory_stats`.
- Vector index creation is best effort; if unavailable, retrieval still works with in-process scoring.
- FTS index creation is best effort; if unavailable, lexical fallback is used.

## Retention Strategy

- Auto-capture writes into active project scope by default.
- Scope retention is count-based (`maxEntriesPerScope`, default `3000`).
- After each auto-capture write, older entries in the same scope are pruned.

## Effectiveness Reporting

- Runtime effectiveness events are stored in the same LanceDB database as memories under a dedicated events table.
- Capture flow records considered, stored, and skipped outcomes with normalized skip reasons when the store is initialized.
- Recall flow records request count, result count, and whether optional memory context was injected.
- User feedback is recorded through `memory_feedback_missing`, `memory_feedback_wrong`, and `memory_feedback_useful`.
- Operators can inspect the aggregated machine-readable summary with `memory_effectiveness` for the active project scope.

### Example Workflow

```text
memory_search query="stale token api gateway" limit=5
memory_feedback_useful id="<memory-id>" helpful=true
memory_feedback_missing text="This project prefers blue-green deploys." labels=["preference"]
memory_effectiveness
```

Expected summary fields:

- `capture.considered`, `capture.stored`, `capture.skipped`
- `capture.skipReasons`
- `recall.requested`, `recall.returnedResults`, `recall.injected`
- `feedback.missing`, `feedback.wrong`, `feedback.useful`
- `feedback.falsePositiveRate`, `feedback.falseNegativeRate`
