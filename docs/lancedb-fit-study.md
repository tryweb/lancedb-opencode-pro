# LanceDB 適配性研究

> 目的：評估 LanceDB 對本專案目標的適配性，並與其他熱門輕量型向量資料庫比較，確認是否值得調整 roadmap / backlog。

---

## 結論先行

本專案**應繼續以 LanceDB 作為主要儲存引擎**。

原因不是因為它「最流行」，而是因為它最符合本專案目前的核心約束：

1. **local-first / embedded**：不想額外維運獨立服務
2. **npm/plugin distribution**：希望以 Node.js 套件形式直接安裝使用
3. **同時需要向量、文字、metadata、schema 演進**
4. **要能承接 memories / citations / episodic tasks / effectiveness events**

以目前 repo 的程式設計來看，LanceDB 不只是「其中一個可替換 DB」，而是已經深度嵌在 `src/store.ts` 的資料模型、初始化流程、索引管理、schema patch 與 local persistence 路徑中。

但這不代表完全沒有補強空間。

本研究建議：

- **保留 LanceDB 作為主引擎**
- **不把遷移其他向量 DB 當成近期 roadmap 項目**
- **新增兩個更有價值的 backlog 項目**：
  - 大 scope 的 ANN fast-path
  - `effectiveness_events` 的 TTL / archival 機制

---

## 本專案目前如何使用 LanceDB

依據 `src/store.ts`、`src/types.ts`、`test/setup.ts`、`docs/architecture.md` 與 `package.json`：

### 1. LanceDB 已是核心 storage contract

目前專案至少依賴 LanceDB 承接這些持久化資料：

- `memories`
- `effectiveness_events`
- `episodic_tasks`

而且不是單純 key-value 儲存，而是結合：

- 向量欄位
- 文本欄位
- metadata JSON
- citations
- episodic task state
- retrieval 相關分數與使用統計

### 2. 查詢邏輯是「LanceDB + 自訂 rerank」混合架構

本 repo 並沒有把搜尋完全外包給 LanceDB。

現況更接近：

- LanceDB 提供本地持久化、欄位結構、索引能力
- 專案端在 JS 內實作 hybrid retrieval、RRF、recency、importance、global discount 等 rerank 邏輯

這種做法的意義是：

- 保留 LanceDB 的 embedded 優勢
- 同時保留本專案對 scoring / ranking 的主控權

### 3. schema evolution 已是現行策略的一部分

`docs/lancedb-upgrades.md` 與 `src/store.ts` 顯示本專案已經依賴：

- `openTable()` / `createTable()`
- `table.add()` / `table.delete()`
- `table.createIndex()`
- `table.schema()`
- `table.addColumns()`

這代表 LanceDB 不只是資料存放層，也已經是**資料演進機制的一部分**。

---

## LanceDB 的特點，如何對應本專案目標

### 1. Embedded / local-first

LanceDB 官方定位強調可本地運行，這對本專案非常重要。

本專案的 memory plugin 主要價值之一，就是：

- 安裝 plugin 後即可在本地保存記憶
- 不依賴外部 DB service
- 不增加額外 Docker / daemon 維運成本

這一點比功能清單更重要，因為它直接決定了本專案的 adoption friction。

### 2. 原生向量搜尋 + FTS / Hybrid search 能力

LanceDB 官方文件已提供：

- vector search
- full-text search（BM25）
- filtering
- hybrid search

對本專案來說，這些能力不是「可有可無」，而是天然對應到：

- memory recall
- citation / metadata filtering
- keyword + semantic mixed retrieval
- future large-scope optimization

即使目前 repo 有相當多 ranking 邏輯是自行實作，LanceDB 仍提供了足夠好的底座。

### 3. Schema evolution 對 roadmap 很有價值

本專案的 memory schema 並非穩定不變，而是持續擴充：

- citation fields
- user/team metadata
- episodic task fields
- recovery / effectiveness evidence

LanceDB 具備 schema evolution 路徑，這讓本專案在維持 local-first 的同時，仍能安全地演進資料模型。

### 4. npm / Node.js 生態相容性

本專案是 Node.js / TypeScript plugin。這使得一些原本在研究時看似很強的替代方案，到了實務面會遇到包裝與維運成本問題。

LanceDB 在這裡的優勢不是最強搜尋，而是：

- **夠強**
- **可嵌入**
- **可分發**
- **已整合**

---

## LanceDB 在本專案的限制與風險

### 1. 當資料量成長時，現有 JS rerank 可能先成瓶頸

雖然 LanceDB 本身支援向量搜尋與 hybrid search，但目前 repo 的實際做法仍相當依賴 JS 端的再排序與分數融合。

這在小到中型資料量時很合理；但若單一 scope 持續放大，就會有兩個風險：

- 查詢延遲變高
- memory usage 增加

因此比較值得做的不是「換 DB」，而是加一個 **ANN fast-path**。

### 2. `effectiveness_events` 長期累積後需要治理

`effectiveness_events` 本質是 append-heavy 的資料。

若沒有 TTL / archival：

- 長期會增加本地儲存體積
- 也會提高讀取與分析成本
- 使後續 KPI / dashboard 類功能成本升高

這是 LanceDB 不適合，而是**任何 local-first event store 都需要面對的治理問題**。

### 3. 目前不值得做 storage migration

從 repo evidence 看，現在要切換存儲引擎會同時碰到：

- 資料模型重寫
- 初始化與 migration 路徑重寫
- test suite 重寫
- retrieval 行為重驗證

成本遠高於收益。

---

## 與其他熱門輕量向量資料庫比較

以下比較聚焦「本專案是否適合」，不是一般性的產品排名。

| 方案 | 對本專案的優點 | 對本專案的限制 | 綜合判斷 |
|---|---|---|---|
| **LanceDB** | embedded、local-first、Node/npm 友好、向量+FTS+filtering+schema evolution、已深度整合 | 大 scope 下需要補強 fast-path；event retention 需治理 | **目前最佳選擇** |
| **Chroma** | 開發者熟悉度高、向量檢索體驗成熟 | 對本專案的 local embedded npm/plugin 路徑不一定比 LanceDB 更簡單；切換成本高 | 不值得近期遷移 |
| **Qdrant（單機）** | filtering / hybrid / operational features 強 | 更偏 service/daemon 模式，與本專案低運維目標不完全一致 | 適合未來 serverized 模式，不適合現在 |
| **sqlite-vec** | 輕量、SQLite 生態熟悉 | 能力較底層，混合檢索、schema 演進、現有 feature fit 較弱 | 適合極簡原型，不適合目前 feature set |
| **FAISS** | ANN 能力強 | 不是完整 embedded app DB；metadata/filtering/schema/persistence 需自行補齊 | 可當加速元件，不適合直接替代主 DB |
| **HNSWLIB** | ANN 輕量高效 | 與 FAISS 類似，偏索引庫不是完整應用資料庫 | 可當加速元件，不適合直接替代主 DB |

### 比較結論

若本專案今天是：

- 純向量 ANN benchmark 專案 → 可考慮 FAISS / HNSWLIB
- 需要長期 server-based retrieval service → 可考慮 Qdrant
- 極簡 SQLite 生態原型 → 可考慮 sqlite-vec

但本專案其實是：

- local-first
- embedded
- OpenCode plugin
- 有 schema 演進
- 有多表結構
- 有 hybrid retrieval 與 evidence model

所以 LanceDB 明顯更合適。

---

## 推薦策略

### 1. 保持 LanceDB 為預設主引擎

這應被視為目前的正式架構決策。

### 2. 不把「切換其他向量 DB」列為近期 roadmap 項目

目前沒有足夠 evidence 顯示遷移會帶來淨收益。

### 3. 把投資放在兩個更值得做的方向

#### A. ANN fast-path for large scopes

目標：

- 在 large scope / high-cardinality retrieval 時，利用 LanceDB 原生向量能力作為前置篩選或 fast-path
- 保留目前 JS rerank / recall quality 邏輯

這比直接換 DB 更符合成本效益。

#### B. Event table TTL / archival

目標：

- 為 `effectiveness_events` 設計保留政策
- 讓 dashboard / KPI / retrospection 功能能長期運行而不把 local store 越養越重

這是本專案中長期更真實的風險。

---

## 重新評估 LanceDB 的觸發條件

只有在下列情況成立時，才值得重新評估是否更換主引擎：

1. 單一 scope 的記憶 / event 規模明顯超出目前 rerank 路徑可接受範圍
2. plugin distribution / native binding 造成明顯跨平台維運問題
3. 未來產品方向轉向 serverized / multi-tenant / remote-first 架構
4. 有測量證據顯示其他方案能在不增加太多運維成本下顯著改善 latency / complexity

在這些條件未出現前，最理性的策略仍然是：**留在 LanceDB，優化現有路徑。**

---

## 建議寫回 roadmap / backlog 的內容

### 值得新增到 roadmap 的方向

- Storage engine strategy
- Re-evaluation triggers
- ANN fast-path（large scopes）
- Events TTL / archival

### 值得新增到 backlog 的項目

- `BL-036` LanceDB ANN fast-path for large scopes
- `BL-037` Event table TTL / archival

---

## 參考資料

### LanceDB 官方 / 官方維護內容

- LanceDB 官方文件：<https://docs.lancedb.com/>
- LanceDB GitHub：<https://github.com/lancedb/lancedb>
- Full-text search：<https://docs.lancedb.com/search/full-text-search>
- Hybrid search：<https://docs.lancedb.com/search/hybrid-search>
- Lance format / Lance docs：<https://docs.lancedb.com/lance>
- Schema evolution 相關 PR：<https://github.com/lancedb/lancedb/pull/1851>

### 其他候選方案官方資料

- Chroma：<https://docs.trychroma.com/>
- Qdrant：<https://qdrant.tech/documentation/>
- sqlite-vec：<https://github.com/asg017/sqlite-vec>
- FAISS：<https://github.com/facebookresearch/faiss>
- HNSWLIB：<https://github.com/nmslib/hnswlib>
