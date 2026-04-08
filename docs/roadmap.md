# OpenCode 持續學習 Roadmap

> 目標：讓使用者明顯有感 OpenCode 會隨著專案持續開發而越用越懂人、越做越會成功。

## 北極星目標

OpenCode 要從「有長期記憶的工具」進化成「會累積團隊工作經驗的開發代理系統」，具體要達成兩件事：

1. **與使用者互動學習**：記住並逐步內化個人/團隊偏好、術語、決策脈絡、工作習慣。
2. **從 AI 試錯成功經驗學習**：把成功的修復路徑、驗證方式、重試策略、失敗教訓轉成可重用經驗，讓後續任務成功率與速度持續上升。

---

## 目前已具備的基礎

根據 `docs/architecture.md`、`docs/operations.md`、`docs/release-readiness.md` 與程式碼現況，本專案已經有不錯的底座：

- **持久化記憶**：跨 session 保存 memory
- **自動捕捉**：從 assistant 完成內容中擷取 durable outcomes
- **混合檢索**：vector + BM25 + recency/importance weighting
- **回憶注入**：在 `experimental.chat.system.transform` 注入記憶
- **結構化回饋**：`memory_feedback_missing / wrong / useful`
- **效果指標**：`memory_effectiveness` 可看 capture/recall/feedback 指標
- **作用域隔離**：project/global scope
- **相似記憶處理**：duplicate flagging + consolidation

這代表專案已經有 **memory substrate**，但離「會學習的 agent」還差一層：**把回饋、結果、軌跡、偏好真正閉環回寫到決策與執行**。

---

## 實作表面判斷原則

為避免把不同性質的工作都塞進 plugin runtime，本 roadmap 採以下 surface 分工：

- **Plugin runtime**：需要 OpenCode hooks、LanceDB 讀寫、即時注入、tool registration、runtime evidence 的功能
- **Skill + markdown**：需要多步驟工作流、標準輸出模板、操作引導、週摘要/呈現層的功能
- **Docs / OpenSpec**：需要定義、治理、KPI 說明、能力邊界契約的內容
- **Test infrastructure**：需要固定 dataset、回歸驗證、A/B framework、品質量測的內容

原則上：

- 影響記憶捕捉、查詢、注入、citation、episodic learning 的能力 → 優先做成 plugin
- 影響使用者如何理解/觸發既有能力的流程與展示 → 優先做成 skill 或 docs
- 影響評估方法與驗證機制 → 優先做成 test infra + docs

---

## 目前剩餘關鍵缺口

### A. 使用者互動學習缺口

1. **多使用者 precedence 還沒有產品化**
   - `userId/teamId` 與 metadata 已可承載，但預設仍以單使用者 `project/global` 為主。
2. **偏好學習尚未全面 feedback-driven**
   - aggregation、衝突解決、分層注入已存在，但 feedback 尚未全面驅動 ranking / injection adaptation。
3. **使用者可感知的 dashboard / summary 還不足**
   - `/what-did-you-learn` 與 explain 類工具已存在，但尚未形成固定的週摘要與產品化展示層。

### B. AI 試錯學習缺口

1. **上游 retry/backoff 訊號尚未接入**
   - retry budget、failure taxonomy、strategy suggestion 已有基礎，但 `BL-021` 仍受限於上游事件來源。
2. **success pattern 的 reusable playbook 化仍偏弱**
   - episodic records 與 similar task recall 已存在，但尚未完全產品化成更強的跨任務 playbook surface。
3. **checkpoint / resume intelligence 不列近期主線**
   - 本專案優先維持「不重做執行引擎」原則；checkpoint/resume 目前屬較長期研究題，不是近期承諾項目。

### C. 產品化缺口

1. **缺少固定的 learning dashboard / weekly summary**
2. **缺少文件化的 KPI 定義與報表管線**
3. **缺少可重複執行的 eval harness 與 A/B framework**

### D. 工程可維護性與效能缺口

1. **runtime 與工具註冊耦合過高**
   - `src/index.ts` 同時承擔 hooks、injection、tool registry、部分業務邏輯；目前已達 26 個工具定義，變更範圍難以隔離。
2. **Store 單體責任過多**
   - `MemoryStore` 同時處理資料連線/schema、memory retrieval、episodic 管理、數學評分與 dedup 流程，增加測試與演進成本。
3. **部分流程在大資料量下缺乏擴充保護**
   - `consolidateDuplicates` 目前採雙迴圈 O(N²) 比對；`getCachedScopes` 會將多 scope 記錄全量併入記憶體。
4. **DB row 型別與降級路徑可觀測性不足**
   - `as unknown as EpisodicTaskRecord` 使用面積大；embedding fallback 雖能保持可用，但部分路徑缺少明確診斷訊號。  <!-- BL-046 已改善：read-path 全部改用 validateEpisodicRecord()，僅 write-path 保留 2 處 raw cast -->  <!-- embedding 可觀測性仍待補強（BL-047）-->

---

## 產品原則

1. **先可驗證，再自動化**：先讓記憶可檢查、可回報、可撤銷，再做更強的自主學習。
2. **先學偏好與成功模式，再學抽象策略**：避免太早做黑盒自我優化。
3. **記憶分層**：procedural / semantic / episodic 分離。
4. **學習必須可衰減、可回滾、可審核**：避免 stale memory 汙染。
5. **學習成果要對使用者可見**：不然使用者不會有「越用越強」的感受。

---

## 儲存引擎策略

目前以 **LanceDB** 作為本專案唯一的主要持久化引擎。

理由：

- 符合 local-first / embedded 的產品定位
- 與目前 Node.js / npm plugin distribution 路徑相容
- 已能承接 memories、citations、episodic tasks、effectiveness events 等多表需求
- 已驗證向量欄位、FTS、filtering、schema evolution 與本專案需求相容

現階段不把「遷移到其他向量資料庫」列為近期 roadmap 項目；更合理的投資方向是：

- 在 LanceDB 之上補強 large-scope retrieval 的 ANN fast-path
- 為 `effectiveness_events` 建立 TTL / archival 治理機制
- 在 LanceDB 之上補強多策略檢索（entity-based retrieval、temporal filtering）
- 探索輕量級 entity-relationship 索引（不引入額外 graph DB）

> 詳細技術方案研究見 `docs/long-term-memory-landscape.md`（2026-04-08）。

### 重新評估觸發條件

只有在以下情況成立時，才重新評估是否更換主引擎：

1. 單一 scope 的 memories / events 規模持續成長，現有 retrieval latency 明顯惡化
2. native binding / packaging 對 plugin distribution 造成明顯跨平台阻礙
3. 產品方向轉向 remote-first / serverized / multi-tenant 為主
4. 有測量證據顯示其他方案能在不提高太多維運成本下，顯著改善整體效能或複雜度
5. 記憶關係推理需求增長到 LanceDB metadata 索引無法支撐（需 full graph DB）

---

## 建議能力地圖

### Track 1 — User Learning（單使用者先落地，保留多使用者擴充）

> 設計原則：目前 OpenCode 主要是單使用者 CLI/TUI，Track 1 先以 `project/global` scope 完成可感知學習；
> `userId/teamId` 採 **條件啟用**，僅在共享記憶服務、團隊協作或企業整合場景啟用。

#### 1. Identity-Ready Profile Layer（預設不強制 user/team）
- 新增 `sourceSessionId`、`confidence`、`freshness`、`sourceType` metadata
- `userId`、`teamId` 先作為 **optional metadata**（非一級強制欄位）
- 單使用者預設 precedence：project > global
- 多使用者模式啟用時 precedence：user > team > project > global

#### 2. Preference Aggregation Engine
- 把 `memory_feedback_missing` 與 `preference` capture 聚合成顯式偏好
- 偏好項目要有：
  - statement
  - scope
  - confidence
  - lastConfirmedAt
  - contradictorySignals
- 支援偏好衝突解決（近期、明確度、直接回饋優先）

#### 3. Preference-Aware Injection
- 注入時分開輸出：
  - working preferences
  - project decisions
  - recent successful patterns
- 依任務類型調整注入內容（coding / docs / review / release）

#### 4. Explicit Memory UX
- 目前 `/remember`、`/forget`、`/why-this-memory`、`/what-did-you-learn` 已由 plugin tools 實裝
- 後續重點不是再重做指令，而是補上更好的展示層與摘要 surface
- 建議搭配 plugin summary tool / workflow，讓使用者更容易理解「這週學到了什麼」

#### Track 1 啟用條件（user/team 何時上線）
- 只有單機單使用者：不啟用 user/team 強制模型
- 共享 LanceDB 或遠端記憶服務：啟用 userId
- 團隊共用知識庫或 SSO：啟用 teamId
- 啟用後再升級 precedence 與衝突解決規則

### Track 2 — Agent Experience Learning（讓 OpenCode 越做越會成功）

#### 5. Episodic Task Memory
- 新增 task attempt / execution episode schema
- 每次任務記錄：
  - task goal
  - files touched
  - tools used
  - validation steps run
  - outcome（success / failed / partial）
  - failure reason
  - turnaround time

#### 6. Success Pattern Extraction
- 從成功 episode 萃取 reusable playbook：
  - 某類 bug 修復常用步驟
  - 某類 repo 常見驗證順序
  - 某類變更的最小成功路徑
- 將 episode 提升為 semantic memory 時要附 citations 與 success evidence

#### 7. Retry / Recovery Learning & Integration Layer
- 先建立 failure taxonomy（embedding/test/type/tool timeout/conflict）作為學習資料
- 蒐集 OpenCode/oh-my-openagent 的重試與恢復訊號（fallback、續作、失敗原因）
- 產生可重用的 policy hints（何時重試、何時降級、何時升級處理）
- 避免在本專案重做完整執行引擎；優先做「可學習、可評估、可回放」

> 目前狀態：failure taxonomy、retry budget、strategy switching evidence 已有基礎；待補的是上游 backoff/cooldown signal ingestion。

#### 8. Checkpoint / Resume Evidence Layer
- 記錄 checkpoint/resume 的證據資料（session、task、validation、outcome）
- 與 OpenCode session continuity 與 oh-my-openagent 續作能力整合
- 本專案優先做 resume intelligence，不自行承擔完整執行狀態機

> 註：此方向目前不列近期主線 backlog；若上游 session/recovery 訊號成熟，再重新評估是否投入。

#### 7/8 整合邊界契約（責任切分）

| 層級 | OpenCode | oh-my-openagent | lancedb-opencode-pro（本專案） |
|---|---|---|---|
| 會話生命週期 | 提供 session、messages、continue/undo 等基礎能力 | 透過 hooks 強化續作與流程控管 | 消費 session 訊號，寫入可學習記憶 |
| 執行恢復（Execution Recovery） | 基礎會話回復與事件來源 | fallback/recovery/continuation 等執行層補強 | **不重做執行引擎**，只整合其輸出訊號 |
| Retry 控制 | 非本專案責任 | 可提供部分 retry/fallback 行為 | 建立 evidence model、policy hints、成效評估 |
| Checkpoint/Resume | 會話連續性（非完整 task checkpoint） | 部分續作狀態管理 | 原計畫建立 evidence index（BL-035），已評估後取消；若上游訊號成熟再重新評估 |
| 學習與長期優化 | 無長期 memory learning 主責 | 提供執行訊號來源 | **主責**：學習閉環、指標、知識沉澱 |

**邊界原則**：
- 本專案不複製 OpenCode/OMO 的執行控制能力。
- 本專案聚焦於「把執行事件轉成長期可學習資產」。
- 若上游能力升級，本專案優先擴充 signal ingestion，而非重寫 orchestration。

### Track 3 — Trust, Quality, Governance

#### 9. Citation-Backed Memory
- 每筆重要 memory 附：
  - file path / symbol / doc path / commit / command output reference
- 使用前驗證 citation 是否仍有效
- 無效時：降權、標記 stale、觸發 refresh

#### 10. Memory Freshness & Decay
- 為 preference / fact / decision / episode 設不同衰減規則
- 長期未命中、被回報 wrong、citation 失效者自動降權

#### 11. Learning Review Loop
- 背景 consolidation job 不只做 dedup，也做：
  - stale detection
  - promote / demote
  - conflict detection
  - weekly memory summary

#### 12. Safe Autonomy Guardrails
- 高風險學習項目需人工確認才升級成長期規則
- 避免把一次性的 workaround 學成通用策略

> 註：此原則保留，但目前不列近期主線實作；先以 citation、freshness、conflict detection 與保守升級策略控風險。

### Track 4 — Product UX & Observability

#### 13. Learning Dashboard / Summary
- **Surface**：Plugin（summary tool）
- 新增「本週學到什麼」摘要
- 顯示：
  - 新增偏好
  - 新增成功模式
  - 常見失敗原因
  - 自動救援成功率

#### 14. Product-Level KPIs
- **Surface**：Docs + optional plugin tool
- 除現有 system-health metrics 外，新增：
  - repeated-context reduction
  - clarification-turn reduction
  - retry-to-success ratio
  - time-to-fix improvement
  - memory-applied success lift
  - stale-memory incident rate

#### 15. Evaluation Harness for Learning
- **Surface**：Test infrastructure
- 建立固定 eval dataset：
  - preference recall correctness
  - project decision recall correctness
  - retry strategy effectiveness
  - stale memory resistance

- A/B testing framework 應視為 **Test infrastructure + Docs**，不屬於 plugin runtime 核心。

---

## Roadmap（建議分期）

## Phase 0 — 打底（已完成）

**目標**：把「學習」從抽象概念變成可建模資料。

### 功能項目
- [x] 擴充 schema：`confidence`、`freshness`、`sourceType`、`sourceSessionId`
- [x] 在 metadata 中預留 optional `userId`、`teamId`（不強制）
- [x] 為 feedback / memory / episode 對齊 metadata 結構
- [x] 新增 memory citation 欄位
- [x] 定義 episodic task memory schema
- [x] 擴充 `memory_effectiveness` 與相關 learning metrics 基礎

### 驗收標準
- 可以區分 project/global 記憶
- 在提供 user/team metadata 時可正確保留並查詢
- 可以追蹤 memory 來源與新鮮度
- 可以記錄一次任務的 outcome 與驗證結果

---

## Phase 1 — 使用者可感知的偏好學習（大致完成）

**目標**：先讓使用者明顯感受到「系統開始懂我」。

### 功能項目
- [x] 建立 preference aggregation engine
- [x] 新增 `/remember`、`/forget`、`/what-did-you-learn`、`/why-this-memory`
- [x] 將 preference 與 decision 分層注入 prompt
- [ ] 根據 feedback useful/wrong 全面驅動 preference confidence / ranking adaptation
- [x] 提供「本回合用了哪些記憶」可解釋說明

### 成功指標
- 使用者重複交代偏好的次數下降
- `memory_feedback_missing` 中 preference 類別比例下降
- `memory_feedback_useful` 正向率提升

---

## Phase 2 — 成功經驗學習閉環（大致完成）

**目標**：讓系統不是只有記住結果，而是記住「怎麼成功」。

### 功能項目
- [x] 記錄 task episodes（goal、tools、edits、validation、outcome）
- [x] 從成功 episode 萃取 success patterns
- [ ] 建立 retry/recovery evidence model 與完整 signal ingestion（OpenCode/OMO upstream 待補）
- [x] failure taxonomy 與 policy hints（學習層）
- [ ] 將 success patterns 納入 recall 與任務前置建議（部分完成：similar task recall 已有，playbook surface 仍待加強）

### 成功指標
- retry-to-success ratio 改善
- 同類型任務平均修復時間下降
- test/type/build 失敗後的二次成功率上升

---

## Phase 3 — 記憶治理與可信度（部分完成）

**目標**：讓學習能長期累積而不失真。

### 功能項目
- [x] citation-backed memory validation
- [x] stale memory 降權 / freshness 基礎
- [x] conflict detection（偏好互斥、決策過期、策略衝突）
- [x] weekly consolidation / review job 基礎
- [ ] 高風險規則升級需人工確認（保留為研究候選）

### 成功指標
- stale-memory incident rate 下降
- wrong-memory feedback rate 下降
- memory recall precision 提升

---

## Phase 4 — 自適應與產品化（4-8 週）

**目標**：讓 OpenCode 在不同專案和團隊中越跑越順。

### 功能項目
- [x] feedback-driven ranking / routing weights（v0.6.0）
- [x] task-type aware injection policy（v0.6.0）
- [x] learning dashboard / weekly summary（v0.6.0）
- [x] KPI 定義與報表管線（v0.6.0）
- [ ] regression evals for learning quality（Surface: Test-infra）
- [ ] A/B framework 驗證學習功能是否真的提高效率（Surface: Test-infra + Docs）
- [ ] large-scope retrieval 的 ANN fast-path（Surface: Plugin）→ BL-036
  - 新增 `LANCEDB_OPENCODE_PRO_VECTOR_INDEX_THRESHOLD` 環境變數（預設 1000）
  - 當 scope 記錄數 ≥ 閾值時自動建立 IVF_PQ 向量索引
  - 在 `memory_stats` 回傳 `searchMode` 揭露當前搜尋模式（`in-memory-cosine` | `native-ivf`）
  - 當 `pruneScope` 刪除記錄時記錄警告日誌
- [x] `effectiveness_events` 的 TTL / archival（Surface: Plugin）

### 成功指標
- repeated-context reduction 顯著改善
- clarification-turn reduction 顯著改善
- learning-applied tasks 成功率高於 baseline

---

## Phase 5 — 可維護性重構與效能硬化（平行推進）

**目標**：降低單檔與單類別過載風險，並把大規模資料情境下的效能退化控制在可預期範圍。

### 功能項目
- [ ] Tool registration 模組化拆分（`index.ts` → `tools/memory.ts` / `tools/feedback.ts` / `tools/episodic.ts`）
- [ ] Episodic 更新流程 DRY 化（以共用 updater 模板收斂重複 delete+add+JSON parse 樣板）
- [ ] Duplicate consolidation 擴充性重構（ANN top-k / chunking，避免全表 O(N²)）
- [ ] Scope cache 記憶體治理（bounded/lazy/分段策略）
- [ ] DB row runtime schema validation（降低 unsafe cast 風險）
- [ ] Embedding fallback 與搜尋模式可觀測性補強 → BL-047
  - `memory_stats` 新增 `searchMode: "in-memory-cosine" | "native-ivf"` 揭露當前向量搜尋模式
  - embedding fallback 保留降級語義並補 structured warning + metrics

### 成功指標
- 相同功能變更的平均 touched files 與衝突率下降
- 大 scope 下 consolidation 與 recall 的 P95 延遲維持可接受
- 記憶體高水位（RSS）在長時間 session 中不持續線性成長
- 型別/資料格式錯誤可在 runtime 早期被檢測與定位

---

## Phase 6 — 記憶架構演進（研究與漸進整合）

**目標**：在維持 LanceDB 為主引擎的前提下，借鑑業界長期記憶最新研究，漸進式提升記憶品質與檢索能力。

> 技術研究依據：`docs/long-term-memory-landscape.md`

---

## Phase 7 — OpenCode 版本相容性與遷移

**目標**：確保插件在 OpenCode 各版本間的相容性，並建立版本遷移策略。

### 當前狀態

| OpenCode 版本 | 狀態 | 說明 |
|--------------|------|------|
| v1.2.0 - v1.3.7 | ✅ 穩定 | 推薦使用 |
| v1.3.8 - v1.3.13 | ❌ 損壞 | NAPI 載入問題（Issue #20623） |
| v1.4.0+ | ⚠️ 待確認 | SDK breaking changes + NAPI 狀態未知 |

### v1.4.0 Breaking Changes

| 變更項目 | v1.2.x - v1.3.7 | v1.4.0+ |
|---------|-----------------|---------|
| Diff metadata | `{to, from, patch}` | `{patch}` only |
| UserMessage.variant | 頂層欄位 | `msg.model.variant` |

### 風險評估（2026-04-08 更新）

#### 🔴 高風險：AI SDK v5 → v6 遷移（v1.3.4）

OpenCode v1.3.4 內部全面遷移到 AI SDK v6，同時進行 Effect-based 架構重構。`session.idle`（觸發 auto-capture 的主要 hook）及 tool hook 的執行路徑都可能受影響。

**受影響的鉤子**：
- `event` hook（session.start/end/idle/compacted）
- `experimental.text.complete`
- `experimental.chat.system.transform`
- 所有 tool hooks

#### 🟡 中風險：Tool.define() 修復（v1.3.14）

v1.3.14 修正了 `Tool.define()` 會重複包裝 `execute` 的 bug。若目前的實作恰好在 bug 行為下測試通過，升級後執行行為可能改變。

**受影響的 tools**：
- 17 個自訂 tool（memory_search, memory_delete, memory_stats 等）

#### 🟡 中風險：Plugin 安裝機制（v1.3.11）

v1.3.11 開始固定 plugin 版本、封鎖 install scripts。`prepublishOnly` 跑 `verify:full` 需要確認仍可正常執行。

#### 🟢 低風險：v1.4.0 本身

v1.4.0 新增的項目（OTLP、HTTP proxy、PDF 拖放）對本 plugin 無關。但今天才發布，社群尚未驗證。

### 分階段升級策略

```
1.2.25  →  1.3.14  →  (觀察 1-2 週)  →  1.4.x（穩定後）
```

#### 第一步：先升到 1.3.14

這是跨越 AI SDK v6 遷移 + Tool bug 修復的版本。

**驗證方式**：
```bash
# 改 package.json
"@opencode-ai/plugin": "1.3.14",
"@opencode-ai/sdk": "1.3.14",

npm install
npm run verify:full
```

**重點驗證項目**：
- `test:foundation`：`session.idle` 是否仍能觸發 auto-capture
- `test:regression`：17 個 tool 的 execute 行為是否正確
- `test:e2e`：完整的寫入 → 重啟 → 搜尋流程

#### 第二步：確認後再考慮 1.4.0

等 1.4.0 發布後 1~2 週，確認社群無重大回報，再跟進。

### 功能項目

- [x] 相容性文件 `docs/OPENCODE_COMPATIBILITY.md`
- [x] Plugin interface 研究文件 `docs/opencode-plugin-interface-research.md`
- [x] 風險評估與分階段升級策略
- [x] SDK 升級到 1.3.14 測試驗證 → BL-059 ✅ DONE
- [ ] OpenCode v1.3.14 相容性確認 → BL-060
- [ ] OpenCode v1.4.0+ NAPI 狀態確認（待社群回報）
- [ ] SDK 升級測試矩陣（v1.2.x / v1.3.7 / v1.4.0+）
- [ ] 執行時期版本偵測機制

### 成功指標

- 使用者能清楚知道適用的 OpenCode 版本
- 分階段升級路徑文件化並驗證
- v1.4.0+ 相容性狀態明確記錄

### 參考資料

- `docs/opencode-plugin-interface-research.md` — v1.2.x vs v1.4.0 介面差異研究
- `docs/OPENCODE_COMPATIBILITY.md` — 版本相容性與故障排除指南

---

## 優先級清單（先做什麼）

### P0
1. learning dashboard / weekly summary（Surface: Plugin）→ BL-030 ✅ DONE v0.6.0
2. KPI 定義與報表管線（Surface: Docs + optional plugin tool）→ BL-031 ✅ DONE v0.6.0
3. feedback-driven ranking / injection adaptation（Surface: Plugin）→ BL-038 ✅ DONE v0.6.0
4. task-type aware injection policy（Surface: Plugin）→ BL-039 ✅ DONE v0.6.0

### P1
5. eval harness for learning quality（Surface: Test-infra）→ BL-032
6. A/B testing framework（Surface: Test-infra + Docs）→ BL-033
7. success pattern 的 playbook surface 強化（Surface: Plugin）→ BL-040
8. `effectiveness_events` TTL / archival（Surface: Plugin）→ BL-037 ✅ DONE
9. backoff / cooldown signal ingestion（Surface: Plugin；**blocked by upstream events**）→ BL-021
10. 條件式 user/team precedence（僅在多使用者需求成立時）
11. Tool registration 模組化拆分（Surface: Plugin）→ BL-041 ✅ DONE
12. Episodic 更新流程 DRY 化（Surface: Plugin）→ BL-043 ✅ DONE
13. Duplicate consolidation 擴充性重構（Surface: Plugin）→ BL-044 ✅ DONE
14. Scope cache 記憶體治理（Surface: Plugin）→ BL-045 ✅ DONE
15. DB row runtime schema validation（Surface: Plugin + Test-infra）→ BL-046 ✅ DONE
16. LanceDB 索引衝突修復與備份安全機制（Surface: Plugin）→ BL-048 ✅ DONE v0.6.1
17. Embedder 錯誤容忍與 graceful degradation（Surface: Plugin）→ BL-049 ✅ DONE
18. FTS/Vector index concurrent-process race condition fix（Surface: Plugin）→ BL-051 ✅ DONE v0.6.1
19. 內建 embedding 模型（transformers.js）（Surface: Plugin）→ BL-050 ⚠️ 研究完成，待實作
20. **SDK 升級到 1.3.14 測試驗證（Surface: Plugin）** → BL-059 ✅ DONE
21. **OpenCode v1.3.14 相容性確認（Surface: Plugin + Docs）** → BL-060 ⚠️ 高優先

### P2
22. OpenCode v1.4.0+ 相容性驗證（Surface: Plugin + Docs）→ BL-056
23. large-scope retrieval 的 ANN fast-path（Surface: Plugin）→ BL-036
24. Store repository 職責分離（Surface: Plugin）→ BL-042
25. Embedding fallback 可觀測性補強（Surface: Plugin + Docs）→ BL-047
26. SDK 升級測試矩陣（Surface: Test-infra）→ BL-057
27. 執行時期版本偵測機制（Surface: Plugin）→ BL-058
28. weekly review automation 強化
29. trajectory relabeling / hindsight replay
30. 多策略檢索增強：entity-based retrieval + temporal filtering（Surface: Plugin）→ BL-052
31. 記憶摘要壓縮（Surface: Plugin）→ BL-053
32. 輕量級實體關係索引（Surface: Plugin）→ BL-054
33. 時態知識追蹤（Surface: Plugin）→ BL-055

---

## 建議實作順序

如果只能選最有感的前三件事，建議依序做：

1. **Learning dashboard / weekly summary（BL-030，Plugin）** ✅ DONE v0.6.0
   - 最快把既有學習成果轉成使用者真正看得見的產品體感。
2. **KPI + eval harness（BL-031 + BL-032，Docs / Test-infra）** ✅ DONE v0.6.0
   - 先把「是否真的越做越會成功」量化，避免只靠感覺判斷。
3. **Feedback-driven ranking + task-type aware injection（BL-038 + BL-039，Plugin）** ✅ DONE v0.6.0
   - 讓既有記憶與偏好不只被存下來，還能更直接影響下一輪任務成敗。

若要平行壓低技術風險，建議以「低風險可驗證」切片穿插進行：

4. **Episodic 更新流程 DRY 化（BL-043） + DB row validation（BL-046）**
   - 幾乎不改產品行為，可先降低維護成本與型別風險。
5. **Duplicate consolidation / cache 硬化（BL-044 ✅ DONE + BL-045 ✅ DONE）**
   - 在資料量成長前先做防護，避免後續 plugin latency 突然劣化。

---

## 完成後的理想體驗

當 roadmap 的前兩階段完成後，使用者應明顯感受到：

- 不用一直重講偏好與工作方式
- AI 會自動沿用團隊慣例與最近成功路徑
- 遇到類似問題時，修復更快、亂試更少
- AI 能說清楚「我是根據哪些過往經驗這樣做」
- 記憶錯了可以被修正，久了不用的知識會自然退場

這才是從「有 memory」走向「會學習」的關鍵差別。
