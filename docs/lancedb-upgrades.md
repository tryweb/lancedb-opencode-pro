# LanceDB Upgrade History

This document tracks LanceDB version upgrades and compatibility notes.

## Current Version

- **Version**: 0.27.1
- **Released**: 2026-03-20
- **Dependency**: `@lancedb/lancedb@^0.27.1`

## Upgrade History

### 0.26.2 → 0.27.1 (2026-03-24)

**Verified**: ✅ All tests pass

**Changes from upstream**:
- napi-rs v2 → v3 (native binding upgrade)
- Bug fix: Pre-filtering on hybrid search (#3096)
- Bug fix: Cast error propagation in `add()` (#3075)
- Performance: Parallel inserts for local tables (#3062)
- Feature: `fast_search` parity between vector and FTS (#3091)

**Compatibility verified**:
- `connect()` - No changes
- `openTable()` - No changes
- `createTable()` - No changes
- `table.add()` - Cast error handling improved
- `table.delete()` - No changes
- `table.query()` - No changes
- `table.createIndex()` - FTS index creation works
- `table.schema()` - No changes
- `table.addColumns()` - SQL expression syntax compatible

**Minimum requirements**:
- Node.js >= 22 (unchanged)

**Test results**:
- Foundation tests: 11/11 passed
- Regression tests: 18/18 passed
- Retrieval tests: 2/2 passed
- Latency benchmark: All hard gates passed

## Verification Checklist

When upgrading LanceDB, verify the following:

1. **API Compatibility**
   - [ ] `connect()` works
   - [ ] `openTable()` works
   - [ ] `createTable()` works
   - [ ] `table.add()` works
   - [ ] `table.delete()` works
   - [ ] `table.query()` chain works
   - [ ] `table.createIndex()` works for vector
   - [ ] `table.createIndex()` works for FTS
   - [ ] `table.schema()` works
   - [ ] `table.addColumns()` works for schema migration

2. **Test Verification**
   - [ ] `npm run test:foundation` passes
   - [ ] `npm run test:regression` passes
   - [ ] `npm run test:retrieval` passes
   - [ ] `npm run test:effectiveness` passes
   - [ ] `npm run benchmark:latency` hard gates pass

3. **Docker Verification**
   - [ ] `docker compose build --no-cache` succeeds
   - [ ] `docker compose exec app npm run verify:full` passes

## References

- [LanceDB Releases](https://github.com/lancedb/lancedb/releases)
- [LanceDB Changelog](https://github.com/lancedb/lancedb/blob/main/CHANGELOG.md)