# Operations

## Embedding Model Migration Behavior

- Records persist `schemaVersion`, `embeddingModel`, and `vectorDim`.
- On startup, the store initializes against the configured embedding dimension.
- Query-time vector similarity is only meaningful when query vector dimension matches record vector dimension.
- If embedding backend is unavailable, retrieval degrades to lexical scoring only.

## Index Health And Stale Recovery

- Store exposes index status via `memory_stats`.
- Vector index creation is best effort; if unavailable, retrieval still works with in-process scoring.
- FTS index creation is best effort; if unavailable, lexical fallback is used.

## Retention Strategy

- Auto-capture writes into active project scope by default.
- Scope retention is count-based (`maxEntriesPerScope`, default `3000`).
- After each auto-capture write, older entries in the same scope are pruned.

## Effectiveness Reporting

- Runtime effectiveness events are stored in the same LanceDB database as memories under a dedicated events table.
- Capture flow records considered, stored, and skipped outcomes with normalized skip reasons when the store is initialized.
- Recall flow records request count, result count, and whether optional memory context was injected.
- User feedback is recorded through `memory_feedback_missing`, `memory_feedback_wrong`, and `memory_feedback_useful`.
- Operators can inspect the aggregated machine-readable summary with `memory_effectiveness` for the active project scope.

### System Health vs Product Value

- **System health metrics**: `capture.successRate`, `capture.skipReasons`, `recall.hitRate`, `recall.injectionRate`, `recall.auto.*`, `recall.manual.*`, and `recall.manualRescueRatio`.
- **Product value metrics**: repeated-context reduction, clarification burden reduction, manual memory rescue rate, correction-signal rate, and sampled recall usefulness.
- High recall availability means the store can return something; it does not prove that the injected memory helped the conversation.
- Zero `feedback.*` counts mean the workflow lacks direct labels, not that memory quality is confirmed.

### Example Workflow

```text
memory_search query="stale token api gateway" limit=5
memory_feedback_useful id="<memory-id>" helpful=true
memory_feedback_missing text="This project prefers blue-green deploys." labels=["preference"]
memory_effectiveness
```

Expected summary fields:

- `capture.considered`, `capture.stored`, `capture.skipped`
- `capture.skipReasons`
- `recall.requested`, `recall.returnedResults`, `recall.injected`
- `recall.auto.requested`, `recall.auto.injected`, `recall.auto.returnedResults`, `recall.auto.hitRate`, `recall.auto.injectionRate`
- `recall.manual.requested`, `recall.manual.returnedResults`, `recall.manual.hitRate`
- `recall.manualRescueRatio`
- `feedback.missing`, `feedback.wrong`, `feedback.useful`
- `feedback.falsePositiveRate`, `feedback.falseNegativeRate`

### Low-Feedback Proxy Metrics

Use these proxy metrics when users rarely submit `memory_feedback_*` commands:

| Proxy metric | What it means | Current evidence source |
|---|---|---|
| Repeated-context reduction | Users repeat less project context across sessions or follow-up turns | Manual conversation review; not instrumented yet |
| Clarification burden | Agent asks fewer reminder or context-recovery questions | Manual conversation review; not instrumented yet |
| Manual memory rescue rate | Users still need `memory_search` after automatic recall | Instrumented: `recall.manual.requested / recall.manualRescueRatio` in `memory_effectiveness` output |
| Correction-signal rate | Users say the recalled context is wrong, stale, or irrelevant | `memory_feedback_wrong`, `memory_feedback_missing`, or conversation review |
| Sampled recall usefulness | Audited recalled memories appear relevant and actually help move work forward | Sample audit of recalled memories |

### Sample Audit Workflow

When explicit feedback is sparse, run a bounded audit instead of assuming quality:

1. Sample 10-20 recent recall injections from the same project scope.
2. For each sample, inspect the recalled memory text and the next assistant reply.
3. Mark whether the memory was relevant, neutral noise, or misleading.
4. Sample 10-20 skipped captures, especially `no-positive-signal`, and check whether important durable knowledge was missed.
5. Treat the audit as release input alongside `memory_effectiveness`, not as a replacement for runtime metrics.

---

## Rollback Criteria

Disable provider in `opencode.json` when any of the following is true:

- Retrieval causes prompt contamination (memory injection overrides user intent).
- Scope filtering leaks memories across project boundaries.
- Embedding backend instability causes repeated hook failures.
- Index creation fails and operational warnings exceed acceptable threshold.

### Rollback Procedure

1. Set `memory.provider` to a different provider or remove `memory` block.
2. Restart OpenCode session.
3. Preserve local DB files under `~/.opencode/memory/lancedb` for later analysis.

### Operator Diagnostics

- Run `memory_stats` to inspect index health and active configuration.
- Run `memory_search` with a known prior phrase to verify recall behavior.
- Run `memory_clear` with `confirm=true` only when decommissioning a scope.
