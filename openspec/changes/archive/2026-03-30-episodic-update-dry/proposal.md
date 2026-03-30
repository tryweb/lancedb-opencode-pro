# Proposal: BL-043 — Episodic 更新流程 DRY 化

## 1. Problem Statement

**Backlog ID**: BL-043

**Current State**: Five episodic update methods in `src/store.ts` (`addCommandToEpisode`, `addValidationOutcome`, `addSuccessPatterns`, `addRetryAttempt`, `addRecoveryStrategy`) each contain 15+ lines of near-identical boilerplate:

```typescript
// Pattern repeated 5 times (lines 917–1111)
async addXxxEpisode(taskId, scope, payload) {
  await this.ensureEpisodicTaskTable(384);
  const table = this.requireEpisodicTaskTable();
  const rows = await table.query().where(`taskId = '${escapeSql(taskId)}' AND scope = '${escapeSql(scope)}'`).toArray();
  if (rows.length === 0) return false;

  const existing = rows[0] as unknown as EpisodicTaskRecord;   // ← BL-046 risk
  const items: T[] = existing.jsonField ? JSON.parse(existing.jsonField) : [];
  items.push(payload);

  const updated: EpisodicTaskRecord = { ...existing, jsonField: JSON.stringify(items) };
  await table.delete(`id = '${escapeSql(existing.id)}'`);
  await table.add([updated]);
  return true;
}
```

**Duplication Cost**:
- 5 × ~15 lines = 75+ lines of copy-paste risk
- Adding a 6th field (or changing the delete/add protocol) requires editing all 5 methods
- Bug fix to the pattern must be applied 5 times manually
- Harder to test in isolation

## 2. Why Now

These methods are the primary write path for episodic learning data (commands, validation, patterns, retries, recovery). Any future extension (e.g., adding timestamps to each sub-field item, or adding undo support) requires touching all 5. The DRY template reduces future maintenance surface and aligns with BL-046 (runtime validation) which needs to intercept these same read/write cycles.

## 3. Scope

### In Scope
- Refactor 5 `add*Episode` methods in `src/store.ts` to use a shared internal updater template
- Extract a private `appendToEpisodeField<T>()` helper
- Preserve all existing method signatures and return types (no breaking API change)
- Ensure no behavioral regression in existing call sites

### Out of Scope
- BL-046 runtime validation (separate change)
- Changes to `updateTaskState` (different signature pattern)
- Changes to `findSimilarTasks`, `suggestRetryBudget`, `suggestRecoveryStrategies`
- Schema changes to `EpisodicTaskRecord`

## 4. Impacted Modules

| Module | Impact |
|--------|--------|
| `src/store.ts` | Primary refactor target |
| `src/index.ts` | No changes (tool signatures unchanged) |
| `src/types.ts` | No changes |

## 5. Release Impact

**Type**: `internal-only` — refactoring only, no user-facing API change

**Changelog Wording Class**: `internal-only`

No user-facing features, tools, or behavior change. Existing tools continue to work identically.

## 6. Risk Level

**Low** — mechanical refactor with preserved signatures; all existing call sites remain valid.

## 7. Non-Goals

- Do NOT add new episodic fields without a separate backlog item
- Do NOT change the delete-then-add write protocol
- Do NOT add validation (that is BL-046)
