# Design: Task-Type Aware Injection Policy

## Decision Table

| Decision | Choice | Why | Trade-off |
|----------|--------|-----|-----------|
| **Runtime surface** | internal-api | Improves existing injection - no new entrypoint needed | N/A |
| **Entrypoint** | `summarize.ts:calculateInjectionLimit()` | Centralized injection control | None |
| **Task type detection** | Session context + heuristics | Non-intrusive detection | May not always be accurate |
| **Profile storage** | Config file + env vars | Follows existing pattern | Additional config complexity |
| **Default fallback** | Use existing InjectionConfig | Backward compatible | N/A |

## Task Type Detection

### Detection Methods (in priority order)

1. **Explicit session property** (if available): `session.properties.taskType`
2. **Agent name heuristics**:
   - `coder`, `code`, `dev` → `coding`
   - `docs`, `document`, `write` → `documentation`
   - `review`, `reviewer` → `review`
   - `release`, `deploy` → `release`
   - Default: `general`

### Task Types

```typescript
type TaskType = "coding" | "documentation" | "review" | "release" | "general";
```

## Default Profiles

| Task Type | maxMemories | budgetTokens | summaryTargetChars | Priority Categories |
|-----------|-------------|--------------|-------------------|---------------------|
| coding | 4 | 5120 | 400 | decision, pattern, entity |
| documentation | 3 | 3072 | 500 | decision, fact, entity |
| review | 3 | 4096 | 300 | pattern, preference, decision |
| release | 4 | 6144 | 350 | decision, entity, fact |
| general | 3 | 4096 | 300 | decision, pattern, fact |

## Configuration

Add to existing `InjectionConfig`:

```typescript
interface InjectionConfig {
  // ... existing fields
  taskTypeProfiles: Record<TaskType, InjectionProfile>;
}

interface InjectionProfile {
  maxMemories: number;
  budgetTokens: number;
  summaryTargetChars: number;
  categoryWeights: Partial<Record<MemoryCategory, number>>;
}
```

Config options:
- `injection.taskTypeProfiles.<taskType>.maxMemories`
- `injection.taskTypeProfiles.<taskType>.budgetTokens`
- `injection.taskTypeProfiles.<taskType>.summaryTargetChars`
- `injection.taskTypeProfiles.<taskType>.categoryWeights.<category>`

Environment variables:
- `LANCEDB_OPENCODE_PRO_INJECTION_CODING_MAX_MEMORIES`
- `LANCEDB_OPENCODE_PRO_INJECTION_DOCUMENTATION_BUDGET_TOKENS`
- etc.

## Operability

### Trigger Path
1. Session idle/recall triggered
2. Task type detected from session context
3. Profile selected based on task type
4. Injection parameters applied from profile

### Expected Visible Output
- Coding tasks inject more memories with code patterns
- Documentation tasks get longer summaries
- Release tasks get deployment-related memories

### Misconfiguration
- Invalid task type → fallback to "general"
- Missing profile → fallback to defaults
- Invalid category weights → use equal weights

## Implementation Notes

### Category Weighting
When filtering/prioritizing memories, apply category weights:
```typescript
const categoryWeight = profile.categoryWeights[memory.category] ?? 1.0;
finalScore = baseScore * categoryWeight;
```

### Backward Compatibility
- Default `taskTypeProfiles` maintains exact current behavior
- Existing configs without task-type profiles use defaults
