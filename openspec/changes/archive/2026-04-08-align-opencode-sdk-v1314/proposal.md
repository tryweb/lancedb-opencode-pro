# Align OpenCode SDK Version to 1.3.14 for Testing

## Why

The plugin currently uses OpenCode SDK v1.2.25, but the Docker test environment pulls the latest OpenCode version (currently v1.3.14+). Versions v1.3.8-v1.3.13 have critical NAPI loading issues. This creates a version mismatch between developmen tenvironment (SDK v1.2.25) and test environment (OpenCode v1.3.14), preventing proper verification of the SDK upgrade path.

To validate SDK v1.3.14 compatibility, we need to align both the Docker OpenCode version and SDK version to v1.3.14, enabling the team to run `verify:full` and confirm all hooks (particularly `session.idle` and tool execute behaviors) function correctly after the upgrade.

## What Changes

- Pin OpenCode version to v1.3.14 in `Dockerfile.opencode` (currently unpinned/ latest)
- Update `@opencode-ai/plugin` and `@opencode-ai/sdk` from v1.2.25 to v1.3.14 in `package.json`
- Run comprehensive verification suite (`npm run verify:full`) to validate upgrade
- Document v1.3.14 compatibility status in `docs/OPENCODE_COMPATIBILITY.md`

## Capabilities

### New Capabilities

- `opencode-v1314-verification`: Capability to verify plugin compatibility with OpenCode v1.3.14, including session.idle hook triggering, tool execute behavior, and full E2E flow testing.

### Modified Capabilities

- `dependency-upgrade-workflow`: Updated workflow to include OpenCode v1.3.14 specific verification steps for AI SDK v5→v6 migration impacts.

## Impact

### Code Changes
- `Dockerfile.opencode`: Uncomment and update version pinning to v1.3.14
- `package.json`: Update SDK dependencies from v1.2.25 to v1.3.14
- `docs/OPENCODE_COMPATIBILITY.md`: Update compatibility matrix with v1.3.14 status

### Testing Impact
- Docker test environment will use OpenCode v1.3.14 (aligned withSDK version)
- `test:foundation`: Validates session.idle hook and event system compatibility
- `test:regression`: Validates 17 tool execute behaviors after Tool.define() bug fix
- `test:e2e`: Validates full write → restart → search flow

### Dependencies
- `@opencode-ai/plugin`: v1.2.25 → v1.3.14
- `@opencode-ai/sdk`: v1.2.25 → v1.3.14

### Risk Assessment
- **High Risk**: AI SDK v5 → v6 migration (v1.3.4) may affect session.idle hook triggering
- **Medium Risk**: Tool.define() bug fix (v1.3.14) may change execute behavior for all 17 tools
- **Medium Risk**: Plugin installation mechanism changes (v1.3.11) may affect prepublishOnly flow