# lancedb-opencode-pro

**LanceDB-backed long-term memory provider for OpenCode**

[![npm version](https://img.shields.io/npm/v/lancedb-opencode-pro)](https://www.npmjs.com/package/lancedb-opencode-pro)
[![OpenCode](https://img.shields.io/badge/OpenCode-1.2.27+-blue)](https://opencode.ai)

歡迎使用 **lancedb-opencode-pro**！本擴充套件透過 LanceDB 為 OpenCode 提供持久且高效的長期記憶系統。

為了讓您能最快找到所需的資訊，請根據您的需求選擇以下指南：

## 🗺️ 選擇您的指南

### 🚀 新手使用者
*您是第一次使用此專案，希望盡快完成安裝與基本操作。*
👉 **[閱讀新手指南 (約需 15 分鐘)](docs/QUICK_START.zh.md)**
- 完整安裝步驟與範例
- 基本使用方式教學
- 常見問題排解

### ⚙️ 進階使用者
*您已安裝完成，想深入了解如何微調檢索、使用 OpenAI Embedding 或跨專案共享記憶。*
👉 **[閱讀進階設定 (約需 30 分鐘)](docs/ADVANCED_CONFIG.zh.md)**
- 進階混合檢索設定 (RRF、近期性加成、重要性加權)
- 記憶注入控制 (budget / adaptive 模式)
- OpenAI Embedding 設定
- 跨專案記憶共享 (Global Scope)

### 🛠️ 開發貢獻者
*您想了解系統架構、執行測試或想參與本專案的開源貢獻。*
👉 **[閱讀開發流程指南 (約需 20 分鐘)](docs/DEVELOPMENT_WORKFLOW.zh.md)**
- 本地開發環境設定
- OpenCode skills 使用指南
- 測試與驗證流程
- 專案發布流程

---

## 🎯 快速開始 (5 分鐘)

### 1. 註冊插件

在 `~/.config/opencode/opencode.json` 中註冊本插件：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "oh-my-opencode",
    "lancedb-opencode-pro"
  ]
}
```

### 2. 建立設定檔

建立 `~/.config/opencode/lancedb-opencode-pro.json`：

```json
{
  "provider": "lancedb-opencode-pro",
  "dbPath": "~/.opencode/memory/lancedb",
  "embedding": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "baseUrl": "http://127.0.0.1:11434"
  }
}
```

### 3. 啟動 Ollama 並重啟 OpenCode

```bash
# 確認 Ollama 可存取
curl http://127.0.0.1:11434/api/tags

# 接著重啟您的 OpenCode
```

完成！現在 OpenCode 會自動捕捉對話中的關鍵決策，並在下次對話時自動注入相關記憶。

---

## ✨ 核心功能

### 自動記憶捕捉
- 從 Assistant 回應中自動提取決策、教訓與模式。
- 最小捕捉長度：預設 80 字元（可調整）。
- 自動分類為專案 (project) 或全域 (global) 範圍。

### 混合檢索 (v0.1.4+)
- **向量檢索** + **BM25 關鍵字檢索**雙軌並行。
- Reciprocal Rank Fusion (RRF) 融合演算法。
- 支援近期性加成 (recency boost) 與重要性加權 (importance weighting)。

### 記憶管理工具
| 工具 | 功能 | 文件連結 |
|------|------|----------|
| `memory_search` | 混合檢索長期記憶 | [進階設定](docs/ADVANCED_CONFIG.zh.md#memory_search) |
| `memory_delete` | 刪除單一記憶 | [進階設定](docs/ADVANCED_CONFIG.zh.md#memory_delete) |
| `memory_clear` | 清空指定範圍內的所有記憶 | [進階設定](docs/ADVANCED_CONFIG.zh.md#memory_clear) |
| `memory_stats` | 顯示記憶統計資訊 | [進階設定](docs/ADVANCED_CONFIG.zh.md#memory_stats) |
| `memory_remember` | 手動儲存記憶 | [進階設定](docs/ADVANCED_CONFIG.zh.md#memory_remember) |
| `memory_forget` | 移除或停用記憶 | [進階設定](docs/ADVANCED_CONFIG.zh.md#memory_forget) |
| `memory_what_did_you_learn` | 顯示近期學習摘要 | [進階設定](docs/ADVANCED_CONFIG.zh.md#memory_what_did_you_learn) |

*(關於 **記憶效果回饋**、**跨專案記憶共享**、**去重複機制**、**引用模型** 以及 **事件式學習** 等更詳細的功能說明，請參見 [進階設定](docs/ADVANCED_CONFIG.zh.md)。)*

---

## ⚙️ 設定選項概覽

### 基本設定
```json
{
  "provider": "lancedb-opencode-pro",
  "dbPath": "~/.opencode/memory/lancedb",
  "embedding": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "baseUrl": "http://127.0.0.1:11434"
  },
  "retrieval": {
    "mode": "hybrid",
    "vectorWeight": 0.7,
    "bm25Weight": 0.3,
    "minScore": 0.2
  }
}
```
*完整的設定選項（包含記憶注入控制、去重複、OpenAI 設定等）均詳列於 [docs/ADVANCED_CONFIG.zh.md](docs/ADVANCED_CONFIG.zh.md)。*

### 設定優先順序 (由高到低)
1. 環境變數 (`LANCEDB_OPENCODE_PRO_*`)
2. `LANCEDB_OPENCODE_PRO_CONFIG_PATH`
3. 專案側車設定：`.opencode/lancedb-opencode-pro.json`
4. 全域側車設定：`~/.config/opencode/lancedb-opencode-pro.json`
5. 舊版側車或內建預設值

---

## 🧪 驗證與測試

透過 Docker 快速驗證：
```bash
docker compose build --no-cache && docker compose up -d
docker compose exec opencode-dev npm run verify
```

完整驗證 (發布前建議執行)：
```bash
docker compose exec opencode-dev npm run verify:full
```

詳細的驗證清單請參考 [docs/memory-validation-checklist.zh.md](docs/memory-validation-checklist.zh.md)。

---

## 📦 安裝選項

主要方式 (推薦)：使用 npm package。
如果在特殊網路環境下，亦可從 GitHub releases 下載 `.tgz` 或從原始碼建構安裝，詳見 [安裝選項](docs/QUICK_START.zh.md#install-options)。

---

## 🗺️ 版本歷史

- **v0.5.0**: 新增記憶解釋工具 (`memory_why`, `memory_explain_recall`)
- **v0.4.0**: 新增引用模型追蹤與驗證 (`memory_citation`, `memory_validate_citation`)
- **v0.3.0**: 引入事件式學習 Hooks
- **v0.2.9**: 引入事件式學習工具 (`task_episode_create`, `similar_task_recall` 等)
- **v0.2.5**: 新增去重複機制 (`memory_consolidate`)
- **v0.2.4**: 強化記憶注入控制 (支援 budget, adaptive 模式)
- **v0.2.0**: 支援跨專案記憶共享 (global scope)

完整變更日誌請參閱：[CHANGELOG.md](CHANGELOG.md)

---

## 🤝 參與貢獻

1. 閱讀 [docs/DEVELOPMENT_WORKFLOW.zh.md](docs/DEVELOPMENT_WORKFLOW.zh.md)
2. 了解 OpenSpec 規格，相關文件放於 `openspec/specs/`
3. 使用 `backlog-to-openspec` 技能建立變更提案

---

## 📞 支援與授權

- **報告問題**: 軟體錯誤回報或功能請求，請至 [GitHub Issues](https://github.com/tryweb/lancedb-opencode-pro/issues) 提交。
- **授權協議**: MIT License - 詳見 [LICENSE](LICENSE)。

**最後更新**: 2026-03-29  
**最新版本**: v0.5.0
