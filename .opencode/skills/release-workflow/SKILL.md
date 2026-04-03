---
name: release-workflow
description: Hardened release workflow for lancedb-opencode-pro. Use when publishing a new npm version and when you must prevent claim/code/spec drift.
license: MIT
compatibility: Requires git, gh, docker compose, and npm CLI.
metadata:
  author: tryweb
  version: "2.1"
  generatedBy: "manual"
---

# Release Workflow — lancedb-opencode-pro

Use this skill when the user wants to publish a new version to npm.

This version adds mandatory anti-drift gates so we do not repeat:
- changelog claim without shipped code
- implemented store APIs without runtime operability
- spec requirement without test evidence

---

## Phase 0 — Git Safety Gate (CRITICAL)

**Goal**: ensure release starts from a safe and reproducible git state.

Run before any release actions:

```bash
# 1) sync refs
git fetch origin --prune

# 2) confirm current branch
git rev-parse --abbrev-ref HEAD

# 3) working tree must be clean
git status --porcelain

# 4) detect unmerged remote branches relative to main
git branch -r --no-merged origin/main

# 5) confirm npm identity on host
npm whoami
```

Pass conditions:
- Current branch is `main`
- Working tree is clean
- Intended feature branches are already merged to `origin/main`
- npm account is available (`npm whoami` succeeds)

Hard rules:
- Never start release from `feat/*` or `fix/*`
- Never use `git stash` as release transport
- If any intended feature branch is not merged to `main`, stop release and merge first

### Failure Mode → Remediation

| Failure mode | Detect with | Safe remediation |
|---|---|---|
| Dirty tree | `git status --porcelain` not empty | Commit changes, or intentional `git reset --hard` if discard is intended |
| Missing upstream push | `git rev-parse --abbrev-ref --symbolic-full-name @{upstream}` fails | `git push -u origin <current-branch>` |
| Wrong base branch | `git rev-parse --abbrev-ref HEAD` is not `main` | `git checkout main && git pull origin main` |
| Unmerged feature before release | `git branch -r --no-merged origin/main` includes intended `origin/feat/*` | Merge feature branch to main before release |

## Pre-Conditions (Check Before Starting)

- All intended feature changes are merged to `main`
- Working tree is clean (`git status --short` is empty)
- `npm whoami` returns the publishing account (run on host)
- `NPM_TOKEN` secret is set in GitHub Actions repository settings
- No open `fix/` branches with uncommitted work
- No intended `feat/` branches remain unmerged into `main`

```bash
git status --short
npm whoami
git branch -r --no-merged origin/main
```

If working tree is dirty: stop and clean up before release.

---

## Phase 1 — Local Preparation (Host)

**Goal**: Confirm the current codebase builds and passes all tests before touching version numbers.

```bash
docker compose build --no-cache && docker compose up -d
docker compose exec opencode-dev npm run release:check
```

Gate passes when:
- typecheck exits 0
- build exits 0
- effectiveness/retrieval/benchmark all pass
- benchmark latency within thresholds
- `npm pack` produces a `.tgz` with no errors
- `npm publish --dry-run` succeeds

If the gate fails, **stop and fix root causes** before proceeding. Never bump the version on a failing codebase.

### Optional: Staging Verification

For additional operability assurance, use the staging verification script:

```bash
./scripts/verify-staging.sh
```

This script:
1. Builds and packs the plugin
2. Spins up a clean Docker container
3. Installs the `.tgz` via `npm install -g`
4. Verifies the plugin can be `require()`'d

This provides **evidence that the published package is actually usable**, not just buildable.

---

## Phase 2 — Claim-to-Evidence Gate (CRITICAL)

**Goal**: every changelog claim must map to shipped evidence.

For each planned changelog bullet, prepare evidence triplet:
1. Spec reference (requirement/scenario path)
2. Code reference (commit + file path)
3. Verification reference (unit/integration/e2e)

Use this checklist format while drafting release note bullets:

```text
[ ] Claim text
    - Spec: openspec/changes/.../specs/.../spec.md#Requirement: ...
    - Code: <commit> <file1,file2>
    - Tests: <test target or CI job>
    - Surface: internal-api | opencode-tool | hook-driven
```

**Hard rule**: if a claim is user-facing (tool/hook behavior), it MUST include integration/e2e evidence.

---

## Phase 3 — Operability Gate (CRITICAL)

**Goal**: prevent "implemented but not usable" releases.

If a claim says user can use a feature:
- verify runtime entrypoint exists (`hooks.tool` or explicit event hook path)
- verify this entrypoint is exercised by tests

Suggested checks:

```bash
# list exposed tools (example pattern)
rg "^[[:space:]]*[a-z0-9_]+:\s*tool\(" src/index.ts

# ensure claimed symbol is reachable from runtime wiring
rg "<claimed_method_or_feature_keyword>" src/index.ts src/**/*.ts test/**/*.ts
```

If feature is internal-only, changelog wording must explicitly say "internal API/foundation; not exposed as tool".

---

## Phase 4 — Version & Changelog

```bash
# After gates pass, update version and changelog
# package.json version
# CHANGELOG.md: only claims with evidence
```

Commit message format:
```
chore: bump version to X.Y.Z and update changelog
```

---

## Phase 5 — Release Branch

```bash
git checkout main
git pull origin main
git checkout -b release/vX.Y.Z
git push origin release/vX.Y.Z -u
```

---

## Phase 6 — PR to Main

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

### CLAIM DRIFT CHECK (CRITICAL)

Before merge, re-check release note bullets against branch content:

```bash
# check that each referenced file/area actually changed
git diff main..release/vX.Y.Z -- CHANGELOG.md src/ test/ openspec/
```

If changelog mentions a capability without matching code/tests in the PR, fix changelog or add missing implementation before merge.

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

### Why squash merge can look "diverged" (expected topology)

`--squash` creates a new commit on `main`, so original commits from `release/vX.Y.Z` are not direct ancestors of `main`.
This can look like divergence in commit history even when release content is already shipped.

Use content checks (not commit shape) to decide if this is safe:

```bash
git diff --stat main..release/vX.Y.Z
```

- Empty diff (or only expected metadata differences): usually safe and already represented on `main`
- Non-empty diff in `src/`, `test/`, or `openspec/`: investigate before proceeding

### Phase 6.5 — Branch Cleanup Verification (CRITICAL)

After merge, verify the release branch was actually deleted on remote.
`--delete-branch` can fail silently (for example due to protection rules or permissions).

```bash
git fetch --prune
if git branch -r | grep -q "origin/release/vX.Y.Z"; then
  echo "ERROR: origin/release/vX.Y.Z still exists. Delete it before declaring release done."
  echo "Run: git push origin --delete release/vX.Y.Z"
  exit 1
fi
```

### IMPORTANT: Never use git stash during release

**Why**: Stashing before rebase can cause code changes to be lost:
1. `git stash` hides uncommitted changes
2. `git rebase` may skip commits already on remote
3. `git stash pop` restores working directory but changes are uncommitted

**If you have uncommitted changes**: Commit them before any rebase operations.

**If you must rebase**: Use `git reset --hard` to discard local changes first, OR commit them before rebasing.

### Divergence Recovery: reset vs rebase

Choose by intent:

| Situation | Preferred command | Why |
|---|---|---|
| You only want local `main` to match remote authority | `git fetch origin && git reset --hard origin/main` | Fastest and least ambiguous recovery |
| You must keep local, unpushed commits and replay on top of latest remote | `git pull --rebase origin main` | Preserves your local work with linear history |

Hard rule for release flow:
- Never run rebase with uncommitted changes
- Never use stash as a release transport mechanism
- If uncertain, reset local `main` to `origin/main` and restart from a clean release branch

---

## Phase 7 — Tag and Trigger CI Release

**Tag timing rule (CRITICAL):**
- Never tag from a commit that only bumps version/changelog while feature commit is still ahead/behind.
- Tag must point to the already-merged commit that includes real implementation + tests.

### VERIFY CODE IS COMMITTED (CRITICAL)

Before tagging, confirm all changes are committed:

```bash
# Check that tag delta contains expected implementation and tests
git log vX.Y.Z-1..HEAD --oneline
git diff --name-only vX.Y.Z-1..HEAD

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

## Phase 8 — Post-Release Verification

```bash
# Confirm npm version is live
npm view lancedb-opencode-pro name version

# Confirm GitHub Release exists with .tgz asset
gh release view vX.Y.Z --repo tryweb/lancedb-opencode-pro
```

Both must succeed before declaring the release complete.

---

## Phase 8.5 — Release Correctness Verification (CRITICAL)

After tagging, verify the release contains all intended changes:

```bash
# Compare with previous version tag
git log vX.Y.Z-1..vX.Y.Z --oneline

# Check file changes are included
git diff vX.Y.Z-1..vX.Y.Z --stat
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
docker compose exec -T -u root opencode-dev sh -lc \
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
docker compose exec opencode-dev npm run release:check

# Optional staging verification (Phase 3 operability)
./scripts/verify-staging.sh

# Phase 2-3 — evidence and operability checks
rg "^[[:space:]]*[a-z0-9_]+:\s*tool\(" src/index.ts
git diff --name-only main..HEAD

# Phase 4 — version bump
# Edit package.json + CHANGELOG.md, then:
git add package.json CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z and update changelog"

# Phase 5 — release branch
git checkout -b release/vX.Y.Z
git push origin release/vX.Y.Z

# Phase 6 — PR + merge
gh pr create --title "chore: release vX.Y.Z" --base main --head release/vX.Y.Z
gh pr merge <PR_NUMBER> --squash --delete-branch
git checkout main && git pull origin main

# Phase 6.5 — remote branch cleanup verification
git fetch --prune
git branch -r | grep "origin/release/vX.Y.Z" && git push origin --delete release/vX.Y.Z

# Phase 7 — tag
git tag vX.Y.Z HEAD
git push origin vX.Y.Z
gh run list --workflow=ci.yml --limit=3

# Phase 8 — verify
npm view lancedb-opencode-pro version
gh release view vX.Y.Z --repo tryweb/lancedb-opencode-pro
```

---

## Release Definition of Done (DoD)

Release can be declared complete only if all are true:

1. `docker compose exec opencode-dev npm run release:check` passed
2. Every changelog bullet has spec/code/test evidence
3. Any user-facing bullet has runtime entrypoint proof (`hooks.tool`/hook path)
4. Tag points to merged implementation commit, not version-only commit
5. Post-release verification confirms npm + GitHub Release
6. `origin/release/vX.Y.Z` has been deleted (or explicitly cleaned up and pruned)
