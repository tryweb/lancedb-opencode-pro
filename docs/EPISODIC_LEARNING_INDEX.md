# Episodic Learning Scope Analysis — Documentation Index

**Analysis Date**: March 28, 2026  
**Project**: lancedb-opencode-pro  
**Scope**: Release B (BL-003, BL-014-020)

---

## Quick Navigation

### 📋 Start Here
- **[episodic-learning-summary.txt](episodic-learning-summary.txt)** — 217 lines
  - Executive summary with key findings
  - Capabilities matrix
  - Implementation status checklist
  - Testable requirements (quoted from specs)
  - Scope boundaries

### 📊 Detailed Analysis
- **[episodic-learning-scope-analysis.md](episodic-learning-scope-analysis.md)** — 649 lines
  - Complete artifact file listing
  - Spec requirements with full quotes
  - Implementation status by BL item
  - Testable requirements with assertions
  - Integration points and data storage
  - Confidence assessment

### 📁 Artifact Reference
- **[episodic-learning-artifacts.txt](episodic-learning-artifacts.txt)** — 370 lines
  - OpenSpec change directory structure
  - File-by-file artifact listing
  - Key spec requirements (quoted)
  - Implementation file references
  - Verification checklist

---

## Key Finding

**All episodic learning capabilities are INTERNAL APIs ONLY.**

No new MCP tools or user-facing commands are promised. The system:
- ✅ Automatically captures task episodes from session events
- ✅ Automatically classifies failures and extracts patterns
- ✅ Automatically suggests retry strategies
- ✅ Injects suggestions through existing memory injection mechanisms

---

## Three OpenSpec Changes

### 1. add-episodic-task-schema (BL-003)
**Status**: ✅ COMPLETE

Provides foundational schema for task episode records:
- `EpisodicTaskRecord` interface with task states and failure types
- `episodic_tasks` database table
- CRUD methods: `createTaskEpisode`, `updateTaskState`, `getTaskEpisode`, `queryTaskEpisodes`

**Location**: `openspec/changes/archive/2026-03-28-add-episodic-task-schema/`

### 2. add-task-episode-learning (BL-014-018)
**Status**: ✅ COMPLETE

Implements episode capture and learning:
- **BL-014**: Task episode capture on session start/command/completion
- **BL-015**: Validation outcome parsing (type/build/test)
- **BL-016**: Failure taxonomy classification (5 categories)
- **BL-017**: Success pattern extraction with confidence scoring
- **BL-018**: Similar task recall with 0.85 similarity threshold

**Location**: `openspec/changes/archive/2026-03-28-add-task-episode-learning/`

### 3. add-retry-recovery-evidence (BL-019-020)
**Status**: ✅ COMPLETE

Implements retry/recovery intelligence:
- **BL-019**: Retry attempt tracking and recovery strategy recording
- **BL-020**: Retry budget suggestion (median-based)
- **BL-020**: Stop condition detection
- **BL-020**: Strategy switching suggestions with confidence

**Location**: `openspec/changes/archive/2026-03-28-add-retry-recovery-evidence/`

---

## Capabilities Matrix

| Capability | BL | Type | Tool? | Internal? |
|---|---|---|---|---|
| Episodic Task Schema | BL-003 | Data Model | ❌ | ✅ |
| Task Episode Capture | BL-014 | Event Handler | ❌ | ✅ |
| Validation Outcome Ingestion | BL-015 | Parser | ❌ | ✅ |
| Failure Taxonomy | BL-016 | Classifier | ❌ | ✅ |
| Success Pattern Extraction | BL-017 | Analyzer | ❌ | ✅ |
| Similar Task Recall | BL-018 | Search | ❌ | ✅ |
| Retry/Recovery Evidence | BL-019 | Data Model | ❌ | ✅ |
| Retry Budget Suggestion | BL-020 | Suggester | ❌ | ✅ |
| Strategy Switching | BL-020 | Suggester | ❌ | ✅ |

---

## Implementation Files

### Type Definitions
- **src/types.ts** (lines 280-349)
  - `TaskState`, `FailureType`, `ValidationType`, `ValidationStatus`
  - `ValidationOutcome`, `SuccessPattern`, `RetryAttempt`, `RecoveryStrategy`
  - `RetryBudgetSuggestion`, `StrategySuggestion`, `EpisodicTaskRecord`

### Store Methods
- **src/store.ts**
  - `episodic_tasks` table definition
  - `createTaskEpisode()`, `updateTaskState()`, `getTaskEpisode()`, `queryTaskEpisodes()`
  - `extractSuccessPatternsFromScope()`, `suggestRetryBudget()`

### Plugin Integration
- **src/index.ts**
  - Event hooks: `session.idle`, `session.compacted`
  - Memory injection: `experimental.chat.system.transform`
  - 17 memory tools (no new tools for episodic learning)

---

## Testable Requirements

### BL-003: Episodic Task Schema (4 requirements)
1. Task episode creation with state "running"
2. Task state transitions (pending → running → success/failed/timeout)
3. Failure classification (syntax/runtime/logic/resource/unknown)
4. Task episode retrieval by scope and state

### BL-014: Task Episode Capture (3 requirements)
1. Episode creation on session start with state "pending"
2. Command recording during execution
3. Task completion with end timestamp and final state

### BL-015: Validation Outcome Ingestion (4 requirements)
1. Type check result parsing (pass/fail with error count)
2. Build result parsing (pass/fail)
3. Test result parsing (pass/fail counts)
4. Integration with task episode records

### BL-016: Failure Taxonomy (5 requirements)
1. Syntax error classification (SyntaxError, unexpected token)
2. Runtime error classification (JavaScript Error, Python Exception)
3. Logic error classification (assertion failures)
4. Resource error classification (OutOfMemory, ETIMEDOUT, ECONNREFUSED)
5. Unknown error classification (unmatched patterns)

### BL-017: Success Pattern Extraction (3 requirements)
1. Command sequence extraction from successful episodes
2. Tool/approach extraction (jest, prettier, etc.)
3. Confidence scoring (0.8+ for 5+ occurrences)

### BL-018: Similar Task Recall (3 requirements)
1. Similar task search with 0.85 similarity threshold
2. Context provision (commands, validation outcomes, state)
3. Configurable similarity threshold

### BL-019: Retry/Recovery Evidence (3 requirements)
1. Retry attempt recording with attempt number and outcome
2. Recovery strategy recording
3. Query by error type

### BL-020: Retry Budget Suggestion (6 requirements)
1. Budget suggestion based on median history
2. Stop condition detection (all retries failed with same error)
3. Minimum sample threshold (3 examples required)
4. Fallback strategy suggestion
5. Backoff strategy suggestion (exponential)
6. Confidence scoring for strategies

---

## Scope Boundaries

### INCLUDED (All promised in specs)
✅ Task episode schema and CRUD operations  
✅ Validation outcome parsing (type/build/test)  
✅ Failure classification (5 categories)  
✅ Success pattern extraction (commands, tools, confidence)  
✅ Similar task recall (vector-based, 0.85 threshold)  
✅ Retry attempt tracking  
✅ Recovery strategy recording  
✅ Retry budget suggestion (median-based)  
✅ Stop condition detection  
✅ Strategy switching suggestions  

### NOT INCLUDED (Explicitly excluded from scope)
❌ New MCP tools or user-facing commands  
❌ Automatic retry execution (suggestions only)  
❌ Complex workflow orchestration  
❌ ML-based pattern extraction (rule-based only)  
❌ Multi-task dependency graphs  
❌ Automatic recovery actions  
❌ Direct execution control  

---

## Confidence Assessment

| Aspect | Confidence | Evidence |
|--------|-----------|----------|
| **Spec Requirements** | HIGH | All 8 BL items have detailed spec.md files with test scenarios |
| **Implementation Status** | HIGH | Types, store methods, and data structures are implemented |
| **Tool Exposure** | HIGH | Specs explicitly state "suggestions only", no new tools promised |
| **Integration Points** | MEDIUM | Design docs reference event hooks, but actual integration code not fully reviewed |
| **Test Coverage** | MEDIUM | Tasks.md shows unit tests complete, but integration tests partially incomplete |
| **Database Schema** | HIGH | `episodic_tasks` table defined with all required fields |

---

## How to Use These Documents

### For Quick Understanding
1. Read **episodic-learning-summary.txt** (5 min)
2. Review the **Capabilities Matrix** above
3. Check **Scope Boundaries** section

### For Implementation Verification
1. Read **episodic-learning-artifacts.txt** (10 min)
2. Cross-reference with implementation files listed
3. Use **Verification Checklist** to validate

### For Detailed Analysis
1. Read **episodic-learning-scope-analysis.md** (20 min)
2. Review **Testable Requirements** section
3. Check **Integration Points** and **Data Storage**

### For Spec Compliance
1. Use **Testable Requirements** section
2. Reference quoted requirements from specs
3. Verify against implementation files

---

## References

**OpenSpec Changes**:
- `openspec/changes/archive/2026-03-28-add-episodic-task-schema/`
- `openspec/changes/archive/2026-03-28-add-task-episode-learning/`
- `openspec/changes/archive/2026-03-28-add-retry-recovery-evidence/`

**Implementation Files**:
- `src/types.ts` (lines 280-349)
- `src/store.ts` (episodic_tasks table and methods)
- `src/index.ts` (plugin hooks and tool definitions)

**Backlog Index**:
- `docs/backlog.md` (Release B definition, lines 99-100)

---

**Analysis Date**: March 28, 2026  
**Project**: lancedb-opencode-pro  
**Status**: ✅ COMPLETE
