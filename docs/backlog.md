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
| BL-013 | `/why-this-memory` 解釋能力 | P1 | planned | TBD | TBD | 記憶命中理由可解釋 |
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
| BL-021 | Backoff / cooldown 訊號整合 | P1 | planned | TBD | TBD | 整合 OpenCode/OMO 事件 |
| BL-022 | Strategy switching 建議器 | P1 | done | 2026-03-28-add-retry-recovery-evidence | openspec/specs/retry-recovery-evidence/ | suggestRecoveryStrategies |
| BL-035 | Checkpoint/Resume evidence index（整合式） | P2 | planned | TBD | TBD | resume intelligence，非狀態機重做 |

## Epic 6 — Citation 與記憶可信度

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-023 | Citation model | P0 | planned | TBD | TBD | 記憶來源可追溯 |
| BL-024 | Citation validation pipeline | P1 | planned | TBD | TBD | 引用有效性檢查 |
| BL-025 | Freshness / decay engine | P1 | done | memory-retrieval-ranking-phase1 | openspec/specs/memory-retrieval-ranking/ | recency boost 已實裝 |
| BL-026 | Conflict detection | P1 | done | 2026-03-28-add-preference-learning | openspec/specs/preference-learning/ | 偏好衝突解決已實裝 |

## Epic 7 — 背景治理與整併

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-027 | Weekly consolidation job 升級 | P1 | done | 2026-03-27-add-similarity-dedup-flagging | openspec/specs/similarity-dedup/ | session.compacted hook + dedup |
| BL-028 | Promote episodic → semantic rules | P1 | planned | TBD | TBD | 高成功率規則升級 |
| BL-029 | Human review gate for risky learning | P1 | planned | TBD | TBD | 高風險規則人工審核 |

## Epic 8 — 觀測、評估、產品化

| BL-ID | Title | Priority | Status | OpenSpec Change ID | Spec Path | Notes |
|---|---|---|---|---|---|---|
| BL-030 | Learning dashboard summary | P1 | planned | TBD | TBD | 週摘要可視化 |
| BL-031 | Learning KPI pipeline | P1 | planned | TBD | TBD | retry-to-success / lift 指標 |
| BL-032 | Eval harness for learning quality | P2 | planned | TBD | TBD | 固定資料集回歸驗證 |
| BL-033 | A/B testing framework | P2 | planned | TBD | TBD | learning feature 效益驗證 |

---

## 建議執行切片（索引版）

### Release A（使用者有感）— ✅ DONE
BL-001, BL-002, BL-005, BL-006, BL-008, BL-010, BL-011, BL-012

### Release B（經驗學習閉環）— ✅ DONE
BL-003, BL-014, BL-015, BL-016, BL-017, BL-018, BL-019, BL-020

### Release C（治理與產品化）— IN PROGRESS
BL-021, BL-022, BL-023, BL-024, BL-025, BL-026, BL-027, BL-028, BL-029, BL-030, BL-031, BL-034, BL-035

---

## 維護規則

1. 每建立一個 OpenSpec change，就回填 `OpenSpec Change ID` 與 `Spec Path`。  
2. `Status` 只能反映最新真實狀態（不要批次晚更新）。  
3. 若 backlog 與 OpenSpec artifacts 衝突，以 OpenSpec artifacts 為準。  
