## 1. Spec And Interface Foundation

- [x] 1.1 Define provider package boundaries and public configuration contract (`memory.provider`, `dbPath`, `embedding`, `retrieval`).
- [x] 1.2 Define validation rules and defaulting logic for missing retrieval and path fields.
- [x] 1.3 Define schema metadata fields for compatibility (`schemaVersion`, `embeddingModel`, `vectorDim`).

## 2. Storage And Retrieval Core

- [x] 2.1 Define LanceDB table layout, index requirements (vector + BM25/FTS), and fallback path behavior.
- [x] 2.2 Define hybrid ranking flow with configurable vector/BM25 weights and tie-breaking policy.
- [x] 2.3 Define retrieval degradation behavior for component failures (BM25 unavailable, embedding backend unavailable).

## 3. Lifecycle Integration

- [x] 3.1 Define OpenCode lifecycle adapter points for auto-capture at end-of-turn/session equivalent events.
- [x] 3.2 Define memory context injection stage and formatting constraints to avoid overriding user intent.
- [x] 3.3 Define eligibility rules for what qualifies as durable memory from a session.

## 4. Project Scope Isolation

- [x] 4.1 Define project scope derivation strategy using git/worktree identity and fallback behavior.
- [x] 4.2 Define retrieval scope filter policy (active scope + allowed shared scopes only).
- [x] 4.3 Define write-path default scope policy and global-scope opt-in conditions.

## 5. Management Commands And Safety

- [x] 5.1 Define command/tool contract for memory search output shape and filters.
- [x] 5.2 Define command/tool contract for targeted delete by id.
- [x] 5.3 Define command/tool contract for scope clear with required safety confirmation.

## 6. Operations And Migration

- [x] 6.1 Define migration behavior for embedding model changes and vector dimension mismatches.
- [x] 6.2 Define index health checks and stale-index recovery strategy.
- [x] 6.3 Define retention and maintenance strategy for long-running local databases.

## 7. Verification Criteria

- [x] 7.1 Validate change artifacts against OpenSpec schema and requirement formatting.
- [x] 7.2 Define acceptance checklist covering daily workflow scenarios (auto-capture, bug recall, project switch, command maintenance).
- [x] 7.3 Define rollback criteria and operator-facing failure diagnostics.
