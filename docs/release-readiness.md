# Release Readiness

This document tracks acceptance evidence for `lancedb-opencode-pro` and records the latest supported verification run.

## Verification Command Stack

Use Docker as the canonical environment:

```bash
docker compose build --no-cache && docker compose up -d
docker compose exec app npm run verify:full
```

`verify:full` runs:

1. `npm run verify`
   - `typecheck`
   - `build`
   - `test:foundation`
   - `test:regression`
   - `test:retrieval`
2. `npm run benchmark:latency`
3. `npm pack`

## Latest Run Evidence

- Date: `2026-03-16`
- Environment: Docker (`node:22-bookworm`)
- Result: `PASS`

Key outputs:

- Foundation: `4/4` pass
- Regression: `4/4` pass
- Retrieval: `2/2` pass (`Recall@10=1.000`, `Robustness-0.5@10=1.000`)
- Latency hard gates: pass
  - `search.p50=0.49ms < 100ms`
  - `search.p99=1.88ms < 500ms`
- Packaging: `lancedb-opencode-pro-0.1.1.tgz` generated

## Acceptance Evidence Mapping

### Mapping to `docs/acceptance-checklist.md`

| Checklist item | Coverage source | Status |
|---|---|---|
| Auto-capture stores durable memory after successful completion | `test:regression` (`auto-capture...`), `test:e2e` | Automated |
| Later prompts can recall prior memory | `test:regression`, `test:e2e` | Automated |
| Switching project directory changes active scope isolation | Scope-isolation tests cover isolation semantics, but not live directory-switch integration path | Partial (manual integration check recommended) |
| Memory search returns ranked results with IDs and summaries | `test:regression` (`memory_search` output shape) | Automated |
| Memory delete removes targeted record by ID or stable prefix | `test:regression` covers safety rejection; delete success path covered in `test:e2e` by ID | Partial (prefix behavior not implemented/verified) |
| Memory clear only removes records in requested scope | `test:regression` + foundation scope tests + `test:e2e` | Automated |
| Clear operation requires `confirm=true` | `test:regression`, `test:e2e` | Automated |
| Missing FTS index does not break retrieval | Not explicitly exercised by dedicated failure-path test | Manual-only (pending automation) |
| Missing embedding backend does not crash plugin hooks | Not explicitly exercised by dedicated failure-path test | Manual-only (pending automation) |
| Docker build and up succeeds | `verify:full` run | Automated |
| `docker compose exec app npm run typecheck` succeeds | `verify:full` run | Automated |
| `docker compose exec app npm run build` succeeds | `verify:full` run | Automated |
| `docker compose exec app npm pack` produces tarball | `verify:full` run | Automated |

### Mapping to `docs/memory-validation-checklist.md`

Implemented automated coverage by phase:

- Phase 0: vector dimension consistency, write-read cycle, scope isolation, timestamp ordering
- Phase 1: Recall@K and Robustness-δ@K with synthetic fixture generation
- Phase 3: auto-capture extraction, minimum length, category behavior, delete/clear safety, pruning
- Phase 4.1: latency benchmarks (search p50/p99 hard gates, insert/list informational metrics)

Still manual or not yet automated:

- FTS degradation fault injection validation
- embedding-backend-unavailable fault-path validation
- broader phase items outside current change scope (phase 2/5+/scalability extremes)

## Manual-Only Items (Current)

Before archive/ship, retain these as explicit manual checks:

1. Force an FTS-index failure scenario and verify retrieval fallback behavior.
2. Force embedding backend outage and verify hook-level graceful behavior.
3. Run real OpenCode directory-switch scenario end-to-end to validate scope transition behavior in live integration.

## Archive / Ship Gate

Treat release as ready when all conditions are true:

1. `docker compose exec app npm run verify:full` passes.
2. No new failing items in the manual-only checklist above.
3. Any unresolved manual-only item is explicitly documented in release notes.
