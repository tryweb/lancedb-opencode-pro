## 1. Open Existing Event Tables Safely

- [x] 1.1 Extend the LanceDB table typing in `src/store.ts` so store initialization can inspect and patch `effectiveness_events` schema.
- [x] 1.2 Add init-time compatibility logic in `src/store.ts` that detects a missing `source` column and patches the existing `effectiveness_events` table before new recall events are written.

## 2. Preserve Backward-Compatible Effectiveness Reads

- [x] 2.1 Keep legacy recall rows readable after patching by preserving the `system-transform` default for rows without a populated `source` value.
- [x] 2.2 Fail initialization with a clear error if the event-table schema patch cannot be applied, instead of surfacing a later write-time schema mismatch.

## 3. Regression Coverage

- [x] 3.1 Add a foundation test that creates a pre-`0.1.5` `effectiveness_events` table, re-initializes the store, and verifies a recall event with `source` can be written successfully.
- [x] 3.2 Extend regression coverage to confirm upgraded event data still summarizes legacy recall rows as `system-transform` while preserving new auto/manual split metrics.

## 4. Validation

- [x] 4.1 Run changed-file diagnostics and the targeted automated tests covering the schema upgrade path.
- [x] 4.2 Rebuild and start the Docker test environment, then run containerized verification for the schema upgrade fix.
