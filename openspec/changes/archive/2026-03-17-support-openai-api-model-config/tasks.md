## 1. Type and Config Contract

- [x] 1.1 Extend embedding provider types to include `openai` while preserving `ollama` default behavior.
- [x] 1.2 Add OpenAI-related runtime config fields and environment variable resolution in config parsing.
- [x] 1.3 Add startup validation rules for `provider=openai` required fields (API key, model).

## 2. Embedder Implementation

- [x] 2.1 Implement `OpenAIEmbedder` that conforms to the existing `Embedder` interface.
- [x] 2.2 Add provider-aware embedder factory and route provider initialization through the factory.
- [x] 2.3 Keep Ollama embedder behavior unchanged for existing configurations.

## 3. Integration and Compatibility

- [x] 3.1 Wire provider selection through plugin initialization (`src/index.ts`) without changing memory workflow semantics.
- [x] 3.2 Ensure embedding metadata compatibility checks continue to prevent mixed-dimension unsafe retrieval.
- [x] 3.3 Add clear error messages for provider misconfiguration and upstream API failures.

## 4. Tests and Documentation

- [x] 4.1 Add or update tests for config precedence and provider switching (ollama/openai).
- [x] 4.2 Add tests for openai validation failures (missing apiKey/model) and successful embedding path.
- [x] 4.3 Update README sidecar examples and environment variable list to document OpenAI + Ollama support.

## 5. Verification

- [x] 5.1 Run Docker validation flow: `docker compose build --no-cache && docker compose up -d`.
- [x] 5.2 Run typecheck/build/tests in container with `docker compose exec` and confirm no regressions.
- [x] 5.3 Capture verification evidence and note rollback path (`provider` revert to `ollama`).
