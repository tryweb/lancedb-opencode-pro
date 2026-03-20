## Context

The `memory_effectiveness` summary currently aggregates all recall events into a single flat structure. The only recall event source is the `experimental.chat.system.transform` hook. Adding manual-search events without splitting would pollute `hitRate` and `injectionRate` because the two sources have fundamentally different semantics: auto-recall injects into the system prompt while manual search returns results directly to the tool caller.

## Goals / Non-Goals

**Goals:**
- Add a first-class `source` field to RecallEvent so the aggregation layer can distinguish event origins without parsing metadataJson.
- Emit a recall event from the `memory_search` tool with `injected: false` and `source: "manual-search"`.
- Split `EffectivenessSummary.recall` into auto and manual sub-structures while preserving blended top-level fields for backward compatibility.
- Expose `manualRescueRatio` as the first instrumented proxy metric from the low-feedback evaluation framework.

**Non-Goals:**
- Instrumenting repeated-context reduction, clarification burden, or correction-signal rate in this change.
- Changing the events table schema to a new table; the existing flat table can accommodate the new `source` column.
- Modifying capture or feedback event types.

## Decisions

### Decision: Add source as a schema-level field on RecallEvent, not only in metadataJson
Rationale: summarizeEvents does not parse metadataJson; a first-class field is the only way to split counts reliably. Old events without source default to `"system-transform"` for backward compatibility.

### Decision: Keep blended top-level recall fields alongside auto/manual sub-structures
Rationale: existing consumers that only read `recall.requested` or `recall.hitRate` continue to work. New consumers read `recall.auto.*` and `recall.manual.*` for precise breakdowns.

### Decision: Set injected=false for all manual-search events
Rationale: manual search returns results to the tool caller, not into the system prompt. Mixing injected semantics would make injectionRate uninterpretable.

## Risks / Trade-offs

- [Old recall events lack source field] -> Mitigation: normalizeEventRow defaults missing source to "system-transform".
- [Events table bootstrap needs a new column] -> Mitigation: add source column with empty-string default in bootstrap row; normalizeEventRow handles the mapping.
- [Manual search with zero results still emits an event] -> Mitigation: this is correct behavior; it contributes to manual.hitRate denominator.
