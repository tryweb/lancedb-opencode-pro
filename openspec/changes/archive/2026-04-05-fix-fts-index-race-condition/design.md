## Context

`MemoryStore.ensureIndexes()` creates vector and FTS indexes at startup via `createVectorIndexWithRetry()` and `createFtsIndexWithRetry()`. Both methods follow check-then-create: they call `listIndices()` to see if the index exists, then call `createIndex()` if not. When two or more processes initialize simultaneously against the same LanceDB table, both processes pass the check (no index found), both call `createIndex()`, and only one wins. The loser receives a `Retryable commit conflict` error from LanceDB.

The current retry loop (3 attempts, exponential backoff) treats all errors identically. It does not detect the "another process created it" signal, so after exhausting retries it sets `indexState.fts = false` / `indexState.vector = false` even though the index was successfully created by the concurrent process.

## Goals / Non-Goals

**Goals:**
- Detect commit-conflict errors as a distinct, recoverable case
- Re-verify index existence immediately after catching a commit-conflict, and adopt the index as success if present
- Add per-attempt randomized jitter to backoff to reduce re-collision probability
- Perform a final existence check after all retries are exhausted before declaring failure

**Non-Goals:**
- Process-level mutex or file-lock coordination across OS processes
- Changes to LanceDB API or its conflict semantics
- Changes to fallback search behavior when index is truly absent
- New configuration knobs exposed to users

## Decisions

### Decision 1: Re-verify after commit-conflict instead of a distributed lock

**Chosen**: Catch the specific `Retryable commit conflict` string in the error message, then immediately call `listIndices()` to check if another process created the index.

**Alternative considered**: File-based lock (e.g., `flock` on a sentinel file). Rejected because it adds OS-level complexity, is not portable across all deployment modes (Docker volumes, network mounts), and is overkill for a soft problem that resolves itself within milliseconds.

**Rationale**: LanceDB itself labels this error as `Retryable`. The correct response is to retry verification, not to block. Re-reading `listIndices()` is cheap and stateless.

### Decision 2: Jitter on backoff delay

**Chosen**: Add `Math.random() * baseDelay` to the computed backoff delay for every retry attempt.

**Rationale**: Without jitter, two processes with identical startup timing will collide again on every retry at the same moment (thundering herd). A simple uniform jitter breaks this synchronization.

Formula: `delay = baseDelay * 2^attempt + Math.random() * baseDelay`

### Decision 3: Final-pass existence check after all retries

**Chosen**: After the retry loop completes without success, call `listIndices()` one more time before writing `indexState.{vector|fts} = false`.

**Rationale**: The last retry may itself trigger a commit-conflict that creates the index via the other process. Without a final check, we declare failure on a successfully-created index.

## Risks / Trade-offs

- [`listIndices()` overhead`] Adds 1–3 extra `listIndices()` calls per startup per index when conflicts occur → Mitigation: calls only happen in the catch block and final-pass, not in the happy path. Cost is negligible.
- [`Error string matching`] Conflict detection relies on matching the LanceDB error message string, which could change across LanceDB versions → Mitigation: use substring check (`includes`), not exact match. If the string changes, the code degrades gracefully to current behavior (no regression).
- [`No cross-host guarantee`] If LanceDB is used against a shared network path with many hosts, jitter alone may be insufficient → Mitigation: out of scope; this fix targets the common single-machine multi-process case.
