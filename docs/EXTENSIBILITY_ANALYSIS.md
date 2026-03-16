# OpenCode Extensibility Analysis: Memory Search/Delete/Clear UX Options

**Date**: March 16, 2026  
**Project**: lancedb-opencode-pro (v0.1.0)  
**Current Implementation**: Plugin-based tools (memory_search, memory_delete, memory_clear, memory_stats)

---

## EXECUTIVE SUMMARY

This project currently exposes memory management as **AI-invoked tools** (plugin tools). Three extensibility pathways exist in OpenCode:

1. **Plugin Tools** (Current) ✅ - AI-only invocation
2. **Plugin Commands** (Experimental/In-Progress) ⚠️ - Direct user invocation via slash commands
3. **Custom Commands** (Stable) ✅ - Prompt-based slash commands
4. **Custom Tools** (Stable) ✅ - Local tool definitions

**Recommendation**: Evaluate whether to:
- **Keep current approach** (tools only) - simpler, AI-driven
- **Add plugin commands** (when stable) - direct user control, lower latency
- **Hybrid approach** - tools for AI + commands for direct access

---

## PART 1: CURRENT STATE (EVIDENCE-BASED)

### 1.1 Current Implementation: Plugin Tools

**Source**: [lancedb-opencode-pro/src/index.ts](https://github.com/ichiayi-238/lancedb-opencode-pro/blob/main/src/index.ts)

The project currently registers **4 tools** via the plugin system:

```typescript
tool: {
  memory_search: tool({...}),    // Hybrid search (vector + BM25)
  memory_delete: tool({...}),    // Delete by ID (requires confirm=true)
  memory_clear: tool({...}),     // Clear scope (requires confirm=true)
  memory_stats: tool({...}),     // Show index health
}
```

**Characteristics**:
- ✅ Distributed via npm package (`lancedb-opencode-pro`)
- ✅ Automatically loaded when configured in `opencode.json`
- ✅ AI can invoke directly
- ❌ Users cannot invoke directly (no slash command)
- ❌ Adds latency for simple queries (AI processing overhead)

**Evidence**: 
- Package.json declares `@opencode-ai/plugin@1.2.25` as dependency
- Plugin exports default `Plugin` type from `@opencode-ai/plugin`
- Tools are registered in `hooks.tool` object

---

## PART 2: OPENCODE EXTENSIBILITY ARCHITECTURE

### 2.1 Three-Tier Extensibility System

**Source**: [OpenCode Docs - Plugins](https://opencode.ai/docs/plugins/) | [OpenCode Docs - Custom Tools](https://opencode.ai/docs/custom-tools/) | [OpenCode Docs - Commands](https://opencode.ai/docs/commands/)

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTENSIBILITY TIERS                      │
├─────────────────────────────────────────────────────────────┤
│ TIER 1: PLUGINS (Heavy)                                     │
│ - Hook into events (session.idle, file.edited, etc.)        │
│ - Register custom tools                                     │
│ - Modify system behavior                                    │
│ - Distribution: npm packages or local files                 │
│ - Load: .opencode/plugins/ or config                        │
├─────────────────────────────────────────────────────────────┤
│ TIER 2: CUSTOM TOOLS (Medium)                               │
│ - Functions LLM can call                                    │
│ - Can invoke scripts in any language                        │
│ - Distribution: Local (.opencode/tools/) or via plugin      │
│ - Invocation: AI-only (no direct user access)               │
├─────────────────────────────────────────────────────────────┤
│ TIER 3: CUSTOM COMMANDS (Light)                             │
│ - Slash commands (/command) in TUI                          │
│ - Prompt templates with placeholders                        │
│ - Distribution: Local (.opencode/commands/) or config       │
│ - Invocation: Direct user input (no AI needed)              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Plugin System (Tier 1)

**Official Documentation**: https://opencode.ai/docs/plugins/

#### Loading Mechanisms

| Method | Location | Scope | Auto-Install |
|--------|----------|-------|--------------|
| **npm packages** | `opencode.json` config | Global | Yes (via Bun) |
| **Local files** | `.opencode/plugins/` | Project | No |
| **Global files** | `~/.config/opencode/plugins/` | Global | No |

#### Plugin Capabilities

**Hooks Available** (from official docs):
- `command.executed` - When user runs command
- `file.edited`, `file.watcher.updated` - File changes
- `message.updated`, `message.removed` - Session messages
- `session.idle`, `session.compacted` - Session lifecycle
- `tool.execute.before`, `tool.execute.after` - Tool execution
- `tui.command.execute` - TUI command execution
- `experimental.session.compacting` - Compaction customization

**Tool Registration**:
```typescript
// From plugin
export const MyPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      mytool: tool({
        description: "...",
        args: { /* Zod schema */ },
        async execute(args, context) { /* ... */ }
      })
    }
  }
}
```

**Evidence**: [opencode.ai/docs/plugins](https://opencode.ai/docs/plugins/) - Last updated Mar 15, 2026

---

### 2.3 Custom Tools (Tier 2)

**Official Documentation**: https://opencode.ai/docs/custom-tools/

#### Characteristics

| Aspect | Details |
|--------|---------|
| **Definition** | TypeScript/JavaScript files |
| **Location** | `.opencode/tools/` (project) or `~/.config/opencode/tools/` (global) |
| **Invocation** | AI-only (LLM calls them) |
| **Language Support** | Tool definition in TS/JS, execution in any language |
| **Distribution** | Local files or via npm plugin |
| **Naming** | Filename becomes tool name (e.g., `database.ts` → `database` tool) |

#### Example Structure

```typescript
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Query the project database",
  args: {
    query: tool.schema.string().describe("SQL query"),
  },
  async execute(args, context) {
    // context: { agent, sessionID, messageID, directory, worktree }
    return `Executed query: ${args.query}`
  },
})
```

**Evidence**: [opencode.ai/docs/custom-tools](https://opencode.ai/docs/custom-tools/) - Last updated Mar 15, 2026

---

### 2.4 Custom Commands (Tier 3)

**Official Documentation**: https://opencode.ai/docs/commands/

#### Characteristics

| Aspect | Details |
|--------|---------|
| **Definition** | Markdown files with YAML frontmatter |
| **Location** | `.opencode/commands/` (project) or `~/.config/opencode/commands/` (global) |
| **Invocation** | Direct user input (`/command-name`) |
| **Execution** | Sends prompt to LLM (not direct execution) |
| **Placeholders** | `$ARGUMENTS`, `$1`, `$2`, `!`command`` (shell output), `@file` (file content) |
| **Configuration** | Via markdown files or `opencode.json` config |

#### Example Structure

```markdown
---
description: Run tests with coverage
agent: build
model: anthropic/claude-3-5-sonnet-20241022
---

Run the full test suite with coverage report and show any failures.
Focus on the failing tests and suggest fixes.
```

**Usage**: `/test` in TUI

**Evidence**: [opencode.ai/docs/commands](https://opencode.ai/docs/commands/) - Last updated Mar 15, 2026

---

## PART 3: PLUGIN COMMANDS (EXPERIMENTAL FEATURE)

### 3.1 Feature Status

**Status**: 🔴 **EXPERIMENTAL / IN-PROGRESS** (as of March 2026)

**Evidence**:
- PR #7563: "feat(opencode) plugin commands" - OPEN (created Jan 10, 2026)
  - https://github.com/anomalyco/opencode/pull/7563
  - 8 commits, last activity Jan 30, 2026
  - Marked as `experimental.pluginCommands` feature flag
  
- Issue #10262: "[FEATURE]: Allow plugins to register slash commands" - OPEN (created Jan 23, 2026)
  - https://github.com/anomalyco/opencode/issues/10262
  - Assigned to @thdxr (core maintainer)
  - Related PR #10261 (feat(core): add plugin-registered slash commands)

### 3.2 What Plugin Commands Enable

**Problem Being Solved** (from PR #7563):
> Currently, plugin tools can only be invoked by the AI. Users cannot directly invoke plugin functionality from the command input without going through the AI, which:
> - Adds latency and token costs for simple operations
> - Requires AI involvement for tasks that don't need it
> - Limits plugin utility for status checks, statistics, and other quick queries

**Proposed Solution**:
Allow plugin tools to optionally appear as slash commands with **direct execution** (no AI processing).

### 3.3 Proposed API (From PR #7563)

**Uncertainty Note**: PR is still open; exact API may change before merge.

Expected capability:
```typescript
export const MyPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      memory_search: tool({
        description: "Search memory",
        command: true,  // ← NEW: expose as slash command
        args: { /* ... */ },
        async execute(args) { /* ... */ }
      })
    }
  }
}
```

**Backwards Compatibility**: 
- ✅ Fully backwards compatible
- `command` defaults to `false`
- Existing plugins work unchanged

**Evidence**: 
- PR #7563 summary states: "Fully backwards compatible - Existing plugins work unchanged"
- Feature behind `experimental.pluginCommands` flag

---

## PART 4: DISTRIBUTION & NPM PACKAGING

### 4.1 Current Project Distribution

**Package Details**:
```json
{
  "name": "lancedb-opencode-pro",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["opencode", "plugin", "memory", "lancedb"],
  "dependencies": {
    "@opencode-ai/plugin": "1.2.25",
    "@opencode-ai/sdk": "1.2.25"
  }
}
```

**Installation Method**:
```bash
npm install -g lancedb-opencode-pro
```

**Configuration** (in `opencode.json`):
```json
{
  "memory": {
    "provider": "lancedb-opencode-pro",
    "dbPath": "~/.opencode/memory/lancedb"
  },
  "plugin": ["lancedb-opencode-pro"]
}
```

**Evidence**: 
- README.md in project root
- package.json declares `@opencode-ai/plugin` as dependency
- Plugin is loaded via config, not as custom tool

### 4.2 What Can Be Distributed via npm

**From Official Docs** (https://opencode.ai/docs/plugins/):

| Component | Distributable | Method |
|-----------|---------------|--------|
| **Plugins** | ✅ Yes | npm package (auto-installed via Bun) |
| **Custom Tools** | ✅ Yes | Via plugin or local `.opencode/tools/` |
| **Custom Commands** | ❌ No | Local `.opencode/commands/` only |
| **Hooks** | ✅ Yes | Via plugin |

**npm Plugin Installation**:
```json
{
  "plugin": [
    "opencode-helicone-session",
    "opencode-wakatime",
    "@my-org/custom-plugin"
  ]
}
```

Packages are cached in `~/.cache/opencode/node_modules/` and installed automatically using Bun.

**Evidence**: [opencode.ai/docs/plugins/#from-npm](https://opencode.ai/docs/plugins/#from-npm)

---

## PART 5: OPTIONS MATRIX FOR MEMORY SEARCH/DELETE/CLEAR UX

### 5.1 Current State (Status Quo)

| Feature | Current | Pros | Cons |
|---------|---------|------|------|
| **memory_search** | Tool (AI-only) | ✅ Integrated with context | ❌ Latency, token cost |
| **memory_delete** | Tool (AI-only) | ✅ Safe (requires confirm) | ❌ Requires AI reasoning |
| **memory_clear** | Tool (AI-only) | ✅ Safe (requires confirm) | ❌ Requires AI reasoning |
| **memory_stats** | Tool (AI-only) | ✅ Integrated with context | ❌ Latency |
| **Distribution** | npm package | ✅ Easy install | ✅ Automatic loading |

### 5.2 Option A: Keep Current (Tools Only)

**Implementation**: No changes

**Pros**:
- ✅ Already working
- ✅ Distributed via npm
- ✅ AI can reason about results
- ✅ Integrated with session context
- ✅ No new dependencies

**Cons**:
- ❌ Users cannot invoke directly
- ❌ Adds latency for simple queries
- ❌ Token cost for every search
- ❌ Cannot be used in non-interactive contexts

**When to Choose**: If memory is primarily for AI context injection, not user-facing operations.

---

### 5.3 Option B: Add Plugin Commands (When Stable)

**Implementation**: Wait for PR #7563 to merge, then add `command: true` to tools

**Expected Code** (once feature is stable):
```typescript
tool: {
  memory_search: tool({
    description: "Search long-term memory",
    command: true,  // ← NEW: expose as /memory_search
    args: { /* ... */ },
    execute: async (args) => { /* ... */ }
  }),
  memory_delete: tool({
    description: "Delete memory entry",
    command: true,  // ← NEW: expose as /memory_delete
    args: { /* ... */ },
    execute: async (args) => { /* ... */ }
  }),
  // ...
}
```

**Pros**:
- ✅ Direct user invocation (`/memory_search`)
- ✅ No AI latency
- ✅ No token cost
- ✅ Backwards compatible (tools still work)
- ✅ Distributed via same npm package
- ✅ Appears in command autocomplete

**Cons**:
- ⚠️ Feature still experimental (PR #7563 not merged)
- ⚠️ API may change before stable release
- ❌ Requires waiting for OpenCode release
- ❌ Users must upgrade OpenCode to use

**Timeline Uncertainty**: 
- PR created Jan 10, 2026
- Last activity Jan 30, 2026
- No merge date announced
- **Status**: UNKNOWN when this will be stable

**When to Choose**: If you want direct user control and can wait for feature stabilization.

---

### 5.4 Option C: Hybrid Approach (Tools + Custom Commands)

**Implementation**: Keep tools + add custom commands for common operations

**Example Custom Commands** (in `.opencode/commands/`):

```markdown
---
description: Search memory
agent: default
---

Search the long-term memory for: $ARGUMENTS

Use the memory_search tool to find relevant information.
```

```markdown
---
description: Show memory stats
agent: default
---

Show the current memory provider status and index health.

Use the memory_stats tool to display this information.
```

**Pros**:
- ✅ Works today (no waiting)
- ✅ Direct user invocation (`/memory-search`)
- ✅ Customizable prompts
- ✅ Can add context/instructions
- ✅ Distributed via npm (in docs/examples)

**Cons**:
- ❌ Still goes through AI (latency)
- ❌ Token cost
- ❌ Less direct than plugin commands
- ❌ Requires users to add commands manually (or via plugin)

**When to Choose**: If you want user-facing commands now, but can accept AI processing.

---

### 5.5 Option D: Custom Tools (Local Alternative)

**Implementation**: Provide `.opencode/tools/` templates in documentation

**Example** (users copy to their project):

```typescript
// .opencode/tools/memory-search.ts
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Search memory directly",
  args: {
    query: tool.schema.string(),
  },
  async execute(args, context) {
    // Call memory_search tool from lancedb-opencode-pro
    // or invoke memory provider directly
    return `Search results for: ${args.query}`
  },
})
```

**Pros**:
- ✅ Works today
- ✅ Users have full control
- ✅ Can customize behavior

**Cons**:
- ❌ Not distributed (manual setup)
- ❌ Duplicates logic
- ❌ Still AI-only invocation
- ❌ Requires users to understand plugin system

**When to Choose**: Only if you want to provide examples; not recommended as primary approach.

---

## PART 6: RECOMMENDATION MATRIX

| Scenario | Recommended Option | Rationale |
|----------|-------------------|-----------|
| **Memory is AI-context only** | A (Keep Current) | Tools are sufficient; no user-facing UX needed |
| **Want direct user commands NOW** | C (Hybrid) | Custom commands work today; acceptable latency |
| **Want optimal UX (can wait)** | B (Plugin Commands) | Best UX once stable; direct execution, no latency |
| **Want both AI + direct access** | B + A (Hybrid) | Tools for AI, plugin commands for users (future) |
| **Uncertain about user needs** | A → C → B (Phased) | Start with tools, add commands, migrate to plugin commands |

---

## PART 7: DECISION FRAMEWORK

### Questions to Answer

1. **Who are the primary users?**
   - AI agents only? → Option A
   - Humans + AI? → Option C or B
   - Humans primarily? → Option B (when stable)

2. **What's the latency tolerance?**
   - <1s required? → Option B (plugin commands)
   - <5s acceptable? → Option C (custom commands)
   - No constraint? → Option A (tools)

3. **Can you wait for feature stabilization?**
   - No (need now) → Option C
   - Yes (can wait) → Option B

4. **Is this a user-facing product?**
   - Yes → Option B or C
   - No (internal tool) → Option A

---

## PART 8: IMPLEMENTATION ROADMAP (RECOMMENDED)

### Phase 1: Current (Immediate)
- ✅ Keep plugin tools as-is
- ✅ Document memory tools in README
- ✅ Provide example custom commands in docs

### Phase 2: Near-term (Next 1-2 months)
- ⏳ Monitor PR #7563 for merge status
- ⏳ Add custom commands to `.opencode/commands/` examples
- ⏳ Test with early adopters

### Phase 3: Medium-term (When PR #7563 merges)
- 🔄 Add `command: true` to tools (if API stable)
- 🔄 Update documentation
- 🔄 Release v0.2.0 with plugin command support

### Phase 4: Long-term (Optimization)
- 📊 Gather user feedback on UX
- 📊 Consider direct memory API (non-tool)
- 📊 Optimize for common workflows

---

## PART 9: UNCERTAINTY & CAVEATS

### Known Unknowns

1. **Plugin Commands API Stability**
   - PR #7563 is still open (not merged)
   - Exact API may change
   - No announced merge date
   - **Recommendation**: Monitor PR for updates before committing to this path

2. **OpenCode Release Timeline**
   - Feature is experimental
   - No ETA for stable release
   - **Recommendation**: Don't block on this; use Option C as interim

3. **User Demand**
   - No data on whether users want direct memory commands
   - May be satisfied with AI-only tools
   - **Recommendation**: Gather feedback before investing heavily

4. **Performance Characteristics**
   - Plugin commands latency unknown
   - No benchmarks available
   - **Recommendation**: Test once feature is available

### Assumptions Made

- OpenCode plugin system remains stable (high confidence)
- npm distribution mechanism unchanged (high confidence)
- Custom commands work as documented (high confidence)
- Plugin commands will eventually stabilize (medium confidence)

---

## REFERENCES

### Official OpenCode Documentation
- **Plugins**: https://opencode.ai/docs/plugins/ (Last updated Mar 15, 2026)
- **Custom Tools**: https://opencode.ai/docs/custom-tools/ (Last updated Mar 15, 2026)
- **Commands**: https://opencode.ai/docs/commands/ (Last updated Mar 15, 2026)

### GitHub Issues & PRs
- **PR #7563**: feat(opencode) plugin commands
  - https://github.com/anomalyco/opencode/pull/7563
  - Status: OPEN (created Jan 10, 2026)
  
- **Issue #10262**: [FEATURE]: Allow plugins to register slash commands
  - https://github.com/anomalyco/opencode/issues/10262
  - Status: OPEN (created Jan 23, 2026)

### Project References
- **lancedb-opencode-pro**: https://github.com/ichiayi-238/lancedb-opencode-pro
- **Current Implementation**: src/index.ts (Plugin with 4 tools)
- **Package**: @opencode-ai/plugin@1.2.25

---

## CONCLUSION

The project currently uses **plugin tools** (Option A), which is a solid foundation. Three paths forward exist:

1. **Status Quo** (A): Sufficient if memory is AI-context only
2. **Hybrid** (C): Add custom commands for user-facing UX (works today)
3. **Plugin Commands** (B): Wait for experimental feature to stabilize (best UX, timeline uncertain)

**Recommended Next Step**: 
- Clarify whether memory search/delete/clear should be user-facing
- If yes, implement Option C (custom commands) as interim solution
- Monitor PR #7563 for plugin commands stabilization
- Plan migration to Option B once stable

