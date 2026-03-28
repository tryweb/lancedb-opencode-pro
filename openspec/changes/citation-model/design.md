## Context

Currently, memory records are stored with basic metadata but lack provenance tracking. When memories are captured or imported, there's no mechanism to:
1. Trace where the memory came from (auto-capture, explicit-remember, import, external)
2. Verify if the source is still valid
3. Determine citation quality for ranking

This design addresses BL-023 (Citation model) and BL-024 (Citation validation pipeline).

## Goals / Non-Goals

**Goals:**
- Add citation fields to MemoryRecord schema
- Implement citation validation pipeline
- Expose citation info in search results
- Support citation-based ranking signals

**Non-Goals:**
- Full external source integration (future work)
- Real-time source verification (future work)
- Cross-instance citation sharing (future work)

## Decisions

| Decision | Choice | Why | Trade-off |
|---|---|---|---|
| Citation storage | Extended metadata JSON | Avoids schema changes; flexible for different source types | Query performance for citation-specific filters |
| Citation status | Enum in metadata | Clear lifecycle: verified → pending → expired | Need to handle migration for existing records |
| Validation timing | On-demand + background | Real-time check for critical uses; background for freshness | Complexity in async validation |

## Risks / Trade-offs

- [Risk] Schema migration for existing databases → Mitigation: Use nullable fields + addColumns pattern
- [Risk] Citation validation adds latency → Mitigation: Async background validation + cache results
- [Trade-off] Metadata JSON vs dedicated columns → Chose JSON for flexibility, can migrate to columns later if needed
