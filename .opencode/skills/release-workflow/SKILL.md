---
name: release-workflow
description: Standard release procedure for lancedb-opencode-pro. Use when publishing a new npm version. Covers version bump, local verification, branch/PR flow, tagging, CI gate, and npm publish confirmation.
license: MIT
metadata:
  author: tryweb
  version: "1.0"
  generatedBy: "manual"
---

# Release Workflow — lancedb-opencode-pro

Use this skill when the user wants to publish a new version to npm.

---

## Pre-Conditions (Check Before Starting)

- All intended feature changes are merged to `main`
- `npm whoami` returns the publishing account (run on host, not in Docker)
- `NPM_TOKEN` secret is set in GitHub Actions repository settings
- No open `fix/` branches with uncommitted work

---

## Phase 1 — Local Preparation (Host)

**Goal**: Confirm the current codebase builds and passes all tests before touching version numbers.

```bash
# Run the full release gate inside Docker
docker compose build --no-cache && docker compose up -d
docker compose exec app npm run verify:full
```

Gate passes when:
- typecheck exits 0
- build exits 0
- foundation 10/10, regression 18/18, retrieval 2/2
- benchmark latency within thresholds
- `npm pack` produces a `.tgz` with no errors

If the gate fails, **stop and fix root causes** before proceeding. Never bump the version on a failing codebase.

---

## Phase 2 — Version & Changelog

```bash
# On main, bump version in package.json
# Edit CHANGELOG.md — add a new ## [X.Y.Z] section at the top
```

Commit message format:
```
chore: bump version to X.Y.Z and update changelog
```

---

## Phase 3 — Release Branch

```bash
git checkout -b release/vX.Y.Z
git push origin release/vX.Y.Z
```

---

## Phase 4 — PR to Main

### PRE-MERGE CHECK (CRITICAL)

Before merging the PR, verify that ALL intended changes are in the release branch:

```bash
# On release branch, verify code changes exist
git log main..release/vX.Y.Z --oneline
git diff main..release/vX.Y.Z --stat
```

**If diff is empty or missing files:**
- Your code changes are NOT committed
- Stop and commit your changes before proceeding

### Merge Steps

```bash
gh pr create \
  --title "chore: release vX.Y.Z" \
  --body "Bump version to X.Y.Z. See CHANGELOG.md for details." \
  --base main \
  --head release/vX.Y.Z
```

Wait for `verify` CI check to pass, then merge:

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
git checkout main && git pull origin main
```

### IMPORTANT: Never use git stash during release

**Why**: Stashing before rebase can cause code changes to be lost:
1. `git stash` hides uncommitted changes
2. `git rebase` may skip commits already on remote
3. `git stash pop` restores working directory but changes are uncommitted

**If you have uncommitted changes**: Commit them before any rebase operations.

**If you must rebase**: Use `git reset --hard` to discard local changes first, OR commit them before rebasing.

---

## Phase 5 — Tag and Trigger CI Release

### VERIFY CODE IS COMMITTED (CRITICAL)

Before tagging, confirm all changes are committed:

```bash
# Check that tag will include all intended changes
git log vX.Y.Z-1..HEAD --oneline

# If this shows unexpected commits or is empty, STOP
# Your release is missing code!
```

```bash
git tag vX.Y.Z <commit-sha>
git push origin vX.Y.Z
```

This triggers the `verify-full-release` GitHub Actions workflow, which:
1. Runs `npm run verify:full` inside Docker
2. Packs the `.tgz`
3. Uploads artifact
4. Publishes to npm via `NPM_TOKEN`
5. Creates GitHub Release with `.tgz` asset

Monitor with:
```bash
gh run watch <run-id> --interval 30
```

Or list recent runs:
```bash
gh run list --workflow=ci.yml --limit=5
```

---

## Phase 6 — Post-Release Verification

```bash
# Confirm npm version is live
npm view lancedb-opencode-pro name version

# Confirm GitHub Release exists with .tgz asset
gh release view vX.Y.Z --repo tryweb/lancedb-opencode-pro
```

Both must succeed before declaring the release complete.

---

## Phase 6.5 — Release Correctness Verification (CRITICAL)

After tagging, verify the release contains all intended changes:

```bash
# Compare with previous version tag
git log vX.Y.Z-1..vX.Y.Z --oneline

# Check file changes are included
git diff vX.Y.Z-1..vX.Y.Z --stat | head -20
```

**Expected output**: Should show your src/, test/, openspec/ changes

**If output is empty or wrong**:
- Code changes were NOT included in the release
- Follow "CI failed, tag already pushed" troubleshooting below

### Emergency Fix

If release is missing code:

```bash
# 1. Create fix branch with all changes
git checkout -b fix/release-fix
git add src/ test/ openspec/
git commit -m "fix: include code changes in vX.Y.Z"

# 2. Push and create PR
git push origin fix/release-fix -u
gh pr create --title "fix: include code in vX.Y.Z" --base main

# 3. After merge, delete old tag and retag
git checkout main && git pull
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
git tag vX.Y.Z
git push origin vX.Y.Z
```

---

## Troubleshooting

### Regression tests fail in CI but pass locally

Root causes encountered in practice:

1. **Sidecar config bleed**: Global `~/.config/opencode/lancedb-opencode-pro.json` overrides test config.
   - Symptom: `resolveMemoryConfig` tests fail with "Missing expected exception"
   - Fix: Use `LANCEDB_OPENCODE_PRO_SKIP_SIDECAR=true` in test `withPatchedEnv`

2. **LanceDB eventual consistency**: `hasMemory()` can't see a record immediately after `put()`.
   - Symptom: `memory_feedback_wrong` returns "not found in current scope" even though `memory_search` finds it
   - Fix: Retry loop in `hasMemory()` (3× at 50ms intervals)

3. **ENOTEMPTY on cleanup**: LanceDB holds file handles when `rm -rf` runs.
   - Symptom: `ENOTEMPTY: directory not empty, rmdir ...` in test teardown
   - Fix: 50ms delay + one retry in `cleanupDbPath()`

4. **`hooks.config()` called outside env patch**: Causes `state.config.dbPath` to be reset to global sidecar path.
   - Symptom: `memory_stats` shows `~/.opencode/memory/lancedb` instead of test dbPath
   - Fix: Never call `hooks.config()` outside `withPatchedEnv`

### CI failed, tag already pushed

```bash
# Fix root cause, merge fix to main, then:
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z

git tag vX.Y.Z <new-fixed-commit-sha>
git push origin vX.Y.Z
```

### npm publish fails with EACCES on dist/

Some build artifacts were created by root inside Docker:

```bash
docker compose up -d
docker compose exec -T -u root app sh -lc \
  'chown -R 1000:1000 /workspace/dist /workspace/dist-test 2>/dev/null || true'
npm publish
```

### Branch protection blocks direct push to main

Branch protection requires PR + `verify` status check. Always use a branch + PR flow.
If you temporarily disabled protection to hotfix, restore it after:

```bash
gh api repos/tryweb/lancedb-opencode-pro/branches/main/protection \
  --method PUT \
  --header "Accept: application/vnd.github+json" \
  --input - <<'EOF'
{
  "required_status_checks": { "strict": false, "contexts": ["verify"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

---

## Quick Reference — All Commands

```bash
# Phase 1 — local gate
docker compose build --no-cache && docker compose up -d
docker compose exec app npm run verify:full

# Phase 2 — version bump
# Edit package.json + CHANGELOG.md, then:
git add package.json CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z and update changelog"

# Phase 3 — release branch
git checkout -b release/vX.Y.Z
git push origin release/vX.Y.Z

# Phase 4 — PR + merge
gh pr create --title "chore: release vX.Y.Z" --base main --head release/vX.Y.Z
gh pr merge <PR_NUMBER> --squash --delete-branch
git checkout main && git pull origin main

# Phase 5 — tag
git tag vX.Y.Z HEAD
git push origin vX.Y.Z
gh run list --workflow=ci.yml --limit=3

# Phase 6 — verify
npm view lancedb-opencode-pro version
gh release view vX.Y.Z --repo tryweb/lancedb-opencode-pro
```
