# Embedding 模型自託管研究

> 研究日期：2026-04-03  
> 原因：降低對 Ollama 服務的依賴，提升 plugin 穩定性

---

## 問題背景

目前 plugin 仰賴 Ollama 服務提供 `nomic-embed-text` 模型：
- 服務宕機 → plugin 完全無法運作
- 需要維護額外服務（Ollama）
- npm 发行時使用者需自行安裝與運行 Ollama

**目標**：在 plugin 內提供內建的 embedding 模型，實現真正的 **zero-setup**。

---

## 可行方案

### 方案 A：@huggingface/transformers.js

| 項目 | 內容 |
|------|------|
| 模型 | `Xenova/all-MiniLM-L6-v2` |
| 維度 | 384 |
| 安裝 | `npm i @huggingface/transformers` |
| 運行 | WebGPU / WebAssembly / CPU |
| 下載 | 約 90MB（首次） |

**優點**：
- 15K stars，最成熟穩定
- 支援 WebGPU 加速
- 自動下載模型權重
- 跨平台（browser/Node.js）

**缺點**：
- 模型維度 384 vs 目前 768（需 schema migration 或 dual-dim）
- 首次下載時間

### 方案 B：fastembed

| 項目 | 內容 |
|------|------|
| 模型 | `Qdrant/fastembed-ontelt5-base` |
| 維度 | 384 |
| 安裝 | `npm i fastembed` |
|運行 | Node.js 原生 |

**優點**：
- 專為 Node.js 設計
- 較小的套件大小（~100KB）

**缺點**：
- 新套件（2025 發布），穩定性待驗證
- 模型選擇較少

### 方案 C：保持現狀 + fallback

| 項目 | 內容 |
|------|------|
| 預設 | Ollama（nomic-embed-text） |
| fallback | transformers.js（離線模式） |
| 觸發條件 | Ollama 不可用 |

**優點**：
- 不破壞現有功能
- 提供離線能力

**缺點**：
- 實作複雜度較高

---

## 向量維度 Migration 策略

| 方案 | 現有資料處理 |
|------|-------------|
| **A: Dual-dim** | 兩個維度共存，用時降維或升維 |
| **B: Re-embed** | 離線工具重算所有向量 |
| **C: 新 table** | 新 table 存放新維度 |

**推薦方案 B**：提供 migration tool，使用者自願升級。

---

## 實作評估

### 實作價值：⭐⭐⭐⭐☆（高）

| 評估 | 分數 |
|------|------|
| 穩定性提升 | ⭐⭐⭐⭐⭐ |
| zero-setup | ⭐⭐⭐⭐⭐ |
| 向量相容 | ⭐⭐⭐ |
| 套件大小 | ⭐⭐⭐ |
| 實作複雜度 | ⭐⭐⭐⭐ |

### BL-050（建議新增）

| 項目 | 內容 |
|------|------|
| BL-ID | BL-050 |
| Title | 內建 embedding 模型（transformers.js） |
| Priority | P1 |
| Status | proposed |
| Surface | Plugin |
| 實作 | 1. 新增 TransformersEmbedder 2. config fallback 链 3. 向量維度 migration tool |

---

## 更新的 backlog

在 `Epic 9 — 儲存引擎與規模韌性` 新增：

```markdown
| BL-050 | 內建 embedding 模型（transformers.js） | P1 | proposed | TBD | TBD | 
新增 TransformersEmbedder，提供离线 embedding 能力 [Surface: Plugin] |
```

---

## 實作後的差異分析

### 精確度影響

| 模型 | 維度 | MTEB 得分 | 適用場景 |
|------|------|-----------|----------|
| nomic-embed-text | 768 | ~60+ | 高精確度需求 |
| all-MiniLM-L6-v2 | 384 | ~55-58 | 一般用途足夠 |

**說明**：
- 維度降低不直接導致精確度下降
- all-MiniLM-L6-v2 是成熟模型，在 Sentence Similarity 任務上表現穩定
- 對於短文本檢索（memory 場景），差異不明顯

### Package 大小

| 項目 | 大小 | 說明 |
|------|------|------|
| lancedb-opencode-pro | ~237 KB | plugin 本體（不變） |
| @huggingface/transformers | ~2 MB | runtime |
| 模型權重 | ~90 MB | 首次調用時下載 |

**關鍵**：plugin npm package 大小維持不變 (~237KB)，額外依賴在 runtime 動態下載。

### 使用者體驗差異

| 項目 | Ollama (+ nomic-embed-text) | Transformers.js |
|------|-------------------------|-----------------|
| 首次設定 | 需安裝運行 Ollama | 自動下載 (~90MB) |
| 記憶體佔用 | Ollama 服務佔用 | 模型在 GPU/CPU |
| 離線能力 | Ollama 關閉即不可用 | 下載後可離線 |
| **npm package 大小** | ~237 KB | ~237 KB |

### 運作模式比較

| 現狀 | Transformers.js 版本 |
|------|-------------------|
| 依賴 Ollama HTTP API | 依賴 HuggingFace CDN |
| 服務需手動啟動 | 自動下載模型 |
| 網路不穩定→失敗 | 網路不穩定→首次失敗 |

**結論**：實作後體驗類似，只是換了一個下載來源。下載後可離線運行（比 Ollama 更穩定）。

---

## 參考資料

- [Transformers.js](https://github.com/huggingface/transformers.js/)
- [fastembed npm](https://www.npmjs.com/package/fastembed)
- [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2)