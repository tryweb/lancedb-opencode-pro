## Why

The memory provider implementation is functionally present, but release confidence is still weak because verification is mostly limited to typecheck and a single end-to-end script. The repository already defines high-priority validation goals and acceptance criteria in documentation, so the next logical step is to convert those documents into repeatable automated checks and benchmark workflows.

## What Changes

- Add a validation harness for the memory provider covering correctness, safety, and release-readiness checks.
- Add automated tests for foundation behaviors such as scope isolation, vector-dimension compatibility, write-read persistence, and timestamp ordering.
- Add regression tests for auto-capture, destructive tool confirmation, and pruning behavior.
- Add retrieval-quality and latency benchmark workflows so the project can measure recall, robustness, and responsiveness before release.
- Add package and Docker verification entrypoints that map directly to the existing acceptance checklist and validation documentation.

## Capabilities

### New Capabilities
- `memory-validation-harness`: Defines the automated validation and benchmark workflows required to verify the LanceDB memory provider before release.

### Modified Capabilities
- `memory-auto-capture-and-recall`: Add verification requirements for auto-capture correctness, retrieval fallback validation, and recall quality checks.
- `memory-project-scope-isolation`: Add verification requirements proving cross-scope isolation and scope-aware write behavior under automated tests.
- `memory-management-commands`: Add verification requirements for delete and clear safety confirmation behavior.
- `memory-provider-config`: Add verification requirements for embedding compatibility checks and operator-facing validation commands.

## Impact

- Affected code paths include `src/index.ts`, `src/store.ts`, `src/extract.ts`, `src/scope.ts`, and the existing E2E flow in `scripts/e2e-opencode-memory.mjs`.
- New testing and benchmark files will be added under a dedicated test area plus matching `package.json` scripts.
- Docker-based verification flows documented in `README.md` and `docs/acceptance-checklist.md` will become executable project workflows instead of manual guidance only.
