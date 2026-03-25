# Embedding Model Migration Guide

**Status**: Production Ready  
**Last Updated**: March 2026  
**Audience**: Operators switching embedding providers or models

---

## Quick Summary

| 問題 | 答案 |
|------|------|
| 切換模型會讓舊記憶體「錯亂」嗎？ | ❌ 不會，系統有保護機制 |
| 舊記憶體會怎樣？ | ⚠️ 隱形化，搜尋不到但資料仍存在 |
| 系統會崩潰嗎？ | ❌ 不會，維度過濾在搜尋層 |
| 需要遷移嗎？ | 可選，依需求決定 |

---

## Vector Dimension Compatibility

### Supported Models & Dimensions

| 模型 | 向量維度 | 提供商 | 部署方式 |
|------|----------|--------|----------|
| `nomic-embed-text` | 768 | Ollama | 本地 |
| `mxbai-embed-large` | 1024 | Ollama | 本地 |
| `all-minilm` | 384 | Ollama | 本地 |
| `snowflake-arctic-embed` | 1024 | Ollama | 本地 |
| `text-embedding-3-small` | 1536 | OpenAI | API |
| `text-embedding-3-large` | 3072 | OpenAI | API |
| `text-embedding-ada-002` | 1536 | OpenAI | API |

### Why Dimensions Matter

向量存在於不同的幾何空間：
- 768 維向量：768 個浮點數
- 1536 維向量：1536 個浮點數

**無法轉換**：不同維度的向量是完全不同的語義座標系統，不存在數學上的轉換方法。

---

## System Protection Mechanism

### How lancedb-opencode-pro Handles Mismatched Vectors

每條記憶體記錄儲存向量維度資訊：

```typescript
interface MemoryRecord {
  vector: number[];          // 實際向量
  vectorDim: number;         // 向量維度（如 768）
  embeddingModel: string;    // 使用的模型名稱
  // ...其他欄位
}
```

### Search-Time Filtering

搜尋時自動過濾不兼容的向量（`store.ts` 第 176 行）：

```typescript
.filter((record) => 
  params.queryVector.length === 0 || 
  record.vector.length === params.queryVector.length
)
```

**實際效果**：
- ✅ 系統不會崩潰
- ✅ 新記憶體正常搜尋
- ⚠️ 舊記憶體被過濾，搜尋不到

### Detection Tool

使用 `countIncompatibleVectors()` 檢測不兼容的記錄：

```typescript
// 檢查有多少記錄的向量維度不符合當前配置
const incompatibleCount = await store.countIncompatibleVectors(
  scopes, 
  expectedDim
);
```

---

## Migration Scenarios

### Scenario 1: Accept Coexistence (Simplest)

**適用情境**：開發環境、不重要的舊記憶體

**行為**：
```
切換前: 100 條舊記憶體 (768 維) → 正常搜尋
切換後: 100 條舊記憶體 + 新記憶體 (1536 維)
  → 搜尋時: 只返回 1536 維的結果
  → 舊記憶體存在但「隱形」
```

**優點**：零操作，系統自動處理  
**缺點**：舊記憶體不可搜尋，佔用儲存空間

### Scenario 2: Clean Rebuild (Cleanest)

**適用情境**：生產環境、需要乾淨開始

**步驟**：
```bash
# 1. 查看當前記憶體數量
memory_stats

# 2. 備份（可選）
# 手動複製 ~/.opencode/memory/lancedb 目錄

# 3. 清空所有記憶體（謹慎操作）
memory_clear confirm=true

# 4. 切換配置
# 編輯 ~/.config/opencode/lancedb-opencode-pro.json

# 5. 重啟 OpenCode
```

**優點**：乾淨開始，無歷史包袱  
**缺點**：失去所有舊記憶體

### Scenario 3: Dual-Write Migration (Advanced)

**適用情境**：需要保留舊記憶體並遷移

**注意**：目前 lancedb-opencode-pro 未內建自動遷移工具，需要手動實作。

**概念流程**：
1. 同時執行兩個 embedding 提供商
2. 批次讀取舊記錄的 `text` 欄位
3. 使用新模型重新產生向量
4. 更新記錄的 `vector`、`vectorDim`、`embeddingModel`
5. 驗證搜尋品質

**預估時間**：
- 1,000 記錄：~5 分鐘
- 10,000 記錄：~30 分鐘
- 100,000 記錄：~5 小時

---

## Configuration Changes

### Switch from Ollama to OpenAI

#### 1. Edit Sidecar Config

```bash
vim ~/.config/opencode/lancedb-opencode-pro.json
```

#### 2. Update Embedding Section

**Before** (Ollama):
```json
{
  "embedding": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "baseUrl": "http://127.0.0.1:11434"
  }
}
```

**After** (OpenAI):
```json
{
  "embedding": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-your-openai-key"
  }
}
```

#### 3. Alternative: Environment Variables

```bash
# Set in shell profile (~/.bashrc, ~/.zshrc, etc.)
export LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER="openai"
export LANCEDB_OPENCODE_PRO_OPENAI_API_KEY="sk-your-openai-key"
export LANCEDB_OPENCODE_PRO_OPENAI_MODEL="text-embedding-3-small"
export LANCEDB_OPENCODE_PRO_OPENAI_BASE_URL="https://api.openai.com/v1"
```

#### 4. Restart OpenCode

```bash
# Restart your OpenCode session
```

---

## Verification Steps

### 1. Check Configuration Loaded

```bash
memory_stats
```

Expected output should show:
- Correct embedding model name
- Expected vector dimension

### 2. Test New Embedding

```bash
memory_search query="test embedding migration" limit=3
```

If results appear, new embedding is working.

### 3. Check Incompatible Vectors

Use `memory_stats` to see if old records exist (they won't appear in search but may show in total count).

---

## Cost Considerations

### OpenAI API Costs

| 項目 | 計算方式 | 範例 |
|------|----------|------|
| 新記憶體建立 | 每次自動捕獲 | 100 tokens × $0.02/1M = $0.000002 |
| 搜尋查詢 | 每次搜尋 | 50 tokens × $0.02/1M = $0.000001 |
| 批次遷移 | 舊記錄重新嵌入 | 10K 記錄 × 100 tokens × $0.02/1M = $0.02 |

### Monthly Estimate

假設：
- 每日 50 次搜尋
- 每日 10 次自動捕獲
- 每月 30 天

```
搜尋: 50 × 30 × $0.000001 = $0.0015
捕獲: 10 × 30 × $0.000002 = $0.0006
─────────────────────────────────────
總計: ~$0.002/月 (極低成本)
```

---

## Troubleshooting

### Issue: No Results After Switch

**症狀**：切換後搜尋無結果

**原因**：
1. 舊記錄的向量維度不匹配，被過濾
2. 新記錄尚未建立

**解決**：
```bash
# 確認新配置生效
memory_stats

# 執行一次搜尋觸發新記憶體建立
memory_search query="trigger new embedding" limit=1

# 等待自動捕獲建立新記錄
```

### Issue: OpenAI API Error

**症狀**：`OpenAI embedding request failed: HTTP 401`

**原因**：API Key 無效或缺失

**解決**：
```bash
# 檢查環境變數
echo $LANCEDB_OPENCODE_PRO_OPENAI_API_KEY

# 重新設定
export LANCEDB_OPENCODE_PRO_OPENAI_API_KEY="sk-valid-key"
```

### Issue: Slow Embedding Response

**症狀**：搜尋或捕獲延遲增加

**原因**：API 延遲 vs 本地 Ollama

**解決**：
```bash
# 調整超時設定
export LANCEDB_OPENCODE_PRO_OPENAI_TIMEOUT_MS=10000
```

---

## Rollback Procedure

If issues occur after switching:

### 1. Revert Configuration

```json
{
  "embedding": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "baseUrl": "http://127.0.0.1:11434"
  }
}
```

### 2. Restart OpenCode

### 3. Clean Up (Optional)

If you want to remove OpenAI-generated records:

```bash
# 清空所有記錄（包含 Ollama 和 OpenAI 產生的）
memory_clear confirm=true
```

---

## Best Practices

### 1. Test in Development First

```bash
# 使用專案級配置測試
.opencode/lancedb-opencode-pro.json
```

### 2. Backup Before Major Changes

```bash
cp -r ~/.opencode/memory/lancedb ~/.opencode/memory/lancedb.backup
```

### 3. Monitor After Switching

```bash
# 第一週每天檢查
memory_stats
memory_effectiveness
```

### 4. Document Your Configuration

記錄在專案的 README 或內部文件中：
- 使用的模型
- 切換日期
- 原因
- 觀察結果

---

## FAQ

### Q: 能否同時使用兩個模型？

**A**: 不建議。系統設計為單一 embedding 模型，混合使用會導致：
- 舊記錄搜尋不到
- 搜尋結果不可預測
- 無法計算有意義的相似度

### Q: 切換後舊記錄會自動刪除嗎？

**A**: 不會。舊記錄保留在資料庫中，只是搜尋時被過濾。如需刪除，必須手動執行 `memory_clear`。

### Q: 遷移需要多久？

**A**: 
- 配置切換：< 1 分鐘
- 清除重建：< 1 分鐘
- 批次遷移：取決於記錄數量（見 Scenario 3）

### Q: 費用會增加多少？

**A**: OpenAI embedding 成本極低（見 Cost Considerations 章節），每月約 $0.002。

---

## Related Documentation

- [operations.md](operations.md) - General operations
- [memory-validation-checklist.md](memory-validation-checklist.md) - Testing & validation
- [README.md](../README.md#openai-embedding-configuration) - OpenAI configuration reference

---

## References

- LanceDB Vector Dimensions: https://lancedb.github.io/lancedb/
- OpenAI Embeddings API: https://platform.openai.com/docs/guides/embeddings
- Ollama Embeddings: https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings
