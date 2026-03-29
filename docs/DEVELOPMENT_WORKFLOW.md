# Development Workflow Guide

**Last Updated**: March 2026  
**Status**: Active  
**Prerequisites**: OpenCode CLI, Git, GitHub CLI, Docker

---

## Overview

This project uses a standardized development workflow based on two OpenCode skills:

1. **`backlog-to-openspec`** — Converts backlog items into implementation-ready specifications
2. **`release-workflow`** — Handles npm release with anti-drift gates

Both skills are designed to keep code and specifications synchronized in the same git branch.

### When to Use Which Workflow

| Your Task | Use This | Branch |
|-----------|----------|--------|
| New feature from backlog | `backlog-to-openspec` | `feat/<id>` |
| Bug fix | Direct `chore/` or `fix/` | `fix/<id>` |
| Infrastructure, tools, docs | Direct `chore/` | `chore/<desc>` |
| Publish to npm | `release-workflow` | `release/vX.Y.Z` |

---

## Prerequisites

Before starting development, ensure you have:

- [ ] OpenCode CLI installed (`1.2.27+`)
- [ ] Git configured with GitHub access
- [ ] GitHub CLI (`gh`) authenticated
- [ ] Docker and Docker Compose installed
- [ ] Node.js `24.x` (see `.nvmrc`)

Verify authentication:

```bash
npm whoami        # Should return your npm username
gh auth status   # Should show "Logged in to github.com"
```

---

## Shared Git Safety Gate (CRITICAL)

Run this gate **before** any feature or release operation.

```bash
# 1) Sync refs
git fetch origin --prune

# 2) Confirm current branch
git rev-parse --abbrev-ref HEAD

# 3) Working tree must be clean
git status --porcelain
```

### Pass Conditions

- For feature work: current branch is `main` (new work) or `feat/<change-id>` (resume work)
- For release work: current branch is `main`
- `git status --porcelain` output is empty

### Hard Rules

- **Never use `git stash` as workflow transport**
- If tree is dirty: commit changes, or intentionally discard with `git reset --hard`
- If upstream is missing: `git push -u origin <current-branch>`

### Failure Mode → Remediation

| Failure mode | Detect with | Safe remediation |
|---|---|---|
| Dirty tree | `git status --porcelain` not empty | `git add -A && git commit -m "wip: ..."` or intentional `git reset --hard` |
| Missing upstream | `git rev-parse --abbrev-ref --symbolic-full-name @{upstream}` fails | `git push -u origin <current-branch>` |
| Wrong base branch | branch is not expected for current phase | `git checkout main && git pull origin main` |
| Unmerged feature before release | `git branch -r --no-merged origin/main` includes intended `origin/feat/*` | Merge feature branch to main first |

---

## Development Workflow

### Phase 1: From Backlog to Implementation

Use this when you have a backlog item to implement.

```
┌─────────────────────┐
│ 1. backlog-to-openspec │
│    (use the skill)     │
└──────────┬────────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Feature Branch   │
│    Created + Pushed │
└──────────┬────────────┘
           │
           ▼
┌─────────────────────┐
│ 3. /opsx-apply      │
│    (implementation)  │
└──────────┬────────────┘
           │
           ▼
┌─────────────────────┐
│ 4. Commit + Push    │
│    (code + specs)   │
└──────────┬────────────┘
           │
           ▼
┌─────────────────────┐
│ 5. Create PR        │
│    (to main)        │
└──────────┬────────────┘
           │
           ▼
┌─────────────────────┐
│ 6. Merge + Cleanup  │
└─────────────────────┘
```

---

### Step 1: Use `backlog-to-openspec` Skill

Trigger the skill with your backlog item:

```
/backlog-to-openspec
```

When prompted, provide:
- Backlog ID (e.g., `BL-014`)
- Or a brief description of what you want to build

**What happens:**

1. **Backlog Normalization** — Parses and validates the backlog item
2. **Git Safety Gate** — Enforces clean tree + branch safety before change creation
3. **Create OpenSpec Change** — Runs `openspec new change "<id>"`
4. **Create Feature Branch** — Creates `feat/<change-id>` branch and pushes to origin ⭐
5. **Write Proposal** — Documents problem, goal, scope
6. **Write Design** — Architecture decisions, runtime surface, entrypoint
7. **Write Specs** — Testable requirements with scenarios
8. **Build Tasks** — Atomic implementation tasks with verification matrix

**Output:**
- OpenSpec artifacts in `openspec/changes/<change-id>/`
- Feature branch: `feat/<change-id>`

---

### Step 2: Verify Feature Branch

After the skill completes, confirm you're on the new branch:

```bash
git branch
# Should show: * feat/<change-id>
```

If not, switch manually:

```bash
git checkout feat/<change-id>
```

If working tree is dirty at this point:

```bash
# Option A: keep changes
git add -A && git commit -m "wip: save local changes"

# Option B: intentionally discard
git reset --hard
```

Do **not** use `git stash` in this workflow.

---

### Step 3: Implement with `/opsx-apply`

Start implementation:

```
/opsx-apply
```

This will:
- Read the tasks from `tasks.md`
- Guide you through each implementation task
- Verify completion as you go

---

### Step 4: Commit Changes

Keep code and specs together in atomic commits:

```bash
# Stage all changes (code + OpenSpec artifacts)
git add .

# Commit with descriptive message
git commit -m "feat: implement <change-id>

- Proposal: docs/...
- Design: docs/...
- Specs: openspec/changes/<change-id>/specs/
- Tasks: openspec/changes/<change-id>/tasks.md
- Code: src/...
- Tests: test/..."
```

**Why atomic commits matter:**
- Code and specifications stay synchronized
- Easier to rollback if needed
- Clear traceability from spec to implementation

---

### Step 5: Push and Create PR

```bash
# Push feature branch
git push origin feat/<change-id>

# Create PR to main
gh pr create \
  --title "feat: <change-id> - <description>" \
  --body "$(cat <<'EOF'
## Summary
- Brief description of changes

## Changes
- proposal.md: ...
- design.md: ...
- specs/: ...
- src/: ...

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass (if user-facing)
EOF
)" \
  --base main \
  --head feat/<change-id>
```

Wait for CI checks to pass, then merge.

---

### Step 6: Cleanup

After PR is merged:

```bash
# Switch to main and pull latest
git checkout main && git pull origin main

# Delete feature branch (optional)
git branch -d feat/<change-id>
```

---

## Release Workflow

When you're ready to publish a new version:

### Step 1: Use `release-workflow` Skill

```
/release-workflow
```

The skill will guide you through:

1. **Git Safety Gate** — Require clean tree + start from `main`
2. **Local Preparation** — Run `npm run release:check` in Docker
3. **Claim-to-Evidence Gate** — Verify every changelog claim has evidence
4. **Operability Gate** — Verify user-facing features have runtime entrypoints
5. **Version & Changelog** — Update `package.json` and `CHANGELOG.md`
6. **Release Branch** — Create `release/vX.Y.Z` branch
7. **PR to Main** — Create PR with pre-merge checks
8. **Branch Cleanup Verification** — Ensure remote `release/vX.Y.Z` branch is deleted/pruned
9. **Tag and Trigger CI** — Push tag to trigger npm publish
10. **Post-Release Verification** — Confirm npm + GitHub Release

Before release branch creation, verify no intended feature branch is left unmerged:

```bash
git fetch origin --prune
git checkout main && git pull origin main
git branch -r --no-merged origin/main
```

If output still includes intended `origin/feat/*`, merge those features first.

### Important: Squash merge topology is expected

The release workflow uses `--squash` for clean `main` history. This can make commit history look "diverged"
because original commits on `release/vX.Y.Z` are not direct ancestors of `main`.

Use content diff (not commit shape) as the safety check:

```bash
git diff --stat main..release/vX.Y.Z
```

- Empty (or only expected metadata differences): usually safe
- Non-empty in `src/`, `test/`, `openspec/`: investigate before release completion

### Divergence recovery quick rule: reset vs rebase

- Sync local `main` to remote authority (most common):

```bash
git fetch origin && git reset --hard origin/main
```

- Keep local, unpushed commits and replay on latest `main`:

```bash
git pull --rebase origin main
```

Release safety rules:
- Never rebase with uncommitted changes
- Never use stash as release transport
- If uncertain, reset local `main` to `origin/main` and restart from clean release branch

---

## Quick Reference

### Common Commands

```bash
# Start new feature
/backlog-to-openspec

# Implement
/opsx-apply

# Release
/release-workflow

# Check current branch
git branch

# Check status
git status --short

# Check unmerged branches before release
git branch -r --no-merged origin/main
```

### Branch Naming Convention

| Type | Format | Example | When to Use |
|------|--------|---------|-------------|
| Feature | `feat/<change-id>` | `feat/add-dedupe-consolidation` | New functionality (use `backlog-to-openspec`) |
| Fix | `fix/<change-id>` | `fix/memory-leak-fix` | Bug fixes |
| Chore | `chore/<description>` | `chore/update-skills-and-docs` | Infrastructure, tools, documentation, CI/CD |
| Release | `release/vX.Y.Z` | `release/v0.2.9` | Publishing to npm (use `release-workflow`) |

---

### Choosing the Right Workflow

Use **`backlog-to-openspec` → `feat/`** when:
- Implementing a new feature from the backlog
- Changes need specification documents
- Code and specs should stay synchronized

Use **`chore/`** directly when:
- Updating skills (`.opencode/skills/`)
- Updating documentation (`.md` files)
- CI/CD configuration changes (`.github/`, `docker-compose.yml`)
- Build/tooling updates
- No new specification artifacts needed
- Changes are self-explanatory and don't need OpenSpec artifacts

```bash
# Example: Updating skills documentation
git checkout -b chore/update-skills-and-docs
# ... make changes ...
git add . && git commit -m "chore: update skills and documentation"
git push origin chore/update-skills-and-docs -u
gh pr create --title "chore: update skills and documentation" --base main
```

---

### When to Use `backlog-to-openspec` vs. `chore/`

| Aspect | backlog-to-openspec (`feat/`) | chore/ |
|--------|------------------------------|--------|
| **Purpose** | New features from backlog | Infrastructure/tools/docs |
| **Specification** | Generates OpenSpec artifacts | Not needed |
| **Branch** | `feat/<change-id>` | `chore/<description>` |
| **Testing** | Unit/integration/e2e required | Project-dependent |
| **Examples** | Add deduplication, new memory tool | Update skill docs, fix CI, add linter |

If you're unsure, ask: "Does this need a specification document?" If no → use `chore/`.

### File Locations

| Purpose | Location |
|---------|----------|
| Backlog | `docs/backlog.md` |
| OpenSpec changes | `openspec/changes/<change-id>/` |
| Release notes | `CHANGELOG.md` |
| Package config | `package.json` |

---

## Troubleshooting

### "Working tree is dirty"

Either:
1. Commit changes: `git add . && git commit`
2. Or discard local changes intentionally: `git reset --hard`

For all workflows, do **not** use `git stash` as a transport mechanism.

### "Branch protection prevents push"

Always use feature branches. See "Branch Naming Convention" above.

### "CI checks failing"

Check the specific failure:
```bash
gh run list --limit=5
gh run view <run-id> --log
```

### "npm publish failed"

Common causes:
- `NPM_TOKEN` not set in GitHub Actions
- Version already exists
- TypeScript errors in build

See `release-workflow` skill for detailed troubleshooting.

---

## Related Documents

- `README.md` — Project overview and installation
- `docs/backlog.md` — Current backlog items
- `docs/operations.md` — Operational procedures
- `docs/release-readiness.md` — Release criteria
- `.opencode/skills/backlog-to-openspec/SKILL.md` — Full skill documentation
- `.opencode/skills/release-workflow/SKILL.md` — Full skill documentation

---

**Questions?** Open an issue or ask in the PR.
