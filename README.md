# lancedb-opencode-pro

LanceDB-backed long-term memory provider for OpenCode.

## Supported OpenCode Versions

- Supported: OpenCode `1.2.27+`
- Configuration model: sidecar config file at `~/.config/opencode/lancedb-opencode-pro.json`
- Not recommended: top-level `memory` in `opencode.json`, because current OpenCode versions reject that key during config validation

## Install

### Primary (Recommended): npm package name

1. Register the published package name in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "oh-my-opencode",
    "lancedb-opencode-pro"
  ]
}
```

If you already use other plugins, keep them and append `"lancedb-opencode-pro"`.

2. For OpenCode `1.2.27+`, create the sidecar config file `~/.config/opencode/lancedb-opencode-pro.json`:

```json
{
  "provider": "lancedb-opencode-pro",
  "dbPath": "~/.opencode/memory/lancedb",
  "embedding": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "baseUrl": "http://127.0.0.1:11434"
  },
  "retrieval": {
    "mode": "hybrid",
    "vectorWeight": 0.7,
    "bm25Weight": 0.3,
    "minScore": 0.2,
    "rrfK": 60,
    "recencyBoost": true,
    "recencyHalfLifeHours": 72,
    "importanceWeight": 0.4
  },
  "includeGlobalScope": true,
  "globalDetectionThreshold": 2,
  "globalDiscountFactor": 0.7,
  "unusedDaysThreshold": 30,
  "minCaptureChars": 80,
  "maxEntriesPerScope": 3000
}
```

3. Set `embedding.baseUrl` to the Ollama endpoint that is reachable from that host.

- Same machine as OpenCode: `http://127.0.0.1:11434`
- Another machine on the network: for example `http://192.168.11.206:11434`

You do not need `LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL` if the sidecar file already contains the correct `embedding.baseUrl`. Use the environment variable only when you want to override the file at runtime.

4. Make sure Ollama is reachable from that host, then start or restart OpenCode:

```bash
curl http://127.0.0.1:11434/api/tags
```

or, for a remote Ollama server:

```bash
curl http://192.168.11.206:11434/api/tags
```

After the first successful memory operation, LanceDB files should appear under:

```text
~/.opencode/memory/lancedb
```

You can verify that the directory exists:

```bash
ls -la ~/.opencode/memory/lancedb
```

## Fallback Install From Release `.tgz`

Use this only when npm registry install is unavailable (for example, restricted network, offline staging, or registry outage).

1. Download the latest published release asset:

```bash
curl -fL "https://github.com/tryweb/lancedb-opencode-pro/releases/latest/download/lancedb-opencode-pro.tgz" -o /tmp/lancedb-opencode-pro.tgz
```

2. Install into the fixed local plugin directory:

```bash
mkdir -p ~/.config/opencode/plugins/lancedb-opencode-pro
npm install --prefix ~/.config/opencode/plugins/lancedb-opencode-pro /tmp/lancedb-opencode-pro.tgz
```

3. Register the plugin as a `file://` path in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "oh-my-opencode",
    "file:///home/<user>/.config/opencode/plugins/lancedb-opencode-pro/node_modules/lancedb-opencode-pro/dist/index.js"
  ]
}
```

4. Reuse the same sidecar config from the primary install flow, then start/restart OpenCode.

5. Verify plugin file path:

```bash
ls -la ~/.config/opencode/plugins/lancedb-opencode-pro/node_modules/lancedb-opencode-pro/dist/index.js
```

Then verify memory store initialization.

### When to use environment variables

Environment variables are optional. The recommended default is:

- keep durable settings in `~/.config/opencode/lancedb-opencode-pro.json`
- avoid setting `LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL` unless you intentionally want a temporary or host-specific override

Example override:

```bash
export LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL="http://192.168.11.206:11434"
```

This override has higher priority than the sidecar file.

### Secondary Fallback: Build From Source And Pack Locally

Use this when you need an unpublished local build (for example, testing unreleased commits).

```bash
npm ci
npm run typecheck
npm run build
npm pack
```

Then install the generated tarball:

```bash
mkdir -p ~/.config/opencode/plugins/lancedb-opencode-pro
npm install --prefix ~/.config/opencode/plugins/lancedb-opencode-pro ./lancedb-opencode-pro-<version>.tgz
```

Use the same `file://` plugin registration shown in the fallback section above.

## OpenCode Config

Use a sidecar config file. This is the supported configuration model for current OpenCode versions.

Create `~/.config/opencode/lancedb-opencode-pro.json`:

```json
{
  "provider": "lancedb-opencode-pro",
  "dbPath": "~/.opencode/memory/lancedb",
  "embedding": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "baseUrl": "http://127.0.0.1:11434"
  },
  "retrieval": {
    "mode": "hybrid",
    "vectorWeight": 0.7,
    "bm25Weight": 0.3,
    "minScore": 0.2,
    "rrfK": 60,
    "recencyBoost": true,
    "recencyHalfLifeHours": 72,
    "importanceWeight": 0.4
  },
  "includeGlobalScope": true,
  "globalDetectionThreshold": 2,
  "globalDiscountFactor": 0.7,
  "unusedDaysThreshold": 30,
  "minCaptureChars": 80,
  "maxEntriesPerScope": 3000
}
```

Optional project override path:

```text
.opencode/lancedb-opencode-pro.json
```

## Config Precedence

Higher priority overrides lower priority:

1. Environment variables (`LANCEDB_OPENCODE_PRO_*`)
2. `LANCEDB_OPENCODE_PRO_CONFIG_PATH`
3. Project sidecar: `.opencode/lancedb-opencode-pro.json`
4. Global sidecar: `~/.config/opencode/lancedb-opencode-pro.json`
5. Legacy sidecar: `~/.opencode/lancedb-opencode-pro.json`
6. Legacy `config.memory`
7. Built-in defaults

Supported environment variables:

- `LANCEDB_OPENCODE_PRO_CONFIG_PATH`
- `LANCEDB_OPENCODE_PRO_PROVIDER`
- `LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER` (`ollama` or `openai`, default `ollama`)
- `LANCEDB_OPENCODE_PRO_DB_PATH`
- `LANCEDB_OPENCODE_PRO_EMBEDDING_MODEL`
- `LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL`
- `LANCEDB_OPENCODE_PRO_OPENAI_API_KEY`
- `LANCEDB_OPENCODE_PRO_OPENAI_MODEL`
- `LANCEDB_OPENCODE_PRO_OPENAI_BASE_URL`
- `LANCEDB_OPENCODE_PRO_OPENAI_TIMEOUT_MS`
- `LANCEDB_OPENCODE_PRO_EMBEDDING_TIMEOUT_MS`
- `LANCEDB_OPENCODE_PRO_RETRIEVAL_MODE`
- `LANCEDB_OPENCODE_PRO_VECTOR_WEIGHT`
- `LANCEDB_OPENCODE_PRO_BM25_WEIGHT`
- `LANCEDB_OPENCODE_PRO_MIN_SCORE`
- `LANCEDB_OPENCODE_PRO_RRF_K`
- `LANCEDB_OPENCODE_PRO_RECENCY_BOOST`
- `LANCEDB_OPENCODE_PRO_RECENCY_HALF_LIFE_HOURS`
- `LANCEDB_OPENCODE_PRO_IMPORTANCE_WEIGHT`
- `LANCEDB_OPENCODE_PRO_INCLUDE_GLOBAL_SCOPE`
- `LANCEDB_OPENCODE_PRO_GLOBAL_DETECTION_THRESHOLD`
- `LANCEDB_OPENCODE_PRO_GLOBAL_DISCOUNT_FACTOR`
- `LANCEDB_OPENCODE_PRO_UNUSED_DAYS_THRESHOLD`
- `LANCEDB_OPENCODE_PRO_MIN_CAPTURE_CHARS`
- `LANCEDB_OPENCODE_PRO_MAX_ENTRIES_PER_SCOPE`
- `LANCEDB_OPENCODE_PRO_INJECTION_MODE`
- `LANCEDB_OPENCODE_PRO_INJECTION_MAX_MEMORIES`
- `LANCEDB_OPENCODE_PRO_INJECTION_MIN_MEMORIES`
- `LANCEDB_OPENCODE_PRO_INJECTION_BUDGET_TOKENS`
- `LANCEDB_OPENCODE_PRO_INJECTION_MAX_CHARS_PER_MEMORY`
- `LANCEDB_OPENCODE_PRO_INJECTION_SUMMARIZATION`
- `LANCEDB_OPENCODE_PRO_INJECTION_SUMMARY_TARGET_CHARS`
- `LANCEDB_OPENCODE_PRO_INJECTION_SCORE_DROP_TOLERANCE`
- `LANCEDB_OPENCODE_PRO_INJECTION_INJECTION_FLOOR`
- `LANCEDB_OPENCODE_PRO_INJECTION_CODE_SUMMARIZATION_MODE`
- `LANCEDB_OPENCODE_PRO_INJECTION_CODE_SUMMARIZATION_PRESERVE_STRUCTURE`

## What It Provides

- Auto-capture of durable outcomes from completed assistant responses.
- Hybrid retrieval (vector + lexical) for future context injection.
- Project-scope memory isolation (`project:*` + optional `global`).
- Cross-project memory sharing via global scope with automatic detection.
- Memory tools:
  - `memory_search`
  - `memory_delete`
  - `memory_clear`
  - `memory_stats`
  - `memory_feedback_missing`
  - `memory_feedback_wrong`
  - `memory_feedback_useful`
  - `memory_effectiveness`
  - `memory_scope_promote`
  - `memory_scope_demote`
  - `memory_global_list`
  - `memory_port_plan`

## Memory Effectiveness Feedback

The provider can now record structured feedback about long-memory quality in addition to storing and recalling memories.

- `memory_feedback_missing`: report information that should have been stored but was missed
- `memory_feedback_wrong`: report a stored memory that should not have been kept
- `memory_feedback_useful`: report whether a recalled memory was helpful
- `memory_effectiveness`: return machine-readable capture, recall, and feedback metrics for the active scope

Use `memory_search` or recalled memory ids from injected context when you need to reference a specific memory entry in feedback.

### Viewing Metrics

Use `memory_effectiveness` to inspect machine-readable effectiveness data for the active scope.

```text
memory_effectiveness
```

Example output:

```json
{
  "scope": "project:my-project",
  "totalEvents": 14,
  "capture": {
    "considered": 4,
    "stored": 3,
    "skipped": 1,
    "successRate": 0.75,
    "skipReasons": {
      "below-min-chars": 1
    }
  },
  "recall": {
    "requested": 4,
    "injected": 2,
    "returnedResults": 3,
    "hitRate": 0.75,
    "injectionRate": 0.5,
    "auto": {
      "requested": 3,
      "injected": 2,
      "returnedResults": 2,
      "hitRate": 0.67,
      "injectionRate": 0.67
    },
    "manual": {
      "requested": 1,
      "returnedResults": 1,
      "hitRate": 1
    },
    "manualRescueRatio": 0.33
  },
  "feedback": {
    "missing": 1,
    "wrong": 0,
    "useful": {
      "positive": 2,
      "negative": 0,
      "helpfulRate": 1
    },
    "falsePositiveRate": 0,
    "falseNegativeRate": 0.25
  }
}
```

Key fields:

- `capture.successRate`: how often a considered candidate was stored.
- `recall.hitRate`: blended rate across auto and manual recall — how often any recall request returned at least one result.
- `recall.auto.*`: metrics for automatic recall injected into the system prompt during `experimental.chat.system.transform`.
- `recall.manual.*`: metrics for user-initiated `memory_search` calls; `injected` is always false for manual searches.
- `recall.manualRescueRatio`: `manual.requested / auto.requested` — a proxy for how often users still need to search manually despite automatic recall.
- `feedback.falsePositiveRate`: wrong-memory reports divided by stored memories.
- `feedback.falseNegativeRate`: missing-memory reports relative to capture attempts.

### Interpreting Low-Feedback Results

In real OpenCode usage, auto-capture and recall happen in the background, so explicit `memory_feedback_*` events are often sparse.

- Treat `capture.*` and `recall.*` as system-health metrics: they show whether the memory pipeline is running.
- Treat `recall.auto.*` and `recall.manual.*` separately: auto metrics reflect pipeline health; manual metrics reflect whether users still need to rescue context manually.
- Treat `recall.manualRescueRatio` as a proxy for manual rescue rate: a high ratio suggests automatic recall is not surfacing relevant context on its own.
- Treat repeated-context reduction, clarification burden, manual memory rescue, correction signals, and sampled audits as product-value signals: they show whether memory actually helped the user.
- Treat `feedback.* = 0` as insufficient evidence, not proof that memory quality is good.
- Treat a high `recall.hitRate` or `recall.injectionRate` as recall availability only; those values do not prove usefulness by themselves.

Recommended review order in low-feedback environments:

1. Check `capture.successRate`, `capture.skipReasons`, `recall.hitRate`, and `recall.injectionRate` for operational health.
2. Review whether users repeated background context less often or needed fewer clarification turns.
3. Check whether users still needed manual rescue through `memory_search` or issued correction-like responses.
4. Run a bounded audit of recalled memories or skipped captures before concluding the system is helping.

## Injection Control

This provider supports configurable memory injection behavior, allowing you to control how recalled memories are processed before being injected into the LLM prompt.

### Configuration

Add an `injection` block to your sidecar config:

```json
{
  "provider": "lancedb-opencode-pro",
  "injection": {
    "mode": "fixed",
    "maxMemories": 3,
    "minMemories": 1,
    "budgetTokens": 4096,
    "maxCharsPerMemory": 1200,
    "summarization": "none",
    "summaryTargetChars": 300,
    "scoreDropTolerance": 0.15,
    "injectionFloor": 0.2,
    "codeSummarization": {
      "mode": "smart",
      "preserveStructure": true
    }
  }
}
```

### Injection Modes

- **`fixed`** (default) — Always inject up to `maxMemories` memories regardless of content size. This preserves backward-compatible behavior.
- **`budget`** — Limit total injected tokens to `budgetTokens`. The provider accumulates memories until the token budget is exhausted.
- **`adaptive`** — Dynamically adjust injection count based on score drops. Stop injection when scores drop below `scoreDropTolerance` relative to the highest-scored memory.

### Summarization Modes

When `summarization` is set to `truncate` or `extract`, memories are summarized before injection:

- **`none`** (default) — No summarization; inject full text.
- **`truncate`** — Simple truncation to `summaryTargetChars` with ellipsis.
- **`extract`** — Key sentence extraction for text, structure-preserving truncation for code.
- **`auto`** — Content-aware summarization (truncate for text, preserve structure for code).

### Code Handling

The `codeSummarization` config controls how code snippets are processed:

- **`mode`**: `"smart"` | `"truncate"` | `"preserve"` (default: `"smart"`)
- **`preserveStructure`**: When `true`, code truncation attempts to balance brackets and preserve syntactic validity.

### Environment Variables

All injection options can be overridden via environment variables:

- `LANCEDB_OPENCODE_PRO_INJECTION_MODE`
- `LANCEDB_OPENCODE_PRO_INJECTION_MAX_MEMORIES`
- `LANCEDB_OPENCODE_PRO_INJECTION_MIN_MEMORIES`
- `LANCEDB_OPENCODE_PRO_INJECTION_BUDGET_TOKENS`
- `LANCEDB_OPENCODE_PRO_INJECTION_MAX_CHARS_PER_MEMORY`
- `LANCEDB_OPENCODE_PRO_INJECTION_SUMMARIZATION`
- `LANCEDB_OPENCODE_PRO_INJECTION_SUMMARY_TARGET_CHARS`
- `LANCEDB_OPENCODE_PRO_INJECTION_SCORE_DROP_TOLERANCE`
- `LANCEDB_OPENCODE_PRO_INJECTION_INJECTION_FLOOR`
- `LANCEDB_OPENCODE_PRO_INJECTION_CODE_SUMMARIZATION_MODE`
- `LANCEDB_OPENCODE_PRO_INJECTION_CODE_SUMMARIZATION_PRESERVE_STRUCTURE`

### Default Behavior

The default configuration preserves backward compatibility:

- `mode`: `"fixed"`
- `maxMemories`: `3`
- `summarization`: `"none"`

This means without any `injection` configuration, the provider behaves identically to previous versions: always inject up to 3 memories with full text.

### Example: Token Budget Mode

For token-sensitive deployments, use budget mode to limit context size:

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

This configuration:
1. Accumulates memories until total estimated tokens reach ~1500
2. Truncates each memory to ~400 characters before injection
3. Guarantees at least 1 memory is always included

### Example: Adaptive Mode

For quality-sensitive scenarios where you want to avoid low-relevance memories:

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

This configuration:
1. Starts with up to 5 candidate memories
2. Stops adding memories when score drops >15% from the top
3. Ensures minimum score threshold (floor) prevents low-quality injection
4. Always includes at least 2 memories

### Example: Adaptive Mode with Auto Summarization

Recommended for users who want intelligent memory injection with content-aware summarization:

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
      "mode": "smart",
      "preserveStructure": true
    }
  }
}
```

This configuration:
1. Dynamically adjusts injection count based on relevance scores
2. Uses content-aware summarization (key sentences for text, smart truncation for code)
3. Guarantees at least 2 memories are injected
4. Preserves code structure when truncating
5. Prevents injection of memories below 0.2 score threshold

---

## OpenAI Embedding Configuration

Default behavior stays on Ollama. To use OpenAI embeddings, set `embedding.provider` to `openai` and provide API key + model.

Example sidecar:

```json
{
  "provider": "lancedb-opencode-pro",
  "dbPath": "~/.opencode/memory/lancedb",
  "embedding": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-your-openai-key"
  },
  "retrieval": {
    "mode": "hybrid",
    "vectorWeight": 0.7,
    "bm25Weight": 0.3,
    "minScore": 0.2,
    "rrfK": 60,
    "recencyBoost": true,
    "recencyHalfLifeHours": 72,
    "importanceWeight": 0.4
  },
  "includeGlobalScope": true,
  "globalDetectionThreshold": 2,
  "globalDiscountFactor": 0.7,
  "unusedDaysThreshold": 30,
  "minCaptureChars": 80,
  "maxEntriesPerScope": 3000
}
```

Recommended env overrides for OpenAI:

```bash
export LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER="openai"
export LANCEDB_OPENCODE_PRO_OPENAI_API_KEY="$OPENAI_API_KEY"
export LANCEDB_OPENCODE_PRO_OPENAI_MODEL="text-embedding-3-small"
export LANCEDB_OPENCODE_PRO_OPENAI_BASE_URL="https://api.openai.com/v1"
```

`lancedb-opencode-pro.json` is parsed as plain JSON, so `${...}` interpolation is not performed. Prefer environment variables for secrets.

Validation behavior:

- If `embedding.provider=openai` and API key is missing, initialization fails with an explicit configuration error.
- If `embedding.provider=openai` and model is missing, initialization fails with an explicit configuration error.
- Ollama remains the default provider when `embedding.provider` is omitted.

## Compose Port Planning (Cross-Project)

Use `memory_port_plan` before writing `docker-compose.yml` to avoid host port collisions across projects on the same machine.

- Reads existing reservations from `global` scope
- Probes live host port availability
- Returns non-conflicting assignments
- Optionally persists reservations for future projects (`persist=true`)

Example tool input:

```json
{
  "project": "project-alpha",
  "services": [
    { "name": "web", "containerPort": 3000, "preferredHostPort": 23000 },
    { "name": "api", "containerPort": 3001 }
  ],
  "rangeStart": 23000,
  "rangeEnd": 23999,
  "persist": true
}
```

Example output (trimmed):

```json
{
  "project": "project-alpha",
  "persistRequested": true,
  "persisted": 2,
  "assignments": [
    {
      "project": "project-alpha",
      "service": "web",
      "hostPort": 23000,
      "containerPort": 3000,
      "protocol": "tcp"
    },
    {
      "project": "project-alpha",
      "service": "api",
      "hostPort": 23001,
      "containerPort": 3001,
      "protocol": "tcp"
    }
  ],
  "warnings": []
}
```

Map assignments into `docker-compose.yml`:

```yaml
services:
  web:
    ports:
      - "23000:3000"
  api:
    ports:
      - "23001:3001"
```

Notes:

- This is best-effort conflict avoidance, not a hard distributed lock.
- For safer operation in automation, run planning immediately before `docker compose up`.
- Reservations are upserted by `project + service + protocol` when `persist=true`.

## Local Development

```bash
npm install
npm run typecheck
npm run build
```

## Validation Commands

The project provides layered validation workflows that can run locally or inside the Docker environment.

| Command | What it covers |
|---|---|
| `npm run test:foundation` | Write-read persistence, scope isolation, vector compatibility, timestamp ordering |
| `npm run test:regression` | Auto-capture extraction, search output shape, delete/clear safety, pruning |
| `npm run test:effectiveness` | Foundation + regression workflows covering effectiveness events, feedback commands, and summary output |
| `npm run test:retrieval` | Recall@K and Robustness-δ@K against synthetic fixtures |
| `npm run benchmark:latency` | Search p50/p99, insert avg, list avg with hard-gate enforcement |
| `npm run verify` | Typecheck + build + effectiveness workflow + retrieval (quick release check) |
| `npm run verify:full` | All of the above + benchmark + `npm pack` (full release gate) |

Threshold policy and benchmark profiles are documented in `docs/memory-validation-checklist.md` (Phase 4.4).
Acceptance evidence mapping and archive/ship gate policy are documented in `docs/release-readiness.md`.

## Maintainer Release SOP

Use this flow when publishing a new version to npm.

1. Update `package.json` version and `CHANGELOG.md`.
2. Run the canonical release gate in Docker:

```bash
docker compose build --no-cache && docker compose up -d
docker compose exec app npm run release:check
```

3. Confirm npm authentication:

```bash
npm whoami
```

If not logged in yet:

```bash
npm login
```

4. Publish from the host:

```bash
npm publish
```

5. Verify the package is live:

```bash
npm view lancedb-opencode-pro name version
```

Notes:

- `prepublishOnly` runs `npm run verify:full`, so `npm publish` is blocked if the release gate fails.
- `publishConfig.access=public` keeps first publish public.
- For CI provenance attestation, publish from a supported CI provider with `npm publish --provenance`.
- If your npm account enforces 2FA, complete the browser or OTP challenge during publish.

### Troubleshooting: EACCES on `dist` or `dist-test`

If `npm publish` fails with errors like `TS5033 ... EACCES: permission denied` for files under `dist/` or `dist-test/`, some build artifacts were likely created by `root` inside Docker.

Fix ownership from the container, then re-run publish:

```bash
docker compose up -d
docker compose exec -T -u root app sh -lc 'chown -R 1000:1000 /workspace/dist /workspace/dist-test 2>/dev/null || true'
npm publish
```

You can validate ownership first:

```bash
ls -l dist dist-test/src 2>/dev/null
```

## Docker Test Environment

```bash
docker compose build --no-cache && docker compose up -d
docker compose exec app npm run typecheck
docker compose exec app npm run build
```

### Running validation inside Docker

```bash
docker compose build --no-cache && docker compose up -d

# Quick release check
docker compose exec app npm run verify

# Full release gate (includes benchmark + pack)
docker compose exec app npm run verify:full

# Individual workflows
docker compose exec app npm run test:foundation
docker compose exec app npm run test:regression
docker compose exec app npm run test:retrieval
docker compose exec app npm run benchmark:latency
```

### Operator verification

After running `npm run verify:full`, operators can inspect the following:

```bash
# Confirm the packaged build is installable
docker compose exec app ls -la lancedb-opencode-pro-*.tgz

# Confirm typecheck and build succeeded
docker compose exec app npm run typecheck
docker compose exec app npm run build

# Check resolved default storage path
docker compose exec app node -e "import('./dist/index.js').then(() => console.log('plugin loaded'))"
docker compose exec app sh -lc 'ls -la ~/.opencode/memory/lancedb 2>/dev/null || echo "No data yet (expected before first use)"'
```

## Long Memory Verification

Use this checklist when you want to verify that `lancedb-opencode-pro` provides durable long-term memory instead of in-process temporary state.

### 1. Start the Docker test environment

```bash
docker compose build --no-cache && docker compose up -d
```

### 2. Install dependencies and build inside the container

The E2E script loads `dist/index.js`, so build artifacts must exist first.

```bash
docker compose exec app npm install
docker compose exec app npm run build
```

### 3. Run the built-in end-to-end memory test

```bash
docker compose exec app npm run test:e2e
```

Expected success output:

```text
E2E PASS: auto-capture, search, delete safety, clear safety, and clear execution verified.
```

This verifies all of the following in one run:

- assistant output is buffered and auto-captured
- `session.idle` triggers durable persistence
- `memory_search` can retrieve the stored memory
- `memory_delete` requires `confirm=true`
- `memory_clear` requires `confirm=true`

### 4. Verify that LanceDB files were written to disk

The E2E script uses `/tmp/opencode-memory-e2e` as its test database path.

```bash
docker compose exec app ls -la /tmp/opencode-memory-e2e
```

If files appear in that directory after the E2E run, memory was written to disk instead of only being kept in process memory.

### 5. Verify the real default storage path used by OpenCode integration

When running through the normal plugin config, the default durable storage path is:

```text
~/.opencode/memory/lancedb
```

Check it inside the container with:

```bash
docker compose exec app sh -lc 'ls -la ~/.opencode/memory/lancedb'
```

### 6. Stronger proof: verify retrieval still works after restart

Long memory is only convincing if retrieval still works after the runtime is restarted.

```bash
docker compose restart app
docker compose exec app npm run test:e2e
docker compose exec app ls -la /tmp/opencode-memory-e2e
```

If the search step still succeeds after restart and the database files remain present, that is strong evidence that the memory is durable.

### Pass criteria

Treat the feature as verified only when all of these are true:

- `docker compose exec app npm run test:e2e` passes
- `/tmp/opencode-memory-e2e` contains LanceDB files after the run
- the memory retrieval step still succeeds after container restart
- the configured OpenCode storage path exists when running real plugin integration

## Notes

- Default storage path: `~/.opencode/memory/lancedb`
- Embedding provider defaults to `ollama`; `openai` is supported via `embedding.provider=openai`
- The provider keeps schema metadata (`schemaVersion`, `embeddingModel`, `vectorDim`) to guard against unsafe vector mixing.
