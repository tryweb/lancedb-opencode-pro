# lancedb-opencode-pro

LanceDB-backed long-term memory provider for OpenCode.

## Supported OpenCode Versions

- Supported: OpenCode `1.2.27+`
- Configuration model: sidecar config file at `~/.config/opencode/lancedb-opencode-pro.json`
- Not recommended: top-level `memory` in `opencode.json`, because current OpenCode versions reject that key during config validation

## Install

```bash
npm install -g lancedb-opencode-pro
```

## Install on Another Host

Use this flow when you want to enable `lancedb-opencode-pro` on a different machine that already has OpenCode installed.

1. Install the plugin on that host:

```bash
npm install -g lancedb-opencode-pro
```

2. Register the plugin in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "lancedb-opencode-pro"
  ]
}
```

If you already use other plugins, keep them and append `"lancedb-opencode-pro"` to the existing `plugin` array.

3. For OpenCode `1.2.27+`, create the sidecar config file `~/.config/opencode/lancedb-opencode-pro.json`:

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
    "minScore": 0.2
  },
  "includeGlobalScope": true,
  "minCaptureChars": 80,
  "maxEntriesPerScope": 3000
}
```

4. Set `embedding.baseUrl` to the Ollama endpoint that is reachable from that host.

- Same machine as OpenCode: `http://127.0.0.1:11434`
- Another machine on the network: for example `http://192.168.11.206:11434`

You do not need `LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL` if the sidecar file already contains the correct `embedding.baseUrl`. Use the environment variable only when you want to override the file at runtime.

5. Make sure Ollama is reachable from that host before starting OpenCode:

```bash
curl http://127.0.0.1:11434/api/tags
```

or, for a remote Ollama server:

```bash
curl http://192.168.11.206:11434/api/tags
```

6. Start or restart OpenCode, then verify the memory store initializes.

After the first successful memory operation, LanceDB files should appear under:

```text
~/.opencode/memory/lancedb
```

You can also verify that the directory exists:

```bash
ls -la ~/.opencode/memory/lancedb
```

### When to use environment variables

Environment variables are optional. The recommended default is:

- keep durable settings in `~/.config/opencode/lancedb-opencode-pro.json`
- avoid setting `LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL` unless you intentionally want a temporary or host-specific override

Example override:

```bash
export LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL="http://192.168.11.206:11434"
```

This override has higher priority than the sidecar file.

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
    "minScore": 0.2
  },
  "includeGlobalScope": true,
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
- `LANCEDB_OPENCODE_PRO_DB_PATH`
- `LANCEDB_OPENCODE_PRO_EMBEDDING_MODEL`
- `LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL`
- `LANCEDB_OPENCODE_PRO_EMBEDDING_TIMEOUT_MS`
- `LANCEDB_OPENCODE_PRO_RETRIEVAL_MODE`
- `LANCEDB_OPENCODE_PRO_VECTOR_WEIGHT`
- `LANCEDB_OPENCODE_PRO_BM25_WEIGHT`
- `LANCEDB_OPENCODE_PRO_MIN_SCORE`
- `LANCEDB_OPENCODE_PRO_INCLUDE_GLOBAL_SCOPE`
- `LANCEDB_OPENCODE_PRO_MIN_CAPTURE_CHARS`
- `LANCEDB_OPENCODE_PRO_MAX_ENTRIES_PER_SCOPE`

## What It Provides

- Auto-capture of durable outcomes from completed assistant responses.
- Hybrid retrieval (vector + lexical) for future context injection.
- Project-scope memory isolation (`project:*` + optional `global`).
- Memory tools:
  - `memory_search`
  - `memory_delete`
  - `memory_clear`
  - `memory_stats`

## Local Development

```bash
npm install
npm run typecheck
npm run build
```

## Docker Test Environment

```bash
docker compose build --no-cache && docker compose up -d
docker compose exec app npm run typecheck
docker compose exec app npm run build
```

## Notes

- Default storage path: `~/.opencode/memory/lancedb`
- Embedding backend in v1: `ollama`
- The provider keeps schema metadata (`schemaVersion`, `embeddingModel`, `vectorDim`) to guard against unsafe vector mixing.
