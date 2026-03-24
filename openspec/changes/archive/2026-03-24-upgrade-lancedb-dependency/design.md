## Context

### Current State
- Project uses `@lancedb/lancedb@0.26.2` (released 2026-02-09)
- Latest stable version is `0.27.1` (released 2026-03-20)
- No automated dependency update monitoring exists
- Version drift of ~6weeks with accumulated fixes and improvements

### LanceDB API Usage in Project
The project's `src/store.ts` uses the following LanceDB APIs:

| API | Usage | Risk Level |
|-----|-------|------------|
| `connect(dbPath)` | Database connection | Low |
| `openTable(name)` | Open existing table | Low |
| `createTable(name, rows)` | Create new table | Low |
| `table.add(rows)` | Insert records | Medium |
| `table.delete(filter)` | Delete records | Low |
| `table.query().where().select().limit().toArray()` | Query chain | Medium |
| `table.createIndex(column, options)` | Create vector/FTS index | Medium |
| `table.schema()` | Get table schema | Low |
| `table.addColumns(transforms)` | Schema migration | Medium |

### LanceDB 0.27.x Key Changes (Upstream)
- **napi-rs v3** - Native binding upgrade (Node.js)
- **Bug fix**: Pre-filtering on hybrid search (#3096)
- **Bug fix**: Cast error propagation in `add()` (#3075)
- **Performance**: Parallel inserts for local tables (#3062)
- **Feature**: `fast_search` parity between vector and FTS (#3091)

## Goals / Non-Goals

**Goals:**
1. Update LanceDB dependency to `0.27.1` with zero breaking changes to plugin functionality
2. Verify all existing API usage patterns remain compatible
3. Establish automated dependency monitoring to prevent future drift
4. Document upgrade verification evidence for reproducibility

**Non-Goals:**
1. Adopting new LanceDB features (parallel inserts, `fast_search`) - deferred to future changes
2. Modifying existing LanceDB API usage patterns - maintain current interface
3. Performance benchmarking comparison - out of scope for this upgrade
4. Multi-platform native binding testing beyond CI matrix

## Decisions

### Decision 1: Dependency Version Strategy
**Choice**: Use caret version range `^0.27.1` (same pattern as current)

**Rationale**:
- Consistent with existing versioning strategy (`^0.26.2`)
- Semver for `0.x` versions restricts updates to same minor (`>=0.27.1 <0.28.0`)
- Package-lock.json pins exact version for reproducible builds
- Allows future patch updates (e.g., `0.27.2`) without manual intervention

**Alternatives Considered**:
- ~~Exact version `0.27.1`~~ - Too restrictive, misses patch fixes
- ~~Tilde version `~0.27.1`~~ - Unnecessary restriction to patch updates only

### Decision 2: Upgrade Verification Phases
**Choice**: Three-phase verification (Local → Docker → Matrix)

**Phases**:
1. **Local Verification**: `npm run verify:full` on developer machine
2. **Docker Verification**: `docker compose build --no-cache && npm run verify:full`
3. **CI Matrix**: Node.js 20 + Node.js 22 across Linux x64/arm64

**Rationale**:
- Catches issues early with progressive verification stages
- Docker isolation ensures clean environment testing
- Matrix testing validates native binding compatibility

**Alternatives Considered**:
- ~~Single-phase local-only verification~~ - May miss platform-specific issues
- ~~Direct merge to main~~ - Too risky without staged verification

### Decision 3: CI/CD Enhancement Architecture
**Choice**: Separate workflow file for dependency monitoring

**Structure**:
```
.github/workflows/
├── ci.yml                    # Existing (verify, benchmark-latency, verify-full-release)
└── dependency-update.yml      # New (check-lancedb-update, test-latest-lancedb)
```

**Rationale**:
- Separation of concerns: CI vs dependency monitoring
- Different triggers: PR/push vs weekly schedule
- Independent failure handling
- Easier to enable/disable independently

**Alternatives Considered**:
- ~~Add jobs to existing ci.yml~~ - Would mix concerns, harder to maintain
- ~~External dependency scanning service~~ - Overkill for single dependency focus

### Decision 4: High-Risk API Verification
**Choice**: Targeted test cases for medium-risk APIs

| API | Test Focus |
|-----|------------|
| `table.add()` | Cast error handling validation |
| `createIndex("text")` | FTS index creation success |
| `addColumns()` | SQL expression compatibility |

**Rationale**:
- Existing tests (`test:foundation`, `test:regression`) cover happy paths
- Additional verification for known upstream changes (cast errors, FTS)
- No new test infrastructure needed

**Alternatives Considered**:
- ~~Comprehensive new test suite~~ - YAGNI, existing tests sufficient with minor additions
- ~~Skip targeted verification~~ - Risk of regression medium-risk APIs

### Decision 5: Documentation Strategy
**Choice**: CHANGELOG.md entry + version tracking spec

**Rationale**:
- CHANGELOG.md is standard location for version changes
- OpenSpec spec creates audit trail for dependency requirements
- Provides reference for future upgrades

**Alternatives Considered**:
- ~~Separate UPGRADE.md~~ - Redundant with CHANGELOG.md
- ~~Inline comments only~~ - Not discoverable enough

## Risks / Trade-offs

### Risk 1: Native Binding Compatibility
**Risk**: napi-rs v2 → v3 may cause issues on some platforms

**Mitigation**:
- CI matrix tests Node 20/22 on ubuntu-latest
- Docker build uses `--no-cache` for clean native binding compilation
- If issues arise: fallback to specific platform-specific packages

### Risk 2: FTS Index API Changes
**Risk**: Full-text search index creation may have changed in 0.27.x

**Mitigation**:
- Existing defensive code checks `Index.fts` availability
- `test:regression` covers FTS search functionality
- Manual verification of FTS index creation before merge

### Risk 3: Database File Compatibility
**Risk**: Existing LanceDB database files may not be readable by new version

**Mitigation**:
- LanceDB maintains backward compatibility for local databases
- Schema migration (`ensureMemoriesTableCompatibility`) handles column additions
- Test with real database files before merge

### Risk 4: CI Time Increase
**Risk**: Additional matrix jobs increase CI runtime

**Mitigation**:
- Matrix only runs on PR/push to main, not on every commit
- Dependency check is weekly, not per-PR
- Cost acceptable for dependency safety

## Migration Plan

### Phase 1: Preparation (Local)
```bash
# 1. Create feature branch
git checkout -b upgrade/lancedb-0.27

# 2. Backup existing data
cp -r ~/.opencode/memory/lancedb ~/.opencode/memory/lancedb.backup

# 3. Update dependency
# Edit package.json: "@lancedb/lancedb": "^0.27.1"
npm install

# 4. Run local verification
npm run verify:full
```

### Phase 2: Docker Verification
```bash
# 5. Clean Docker build
docker compose build --no-cache && docker compose up -d

# 6. Run all tests in container
docker compose exec app npm run verify:full

# 7. Test with real data
docker compose exec app npm run test:e2e
```

### Phase 3: CI Verification
```bash
# 8. Push branch for CI
git push origin upgrade/lancedb-0.27

# 9. Monitor CI matrix results
# - Node 20 + Node 22
# - Ubuntu latest (x64)
# - Docker clean build
```

### Phase 4: Merge
```bash
# 10. After all checks pass
# - Update CHANGELOG.md
# - Merge to main
# - Verify production tag builds
```

### Rollback Strategy
If issues discovered post-merge:

1. **Immediate**: Revert commit on main branch
2. **Dependency**: Downgrade to `^0.26.2` in package.json
3. **Verification**: Re-run full test suite on downgraded version
4. **Data**: No data migration needed (backward compatible)
5. **Timeline**: Maximum 1 hour to revert and redeploy

## Open Questions

1. ~~Should we document supported Node.js version range?~~ **Resolved**: Node 22+ per package.json `engines`

2. ~~Should we add Windows/macOS to CI matrix?~~ **Decision**: Defer to future - Linux x64 is primary deployment target

3. **Should we pin exact LanceDB version in production?**
   - Current: `^0.27.1` allows patch updates
   - Alternative: `0.27.1` exact version
   - **Recommendation**: Keep caret range, rely on package-lock for reproducibility

4. ~~When should we adopt `fast_search` feature?~~ **Decision**: Defer - not needed for current use case