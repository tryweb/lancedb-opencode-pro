## Why

目前記憶向量嵌入設定僅支援 `ollama`，對需要雲端託管模型或無法維運本機 Ollama 的使用者不夠彈性。為了讓相同記憶流程可在本機與雲端環境一致運作，需要在保留預設 Ollama 的前提下新增 OpenAI API 與模型設定能力。

## What Changes

- Extend embedding provider configuration to support both `ollama` and `openai` without breaking existing defaults.
- Add OpenAI-specific configuration fields and environment variable overrides for API key, base URL, and embedding model selection.
- Add provider selection and validation behavior so invalid or incomplete OpenAI settings fail fast with actionable errors.
- Update documentation and examples to show sidecar config and env-var precedence for dual-provider usage.

## Capabilities

### New Capabilities
- `openai-embedding-provider`: 提供 OpenAI 向量嵌入請求路徑，支援 API key、模型與 endpoint 設定，並與既有記憶寫入/搜尋流程整合。

### Modified Capabilities
- `memory-provider-config`: 將既有僅 Ollama 的嵌入設定契約擴充為多 provider，明確定義預設值、覆寫優先序與錯誤處理。

## Impact

- Affected code: `src/types.ts`, `src/config.ts`, `src/embedder.ts`, `src/index.ts`, and related tests/documentation.
- External dependencies: 可能新增 OpenAI SDK（或以標準 fetch 直接呼叫 OpenAI-compatible endpoint）。
- Operational concerns: API 金鑰管理、模型維度差異相容性、網路/限流失敗重試策略。
- Backward compatibility: 維持預設 `ollama` 行為，未提供 OpenAI 設定時不改變現有安裝與執行路徑。
