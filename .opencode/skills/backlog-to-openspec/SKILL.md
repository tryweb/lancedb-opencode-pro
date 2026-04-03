---
name: backlog-to-openspec
description: Convert backlog items into implementation-ready OpenSpec changes with explicit runtime surface, acceptance criteria, and E2E verification requirements.
license: MIT
compatibility: Requires openspec CLI at /home/devuser/.bun/bin/openspec.
metadata:
  author: tryweb
  version: "2.0"
  generatedBy: "manual"
---

# Backlog to OpenSpec — Implementable Spec Pipeline

Use this skill when backlog items are still high-level and you need a spec that engineers can implement and verify without ambiguity.

This skill prevents "spec says done, runtime not operable" drift.

**Key Design**: Uses `openspec instructions` to dynamically retrieve templates from the OpenSpec CLI, ensuring compatibility even when OpenSpec versions change.

---

## Input

Expected input contains one or more backlog items, for example:
- `BL-014 Task episode capture`
- a markdown table row from `docs/backlog.md`
- a short intent statement (feature/problem/outcome)

If backlog IDs are missing, derive a temporary change name and explicitly note assumptions.

---

## Output Contract

Produce an OpenSpec change with artifacts:
- `proposal.md` (problem/goal/scope)
- `design.md` (architecture and integration decisions)
- `specs/*/spec.md` (testable requirements + scenarios)
- `tasks.md` (atomic implementation and verification tasks)

And enforce these sections in artifacts:

1. **Runtime Surface**: `internal-api | opencode-tool | hook-driven`
2. **Entrypoint**: exact code path (`hooks.tool.<name>`, `event:<type>`, etc.)
3. **Operability**: how user/system can actually trigger/observe behavior
4. **Verification Matrix**: unit / integration / e2e mapping per requirement
5. **Changelog Wording Class**: `internal-only` or `user-facing`

---

## Phase 0 — Git Safety Gate (CRITICAL)

**Goal**: block unsafe branch operations before creating a new OpenSpec change.

Run this gate before `openspec new change`:

```bash
# Path to openspec in this environment
OPENSPEC="/home/devuser/.bun/bin/openspec"

# 1) working tree must be clean
git status --porcelain

# 2) identify current branch
git rev-parse --abbrev-ref HEAD

# 3) sync remote refs for branch safety checks
git fetch origin --prune
```

Pass conditions:
- `git status --porcelain` output is empty
- Current branch is `main` (preferred) or `feat/<existing-change-id>` when resuming existing work
- If resuming from `feat/<existing-change-id>`, branch has upstream (if not: `git push -u origin <branch>`)

Failure handling (hard rules):
- **Dirty tree**: commit changes or intentionally discard with `git reset --hard`
- **Never use `git stash` as workflow transport**
- **Wrong starting branch**: switch to `main` and sync first

```bash
git checkout main
git pull origin main
```

### Failure Mode → Remediation

| Failure mode | Detect with | Safe remediation |
|---|---|---|
| Dirty tree | `git status --porcelain` not empty | `git add -A && git commit -m "wip: ..."` OR intentional `git reset --hard` |
| Missing upstream | `git rev-parse --abbrev-ref --symbolic-full-name @{upstream}` fails | `git push -u origin <current-branch>` |
| Wrong base branch | `git rev-parse --abbrev-ref HEAD` is not `main`/`feat/*` | `git checkout main && git pull origin main` |

## Phase 1 — Backlog Normalization

1. Locate source backlog context.

```bash
rg "BL-0|BL-1|BL-2|BL-3" docs/backlog.md
```

2. Convert each backlog item into a normalized card:

```text
- ID:
- Title:
- User/Operator outcome:
- Scope boundaries (in/out):
- Risk level:
```

3. Group items into one coherent change only if they share one goal.
   If they are independent, split into separate changes.

---

## Phase 2 — Create OpenSpec Change Scaffold

```bash
# Path to openspec in this environment
OPENSPEC="/home/devuser/.bun/bin/openspec"

# Create change
$OPENSPEC new change "<kebab-case-change-id>"

# Verify status
$OPENSPEC status --change "<kebab-case-change-id>" --json
```

If a related archived change already exists, reuse patterns but do not copy stale assumptions.

---

## Phase 2.5 — Create Feature Branch (CRITICAL)

**Goal**: Keep code and specs together in the same branch for atomic commits.

After creating the OpenSpec change, immediately create a feature branch:

```bash
# Use the same change ID for consistency
CHANGE_ID="<kebab-case-change-id>"

# Create and push feature branch
git checkout -b "feat/${CHANGE_ID}"
git push origin "feat/${CHANGE_ID}" -u
```

**Why this matters**:
- Code and OpenSpec artifacts stay together in the same branch
- Enables atomic commits (code + specs in one commit)
- Aligns with `release-workflow` which expects feature work on branches

**Branch naming convention**:
- Features: `feat/<change-id>`
- Fixes: `fix/<change-id>`
- Chores: `chore/<change-id>`

**If working tree is dirty**:
- Commit current changes first (or intentionally discard with `git reset --hard`)
- Never use `git stash` as branch transport
- Never mix unrelated work in the same branch

---

## Phase 3 — Write Proposal (What/Why) using Dynamic Template

**CRITICAL**: Use `openspec instructions` to get the latest template instead of hardcoding.

```bash
OPENSPEC="/home/devuser/.bun/bin/openspec"
CHANGE_ID="<kebab-case-change-id>"

# Get dynamic instructions and template
$OPENSPEC instructions proposal --change "$CHANGE_ID" --json
```

This returns JSON with:
- `instruction`: Schema-specific guidance
- `template`: The template to use for the output file

**Steps**:

1. Run `$OPENSPEC instructions proposal --change "$CHANGE_ID" --json`
2. Read the `template` field - this is your structure
3. Fill in the template using Phase 1 analysis
4. Write to `openspec/changes/<change-id>/proposal.md`

**The template will look something like**:

```markdown
## Why

<!-- Explain the motivation for this change. What problem does this solve? Why now? -->

## What Changes

<!-- Describe what will change. Be specific about new capabilities, modifications, or removals. -->

## Capabilities

### New Capabilities
- `<name>`: <brief description of what this capability covers>

### Modified Capabilities
- <existing-capability>: <what requirement is changing>

## Impact

<!-- Affected code, APIs, dependencies, systems -->
```

**Key guidance from `instruction`**:
- Focus on "why" not "how" - implementation details belong in design.md
- Keep it concise (1-2 pages)
- The Capabilities section is critical - it creates the contract between proposal and specs

---

## Phase 4 — Write Design (How) using Dynamic Template

**CRITICAL**: Use `openspec instructions` to get the latest template.

```bash
OPENSPEC="/home/devuser/.bun/bin/openspec"
CHANGE_ID="<kebab-case-change-id>"

# Get dynamic instructions and template
$OPENSPEC instructions design --change "$CHANGE_ID" --json
```

**Steps**:

1. Run `$OPENSPEC instructions design --change "$CHANGE_ID" --json`
2. Read the `template` field
3. Read the proposal you just created (`proposal.md`) for context
4. Fill in the template
5. Write to `openspec/changes/<change-id>/design.md`

**The template will look something like**:

```markdown
## Context

<!-- Background and current state -->

## Goals / Non-Goals

**Goals:**
<!-- What this design aims to achieve -->

**Non-Goals:**
<!-- What is explicitly out of scope -->

## Decisions

<!-- Key design decisions and rationale -->

## Risks / Trade-offs

<!-- Known risks and trade-offs -->
```

---

## Phase 5 — Write Specs (Verifiable Requirements) using Dynamic Template

**CRITICAL**: This is where we MUST use dynamic templates. Run:

```bash
OPENSPEC="/home/devuser/.bun/bin/openspec"
CHANGE_ID="<kebab-case-change-id>"

# Get dynamic instructions and template for specs
$OPENSPEC instructions specs --change "$CHANGE_ID" --json
```

**Steps**:

1. Run `$OPENSPEC instructions specs --change "$CHANGE_ID" --json`
2. Read the `template` field - **this is the authoritative format**
3. Read `proposal.md` to identify capabilities (from Capabilities section)
4. For each capability, create `specs/<capability-name>/spec.md`

**The template will look something like**:

```markdown
## ADDED Requirements

### Requirement: <!-- requirement name -->
<!-- requirement text -->

#### Scenario: <!-- scenario name -->
- **WHEN** <!-- condition -->
- **THEN** <!-- expected outcome -->
```

**Key rules from `instruction`** (IMPORTANT - follow these, not hardcoded rules):

1. Use `## ADDED Requirements` (or MODIFIED/REMOVED/RENAMED) as delta header
2. Each requirement: `### Requirement: <name>` followed by description
3. Use SHALL/MUST for normative requirements
4. **Each scenario MUST use exactly 4 hashtags (`####`)** - Using 3 will fail validation
5. Every requirement MUST have at least one scenario

**Example from the instruction**:

```markdown
## ADDED Requirements

### Requirement: User can export data
The system SHALL allow users to export their data in CSV format.

#### Scenario: Successful export
- **WHEN** user clicks "Export" button
- **THEN** system downloads a CSV file with all user data
```

---

## Phase 6 — Build Tasks with Verification Matrix using Dynamic Template

**CRITICAL**: Use `openspec instructions` to get the latest template.

```bash
OPENSPEC="/home/devuser/.bun/bin/openspec"
CHANGE_ID="<kebab-case-change-id>"

# Get dynamic instructions and template for tasks
$OPENSPEC instructions tasks --change "$CHANGE_ID" --json
```

**Steps**:

1. Run `$OPENSPEC instructions tasks --change "$CHANGE_ID" --json`
2. Read the `template` field
3. Read all completed artifacts (proposal, design, specs) for context
4. Fill in the template with implementation tasks
5. Write to `openspec/changes/<change-id>/tasks.md`

**The template will look something like**:

```markdown
## 1. <!-- Task Group Name -->

- [ ] 1.1 <!-- Task description -->
- [ ] 1.2 <!-- Task description -->

## 2. <!-- Task Group Name -->

- [ ] 2.1 <!-- Task description -->
- [ ] 2.2 <!-- Task description -->
```

**Include Verification Matrix**:

Add this table to tasks.md or design.md:

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| R1 | ✅ | ✅ | n/a | yes |
| R2 (user-facing) | ✅ | ✅ | ✅ | yes |

---

## Phase 6.5 — Validate Specs with OpenSpec CLI (CRITICAL)

**Goal**: Verify spec format matches OpenSpec requirements before considering the change complete.

After writing all artifacts, run validation:

```bash
# Path to openspec in this environment
OPENSPEC="/home/devuser/.bun/bin/openspec"

# Validate the change
$OPENSPEC validate "<change-id>"
```

**Common Validation Errors and Fixes**

The instruction from `openspec instructions specs` should guide you, but common issues:

#### Error: "No delta sections found"

**Problem**: Specs must use delta headers (`## ADDED/MODIFIED/REMOVED/RENAMED Requirements`).

**Fix**: Wrap requirements under appropriate delta header (the template will have this already).

#### Error: "must include at least one scenario"

**Problem**: Each requirement must have at least one `#### Scenario:` block.

**Fix**: Ensure scenario headers are at 4 hash level (`####`) not 3 (`###`).

### Validation Workflow

```bash
# 1) Initial validation
$OPENSPEC validate "<change-id>"

# 2) If errors, fix them and re-validate
# 3) Repeat until validation passes
# 4) Final status check
$OPENSPEC status --change "<change-id>"
```

**Pass condition**: `Change '<change-id>' is valid`

---

## Phase 7 — Pre-Implementation Gate

Before implementation starts, verify the change is apply-ready:

```bash
$OPENSPEC status --change "<change-id>"
```

Checklist:
- No ambiguous requirement wording
- Every user-facing claim has runtime entrypoint + e2e requirement
- Every internal-only claim is explicitly marked internal
- tasks include both implementation and verification

If any item is missing, revise artifacts before coding.

---

## Changelog Policy (Built-in)

When drafting release notes from this change:

- `internal-only`: wording must explicitly say internal/foundation/not exposed as tool
- `user-facing`: wording allowed only after integration/e2e evidence passes

Never publish changelog bullets that cannot be executed by users/operators.

---

## Guardrails

- Do not mark a backlog item done based only on store/API implementation.
- Do not allow "SHALL support" without surface/entrypoint/verification details.
- Do not collapse independent backlog goals into one oversized change.
- Do not skip negative scenarios for failure behavior.
- Do not produce user-facing claims without e2e tests.
- **ALWAYS use `openspec instructions` to get dynamic templates** - never hardcode templates in this skill.

---

## Quick Reference Commands

```bash
# Path to openspec in this environment
OPENSPEC="/home/devuser/.bun/bin/openspec"

# 1) inspect backlog
rg "BL-" docs/backlog.md

# 2) create change
$OPENSPEC new change "<change-id>"

# 3) create feature branch (IMPORTANT: do this before coding!)
git checkout -b "feat/<change-id>"
git push origin "feat/<change-id>" -u

# 4) Get dynamic instructions for each artifact and write them

# For proposal:
$OPENSPEC instructions proposal --change "<change-id>" --json

# For design:
$OPENSPEC instructions design --change "<change-id>" --json

# For specs:
$OPENSPEC instructions specs --change "<change-id>" --json

# For tasks:
$OPENSPEC instructions tasks --change "<change-id>" --json

# 5) VALIDATE SPECS (CRITICAL - must pass before continuing!)
$OPENSPEC validate "<change-id>"
# If errors, fix them and re-validate until passes

# 6) final readiness check (should show all 4 artifacts complete)
$OPENSPEC status --change "<change-id>"
```

---

## Done Criteria

This skill is complete for a backlog item only when:

1. OpenSpec artifacts exist and are coherent
2. Runtime surface and entrypoint are explicit
3. Verification matrix includes required unit/integration/e2e
4. Changelog wording class is defined (`internal-only` / `user-facing`)
5. Feature branch is created and pushed (`feat/<change-id>`)
6. **Spec validation passes**: `openspec validate "<change-id>"` returns "is valid"
7. Change is ready for `/opsx-apply` implementation
