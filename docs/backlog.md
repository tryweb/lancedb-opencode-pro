# OpenCode 持續學習 Backlog（OpenSpec 索引）

> 此檔案是 **索引/導航**，不是規格本體。  
> 實作細節、驗收條件、任務拆解以 `openspec/changes/*` 為準。

---

## 使用規則

- `Status`：`planned` / `proposed` / `in_progress` / `done` / `cancelled`
- `OpenSpec Change ID`：對應 `openspec/changes/<change-id>/`
- `Spec Path`：通常為 `openspec/changes/<change-id>/specs/...`
- 若尚未建立 change，先填 `TBD`

---

## Epic 1 — 記憶資料模型升級

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-001 | 擴充 MemoryRecord metadata | P0 | done | 2026-03-28-extend-memory-metadata | openspec/specs/memory-metadata-extension/ | userId/teamId/sourceSessionId/confidence/tags |
| BL-002 | 擴充 FeedbackEvent metadata | P0 | done | 2026-03-28-extend-memory-metadata | openspec/specs/memory-metadata-extension/ | sourceSessionId/confidenceDelta/relatedMemoryId |
| BL-003 | 新增 EpisodicTaskRecord schema | P0 | done | 2026-03-28-add-episodic-task-schema | openspec/specs/episodic-task-schema/ | task episode 基礎資料模型 |
| BL-004 | 記憶 schema migration 機制 | P0 | done | 2026-03-28-extend-memory-metadata | openspec/specs/memory-metadata-extension/ | 向後相容與版本遷移 |

## Epic 2 — 偏好學習（單使用者優先）

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-005 | Preference profile 聚合器 | P0 | done | 2026-03-28-add-preference-learning | openspec/specs/preference-learning/ | preference 聚合核心 |
| BL-006 | 偏好衝突解決規則 | P0 | done | 2026-03-28-add-preference-learning | openspec/specs/preference-learning/ | recent/direct signals 優先 |
| BL-007 | Scope precedence resolver（single-user first） | P1 | done | 2026-03-28-add-preference-learning | openspec/specs/preference-learning/ | 預設 project > global |
| BL-008 | Preference-aware prompt injection | P0 | done | 2026-03-28-add-preference-learning | openspec/specs/preference-learning/ | 分層注入偏好/決策/成功模式 |
| BL-009 | 偏好學習效果指標 | P1 | done | 2026-03-28-add-preference-learning | openspec/specs/preference-learning/ | effectiveness events 追蹤 |

## Epic 3 — 顯式記憶 UX

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-010 | `/remember` 指令或同等工具 | P0 | done | 2026-03-28-add-explicit-memory-commands | openspec/specs/explicit-memory-commands/ | memory_remember tool |
| BL-011 | `/forget` 指令或同等工具 | P0 | done | 2026-03-28-add-explicit-memory-commands | openspec/specs/explicit-memory-commands/ | memory_forget tool (soft/hard delete) |
| BL-012 | `/what-did-you-learn` 檢視 | P0 | done | 2026-03-28-add-explicit-memory-commands | openspec/specs/explicit-memory-commands/ | memory_what_did_you_learn tool |
| BL-013 | `/why-this-memory` 解釋能力 | P1 | done | 2026-03-29-why-this-memory-explanation | openspec/specs/why-this-memory/ | memory_why + memory_explain_recall 已實裝 v0.5.0 |
| BL-034 | 多使用者 identity 模式（條件啟用） | P2 | done | 2026-03-28-extend-memory-metadata | openspec/specs/memory-metadata-extension/ | userId/teamId 欄位已實裝 |

## Epic 4 — 任務經驗記憶（Episodic Learning）

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-014 | Task episode capture | P0 | done | 2026-03-28-add-task-episode-learning | openspec/specs/task-episode-learning/ | createTaskEpisode |
| BL-015 | Validation outcome ingestion | P0 | done | 2026-03-28-add-task-episode-learning | openspec/specs/task-episode-learning/ | parseValidationOutput |
| BL-016 | Failure taxonomy | P0 | done | 2026-03-28-add-task-episode-learning | openspec/specs/task-episode-learning/ | FailureType enum |
| BL-017 | Success pattern extraction | P1 | done | 2026-03-28-add-task-episode-learning | openspec/specs/task-episode-learning/ | extractSuccessPatternsFromScope |
| BL-018 | Similar task recall | P1 | done | 2026-03-28-add-task-episode-learning + complete-episodic-learning-hooks | openspec/specs/similar-task-recall/ | findSimilarTasks + similar_task_recall tool |

## Epic 5 — Retry / Recovery Learning Layer（與 OpenCode/OMO 整合）

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-019 | Retry/Recovery evidence model | P1 | done | 2026-03-28-add-retry-recovery-evidence | openspec/specs/retry-recovery-evidence/ | RetryAttempt/RecoveryStrategy |
| BL-020 | Retry budget 與 stop conditions（建議層） | P1 | done | 2026-03-28-add-retry-recovery-evidence | openspec/specs/retry-recovery-evidence/ | suggestRetryBudget |
| BL-021 | Backoff / cooldown 訊號整合 | P1 | planned | TBD | TBD | blocked by upstream events，待確認 OMO 是否提供 backoff 事件後再做 [Surface: Plugin] |
| BL-022 | Strategy switching 建議器 | P1 | done | 2026-03-28-add-retry-recovery-evidence | openspec/specs/retry-recovery-evidence/ | suggestRecoveryStrategies |
| BL-035 | Checkpoint/Resume evidence index（整合式） | P2 | cancelled | — | — | 價值不明確：BL-019/020 retry evidence 已足夠覆蓋需求 |

## Epic 6 — Citation 與記憶可信度

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-023 | Citation model | P0 | done | citation-model | openspec/changes/citation-model/specs/ | 記憶來源可追溯 |
| BL-024 | Citation validation pipeline | P1 | done | citation-model | openspec/changes/citation-model/specs/ | 引用有效性檢查 |
| BL-025 | Freshness / decay engine | P1 | done | memory-retrieval-ranking-phase1 | openspec/specs/memory-retrieval-ranking/ | recency boost 已實裝 |
| BL-026 | Conflict detection | P1 | done | 2026-03-28-add-preference-learning | openspec/specs/preference-learning/ | 偏好衝突解決已實裝 |

## Epic 7 — 背景治理與整併

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-027 | Weekly consolidation job 升級 | P1 | done | 2026-03-27-add-similarity-dedup-flagging | openspec/specs/similarity-dedup/ | session.compacted hook + dedup |
| BL-028 | Promote episodic → semantic rules | P1 | cancelled | — | — | 價值不明確：無明確觸發條件定義，現有 BL-019/020 已足夠 |
| BL-029 | Human review gate for risky learning | P1 | cancelled | — | — | 價值不明確：管理層面機制，與 OpenCode 核心用途較遠 |

## Epic 8 — 觀測、評估、產品化

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-030 | Learning dashboard summary | P0 | **done** | 2026-03-30-learning-dashboard-summary | openspec/specs/learning-dashboard-summary/ | 週摘要可視化 [Surface: Plugin] v0.6.0 |
| BL-031 | Learning KPI pipeline | P0 | **done** | 2026-03-30-learning-kpi-pipeline | openspec/specs/learning-kpi-pipeline/ | retry-to-success / lift 指標 [Surface: Plugin] v0.6.0 |
| BL-032 | Eval harness for learning quality | P1 | planned | TBD | TBD | 固定資料集回歸驗證 [Surface: Test-infra] |
| BL-033 | A/B testing framework | P1 | planned | TBD | TBD | learning feature 效益驗證 [Surface: Test-infra + docs] |
| BL-038 | Feedback-driven ranking / routing weights | P0 | **done** | 2026-03-30-feedback-driven-ranking | openspec/specs/feedback-factor/ | 根據 feedback 動態調整記憶排序與注入權重 [Surface: Plugin] v0.6.0 |
| BL-039 | Task-type aware injection policy | P0 | **done** | 2026-03-31-task-type-injection-policy | openspec/specs/task-type-injection/ | 依任務類型（coding/docs/review/release）調整注入策略 [Surface: Plugin] v0.6.0 |
| BL-040 | Success pattern playbook surface 強化 | P1 | planned | TBD | TBD | 把已存的 episodic success patterns 產品化成可感知的跨任務 playbook surface [Surface: Plugin；以 playbook summary/recommendation tool 交付] |

## Epic 9 — 儲存引擎與規模韌性

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-036 | LanceDB ANN fast-path for large scopes | P2 | planned | TBD | TBD | 新增 `LANCEDB_OPENCODE_PRO_VECTOR_INDEX_THRESHOLD` (預設 1000)；當 scope entries ≥ 閾值時自動建立 IVF_PQ 向量索引；`memory_stats` 揭露 `searchMode` 欄位；`pruneScope` 超過 `maxEntriesPerScope` 時發出警告日誌 [Surface: Plugin] |
| BL-037 | Event table TTL / archival | P1 | done | bl-037-event-ttl-archival | openspec/changes/archive/2026-04-03-bl-037-event-ttl-archival/specs/event-ttl/ | 為 `effectiveness_events` 建立保留期與歸檔機制，降低長期 local store 成本 [Surface: Plugin] |
| BL-048 | LanceDB 索引衝突修復與備份安全機制 | P1 | **done** | bl-048-lancedb-index-recovery | openspec/changes/bl-048-lancedb-index-recovery/ | 修復 ensureIndexes() 重試邏輯 + 可選定期備份 config [Surface: Plugin] v0.6.1 |
| BL-051 | FTS/Vector index concurrent-process race condition fix | P0 | **done** | fix-fts-index-race-condition | openspec/changes/archive/2026-04-05-fix-fts-index-race-condition/ | 修復多进程同时启动时的 index 创建冲突；commit-conflict 检测 + re-verify + jitter + final-pass [Surface: Plugin] v0.6.1 |
| BL-049 | Embedder 錯誤容忍與 graceful degradation | P1 | **done** | bl-049-embedder-error-tolerance | openspec/changes/archive/2026-04-03-bl-049-embedder-error-tolerance/ | embedder 失敗時的重試/延遲 + 搜尋時 BM25 fallback [Surface: Plugin] |
| BL-050 | 內建 embedding 模型（transformers.js） | P1 | proposed | TBD | TBD | 新增 TransformersEmbedder，提供離線 embedding 能力 [Surface: Plugin] |

## Epic 10 — 架構可維護性與效能硬化

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-041 | Tool registration 模組化拆分 | P1 | **done** | bl-041-tool-registration-modularization | openspec/changes/bl-041-tool-registration-modularization/ | 將 26 個 tool 定義從 index.ts 拆分至 `tools/memory.ts`、`tools/feedback.ts`、`tools/episodic.ts` 降低耦合 [Surface: Plugin] |
| BL-042 | Store repository 職責分離 | P2 | planned | TBD | TBD | 將 `MemoryStore` 逐步拆為 `MemoryRepository` / `EventRepository` / `EpisodicTaskRepository`，由 provider 統一連線管理 [Surface: Plugin] |
| BL-043 | Episodic 更新流程 DRY 化 | P1 | **done** | episodic-update-dry | `openspec/changes/episodic-update-dry/` | `addCommandToEpisode`、`addValidationOutcome`、`addSuccessPatterns`、`addRetryAttempt`、`addRecoveryStrategy` 以共用 updater 模板收斂 [Surface: Plugin] |
| BL-044 | Duplicate consolidation 擴充性重構 | P1 | **done** | bl-044-duplicate-consolidation-ann-chunking | `openspec/changes/archive/2026-03-31-bl-044-duplicate-consolidation-ann-chunking/` | 以 ANN top-k / chunking 取代全表 O(N²) 比對，避免 `consolidateDuplicates` 在大 scope 阻塞 event loop [Surface: Plugin] |
| BL-045 | Scope cache 記憶體治理 | P1 | **done** | scope-cache-memory-governance | openspec/changes/scope-cache-memory-governance/ | `getCachedScopes` 避免全量 records/token/vector 常駐；導入 bounded/lazy/分段策略 [Surface: Plugin] |
| BL-046 | DB row runtime 型別驗證 | P1 | **done** | episodic-record-validation | `openspec/changes/episodic-record-validation/` | 降低 `as unknown as EpisodicTaskRecord` 風險；讀取後做 schema validation [Surface: Plugin + Test-infra] |
| BL-047 | Embedding fallback 與搜尋模式可觀測性補強 | P2 | planned | TBD | TBD | `memory_stats` 新增 `searchMode: "in-memory-cosine" | "native-ivf"` 揭露當前向量搜尋模式；embedding fallback 保留降級語義並補 structured warning + metrics [Surface: Plugin + Docs] |

## Epic 11 — 記憶架構演進（研究驅動）

> 技術研究依據：`docs/long-term-memory-landscape.md`
> 所有項目均在 LanceDB 之上實現，不引入新儲存後端。

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-052 | 多策略檢索增強（entity-based + temporal filtering） | P2 | planned | TBD | TBD | 在 vector + BM25 基礎上增加 entity 索引與時間過濾；參考 Hindsight 四策略架構 [Surface: Plugin] |
| BL-053 | 記憶摘要壓縮 | P2 | planned | TBD | TBD | 長期未使用記憶自動摘要；相似記憶合併為知識筆記；參考 HiMem Episode→Note 模式 [Surface: Plugin] |
| BL-054 | 輕量級實體關係索引 | P2 | planned | TBD | TBD | 為 memory records 增加 entity-relationship metadata；支援關係查詢；以 LanceDB metadata 欄位實現 [Surface: Plugin] |
| BL-055 | 時態知識追蹤（bi-temporal fact management） | P2 | planned | TBD | TBD | 參考 Graphiti bi-temporal 模型；增加 `validFrom`/`supersededAt`；事實失效而非刪除 [Surface: Plugin] |

## Epic 12 — OpenCode 版本相容性與遷移

> 技術研究依據：`docs/opencode-plugin-interface-research.md`
> 目標：確保插件在 OpenCode 各版本間的相容性，並建立版本遷移策略。

### 風險評估摘要（2026-04-08）

| 風險等級 | 項目 | 說明 |
|---------|------|------|
| 🔴 高 | AI SDK v5 → v6 遷移 | v1.3.4 引入，可能影響 session.idle / tool hooks |
| 🟡 中 | Tool.define() bug 修復 | v1.3.14，可能改變 17 個 tools 的 execute 行為 |
| 🟡 中 | Plugin 安裝機制改變 | v1.3.11，需確認 prepublishOnly 正常運作 |
| 🟢 低 | v1.4.0 本身 | 新功能對本 plugin 無關，但今日發布未驗證 |

### 升級策略

```
1.2.25 → 1.3.14 → (觀察 1-2 週) → 1.4.x（穩定後）
```

### Backlog 項目

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-056 | OpenCode v1.4.0+ 相容性驗證 | P1 | proposed | TBD | TBD | 確認 v1.4.0+ NAPI 載入狀態；驗證 SDK breaking changes 影響；更新相容性文件 [Surface: Plugin + Docs] |
| BL-057 | SDK 升級測試矩陣 | P2 | planned | TBD | TBD | 建立 v1.2.x / v1.3.7 / v1.4.0+ 自動化測試矩陣；確保跨版本相容性 [Surface: Test-infra] |
| BL-058 | 執行時期版本偵測機制 | P2 | planned | TBD | TBD | 在插件初始化時偵測 OpenCode 版本；提供版本特定錯誤訊息改善 [Surface: Plugin] |
| BL-059 | SDK 升級到 1.3.14 測試驗證 | P1 | proposed | TBD | TBD | 先升級到 1.3.14 跨越 AI SDK v6 遷移；執行 verify:full 驗證；重點測試 session.idle 觸發與 tool execute 行為 [Surface: Plugin] |
| BL-060 | OpenCode v1.3.14 相容性確認 | P1 | proposed | TBD | TBD | 確認 v1.3.14 版本下所有 hooks 正常運作；更新版本狀態文件 [Surface: Plugin + Docs] |

---

## 建議執行切片（索引版）

### Release A（使用者有感）— ✅ DONE
BL-001, BL-002, BL-005, BL-006, BL-008, BL-010, BL-011, BL-012

### Release B（經驗學習閉環）— ✅ DONE
BL-003, BL-014, BL-015, BL-016, BL-017, BL-018, BL-019, BL-020

### Release C（治理與產品化）— ✅ DONE（v0.6.0 完成）
已完成：BL-022, BL-023, BL-024, BL-025, BL-026, BL-027, BL-030, BL-031, BL-034, BL-038, BL-039
已取消（不值得做）：BL-028, BL-029, BL-035
待處理：BL-021（Plugin；視 upstream 事件）, BL-032（Test-infra）, BL-033（Test-infra + docs）, BL-040（Plugin）

### Release D（儲存引擎與規模韌性）— 📝 PLANNED
BL-036, BL-037, BL-048, BL-049, BL-050

### Release E（架構可維護性與效能硬化）— 📝 PLANNED
BL-041, BL-043, BL-044, BL-045, BL-046, BL-047

### Release F（記憶架構演進）— 🔬 RESEARCH
BL-052, BL-053, BL-054, BL-055
> 研究依據：`docs/long-term-memory-landscape.md`

### Release G（OpenCode 版本相容性）— 🔬 RESEARCH
BL-056, BL-057, BL-058, BL-059, BL-060
> 研究依據：`docs/opencode-plugin-interface-research.md`
> 升級策略：1.2.25 → 1.3.14 → (觀察) → 1.4.x

---

## 維護規則

1. 每建立一個 OpenSpec change，就回填 `OpenSpec Change ID` 與 `Spec Path`。  
2. `Status` 只能反映最新真實狀態（不要批次晚更新）。  
3. 若 backlog 與 OpenSpec artifacts 衝突，以 OpenSpec artifacts 為準。  
