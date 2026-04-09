## Why

Users need offline embedding capability without relying on external APIs (Ollama/OpenAI). Current embedders require running Ollama server or OpenAI API access, which limits the plugin's usefulness in air-gapped environments or when users want zero-config setup. Adding a built-in embedding model using transformers.js provides true offline capability.

## What Changes

- **New**: `TransformersEmbedder` class implementing the `Embedder` interface using `@xenova/transformers`
- **New**: Configuration option `provider: "transformers"` in `embedding` config
- **New**: Default model `Xenova/all-MiniLM-L6-v2` (384 dimensions) with support for other models
- **Modified**: `createEmbedder()` factory function to support the new provider

## Capabilities

### New Capabilities
- `transformers-embedder`: Built-in offline embedding using transformers.js. No external API required. Loads model once and caches in memory for fast subsequent embeddings.

### Modified Capabilities
- (none - this is a net-new capability, not modifying existing requirements)

## Impact

- **Dependencies**: New runtime dependency `@xenova/transformers` (~30MB download on first use, cached thereafter)
- **Configuration**: New `embedding.provider` option: `"transformers"`
- **Code**: New file `src/embedder/transformers.ts` (or add to existing `embedder.ts`)
- **Breaking**: None - existing providers continue to work as before
