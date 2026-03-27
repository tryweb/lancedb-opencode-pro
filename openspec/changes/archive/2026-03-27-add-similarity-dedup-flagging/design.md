## Context

The lancedb-opencode-pro memory system auto-captures assistant responses that contain positive signals ("fixed", "done", "resolved", etc.) into LanceDB, indexed by vector embedding and text content. Each session's memories are scoped to the project (`project:{hash}`) with optional global sharing.

**Current problem**: No deduplication exists at write time. If a user asks the same question using different wording across multiple sessions, or re-explains the same issue, the system stores each occurrence as a separate `MemoryRecord`. Over time this causes:

1. **Storage bloat**: `maxEntriesPerScope` (default 3000) fills with near-identical entries, pushing genuinely novel memories out.
2. **Noisy recall**: `memory_search` returns multiple semantically equivalent results for the same query; injection block contains redundant context.
3. **Effectiveness metric degradation**: `recall.manualRescueRatio` rises as users manually search and find duplicates instead of novel information.

**Existing infrastructure**: The codebase already has all primitives needed for similarity-based dedup:
- `fastCosine()` (store.ts:804): pre-computed-norm cosine similarity, O(n) with n = vector dim
- `store.search()` with `vectorWeight=1, bm25Weight=0`: scope-filtered vector-only search
- `ScopeCache`: already tokenizes and caches IDF per scope—no per-query overhead
- `metadataJson`: flexible JSON field requiring no schema migration
- `CaptureSkipReason` enum: already extensible for new skip labels

**Constraint**: Must not block writes. The system should flag, not prevent.

---

## Goals / Non-Goals

**Goals:**
- Flag near-duplicate memories at write time using cosine similarity threshold (no blocking)
- Provide consolidation mechanism to merge duplicates asynchronously
- Preserve full backward compatibility: existing tool interfaces, store schema, and effectiveness event model unchanged
- Reuse existing code primitives rather than introduce new dependencies

**Non-Goals:**
- Cross-scope deduplication (only scope-internal for v1)
- Blocking writes (flagging only)
- Perfect semantic deduplication (threshold-based approximation is acceptable)
- LLM-based semantic judgment (rule-based cosine threshold only)
- Real-time consolidation on every write (background consolidation only)
- MD5 exact-dedup as primary mechanism (hash check is optional enhancement, not core v1)

---

## Decisions

### Decision 1: Write-side flagging, not blocking

**Choice**: After embedding a new memory, query the scope-internal vector index with `limit=1, vectorWeight=1.0, bm25Weight=0`. If `topScore >= 0.92`, write the memory with `isPotentialDuplicate: true` and `duplicateOf: <topRecordId>` in `metadataJson`. Write proceeds regardless.

**Rationale**: Blocking writes risks silently dropping genuinely novel memories that fall below the threshold by a small margin. Flagging preserves all memories while making duplicates observable via `metadataJson`. Operators can inspect duplicates via `memory_search` results and remove via `memory_delete`. The `memory_effectiveness` metrics can surface the prevalence of flagged duplicates over time.

**Alternatives considered**:
- *Blocking with user prompt*: Would require interactive confirmation during `flushAutoCapture()`, which runs in a background hook—architecturally complex and bad UX.
- *Flagging without writing `duplicateOf`*: Makes duplicates observable but not actionable. Storing the reference ID enables both AI-assisted cleanup (via `memory_delete`) and future automated consolidation.

### Decision 2: Threshold 0.92 for flagging, 0.95 for consolidation

**Choice**: Write-side flagging uses 0.92 cosine similarity. Consolidation merge uses 0.95.

**Rationale**: 0.92 is the production-proven standard from Mem0 and the Governed Memory paper (arXiv 2603.17787, March 2026) for write-path deduplication, giving ~1-2% false positive rate and ~5-8% false negative rate. Consolidation uses a higher threshold (0.95) because merging is a more consequential operation—requires higher confidence that two memories are truly redundant.

**Alternatives considered**:
- *Single threshold for both*: Simplifies config but under- or over-connects the two use cases. Flagging needs to be more sensitive (catch near-duplicates); consolidation needs to be conservative (avoid merging distinct memories).
- *Different thresholds per category*: Decision memories (importance 0.9) could use a stricter threshold than preference memories (importance 0.65). Added complexity for marginal gain in v1.

### Decision 3: Scope-internal deduplication only

**Choice**: Similarity search is scoped to `activeScope` only (the current `project:{hash}` scope). Global memories are not checked against project memories, and vice versa.

**Rationale**: `design.md` from the archived change `2026-03-21-add-cross-project-memory-scope` explicitly deferred cross-project deduplication. Project and global memories serve different purposes: project-specific decisions should not interfere with cross-project general knowledge. Adding cross-scope dedup adds merge conflict complexity (if a project memory and global memory are similar, which scope wins?).

**Alternatives considered**:
- *Cross-scope with scope-preference*: Global memories could be checked for project memories, but flagged differently. Postponed—requires new metadata schema and clearer merge semantics.
- *Global-only dedup within global scope*: A global memory referencing the same Docker best practice as another global memory could merge. Postponed—lowest priority given global scope's lower growth rate.

### Decision 4: Reuse `store.search()` for similarity check

**Choice**: In `flushAutoCapture()`, after embedding, call `store.search()` with `{ queryVector, scopes: [activeScope], limit: 1, vectorWeight: 1.0, bm25Weight: 0, minScore: 0.0 }` to get the most similar existing memory.

**Rationale**: Leverages the existing `ScopeCache` infrastructure (already holds tokenized text, IDF, and vector norms for the scope). No new indexing needed. The `search()` method already computes `fastCosine` for all scope records. Reusing it avoids duplicating the scoring logic and keeps dedup behavior consistent with retrieval behavior.

**Alternatives considered**:
- *Direct LanceDB vector search*: Would bypass ScopeCache and require managing a separate query path. More code to maintain.
- *Pre-compute a sorted similarity list on write*: Would add write-time overhead and complexity. Not worth it for a flagging feature.

### Decision 5: Hybrid consolidation trigger — `session.compacted` + external cron backup

**Choice**: Consolidation is primarily triggered by the `session.compacted` hook (opportunistic, per-session). A Unix cron job or scheduled task external to the plugin calls `memory_consolidate` as a backup trigger to ensure consolidation runs even if sessions are long-running or the project is inactive.

**Rationale**: OpenCode plugins have no built-in timer or cron infrastructure—background work is event-driven only. `session.compacted` fires when a working session ends, which is a natural proxy for "user finished a working session." However, if sessions are kept open for days or a project sees infrequent activity, consolidation could be deferred indefinitely. An external cron job calling the `memory_consolidate` tool bridges this gap without adding plugin-internal timer complexity. The tool is idempotent, so concurrent calls are safe.

**Trigger hierarchy**:
1. **Primary**: `session.compacted` → consolidation runs after `flushAutoCapture()` (asynchronous, fire-and-forget)
2. **Backup**: External cron → calls `memory_consolidate(scope, confirm=true)` at a fixed schedule (e.g., daily at 03:00 UTC)
3. **On-demand**: Operator or AI calls `memory_consolidate` tool manually at any time

**Cron example (external)**:
```bash
# ~/.config/opencode/consolidate-cron.sh
#!/bin/bash
# Runs memory_consolidate for all known scopes daily at 03:00 UTC
opencode --memory-consolidate --scope global --confirm
opencode --memory-consolidate --scope "project:$(git remote get-url origin | shasum | cut -c1-16)" --confirm
```

**Alternatives considered**:
- *Dedicated interval inside plugin*: Would require Node.js `setInterval` or similar. OpenCode plugins have no scheduler API; doing this correctly (surviving restarts, deduplicating concurrent runs, respecting shutdown) adds significant complexity. Rejected for v1.
- *Triggered on every N writes*: Adds state tracking to count writes since last consolidation. Session compaction is simpler and already exists.

### Decision 6: Configuration via environment variables and sidecar

**Choice**: Two new top-level config keys under a `dedup` section:
- `dedup.writeThreshold` (env: `LANCEDB_OPENCODE_PRO_DEDUP_WRITE_THRESHOLD`, default: `0.92`)
- `dedup.consolidateThreshold` (env: `LANCEDB_OPENCODE_PRO_DEDUP_CONSOLIDATE_THRESHOLD`, default: `0.95`)
- `dedup.enabled` (env: `LANCEDB_OPENCODE_PRO_DEDUP_ENABLED`, default: `true`)

**Rationale**: Follows the existing config resolution precedence (env vars > sidecar files > defaults). Users who want to disable dedup entirely can set `enabled: false`. Users who want stricter/looser thresholds can override per environment. No changes to the existing `opencode.json` `memory` block structure.

---

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **False positives**: Distinct memories with cosine >0.92 (rare but possible with short texts) | Low | Medium | `isPotentialDuplicate` flag makes them observable; consolidation uses higher 0.95 threshold |
| **Write-time latency**: Extra `store.search()` call adds latency to `flushAutoCapture` | Low | Low | ScopeCache makes search O(1) for cached scopes; first write in a session warms cache |
| **Embedder still required**: If Ollama/OpenAI is down, dedup check is skipped but write proceeds | Low | Low | `ensureInitialized` already handles embedder failures; dedup gracefully degrades |
| **Consolidation conflicts**: Two memories both flagged as duplicates of each other | Very Low | Low | Consolidation processes records sorted by timestamp (newer wins); older is deleted |
| **metadataJson bloat**: `duplicateOf` references accumulate | Medium | Low | Consolidation clears `duplicateOf` when merging; `pruneScope` still runs on age |
| **Flagging without cleanup**: DB still grows if users never act on flagged duplicates | Medium | Medium | `memory_consolidate` tool provides escape hatch; effectiveness metrics surface flagging rate |
| **BM25 channel interference**: If vector channel degrades, dedup relies only on BM25 | Very Low | Medium | Dedup uses `vectorWeight=1.0, bm25Weight=0` explicitly—no BM25 interference |

---

## Migration Plan

1. **No migration needed**: This is an additive feature. Existing memories are unaffected.
2. **Config migration**: New config keys have safe defaults; existing configs work unchanged.
3. **Schema migration**: No schema version bump required (`metadataJson` is already a flexible JSON field).
4. **Deployment**: Deploy alongside existing plugin. Dedup starts flagging on next capture after deployment.
5. **Rollback**: Set `dedup.enabled: false` or set env `LANCEDB_OPENCODE_PRO_DEDUP_ENABLED=false`. Existing `isPotentialDuplicate` flags in `metadataJson` are inert—they do not affect retrieval or injection.
6. **Validation**: Run existing E2E test suite. Add new test case: insert two semantically similar memories, verify second is flagged.

---

## Open Questions

1. ~~Should `memory_search` results display `isPotentialDuplicate` in the output?~~ → **DECIDED: Yes**, `memory_search` results SHALL display `(duplicate)` marker for records with `isPotentialDuplicate: true`.

2. ~~Should consolidation auto-delete the older duplicate, or mark it as "merged into X"?~~ → **DECIDED: Soft delete** — consolidation marks the older record as superseded via `status: "merged"` and `mergedInto: "<newer record id>"` in metadata, and does NOT physically delete it. This preserves audit trail.

3. ~~Should the effectiveness summary include a `duplicates.flagged` metric?~~ → **DECIDED: Yes** — `EffectivenessSummary` SHALL include a `duplicates: { flaggedCount: number, consolidatedCount: number }` section populated from capture events with `skipReason: "duplicate-similarity"`.

4. ~~Should `memory_pruneScope` consider `isPotentialDuplicate` when deciding what to delete?~~ → **DECIDED: Yes** — `pruneScope` SHALL prioritize deletion of records with `isPotentialDuplicate: true` when selecting entries to remove to meet `maxEntriesPerScope`.
