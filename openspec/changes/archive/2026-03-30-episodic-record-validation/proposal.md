# Proposal: BL-046 — DB row runtime 型別驗證

## 1. Problem Statement

**Backlog ID**: BL-046

**Current State**: All reads from the `episodic_tasks` LanceDB table use unvalidated casts:

```typescript
// 13 occurrences in src/store.ts and src/index.ts
const existing = rows[0] as unknown as EpisodicTaskRecord;
const episodes = rows as unknown as EpisodicTaskRecord[];
```

LanceDB stores data with no enforced schema at the DB layer. Any corrupted row (e.g., `state` is a number instead of `TaskState` string, or `commandsJson` is not valid JSON) will silently propagate into the application with the wrong TypeScript type, bypassing all type safety.

**Risk**: Production data corruption, silent type errors, hard-to-debug failures when the DB contains unexpected data from bugs, manual edits, or migration errors.

## 2. Why Now

BL-043 is refactoring the 5 `add*Episode` methods — this is the right moment to also intercept the read path and validate data before it enters the application type system. The `appendToEpisodeField<T>` helper (BL-043) calls `parser(raw)` which will throw on malformed JSON; adding a record-level schema validator at the cast site adds defense-in-depth.

## 3. Scope

### In Scope
- Define a Zod schema for `EpisodicTaskRecord` covering all 18 fields
- Implement `validateEpisodicRecord()` and `validateEpisodicRecordArray()` functions
- Replace all 13 `as unknown as EpisodicTaskRecord` cast sites with validated reads
- Ensure JSON fields (`commandsJson`, `validationOutcomesJson`, etc.) are parsed and validated
- Add zod as a devDependency (required for test infra)
- Add unit tests for the validator covering valid/invalid/malformed cases

### Out of Scope
- Changing the LanceDB table schema (no `ALTER TABLE`)
- Adding validation on write (only reads are validated)
- BL-043 DRY refactor (separate change)

## 4. Impacted Modules

| Module | Impact |
|--------|--------|
| `src/store.ts` | Replace 11 cast sites with validated reads |
| `src/index.ts` | Replace 2 cast sites with validated reads |
| `src/types.ts` | Add Zod schema for `EpisodicTaskRecord` |
| `package.json` | Add `zod` as devDependency |
| `tests/` | Add validator unit tests |

## 5. Release Impact

**Type**: `internal-only` — safety hardening, no user-facing API change

**Changelog Wording Class**: `internal-only`

## 6. Risk Level

**Low-Medium** — Adding validation could cause newly-discovered corrupt rows to throw at runtime. This is the intended behavior (fail-fast), but must be covered by tests.

## 7. Non-Goals

- Do NOT validate writes (only reads)
- Do NOT change `EpisodicTaskRecord` TypeScript interface (schema is for runtime only)
- Do NOT remove `as unknown as` entirely — it is still needed to tell TypeScript the raw row is `unknown` before the validator runs
