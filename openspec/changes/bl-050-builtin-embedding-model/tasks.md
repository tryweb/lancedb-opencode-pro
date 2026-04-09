## 1. Dependencies

- [ ] 1.1 Add @xenova/transformers to dependencies (package.json)
- [ ] 1.2 Verify package.json updated with correct version range

## 2. TypeScript Types

- [ ] 2.1 Add "transformers" to EmbeddingProvider type in src/types.ts
- [ ] 2.2 Update EmbeddingConfig type if needed

## 3. TransformersEmbedder Implementation

- [ ] 3.1 Create TransformersEmbedder class in src/embedder.ts
- [ ] 3.2 Implement constructor with model configuration
- [ ] 3.3 Implement embed(text) method with lazy loading
- [ ] 3.4 Implement dim() method returning 384 (or dynamic)
- [ ] 3.5 Add module-level singleton for pipeline caching

## 4. Factory Integration

- [ ] 4.1 Update createEmbedder() to handle provider: "transformers"
- [ ] 4.2 Add dynamic import for @xenova/transformers (optional import)
- [ ] 4.3 Test factory routing for new provider

## 5. Error Handling

- [ ] 5.1 Handle transformers.js load failure gracefully
- [ ] 5.2 Handle model initialization failure
- [ ] 5.3 Integrate with existing embedder health tracking
- [ ] 5.4 Test error messages are descriptive

## 6. Testing

- [ ] 6.1 Unit test: TransformersEmbedder instantiation
- [ ] 6.2 Unit test: embed() returns correct dimension vector
- [ ] 6.3 Unit test: dim() returns 384 for default model
- [ ] 6.4 Integration test: Full embedding workflow with config
- [ ] 6.5 Integration test: Fallback when transformers unavailable (mock)

## 7. Configuration Documentation

- [ ] 7.1 Update src/config.ts (if needed) for transformers provider
- [ ] 7.2 Verify default config includes transformers option

## 8. End-to-End Verification

- [ ] 8.1 E2E: Configure plugin with provider: "transformers"
- [ ] 8.2 E2E: Verify memory capture works without external APIs
- [ ] 8.3 E2E: Verify memory search returns relevant results

## 9. Cleanup

- [ ] 9.1 Run lsp_diagnostics on changed files
- [ ] 9.2 Verify no type errors
- [ ] 9.3 Update CHANGELOG.md with entry

---

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| Embedder interface | ✅ | ✅ | n/a | yes |
| Vector generation | ✅ | ✅ | ✅ | yes |
| Dimension detection | ✅ | ✅ | n/a | yes |
| Lazy loading | ✅ | ✅ | ✅ | yes |
| Config support | ✅ | ✅ | ✅ | yes |
| Error handling | ✅ | ✅ | n/a | yes |
| Caching | ✅ | ✅ | n/a | yes |
| Health tracking | ✅ | ✅ | n/a | yes |

---

## Changelog Wording Class

**User-facing** - This feature adds a new embedding provider option that users can configure.
