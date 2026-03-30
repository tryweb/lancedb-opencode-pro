# Design: BL-043 — Episodic 更新流程 DRY 化

## 1. Decision Table

| Decision | Choice | Why | Trade-off |
|---|---|---|---|
| Runtime surface | `internal-api` | Pure code-level refactor, no tool/hook exposure | N/A |
| Entrypoint | `src/store.ts` → `appendToEpisodeField<T>()` private helper | Centralizes the read-parse-push-write pattern | Helper must be generic enough for all 5 fields |
| Data model | No schema change | Only refactoring, not restructuring data | JSON fields remain stringified in DB |
| Failure handling | Return `false` when record not found (existing behavior) | Preserves all existing error semantics | No new failure modes introduced |
| Observability | No new logs/metrics (internal-only refactor) | Not user/operator observable | N/A |

## 2. Shared Updater Template Pattern

The core insight: all 5 methods follow a **read-parse-push-write** cycle with one field-specific accessor.

### Generic Helper Signature

```typescript
private async appendToEpisodeField<T>(
  taskId: string,
  scope: string,
  fieldAccessor: (record: EpisodicTaskRecord) => string,  // e.g. r => r.commandsJson
  fieldMutator: (record: EpisodicTaskRecord, value: string) => EpisodicTaskRecord, // e.g. (r,v) => ({...r, commandsJson: v})
  parser: (raw: string) => T[],
  serializer: (items: T[]) => string,
  newItem: T,
  itemEnricher?: (item: T) => T  // optional: add timestamp, etc.
): Promise<boolean>
```

### Refactored Method Pattern (before → after)

**Before** (5 methods, each 15+ lines):
```typescript
async addCommandToEpisode(taskId: string, scope: string, command: string): Promise<boolean> {
  await this.ensureEpisodicTaskTable(384);
  const table = this.requireEpisodicTaskTable();
  const rows = await table.query().where(`taskId = '${escapeSql(taskId)}' AND scope = '${escapeSql(scope)}'`).toArray();
  if (rows.length === 0) return false;
  const existing = rows[0] as unknown as EpisodicTaskRecord;  // BL-046 risk
  const commands: string[] = existing.commandsJson ? JSON.parse(existing.commandsJson) : [];
  commands.push(command);
  const updated: EpisodicTaskRecord = { ...existing, commandsJson: JSON.stringify(commands) };
  await table.delete(`id = '${escapeSql(existing.id)}'`);
  await table.add([updated]);
  return true;
}
```

**After** (delegates to helper):
```typescript
async addCommandToEpisode(taskId: string, scope: string, command: string): Promise<boolean> {
  return this.appendToEpisodeField(
    taskId, scope,
    r => r.commandsJson,
    (r, v) => ({ ...r, commandsJson: v }),
    raw => raw ? JSON.parse(raw) : [],
    items => JSON.stringify(items),
    command
  );
}
```

## 3. Operability

### Trigger Path
Internal call only — no external trigger. These methods are called by:
- `task_episode_create` / `task_episode_query` tool handlers in `src/index.ts`
- Internal episodic hooks (event hooks)

### Expected Visible Output
None — purely internal refactor. Existing tool responses unchanged.

### Misconfiguration/Failure Behavior
- Record not found → returns `false` (existing behavior)
- JSON parse error on existing field → throws (existing behavior, not changed)
- Empty taskId/scope → SQL injection risk handled by `escapeSql()` (unchanged)

## 4. Verification Strategy

| Aspect | Approach |
|--------|----------|
| Behavioral equivalence | Unit tests pass existing test suite without modification |
| Template correctness | Unit tests for the helper cover all 5 field types |
| No regression | Existing integration tests for episodic tools unchanged |

## 5. File Impact

| File | Change |
|-------|--------|
| `src/store.ts` | Add `appendToEpisodeField<T>()` helper; reduce 5 methods to ~5 lines each |
| `src/types.ts` | No change |
| `src/index.ts` | No change |
| `tests/` | Add unit tests for helper; existing tests unchanged |

## 6. Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| Extract a full `EpisodeUpdater` class | Overkill for a single helper; adds file |
| Use a higher-order function per field | More complex than needed for this scope |
| Decorator pattern | Not idiomatic in this codebase; adds indirection |
