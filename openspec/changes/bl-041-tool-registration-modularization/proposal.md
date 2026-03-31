# Proposal: BL-041 Tool Registration Modularization

> **Backlog ID**: BL-041  
> **Status**: planned  
> **Surface**: Plugin (internal refactoring)  
> **Release Impact**: internal-only

---

## Problem Statement

`src/index.ts` currently contains 26 tool definitions along with hooks, injection logic, and core business logic. This creates several issues:

1. **High coupling**: Changing one tool's implementation risks breaking others
2. **Hard to test**: Large monolithic file makes unit testing difficult
3. **Code review friction**: 1626 lines in one file is hard to review thoroughly
4. **Slow iteration**: Any change requires understanding the entire file

The roadmap explicitly calls for modularization: "先拆 `tools/memory.ts`、`tools/feedback.ts`、`tools/episodic.ts` 降低耦合"

## Why Now

- The plugin has matured with 26 stable tools
- Future features (BL-040 playbook, BL-037 TTL) will add more tools
- Without modularization, the file will continue to grow, making maintenance increasingly difficult

## Scope

### In Scope
- Split tool definitions into separate modules under `src/tools/`
- Maintain backward compatibility for all tool names and interfaces
- Ensure all existing functionality works identically after refactoring

### Out of Scope
- No changes to tool behavior or schema
- No changes to hook wiring (these can stay in index.ts)
- No new features

## Impacted Modules

- `src/index.ts` → `src/tools/memory.ts`, `src/tools/feedback.ts`, `src/tools/episodic.ts`
- Export interfaces must remain compatible

## Changelog Wording Class

`internal-only` - No user-facing changes. This is purely a refactoring to improve maintainability.

---

## Risk Level

**Low** - This is a refactoring task with no behavioral changes. The primary risk is breaking existing tool exports, which can be caught by the test suite.
