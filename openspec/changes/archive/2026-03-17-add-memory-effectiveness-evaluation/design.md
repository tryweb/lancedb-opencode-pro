## Context

`lancedb-opencode-pro` already validates core memory behavior with foundation, regression, retrieval, and latency workflows, but those workflows mostly prove technical correctness on synthetic or controlled fixtures. The runtime currently captures memory during session lifecycle hooks, injects recalled memory into prompt context, and exposes management commands, yet it does not record enough structured evidence to answer three product questions: whether memory reduced user repetition, whether the right memories were captured and recalled, and how users can correct storage mistakes.

This change spans multiple modules because it touches capture hooks, recall hooks, memory metadata, user-facing commands, and validation/reporting workflows. The design therefore needs a stable event model so future analysis can evolve without repeatedly changing core memory records.

## Goals / Non-Goals

**Goals:**
- Introduce an append-only evaluation event model that records capture, recall, and feedback outcomes without mutating historical memory records.
- Define quantitative metrics that combine existing offline retrieval quality with online runtime effectiveness signals.
- Add user-facing feedback entrypoints for three cases: memory missing, memory stored incorrectly, and recalled memory usefulness.
- Make evaluation data reportable through documented operator workflows so maintainers can inspect real-world effectiveness and tune capture/recall behavior.

**Non-Goals:**
- Replacing the existing LanceDB memory record schema with a fully new analytics database.
- Building a complete dashboard or external telemetry service in this change.
- Solving all capture-quality issues up front by redesigning extraction heuristics.
- Automating product decisions from feedback; this change focuses on instrumentation and evidence.

## Decisions

### Decision: Keep evaluation data separate from memory records
Use an append-only event stream for effectiveness evidence instead of overloading `MemoryRecord.metadataJson` with every analytics field. Store those events in the same LanceDB database under a dedicated events table so initialization, local durability, and operator backup behavior stay aligned with the existing memory store.

Rationale:
- Memory records represent durable recalled knowledge; evaluation events represent runtime observations and user judgments.
- Append-only events preserve auditability for false-positive and false-negative analysis.
- Separate events allow aggregation and retention changes without rewriting stored memories.

Alternatives considered:
- Extend `metadataJson` only: rejected because it cannot model multiple later feedback events per memory cleanly.
- Emit console-only logs: rejected because they are hard to aggregate and not durable enough for product evaluation.
- Use a separate sidecar analytics store: rejected for the first iteration because it adds another persistence system, migration path, and operator surface area without solving an immediate product need.

### Decision: Measure both offline and online effectiveness
Retain existing offline retrieval metrics and add runtime metrics for capture funnel, recall funnel, feedback-confirmed usefulness, and correction rates.

Rationale:
- Offline metrics catch ranking regressions before release.
- Online metrics answer the real product question: whether memory helped users in actual sessions.
- The two views together distinguish retrieval-quality issues from capture-policy issues.

Alternatives considered:
- Online metrics only: rejected because regressions would be slower to diagnose.
- Offline metrics only: rejected because synthetic success does not prove user value.

### Decision: Represent user correction through explicit feedback commands
Add dedicated memory feedback commands instead of relying on free-form natural-language complaints inside normal chat.

Rationale:
- Structured input yields analyzable labels for false positives, false negatives, and usefulness.
- Users can reference a stable memory id from `memory_search` for wrong-memory reports.
- Explicit commands support future policy tuning and operator review.

Alternatives considered:
- Infer feedback passively from chat language: rejected as too ambiguous for reliable measurement.
- Manual direct DB edits: rejected because it bypasses audit history and is not user friendly.

### Decision: Start with local operator reporting, not an external analytics service
Expose evaluation summaries through local project tooling and documented validation/reporting flows first.

Rationale:
- Fits the current project architecture and avoids adding external services.
- Keeps privacy boundaries aligned with the existing local-first memory model.
- Lets maintainers validate the metric model before committing to a remote telemetry backend.

Alternatives considered:
- Immediate SaaS-style telemetry pipeline: rejected as premature and likely over-scoped.

## Risks / Trade-offs

- [Event volume grows faster than memory volume] -> Mitigation: keep events append-only but bounded by retention policy and scoped reporting commands.
- [Users under-report bad memories or missing memories] -> Mitigation: treat user feedback as one signal alongside automatic funnel metrics, not the only source of truth.
- [Too many feedback commands create UX friction] -> Mitigation: keep commands narrowly scoped and reuse existing memory ids and scope defaults.
- [Evaluation storage leaks sensitive text into analytics] -> Mitigation: prefer ids, hashes, labels, and short excerpts over full duplicated content where possible.
- [Metrics look precise but do not map to product value] -> Mitigation: explicitly separate operational metrics from product-outcome proxies such as repeated-context reduction and manual-search-after-recall rate.

## Migration Plan

1. Add the evaluation event contract and storage/reporting support behind the existing plugin architecture.
2. Emit capture and recall events from current lifecycle hooks without changing external memory behavior.
3. Add structured feedback commands and wire them to event storage.
4. Extend validation/reporting documentation and release-readiness evidence to include effectiveness summaries.
5. Roll back by disabling event writes and feedback commands while leaving existing memory record behavior intact.

## Open Questions

- How much raw text should feedback events retain versus hash or summarize for privacy?
- Should usefulness feedback be explicit only, or should future iterations infer weak signals from follow-up user behavior?
