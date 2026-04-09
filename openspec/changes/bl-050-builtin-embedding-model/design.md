## Context

Currently, the plugin supports two embedding providers: `ollama` and `openai`. Both require external services:
- **Ollama**: Requires running Ollama server with embedding model pulled
- **OpenAI**: Requires API key and internet access

Users have requested offline embedding capability for:
- Air-gapped environments (security-sensitive organizations)
- Zero-config setup (no Ollama server to run)
- Cost reduction (no API calls)

The solution uses `@xenova/transformers` (transformers.js) which runs inference entirely in-browser/Node.js using WebAssembly and ONNX Runtime.

### Understanding the Model: ONNX Format

`Xenova/all-MiniLM-L6-v2` is the **ONNX-converted version** of `sentence-transformers/all-MiniLM-L6-v2`:

| Aspect | sentence-transformers (PyTorch) | Xenova (ONNX) |
|--------|--------------------------------|---------------|
| **Architecture** | 6-layer MiniLM (384-dim) | Identical |
| **Format** | `.pth` (PyTorch) | `.onnx` |
| **Size** | ~90 MB | ~23 MB (quantized) |
| **Precision** | FP32 | FP32/INT8 quantized |
| **Runtime** | Python | Browser/Node.js (WASM) |

**Key insight**: They are the **same model architecture**, just different formats. ONNX enables JavaScript execution while maintaining equivalent quality. The numerical difference is negligible (atol: 1e-05 per HuggingFace validation).

### Why ONNX for transformers.js?

- **Cross-platform**: PyTorch needs Python → impossible in browser/Node.js
- **WebAssembly support**: ONNX Runtime Web runs in any JS environment
- **Lazy loading**: WASM files download once and cache
- **Bundle size**: ~1.2MB minified + 3.5MB WASM

## Goals / Non-Goals

**Goals:**
- Add new `TransformersEmbedder` class implementing the `Embedder` interface
- Support provider config `"transformers"` 
- Model loaded once and cached in memory for subsequent embeddings
- Seamless fallback to existing providers when transformers unavailable

**Non-Goals:**
- Support for GPU acceleration (future enhancement)
- Model fine-tuning or training
- Multiple simultaneous models (singleton pattern)
- Mobile/React Native support (different runtime)

### Default Model by Provider

| Provider | Default Model | Vector Dimension | Size |
|----------|---------------|------------------|------|
| `ollama` | `nomic-embed-text` | 768 | ~274 MB |
| `openai` | `text-embedding-3-small` | 1536 | API-managed |
| `transformers` | `Xenova/all-MiniLM-L6-v2` | 384 | ~23 MB |

**Note**: Each provider has its own default model that represents the best practice for that runtime.

## Decisions

### 1. Model Selection: Xenova/all-MiniLM-L6-v2

**Decision**: Use `Xenova/all-MiniLM-L6-v2` as default model.

**Alternatives Considered**:
- `Xenova/all-mpnet-base-v2` (768 dim, ~420MB) - Higher quality but larger
- `Xenova/distilbert-base-uncased` - General purpose but slower

**Rationale**: MiniLM-L6 offers best balance of size/speed/quality for embedded use case. 384 dimensions matches existing `all-minilm` fallback in code.

### 2. Integration: Extend Existing Factory Pattern

**Decision**: Add `TransformersEmbedder` to existing `createEmbedder()` factory.

**Alternatives Considered**:
- Separate embedder registry
- Dynamic module loading

**Rationale**: Minimal code change. Existing factory already handles provider routing, retry wrapping, and health tracking.

### 3. Lazy Loading: Load on First Use

**Decision**: Do not load transformers.js at plugin initialization. Load when first embedding request arrives.

**Alternatives Considered**:
- Eager load at initialization
- User-triggered preload

**Rationale**: Avoids blocking plugin startup and large download on every restart. First embedding request triggers download (cached thereafter).

### 4. Error Handling: Graceful Degradation

**Decision**: If transformers.js fails to load or model fails, log warning and throw error (caller handles via existing retry logic).

**Alternatives Considered**:
- Silent fallback to BM25-only
- Retry with different model

**Rationale**: Consistent with existing embedder error behavior. Caller (memory capture) already handles unavailability via BL-049 fallback.

### 5. Caching Strategy: Singleton with Lazy Init

**Decision**: Use module-level singleton for pipeline to avoid reloading model per request.

**Rationales**:
- Model loading takes 2-5 seconds
- Multiple requests during session should reuse loaded model
- Memory: ~90MB per model instance is acceptable

## Risks / Trade-offs

### Risk: First-Use Latency
**Risk**: First embedding request triggers model download (~23MB) + WASM initialization (~10-15 seconds).
**Mitigation**: Log informative message at start of loading. Cache persists for session. Subsequent requests use cached model (~2.68ms per embedding).

### Risk: Memory Usage
**Risk**: transformers.js uses 150-300MB peak memory during inference.
**Mitigation**: Use smallest viable model (MiniLM-L6). This is acceptable for desktop/Server use cases.

### Risk: Node.js Compatibility
**Risk**: transformers.js primarily designed for browser, Node.js support may have quirks.
**Mitigation**: Use @xenova/transformers (not @huggingface/transformers). Test in Node 18/20/22.

### Risk: Installation Size
**Risk**: Adding @xenova/transformers increases package size.
**Mitigation**: Mark as optional peer dependency. Only install if provider selected.

### Performance Comparison: transformers.js vs Ollama

Based on benchmark research:

| Metric | transformers.js (all-MiniLM-L6-v2) | Ollama (nomic-embed-text) |
|--------|-----------------------------------|---------------------------|
| **Model size** | ~23 MB | ~274 MB |
| **Vector dimension** | 384 | 768 |
| **Warm inference latency** | ~2.68ms/embedding | ~257ms |
| **Throughput** | ~650-700 embeddings/s | ~4 embeddings/s |
| **Cold start** | 10-15 seconds | Depends on Ollama startup |
| **Peak memory** | 150-300 MB | Higher (model resident) |

**Key insight**: transformers.js warm inference is actually **faster** than Ollama after model loads. The trade-off is cold-start latency.

### LanceDB Vector Search Impact

Based on LanceDB benchmarks (1M vectors):

| Vector Dimension | P50 Latency | Index Size | Compression |
|-------------------|-------------|------------|-------------|
| **256** | ~25ms | Smallest | Best (1/32) |
| **384** | ~25-30ms | ~1/2 of 768 | Good |
| **768** | ~25-30ms | Baseline | Moderate |
| **1536** | ~25-30ms | Largest | Limited |

**Recommendation**: 384-dimension is sufficient for memory search use cases. Benefits:
- Faster index build
- Reduced storage
- Lower search latency
- Adequate semantic precision for general memory retrieval

### Trade-off: Quality vs Size
**Decision**: Accept slightly lower quality (MiniLM-L6) for fast, small footprint. Users needing higher quality can still use Ollama/OpenAI.

## Migration Plan

1. **Phase 1** (This change): Implement TransformersEmbedder
   - Add `@xenova/transformers` to dependencies
   - Implement class in `src/embedder.ts`
   - Update factory in `createEmbedder()`
   - Add config validation for provider

2. **Phase 2** (Documentation): User-facing docs
   - Update README with transformers option
   - Document model choices and trade-offs

3. **Rollback**: If issues, users revert to `provider: "ollama"` or `"openai"`. No migration needed.

## Open Questions

1. **Q**: Should we pre-warm the model on plugin init for guaranteed zero-latency first memory?
   **A**: No - keep lazy for now. Can add as optional config later.

2. **Q**: Should we support multiple models simultaneously?
   **A**: Not in v1. Singleton pattern. Can expand if requested.

3. **Q**: How to handle transformers.js import in ESM package?
   **A**: Use dynamic import() for optional dependency to avoid bundling issues.
