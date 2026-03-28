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
2. **Create OpenSpec Change** — Runs `openspec new change "<id>"`
3. **Create Feature Branch** — Creates `feat/<change-id>` branch and pushes to origin ⭐
4. **Write Proposal** — Documents problem, goal, scope
5. **Write Design** — Architecture decisions, runtime surface, entrypoint
6. **Write Specs** — Testable requirements with scenarios
7. **Build Tasks** — Atomic implementation tasks with verification matrix

**Output:**
- OpenSpec artifacts in `.opencode/changes/<change-id>/`
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
- Specs: .opencode/changes/<change-id>/specs/
- Tasks: .opencode/changes/<change-id>/tasks.md
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

1. **Local Preparation** — Run `npm run release:check` in Docker
2. **Claim-to-Evidence Gate** — Verify every changelog claim has evidence
3. **Operability Gate** — Verify user-facing features have runtime entrypoints
4. **Version & Changelog** — Update `package.json` and `CHANGELOG.md`
5. **Release Branch** — Create `release/vX.Y.Z` branch
6. **PR to Main** — Create PR with pre-merge checks
7. **Tag and Trigger CI** — Push tag to trigger npm publish
8. **Post-Release Verification** — Confirm npm + GitHub Release

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
| OpenSpec changes | `.opencode/changes/<change-id>/` |
| Release notes | `CHANGELOG.md` |
| Package config | `package.json` |

---

## Troubleshooting

### "Working tree is dirty"

Either:
1. Stash changes: `git stash`
2. Commit changes: `git add . && git commit`

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
