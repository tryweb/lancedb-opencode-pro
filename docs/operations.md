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
