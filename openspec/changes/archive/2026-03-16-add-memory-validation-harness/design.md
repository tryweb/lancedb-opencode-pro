## Context

The repository already contains the main memory-provider implementation, a Docker-based test environment, one end-to-end verification script, and extensive validation documentation. What is missing is the execution layer that turns those documents into repeatable checks that developers can run locally and inside the containerized workflow.

This change touches multiple modules because the validation work spans storage correctness (`src/store.ts`), auto-capture and tool safety (`src/index.ts`, `src/extract.ts`), scope behavior (`src/scope.ts`), package scripts (`package.json`), and the existing Docker validation path described in `README.md`. The design therefore needs to standardize how tests are organized, how benchmark-style checks are separated from correctness checks, and how evidence maps back to the acceptance checklist.

## Goals / Non-Goals

**Goals:**
- Define a repeatable validation harness that proves core memory-provider behaviors instead of relying on documentation alone.
- Separate foundation correctness, regression safety, retrieval quality, and latency benchmarking so developers can run the right verification level for each change.
- Reuse the existing Docker flow as the canonical execution path for validation and release-readiness checks.
- Make acceptance evidence traceable back to documented criteria in `docs/acceptance-checklist.md` and `docs/memory-validation-checklist.md`.

**Non-Goals:**
- Redesign memory storage or retrieval algorithms as part of this change.
- Introduce new user-facing memory commands or plugin UX.
- Guarantee production-scale benchmark thresholds in the first iteration beyond establishing the harness and reporting flow.
- Replace all existing manual validation notes; the goal is to make them executable, not discard them.

## Decisions

### Decision: Organize validation by intent, not by source module
The test harness will be grouped into foundation, regression, retrieval, and benchmark layers rather than mirroring the `src/` directory layout.

Rationale:
- The validation docs are already phase-oriented, so this structure matches the project's stated priorities.
- It keeps release-critical checks such as scope isolation and vector compatibility visible even though they span multiple files.

Alternatives considered:
- Module-by-module tests under `src/` were rejected because they hide cross-cutting release risks.

### Decision: Keep the current end-to-end script and extend around it
The existing `scripts/e2e-opencode-memory.mjs` flow remains the seed integration test, while additional focused tests will cover the behaviors that the E2E script does not fully prove.

Rationale:
- The current script already exercises the plugin lifecycle and tool execution path.
- Replacing it would create churn without improving confidence in the near term.

Alternatives considered:
- Rewriting all validation into a single monolithic E2E suite was rejected because failures would be harder to isolate and benchmark steps have different runtime expectations.

### Decision: Treat Docker execution as the canonical verification environment
Validation commands will be designed so they can be executed through `docker compose build --no-cache && docker compose up -d` followed by `docker compose exec app ...`.

Rationale:
- The project already documents Docker as the supported validation path.
- This reduces host-environment drift and matches the repo's operator guidance.

Alternatives considered:
- Host-only validation was rejected because it weakens reproducibility and conflicts with the documented workflow.

### Decision: Separate correctness tests from performance benchmarks
Correctness and regression checks will be pass/fail tests, while latency and retrieval-quality runs will produce explicit metrics and thresholds as benchmark workflows.

Rationale:
- Benchmark runs often need larger datasets and longer execution time.
- Keeping them separate prevents routine functional verification from becoming slow and brittle.

Alternatives considered:
- Folding latency and quality metrics into the default test command was rejected because it would make everyday feedback loops too expensive.

### Decision: Map every validation area back to acceptance evidence
Each validation workflow should identify which documented acceptance or checklist items it covers.

Rationale:
- The repo already has detailed validation documents; the main gap is evidence, not missing ideas.
- This prevents drift between docs and executable verification.

Alternatives considered:
- Leaving acceptance as free-form release notes was rejected because it would preserve the current documentation-to-implementation gap.

## Risks / Trade-offs

- [Risk] Benchmark thresholds may be noisy in containerized environments. -> Mitigation: separate benchmarks from core pass/fail tests and record thresholds explicitly.
- [Risk] A large validation harness can slow down contributor feedback loops. -> Mitigation: split commands by layer so small changes can run focused checks first.
- [Risk] Existing code may expose gaps that require small implementation fixes before tests can pass. -> Mitigation: stage work so foundation tests land before quality and performance checks.
- [Risk] Documentation and executable checks can diverge again after this change. -> Mitigation: make acceptance mapping part of the change scope, not an optional follow-up.

## Migration Plan

1. Add the validation-harness structure and baseline test utilities.
2. Land foundation correctness coverage for the highest-risk behaviors first.
3. Expand regression coverage around auto-capture and destructive tool safety.
4. Add retrieval-quality and latency workflows as separately invokable verification commands.
5. Update package scripts and Docker-facing docs so the new checks become the standard release path.
6. Use the acceptance checklist as the final verification surface before archiving the change.

Rollback is low risk because the change is additive to project tooling and docs. If any new validation workflow proves too unstable, the affected command can be removed from the standard verification path without changing runtime plugin behavior.

## Open Questions

- Which test runner should back the harness: Node's built-in test runner or a lightweight new dependency?
- Should retrieval-quality datasets be fully synthetic, fixture-based, or mixed?
- Which benchmark thresholds are strict release gates in v0.1.0 versus informative metrics only?
