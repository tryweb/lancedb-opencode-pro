## Why

目前 lancedb-opencode-pro 的記憶體注入存在三個問題：

1. **Token 消耗無法精確控制**：每次請求固定注入最多 3 條記憶體，每條最多 1200 字元，在長對話中累積可觀的 token 成本（約 4000-5000 tokens/請求）

2. **程式碼截斷破壞語法**：簡單的字元截斷 `clipText(text, 1200)` 會在程式碼中間截斷，導致語法不完整、LLM 解讀困難

3. **缺乏內容感知**：無法區分程式碼和敘述文本，沒有針對程式碼片段的特殊處理，低相關度記憶體仍會注入浪費空間

這些問題影響使用成本、檢索品質和開發者體驗。現在解決是因為功能相對獨立，且對 token 效率影響顯著。

## What Changes

- 新增 Token 預算配置，支援固定數量、預算制、自適應三種模式
- 新增智能摘要功能，針對文字、程式碼、混合內容提供不同的摘要策略
- 新增程式碼感知截斷，在完整語句邊界截斷而非任意字元位置
- 新增動態注入上限，根據相關度分數動態調整注入數量
- 新增 `injection` 配置區塊，包含完整配置選項
- 修改 `experimental.chat.system.transform` 鉤子，使用新配置計算注入內容
- 向後相容：預設行為維持 `mode: "fixed"` 和 `maxMemories: 3`

## Capabilities

### New Capabilities

- `injection-control`:控制記憶體注入的 token 預算、摘要策略、動態上限，支援文字和程式碼的內容感知處理

### Modified Capabilities

- `memory-auto-capture-and-recall`: 修改檢索注入邏輯，從硬編碼上限改為可配置的預算制和動態上限
- `memory-provider-config`: 新增 `injection` 配置區塊，包含 mode、budgetTokens、summarization、codeSummarization 等選項

## Impact

### Code Changes

- `src/config.ts`: 新增 `InjectionConfig` 和 `CodeSummarizationConfig` 類型定義，解析新配置選項
- `src/types.ts`: 新增 `ContentType`、`ContentDetection`、`SummarizedContent` 等類型
- `src/index.ts`: 修改 `experimental.chat.system.transform` 鉤子，使用新配置計算注入內容
- `src/extract.ts`: 新增程式碼偵測、智慧截斷、關鍵句提取等函數
- `src/summarize.ts` (新檔案): 內容摘要處理邏輯

### API Changes

- 配置檔案新增 `injection` 區塊（向後相容，預設值維持現有行為）
- 無 breaking changes

### Dependencies

- 無新增外部依賴

### Behavior Changes

- 記憶體注入從固定 3 條改為可配置的動態上限
- 長記憶體可能被摘要而非完整注入（取決於配置）
- 程式碼片段會在完整語句邊界截斷（如果啟用 `codeSummarization.enabled`）