# OpenCode plugin 與 skill+markdown 路線研究

> 目的：評估本專案用 **OpenCode plugin runtime** 實作 `docs/roadmap.md` 目標的合理性，並與 **skill + markdown files** 路線比較其優缺點、適用情境與後續建議。

---

## 結論先行

本專案的 roadmap **核心上應繼續以 plugin runtime 為主**，不適合改成單純 skill+markdown 路線。

原因很直接：本專案的核心價值不是只有「教 AI 怎麼做」，而是要做到：

1. 長期持久化記憶
2. 在 OpenCode runtime 事件中自動捕捉與回寫學習資產
3. 在 system prompt 注入記憶、偏好、相似任務經驗
4. 透過工具與資料模型暴露 citation、episodic learning、retry/recovery evidence

這些都需要 **plugin hooks、tool registration、LanceDB 存取、session context、即時運算**；skill+markdown 本身做不到。

但這不代表 skill+markdown 不重要。

本專案較合理的做法是：

- **Plugin**：負責 runtime learning、持久化、hooks、tools、證據資料
- **Skill + Markdown**：負責 workflow、呈現層、操作指引、規範、方法論
- **Docs / Test infra**：負責 KPI 定義、eval harness、A/B framework、治理流程

換句話說，**plugin 是 learning engine，skills/docs 是 operating layer**。

---

## 本專案目前已具備的 plugin 基礎

依據 `src/index.ts`、`src/store.ts`、`src/types.ts` 與既有 OpenSpec/backlog：

### 1. Runtime hooks 已經是核心能力

`src/index.ts` 目前已在 plugin 中實作至少以下 runtime surface：

- `config`
- `event`
- `experimental.text.complete`
- `experimental.chat.system.transform`

其中：

- `event` 負責 session lifecycle、自動 capture、dedup、session idle 後處理
- `experimental.chat.system.transform` 負責在推理前注入 recall、preference、similar task context

這代表本專案已不是單純的文件/技能型輔助，而是**直接參與 OpenCode 執行期決策**。

### 2. Plugin tools 已形成完整 runtime API 面

目前已暴露的工具不只 early-stage 的 `memory_search/delete/clear/stats`，還包括：

- explicit memory：`memory_remember`, `memory_forget`, `memory_what_did_you_learn`, `memory_why`
- feedback/effectiveness：`memory_feedback_*`, `memory_effectiveness`
- citation：`memory_citation`, `memory_validate_citation`
- episodic：`task_episode_create`, `task_episode_query`, `similar_task_recall`
- retry/recovery：`retry_budget_suggest`, `recovery_strategy_suggest`

這些功能天然屬於 plugin tool surface，不是 markdown file 能替代的能力。

### 3. Data model 已深度綁定 plugin runtime

`src/store.ts` 與 `src/types.ts` 已承擔：

- memory records
- effectiveness events
- episodic task records
- recall explanation factors
- retry / recovery evidence
- citation metadata

Roadmap 中大部分已完成的能力，其實都已落在這個 runtime/data layer。

---

## 為什麼 plugin 路線合理

### Plugin 適合本專案的原因

#### 1. 需要事件驅動

Roadmap 的核心不是靜態知識庫，而是：

- 自動 capture
- recall injection
- episodic learning
- retry/recovery evidence
- success pattern reuse

這些都依賴 OpenCode lifecycle 與推理期 hooks，屬於 plugin runtime 的天然責任。

#### 2. 需要持久化與查詢

本專案以 LanceDB 承接 long-term memory。只要需求涉及：

- 向量檢索
- BM25 混合查詢
- 記憶權重/新鮮度/作用域
- citation 驗證
- task episode 查詢

就必須透過 plugin/runtime code 操作資料層。

#### 3. 需要即時影響 agent 行為

Roadmap 的北極星目標之一是「越做越會成功」，這不只是事後摘要，而是要在下一輪任務前：

- 注入偏好
- 注入相似任務經驗
- 根據歷史結果調整建議

這種能力只能由 plugin 在 runtime 中直接介入。

---

## skill + markdown files 的優勢與限制

### 它們擅長的事

skill+markdown 在本專案很適合以下場景：

1. **工作流引導**
   - 例如 `.opencode/skills/backlog-to-openspec/`
   - 例如 `.opencode/skills/release-workflow/`

2. **規範與操作說明**
   - `docs/DEVELOPMENT_WORKFLOW.md`
   - OpenSpec artifacts

3. **呈現層與輸出模板**
   - 例如「本週學到什麼」摘要模板
   - KPI 報告解讀流程
   - release / proposal / verification workflows

4. **方法論與治理**
   - eval methodology
   - A/B testing 操作方式
   - review checklist

### 它們不擅長的事

skill+markdown 不適合承擔本專案核心 learning engine，因為它們無法單獨完成：

- session/event-driven capture
- system prompt injection
- LanceDB 讀寫與索引
- 即時計分與查詢
- runtime tool registration
- citation validation pipeline
- episodic learning persistence

因此若把 roadmap 主軸改成 skill+markdown，會造成：

- runtime learning 能力退化
- 核心功能變成只能靠 agent「照文件做」
- 長期記憶與學習閉環失去可靠 entrypoint

---

## 比較表：Plugin vs Skill + Markdown

| 面向 | Plugin runtime | Skill + Markdown |
|---|---|---|
| Runtime hooks | ✅ 強 | ❌ 無 |
| 持久化資料 | ✅ 強 | ❌ 只能間接使用既有 tool |
| 即時影響推理 | ✅ 強 | ⚠️ 只能透過 prompt workflow |
| 可觀測性/證據 | ✅ 強 | ⚠️ 可描述，但不生成 runtime evidence |
| 工作流引導 | ⚠️ 可以，但不是最適表面 | ✅ 強 |
| 呈現/模板 | ⚠️ 不應塞太多展示邏輯 | ✅ 強 |
| 方法論/KPI 定義 | ❌ 不適合作為主要承載 | ✅ 強 |
| Eval / A/B | ❌ 不應放在 plugin 核心 | ✅ 搭配 docs/test infra 較合適 |

---

## 依 roadmap/backlog 分類後的建議

### 應維持在 plugin 的能力

以下類型仍應視為 plugin 主責：

- memory substrate 與 retrieval
- preference aggregation / injection
- explicit memory tools
- citations / freshness / conflict detection
- episodic task memory
- retry/recovery evidence model
- similar task recall

這些需求的共同特徵是：**需要 runtime state、資料模型與可操作的 tool surface**。

### 應移出 plugin 核心、改由其他 surface 承接的能力

#### BL-030 — Learning dashboard summary
- 建議分類：**Plugin（summary tool）**
- 原因：在單一 npm 發布策略下，週摘要應由 plugin tool 直接輸出，避免額外 skill 分發管線。

#### BL-031 — Learning KPI pipeline
- 建議分類：**Docs + optional plugin tool**
- 原因：KPI 定義與解讀流程應文件化；若要做查詢聚合，可再加一個輕量 tool，而不是把整個 KPI framework 塞進 plugin 核心。

#### BL-032 — Eval harness for learning quality
- 建議分類：**Test infrastructure**
- 原因：固定資料集、回歸驗證、品質基準，應該放在 `test/` 與驗證腳本，而不是 plugin runtime。

#### BL-033 — A/B testing framework
- 建議分類：**Test infrastructure + docs**
- 原因：這是實驗設計與驗證方法論，不是 runtime feature。

---

## 對 roadmap 的具體建議

### 1. 把 roadmap 從「未來幻想清單」改成「已出貨基礎 + 剩餘缺口」

目前 `docs/roadmap.md` 仍有多處把已完成能力寫成缺口，例如：

- preference aggregation
- explicit memory UX
- task trajectory/outcome model
- retry/recovery evidence
- citation/freshness/conflict

建議改為：

- 先承認 plugin foundation 已出貨
- 再列真正剩餘的 gap

### 2. 明確寫出「實作表面判斷原則」

建議在 roadmap 加入以下原則：

- **Plugin**：需要 hooks、state、DB、tool、runtime evidence 的功能
- **Skill**：需要多步驟工作流、格式化呈現、操作引導的功能
- **Docs**：需要定義、治理、方法論的內容
- **Test infra**：需要 dataset、regression、A/B、品質驗證的內容

### 3. 在產品化階段加上 Surface 標註

至少應在以下項目旁標註：

- Learning dashboard / weekly summary → `Surface: Plugin`
- KPI pipeline → `Surface: Docs + optional plugin tool`
- Eval harness → `Surface: Test-infra`
- A/B framework → `Surface: Test-infra + docs`

---

## 對 backlog 的具體建議

建議維持現有表格形狀，不另外新增欄位，只在 `Notes` 中補上 surface 標註：

- BL-021 → `Surface: Plugin（blocked by upstream events）`
- BL-030 → `Surface: Plugin`
- BL-031 → `Surface: Docs + optional plugin tool`
- BL-032 → `Surface: Test-infra`
- BL-033 → `Surface: Test-infra + docs`

這樣改動最小，但已足以讓 backlog 與 roadmap 對齊。

---

## 最終建議

### 建議採用：**Plugin-first, skill-assisted, docs/test-governed**

最適合本專案的策略不是二選一，而是：

1. **Plugin-first**
   - 繼續把 learning engine 放在 plugin runtime

2. **Skill-assisted（developer workflow only）**
   - 保留 repo 內 skills 給維護者統一流程（如 backlog-to-openspec、release-workflow），不作為使用者交付 surface

3. **Docs/test-governed**
   - 把 KPI、eval harness、A/B framework 放到 docs 與 test infra

這條路線最符合目前 repo 的事實，也最不容易把 runtime 核心搞得過重。

---

## 直接行動項

1. 新增本研究文件到 `docs/`
2. 更新 `docs/roadmap.md`，把已出貨基礎與剩餘 gap 分開
3. 更新 `docs/backlog.md`，為 BL-021/030/031/032/033 補上 surface 標註
4. 若要落地 BL-030，優先以 plugin summary tool 實作，維持單一 npm 交付路徑
