# lancedb-opencode-pro

LanceDB-backed long-term memory provider for OpenCode.

## Install

```bash
npm install -g lancedb-opencode-pro
```

## OpenCode Config

Add to `opencode.json`:

```json
{
  "memory": {
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
    }
  }
}
```

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
