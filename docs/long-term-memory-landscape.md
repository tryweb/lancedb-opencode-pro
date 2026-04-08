# AI 長期記憶技術方案全景研究

> **研究日期**：2026-04-08
> **研究範圍**：向量資料庫以外的 AI agent 長期記憶技術方案
> **目的**：作為本專案記憶架構演進的技術參考依據

---

## 摘要

本專案目前以 LanceDB（向量 + BM25 混合檢索）作為記憶儲存引擎。本文研究 2024–2026 年間向量資料庫以外的長期記憶技術方案，為後續架構演進提供決策依據。

**核心發現**：純向量相似度搜尋已被業界普遍認為不足以支撐完整的 agent 記憶需求。2026 年的共識是 **混合架構**（vector + graph + structured + temporal）優於任何單一方案。

---

## 1. 技術方案總覽

| 類別 | 核心思路 | 代表專案 | 成熟度 | 與本專案關聯性 |
|------|---------|---------|--------|--------------|
| Graph-based Memory | 知識圖譜 + 關係推理 | Neo4j Agent Memory, Graphiti, LightRAG | Production-ready | **高** — 補足關係推理與時間推理 |
| 層級式記憶 (Tiered) | 模仿 OS 記憶體管理 | Letta (MemGPT), MemoryOS, HiMem | Production-ready | **中** — 本專案已有 scope 分層基礎 |
| Memory-Augmented Transformers | 注意力層內嵌壓縮記憶 | Infini-attention, Titans, M+ | Research stage | **低** — 需模型架構修改，非 plugin 層可做 |
| 參數化記憶 (Parametric) | Fine-tuning / LoRA 當記憶載體 | LoRA-as-Knowledge, Safe LoRA | Research stage | **低** — 非本專案責任範圍 |
| 反思型記憶 (Reflective) | Agent 從錯誤中學習 | Experiential Reflective Learning, MAR | Research stage | **中** — 可強化現有 episodic learning |
| 多模態記憶 | 跨模態記憶存取 | MemVerse, Omni-SimpleMem | Early research | **低** — 本專案以文字為主 |
| 混合式生產平台 | 多後端融合 | Mem0, Zep/Graphiti, Hindsight | Production-ready | **高** — 可參考架構設計 |

---

## 2. Graph-based Memory（圖結構記憶）

### 2.1 核心價值

向量搜尋回答「語義上最相近的是什麼」，圖結構回答：
- 「誰和誰有什麼關係」（實體關係推理）
- 「事情是怎麼因果發展的」（因果推理）
- 「上季度負責人是誰」（時間推理）

### 2.2 三個主要分支

#### a) Knowledge Graph as Memory

**代表**：Neo4j Agent Memory（[github.com/neo4j-labs/agent-memory](https://github.com/neo4j-labs/agent-memory)）

三種記憶類型：
- **Short-term Memory**：對話歷史，以 message nodes + temporal metadata 存儲
- **Reasoning Memory**：決策軌跡，記錄 tool usage 與 provenance
- **Long-term Memory**：實體知識圖譜，以 nodes（entities）+ edges（relationships）構成

特點：
- Neo4j 原生支援 vector index + property graph（不需額外向量 DB）
- Cypher 查詢語言支援複雜圖遍歷
- 已整合 LangChain, OpenAI Agents, CrewAI, Pydantic AI

#### b) GraphRAG（文件級圖結構檢索）

| 系統 | 索引成本 (500頁) | 索引時間 | 優勢 | GitHub Stars |
|------|-----------------|---------|------|-------------|
| Microsoft GraphRAG | $50-200 | ~45 min | 全局分析型查詢（+26% 完整性, +57% 多樣性） | ~14K |
| LightRAG | ~$0.50 | ~3 min | 成本敏感場景，簡化圖結構 | ~32K |

**Microsoft GraphRAG** 架構：
1. LLM 提取實體與關係
2. Leiden 演算法將相關實體分群為階層社群
3. 預生成多層社群摘要
4. 查詢路由：local → 實體鄰域；global → 社群摘要

#### c) Temporal Knowledge Graph

**代表**：Zep / Graphiti（[github.com/getzep/graphiti](https://github.com/getzep/graphiti)）

核心創新 — **雙時態模型 (Bi-temporal)**：
- 每個事實記錄 `t_valid`（何時為真）和 `t_invalid`（何時被取代）
- 事實被「失效」而非「刪除」→ 支援完整時間旅行查詢
- 三層架構：Episode Subgraph → Semantic Entity Subgraph → Community Subgraph

**Benchmark**: LongMemEval 63.8%，時間推理比 baseline 提升 18.5%

### 2.3 Vector vs. Graph 決策框架

| 場景 | 推薦方案 |
|------|---------|
| 簡單事實查找（語義匹配即可） | Vector-only |
| 多跳推理（A→B→C 關係鏈） | Graph |
| 時間推理（事實演變追蹤） | Temporal Graph |
| 全局分析（主題歸納、趨勢） | GraphRAG |
| 兼需語義搜尋與關係推理 | Hybrid（vector + graph）|

### 2.4 與本專案的關聯

本專案目前的記憶模型是 **flat records + vector + BM25**，缺乏：
- 實體間關係的顯式建模（偏好之間的因果關係、決策依賴鏈）
- 事實時效性管理（哪些事實已過期、被新事實取代）
- 多跳檢索能力（「哪個專案的哪個決策影響了這次的偏好」）

**潛在整合路徑**：
- 在 LanceDB 之上建立輕量級 entity-relationship 索引
- 為 memory records 增加 relationship edges metadata
- 參考 Graphiti 的 bi-temporal 模式改進現有 freshness/decay 機制

---

## 3. 層級式記憶 (Tiered Memory)

### 3.1 四層記憶架構

業界 2026 年的標準模式：

| 層級 | 類比 | 容量 | 延遲 | 生命週期 | 內容 |
|------|------|------|------|---------|------|
| Working Memory | CPU Cache | 128K-2M tokens | 0ms | 單次請求 | 當前對話、system prompt |
| Short-term / Episodic | RAM | ~1000 筆互動 | <100ms | 數天 | 近期對話、活躍實體 |
| Long-term / Semantic | SSD | 無限 | 100-500ms | 數月-年 | 事實、偏好、學習知識 |
| Archival | Cold Storage | 無限（壓縮）| 秒級 | 永久 | 歷史記錄、舊 session |

### 3.2 代表專案

#### Letta (MemGPT)

OS-style 記憶管理：
- **Core Memory**（RAM）：永遠在 context window 內
- **Recall Memory**（Disk Cache）：可搜尋的對話歷史
- **Archival Memory**（Tape）：長期存儲，agent 主動查詢

關鍵創新：**Agent 主動管理自己的記憶** — 決定什麼留在 context、什麼歸檔。

#### MemoryOS

基於「熱度」的層級遷移：
```
heat = recency × frequency × importance
```
- 熱度高 → 升級到更快層級
- 熱度低 → 降級到更慢層級
- 搭配 Ebbinghaus 遺忘曲線模型

#### HiMem（階層式長期記憶）

arXiv: [2601.06377](https://arxiv.org/abs/2601.06377)

雙層記憶 + 自我演化：
- **Episode Memory**（細粒度）：雙通道事件分割（主題感知 + 事件驚奇度）
- **Note Memory**（抽象知識）：事實 / 偏好 / 用戶特徵
- **記憶自我演化**：當 Note 不足以回答 → 回退到 Episode → 提取新知識 → 分類更新（擴展 / 修正 / 保持不變）

**Benchmark**: LoCoMo Overall 80.71%（最佳 baseline 為 69.03）

### 3.3 與本專案的關聯

本專案已有層級基礎：
- `project` / `global` scope 分離
- episodic task records vs. semantic memories
- effectiveness events 有 TTL/archival

可改進方向：
- 記憶壓縮/摘要：長期未使用的記憶自動摘要壓縮
- 熱度遷移：參考 MemoryOS 的 heat-based 升降級機制
- 自我演化：參考 HiMem 的記憶自動修正模式

---

## 4. 前沿混合架構

### 4.1 MAGMA（多圖代理記憶）

arXiv: [2601.03236](https://arxiv.org/abs/2601.03236)

將記憶解耦為四種正交圖：

| 圖類型 | 邊定義 | 回答問題 |
|--------|--------|---------|
| Temporal Graph | 時間順序 | 「X 何時發生？」 |
| Causal Graph | 邏輯蘊含 | 「X 為何發生？」 |
| Semantic Graph | 餘弦相似度 | 「什麼與 X 相似？」 |
| Entity Graph | 實體連結 | 「誰參與了？」 |

關鍵創新：根據查詢意圖動態加權不同圖的邊。

**Benchmark**: Overall 0.700 vs. 最佳 baseline 0.580

### 4.2 Kumiho（形式化認知記憶）

arXiv: [2603.17244](https://arxiv.org/abs/2603.17244)

三大架構創新：
1. **AGM 信念修正語義**：嚴格遵循形式邏輯公理進行記憶更新
2. **前瞻性索引 (Prospective Indexing)**：寫入時 LLM 產生假設未來情境，橋接 cue-trigger 語義鴻溝
3. **Item ↔ Revision 模型**：不可變修訂版本 + 可變標籤指標

**Benchmark**: LoCoMo-Plus 93.3% vs Gemini 2.5 Pro 45.7%

### 4.3 HyMem（動態雙層檢索）

arXiv: [2602.13933](https://arxiv.org/abs/2602.13933)

- Summary-Level（永遠啟用）+ Raw-Level（僅複雜查詢啟用）
- LLM 評估查詢複雜度，決定是否啟用第二層
- 達成 **92.6% 計算成本降低**，性能持平 full-context

---

## 5. Memory-Augmented Transformers

在模型架構層面直接解決記憶問題（非外部存儲）。

### 5.1 Infini-attention（Google, 2024）

arXiv: [2404.07143](https://arxiv.org/abs/2404.07143)

- 標準注意力層 + 壓縮長期 linear attention
- 達成 1M token passkey retrieval，O(1) 記憶複雜度
- 核心洞察：無限上下文不需要無限記憶

### 5.2 Titans（Google Research, 2025）

- 在推理時學習記憶（test-time memorization）
- 結合注意力與可學習記憶模組

### 5.3 M+（IBM/MIT, ICML 2025）

- 潛空間記憶表示 (latent-space memory)
- 可與凍結 LLM 配合，無需 fine-tuning

### 5.4 與本專案的關聯

**低關聯性**。此類方案需要修改模型架構本身，非 plugin 層面可實現。但其思想（壓縮記憶、動態記憶管理）可借鑑到 plugin 層的記憶壓縮策略。

---

## 6. 參數化記憶 (Parametric Memory)

### 6.1 LoRA as Knowledge Memory

arXiv: [2603.01097](https://arxiv.org/abs/2603.01097)

將 LoRA adapter 視為壓縮的事實記憶：
- 推理時零額外延遲
- 知識深度整合到模型

**關鍵發現**（MIT CSAIL）：LoRA 與 Full fine-tuning 產生**質性不同**的知識表示。

| 優勢 | 劣勢 |
|------|------|
| 推理時零延遲 | 訓練成本高 |
| 深度整合 | 難以選擇性遺忘 |
| 無需外部檢索 | 更新需重新訓練 |

### 6.2 與本專案的關聯

**低關聯性**。非本專案責任範圍（模型訓練屬上游）。但「知識可能互相矛盾」的發現值得參考——本專案的 conflict detection 機制需要持續強化。

---

## 7. 反思型記憶 (Reflective Memory)

### 7.1 Experiential Reflective Learning（ICLR 2026 Workshop）

arXiv: [2603.24639](https://arxiv.org/abs/2603.24639)

Agent 從自身經驗中學習：
1. **Experience Encoding**：記錄互動
2. **Reflection Generation**：LLM 分析失敗原因
3. **Memory Update**：將教訓鞏固為可操作知識

### 7.2 MAR: Multi-Agent Reflexion（2025）

arXiv: [2512.20845](https://arxiv.org/abs/2512.20845)

- 多個 agent 從不同角度反思同一問題
- 交叉反思識別盲點

### 7.3 與本專案的關聯

**中等關聯性**。本專案已有 episodic learning（BL-014–018）和 retry/recovery（BL-019–022）。反思型記憶可強化：
- 從失敗 episode 自動提取「教訓」
- 將 retry 成功模式鞏固為 reusable playbook
- 跨任務的模式泛化（不只是「相似任務回憶」，而是「為什麼這次成功了」）

---

## 8. 混合式生產平台比較

### 8.1 主要平台

| 平台 | 架構 | Benchmark | 延遲 (p50) | 特色 | GitHub Stars |
|------|------|-----------|-----------|------|-------------|
| **Mem0** | Vector + Graph | LOCOMO 66.9% | 0.20s | 90% token 節省，開源 | ~48K |
| **Hindsight** | 4 策略並行 + cross-encoder rerank | LongMemEval 91.4% | — | 最高 retrieval 準確率 | ~4K |
| **Zep/Graphiti** | Temporal KG | LongMemEval 63.8% | — | 最強時間推理 | ~24K |
| **Letta** | OS-style tiered | — | — | Agent 自主管理記憶 | ~21K |
| **Cognee** | KG + Vector | — | — | 認知記憶結構 | ~12K |
| **LangMem** | Flat KV + vector | — | — | LangGraph 整合 | ~1.3K |

### 8.2 Hindsight 的四策略檢索

特別值得參考的架構：
1. **Semantic search**（embeddings）
2. **BM25 keyword matching**
3. **Entity graph traversal**
4. **Temporal filtering**

結果以 cross-encoder reranking 融合。本專案目前已有策略 1 和 2，策略 3 和 4 是潛在的增強方向。

### 8.3 Mem0 架構

提取管線：
1. LLM 從最新交換 + rolling summary + 近期訊息中提取候選記憶
2. 相似度比對決定操作：ADD / UPDATE / DELETE / NOOP
3. Mem0g（圖版本）：Entity Extractor + Relations Generator + Conflict Detector

**ECAI Accepted 論文** (arXiv: [2504.19413](https://arxiv.org/abs/2504.19413)):
- 比 OpenAI Memory +26% accuracy
- 比 standard RAG -91% latency
- -90% token 消耗

---

## 9. Benchmark 與評估

### 9.1 主要 Benchmark

| Benchmark | 聚焦 | 說明 |
|-----------|------|------|
| **LoCoMo** | 長期對話記憶 | 事實保留、一致性；生產比較標準 |
| **LongMemEval** | 互動式記憶 | 多輪準確率；聊天助手評估 |
| **BEAM** | 超百萬 token | 極端長度記憶 |
| **MemoryBench** | 記憶與持續學習 | 多面向評估 |
| **MemoryAgentBench** | 增量多輪 | 任務完成率 |
| **HaluMem** | 記憶幻覺 | 虛假記憶檢測 |

### 9.2 各方案 Benchmark 比較

| 方案 | LoCoMo | LongMemEval | 特點 |
|------|--------|-------------|------|
| Kumiho | Token F1 0.565 | — | 最高 adversarial refusal (97.5%) |
| HiMem | Overall 80.71 | — | 多跳 + 時間推理最均衡 |
| Hindsight | — | 91.4% | 最高 retrieval accuracy |
| Zep/Graphiti | — | 63.8% | 最強 temporal reasoning |
| Mem0 | 66.9% | — | 最低延遲、最少 token |
| MAGMA | — | — | Overall 0.700（自有 benchmark）|

---

## 10. 對本專案的策略建議

### 10.1 現有優勢

本專案已具備：
- Vector + BM25 混合檢索（Hindsight 4 策略中的 2 項）
- Episodic task memory（記錄任務經驗）
- Failure taxonomy + retry evidence（試錯學習基礎）
- Citation validation + freshness decay（可信度治理）
- Feedback-driven ranking（回饋驅動排序）

### 10.2 高價值改進方向

按價值/可行性排序：

#### 優先級 1：多策略檢索增強

在現有 vector + BM25 基礎上增加：
- **Entity-based retrieval**：為記憶建立實體索引，支援「關於 X 的所有記憶」查詢
- **Temporal filtering**：利用現有 freshness metadata，支援「最近 N 天」「某時間段內」的過濾

**可行性**：高。不需要新的儲存引擎，在 LanceDB 現有能力上擴充。

#### 優先級 2：記憶壓縮與摘要

- 長期未使用的記憶自動產生摘要版本
- 相似記憶群組合併為更高層次的「知識筆記」
- 參考 HiMem 的 Episode → Note 兩層模式

**可行性**：中。需要 LLM 呼叫做摘要，有成本考量。

#### 優先級 3：輕量級關係圖

- 在 LanceDB records 之上建立 entity-relationship metadata
- 記錄記憶之間的因果/依賴/時序關係
- 支援簡單的圖遍歷查詢（不需要完整 graph DB）

**可行性**：中。需要 schema 擴充和新的檢索路徑。

#### 優先級 4：Temporal Knowledge Tracking

- 參考 Graphiti 的 bi-temporal 模型
- 為事實記憶增加 `validFrom` / `supersededAt` 時間戳
- 事實被新事實取代時不刪除而是標記失效

**可行性**：中。需要修改現有 freshness/decay 機制。

#### 研究候選（不列近期）

- Graph DB 整合（Neo4j / Memgraph）：成本與部署複雜度過高，不符 local-first 定位
- Memory-augmented transformer 整合：非 plugin 層責任
- Parametric memory（LoRA）：非本專案責任

### 10.3 儲存引擎策略維持不變

上述建議均 **不改變** roadmap 中「以 LanceDB 為唯一主引擎」的策略。改進方向是在 LanceDB 之上增加索引結構與檢索策略，而非引入新的儲存後端。

只有當以下情況成立時才重新評估：
- 記憶關係推理需求增長到輕量級 metadata 無法支撐
- 產品方向轉向需要 full graph database 能力
- 有測量證據顯示 LanceDB 上的 entity index 效能不足

---

## 11. 關鍵參考資源

### 學術論文

| 論文 | arXiv | 年份 | 關聯性 |
|------|-------|------|--------|
| Graph-based Agent Memory: Taxonomy, Techniques, and Applications | [2602.05665](https://arxiv.org/abs/2602.05665) | 2026 | 最完整的圖記憶分類 |
| MAGMA: Multi-Graph based Agentic Memory | [2601.03236](https://arxiv.org/abs/2601.03236) | 2026 | 多圖混合架構 |
| Kumiho: Graph-Native Cognitive Memory | [2603.17244](https://arxiv.org/abs/2603.17244) | 2026 | 形式化記憶修正 |
| HiMem: Hierarchical Long-Term Memory | [2601.06377](https://arxiv.org/abs/2601.06377) | 2026 | 層級記憶 + 自我演化 |
| HyMem: Dynamic Two-Tier Retrieval | [2602.13933](https://arxiv.org/abs/2602.13933) | 2026 | 動態檢索分層 |
| Infini-attention | [2404.07143](https://arxiv.org/abs/2404.07143) | 2024 | 壓縮記憶注意力 |
| Mem0: Scalable Long-Term Memory | [2504.19413](https://arxiv.org/abs/2504.19413) | 2025 | 生產級記憶系統 |
| Graphiti: Temporal Knowledge Graphs | [2501.13956](https://arxiv.org/abs/2501.13956) | 2025 | 時態知識圖 |
| Memory in the LLM Era | [2604.01707](https://arxiv.org/abs/2604.01707) | 2026 | 統一記憶框架 |
| Experiential Reflective Learning | [2603.24639](https://arxiv.org/abs/2603.24639) | 2026 | 反思型記憶 |
| LoRA as Knowledge Memory | [2603.01097](https://arxiv.org/abs/2603.01097) | 2025 | 參數化記憶 |

### 開源專案

| 專案 | GitHub | 主要用途 | Stars |
|------|--------|---------|-------|
| [neo4j-agent-memory](https://github.com/neo4j-labs/agent-memory) | Neo4j Labs | 完整三類型記憶 | — |
| [LightRAG](https://github.com/hkuds/lightrag) | HKUDS | 簡化版 GraphRAG | ~32K |
| [Graphiti](https://github.com/getzep/graphiti) | Zep | 時態知識圖 | — |
| [Mem0](https://github.com/mem0ai/mem0) | Mem0 | 通用記憶層 | ~48K |
| [Hindsight](https://github.com/vectorize-io/hindsight) | Vectorize | 多策略檢索 | ~4K |
| [Letta](https://github.com/letta-ai/letta) | Letta AI | OS-style 記憶 | ~21K |

### Awesome 資源

- [TeleAI-UAGI/Awesome-Agent-Memory](https://github.com/TeleAI-UAGI/Awesome-Agent-Memory)（330 stars）
- [IAAR-Shanghai/Awesome-AI-Memory](https://github.com/IAAR-Shanghai/Awesome-AI-Memory)

### 產業分析

- [Best AI Agent Memory Systems in 2026: 8 Frameworks Compared](https://vectorize.io/articles/best-ai-agent-memory-systems)（Vectorize.io, 2026-03）
- [Graph RAG in 2026: What Actually Works in Production](https://www.paperclipped.de/en/blog/graph-rag-production/)（Paperclipped, 2026-03）
- [Vector Database vs. Knowledge Graph for AI Agent Memory](https://atlan.com/know/vector-database-vs-knowledge-graph-agent-memory/)（Atlan, 2026-04）

---

## 12. 2026 年技術趨勢共識

> 「記憶應該是顯式且可管理的 — 而非從更大 context window 湧現的副產品。」

四個核心趨勢：

1. **選擇性檢索 > 全量上下文** — 顯式提取、存儲記憶，而非塞進 context window
2. **圖結構記憶興起** — 關係推理 + 時間推理是 vector-only 無法解決的
3. **層級式組織** — Working / Episodic / Semantic 分層已成標準模式
4. **Agent 自主記憶管理** — 系統自己決定記什麼、怎麼更新、何時遺忘
