# Spec: BL-046 — DB row runtime 型別驗證

## Requirement: R1 — Valid Record Passes Validation

A correctly structured `EpisodicTaskRecord` row retrieved from LanceDB SHALL pass `validateEpisodicRecord()` without throwing, returning a fully typed `EpisodicTaskRecord` object.

**Runtime Surface**: `internal-api`
**Entrypoint**: `src/types.ts` → `validateEpisodicRecord(raw: unknown): EpisodicTaskRecord`

### Scenario: Valid minimal record

- **GIVEN**: A LanceDB row with all required fields populated and all JSON fields containing valid JSON strings
- **WHEN**: `validateEpisodicRecord(row)` is called
- **THEN**: It returns the parsed record without throwing
- **AND**: All JSON sub-fields are parsed objects (not strings)

### Scenario: Valid record with optional fields

- **GIVEN**: A record with `endTime`, `failureType`, `errorMessage`, and `taskDescriptionVector` all populated
- **WHEN**: `validateEpisodicRecord(row)` is called
- **THEN**: It returns the record with all optional fields present

## Requirement: R2 — Invalid State Value Throws Descriptive Error

If a row contains an invalid `state` value (not one of the 5 enum values), `validateEpisodicRecord` SHALL throw a `ZodError` that identifies the field and expected values.

**Runtime Surface**: `internal-api`
**Entrypoint**: `src/types.ts` → `EpisodicTaskRecordSchema` → `state` field validation

### Scenario: state is wrong string

- **GIVEN**: A row with `state = "completed"` (not a valid enum value)
- **WHEN**: `validateEpisodicRecord(row)` is called
- **THEN**: It throws `ZodError` with message containing `"state"` and listing valid values

### Scenario: state is number

- **GIVEN**: A row with `state = 1` (wrong type)
- **WHEN**: `validateEpisodicRecord(row)` is called
- **THEN**: It throws `ZodError` with `"expected: 'pending' | 'running' ..."` and `"received: number"`

## Requirement: R3 — Malformed JSON Fields Throw

If any JSON string field (`commandsJson`, `validationOutcomesJson`, etc.) contains invalid JSON, `validateEpisodicRecord` SHALL throw a `ZodError` with the field name in the path.

**Runtime Surface**: `internal-api`
**Entrypoint**: `src/types.ts` → Zod `transform` on JSON fields

### Scenario: commandsJson is not JSON

- **GIVEN**: A row with `commandsJson = "not valid json {"`
- **WHEN**: `validateEpisodicRecord(row)` is called
- **THEN**: It throws `ZodError` with path containing `"commandsJson"`

### Scenario: metadataJson is empty string

- **GIVEN**: A row with `metadataJson = ""`
- **WHEN**: `validateEpisodicRecord(row)` is called
- **THEN**: It throws `ZodError` (empty string fails `z.object()` for metadata object after transform)

### Scenario: Null in JSON array field

- **GIVEN**: A row with `commandsJson = "['git commit', null]"`
- **WHEN**: `validateEpisodicRecord(row)` is called
- **THEN**: Behavior depends on schema design — either passes (if `z.array(z.string())` allows null) or throws (if null is not allowed)

## Requirement: R4 — All 13 Cast Sites Are Replaced

All 13 occurrences of `as unknown as EpisodicTaskRecord` in `src/store.ts` and `src/index.ts` SHALL be replaced with validated reads using `validateEpisodicRecord()` or `validateEpisodicRecordArray()`.

**Runtime Surface**: `internal-api`
**Entrypoint**: `src/store.ts` and `src/index.ts` cast sites

### Scenario: Store.ts cast site replaced

- **WHEN**: `src/store.ts` is inspected for `as unknown as EpisodicTaskRecord`
- **THEN**: Zero occurrences remain in the file
- **AND**: All former cast sites use `validateEpisodicRecord()` or `validateEpisodicRecordArray()`

### Scenario: Index.ts cast site replaced

- **WHEN**: `src/index.ts` is inspected for `as unknown as EpisodicTaskRecord`
- **THEN**: Zero occurrences remain in the file
- **AND**: All former cast sites use `validateEpisodicRecord()` or `validateEpisodicRecordArray()`

## Requirement: R5 — Validator Is Tested

The `validateEpisodicRecord()` function SHALL have unit tests covering: valid records, each invalid field case, and malformed JSON fields.

**Runtime Surface**: `internal-api`
**Entrypoint**: `tests/unit/validate-episodic-record.test.ts` (new file)

### Scenario: Unit test coverage

- **GIVEN**: A test file `tests/unit/validate-episodic-record.test.ts` exists
- **WHEN**: Tests are run via `npm test` or `node --test`
- **THEN**: Tests for R1–R3 all pass
- **AND**: Tests include at least one case per invalid field type

## Requirement: R6 — All Existing Episodic Tests Still Pass

After adding validation, all existing episodic integration tests SHALL still pass, confirming no behavioral regression.

**Runtime Surface**: `internal-api` (via existing tool handlers)
**Entrypoint**: `npm run test:effectiveness`

### Scenario: Regression test suite

- **WHEN**: `npm run test:effectiveness` is run
- **THEN**: All existing tests pass
- **AND**: No test was modified to pass (all test files unchanged)
