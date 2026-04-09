## ADDED Requirements

### Requirement: TransformersEmbedder implements Embedder interface
The system SHALL provide a `TransformersEmbedder` class that implements the existing `Embedder` interface with `model`, `embed(text)`, and `dim()` methods.

#### Scenario: TransformersEmbedder is created via factory
- **WHEN** `createEmbedder()` is called with `provider: "transformers"`
- **THEN** it SHALL return a `TransformersEmbedder` instance

#### Scenario: TransformersEmbedder returns model name
- **WHEN** the `model` property is accessed on a `TransformersEmbedder`
- **THEN** it SHALL return the configured model name (default: "Xenova/all-MiniLM-L6-v2")

### Requirement: Embed text produces vector embedding
The system SHALL generate vector embeddings from input text using transformers.js.

#### Scenario: Successful embedding generation
- **WHEN** `embed("hello world")` is called on a `TransformersEmbedder`
- **THEN** it SHALL return a `Promise<number[]>` containing a 384-dimensional vector

#### Scenario: Empty text handling
- **WHEN** `embed("")` is called on a `TransformersEmbedder`
- **THEN** it SHALL return a valid embedding vector (transformers.js handles tokenization)

#### Scenario: Long text handling
- **WHEN** `embed(<text-over-512-tokens>)` is called
- **THEN** it SHALL truncate or handle the text gracefully (transformers.js default tokenization)

### Requirement: Dimension detection
The system SHALL correctly report the embedding dimension.

#### Scenario: dim() returns correct dimension
- **WHEN** `dim()` is called on a `TransformersEmbedder` configured with "Xenova/all-MiniLM-L6-v2"
- **THEN** it SHALL return `384`

### Requirement: Lazy loading of model
The system SHALL load the transformers.js model only when first needed, not at import time.

#### Scenario: Model not loaded at construction
- **WHEN** a `TransformersEmbedder` is constructed
- **THEN** it SHALL NOT immediately download or initialize the model

#### Scenario: Model loaded on first embed call
- **WHEN** `embed()` is called for the first time
- **THEN** it SHALL trigger model download and initialization before generating embeddings

### Requirement: Configuration via embedding config
The system SHALL support configuration of the transformers provider through the existing config system.

#### Scenario: Provider "transformers" is recognized
- **WHEN** config contains `embedding.provider: "transformers"`
- **THEN** the system SHALL use `TransformersEmbedder`

#### Scenario: Custom model can be specified
- **WHEN** config contains `embedding.model: "Xenova/all-mpnet-base-v2"`
- **THEN** the `TransformersEmbedder` SHALL use that model instead of default

### Requirement: Provider-default model mapping
The system SHALL use the appropriate default model for each provider.

#### Scenario: transformers provider uses default model
- **WHEN** `embedding.provider` is set to `"transformers"` without specifying `model`
- **THEN** it SHALL default to `Xenova/all-MiniLM-L6-v2` (384 dimensions)

#### Scenario: Provider-specific defaults documented
- **WHEN** user configures any embedding provider
- **THEN** the system SHALL follow this default model mapping:
  - `provider: "ollama"` → default model: `nomic-embed-text` (768 dimensions)
  - `provider: "openai"` → default model: `text-embedding-3-small` (1536 dimensions)  
  - `provider: "transformers"` → default model: `Xenova/all-MiniLM-L6-v2` (384 dimensions)

### Requirement: Transformers-specific config behavior
The system SHALL ignore certain config fields that are not applicable to transformers provider.

#### Scenario: baseUrl ignored for transformers
- **WHEN** `embedding.provider` is `"transformers"` and `embedding.baseUrl` is set
- **THEN** the baseUrl SHALL be ignored (transformers.js runs locally)

#### Scenario: apiKey ignored for transformers
- **WHEN** `embedding.provider` is `"transformers"` and `embedding.apiKey` is set
- **THEN** the apiKey SHALL be ignored (transformers.js is offline-capable)

### Requirement: Error handling
The system SHALL handle errors gracefully when transformers.js fails.

#### Scenario: Model loading failure
- **WHEN** transformers.js fails to load (network error, incompatible environment)
- **THEN** it SHALL throw an error with a descriptive message

#### Scenario: Embedding generation failure
- **WHEN** the model fails to generate an embedding
- **THEN** it SHALL propagate the error to the caller

### Requirement: Caching for subsequent requests
The system SHALL cache the loaded model in memory for the session.

#### Scenario: Second embed call reuses loaded model
- **WHEN** `embed()` is called twice
- **THEN** the second call SHALL NOT re-download or re-initialize the model

### Requirement: Fallback integration
The system SHALL integrate with existing retry and fallback mechanisms.

#### Scenario: Embedder health tracking
- **WHEN** `TransformersEmbedder` fails
- **THEN** the global embedder health status SHALL be updated accordingly

#### Scenario: Retry logic applies
- **WHEN** `TransformersEmbedder` throws an error
- **THEN** the existing retry logic in `embedWithRetry()` SHALL apply

### Requirement: Performance characteristics
The system SHALL meet defined performance targets for embedding generation.

#### Scenario: Warm inference latency
- **WHEN** `embed()` is called after the model is loaded (second+ call)
- **THEN** it SHALL complete within reasonable time (~2-5 seconds max per embedding)

#### Scenario: Batch processing support
- **WHEN** multiple `embed()` calls are made sequentially
- **THEN** each call SHOULD reuse the cached model for optimal throughput

### Requirement: ONNX model format awareness
The system SHALL recognize that the model uses ONNX format for cross-platform compatibility.

#### Scenario: ONNX runtime used
- **WHEN** embedding is generated via TransformersEmbedder
- **THEN** it SHALL use ONNX Runtime Web (WASM) under the hood
- **NOTE**: This enables execution in Node.js without Python dependency

#### Scenario: Model quantization
- **WHEN** the model is loaded
- **THEN** it SHALL use the quantized ONNX version (~23MB) for reduced download size
- **NOTE**: Quantization has <1% accuracy impact, acceptable for memory search use case

### Requirement: Offline mode configuration
The system SHALL support offline/local model usage for air-gapped environments.

#### Scenario: Offline mode via environment variable
- **WHEN** environment variable `TRANSFORMERS_OFFLINE=1` or `HF_HUB_OFFLINE=1` is set
- **THEN** transformers.js SHALL NOT attempt to download models from HuggingFace Hub
- **NOTE**: If model is not cached locally, it SHALL fail with descriptive error

#### Scenario: Local model path configuration
- **WHEN** environment variable `TRANSFORMERS_CACHE` or `HF_HOME` points to a directory containing pre-downloaded models
- **THEN** TransformersEmbedder SHALL load models from the specified local path
- **NOTE**: Model files must be in the expected directory structure (e.g., models/Xenova--all-MiniLM-L6-v2/)

#### Scenario: Pre-downloaded model detection
- **WHEN** transformers.js attempts to load a model
- **THEN** it SHALL first check local cache before attempting remote download

### Requirement: Offline-first usage documentation
The system SHALL document the recommended workflow for offline/air-gapped deployment.

#### Scenario: Preparing for offline use
- **WHEN** user wants to use transformers provider in an air-gapped environment
- **THEN** they SHALL:
  1. Run once with internet to trigger model download
  2. Copy the cache directory (default: `./.cache/`) to the air-gapped machine
  3. Set `TRANSFORMERS_CACHE=/path/to/copied-cache` on the air-gapped machine
  4. Set `HF_HUB_OFFLINE=1` to prevent any network attempts
