---
name: backlog-to-openspec
description: Convert backlog items into implementation-ready OpenSpec changes with explicit runtime surface, acceptance criteria, and E2E verification requirements.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: tryweb
  version: "1.2"
  generatedBy: "manual"
---

# Backlog to OpenSpec — Implementable Spec Pipeline

Use this skill when backlog items are still high-level and you need a spec that engineers can implement and verify without ambiguity.

This skill prevents "spec says done, runtime not operable" drift.

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
openspec new change "<kebab-case-change-id>"
openspec status --change "<kebab-case-change-id>" --json
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

## Phase 3 — Write Proposal (What/Why)

In `proposal.md`, include:

- Problem statement linked to backlog IDs
- Why now (risk/cost of not doing)
- Scope and non-goals
- Impacted modules
- Release impact type (`internal-only` vs `user-facing`)

**Hard rule**: if proposal claims user-facing capability, it must later map to an explicit runtime entrypoint and e2e scenario.

---

## Phase 4 — Write Design (How)

In `design.md`, include mandatory decision table:

| Decision | Choice | Why | Trade-off |
|---|---|---|---|
| Runtime surface | internal-api / opencode-tool / hook-driven | ... | ... |
| Entrypoint | exact file + symbol/hook | ... | ... |
| Data model | table/record changes | ... | ... |
| Failure handling | retry/stop/escalate | ... | ... |
| Observability | logs/events/metrics | ... | ... |

Also add **Operability section**:
- Trigger path (how behavior is activated)
- Expected visible output
- Misconfiguration/failure behavior

---

## Phase 5 — Write Specs (Verifiable Requirements)

For each requirement in `specs/*/spec.md`, enforce:

1. Requirement sentence (`The system SHALL ...`)
2. Runtime Surface + Entrypoint note
3. Positive scenario(s)
4. Negative/error scenario(s)
5. Observability scenario (what can be inspected)

Example requirement extension pattern:

```text
### Requirement: Similar task recall is operable via runtime surface
The system SHALL recall similar tasks before execution.

Runtime Surface: hook-driven
Entrypoint: src/index.ts -> event hook "session.idle"

#### Scenario: Recall injected on threshold match
- WHEN ...
- THEN ...

#### Scenario: No recall when below threshold
- WHEN ...
- THEN ...
```

---

## Phase 6 — Build Tasks with Verification Matrix

In `tasks.md`, tasks must be atomic and include verification hooks:

```text
- [ ] Implement runtime wiring in src/index.ts (hook/tool registration)
- [ ] Implement core logic in src/store.ts
- [ ] Add unit tests for edge conditions
- [ ] Add integration test for runtime entrypoint
- [ ] Add e2e test for user-facing flow (if user-facing)
- [ ] Update changelog wording class (internal-only/user-facing)
```

Mandatory matrix (add to tasks.md or design.md):

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| R1 | ✅ | ✅ | n/a | yes |
| R2 (user-facing) | ✅ | ✅ | ✅ | yes |

---

## Phase 7 — Pre-Implementation Gate

Before implementation starts, verify the change is apply-ready:

```bash
openspec status --change "<id>"
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

---

## Quick Reference Commands

```bash
# 1) inspect backlog
rg "BL-" docs/backlog.md

# 2) create change
openspec new change "<change-id>"

# 3) create feature branch (IMPORTANT: do this before coding!)
git checkout -b "feat/<change-id>"
git push origin "feat/<change-id>" -u

# 4) inspect artifact state
openspec status --change "<change-id>" --json

# 5) inspect artifact instructions
openspec instructions proposal --change "<change-id>" --json
openspec instructions design --change "<change-id>" --json
openspec instructions tasks --change "<change-id>" --json

# 6) final readiness check
openspec status --change "<change-id>"
```

---

## Done Criteria

This skill is complete for a backlog item only when:

1. OpenSpec artifacts exist and are coherent
2. Runtime surface and entrypoint are explicit
3. Verification matrix includes required unit/integration/e2e
4. Changelog wording class is defined (`internal-only` / `user-facing`)
5. Feature branch is created and pushed (`feat/<change-id>`)
6. Change is ready for `/opsx-apply` implementation
