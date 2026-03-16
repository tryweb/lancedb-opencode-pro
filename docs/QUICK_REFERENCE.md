# OpenCode Extensibility: Quick Reference

## Current State
- **Project**: lancedb-opencode-pro v0.1.0
- **Current UX**: 4 plugin tools (memory_search, memory_delete, memory_clear, memory_stats)
- **Invocation**: AI-only (no direct user access)
- **Distribution**: npm package ✅

## Three Extensibility Options

### Option A: Keep Current (Tools Only)
- **Status**: ✅ Working now
- **User Access**: ❌ No (AI-only)
- **Latency**: High (AI processing)
- **Cost**: Token cost per query
- **Best For**: AI-context-only use cases

### Option B: Plugin Commands (Experimental)
- **Status**: ⚠️ PR #7563 (OPEN, not merged)
- **User Access**: ✅ Yes (/memory_search)
- **Latency**: Low (direct execution)
- **Cost**: No token cost
- **Best For**: User-facing operations
- **Timeline**: Unknown (waiting for OpenCode release)
- **Evidence**: https://github.com/anomalyco/opencode/pull/7563

### Option C: Hybrid (Tools + Custom Commands)
- **Status**: ✅ Works today
- **User Access**: ✅ Yes (/memory-search)
- **Latency**: Medium (AI processing)
- **Cost**: Token cost per query
- **Best For**: User-facing + AI reasoning
- **Implementation**: Add .opencode/commands/ files

## Decision Matrix

| Need | Recommendation | Why |
|------|---|---|
| AI context only | A | No user UX needed |
| User commands NOW | C | Works today |
| Optimal UX (can wait) | B | Best performance |
| Both AI + users | C then B | Interim + future |

## Key References

**Official Docs** (Last updated Mar 15, 2026):
- Plugins: https://opencode.ai/docs/plugins/
- Custom Tools: https://opencode.ai/docs/custom-tools/
- Commands: https://opencode.ai/docs/commands/

**GitHub Issues**:
- PR #7563: Plugin commands feature (OPEN)
- Issue #10262: Allow plugins to register slash commands (OPEN)

## Implementation Roadmap

1. **Now**: Keep tools as-is
2. **1-2 months**: Monitor PR #7563, add custom command examples
3. **When PR merges**: Add `command: true` to tools
4. **Long-term**: Gather feedback, optimize

## Uncertainty

- **Plugin Commands API**: Not finalized (PR still open)
- **Merge Timeline**: Unknown
- **User Demand**: Not validated
- **Performance**: Not benchmarked

**Recommendation**: Don't block on plugin commands; use Option C as interim if user-facing UX is needed.

---

**Full Analysis**: See `docs/EXTENSIBILITY_ANALYSIS.md` (20KB, comprehensive)
