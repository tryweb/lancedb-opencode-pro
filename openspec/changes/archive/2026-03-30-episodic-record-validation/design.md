# Design: BL-046 — DB row runtime 型別驗證

## 1. Decision Table

| Decision | Choice | Why | Trade-off |
|---|---|---|---|
| Runtime surface | `internal-api` | Runtime validation of DB reads | Zod adds bundle size; acceptable for plugin |
| Entrypoint | `src/types.ts` → Zod schema + `validateEpisodicRecord()` | Single source of truth for the shape | Schema must stay in sync with TypeScript interface |
| Data model | Zod schema mirrors `EpisodicTaskRecord` interface | One source of truth for both compile-time and runtime types | Two places to update if fields change |
| Failure handling | Throw `ZodError` with context on invalid row | Fail-fast prevents corrupt data propagation | Caller must handle or wrap errors |
| Observability | `ZodError` includes field-level path | Enables precise error diagnosis | Structured error log output |

## 2. Zod Schema Design

```typescript
// src/types.ts (added near EpisodicTaskRecord interface)

// JSON sub-schemas for nested fields
const ValidationOutcomeSchema = z.object({ ... });
const SuccessPatternSchema = z.object({ ... });
const RetryAttemptSchema = z.object({ ... });
const RecoveryStrategySchema = z.object({ ... });

// EpisodicTaskRecord schema
export const EpisodicTaskRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  scope: z.string(),
  taskId: z.string(),
  state: z.enum(["pending", "running", "success", "failed", "abandoned"]),
  startTime: z.number(),
  endTime: z.number().optional(),
  failureType: z.enum(["error", "timeout", "validation", "resource", "unknown"]).optional(),
  errorMessage: z.string().optional(),
  commandsJson: z.string(),  // validated as parseable JSON array
  validationOutcomesJson: z.string(),
  successPatternsJson: z.string(),
  retryAttemptsJson: z.string(),
  recoveryStrategiesJson: z.string(),
  metadataJson: z.string(),
  taskDescriptionVector: z.array(z.number()).optional(),
});

// Parse JSON sub-fields during validation
const parsed = EpisodicTaskRecordSchema.merge(z.object({
  commandsJson: z.string().transform(v => JSON.parse(v)),
  validationOutcomesJson: z.string().transform(v => JSON.parse(v)),
  successPatternsJson: z.string().transform(v => JSON.parse(v)),
  retryAttemptsJson: z.string().transform(v => JSON.parse(v)),
  recoveryStrategiesJson: z.string().transform(v => JSON.parse(v)),
  metadataJson: z.string().transform(v => JSON.parse(v)),
}));
```

## 3. Validation Function Signature

```typescript
// src/types.ts

export function validateEpisodicRecord(raw: unknown): EpisodicTaskRecord {
  const result = EpisodicTaskRecordSchema.parse(raw);
  return result;
}

export function validateEpisodicRecordArray(raw: unknown): EpisodicTaskRecord[] {
  if (!Array.isArray(raw)) throw new ZodError([{ code: 'invalid_type', expected: 'array', received: typeof raw }]);
  return raw.map(validateEpisodicRecord);
}
```

## 4. Cast Site Replacements

Replace each cast site with a validated call:

```typescript
// BEFORE (src/store.ts line 880)
const existing = rows[0] as unknown as EpisodicTaskRecord;

// AFTER
const existing = validateEpisodicRecord(rows[0]);
```

```typescript
// BEFORE (src/store.ts line 914)
return rows as unknown as EpisodicTaskRecord[];

// AFTER
return validateEpisodicRecordArray(rows);
```

All 13 cast sites are in `src/store.ts` (11 sites) and `src/index.ts` (2 sites).

## 5. Operability

### Trigger Path
Every episodic read path goes through one of these:

| Method | Cast count | File |
|--------|-----------|------|
| `updateTaskState` | 1 | store.ts:880 |
| `getTaskEpisode` | 1 | store.ts:900 |
| `queryTaskEpisodes` | 1 | store.ts:914 |
| `addCommandToEpisode` | 1 | store.ts:923 |
| `addValidationOutcome` | 1 | store.ts:942 |
| `addSuccessPatterns` | 1 | store.ts:961 |
| `findSimilarTasks` | 1 | store.ts:983 |
| `queryTaskEpisodes` (failure path) | 1 | store.ts:1028 |
| `addRetryAttempt` | 1 | store.ts:1075 |
| `addRecoveryStrategy` | 1 | store.ts:1097 |
| `suggestRetryBudget` | 1 | store.ts:1117 |
| `suggestRecoveryStrategies` | 2 (failed+success) | store.ts:1163,1166 |
| `task_episode_query` tool | 1 | index.ts:... |
| `find_similar_tasks` tool | 1 | index.ts:... |

### Expected Visible Output
- Valid rows: normal behavior, no change
- Invalid row: `ZodError` thrown with field path (e.g., `"state: Expected 'pending'|'running'..., got 123"`)

### Failure Behavior
- Corrupt row in DB → throws `ZodError` immediately at read site
- Callers (`addRetryAttempt`, etc.) that call `validateEpisodicRecord(rows[0])` will throw
- This is correct fail-fast behavior — corrupt data must not propagate silently

## 6. Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| Manual field-by-field validation without Zod | More code, no incremental safety, harder to maintain |
| Validate only at tool boundary (index.ts) | 11 internal store.ts cast sites remain unprotected |
| Suppress errors and log | Silent failures are the problem we're solving |
