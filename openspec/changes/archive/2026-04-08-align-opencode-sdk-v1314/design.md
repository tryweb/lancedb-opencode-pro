# Technical Design: OpenCode SDK v1.3.14 Alignment

## Context

The plugin currently uses OpenCode SDK v1.2.25 (stable), but the Docker test environment pulls the latest OpenCode version without version pinning. This creates a version mismatch that prevents proper verification of SDK upgrades.

### Current State
- SDK version: v1.2.25 (confirmed stable, tested)
- Docker OpenCode: unpinned (pulls latest, currently v1.3.14+)- Known broken versions: v1.3.8 - v1.3.13 (NAPI loading issues, Issue #20623)
- Target version: v1.3.14 (crosses AI SDK v5→v6 migration, Tool.define() bugfix)

### Stakeholders
- Development team: needs reliable test environment for SDK upgrades
- Release workflow: requires version alignment for `verify:full` execution
- Users: benefit from validated OpenCode version compatibility

## Goals/ Non-Goals

**Goals:**
- Align OpenCode version in Docker test environment with SDK version
- Validate v1.3.14 compatibility across all plugin hooks
- Document verification results for future reference
- Unblock BL-060 (OpenCode v1.3.14 compatibility confirmation)

**Non-Goals:**
- v1.4.0+ compatibility evaluation (BL-056, separate effort)
- Multi-version test matrix (BL-057, future work)
- Runtime version detection (BL-058, future work)

## Decisions

### Decision 1: Version Pinning Strategy

**Choice**: Pin OpenCode to exact version v1.3.14 in Dockerfile

**Rationale**:
- Ensures reproducible test environment
- Prevents accidental use of broken versions (v1.3.8-v1.3.13)
- Aligns with SDK version for proper verification
- Allows systematic upgrade path validation

**Alternatives considered**:
- Use latest version: Rejected - too volatile, may pull broken versions
- Use version range: Rejected - v1.3.8-v1.3.13 are known broken
- Multiple Dockerfiles for different versions: Rejected - out of scope for BL-059

### Decision 2: SDK Upgrade Approach

**Choice**: Upgrade both `@opencode-ai/plugin` and `@opencode-ai/sdk` to v1.3.14 simultaneously

**Rationale**:
- SDK and plugin versions must match for proper functionality
- Single atomic change for easier rollback if needed
- Simplifies verification scope

**Alternatives considered**:- Staged upgrade (one at a time): Rejected - creates incompatibility
- Keep v1.2.25: Rejected - doesn't meet BL-059 requirement

### Decision 3: VerificationScope

**Choice**: Run full `verify:full` suite plus focused hook validation

**Rationale**:
- `test:foundation`: Validates session.idle hook (critical for auto-capture)
- `test:regression`: Validates all 17 tool execute behaviors
- `test:e2e`: Validates complete write → restart → search flow
- Comprehensive coverage ensures nothing breaks

**Alternatives considered**:
- Minimal tests only (e2e): Rejected - insufficient for SDK upgrade validation
- Skip e2e: Rejected - critical for end-to-end workflow validation

### Decision 4: Documentation Update

**Choice**: Update `docs/OPENCODE_COMPATIBILITY.md` with v1.3.14 status

**Rationale**:
- Centralized compatibility documentation
- Users can reference verified version status
- Supports future SDK upgrade decisions

**Alternatives considered**:
- Separate changelog entry only: Rejected - compatibility matrix is more discoverable
- No documentation: Rejected - loses institutional knowledge

## Risks/ Trade-offs

### Risk 1: AI SDK v6 Migration Impacts
**Risk**: v1.3.4 introduced AI SDK v5 → v6 migration which may affect `session.idle` hook triggering
**Mitigation**: Run `test:foundation` specifically to validate session.idle behavior after upgrade
**Rollback**: If session.idle fails, document findings and assess v1.4.x alternative

### Risk 2: Tool.define() Behavior Change
**Risk**: v1.3.14 fixed Tool.define() bug where `execute` was wrapped multiple times
**Mitigation**: Run `test:regression` to verify all 17 tools execute correctly
**Rollback**: If tools fail, investigate execute path and document behavior differences

### Risk 3: Docker Build Consistency
**Risk**: Docker image builds may fail or produce inconsistent results across environments
**Mitigation**: Use `--no-cache` for initial build, document exact build process
**Rollback**: Keep v1.2.25 Dockerfile version in git history for quick reversion

### Risk 4: Plugin Installation Mechanism
**Risk**: v1.3.11 changed plugin installation mechanics (version pinning, script blocking)
**Mitigation**: Verify `prepublishOnly` script runs correctly in v1.3.14 context
**Rollback**: If installation fails, document blocking mechanism and assess workarounds

## Migration Plan

### Step 1: Version Alignment (Development)
1. Update `Dockerfile.opencode` line 13 to pin v1.3.14
2. Update `package.json` dependencies to v1.3.14
3. Run `npm install` to update lockfile
4. Commit changes to feature branch

### Step 2: Local Verification (Development)
```bash
# Build Docker image with new version
docker compose build --no-cache

# Start container
docker compose up -d

# Run verification inside container
docker compose exec opencode-dev npm run verify:full
```

### Step 3: Focused Hook Validation (Development)
```bash
# Specific hook tests
npm run test:foundation  # session.idle validation
npm run test:regression  # 17 tools validation
npm run test:e2e         # end-to-end flow
```

### Step 4: Documentation (Development)
1. Update `docs/OPENCODE_COMPATIBILITY.md` with v1.3.14 verified status
2. Document any behavior changes or workarounds required
3. Update roadmap.md to mark BL-059 as done

### Step 5: Rollback Strategy (If Needed)
```bash
# Revert Dockerfile.opencode
git checkout HEAD~1 -- Dockerfile.opencode

# Revert package.json
git checkout HEAD~1 -- package.json package-lock.json

# Rebuild and retest
docker compose build --no-cache
docker compose exec opencode-dev npm run verify:full
```

## Open Questions

1. **Q**: Should we create a separate Dockerfile for v1.4.x testing?
   **A**: Out of scope for BL-059. BL-056/BL-060 will handle v1.4.0+ evaluation.

2. **Q**: Do we need version-specific test configurations?
   **A**: BL-057 (SDK upgrade test matrix) will address multi-version testing.

3. **Q**: What if `session.idle` doesn't trigger in v1.3.14?
   **A**: Document the behavior difference, assess v1.4.x alternative, or file upstream issue.