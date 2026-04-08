# OpenCode Plugin Interface Research: v1.2.x vs v1.4.0

**Date**: April 8, 2026  
**Status**: Research Complete  
**Scope**: Plugin interface compatibility analysis for lancedb-opencode-pro migration

---

## Executive Summary

This document compares OpenCode plugin interfaces between v1.2.x and v1.4.0, identifying breaking changes, migration requirements, and recommendations for lancedb-opencode-pro compatibility.

### Key Findings

| Aspect | v1.2.x | v1.3.8+ | v1.4.0+ |
|--------|--------|---------|---------|
| **Stability** | ✅ Stable | ❌ Broken (NAPI bug) | ⚠️ Unknown |
| **SDK Changes** | Baseline | Same as v1.2.x | **Breaking changes** |
| **Diff Metadata** | `{to, from, patch}` | `{to, from, patch}` | `{patch}` only |
| **UserMessage.variant** | Top-level | Top-level | Nested under `model` |
| **NAPI Addon** | ✅ Working | ❌ Broken (Issue #20623) | Unknown |

### Recommendation

1. **Short-term**: Stay on v1.3.7 or earlier (current recommendation)
2. **Medium-term**: Monitor v1.4.0+ NAPI bug fix status
3. **Long-term**: Migrate to v1.4.0+ when stable, with SDK breaking change handling

---

## Version Timeline

| Version | Release Date | Key Features | Status |
|---------|--------------|--------------|--------|
| **v1.2.0** | Feb 14, 2026 | SQLite migration, PartDelta SDK event | ✅ Stable |
| **v1.2.25** | Mar 12, 2026 | Last v1.2.x used by this plugin | ✅ Working |
| **v1.2.27** | Mar 16, 2026 | Last v1.2.x stable release | ✅ Recommended |
| **v1.3.0** | Mar 22, 2026 | Node.js support, Git-backed review | ⚠️ Transition |
| **v1.3.7** | - | Last known working version | ✅ Working |
| **v1.3.8+** | - | Plugin loader refactor | ❌ Broken (Issue #20623) |
| **v1.4.0** | Apr 8, 2026 | Breaking SDK changes, diff metadata | ⚠️ Unknown |

---

## Breaking Changes in v1.4.0

### 1. Diff Metadata Structure Change

**Before (v1.2.x - v1.3.7)**:
```typescript
// diff metadata contained full file contents
interface DiffMetadata {
  to: string;      // Full file content after change
  from: string;    // Previous file content  
  patch: string;   // Unified diff
}
```

**After (v1.4.0+)**:
```typescript
// Only patch remains, file contents removed
interface DiffMetadata {
  patch: string;   // Unified diff only
}
```

**Impact on lancedb-opencode-pro**: 
- Minimal direct impact (plugin doesn't process diff metadata directly)
- If future features need file content comparison, must reconstruct from patch

### 2. UserMessage.variant Nesting Change

**Before (v1.2.x - v1.3.7)**:
```typescript
// variant was top-level field
userMessage.variant
```

**After (v1.4.0+)**:
```typescript
// variant nested under model
userMessage.model.variant
```

**Impact on lancedb-opencode-pro**:
- Current code doesn't use `UserMessage.variant`
- Future features should use `msg.model.variant` if needed

---

## Plugin Hooks API Comparison

### Stable Hooks (All Versions)

From official documentation and real-world implementations:

| Hook Name | Purpose | Stability |
|-----------|---------|-----------|
| `config` | Configuration reload | ✅ Stable |
| `event` | Session lifecycle events | ✅ Stable |
| `session.created` | New session initialization | ✅ Stable |
| `session.idle` | Session idle/first message | ✅ Stable |
| `session.end` | Session cleanup | ✅ Stable |
| `session.compacted` | Session compaction complete | ✅ Stable |
| `tool.execute.before` | Pre-tool validation | ✅ Stable |
| `tool.execute.after` | Post-tool processing | ✅ Stable |
| `file.edited` | File change notification | ✅ Stable |

### Experimental Hooks (Use with Caution)

| Hook Name | Purpose | Documentation Status |
|-----------|---------|---------------------|
| `experimental.chat.messages.transform` | Transform messages before API call | ⚠️ Community-only |
| `experimental.chat.system.transform` | Modify system prompt | ⚠️ Community-only |
| `experimental.text.complete` | Buffer assistant responses | ⚠️ Undocumented |
| `experimental.session.compacting` | Add compaction context | ⚠️ Partial docs |

**Note**: Experimental hooks may change between versions without notice.

---

## Current Plugin Implementation

### Dependencies (package.json)

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "1.2.25",
    "@opencode-ai/sdk": "1.2.25"
  }
}
```

### Hooks Used (src/index.ts)

```typescript
const hooks: Hooks = {
  config: async (config) => { /* ... */ },
  event: async ({ event }) => { /* ... */ },
  "experimental.text.complete": async (input, output) => { /* ... */ },
  "experimental.chat.system.transform": async (input, output) => { /* ... */ },
  tool: { /* ... */ }
};
```

### Types Used

```typescript
import type { Hooks, Plugin } from "@opencode-ai/plugin";
import type { Part, TextPart } from "@opencode-ai/sdk";
```

---

## Known Issue: v1.3.8+ NAPI Addon Bug

### Root Cause

OpenCode v1.3.8 introduced a plugin loader refactor (PR #20112) that breaks native NAPI addon resolution:

```
v1.3.8+ Plugin Loader:
  resolvePackagePath() + pathToFileURL()
  → @lancedb/lancedb resolves to empty object {}
  → import("@lancedb/lancedb") returns {}
  → store.init() fails silently
```

### Affected Versions

| Version Range | Status | Workaround |
|---------------|--------|------------|
| v1.2.x - v1.3.7 | ✅ Working | None needed |
| v1.3.8 - v1.3.13 | ❌ Broken | Downgrade to v1.3.7 |
| v1.4.0+ | ⚠️ Unknown | Monitor Issue #20623 |

### Reference

- **Issue**: https://github.com/anomalyco/opencode/issues/20623
- **PR that introduced bug**: https://github.com/anomalyco/opencode/pull/20112

---

## Migration Path to v1.4.0+

### Phase 1: Preparation (Before Migration)

1. **Audit SDK Usage**
   - Check all imports from `@opencode-ai/plugin` and `@opencode-ai/sdk`
   - Identify any code that accesses `diff.to`, `diff.from`, or `userMessage.variant`

2. **Update Type Definitions**
   - Update to `@opencode-ai/plugin@^1.4.0` type definitions
   - Verify TypeScript compilation with new types

3. **Test Compatibility**
   - Create test matrix for v1.2.x, v1.3.7, v1.4.0+
   - Test NAPI addon loading on each version

### Phase 2: Code Changes

1. **Diff Metadata Handling** (if needed)
   ```typescript
   // BEFORE (v1.2.x)
   const { to, from, patch } = diffMetadata;
   
   // AFTER (v1.4.0+)
   const { patch } = diffMetadata;
   // Reconstruct file content from patch if needed
   ```

2. **UserMessage.variant Access** (if needed)
   ```typescript
   // BEFORE (v1.2.x)
   const variant = userMessage.variant;
   
   // AFTER (v1.4.0+)
   const variant = userMessage.model?.variant;
   ```

### Phase 3: Testing & Validation

1. **Unit Tests**: Verify all hook invocations
2. **Integration Tests**: Test with OpenCode v1.4.0+
3. **NAPI Tests**: Verify LanceDB loading works
4. **Regression Tests**: Test all 17 memory tools

---

## Real-World Plugin Implementations

### Reference Repositories

| Repository | Purpose | Hook Usage |
|------------|---------|------------|
| [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | Comprehensive plugin with 30+ hooks | All hooks |
| [context-mode](https://github.com/mksglu/context-mode) | Minimal plugin example | tool hooks, session hooks |
| [compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin) | Claude Code hook conversion | Hook event mapping |
| [everything-claude-code](https://github.com/affaan-m/everything-claude-code) | Hook migration patterns | Pre/post tool hooks |

### Key Patterns

```typescript
// Standard plugin export
import type { Plugin, Hooks } from "@opencode-ai/plugin";

const plugin: Plugin = async (ctx) => {
  return {
    // Hook implementations
    "tool.execute.before": async (input, output) => { /* ... */ },
    "experimental.chat.system.transform": async (input, output) => { /* ... */ },
    tool: { /* tool definitions */ }
  };
};

export default plugin;
```

---

## Recommendations for lancedb-opencode-pro

### Immediate Actions

1. **Keep Current Version**: Stay on `@opencode-ai/plugin@1.2.25` / `@opencode-ai/sdk@1.2.25`
2. **Document Compatibility**: Update OPENCODE_COMPATIBILITY.md with v1.4.0 status
3. **Monitor Issue #20623**: Track NAPI bug fix progress

### Medium-term Actions

1. **Test Matrix**: Create automated tests for multiple OpenCode versions
2. **Version Detection**: Add runtime OpenCode version detection
3. **Graceful Degradation**: Improve error messages for version-specific failures

### Long-term Actions

1. **SDK Upgrade**: When v1.4.0+ is stable, update SDK dependencies
2. **Type Updates**: Update TypeScript types for new SDK
3. **Migration Guide**: Document breaking changes for users

---

## Compatibility Decision Tree

```
┌─ Using lancedb-opencode-pro?
│
├─ YES → Check OpenCode version
│  │
│  ├─ v1.2.x - v1.3.7 → ✅ Works perfectly
│  │
│  ├─ v1.3.8 - v1.3.13 → ❌ Broken (Issue #20623)
│  │  └─ Solution: Downgrade to v1.3.7
│  │
│  └─ v1.4.0+ → ⚠️ Unknown status
│     ├─ NAPI loading works? → ✅ Probably fine
│     └─ NAPI loading fails? → ❌ Same bug as v1.3.8
│        └─ Wait for fix or use v1.3.7
│
└─ NO → Install from npm
   └─ Configure in ~/.config/opencode/opencode.json
```

---

## Open Questions

1. **v1.4.0 NAPI Status**: Is the NAPI bug fixed in v1.4.0?
2. **Plugin Commands Feature**: When will PR #7563 (plugin slash commands) merge?
3. **SDK Version Compatibility**: Can we update to `@opencode-ai/plugin@1.4.0` types without runtime changes?

---

## References

### Official Documentation

- **Plugins**: https://opencode.ai/docs/plugins/
- **Custom Tools**: https://opencode.ai/docs/custom-tools/
- **Commands**: https://opencode.ai/docs/commands/
- **Changelog**: https://opencode.ai/changelog

### GitHub References

- **Issue #20623** (NAPI bug): https://github.com/anomalyco/opencode/issues/20623
- **PR #20112** (Plugin loader refactor): https://github.com/anomalyco/opencode/pull/20112
- **PR #7563** (Plugin commands): https://github.com/anomalyco/opencode/pull/7563
- **Issue #10262** (Slash commands feature): https://github.com/anomalyco/opencode/issues/10262

### Plugin Development

- **Plugin Development Guide**: https://gist.github.com/rstacruz/946d02757525c9a0f49b25e316fbe715
- **OpenCode SDK Types**: https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-08 | 1.0.0 | Initial research document |

---

**Last Updated**: April 8, 2026  
**Next Review**: When OpenCode v1.4.0+ NAPI status is confirmed