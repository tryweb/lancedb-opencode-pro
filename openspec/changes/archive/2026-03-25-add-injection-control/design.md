## Context

lancedb-opencode-pro 目前在 `experimental.chat.system.transform` 鉤子中注入記憶體到系統提示。現有實作存在以下限制：

- **硬編碼上限**：`limit: 3` 固定注入最多 3 條記憶體
- **字元截斷**：`clipText(text, 1200)` 簡單截斷，不考慮內容類型
- **無 token 預算概念**：無法根據實際 token 消耗控制注入

這些限制導致 token 消耗不可預測，且程式碼片段可能在語法不完整處截斷。

### Stakeholders

- **OpenCode 使用者**：透過配置控制 token 消耗
- **記憶體檢索系統**：需要提供可控的注入邏輯
- **LLM API**：接收格式良好的系統提示

## Goals/ Non-Goals

**Goals:**

1. 提供可配置的 token 預算控制，支援固定、預算、自適應三種模式
2. 實作內容感知摘要，區分文字和程式碼的處理策略
3. 確保程式碼片段在完整語句邊界截斷
4. 維持向後相容，預設行為等同現有實作
5. 最小化效能開銷（摘要演算法在 ms 級別）

**Non-Goals:**

1. 不實作 LLM-based 摘要（使用啟發式規則即可）
2. 不修改記憶體儲存結構（只改變注入時的加工）
3. 不實作跨會話的 token 預算追蹤
4. 不支援自訂摘要器擴充點（保持簡單）

## Decisions

### Decision 1: Token 預算模式

**選項：**
- A: 僅支援固定數量（現狀）
- B: 僅 token 預算制
- C: 支援固定、預算、自適應三種模式

**決策：選擇 C**

**理由：**
- 固定模式提供向後相容
- 預算模式適合成本敏感場景
- 自適應模式適合品質優先場景
- 不增加複雜度（三種模式共用同一核心邏輯）

**實作：**
```typescript
type InjectionMode = "fixed" | "budget" | "adaptive";

interface InjectionConfig {
  mode: InjectionMode;
  maxMemories: number;      // 固定模式使用
  minMemories: number;      // 最低保證
  budgetTokens: number;     // 預算模式使用
  // ...
}
```

### Decision 2: 摘要策略

**選項：**
- A: 不摘要（現狀）
- B: 僅截斷
- C: 關鍵句提取
- D: 混合策略（根據內容類型選擇）

**決策：選擇 D**

**理由：**
- 程式碼和文字的最佳摘要策略不同
- 使用啟發式規則而非 LLM，保持效能
- 程式碼使用智慧截斷（括號平衡）
- 文字使用關鍵句提取（正則匹配）

**實作：**
```typescript
type SummarizationMode = "none" | "truncate" | "extract" | "auto";

function summarizeContent(
  text: string,
  mode: SummarizationMode,
  config: SummarizationConfig
): SummarizedContent {
  const detection = detectContentType(text);
  
  switch (mode) {
    case "none": return { type: "kept", content: text };
    case "truncate": return truncateText(text, config.maxChars);
    case "extract": return extractKeySentences(text, config.targetChars);
    case "auto": return smartSummarize(text, detection, config);
  }
}
```

### Decision 3: 程式碼偵測方法

**選項：**
- A: 僅 Markdown 程式碼區塊
- B: 僅括號平衡
- C: 多重啟發式（Markdown + 括號 + 關鍵字）

**決策：選擇 C**

**理由：**
- 單一方法有盲點（不是所有程式碼都用 Markdown 包裹）
- 多重啟發式覆蓋率更高
- 效能開銷可接受（O(n) 掃描）

**實作：**
```typescript
function detectContentType(text: string): ContentDetection {
  const hasMarkdownCode = /```[\s\S]*?```/.test(text);
  const bracketBalance = calculateBracketBalance(text);
  const codeKeywords = countCodeKeywords(text);
  const indentationRatio = calculateIndentationRatio(text);
  
  const codeScore = 
    (hasMarkdownCode ? 2 : 0) +
    (bracketBalance > 3 ? 1 : 0) +
    (codeKeywords > 5 ? 1 : 0) +
    (indentationRatio > 0.3 ? 1 : 0);
  
  if (codeScore >= 3) return { hasCode: true, isPureCode: codeScore >= 5 };
  if (codeScore >= 1) return { hasCode: true, isPureCode: false };
  return { hasCode: false, isPureCode: false };
}
```

### Decision 4: Token 估算公式

**選項：**
- A: 僅使用字元數 / 4（英文）
- B: 根據內容類型使用不同係數
- C: 呼叫 tokenizer 精確計算

**決策：選擇 B**

**理由：**
- 選項 A 不準確（中文 token 比例不同）
- 選項 C 有效能開銷且依賴外部庫
- 選項 B 是合理的近似

**實作：**
```typescript
function estimateTokens(text: string, contentType: ContentType): number {
  // 中文比例估算
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const nonChineseChars = text.length - chineseChars;
  
  // 中文約 2 字/token，英文約 4 字/token
  const textTokens = Math.ceil(chineseChars / 2 + nonChineseChars / 4);
  
  // 程式碼 token 通常更密集
  if (contentType === "code") {
    return Math.ceil(textTokens * 1.2);
  }
  
  return textTokens;
}
```

### Decision 5: 配置結構

**決策：使用巢狀配置結構**

```typescript
interface MemoryRuntimeConfig {
  // ... 現有配置
  injection: InjectionConfig;
}

interface InjectionConfig {
  mode: InjectionMode;
  maxMemories: number;
  minMemories: number;
  budgetTokens: number;
  maxCharsPerMemory: number;
  summarization: SummarizationMode;
  summaryTargetChars: number;
  scoreDropTolerance: number;
  injectionFloor: number;
  codeSummarization: CodeSummarizationConfig;
}

interface CodeSummarizationConfig {
  enabled: boolean;
  pureCodeThreshold: number;
  maxCodeLines: number;
  codeTruncationMode: "smart" | "signature" | "preserve";
  preserveComments: boolean;
  preserveImports: boolean;
}
```

## Risks / Trade-offs

### Risk 1: 摘要遺失關鍵資訊

**描述**：啟發式摘要可能截斷重要上下文

**緩解措施**：
- 預設關閉摘要（`summarization: "none"`）
- 提供 `preserveComments` 和 `preserveImports` 選項
- 記錄摘要事件到 effectiveness_events 追蹤品質

### Risk 2: 程式碼偵測誤判

**描述**：將非程式碼內容誤判為程式碼

**緩解措施**：
- 使用高分門檻（codeScore >= 3）
- `isPureCode` 需要更高門檻（codeScore >= 5）
- 提供手動覆蓋選項（未來可考慮）

### Risk 3: Token 估算不精確

**描述**：估算值與實際 token 數有差異

**緩解措施**：
- 估算值作為「預算上限」而非精確值
- 實際 token 仍由 LLM計算
- 保守估算（係數 1.2 對程式碼）

### Risk 4: 向後相容

**描述**：現有使用者可能依賴固定 3 條記憶體行為

**緩解措施**：
- 預設 `mode: "fixed"`、`maxMemories: 3`
- 只有顯式配置才啟用新行為
- 文件清楚標註預設行為

## Migration Plan

### Phase 1: 配置擴充（向後相容）

1. 新增 `InjectionConfig` 類型定義
2. 在 `resolveMemoryConfig` 中新增預設值
3. 不改變現有行為

### Phase 2: 實作核心邏輯

1. 新增 `src/summarize.ts` 模組
2. 實作 `detectContentType`、`smartTruncateCode`、`extractKeySentences`
3. 新增配置解析邏輯到 `config.ts`

### Phase 3: 整合注入流程

1. 修改 `experimental.chat.system.transform` 鉤子
2. 使用新配置計算注入內容
3. 實作動態上限邏輯

### Phase 4: 測試與文件

1. 新增單元測試涵蓋各種內容類型
2. 新增整合測試驗證 token 預算
3. 更新 README 文件

### Rollback Strategy

- 設定未指定時使用預設值（等同現有行為）
- 新增 `injection.mode: "fixed"` 可明確指定舊行為
- 配置錯誤時降級到預設值並記錄警告

## Open Questions

1. **是否需要記錄摘要事件到 effectiveness_events？**
   - 用於追蹤摘要品質和使用頻率
   - 可能造成額外開銷

2. **是否支援使用者自訂摘要門檻？**
   - 目前使用硬編碼門檻（300字元純文字、500字元純程式碼）
   - 是否需要暴露為配置選項？

3. **是否需要「摘要預覽」功能？**
   - 讓使用者在啟用前看到摘要效果
   - 可能需要新增 `memory_preview_summarization` 工具