## Context

This design addresses BL-013: `/why-this-memory` 解釋能力 - enabling users to understand why a memory was recalled and what factors contributed to its ranking.

The memory system already has rich metadata (citation, recency, importance, scope) but this information is not exposed to users. This feature will surface those factors in an understandable way.

## Goals / Non-Goals

**Goals:**
- Expose recall factors: relevance score, recency, citation status, importance, scope match
- Provide on-demand explanation via `memory_why` tool
- Support explanation of last recall operation
- Integrate explanation into auto-injected context

**Non-Goals:**
- Real-time recalculation of scores (explanation is derived from stored metadata)
- Natural language generation beyond template-based explanations
- Cross-session recall history (per-session explanation only)

## Decisions

| Decision | Choice | Why | Trade-off |
|---|---|---|---|
| Runtime surface | opencode-tool | User-facing feature requiring explicit invocation | Must ensure tool is discoverable |
| Entrypoint | src/index.ts -> tools: `memory_why`, `memory_explain_recall` | Direct user tools for explanation requests | Additional tool registration overhead |
| Data model | Derive from existing metadata (no new schema) | Leverages existing BL-023 citation, BL-025 recency | Limited to existing metadata fields |
| Explanation format | Template-based with score breakdown | Deterministic, no LLM dependency | Less natural than LLM-generated |
| Explanation scope | Per-memory and per-recall-session | Covers both explicit query and auto-inject | Need to track recall session |

## Operability

### Trigger Path

1. **User-triggered**: User invokes `memory_why id="<memory-id>"`
2. **Auto-inject**: System adds explanation snippet to injected memories

### Expected Visible Output

```
Memory: "Use React useState hook for counter"
Explanation:
- Relevance: 92% (high semantic match to query)
- Recency: 3 days ago (within 72h half-life)
- Citation: verified (from explicit-remember)
- Importance: 0.8 (user-tagged high value)
- Scope: matches current project
```

### Misconfiguration/Failure Behavior

- Memory ID not found: Return "Memory not found" error
- No recall session available: Return "No recent recall to explain"
- Missing metadata fields: Show "N/A" for missing factors

## Observability

- Log explanation requests for feature usage tracking
- Track explanation satisfaction via optional feedback
- Monitor explanation generation latency
