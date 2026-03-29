# 開發工作流程指南

**最後更新**: 2026年3月  
**狀態**: 啟動中  
**前提條件**: OpenCode CLI, Git, GitHub CLI, Docker

---

## 概覽

本專案使用基於兩個 OpenCode 技能之標準化開發工作流程：

1. **`backlog-to-openspec`** — 將待辦清單 (backlog) 項目轉換為可執行的規格書 (specifications)
2. **`release-workflow`** — 處理 npm 發布並附有防止偏移 (anti-drift) 首位品質閘道

這兩項技能皆專為確保程式碼與規格書在同一個 git 分支中完全同步而設計。

### 何時使用哪個工作流程

| 你的任務 | 使用此流程 | 分支名稱 |
|-----------|----------|--------|
| 來自待辦清單的新功能 | `backlog-to-openspec` | `feat/<id>` |
| 錯誤修復 (Bug fix) | 直接使用 `chore/` 或 `fix/` | `fix/<id>` |
| 基礎架構、工具、文檔更新 | 直接使用 `chore/` | `chore/<desc>` |
| 發布至 npm | `release-workflow` | `release/vX.Y.Z` |

---

## 前提條件

在開始開發之前，請確保您已安裝與配置以下項目：

- [ ] 已安裝 OpenCode CLI (`1.2.27+`)
- [ ] 已配置 Git 並授權存取 GitHub
- [ ] GitHub CLI (`gh`) 確認登入
- [ ] 已安裝 Docker 與 Docker Compose
- [ ] Node.js `24.x` (請參考 `.nvmrc`)

驗證授權是否成功：

```bash
npm whoami        # 應回傳你的 npm 使用者名稱
gh auth status    # 應顯示 "Logged in to github.com"
```

---

## 共享 Git 安全閘道 (極為重要)

在進行任何功能開發或發布操作 **之前** ，請務必執行此項閘道檢查。

```bash
# 1) 同步參考紀錄
git fetch origin --prune

# 2) 確認當前分支
git rev-parse --abbrev-ref HEAD

# 3) 工作目錄必須是乾淨的
git status --porcelain
```

### 通過條件

- 對於功能開發: 當前分支是 `main` (新開發) 或 `feat/<change-id>` (繼續開發)
- 對於發佈作業: 當前分支是 `main`
- `git status --porcelain` 輸出為空

### 嚴格規範

- **嚴禁使用 `git stash` 作為工作流程的傳遞機制**
- 若工作目錄不乾淨: 請提交更改，或是刻意執行 `git reset --hard` 來捨棄變更
- 若 upstream 不存在: 請執行 `git push -u origin <current-branch>`

### 失敗模式 → 補救措施

| 失敗模式 | 偵測方式 | 安全的補救措施 |
|---|---|---|
| 工作目錄不乾淨 | `git status --porcelain` 不是空的 | 執行 `git add -A && git commit -m "wip: ..."` 或是刻意的 `git reset --hard` |
| upstream 遺失 | `git rev-parse --abbrev-ref --symbolic-full-name @{upstream}` 失敗 | 執行 `git push -u origin <current-branch>` |
| 基底分支錯誤 | 當前分支非該階段預期分支 | 執行 `git checkout main && git pull origin main` |
| 發布前發現未合併的功能 | `git branch -r --no-merged origin/main` 包含了目標 `origin/feat/*` | 請先將該功能分支合併入 `main` |

---

## 開發工作流程

### 第一階段: 從待辦清單到實作

當您想開始實作一個待辦(backlog)項目時使用它。

```
┌─────────────────────┐
│ 1. backlog-to-openspec │
│    (使用該技能)         │
└──────────┬────────────┘
           │
           ▼
┌─────────────────────┐
│ 2. 功能分支           │
│    (建立 + 推送)       │
└──────────┬────────────┘
           │
           ▼
┌─────────────────────┐
│ 3. /opsx-apply      │
│    (開發實作)          │
└──────────┬────────────┘
           │
           ▼
┌─────────────────────┐
│ 4. 提交並推送         │
│    (程式碼 + 規格書)   │
└──────────┬────────────┘
           │
           ▼
┌─────────────────────┐
│ 5. 建立 PR           │
│    (合併至 main)       │
└──────────┬────────────┘
           │
           ▼
┌─────────────────────┐
│ 6. 合併與清理         │
└─────────────────────┘
```

---

### 步驟 1: 使用 `backlog-to-openspec` 技能

觸發該技能並帶入您的待辦清單項目：

```
/backlog-to-openspec
```

收到提示時，請提供：
- 待辦清單 ID (例如：`BL-014`)
- 或是一段您想要建置項目之簡短描述

**系統將會執行以下操作:**

1. **Backlog 標準化** — 解析並驗證待辦項目
2. **Git 安全閘道** — 在新建立的更改變更前強制確保工作目錄乾淨以及分支安全性
3. **建立 OpenSpec 變更** — 執行 `openspec new change "<id>"`
4. **建立功能分支** — 建立 `feat/<change-id>` 分支並推送至 origin ⭐
5. **撰寫提案 (Proposal)** — 文件化紀錄問題所在、目標、以及範圍
6. **撰寫設計 (Design)** — 架構決策、Runtime API、進入點
7. **撰寫規格 (Specs)** — 包含情境的可測量需求
8. **建置開發任務 (Tasks)** — 搭載驗證矩陣(Verification matrix)的原子實作任務

**輸出:**
- 位在 `openspec/changes/<change-id>/` 中的 OpenSpec 成品 (Artifacts)
- 功能分支: `feat/<change-id>`

---

### 步驟 2: 驗證功能分支

在技能執行完畢之後，請確認您已切換到新的分支：

```bash
git branch
# 應顯示: * feat/<change-id>
```

若非如此，請進行手動切換：

```bash
git checkout feat/<change-id>
```

如果在進行此步驟時工作目錄處於未受乾淨的狀態：

```bash
# 選項 A: 儲存變更
git add -A && git commit -m "wip: save local changes"

# 選項 B: 刻意捨棄變更
git reset --hard
```

在該工作流程中請 **不要** 使用 `git stash`。

---

### 步驟 3: 使用 `/opsx-apply` 執行實作

開始程式開發：

```
/opsx-apply
```

這項功能將會：
- 讀取 `tasks.md` 分配的工作任務
- 一步一步帶你執行每個工作開發環節
- 當您達成任務的同時代驗證任務完成度

---

### 步驟 4: 提交程式碼更改

請務必讓程式碼變更與對應之規格書保持同步、不分割（Atomic Commits）：

```bash
# 加入所有的變更內容 (包含原始碼和 OpenSpec 表格文字)
git add .

# 加附清晰之 Commit 說明
git commit -m "feat: implement <change-id>

- Proposal: docs/...
- Design: docs/...
- Specs: openspec/changes/<change-id>/specs/
- Tasks: openspec/changes/<change-id>/tasks.md
- Code: src/...
- Tests: test/..."
```

**為何一次性同步（Atomic Commits）如此重要：**
- 程式碼以及開發紀錄維持同步
- 要還原狀態時更加簡單
- 直接關聯對應的規格書，清晰顯示實作細節的源頭

---

### 步驟 5: 推送並建立拉取請求 (PR)

```bash
# 送出該功能分支
git push origin feat/<change-id>

# 建立到 main 分支的 PR
gh pr create \
  --title "feat: <change-id> - <description>" \
  --body "$(cat <<'EOF'
## 總結
- 本次更改的簡短描述

## 變更項目
- proposal.md: ...
- design.md: ...
- specs/: ...
- src/: ...

## 測試項目
- [ ] 單元測試通過
- [ ] 整合測試通過
- [ ] E2E 測試通過 (若是針對使用者的功能)
EOF
)" \
  --base main \
  --head feat/<change-id>
```

請等候持續整合 (CI) 工具完成檢查，隨後即可完成分支合併。

---

### 步驟 6: 完成合併後的清理

PR 完成合併之後：

```bash
# 切換到 main，確保拉了最新的進度
git checkout main && git pull origin main

# 刪除功能分支 (選用)
git branch -d feat/<change-id>
```

---

## 發布工作流程

當你準備好要發布新版本時：

### 步驟 1: 執行 `release-workflow` 技能

```
/release-workflow
```

該技能將引導你完成以下流程：

1. **Git 安全閘道** — 要求乾淨的 Git 狀態 + 強制從 `main` 開始起點
2. **本地前置作業** — 於 Docker 環境中跑 `npm run release:check`
3. **主張即證明檢查 (Claim-to-Evidence)** — 確認每條 changelog 更新皆立基於證明機制之上
4. **功能可用性門檻** — 確保各使用者功能能夠完整被引用呼叫
5. **版本與 Changelog** — 自動幫助更新 `package.json` 以及 `CHANGELOG.md`
6. **建立 Release 分支** — 自動建立 `release/vX.Y.Z` 分支
7. **對 Main 建立 PR** — 開立具有 Pre-merge checks 的拉取請求
8. **分支清理驗證** — 確保遠端之 `release/vX.Y.Z` 舊分支已正確的刪掉或進行了 Prune
9. **打上標籤與觸發 CI 行為** — 確認 Push 該 Tag，以觸發後續發布至 NPM 機制
10. **發佈驗證動作** — 要求對 npm 或 GitHub 發佈確認的紀錄與通知

發布 Release 分支建立前，必須驗證預期內的所有 feature 已被合併：

```bash
git fetch origin --prune
git checkout main && git pull origin main
git branch -r --no-merged origin/main
```

若輸出仍然顯示欲包含進去的 `origin/feat/*` 尚未合併，請先合併它們。

### 重要: 系統預期為 Squash-Merge 拓樸學形式設計

預設系統在合併至 main 時帶用了 `--squash` 引數以還換歷史紀錄的最佳簡潔呈現。導致 Commit 歷史經常呈現為似乎 "分歧的 (diverged)" 顯示，那是因為之前於 `release/vX.Y.Z` 做更動原本的 Commit 已不在歷史直系演變樹裡邊。

請依內容差異作最後比對（切莫迷信單一 commit 紀錄外觀）：

```bash
git diff --stat main..release/vX.Y.Z
```

- 若發現空白 (或者發現只剩一般 Metadata 更動之行)：那麼大體上即表安全
- 假如 `src/`, `test/`, `openspec/` 的程式碼出現過多衝突或異樣：務必調查後才開始釋出版號動作

### 分歧復原建議準則: `reset` 對決 `rebase` 差異

- 把本機上的 `main` 同步至遠端進度 (最常用方式):

```bash
git fetch origin && git reset --hard origin/main
```

- 想保留本機中但尚且沒推播的專案 Commit，再重載到最新的 main 分支:

```bash
git pull --rebase origin main
```

發佈安全守則:
- 在存有未送交之本機變更歷史前提下，決不啟發 Rebase
- 切記莫利用 stash 包覆變更轉送 Release 分配環境流程
- 舉棋不定之時，直接選擇重啟/替換本機為 `origin/main` 並且由一張完全純淨的 Release 階段重新來過

---

## 快速參考

### 常用命令

```bash
# 開啟新功能
/backlog-to-openspec

# 進入實作開發
/opsx-apply

# 開始發布流程
/release-workflow

# 查看當前分支
git branch

# 檢視狀態
git status --short

# 在正式釋出之前，確認一下有沒被正確 merge 的舊分支遺落在外
git branch -r --no-merged origin/main
```

### 分支命名慣例

| 類型 | 格式要求 | 舉例 | 使用時機 |
|------|--------|---------|-------------|
| 新功能 (Feature) | `feat/<change-id>` | `feat/add-dedupe-consolidation` | 新建功能 (要求利用 `backlog-to-openspec`) |
| 錯誤解決 (Fix) | `fix/<change-id>` | `fix/memory-leak-fix` | Bug 修復 |
| 開發雜務 (Chore) | `chore/<description>` | `chore/update-skills-and-docs` | 與本體邏輯無關基礎建設、開發工具、技術或架構文件維護與 CI/CD 平台 |
| 發布上盤 (Release) | `release/vX.Y.Z` | `release/v0.2.9` | 上架或改版 npm 包 (建議與 `release-workflow` 並用) |

---

### 如何規劃選擇適合的工作流

採用 **`backlog-to-openspec` → `feat/`** 系統流程如果符合下開事項：
- 為了去開發/實踐從 Backlog 取出之新模組、或者 API
- 程式更改涵蓋在撰寫嚴謹的 Spec 要求時
- 在嚴謹保持原始碼以及其對應附錄間的極致關聯同步

採用直接開啟 **`chore/`** 分支，條件包含：
- 若僅為了要修正和 Skills/ 紀錄 (`.opencode/skills/`)
- 只為更新一些文件檔案 (`.md` 文件檔)
- 若改版了建構檔案 (`.github/`, `docker-compose.yml`)
- 純粹更改建置系統/開發使用器具工具參數更改等
- 不需要建立出對應的規格(Specification)之產生物資(Artifacts)
- 功能目的極度單行明確而直接且完全不必要寫 OpenSpec 的記錄項目

```bash
# 範例：對 Skills 與一般專案紀錄的快速建版流程
git checkout -b chore/update-skills-and-docs
# ... 撰寫完工之後 ...
git add . && git commit -m "chore: update skills and documentation"
git push origin chore/update-skills-and-docs -u
gh pr create --title "chore: update skills and documentation" --base main
```

---

### 何時使用 `backlog-to-openspec` vs 當用 `chore/`

| 切入點 | backlog-to-openspec (`feat/`) | chore/ |
|--------|------------------------------|--------|
| **訴求目的** | 為待辦清單中欲處理出來之實質新特性 | 純基本架構/工具包/文檔改修等 |
| **定義上預期成果**| 可生成之結構化 OpenSpec 紀錄文物 | 無需此規範 |
| **分支定義要求** | `feat/<change-id>` | `chore/<description>` |
| **自動化檢驗標準**| 需要撰寫單元/整合測試與 e2e 之要求 | 單方面相依受專案當下本身而異 |
| **常見應許環境情境**| 開發一個記憶除錯重組機制，研發一個全新記憶方法模組管理 | 修改 Skills 指引文件，把自動部屬 CI 問題補丁給抓掉，或是單純引進新 linter |

如果不知道該採取那種方向，只需反問這一個小題目: "*此工作變更是否牽扯必須修改一個附帶了規格制訂的新功能嗎?*" 若非如此 → 取用 `chore/` 流程。

### 文件分布目錄路徑查核基準

| 定義與應用目標 | 所屬路徑 |
|---------|----------|
| 整體待處理的清單存放 | `docs/backlog.md` |
| 存有 OpenSpec 標準變動 | `openspec/changes/<change-id>/` |
| 出售變更註解歷史之歷史筆跡 | `CHANGELOG.md` |
| 各版號軟體發行版本定義總綱 | `package.json` |

---

## 異常排解技巧

### 問題顯示 "Working tree is dirty" (工作目錄還有變更未被接受)

唯二兩種排錯選擇:
1. 利用儲存起來將變數變為有依歸狀態: `git add . && git commit`
2. 或者強勢利用退回清空來回復原本乾爽: `git reset --hard`

強調在各種開發的實踐環節上都 **不要** 把 `git stash` 設定為狀態遞送的方法工具之用。

### 問題顯示 "Branch protection prevents push" (不允授權直接推上分枝防護牆阻擋)

這是常態，請每次務必保持利用新建專屬特定之建構特性分支操作，請返回檢驗標題 "分支命名慣例"(上述的提示規則)。

### 問題顯示 "CI checks failing"

利用 gh 來迅速調查各項回報錯誤:
```bash
gh run list --limit=5
gh run view <run-id> --log
```

### 問題顯示 "npm publish failed" (發佈行為未獲通行)

最可能引發原因包含下列情操:
- 給 GitHub Actions 那裡的 `NPM_TOKEN` 環境變數掉鏈未給齊
- 版本標號衝突，早已被存於遠端歷史建儲中
- `TypeScript` 打包過程建置噴出了 Error 無法妥協

查訪有關 `release-workflow` 詳細除錯排除資訊來一一擊破故障疑難。

---

## 其他相關開發文檔目錄

- `README.md` — 首發重點概述專案導覽以及系統佈建資訊大觀
- `docs/backlog.md` — 現下所有的產品尚未實作規劃清單
- `docs/operations.md` — 例行巡迴營運上架以及系統診測與操作準則說明
- `docs/release-readiness.md` — 發行門檻規定標線
- `.opencode/skills/backlog-to-openspec/SKILL.md` — 對應技能指南全方面手冊紀錄匯總
- `.opencode/skills/release-workflow/SKILL.md` — 自動派送更新版本釋放上發行架指南手冊細說匯整

---

**若有其餘相關事項問題？** 可以建置開啟一條 Issue 問題追蹤區，也可以逕於你的 PR (Pull-Request) 中給我們提示即可。
