# OpenCode Compatibility & Troubleshooting Guide

**Last Updated**: April 10, 2026  
**Status**: Active  
**Scope**: OpenCode version compatibility, plugin interface changes, NAPI native addon issues

---

## 📋 Version Compatibility Matrix

| OpenCode Version | Status | LanceDB Native | SDK Breaking Changes | Notes |
|------------------|--------|-----------------|---------------------|-------|
| **v1.2.0 - v1.3.7** | ✅ **Stable** | ✅ Working | None | Fully supported |
| **v1.3.8 - v1.3.13** | ⚠️ **Conditional** | ⚠️ Cache-dependent | N/A | Works on fresh install; may fail on skip-version upgrade (see below) |
| **v1.3.14 - v1.3.17** | ✅ **Verified** | ✅ Working | **Minor** | SDK v1.3.14 compatible; Config.plugin type updated |
| **v1.4.0 - v1.4.3** | ✅ **Verified** | ✅ Working | **Breaking (SDK only)** | Fully functional; see SDK breaking changes below |

---

## ✅ OpenCode v1.4.3 Compatibility (Verified April 10, 2026)

**Status**: ✅ **Fully Compatible**

lancedb-opencode-pro **v0.8.1** has been verified working with OpenCode **v1.4.3**:

- ✅ LanceDB NAPI native addon loads correctly
- ✅ TypeScript compilation passes with SDK v1.4.3 types
- ✅ Build succeeds (`npm run build`)
- ✅ All unit and regression tests pass (199 pass, 0 fail)
- ✅ E2E tests pass (auto-capture, search, feedback, episodic learning)
- ✅ `npm run verify:full` clean in Docker (OpenCode v1.4.3 environment)

**Recommendation**: Upgrade to v1.4.3. It is the current stable release.

---

## 🔍 Issue #20623 — Root Cause Clarification

### Original Report

[Issue #20623](https://github.com/sst/opencode/issues/20623): *"Plugins with native NAPI dependencies return empty module ({}) since v1.3.8 plugin loader refactor"*

**Status**: Open (but root cause clarified — see below)

### Author's Update: The Real Root Cause

The issue author subsequently discovered the root cause was **stale plugin cache from skip-version upgrades**, not a fundamental plugin loader bug:

> After further testing, the issue **does not reproduce** when upgrading through each version sequentially (1.3.7 → 1.3.8 → ... → 1.3.13). Every version works correctly when upgraded this way.
>
> The issue **only** occurred after the desktop app auto-updated directly from an older version to 1.3.13. The plugin cache (`~/.cache/opencode/node_modules/`) was stale or corrupted from the jump.

**What actually happened**:

```
Skip-version upgrade (e.g. 1.3.7 → 1.3.13):
  Plugin cache ~/.cache/opencode/node_modules/ NOT rebuilt
  → NAPI .node binaries exist on disk
  → New plugin loader cannot resolve them from stale cache
  → import("@lancedb/lancedb") returns {}
  → All memory tools fail

Fresh install or sequential upgrade:
  bun install rebuilds cache at each version step
  → NAPI .node binaries correctly linked
  → import("@lancedb/lancedb") works normally ✅
```

### Why v1.4.3 Works

1. Fresh install or upgrade through recent versions rebuilds cache correctly
2. The Dockerfile in this project pins OpenCode version explicitly, ensuring clean install
3. No fundamental NAPI loading change was needed — the loader is correct for fresh environments

---

## 🔴 If You See "Memory store unavailable"

### Step 1: Clear the plugin cache (fixes most cases)

```bash
rm -rf ~/.cache/opencode/node_modules/
# Restart OpenCode — it will reinstall all plugins fresh
```

### Step 2: Verify Ollama is accessible

```bash
curl http://127.0.0.1:11434/api/tags
curl http://127.0.0.1:11434/api/embeddings \
  -d '{"model":"nomic-embed-text","prompt":"test"}'
```

### Step 3: Check plugin installation

```bash
ls ~/.cache/opencode/node_modules/lancedb-opencode-pro/dist/
# Should list: index.js, store.js, etc.
```

### Step 4: Advanced — test native module loading directly

```bash
cd ~/.cache/opencode
node -e "const l = require('./node_modules/@lancedb/lancedb'); console.log(Object.keys(l))"
# Should print: [ 'connect', ... ] — not empty []
```

---

## 🔧 Solutions

### Solution 1: Clear Plugin Cache (RECOMMENDED)

**Status**: ✅ Resolves most NAPI loading issues

```bash
rm -rf ~/.cache/opencode/node_modules/
# Restart OpenCode
```

---

### Solution 2: Upgrade to OpenCode v1.4.3

**Status**: ✅ Verified working (April 10, 2026)

```bash
opencode upgrade
opencode --version  # Should output: 1.4.3
```

If upgrading from a very old version, clear cache after upgrade:
```bash
rm -rf ~/.cache/opencode/node_modules/
```

---

### Solution 3: Downgrade to v1.3.7 (Legacy Workaround — Not Recommended)

Only use if you specifically need v1.3.x:

```bash
opencode upgrade 1.3.7
```

---

## 📋 Version Compatibility Details

### v1.3.14 SDK Changes

- **Config.plugin type**: Changed from `string[]` to `(string | [string, PluginOptions])[]`
- **Fix applied in v0.7.0**: Updated `src/config.ts` to import `Config` from `@opencode-ai/plugin`

### v1.4.0+ Breaking SDK Changes

| Change | Before (v1.3.x) | After (v1.4.0+) |
|--------|-----------------|-----------------|
| **Diff metadata** | `{to, from, patch}` | `{patch}` only |
| **UserMessage.variant** | Top-level field | `msg.model.variant` |

**Impact on lancedb-opencode-pro**: Minimal. The plugin does not consume diff metadata or UserMessage.variant. All hooks continue to work unchanged.

---

## 📚 Hook Stability Reference

| Hook | Stability | Used by Plugin |
|------|-----------|----------------|
| `config` | ✅ Stable | ✅ Yes |
| `event` | ✅ Stable | ✅ Yes |
| `tool` | ✅ Stable | ✅ Yes |
| `experimental.text.complete` | ⚠️ Undocumented | ✅ Yes |
| `experimental.chat.system.transform` | ⚠️ Community-only | ✅ Yes |
| `session.created`, `session.idle`, `session.end` | ✅ Stable | ✅ Yes (via event hook) |

---

## 🔍 Related Issues

| Issue | Component | Status | Impact |
|-------|-----------|--------|--------|
| [#20623](https://github.com/sst/opencode/issues/20623) | Plugin cache on skip-version upgrade | Open (root cause: stale cache) | 🟡 Only affects skip-version upgraders; clear cache to fix |
| [#20112](https://github.com/sst/opencode/pull/20112) | Plugin loader refactor | Merged | Was initially blamed; not the actual cause |
| [#20140](https://github.com/sst/opencode/pull/20140) | Fix entrypoint path | Merged v1.3.9 | Fixed separate entrypoint bug |

---

## 📊 Troubleshooting Decision Tree

```
Memory tools failing?
│
├─ "Memory store unavailable"?
│  ├─ Clear cache: rm -rf ~/.cache/opencode/node_modules/
│  │  └─ Restart OpenCode → Fixed? ✅ Done
│  │
│  └─ Still failing? Check Ollama: curl http://127.0.0.1:11434/api/tags
│     ├─ NO → Fix Ollama access first
│     └─ YES → Check logs: ~/.local/share/opencode/log/
│
└─ Plugin not loading?
   └─ Check opencode.json config has "lancedb-opencode-pro" in plugin list
```

---

## 📚 Related Documentation

- **[QUICK_START.md](QUICK_START.md)** — Prerequisites & setup
- **[DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md)** — For developers
- **[ADVANCED_CONFIG.md](ADVANCED_CONFIG.md)** — Configuration reference

---

## 🎯 Summary

| Aspect | Status | Action |
|--------|--------|--------|
| **OpenCode v1.4.3** | ✅ Fully working | Upgrade recommended |
| **NAPI loading issue** | ✅ Cache issue, not loader bug | Clear cache if affected |
| **Issue #20623** | Open but root cause clarified | No code fix needed; clear cache resolves it |
| **lancedb-opencode-pro v0.8.1** | ✅ Compatible with v1.4.3 | Ready to use |

---

**Last Verified**: April 10, 2026  
**Tested On**: OpenCode v1.4.3, lancedb-opencode-pro v0.8.1  
**Status**: No active blocking issues
