# 快速開始指南

**給第一次使用 lancedb-opencode-pro 的使用者**

完成以下步驟，5 分鐘內即可開始使用長期記憶功能。

---

## 前提條件

- [ ] OpenCode 1.2.27+ 已安裝
- [ ] Ollama 已安裝並可存取
- [ ] 已下載 embedding 模型 (`nomic-embed-text`)

---

## 步驟 1: 安裝插件

### 1.1 註冊插件

編輯 `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "oh-my-opencode",
    "lancedb-opencode-pro"
  ]
}
```

如果你已有其他插件，只需在 `plugin` 陣列中加入 `"lancedb-opencode-pro"`。

### 1.2 驗證安裝

因為 OpenCode 會自動透過 npm 下載並安裝外掛插件，您可以透過檢查快取目錄來驗證它是否正確載入：

```bash
# 檢查插件是否已正確快取 (在重啟 OpenCode 之後)
ls ~/.cache/opencode/node_modules/lancedb-opencode-pro
```
*(註：如果您是作為本地開發從原始碼安裝，插件目錄可能會位於您的開發位置，或者是透過手動連結至 `~/.config/opencode/plugins/lancedb-opencode-pro`)*

---

## 步驟 2: 建立設定檔

### 2.1 建立側車設定檔

建立 `~/.config/opencode/lancedb-opencode-pro.json`:

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

### 2.2 設定 Ollama 端點

依據你的 Ollama 位置設定 `embedding.baseUrl`:

| 情境 | 設定值 |
|------|--------|
| 與 OpenCode 同一台機器 | `http://127.0.0.1:11434` |
| 區域網路內另一台機器 | `http://192.168.11.206:11434` |

---

## 步驟 3: 驗證 Ollama 連線

```bash
# 本地 Ollama
curl http://127.0.0.1:11434/api/tags

# 遠端 Ollama
curl http://192.168.11.206:11434/api/tags
```

確認回應中包含 `nomic-embed-text` 模型。

---

## 步驟 4: 重啟 OpenCode

關閉並重新啟動 OpenCode，讓插件載入。

---

## 步驟 5: 驗證記憶功能

### 5.1 測試自動捕捉

在 OpenCode 中進行一次對話，例如：

```
請幫我記住：本專案使用 Docker Compose 進行測試，
指令是 docker compose build --no-cache && docker compose up -d
```

### 5.2 測試記憶召回

開啟新的對話視窗，詢問相關問題：

```
我該如何運行測試環境？
```

如果記憶功能正常，OpenCode 應該會自動注入之前記住的 Docker 指令。

### 5.3 手動搜尋記憶

```text
memory_search query="Docker Compose"
```

預期輸出：

```
1. [abc123][auto-capture|verified] (project:your-project) 
   本專案使用 Docker Compose 進行測試... [85%]
```

---

## 步驟 6: 驗證資料庫檔案

```bash
# 檢查 LanceDB 檔案是否建立
ls -la ~/.opencode/memory/lancedb
```

如果看到 `.lance` 檔案，表示記憶已成功持久化。

---

## 常見問題排解

### 問題 1: 插件未載入

**症狀**: OpenCode 未識別 `memory_*` 工具

**解法**:
```bash
# 檢查插件路徑
ls ~/.config/opencode/plugins/lancedb-opencode-pro

# 檢查設定檔
cat ~/.config/opencode/lancedb-opencode-pro.json
```

### 問題 2: Ollama 無法連線

**症狀**: `curl` 命令超時或拒絕連線

**解法**:
1. 確認 Ollama 服務運行中：`ollama serve`
2. 檢查防火牆設定
3. 確認模型已下載：`ollama list`

### 問題 3: 記憶未自動捕捉

**症狀**: 對話後沒有產生記憶

**可能原因**:
- 內容長度 < 80 字元 (預設閾值)
- 對話未觸發 `session.idle` 事件

**解法**:
- 手動使用 `memory_remember` 工具
- 調整 `minCaptureChars` 設定

### 問題 4: 搜尋結果為空

**症狀**: `memory_search` 無結果

**可能原因**:
- 尚未有任何記憶
- 查詢關鍵字不匹配

**解法**:
```text
# 檢查是否有記憶
memory_stats

# 嘗試更廣泛的查詢
memory_search query="專案"
```

---

## 下一步

完成快速開始後，你可以：

1. **深入了解進階設定** → [ADVANCED_CONFIG.md](ADVANCED_CONFIG.md)
2. **查看所有可用工具** → [../README.md#記憶管理工具](../README.md#記憶管理工具)
3. **了解系統架構** → [architecture.md](architecture.md)

---

## 參考資源

- [完整設定選項](ADVANCED_CONFIG.md#configuration-options)
- [記憶工具完整列表](../README.md#記憶管理工具)
- [環境變數覆蓋](ADVANCED_CONFIG.md#environment-variables)
- [Embedding 模型切換](embedding-migration.md)

---

**最後更新**: 2026-03-29  
**適用版本**: v0.5.0+
