# Memory 儲存安全與備份機制研究

> 研究日期：2026-04-03  
> 原因：memory_stats 顯示 LanceDB 索引 conflict 錯誤，導致 vector/fts 索引失效

---

## 問題診斷

### 錯誤訊息

```
lance error: Retryable commit conflict for version 6: 
This CreateIndex transaction was preempted by concurrent transaction CreateIndex at version 6. 
Please retry.
```

### 根本原因分析

在 `src/store.ts:1959-1983` 的 `ensureIndexes()` 函式中：

```typescript
private async ensureIndexes(): Promise<void> {
  const table = this.requireTable();

  try {
    await table.createIndex("vector");  // ← 同時建立 vector 索引
    this.indexState.vector = true;
  } catch {
    this.indexState.vector = false;
  }

  try {
    // FTS 索引建立也可能衝突
    await table.createIndex("text", ...);
    this.indexState.fts = true;
  } catch (error) {
    this.indexState.fts = false;
    this.indexState.ftsError = error.message;
  }
}
```

**問題**：
1. 每次 init() 都會嘗試建立索引（如果尚未建立）
2. 兩個 `createIndex` 呼叫沒有序列化保護
3. LanceDB 的索引建立是 transaction，如果同時有多個連線或進程嘗試建立索引，會發生 conflict
4. 失敗後 `indexState` 狀態不會重試，導致永久失效

---

## LanceDB 原生安全機制

### 1. 版本控制 (Versioning)

LanceDB 內建表格版本追蹤：

| 操作 | API | 說明 |
|------|-----|------|
| 查看版本 | `table.version()` | 取得目前版本號 |
| 切換版本 | `table.checkout(n)` | 時間旅行到指定版本 |
| 回歸最新 | `table.checkoutLatest()` | 回到最新版本 |
| 復原 | `table.restore(n)` | 復原到指定版本 |
| 標籤 | `table.createTag("name")` | 為版本設標籤 |
| 清理 | `table.optimize({cleanupOlderThan})` | 清理舊版本 |

```typescript
// 時間旅行範例
const table = await db.openTable("memories");
const version = await table.version();
console.log(`Current version: ${version}`);

// 復原到舊版本
await table.restore(5);
```

### 2. 資料保護特性

- ✅ ACID transactions（事務支援）
- ✅ MVCC（多版本併發控制）
- ✅ 自動版本歷史（預設保留 7 天）
- ❌ **無自動備份排程**（需自行實作）
- ❌ **無 RDB 類似的定期快照**（需外部腳本）

---

## 實作建議：定期備份機制

### 方案 A：使用 LanceDB 版本復原（無外部備份）

**概念**：利用 LanceDB 內建的版本系統作為還原點

**優點**：
- 不需要額外儲存空間
- 復原速度快
- 內建功能

**缺點**：
- 需要先 checkout 到舊版本才能復原
- 版本會被 `optimize()` 清理
- 無法跨 DB 檔案備份

```typescript
// 腳本：建立備份復原點（概念）
const table = await db.openTable("memories");
await table.createTag(`backup-${Date.now()}`);  // 如：backup-1712140800000
```

### 方案 B：手動匯出備份（JSON/Parquet）

**概念**：定期匯出資料到外部檔案

**優點**：
- 完全獨立的備份檔
- 可跨機器遷移
- 可版本控制（如 commit 到 git）

**缺點**：
- 匯出需要時間
- 需要額外儲存空間
- 復原時需要覆寫表格

```bash
# 概念：匯出腳本
# 使用 lancedb CLI 或 script
lancedb export memories --format json --output ./backups/memories-$(date +%Y%m%d).json
```

### 方案 C：定時建立 clean DB 目錄（最安全）

**概念**：定時複製整個 DB 目錄

```bash
# crontab 範例：每日 03:00 備份
0 3 * * * rsync -av --delete ~/.opencode/memory/lancedb/ ~/.opencode/memory/lancedb-backup-$(date +\%Y\%m%d)/
```

**優點**：
- 完整 DB 狀態（包括索引）
- 復原最簡單（置換目錄）
- 可保留多個備份點

**缺點**：
- 硬碟空間需求
- 複製時間（取決於 DB 大小）

---

## 實作價值評估

### 評估標準

| 標準 | 權重 | 方案 A | 方案 B | 方案 C |
|------|------|--------|--------|--------|
| 實作難度 | 高 | ★★★ | ★★ | ★ |
| 成本（空間） | 高 | ★ | ★★ | ★★★ |
| 復原速度 | 高 | ★★ | ★★ | ★★★ |
| 獨立性 | 高 | ★ | ★★★ | ★★★ |
| 可遷移性 | 中 | ★ | ★★★ | ★★★ |

### 建議

**如果專案已有穩定索引建立**（不會常冲突）：
- 方案 C（定時 rsync）是最簡單有效的安全網
- 低實作成本，高保障

**如果索引問題持續发生**：
- 需要修復 `ensureIndexes()` 的重試邏輯
- 加上方案 C 作為最終安全網

---

## 實作項目： BL-048（新增）

| 項目 | 內容 |
|------|------|
| BL-ID | BL-048 |
| Title | LanceDB 定期備份與安全機制 |
| Priority | P1 |
| Status | proposed |
| Surface | Plugin + Docs |
| 實作 | 1. 修復 ensureIndexes() 重試邏輯 2. 建立 optional backup tool 或 config 3. 更新 operations.md |

---

## 修復 ensureIndexes() 建議

修改 `src/store.ts` 的 `ensureIndexes()` 加入重試邏輯：

```typescript
private async ensureIndexes(retries = 3): Promise<void> {
  const table = this.requireTable();

  // Vector 索引建立，重試最多 3 次
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await table.createIndex("vector");
      this.indexState.vector = true;
      break;
    } catch (error) {
      if (attempt === retries - 1) {
        console.error("[store] Failed to create vector index after 3 attempts:", error);
        this.indexState.vector = false;
      } else {
        await new Promise(r => setTimeout(r, 500)); // 500ms backoff
      }
    }
  }

  // FTS 索引建立，同樣重試
  // ...
}
```

---

## 更新建議：backlog.md

在 `Epic 9 — 儲存引擎與規模韌性` 新增項目：

```markdown
| BL-048 | LanceDB 定期備份與安全機制 | P1 | proposed | TBD | TBD | 1. 修復 ensureIndexes() 重試 2. 可選 backup config 3. 更新 operations.md |
```

---

## 參考資料

- [LanceDB Versioning](https://docs.lancedb.com/tables/versioning)
- [LanceDB TypeScript SDK](https://lancedb.github.io/lancedb/js/)
- [Context7: LanceDB Restore](https://context7.com/lancedb/lancedb/llms.txt)