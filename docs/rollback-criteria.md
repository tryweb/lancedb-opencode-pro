# Rollback Criteria And Diagnostics

Rollback by disabling provider in `opencode.json` when any of the following is true:

- Retrieval causes prompt contamination (memory injection overrides user intent).
- Scope filtering leaks memories across project boundaries.
- Embedding backend instability causes repeated hook failures.
- Index creation fails and operational warnings exceed acceptable threshold.

## Rollback Procedure

1. Set `memory.provider` to a different provider or remove `memory` block.
2. Restart OpenCode session.
3. Preserve local DB files under `~/.opencode/memory/lancedb` for later analysis.

## Operator Diagnostics

- Run `memory_stats` to inspect index health and active configuration.
- Run `memory_search` with a known prior phrase to verify recall behavior.
- Run `memory_clear` with `confirm=true` only when decommissioning a scope.
