## ADDED Requirements

### Requirement: task_episode_create tool
The system SHALL provide a tool to manually create task episode records.

#### Runtime Surface
- Surface: opencode-tool
- Entrypoint: src/index.ts → tool "task_episode_create"

#### Scenario: Create episode manually
- **WHEN** user calls `task_episode_create` with taskId, scope, and initial state
- **THEN** new episode record is created with provided fields
- **AND** episode ID is returned

#### Tool Schema
```typescript
{
  taskId: string,
  scope: string,
  initialState: "pending" | "running"
}
```

---

### Requirement: task_episode_query tool
The system SHALL provide a tool to query task episodes by scope and state.

#### Runtime Surface
- Surface: opencode-tool
- Entrypoint: src/index.ts → tool "task_episode_query"

#### Scenario: Query episodes
- **WHEN** user calls `task_episode_query` with optional scope and state filters
- **THEN** matching episode records are returned
- **AND** results include episode ID, task ID, state, timestamps

#### Tool Schema
```typescript
{
  scope?: string,
  state?: "pending" | "running" | "success" | "failed" | "timeout",
  limit?: number (default: 10)
}
```

---

### Requirement: similar_task_recall tool
The system SHALL provide a tool to find similar past tasks using vector similarity.

#### Runtime Surface
- Surface: opencode-tool
- Entrypoint: src/index.ts → tool "similar_task_recall"

#### Scenario: Find similar tasks
- **WHEN** user calls `similar_task_recall` with query and threshold
- **THEN** similar episodes are retrieved using vector search
- **AND** results include commands, validation outcomes, final state

#### Tool Schema
```typescript
{
  query: string,
  threshold?: number (default: 0.85),
  limit?: number (default: 3)
}
```

---

### Requirement: retry_budget_suggest tool
The system SHALL provide a tool to suggest retry budgets based on historical data.

#### Runtime Surface
- Surface: opencode-tool
- Entrypoint: src/index.ts → tool "retry_budget_suggest"

#### Scenario: Get retry budget
- **WHEN** user calls `retry_budget_suggest` with error type
- **THEN** median-based retry budget is suggested
- **AND** stop conditions are provided if all retries failed historically

#### Tool Schema
```typescript
{
  errorType: "syntax" | "runtime" | "logic" | "resource" | "unknown",
  minSamples?: number (default: 3)
}
```

---

### Requirement: recovery_strategy_suggest tool
The system SHALL provide a tool to suggest recovery strategies after failures.

#### Runtime Surface
- Surface: opencode-tool
- Entrypoint: src/index.ts → tool "recovery_strategy_suggest"

#### Scenario: Get recovery strategies
- **WHEN** user calls `recovery_strategy_suggest` with failure context
- **THEN** fallback and backoff strategies are suggested
- **AND** confidence scores are provided for each strategy

#### Tool Schema
```typescript
{
  failureType: "syntax" | "runtime" | "logic" | "resource" | "unknown",
  previousAttempts?: number
}
```
