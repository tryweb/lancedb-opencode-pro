# Design: Complete Episodic Learning Hook Wiring + Tools Exposure

## Context

Building on the archived episodic learning specs, this change completes implementation by wiring hooks and exposing tools.

## Decisions

### Decision: Hook Architecture

| Event | Action | Store Method |
|-------|--------|--------------|
| `session.start` | Create new task episode | `createTaskEpisode()` |
| `tool.*` | Record command execution | `addCommandToEpisode()` |
| Validation events | Parse and store outcome | `addValidationOutcome()` + `classifyFailure()` |
| `session.end` | Finalize episode state | `updateTaskState()` |
| `session.idle` | Extract patterns + recall | `extractSuccessPatternsFromScope()` + `findSimilarTasks()` |

**Rationale**: Matches existing event pipeline pattern in index.ts

### Decision: Tool Surface

| Tool Name | Purpose | Store Method |
|-----------|---------|---------------|
| `task_episode_create` | Manual episode creation | `createTaskEpisode()` |
| `task_episode_query` | Query episodes by scope/state | `queryTaskEpisodes()` |
| `similar_task_recall` | Find similar past tasks | `findSimilarTasks()` |
| `retry_budget_suggest` | Get retry budget suggestion | `suggestRetryBudget()` |
| `recovery_strategy_suggest` | Get recovery strategies | `suggestRecoveryStrategies()` |

**Rationale**: Consistent naming with existing memory_* tools

### Decision: Vector Similarity

- Upgrade `findSimilarTasks()` to use embedder for vector search
- Fall back to keyword matching if embedding unavailable

**Rationale**: Better semantic matching for task similarity

## Data Flow

```
User Task → session.start → createTaskEpisode()
                ↓
          tool execution → addCommandToEpisode()
                ↓
          validation → addValidationOutcome() + classifyFailure()
                ↓
          session.end → updateTaskState() + addSuccessPatterns()
                ↓
          session.idle → extractSuccessPatternsFromScope()
                           findSimilarTasks() → inject into system prompt
```

## Risks / Trade-offs

- [Risk] Hook overhead → **Mitigation**: Async execution, error handling with logging
- [Risk] Episode storage growth → **Mitigation**: TTL or manual cleanup (future)
- [Risk] Embedding unavailability → **Mitigation**: Fall back to keyword matching
