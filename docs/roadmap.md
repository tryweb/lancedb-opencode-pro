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

## 目前關鍵缺口

### A. 使用者互動學習缺口

1. **沒有 user identity / team identity 模型**
   - 目前 memory 以 scope 為主，還沒有 user/team 維度。
2. **偏好雖可被分類，卻沒有聚合與套用**
   - `preference` 類別存在，但沒有 preference profile、衝突解決、權重更新。
3. **沒有可驗證的偏好記憶**
   - 記憶缺少 citation / source / freshness 機制，容易過時。
4. **回饋沒有真正影響排序與注入策略**
   - 有 feedback metrics，但沒有 feedback-driven ranking / injection adaptation。

### B. AI 試錯學習缺口

1. **沒有 task trajectory / outcome 模型**
   - 沒有把「做了哪些步驟、試了哪些方法、哪些驗證成功」存成 episodic memory。
2. **沒有 retry policy learning**
   - 缺少 retry budget、backoff、failure class、strategy selection。
3. **沒有 success pattern extraction**
   - 成功案例沒有被抽象成 reusable playbook。
4. **沒有 checkpoint / resume / partial recovery 機制**
   - 中斷後無法穩定沿用先前成功中間狀態。

### C. 產品化缺口

1. **缺少明確的「學到什麼」使用者體感**
2. **缺少記憶治理與過期機制**
3. **缺少對學習品質的產品級 KPI**

---

## 產品原則

1. **先可驗證，再自動化**：先讓記憶可檢查、可回報、可撤銷，再做更強的自主學習。
2. **先學偏好與成功模式，再學抽象策略**：避免太早做黑盒自我優化。
3. **記憶分層**：procedural / semantic / episodic 分離。
4. **學習必須可衰減、可回滾、可審核**：避免 stale memory 汙染。
5. **學習成果要對使用者可見**：不然使用者不會有「越用越強」的感受。

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
- 新增面向使用者的高頻命令/介面：
  - `/remember`
  - `/forget`
  - `/why-this-memory`
  - `/what-did-you-learn`
- 讓使用者能立即看見系統學到了什麼

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

#### 8. Checkpoint / Resume Evidence Layer
- 記錄 checkpoint/resume 的證據資料（session、task、validation、outcome）
- 與 OpenCode session continuity 與 oh-my-openagent 續作能力整合
- 本專案優先做 resume intelligence，不自行承擔完整執行狀態機

#### 7/8 整合邊界契約（責任切分）

| 層級 | OpenCode | oh-my-openagent | lancedb-opencode-pro（本專案） |
|---|---|---|---|
| 會話生命週期 | 提供 session、messages、continue/undo 等基礎能力 | 透過 hooks 強化續作與流程控管 | 消費 session 訊號，寫入可學習記憶 |
| 執行恢復（Execution Recovery） | 基礎會話回復與事件來源 | fallback/recovery/continuation 等執行層補強 | **不重做執行引擎**，只整合其輸出訊號 |
| Retry 控制 | 非本專案責任 | 可提供部分 retry/fallback 行為 | 建立 evidence model、policy hints、成效評估 |
| Checkpoint/Resume | 會話連續性（非完整 task checkpoint） | 部分續作狀態管理 | 建立 checkpoint/resume evidence index、回放與分析 |
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

### Track 4 — Product UX & Observability

#### 13. Learning Dashboard / Summary
- 新增「本週學到什麼」摘要
- 顯示：
  - 新增偏好
  - 新增成功模式
  - 常見失敗原因
  - 自動救援成功率

#### 14. Product-Level KPIs
- 除現有 system-health metrics 外，新增：
  - repeated-context reduction
  - clarification-turn reduction
  - retry-to-success ratio
  - time-to-fix improvement
  - memory-applied success lift
  - stale-memory incident rate

#### 15. Evaluation Harness for Learning
- 建立固定 eval dataset：
  - preference recall correctness
  - project decision recall correctness
  - retry strategy effectiveness
  - stale memory resistance

---

## Roadmap（建議分期）

## Phase 0 — 打底（1-2 週，單使用者優先）

**目標**：把「學習」從抽象概念變成可建模資料。

### 功能項目
- [ ] 擴充 schema：`confidence`、`freshness`、`sourceType`、`sourceSessionId`
- [ ] 在 `metadataJson` 預留 optional `userId`、`teamId`（不強制）
- [ ] 為 feedback / memory / episode 對齊 metadata 結構
- [ ] 新增 memory citation 欄位
- [ ] 定義 episodic task memory schema
- [ ] 擴充 `memory_effectiveness` 輸出 learning-specific metrics

### 驗收標準
- 可以區分 project/global 記憶
- 在提供 user/team metadata 時可正確保留並查詢
- 可以追蹤 memory 來源與新鮮度
- 可以記錄一次任務的 outcome 與驗證結果

---

## Phase 1 — 使用者可感知的偏好學習（2-4 週）

**目標**：先讓使用者明顯感受到「系統開始懂我」。

### 功能項目
- [ ] 建立 preference aggregation engine
- [ ] 新增 `/remember`、`/forget`、`/what-did-you-learn`
- [ ] 將 preference 與 decision 分層注入 prompt
- [ ] 根據 feedback useful/wrong 調整 preference confidence
- [ ] 提供「本回合用了哪些記憶」可視化說明

### 成功指標
- 使用者重複交代偏好的次數下降
- `memory_feedback_missing` 中 preference 類別比例下降
- `memory_feedback_useful` 正向率提升

---

## Phase 2 — 成功經驗學習閉環（3-5 週）

**目標**：讓系統不是只有記住結果，而是記住「怎麼成功」。

### 功能項目
- [ ] 記錄 task episodes（goal、tools、edits、validation、outcome）
- [ ] 從成功 episode 萃取 success patterns
- [ ] 建立 retry/recovery evidence model 與 signal ingestion（OpenCode/OMO）
- [ ] failure taxonomy 與 policy hints（學習層）
- [ ] 將 success patterns 納入 recall 與任務前置建議

### 成功指標
- retry-to-success ratio 改善
- 同類型任務平均修復時間下降
- test/type/build 失敗後的二次成功率上升

---

## Phase 3 — 記憶治理與可信度（2-4 週）

**目標**：讓學習能長期累積而不失真。

### 功能項目
- [ ] citation-backed memory validation
- [ ] stale memory 降權與 refresh 流程
- [ ] conflict detection（偏好互斥、決策過期、策略衝突）
- [ ] weekly consolidation / review job
- [ ] 高風險規則升級需人工確認

### 成功指標
- stale-memory incident rate 下降
- wrong-memory feedback rate 下降
- memory recall precision 提升

---

## Phase 4 — 自適應與產品化（4-8 週）

**目標**：讓 OpenCode 在不同專案與團隊中越跑越順。

### 功能項目
- [ ] feedback-driven ranking / routing weights
- [ ] task-type aware injection policy
- [ ] learning dashboard / weekly summary
- [ ] regression evals for learning quality
- [ ] A/B framework 驗證學習功能是否真的提高效率

### 成功指標
- repeated-context reduction 顯著改善
- clarification-turn reduction 顯著改善
- learning-applied tasks 成功率高於 baseline

---

## 優先級清單（先做什麼）

### P0
1. schema 擴充（confidence/freshness/source/citation；user/team 為 optional metadata）
2. preference aggregation
3. explicit memory UX（remember / forget / what-did-you-learn）
4. episodic task memory schema
5. retry/recovery evidence model（整合 OpenCode/OMO 訊號）

### P1
6. success pattern extraction
7. citation validation + stale decay
8. learning dashboard
9. feedback-driven ranking
10. 條件式 user/team precedence（僅在多使用者需求成立時）

### P2
11. checkpoint / resume intelligence（整合式）
12. weekly review automation
13. A/B evaluation framework
14. trajectory relabeling / hindsight replay

---

## 建議實作順序

如果只能選最有感的前三件事，建議依序做：

1. **Preference aggregation + explicit memory UX**
   - 最快讓使用者感受到「你有記住我」。
2. **Episodic task memory + success pattern extraction**
   - 最快讓 agent 呈現「同類問題第二次更會做」。
3. **Citation-backed memory + stale decay**
   - 避免系統越學越亂，先把可信度守住。

---

## 完成後的理想體驗

當 roadmap 的前兩階段完成後，使用者應明顯感受到：

- 不用一直重講偏好與工作方式
- AI 會自動沿用團隊慣例與最近成功路徑
- 遇到類似問題時，修復更快、亂試更少
- AI 能說清楚「我是根據哪些過往經驗這樣做」
- 記憶錯了可以被修正，久了不用的知識會自然退場

這才是從「有 memory」走向「會學習」的關鍵差別。
