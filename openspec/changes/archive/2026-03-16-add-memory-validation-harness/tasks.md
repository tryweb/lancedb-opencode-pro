## 1. Validation Harness Foundation

- [x] 1.1 Create the validation directory structure and shared test utilities for temporary databases, record fixtures, and common assertions.
- [x] 1.2 Decide and wire the test runner entrypoint so validation commands can execute consistently in local and Docker environments.
- [x] 1.3 Add initial package scripts for layered validation flows (`foundation`, `regression`, `retrieval`, `benchmark`) without yet enabling all checks.

## 2. Foundation Correctness Coverage

- [x] 2.1 Implement write-read persistence tests covering field integrity across multiple scopes.
- [x] 2.2 Implement scope-isolation tests proving that unrelated project scopes do not leak into each other.
- [x] 2.3 Implement vector-dimension compatibility tests covering incompatible-vector detection and failure reporting.
- [x] 2.4 Implement timestamp-ordering and scope-listing checks for deterministic recent-entry behavior.

## 3. Regression And Safety Coverage

- [x] 3.1 Extend validation for auto-capture text extraction, minimum capture length enforcement, and category assignment.
- [x] 3.2 Add automated checks for `memory_search` output shape so ranked results keep stable identifiers and summaries.
- [x] 3.3 Add automated rejection tests for `memory_delete` and `memory_clear` when `confirm=true` is missing.
- [x] 3.4 Add pruning-behavior tests proving per-scope retention limits remove the oldest entries first.

## 4. Retrieval Quality And Benchmark Workflows

- [x] 4.1 Add retrieval-quality fixtures or synthetic dataset generation for repeatable recall testing.
- [x] 4.2 Implement Recall@K and Robustness-delta@K reporting for the documented retrieval-quality workflow.
- [x] 4.3 Add latency benchmark commands covering search p50/p99 and other baseline storage operations.
- [x] 4.4 Define which retrieval and latency thresholds are hard gates versus informational metrics in the initial release workflow.

## 5. Docker And Operator Verification Path

- [x] 5.1 Ensure each supported validation workflow can run through `docker compose build --no-cache && docker compose up -d` followed by `docker compose exec app ...`.
- [x] 5.2 Update the existing E2E and validation documentation to point at the new executable commands instead of manual guidance only.
- [x] 5.3 Add an operator-facing verification flow for inspecting active storage path, degraded retrieval behavior, and packaged build readiness.

## 6. Acceptance Evidence And Release Readiness

- [x] 6.1 Map each automated workflow to the relevant items in `docs/acceptance-checklist.md` and `docs/memory-validation-checklist.md`.
- [x] 6.2 Run the full supported validation stack in the Docker environment and record any remaining manual-only acceptance items.
- [x] 6.3 Update release-readiness documentation so maintainers can determine whether the change is ready to archive and ship.
