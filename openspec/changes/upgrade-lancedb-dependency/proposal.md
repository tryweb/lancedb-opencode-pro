## Why

The project currently uses `@lancedb/lancedb@0.26.2` (released 2026-02-09), which is behind the latest stable version `0.27.1` (released 2026-03-20). This upgrade brings important bug fixes for hybrid search pre-filtering, performance improvements for parallel inserts, and native binding upgrades (napi-rs v2 → v3). Additionally, a systematic dependency upgrade verification workflow is needed to prevent future version drift and ensure timely security updates.

## What Changes

### Dependency Version Update
- Update `@lancedb/lancedb` from `^0.26.2` to `^0.27.1` in `package.json` and `package-lock.json`
- Verify compatibility with all existing LanceDB API usage patterns in `src/store.ts`

### Breaking Changes (Upstream) - **NOT AFFECTING THIS PROJECT**
- LanceDB 0.27.0 has breaking changes for Rust API `RecordBatchReader` handling, but this project uses Node.js bindings which remain compatible

### New Features Available (Optional Future Adoption)
- Parallel inserts for large datasets (automatically handled by LanceDB)
- `fast_search` parameter for improved query performance
- Improved cast error propagation in `add()` method

### Bug Fixes Benefiting This Project
- Pre-filtering fix for hybrid search (v0.27.1)
- Graceful handling of empty result sets in hybrid search
- Fixed non-stopping dataset version check

### CI/CD Enhancement
- New GitHub Actions workflow for dependency update monitoring (`dependency-update.yml`)
- Weekly scheduled check for LanceDB version updates
- Automated compatibility testing with latest dependency versions
- Issue creation for available updates that pass compatibility tests

## Capabilities

### New Capabilities

- `dependency-upgrade-workflow`: Automated weekly checks for LanceDB version updates with compatibility verification and issue creation for reviewable updates
- `lancedb-version-tracking`: Documentation and tracking of LanceDB version requirements, compatibility notes, and upgrade history

### Modified Capabilities

- `memory-provider-config`: Update dependency requirements from `@lancedb/lancedb@^0.26.2` to `@lancedb/lancedb@^0.27.1` in configuration specifications
- `memory-validation-harness`: Extend test coverage to verify LanceDB 0.27.x API compatibility, particularly for FTS index creation and `addColumns()` schema migration

## Impact

### Code Changes
- `package.json`: Version bump from `^0.26.2` to `^0.27.1`
- `package-lock.json`: Regenerated with new dependency tree
- `.github/workflows/ci.yml`: New `dependency-audit` and `verify-matrix` jobs
- `.github/workflows/dependency-update.yml`: New workflow for automated dependency monitoring
- `CHANGELOG.md`: Document the upgrade and verification results

### API Compatibility
- **Low Risk**: Core APIs (`connect`, `openTable`, `createTable`, `delete`, `query`, `schema`) have no breaking changes for Node.js
- **Medium Risk**: `table.add()` has improved cast error handling - needs verification
- **Medium Risk**: `createIndex()` FTS configuration API may need validation
- **Medium Risk**: `addColumns()` SQL expression syntax needs compatibility testing

### Test Changes
- Add verification for FTS index creation with LanceDB 0.27.x
- Add verification for schema migration (`addColumns`) with new LanceDB version
- Add verification for hybrid search (vector + BM25) query results
- Add Node.js version matrix testing (Node 20, 22)

### Dependencies
- `@lancedb/lancedb`: `0.26.2` → `0.27.1`
- Native bindings: `napi-rs v2` → `napi-rs v3` (handled by LanceDB package)
- New optional peer dependency: `apache-arrow` version range validation (already compatible)

### Documentation
- `README.md`: Update supported versions if needed
- `CHANGELOG.md`: Add upgrade entry with verification evidence
- `docs/release-readiness.md`: Update dependency verification requirements