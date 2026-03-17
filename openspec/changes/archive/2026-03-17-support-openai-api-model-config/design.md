## Context

目前 `lancedb-opencode-pro` 的嵌入流程由 `src/config.ts` 與 `src/embedder.ts` 組成，設定與實作都預設 `ollama`，且 `EmbeddingProvider` 型別僅允許 `"ollama"`。這讓插件在本機模型可用時運作良好，但在需要雲端 API、共用企業模型治理或無法部署 Ollama 的環境下無法使用。

此變更需要同時維持既有安裝路徑與預設值（避免破壞現有使用者），並新增 OpenAI 設定能力（API key、base URL、model）與 provider 切換機制。

## Goals / Non-Goals

**Goals:**
- 在不破壞既有 `ollama` 預設行為下，新增 `openai` 嵌入 provider 支援。
- 定義一致的設定契約與環境變數覆寫規則，讓 sidecar 與 env 可預測地共存。
- 讓 OpenAI 設定缺漏時快速失敗，錯誤訊息可直接指向修正方式。
- 維持既有記憶儲存/檢索流程（capture/search/delete/clear）不需要改變業務語意。

**Non-Goals:**
- 不在本次引入多雲 provider 管理框架（例如 Azure/OpenRouter 一次到位）。
- 不改動記憶資料表結構與 LanceDB 儲存格式。
- 不在本次加入成本控制、配額治理或模型自動降級策略。

## Decisions

### 1) Provider 型別擴充為聯集
- Decision: 將 `EmbeddingProvider` 由單一 `ollama` 擴充為 `ollama | openai`，並保留預設 provider 為 `ollama`。
- Rationale: 以最小破壞方式擴充能力，維持舊設定檔與舊環境變數在未變更時完全可用。
- Alternative considered: 直接改為通用字串 provider；拒絕，因為會失去型別保護與設定驗證品質。

### 2) 以 provider-aware factory 建立 embedder
- Decision: 在 `src/embedder.ts` 引入工廠函式，依 `embedding.provider` 回傳 `OllamaEmbedder` 或 `OpenAIEmbedder`。
- Rationale: 將 provider 分派集中在單一入口，避免在 `src/index.ts` 分散條件判斷。
- Alternative considered: 在 `index.ts` 直接 `if/else` 建構；拒絕，因為擴充第三個 provider 時會惡化可維護性。

### 3) OpenAI 設定採最小必要欄位
- Decision: `openai` 路徑至少要求 API key 與 model，`baseUrl` 為可選（預設官方 endpoint）。
- Rationale: 與官方 SDK 使用習慣一致，也能覆蓋代理或 OpenAI-compatible endpoint 場景。
- Alternative considered: 僅允許 API key 不允許 baseUrl；拒絕，因為會限制企業代理與相容端點。

### 4) 設定優先序延續既有規則
- Decision: 保持既有 precedence（env > config path > project sidecar > global sidecar > legacy > default），只新增 OpenAI 對應環境變數。
- Rationale: 使用者已熟悉此規則，避免在新增 provider 時引入不可預期覆寫行為。
- Alternative considered: 為 OpenAI 建立獨立 precedence；拒絕，因為會提高心智負擔。

### 5) 啟動時驗證 OpenAI 關鍵欄位
- Decision: 當 `provider=openai` 時，若缺 API key 或 model，初始化直接失敗並提供可行修正提示。
- Rationale: 及早暴露設定錯誤比延後到查詢時失敗更易排障。
- Alternative considered: 缺漏時靜默回退到 ollama；拒絕，因為會造成行為不透明與錯誤定位困難。

## Risks / Trade-offs

- [OpenAI 模型向量維度與既有資料不一致] -> Mitigation: 延續既有 `embeddingModel`/`vectorDim` 相容檢查，偵測不相容時阻擋混用並提示重建。
- [API key 管理不當造成洩漏風險] -> Mitigation: 文件與錯誤訊息強制導向環境變數，避免在範例中硬編碼金鑰。
- [網路型 provider 增加 timeout/重試複雜度] -> Mitigation: 保留可設定 timeout，並在錯誤路徑輸出 provider 與 endpoint 便於診斷。
- [雙 provider 文件變長、入門成本提升] -> Mitigation: README 保留「預設 Ollama 最短路徑」與「OpenAI 進階路徑」分段。

## Migration Plan

1. 擴充型別與設定解析，先讓 `openai` 設定可被讀取與驗證。
2. 實作 `OpenAIEmbedder` 並加入 embedder factory，替換目前硬編碼 `new OllamaEmbedder(...)`。
3. 補齊 provider 切換、設定錯誤與相容性相關測試。
4. 更新 README 設定範例與環境變數清單，明確標示預設仍為 Ollama。
5. 以 Docker 測試流程執行 typecheck/build/test，確認舊設定不回歸。
6. Rollback: 若發現相容性問題，可將 `embedding.provider` 設回 `ollama` 並移除 OpenAI 相關 env vars。

## Open Questions

- OpenAI 路徑是否採 SDK 依賴或維持 `fetch` 直接呼叫，以平衡依賴體積與實作一致性？
- 是否在 v1 同步支援 OpenAI-compatible embedding 路徑（例如 `/v1/embeddings` 但不同供應商）的額外 header 設定？
