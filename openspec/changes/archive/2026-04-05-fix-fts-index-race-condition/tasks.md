## 1. Fix createVectorIndexWithRetry

- [x] 1.1 Add commit-conflict detection helper: extract `isCommitConflict(errorMsg: string): boolean` inline check using `includes("Retryable commit conflict") || includes("preempted by concurrent transaction")`
- [x] 1.2 In the catch block, if `isCommitConflict`, call `listIndices()` and return success if the vector index now exists
- [x] 1.3 Replace fixed backoff delay `baseDelay * 2^attempt` with jittered formula `baseDelay * 2^attempt + Math.random() * baseDelay`
- [x] 1.4 After the retry loop exits without success, call `listIndices()` one final time and adopt the index as success if present; only then write `indexState.vector = false`

## 2. Fix createFtsIndexWithRetry

- [x] 2.1 Apply the same commit-conflict detection in the FTS catch block: call `listIndices()` on conflict and return success if the FTS index now exists
- [x] 2.2 Apply the same jittered backoff formula to FTS retry delays
- [x] 2.3 Apply the same final-pass existence check after FTS retry loop exhaustion

## 3. Tests

- [x] 3.1 Add unit test: `createVectorIndexWithRetry` — commit-conflict on first attempt, index exists on re-verify → `indexState.vector = true`
- [x] 3.2 Add unit test: `createFtsIndexWithRetry` — commit-conflict on first attempt, index exists on re-verify → `indexState.fts = true`
- [x] 3.3 Add unit test: `createFtsIndexWithRetry` — all attempts fail with non-conflict error, final check shows index absent → `indexState.fts = false`
- [x] 3.4 Add unit test: final-pass check — all retries exhausted, final `listIndices()` shows index present → `indexState.fts = true`

## 4. Validation

- [x] 4.1 Run `npm test` and confirm all new and existing tests pass
- [x] 4.2 Run `npm run build` and confirm zero TypeScript errors
