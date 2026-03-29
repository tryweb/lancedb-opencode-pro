# 進階設定指南

**給已安裝完成，想深入了解的使用者**

---

## 目錄

1. [檢索設定](#檢索設定)
2. [記憶注入控制](#記憶注入控制)
3. [去重複設定](#去重複設定)
4. [OpenAI Embedding](#openai-embedding)
5. [跨專案記憶共享](#跨專案記憶共享)
6. [環境變數覆蓋](#環境變數覆蓋)
7. [記憶工具完整參考](#記憶工具完整參考)

---

## 檢索設定 (v0.1.4+)

### 混合檢索架構

本專案使用 **Reciprocal Rank Fusion (RRF)** 融合向量檢索與 BM25 關鍵字檢索：

```json
{
  "retrieval": {
    "mode": "hybrid",
    "vectorWeight": 0.7,
    "bm25Weight": 0.3,
    "minScore": 0.2,
    "rrfK": 60,
    "recencyBoost": true,
    "recencyHalfLifeHours": 72,
    "importanceWeight": 0.4
  }
}
```

### 參數說明

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `mode` | `"hybrid"` | 檢索模式：`hybrid`, `vector-only`, `bm25-only` |
| `rrfK` | `60` | RRF 排名常數，較小值強調高排名項目 |
| `minScore` | `0.2` | 最低分數閾值，低於此值的結果會被過濾 |
| `recencyBoost` | `true` | 啟用近期性加成 |
| `recencyHalfLifeHours` | `72` | 近期性加成半衰期 (小時) |
| `importanceWeight` | `0.4` | 重要性加權權重 |

### 近期性加成計算

```
score_final = score_base * (1 + importance_weight) * recency_multiplier

recency_multiplier = 2^(-hours_since_creation / half_life)
```

### 調優建議

**情境 1: 強調最新資訊**
```json
{
  "retrieval": {
    "recencyBoost": true,
    "recencyHalfLifeHours": 24
  }
}
```

**情境 2: 強調重要性**
```json
{
  "retrieval": {
    "importanceWeight": 0.6,
    "recencyBoost": false
  }
}
```

**情境 3: 嚴格品質過濾**
```json
{
  "retrieval": {
    "minScore": 0.4,
    "rrfK": 30
  }
}
```

---

## 記憶注入控制 (v0.2.4+)

### 注入模式

```json
{
  "injection": {
    "mode": "adaptive",
    "maxMemories": 5,
    "minMemories": 2,
    "budgetTokens": 4096,
    "maxCharsPerMemory": 1200,
    "summarization": "auto",
    "summaryTargetChars": 400,
    "scoreDropTolerance": 0.15,
    "injectionFloor": 0.2,
    "codeSummarization": {
      "enabled": true,
      "pureCodeThreshold": 500,
      "maxCodeLines": 15,
      "codeTruncationMode": "smart",
      "preserveComments": true,
      "preserveImports": false
    }
  }
}
```

### 三種注入模式

#### 1. Fixed (預設)

始終注入固定數量的記憶，無論內容大小。

```json
{
  "injection": {
    "mode": "fixed",
    "maxMemories": 3
  }
}
```

**適用情境**: 向後相容、簡單設定

#### 2. Budget

限制總注入 token 數，累積記憶直到預算耗盡。

```json
{
  "injection": {
    "mode": "budget",
    "budgetTokens": 1500,
    "summarization": "truncate",
    "summaryTargetChars": 400
  }
}
```

**適用情境**: Token 敏感部署、上下文長度限制

#### 3. Adaptive (推薦)

根據分數下降動態調整注入數量。

```json
{
  "injection": {
    "mode": "adaptive",
    "maxMemories": 5,
    "minMemories": 2,
    "scoreDropTolerance": 0.15,
    "injectionFloor": 0.2
  }
}
```

**適用情境**: 品質敏感場景、避免低相關性記憶

### 摘要模式

| 模式 | 說明 | 適用 |
|------|------|------|
| `none` | 無摘要，注入全文 | 預設、向後相容 |
| `truncate` | 簡單截斷加省略號 | 快速、通用 |
| `extract` | 關鍵句抽取 (文字) / 結構保留截斷 (程式碼) | 高品質摘要 |
| `auto` | 內容感知 (自動選擇 truncate 或 extract) | 推薦 |

### 程式碼處理設定

```json
{
  "codeSummarization": {
    "enabled": true,
    "pureCodeThreshold": 500,
    "maxCodeLines": 15,
    "codeTruncationMode": "smart",
    "preserveComments": true,
    "preserveImports": false
  }
}
```

| 參數 | 選項 | 說明 |
|------|------|------|
| `enabled` | `true`, `false` | 是否啟用程式碼摘要 |
| `pureCodeThreshold` | `500` | 觸發純程式碼模式的最小字元數 |
| `maxCodeLines` | `15` | 保留的最大程式碼行數 |
| `codeTruncationMode` | `smart`, `signature`, `preserve` | `smart`: 智慧截斷、`signature`: 僅保留簽名、`preserve`: 完整保留 |
| `preserveComments` | `true`, `false` | 截斷時是否保留註解 |
| `preserveImports` | `true`, `false` | 截斷時是否保留 import 區塊 |

### Token 估算

系統使用以下倍率估算 token:

- 中文：1 字元 ≈ 0.6 token
- 英文：1 字元 ≈ 0.75 token
- 程式碼：1 字元 ≈ 1.0 token

---

## 去重複設定 (v0.2.5+)

### 配置

```json
{
  "dedup": {
    "enabled": true,
    "writeThreshold": 0.92,
    "consolidateThreshold": 0.95
  }
}
```

### 參數說明

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `enabled` | `true` | 啟用/停用去重複 |
| `writeThreshold` | `0.92` | 標記為潛在重複的相似度閾值 |
| `consolidateThreshold` | `0.95` | 自動合併的相似度閾值 |

### 運作流程

1. **標記 (寫入時)**: 新記憶與現有記憶比對，相似度 ≥ `writeThreshold` 則標記為 `isPotentialDuplicate: true`

2. **合併 (背景)**: `session.compacted` 事件觸發時，自動合併相似度 ≥ `consolidateThreshold` 的記憶對

### 手動合併

```text
# 合併單一 scope 內的重複記憶
memory_consolidate scope="project:your-project" confirm=true

# 跨 scope 合併所有重複記憶
memory_consolidate_all confirm=true
```

### 調優建議

**嚴格去重複** (減少儲存):
```json
{
  "dedup": {
    "writeThreshold": 0.88,
    "consolidateThreshold": 0.92
  }
}
```

**寬鬆去重複** (保留更多細節):
```json
{
  "dedup": {
    "writeThreshold": 0.95,
    "consolidateThreshold": 0.98
  }
}
```

---

## OpenAI Embedding (v0.1.2+)

### 切換至 OpenAI

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

### 推薦環境變數

```bash
export LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER="openai"
export LANCEDB_OPENCODE_PRO_OPENAI_API_KEY="$OPENAI_API_KEY"
export LANCEDB_OPENCODE_PRO_OPENAI_MODEL="text-embedding-3-small"
export LANCEDB_OPENCODE_PRO_OPENAI_BASE_URL="https://api.openai.com/v1"
```

### 驗證行為

- 若 `embedding.provider=openai` 且缺少 API key → 初始化失敗
- 若 `embedding.provider=openai` 且缺少 model → 初始化失敗
- 若 `embedding.provider` 未指定 → 預設使用 Ollama

### 遷移指南

完整遷移流程與注意事項：[embedding-migration.md](embedding-migration.md)

### 成本估算

以 `text-embedding-3-small` 為例：

- 價格：$0.02 / 1M tokens
- 每 1000 字元 ≈ 750 tokens
- 每 1000 次捕捉 (平均 200 字元) ≈ $0.003

---

## 跨專案記憶共享 (v0.2.0+)

### Global Scope 偵測

系統自動偵測通用知識並標記為 global scope：

```typescript
GLOBAL_KEYWORDS = [
  // 分發系統
  'docker', 'kubernetes', 'nginx',
  // 資料庫
  'postgresql', 'mongodb', 'redis',
  // 雲端
  'aws', 'gcp', 'azure',
  // 版本控制
  'git', 'github',
  // 協定
  'http', 'grpc', 'websocket'
]
```

### 設定

```json
{
  "includeGlobalScope": true,
  "globalDetectionThreshold": 2,
  "globalDiscountFactor": 0.7,
  "unusedDaysThreshold": 30
}
```

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `globalDetectionThreshold` | `2` | 出現次數達標即標記為 global |
| `globalDiscountFactor` | `0.7` | global 記憶分數打 7 折 |
| `unusedDaysThreshold` | `30` | 30 天未使用的 global 記憶可被清理 |

### 記憶範圍管理工具

```text
# 提升為 global scope
memory_scope_promote id="abc123" confirm=true

# 降級為 project scope
memory_scope_demote id="abc123" confirm=true

# 列出所有 global 記憶
memory_global_list

# 列出未使用的 global 記憶
memory_global_list filter="unused"
```

---

## 環境變數覆蓋

所有設定都可透過環境變數覆蓋：

### 基本設定

| 環境變數 | 對應設定 | 預設值 |
|----------|----------|--------|
| `LANCEDB_OPENCODE_PRO_PROVIDER` | `provider` | `"lancedb-opencode-pro"` |
| `LANCEDB_OPENCODE_PRO_DB_PATH` | `dbPath` | `"~/.opencode/memory/lancedb"` |
| `LANCEDB_OPENCODE_PRO_EMBEDDING_PROVIDER` | `embedding.provider` | `"ollama"` |
| `LANCEDB_OPENCODE_PRO_EMBEDDING_MODEL` | `embedding.model` | `"nomic-embed-text"` |
| `LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL` | `embedding.baseUrl` | `"http://127.0.0.1:11434"` |

### OpenAI 設定

| 環境變數 | 對應設定 |
|----------|----------|
| `LANCEDB_OPENCODE_PRO_OPENAI_API_KEY` | `embedding.apiKey` |
| `LANCEDB_OPENCODE_PRO_OPENAI_MODEL` | `embedding.model` |
| `LANCEDB_OPENCODE_PRO_OPENAI_BASE_URL` | `embedding.baseUrl` |
| `LANCEDB_OPENCODE_PRO_OPENAI_TIMEOUT_MS` | `embedding.timeoutMs` |

### 檢索設定

| 環境變數 | 對應設定 | 預設值 |
|----------|----------|--------|
| `LANCEDB_OPENCODE_PRO_RETRIEVAL_MODE` | `retrieval.mode` | `"hybrid"` |
| `LANCEDB_OPENCODE_PRO_VECTOR_WEIGHT` | `retrieval.vectorWeight` | `0.7` |
| `LANCEDB_OPENCODE_PRO_BM25_WEIGHT` | `retrieval.bm25Weight` | `0.3` |
| `LANCEDB_OPENCODE_PRO_MIN_SCORE` | `retrieval.minScore` | `0.2` |
| `LANCEDB_OPENCODE_PRO_RRF_K` | `retrieval.rrfK` | `60` |
| `LANCEDB_OPENCODE_PRO_RECENCY_BOOST` | `retrieval.recencyBoost` | `true` |
| `LANCEDB_OPENCODE_PRO_RECENCY_HALF_LIFE_HOURS` | `retrieval.recencyHalfLifeHours` | `72` |
| `LANCEDB_OPENCODE_PRO_IMPORTANCE_WEIGHT` | `retrieval.importanceWeight` | `0.4` |

### 注入設定

| 環境變數 | 對應設定 | 預設值 |
|----------|----------|--------|
| `LANCEDB_OPENCODE_PRO_INJECTION_MODE` | `injection.mode` | `"fixed"` |
| `LANCEDB_OPENCODE_PRO_INJECTION_MAX_MEMORIES` | `injection.maxMemories` | `3` |
| `LANCEDB_OPENCODE_PRO_INJECTION_MIN_MEMORIES` | `injection.minMemories` | `1` |
| `LANCEDB_OPENCODE_PRO_INJECTION_BUDGET_TOKENS` | `injection.budgetTokens` | `4096` |
| `LANCEDB_OPENCODE_PRO_INJECTION_MAX_CHARS` | `injection.maxCharsPerMemory` | `1200` |
| `LANCEDB_OPENCODE_PRO_INJECTION_SUMMARIZATION` | `injection.summarization` | `"none"` |
| `LANCEDB_OPENCODE_PRO_INJECTION_SUMMARY_TARGET_CHARS` | `injection.summaryTargetChars` | `300` |
| `LANCEDB_OPENCODE_PRO_INJECTION_SCORE_DROP_TOLERANCE` | `injection.scoreDropTolerance` | `0.15` |
| `LANCEDB_OPENCODE_PRO_INJECTION_INJECTION_FLOOR` | `injection.injectionFloor` | `0.2` |
| `LANCEDB_OPENCODE_PRO_CODE_SUMMARIZATION_ENABLED` | `codeSummarization.enabled` | `true` |

### 去重複設定

| 環境變數 | 對應設定 | 預設值 |
|----------|----------|--------|
| `LANCEDB_OPENCODE_PRO_DEDUP_ENABLED` | `dedup.enabled` | `true` |
| `LANCEDB_OPENCODE_PRO_DEDUP_WRITE_THRESHOLD` | `dedup.writeThreshold` | `0.92` |
| `LANCEDB_OPENCODE_PRO_DEDUP_CONSOLIDATE_THRESHOLD` | `dedup.consolidateThreshold` | `0.95` |

### 其他設定

| 環境變數 | 對應設定 | 預設值 |
|----------|----------|--------|
| `LANCEDB_OPENCODE_PRO_INCLUDE_GLOBAL_SCOPE` | `includeGlobalScope` | `true` |
| `LANCEDB_OPENCODE_PRO_GLOBAL_DETECTION_THRESHOLD` | `globalDetectionThreshold` | `2` |
| `LANCEDB_OPENCODE_PRO_GLOBAL_DISCOUNT_FACTOR` | `globalDiscountFactor` | `0.7` |
| `LANCEDB_OPENCODE_PRO_UNUSED_DAYS_THRESHOLD` | `unusedDaysThreshold` | `30` |
| `LANCEDB_OPENCODE_PRO_MIN_CAPTURE_CHARS` | `minCaptureChars` | `80` |
| `LANCEDB_OPENCODE_PRO_MAX_ENTRIES_PER_SCOPE` | `maxEntriesPerScope` | `3000` |

---

## 記憶工具完整參考

### 基本工具

#### `memory_search`

搜尋長期記憶。

```text
memory_search query="你的查詢" [scope="project:my-project"] [limit=10]
```

**輸出**: 包含引用資訊 `[source|status]` 的記憶列表

#### `memory_delete`

刪除單一記憶。

```text
memory_delete id="abc123" confirm=true
```

**注意**: 需要 `confirm=true` 以防止誤刪

#### `memory_clear`

清空指定 scope 的所有記憶。

```text
memory_clear scope="project:my-project" confirm=true
```

**注意**: 需要 `confirm=true` 以防止誤刪

#### `memory_stats`

顯示記憶統計資訊。

```text
memory_stats [scope="project:my-project"]
```

**輸出**:
```json
{
  "scope": "project:my-project",
  "totalMemories": 150,
  "oldestEntry": "2026-03-01T10:00:00Z",
  "newestEntry": "2026-03-29T15:30:00Z"
}
```

### 記憶操作工具

#### `memory_remember`

手動儲存記憶。

```text
memory_remember text="記憶內容" [scope="project:my-project"]
```

#### `memory_forget`

移除或停用記憶。

```text
memory_forget id="abc123" confirm=true [hard=false]
```

| 參數 | 說明 |
|------|------|
| `hard=false` | 軟刪除 (預設)，保留記錄但標記為停用 |
| `hard=true` | 硬刪除，徹底移除記錄 |

#### `memory_what_did_you_learn`

顯示近期學習摘要。

```text
memory_what_did_you_learn [days=7] [scope="project:my-project"]
```

### 效果回饋工具 (v0.1.3+)

#### `memory_feedback_missing`

回報遺漏的記憶。

```text
memory_feedback_missing text="應該被記住但沒被記住的內容" labels=["deployment", "docker"]
```

#### `memory_feedback_wrong`

回報錯誤的記憶。

```text
memory_feedback_wrong id="abc123" reason="資訊已過時"
```

#### `memory_feedback_useful`

回報記憶是否有幫助。

```text
memory_feedback_useful id="abc123" helpful=true
```

#### `memory_effectiveness`

顯示效果指標。

```text
memory_effectiveness [scope="project:my-project"]
```

**輸出範例**: [../README.md#viewing-metrics](../README.md#viewing-metrics)

### 範圍管理工具 (v0.2.0+)

#### `memory_scope_promote`

提升記憶為 global scope。

```text
memory_scope_promote id="abc123" confirm=true
```

#### `memory_scope_demote`

降級記憶為 project scope。

```text
memory_scope_demote id="abc123" confirm=true
```

#### `memory_global_list`

列出 global scope 記憶。

```text
memory_global_list [query="關鍵字"] [filter="unused"]
```

### 去重複工具 (v0.2.5+)

#### `memory_consolidate`

合併單一 scope 內的重複記憶。

```text
memory_consolidate scope="project:my-project" confirm=true
```

#### `memory_consolidate_all`

跨 scope 合併所有重複記憶。

```text
memory_consolidate_all confirm=true
```

### 引用工具 (v0.4.0+)

#### `memory_citation`

檢視/更新引用資訊。

```text
# 檢視
memory_citation id="abc123"

# 更新狀態
memory_citation id="abc123" status="verified"
```

#### `memory_validate_citation`

驗證引用狀態。

```text
memory_validate_citation id="abc123"
```

### 解釋工具 (v0.5.0+)

#### `memory_why`

解釋為何特定記憶被召回。

```text
memory_why id="abc123"
```

#### `memory_explain_recall`

解釋最近一次召回操作的因素。

```text
memory_explain_recall
```

### 事件式學習工具 (v0.2.7+)

#### `task_episode_create`

建立任務歷程記錄。

```text
task_episode_create description="任務描述" [scope="project:my-project"]
```

#### `task_episode_query`

查詢歷程記錄。

```text
task_episode_query [scope="project:my-project"] [state="completed"]
```

#### `similar_task_recall`

向量相似度檢索相似任務。

```text
similar_task_recall query="任務描述" [threshold=0.85] [limit=5]
```

#### `retry_budget_suggest`

建議重試預算。

```text
retry_budget_suggest errorType="build-failed"
```

#### `recovery_strategy_suggest`

建議恢復策略。

```text
recovery_strategy_suggest taskId="task_123"
```

### Docker Compose 端口規劃 (v0.1.1+)

#### `memory_port_plan`

規劃不衝突的 Docker 端口配置。

```text
memory_port_plan project="project-alpha" services='[{"name":"web","containerPort":3000}]' rangeStart=23000 rangeEnd=23999 persist=true
```

---

## 監控與診斷

詳細監控指南：[operations.md](operations.md)

### 健康檢查命令

```text
# 檢查記憶系統狀態
memory_stats

# 檢查效果指標
memory_effectiveness

# 檢查 global 記憶
memory_global_list

# 檢查潛在重複
memory_consolidate scope="project:my-project" confirm=false
```

### 效能調優

- **搜尋延遲高**: 調整 `minScore` 提高閾值、減少 `maxEntriesPerScope`
- **召回率低**: 降低 `minScore`、調整 `rrfK`、啟用 `recencyBoost`
- **Token 使用過多**: 使用 `budget` 模式、啟用 `summarization`

---

**最後更新**: 2026-03-29  
**適用版本**: v0.5.0+
