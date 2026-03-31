---
name: backlog-complete-merge
description: Verify BL completion, run tests, archive change, resolve conflicts, and create PR. Use when a developer believes a backlog item implementation is complete.
license: MIT
compatibility: Requires openspec CLI, git, gh, docker compose.
metadata:
  author: tryweb
  version: "1.0"
  generatedBy: "manual"
---

# Backlog Complete → Merge Workflow

Use this skill when a developer believes a backlog item (BL) implementation is complete and ready to be merged to main.

This skill ensures:
- Current branch is a valid BL development branch (not main)
- All work is verified via /opsx-verify (openspec verify-change) + BL requirements
- All tests pass (unit + E2E)
- Documentation is complete
- Change is archived
- No conflicts with remote main
- PR is created

---

## Phase 0 — Branch Validation (CRITICAL)

**Goal**: Ensure we're on a valid BL development branch, not main.

```bash
# Get current branch
git rev-parse --abbrev-ref HEAD

# Get remote tracking info
git rev-parse --abbrev-ref --symbolic-full-name @{upstream}
```

**Pass conditions**:
- Current branch starts with `feat/`, `fix/`, or `chore/` (BL development branch)
- Branch has upstream set

**Failure handling**:

| Failure mode | Remediation |
|---|---|
| On main branch | Switch to your BL branch: `git checkout <branch>` |
| No upstream | Push branch: `git push -u origin <branch>` |
| Unknown branch | Confirm this is your BL branch, or create from main |

```bash
# If on main, find your branch
git branch -a | grep -E "feat/|fix/|chore/"

# Switch to your BL branch
git checkout feat/<change-id>
```

---

## Phase 1 — OpenSpec Verification

**Goal**: Verify implementation matches change artifacts using /opsx-verify.

Run verification via the /opsx-verify command (internally uses `openspec verify-change`):

```bash
openspec status --change "<change-id>" --json
openspec verify-change "<change-id>"
```

Or simply use:

```
/opsx-verify <change-id>
```

### If verification passes:
Proceed to Phase 2.

### If verification fails:
- Review CRITICAL issues and fix them
- Re-run verification until all CRITICAL issues are resolved
- Only proceed when verification is clean or only contains SUGGESTIONS

---

## Phase 2 — Test Execution

**Goal**: Confirm all tests pass.

### Run unit tests

```bash
docker compose build --no-cache && docker compose up -d
docker compose exec opencode-dev npm run test:unit
```

**Pass conditions**: All unit tests exit 0.

### Run E2E tests (if applicable)

Check if E2E tests exist for this change:

```bash
ls -la test/e2e/ 2>/dev/null || echo "No e2e tests"
```

If E2E tests exist:

```bash
docker compose exec opencode-dev npm run test:e2e
```

**Pass conditions**: All E2E tests exit 0.

### If tests fail:
- Fix failing tests
- Re-run tests until all pass
- Never proceed with failing tests

---

## Phase 3 — Documentation Check

**Goal**: Verify all documentation is complete and updated.

Check for documentation that may need updating:

```bash
# Check if changelog needs update
git diff main..HEAD -- CHANGELOG.md

# Check for new README files or updates
git diff main..HEAD -- "*.md"

# Check if there are new config options
git diff main..HEAD -- "*.json" -- "*.yaml" -- "*.yml"
```

**Pass conditions**:
- Changelog updated if user-facing changes exist
- Any new documentation is added
- API changes documented if applicable

### If documentation is incomplete:
- Add/update documentation
- Do NOT commit yet — wait until after archive
- Re-run verification if needed

---

## Phase 4 — Archive Change

**Goal**: Archive the OpenSpec change.

Archive via `/opsx-archive` command (internally uses `openspec archive-change`):

```bash
openspec archive-change "<change-id>"
```

Or simply use:

```
/opsx-archive <change-id>
```

This moves the change to archive with date prefix.

**Pass conditions**:
- Change is archived to `openspec/changes/archive/YYYY-MM-DD-<change-id>/`

---

## Phase 4.5 — Backlog Status Update (CRITICAL)

**Goal**: Update `docs/backlog.md` and `docs/roadmap.md` after successful archive.

**IMPORTANT**: This step is done AFTER archiving to ensure consistency — if archive fails or needs rollback, backlog status remains unchanged.

### Step 4.5.1 — Identify the BL ID

From the change ID, determine which BL (Backlog Item) this corresponds to:

```bash
# Search for the change ID in backlog to find BL
rg "<change-id>" docs/backlog.md
```

If multiple BLs match, note all of them.

### Step 4.5.2 — Update backlog.md status

For each BL identified:
1. Find the BL row in `docs/backlog.md`
2. Update `Status` column to `done`
3. Ensure `OpenSpec Change ID` and `Spec Path` are filled

Example (manual edit):
```
| BL-014 | Task episode capture | P0 | done | 2026-03-28-add-task-episode-learning | openspec/specs/task-episode-learning/ | ...
```

### Step 4.5.3 — Check roadmap.md for related checkboxes

If `docs/roadmap.md` has checkboxes for this feature, mark them as `[x] done`:

```bash
# Check for related checkboxes
rg "BL-<number>|<feature-name>" docs/roadmap.md
```

### Step 4.5.4 — Do NOT commit yet

Backlog updates will be committed together with implementation changes in the next phase.

**Pass conditions**:
- `docs/backlog.md` has BL status changed to `done`
- `docs/roadmap.md` checkboxes updated if applicable

---

## Phase 5 — Commit All Changes

**Goal**: Commit all changes (implementation + archive + backlog updates) as one atomic operation.

**IMPORTANT**: Commit all changes together to ensure atomic transaction and revert capability.

```bash
# Ensure all implementation + archive + backlog changes are safely captured
git add -A
git commit -m "chore: finalize <change-id> implementation and update backlog"
```

**Pass conditions**:
- Change is archived
- Backlog status is updated
- All changes are committed in a single atomic commit
- Commit message clearly identifies the change

---

## Phase 6 — Conflict Detection and Resolution

**Goal**: Check for conflicts with remote main and resolve them.

### Step 6.1 — Fetch and compare

```bash
# Fetch latest from origin
git fetch origin --prune

# Check for diverged commits
git rev-list --left-right main...origin/main --count

# See what changed on main since branch
git log main..origin/main --oneline
```

### Step 6.2 — If conflicts detected

If there are commits on main since branch creation:

```bash
# Rebase onto latest main
git rebase origin/main
```

**If rebase conflicts occur**:
1. Resolve conflicts in affected files
2. Mark as resolved: `git add <resolved-files>`
3. Continue rebase: `git rebase --continue`
4. **RE-VERIFY everything** (Phase 1-3)

**After successful rebase**:
- Force push: `git push --force-with-lease origin <branch>`
- Re-run verification (openspec verify-change)
- Re-run tests
- Only proceed if all pass

### Step 6.3 — If no conflicts

If main hasn't diverged or rebase was clean:

```bash
# Push the branch (if not already pushed)
git push origin <branch>
```

---

## Phase 7 — Create PR

**Goal**: Create a PR to merge the branch to main.

```bash
# Get branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Create PR
gh pr create \
  --title "feat: implement <change-id>" \
  --body "## Summary
- BL implementation complete
- All tests passing
- Documentation updated

## Verification
- openspec verify-change: passed
- Unit tests: passed
- E2E tests: passed (if applicable)

## Changes
$(git diff main --stat)" \
  --base main \
  --head "${BRANCH}"
```

**On success**: PR is created.

---

## Phase 8 — Post-PR Handling

### If PR requires changes:

The developer will continue working on the same branch.

```bash
# Make changes, then:
git add -A
git commit -m "fix: address PR feedback"
git push origin <branch>
```

The existing PR will update automatically.

### If PR is merged:

```bash
# Verify PR is merged
gh pr view <PR_NUMBER> --state merged

# Delete local branch
git checkout main
git pull origin main
git branch -d <branch-name>

# Prune remote tracking
git fetch --prune
```

---

## Quick Reference — All Commands

```bash
# Phase 0 — branch validation
git rev-parse --abbrev-ref HEAD
git rev-parse --abbrev-ref --symbolic-full-name @{upstream}

# Phase 1 — verification
openspec verify-change "<change-id>"

# Phase 2 — tests
docker compose build --no-cache && docker compose up -d
docker compose exec opencode-dev npm run test:unit
docker compose exec opencode-dev npm run test:e2e

# Phase 3 — documentation check
git diff main..HEAD -- "*.md"

# Phase 4 — archive
openspec archive-change "<change-id>"

# Phase 4.5 — backlog status update (after archive)
rg "<change-id>" docs/backlog.md
# Edit docs/backlog.md to change Status to 'done'
rg "BL-<number>" docs/roadmap.md
# Update checkboxes in docs/roadmap.md if applicable

# Phase 5 — commit all together
git add -A && git commit -m "chore: finalize <change-id> implementation and update backlog"

# Phase 6 — rebase
git fetch origin --prune
git rebase origin/main

# Phase 7 — PR
gh pr create --title "feat: implement <change-id>" --base main --head <branch>

# Phase 8 — cleanup (after merge)
git checkout main && git pull origin main
git branch -d <branch-name>
git fetch --prune
```

---

## Definition of Done (DoD)

This workflow is complete only if all are true:

1. ✅ Current branch is a valid BL development branch (not main)
2. ✅ /opsx-verify passes (no CRITICAL issues)
3. ✅ All unit tests pass
4. ✅ All E2E tests pass (if applicable)
5. ✅ Documentation is complete (including changelog, README)
6. ✅ Backlog status updated in docs/backlog.md and docs/roadmap.md
7. ✅ Change is archived via /opsx-archive
8. ✅ All changes are committed
9. ✅ No conflicts with origin/main (or conflicts resolved and re-verified)
10. ✅ PR is created
11. ✅ After merge: local branch is deleted

---

## Guardrails

- Never skip verification even if "it looks done"
- Never proceed with failing tests
- Never skip backlog status update — always update docs/backlog.md and docs/roadmap.md after archiving
- Never create PR with unresolved conflicts
- After resolving conflicts, always re-verify
- Never delete local branch before confirming PR is merged