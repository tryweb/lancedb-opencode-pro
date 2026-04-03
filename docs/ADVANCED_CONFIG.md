# Advanced Configuration Guide

**For users who have installed the plugin and want to dive deeper**

---

## Table of Contents

1. [Retrieval Settings](#retrieval-settings)
2. [Memory Injection Control](#memory-injection-control)
3. [Deduplication Settings](#deduplication-settings)
4. [OpenAI Embedding](#openai-embedding)
5. [Cross-Project Memory Sharing](#cross-project-memory-sharing)
6. [Environment Variable Overrides](#environment-variable-overrides)
7. [Memory Tools Reference](#memory-tools-reference)

---

## Retrieval Settings (v0.1.4+)

### Hybrid Retrieval Architecture

This project uses **Reciprocal Rank Fusion (RRF)** to combine vector search and BM25 keyword search:

```json
{
  "retrieval": {
    "mode": "hybrid",
    "vectorWeight": 0.7,
    "bm25Weight": 0.3,
    "minScore": 0.2,
    "rrfK": 60,
    "recencyBoost": true,
    "recencyHalfLifeHours": 72,
    "importanceWeight": 0.4
  }
}
```

### Parameters Overview

| Parameter | Default | Description |
|-----------|---------|-------------|
| `mode` | `"hybrid"` | Search mode: `hybrid`, `vector-only`, `bm25-only` |
| `rrfK` | `60` | RRF ranking constant, smaller values emphasize highly-ranked items |
| `minScore` | `0.2` | Minimum score threshold; results below this are filtered out |
| `recencyBoost` | `true` | Enable recency boost |
| `recencyHalfLifeHours` | `72` | Half-life for recency boost (hours) |
| `importanceWeight` | `0.4` | Weight multiplier for importance |

### Recency Boost Calculation

```
score_final = score_base * (1 + importance_weight) * recency_multiplier

recency_multiplier = 2^(-hours_since_creation / half_life)
```

### Tuning Recommendations

**Scenario 1: Emphasize Latest Information**
```json
{
  "retrieval": {
    "recencyBoost": true,
    "recencyHalfLifeHours": 24
  }
}
```

**Scenario 2: Emphasize Importance**
```json
{
  "retrieval": {
    "importanceWeight": 0.6,
    "recencyBoost": false
  }
}
```

**Scenario 3: Strict Quality Filtering**
```json
{
  "retrieval": {
    "minScore": 0.4,
    "rrfK": 30
  }
}
```

---

## Memory Injection Control (v0.2.4+)

### Injection Modes

```json
{
  "injection": {
    "mode": "adaptive",
    "maxMemories": 5,
    "minMemories": 2,
    "budgetTokens": 4096,
    "maxCharsPerMemory": 1200,
    "summarization": "auto",
    "summaryTargetChars": 400,
    "scoreDropTolerance": 0.15,
    "injectionFloor": 0.2,
    "codeSummarization": {
      "enabled": true,
      "pureCodeThreshold": 500,
      "maxCodeLines": 15,
      "codeTruncationMode": "smart",
      "preserveComments": true,
      "preserveImports": false
    }
  }
}
```

### The Three Injection Modes

#### 1. Fixed (Default)

Always injects a fixed number of memories, regardless of content size.

```json
{
  "injection": {
    "mode": "fixed",
    "maxMemories": 3
  }
}
```

**Best for**: Backward compatibility, simple setups

#### 2. Budget

Limits total injected tokens, accumulating memories until the budget is depleted.

```json
{
  "injection": {
    "mode": "budget",
    "budgetTokens": 1500,
    "summarization": "truncate",
    "summaryTargetChars": 400
  }
}
```

**Best for**: Token-sensitive deployments, context length limitations

#### 3. Adaptive (Recommended)

Dynamically adjusts the number of injected memories based on the score drop-off.

```json
{
  "injection": {
    "mode": "adaptive",
    "maxMemories": 5,
    "minMemories": 2,
    "scoreDropTolerance": 0.15,
    "injectionFloor": 0.2
  }
}
```

**Best for**: Quality-sensitive scenarios, avoiding low-relevance memories

### Summarization Modes

| Mode | Description | Used For |
|------|-------------|----------|
| `none` | No summarization, full text injected | Default, backward compatibility |
| `truncate` | Simple truncation with ellipsis | Fast, generic |
| `extract` | Key sentence extraction (text) / Structure-aware truncation (code) | High-quality summaries |
| `auto` | Content-aware (auto-selects `truncate` or `extract`) | Recommended |

### Code Summarization Settings

```json
{
  "codeSummarization": {
    "enabled": true,
    "pureCodeThreshold": 500,
    "maxCodeLines": 15,
    "codeTruncationMode": "smart",
    "preserveComments": true,
    "preserveImports": false
  }
}
```

| Parameter | Options | Description |
|-----------|---------|-------------|
| `enabled` | `true`, `false` | Whether to enable code summarization |
| `pureCodeThreshold` | `500` | Minimum characters to trigger pure code mode |
| `maxCodeLines` | `15` | Maximum number of code lines to preserve |
| `codeTruncationMode` | `smart`, `signature`, `preserve` | `smart`: Smart truncation, `signature`: Keep signatures only, `preserve`: Keep full |
| `preserveComments` | `true`, `false` | Whether to keep comments when truncating |
| `preserveImports` | `true`, `false` | Whether to keep import blocks when truncating |

### Token Estimation

The system uses the following multipliers to estimate tokens:

- Chinese: 1 character ≈ 0.6 tokens
- English: 1 character ≈ 0.75 tokens
- Code: 1 character ≈ 1.0 token

---

## Deduplication Settings (v0.2.5+)

### Configuration

```json
{
  "dedup": {
    "enabled": true,
    "writeThreshold": 0.92,
    "consolidateThreshold": 0.95
  }
}
```

### Parameters Overview

| Parameter | Default | Description |
|-----------|---------|-------------|
| `enabled` | `true` | Enable/disable deduplication |
| `writeThreshold` | `0.92` | Similarity threshold for marking as potential duplicate at write |
| `consolidateThreshold` | `0.95` | Similarity threshold for background auto-consolidation |

### Workflow

1. **Marking (at Write)**: New memories are compared with existing ones. If similarity ≥ `writeThreshold`, it is marked `isPotentialDuplicate: true`.
2. **Consolidation (Background)**: Triggered by `session.compacted` events, automatically merges memory pairs with similarity ≥ `consolidateThreshold`.

---

## Retention Settings (v0.6.1+)

### Configuration

```json
{
  "retention": {
    "effectivenessEventsDays": 90
  }
}
```

### Parameters Overview

| Parameter | Default | Description |
|-----------|---------|-------------|
| `effectivenessEventsDays` | `90` | Number of days to retain effectiveness events. Set to `0` to disable automatic cleanup. |

### Environment Variable

You can also configure this via environment variable:

```bash
export LANCEDB_OPENCODE_PRO_RETENTION_EVENTS_DAYS=90
```

### Behavior

- **Automatic Cleanup**: When the plugin initializes, events older than the retention period are automatically deleted
- **Manual Cleanup**: Use the `memory_event_cleanup` tool to manually trigger cleanup or export events before deletion
- **Scope Support**: Cleanup can be scoped to project or global events
- **Dry Run**: Use `dryRun: true` to preview events that would be deleted without actually deleting them

### Tools

#### memory_stats

The `memory_stats` tool now includes TTL information:

```json
{
  "eventTtl": {
    "enabled": true,
    "retentionDays": 90,
    "expiredCount": 150,
    "scopeBreakdown": {
      "project:my-project": 100,
      "global": 50
    }
  }
}
```

#### memory_event_cleanup

Clean up expired events manually:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `scope` | string | - | Optional scope filter |
| `dryRun` | boolean | false | Preview without deleting |
| `archivePath` | string | - | Optional path to export JSON before deletion |

Example:

```json
{
  "scope": "project:my-project",
  "dryRun": true
}
```

---

## OpenAI Embedding (v0.1.2+)

### Switch to OpenAI

```json
{
  "embedding": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-your-openai-key"
  }
}
```

### Recommended Environment Variables

```bash
export LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER="openai"
export LANCEDB_OPENCODE_PRO_OPENAI_API_KEY="$OPENAI_API_KEY"
export LANCEDB_OPENCODE_PRO_OPENAI_MODEL="text-embedding-3-small"
export LANCEDB_OPENCODE_PRO_OPENAI_BASE_URL="https://api.openai.com/v1"
```

### Validation Behaviors

- If `embedding.provider=openai` but missing API key → Initialization error
- If `embedding.provider=openai` but missing model → Initialization error
- If `embedding.provider` is not set → Reverts to Ollama by default

### Migration Guide

Full migration process and gotchas: [embedding-migration.md](embedding-migration.md)

### Cost Estimation

For `text-embedding-3-small`:

- Price: $0.02 / 1M tokens
- 1000 characters ≈ 750 tokens
- 1000 memory captures (approx. 200 characters each) ≈ $0.003

---

## Cross-Project Memory Sharing (v0.2.0+)

### Global Scope Detection

The system automatically detects generic knowledge and scopes it globally:

```typescript
GLOBAL_KEYWORDS = [
  // Distribution
  'docker', 'kubernetes', 'nginx',
  // Databases
  'postgresql', 'mongodb', 'redis',
  // Cloud
  'aws', 'gcp', 'azure',
  // Version Control
  'git', 'github',
  // Protocols
  'http', 'grpc', 'websocket'
]
```

### Settings

```json
{
  "includeGlobalScope": true,
  "globalDetectionThreshold": 2,
  "globalDiscountFactor": 0.7,
  "unusedDaysThreshold": 30
}
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `globalDetectionThreshold` | `2` | Global threshold based on occurrences across projects |
| `globalDiscountFactor` | `0.7` | Global memories have their score discounted to 70% |
| `unusedDaysThreshold` | `30` | Number of idle days before global memories can be swept |

### Memory Scope Administration Tools

```text
# Promote to global scope
memory_scope_promote id="abc123" confirm=true

# Demote to project scope
memory_scope_demote id="abc123" confirm=true

# List all global memories
memory_global_list

# List unused global memories
memory_global_list filter="unused"
```

---

## Environment Variable Overrides

All settings can be overridden via system environment variables:

### Base Settings

| Variable | Config Map | Default |
|----------|------------|---------|
| `LANCEDB_OPENCODE_PRO_PROVIDER` | `provider` | `"lancedb-opencode-pro"` |
| `LANCEDB_OPENCODE_PRO_DB_PATH` | `dbPath` | `"~/.opencode/memory/lancedb"` |
| `LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER` | `embedding.provider` | `"ollama"` |
| `LANCEDB_OPENCODE_PRO_EMBEDDING_MODEL` | `embedding.model` | `"nomic-embed-text"` |
| `LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL` | `embedding.baseUrl` | `"http://127.0.0.1:11434"` |

### OpenAI Settings

| Variable | Config Map |
|----------|------------|
| `LANCEDB_OPENCODE_PRO_OPENAI_API_KEY` | `embedding.apiKey` |
| `LANCEDB_OPENCODE_PRO_OPENAI_MODEL` | `embedding.model` |
| `LANCEDB_OPENCODE_PRO_OPENAI_BASE_URL` | `embedding.baseUrl` |
| `LANCEDB_OPENCODE_PRO_OPENAI_TIMEOUT_MS` | `embedding.timeoutMs` |

### Retrieval Settings

| Variable | Config Map | Default |
|----------|------------|---------|
| `LANCEDB_OPENCODE_PRO_RETRIEVAL_MODE` | `retrieval.mode` | `"hybrid"` |
| `LANCEDB_OPENCODE_PRO_VECTOR_WEIGHT` | `retrieval.vectorWeight` | `0.7` |
| `LANCEDB_OPENCODE_PRO_BM25_WEIGHT` | `retrieval.bm25Weight` | `0.3` |
| `LANCEDB_OPENCODE_PRO_MIN_SCORE` | `retrieval.minScore` | `0.2` |
| `LANCEDB_OPENCODE_PRO_RRF_K` | `retrieval.rrfK` | `60` |
| `LANCEDB_OPENCODE_PRO_RECENCY_BOOST` | `retrieval.recencyBoost` | `true` |
| `LANCEDB_OPENCODE_PRO_RECENCY_HALF_LIFE_HOURS` | `retrieval.recencyHalfLifeHours` | `72` |
| `LANCEDB_OPENCODE_PRO_IMPORTANCE_WEIGHT` | `retrieval.importanceWeight` | `0.4` |

### Injection Settings

| Variable | Config Map | Default |
|----------|------------|---------|
| `LANCEDB_OPENCODE_PRO_INJECTION_MODE` | `injection.mode` | `"fixed"` |
| `LANCEDB_OPENCODE_PRO_INJECTION_MAX_MEMORIES` | `injection.maxMemories` | `3` |
| `LANCEDB_OPENCODE_PRO_INJECTION_MIN_MEMORIES` | `injection.minMemories` | `1` |
| `LANCEDB_OPENCODE_PRO_INJECTION_BUDGET_TOKENS` | `injection.budgetTokens` | `4096` |
| `LANCEDB_OPENCODE_PRO_INJECTION_MAX_CHARS` | `injection.maxCharsPerMemory` | `1200` |
| `LANCEDB_OPENCODE_PRO_INJECTION_SUMMARIZATION` | `injection.summarization` | `"none"` |
| `LANCEDB_OPENCODE_PRO_INJECTION_SUMMARY_TARGET_CHARS` | `injection.summaryTargetChars` | `300` |
| `LANCEDB_OPENCODE_PRO_INJECTION_SCORE_DROP_TOLERANCE` | `injection.scoreDropTolerance` | `0.15` |
| `LANCEDB_OPENCODE_PRO_INJECTION_FLOOR` | `injection.injectionFloor` | `0.2` |
| `LANCEDB_OPENCODE_PRO_CODE_SUMMARIZATION_ENABLED` | `codeSummarization.enabled` | `true` |

### Deduplication Settings

| Variable | Config Map | Default |
|----------|------------|---------|
| `LANCEDB_OPENCODE_PRO_DEDUP_ENABLED` | `dedup.enabled` | `true` |
| `LANCEDB_OPENCODE_PRO_DEDUP_WRITE_THRESHOLD` | `dedup.writeThreshold` | `0.92` |
| `LANCEDB_OPENCODE_PRO_DEDUP_CONSOLIDATE_THRESHOLD` | `dedup.consolidateThreshold` | `0.95` |

### General Settings

| Variable | Config Map | Default |
|----------|------------|---------|
| `LANCEDB_OPENCODE_PRO_INCLUDE_GLOBAL_SCOPE` | `includeGlobalScope` | `true` |
| `LANCEDB_OPENCODE_PRO_GLOBAL_DETECTION_THRESHOLD` | `globalDetectionThreshold` | `2` |
| `LANCEDB_OPENCODE_PRO_GLOBAL_DISCOUNT_FACTOR` | `globalDiscountFactor` | `0.7` |
| `LANCEDB_OPENCODE_PRO_UNUSED_DAYS_THRESHOLD` | `unusedDaysThreshold` | `30` |
| `LANCEDB_OPENCODE_PRO_MIN_CAPTURE_CHARS` | `minCaptureChars` | `80` |
| `LANCEDB_OPENCODE_PRO_MAX_ENTRIES_PER_SCOPE` | `maxEntriesPerScope` | `3000` |

---

## Memory Tools Reference

### Foundational Tools

#### `memory_search`

Search long-term memory.

```text
memory_search query="Your query" [scope="project:my-project"] [limit=10]
```

**Output**: A list of memories along with citation details `[source|status]`

#### `memory_delete`

Delete a single memory.

```text
memory_delete id="abc123" confirm=true
```

**Note**: Required param `confirm=true` to prevent accidental deletion.

#### `memory_clear`

Clear all memories in a specific scope.

```text
memory_clear scope="project:my-project" confirm=true
```

**Note**: Required param `confirm=true` to prevent accidental deletion.

#### `memory_stats`

Show memory statistics.

```text
memory_stats [scope="project:my-project"]
```

**Output**:
```json
{
  "scope": "project:my-project",
  "totalMemories": 150,
  "oldestEntry": "2026-03-01T10:00:00Z",
  "newestEntry": "2026-03-29T15:30:00Z"
}
```

### Memory Manipulation Tools

#### `memory_remember`

Manually store a new memory chunk.

```text
memory_remember text="Memory content here" [scope="project:my-project"]
```

#### `memory_forget`

Remove or disable a specific memory.

```text
memory_forget id="abc123" confirm=true [force=false]
```

| Parameter | Description |
|-----------|-------------|
| `force=false` | Soft-delete (default), leaves record but marks it deleted |
| `force=true` | Hard-delete, permanently removes record |

#### `memory_what_did_you_learn`

Display a summary of recent learning.

```text
memory_what_did_you_learn [days=7] [scope="project:my-project"]
```

### Feedback Tools (v0.1.3+)

#### `memory_feedback_missing`

Report forgotten memories that should have been captured.

```text
memory_feedback_missing text="Content that should be picked up" labels=["deployment", "docker"]
```

#### `memory_feedback_wrong`

Report incorrect memory assertions.

```text
memory_feedback_wrong id="abc123" reason="Outdated context"
```

#### `memory_feedback_useful`

Report whether memory was helpful.

```text
memory_feedback_useful id="abc123" helpful=true
```

#### `memory_effectiveness`

Show system effectiveness metrics.

```text
memory_effectiveness [scope="project:my-project"]
```

**Example output**: [../README.md#viewing-metrics](../README.md#viewing-metrics)

#### `memory_dashboard`

Show weekly learning dashboard with trends and insights.

```text
memory_dashboard [days=7] [scope="project:my-project"]
```

**Parameters**:
- `days` (1-90): Time window for dashboard. Default: 7.
- `scope`: Filter to a specific scope. Default: current project.

**Output includes**:
- Current period capture/recall/feedback metrics
- Week-over-week trend indicators (improving/stable/declining/insufficient-data)
- Actionable insights for learning quality
- Recent memory breakdown by category

#### `memory_kpi`

Show learning KPI metrics (retry-to-success rate and memory lift).

```text
memory_kpi [days=30] [scope="project:my-project"]
```

**Parameters**:
- `days` (1-365): Time window for KPI calculation. Default: 30.
- `scope`: Filter to a specific scope. Default: current project.

**Metrics**:
- **Retry-to-success rate**: (tasks succeeded after retries) / (total failed tasks)
- **Memory lift**: (success_rate_with_recall - success_rate_without_recall) / success_rate_without_recall

**Status values**: `ok`, `insufficient-data` (< 5 samples), `no-failed-tasks`, `no-recall-data`

### Scope Management Tools (v0.2.0+)

#### `memory_scope_promote`

Promote a memory to global scope.

```text
memory_scope_promote id="abc123" confirm=true
```

#### `memory_scope_demote`

Demote a memory back to project scope.

```text
memory_scope_demote id="abc123" confirm=true
```

#### `memory_global_list`

List global scope memories.

```text
memory_global_list [query="keywords"] [filter="unused"]
```

### Deduplication Tools (v0.2.5+)

#### `memory_consolidate`

Consolidate duplicate memories within a single scope.

```text
memory_consolidate scope="project:my-project" confirm=true
```

#### `memory_consolidate_all`

Consolidate duplicates cross-scope.

```text
memory_consolidate_all confirm=true
```

### Citation Tools (v0.4.0+)

#### `memory_citation`

View/Update citation information.

```text
# View
memory_citation id="abc123"

# Update status
memory_citation id="abc123" status="verified"
```

#### `memory_validate_citation`

Validate citation status.

```text
memory_validate_citation id="abc123"
```

### Interpretation Tools (v0.5.0+)

#### `memory_why`

Explain why a specific memory was recalled.

```text
memory_why id="abc123"
```

#### `memory_explain_recall`

Explain factors of the most recent recall operation.

```text
memory_explain_recall
```

### Episodic Learning Tools (v0.2.7+)

#### `task_episode_create`

Create a new task episode tracking instance.

```text
task_episode_create description="Task description" [scope="project:my-project"]
```

#### `task_episode_query`

Query episode histories.

```text
task_episode_query [scope="project:my-project"] [state="completed"]
```

#### `similar_task_recall`

Retrieve similar tasks via vector similarity.

```text
similar_task_recall query="Task description" [threshold=0.85] [limit=5]
```

#### `retry_budget_suggest`

Suggest retry budgets based on histories.

```text
retry_budget_suggest errorType="build-failed"
```

#### `recovery_strategy_suggest`

Suggest recovery strategies.

```text
recovery_strategy_suggest taskId="task_123"
```

### Docker Compose Port Planning (v0.1.1+)

#### `memory_port_plan`

Plan robust, non-conflicting Docker Ports mappings.

```text
memory_port_plan project="project-alpha" services='[{"name":"web","containerPort":3000}]' rangeStart=23000 rangeEnd=23999 persist=true
```

---

## Operations & Diagnostics

Full monitoring guide: [operations.md](operations.md)

### Health Checks

```text
# General memory system health
memory_stats

# Effectiveness metrics
memory_effectiveness

# Global memories health
memory_global_list

# Potential duplicates identification
memory_consolidate scope="project:my-project" confirm=false
```

### Performance Tuning

- **High Search Latency**: Increase `minScore` threshold, lower `maxEntriesPerScope`
- **Low Recall**: Lower `minScore`, adjust `rrfK`, enable `recencyBoost`
- **Excessive Token Consumption**: Switch to `budget` mode limit, enforce `summarization`

---

**Last Updated**: 2026-03-29  
**Supported Version**: v0.5.0+
