## Why

Current memory system provides retrieval results but lacks transparency - users cannot understand **why** a particular memory was recalled or ranked higher than others. This creates:

1. **Trust gap**: Users hesitate to rely on memory if they don't understand the recall logic
2. **Debugging difficulty**: Hard to diagnose why irrelevant memories appear
3. **Feedback quality**: Without explanation, users cannot provide accurate relevance feedback
4. **Learning blind spots**: Cannot identify which memory attributes (recency, citation, similarity) drive recall

This addresses BL-013 (`/why-this-memory` 解釋能力).

## What Changes

- Add explanation generation to memory recall operations
- Expose recall factors: relevance score, recency, citation status, importance, scope match
- Create `memory_why` tool for on-demand explanation
- Integrate explanation into auto-injected context for transparency

## Capabilities

### New Capabilities
- `memory_why`: Explain why a specific memory was recalled (given memory ID)
- `memory_explain_recall`: Explain the factors behind last recall operation

### Modified Capabilities
- `memory_search`: Optionally include explanation in results
- Auto-inject: Add explanation snippet to auto-injected memories

## Impact

- **Code**: src/types.ts (Explanation types), src/store.ts (explain methods), src/index.ts (new tools)
- **Schema**: No schema changes (derives explanation from existing metadata)
- **APIs**: New `memory_why` and `memory_explain_recall` tools
- **Dependencies**: Builds on existing BL-023 (Citation model), BL-025 (Freshness/decay), retrieval ranking

## Release Impact

- **Changelog Wording Class**: `user-facing` - This is a user-visible transparency feature
- **Runtime Surface**: `opencode-tool` - Direct user-facing tools
- **Verification Required**: Unit + Integration + E2E (user-facing)
