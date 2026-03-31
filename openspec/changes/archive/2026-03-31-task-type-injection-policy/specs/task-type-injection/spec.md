# Spec: Task-Type Aware Injection

## Requirement

The system SHALL detect task type from session context and apply task-type specific injection profiles.

### Requirement: Task type detection is operable via runtime surface

Runtime Surface: internal-api  
Entrypoint: `index.ts:detectTaskType()` or `index.ts:system.transform` hook

#### Scenario: Task type detected from query keywords
- **GIVEN** user query contains coding-related keywords ("bug", "error", "function", "refactor")
- **WHEN** memory injection occurs
- **THEN** task type SHOULD be detected as "coding"
- **AND** coding-specific injection profile SHOULD be applied

#### Scenario: Task type detected from documentation keywords
- **GIVEN** user query contains docs-related keywords ("document", "readme", "explain", "describe")
- **WHEN** memory injection occurs
- **THEN** task type SHOULD be detected as "documentation"

#### Scenario: Unknown task type defaults to general
- **GIVEN** user query does not match any known task type patterns
- **WHEN** memory injection occurs
- **THEN** task type SHOULD default to "general"

---

## Requirement

The system SHALL apply task-type specific injection profiles with different memory limits and budgets.

### Requirement: Injection profiles per task type are operable

Runtime Surface: internal-api  
Entrypoint: `summarize.ts:calculateInjectionLimit()`, `config.ts:resolveInjectionConfig()`

#### Scenario: Coding task uses more memories with code-focused summarization
- **GIVEN** task type is "coding"
- **WHEN** injection limit is calculated
- **THEN** maxMemories SHOULD be 4 (vs default 3)
- **AND** budgetTokens SHOULD be 5120 (vs default 4096)
- **AND** summaryTargetChars SHOULD be 400

#### Scenario: Documentation task prioritizes longer summaries
- **GIVEN** task type is "documentation"
- **WHEN** injection configuration is applied
- **THEN** summaryTargetChars SHOULD be 500 (vs default 300)
- **AND** maxMemories SHOULD be 3

#### Scenario: Release task uses higher budget
- **GIVEN** task type is "release"
- **WHEN** injection configuration is applied
- **THEN** budgetTokens SHOULD be 6144
- **AND** maxMemories SHOULD be 4

---

## Requirement

The system SHALL weight memory categories differently based on task type.

### Requirement: Category weighting per task type is operable

Runtime Surface: internal-api  
Entrypoint: `index.ts:calculateCategoryWeights()`

#### Scenario: Coding task prioritizes decision and pattern memories
- **GIVEN** task type is "coding"
- **WHEN** memories are ranked for injection
- **THEN** memories with category "decision" SHOULD receive higher weight
- **AND** memories with category "pattern" SHOULD receive higher weight

#### Scenario: Documentation task prioritizes fact and decision memories
- **GIVEN** task type is "documentation"
- **WHEN** memories are ranked for injection
- **THEN** memories with category "fact" SHOULD receive higher weight
- **AND** memories with category "decision" SHOULD receive higher weight

---

## Requirement

The system SHALL provide configuration for task-type profiles.

### Requirement: Task-type profiles are configurable

Runtime Surface: internal-api (config)  
Entrypoint: `config.ts:resolveInjectionConfig()`

#### Scenario: Custom profile via environment variable
- **GIVEN** env var `LANCEDB_OPENCODE_PRO_INJECTION_CODING_MAX_MEMORIES` is set to 5
- **WHEN** injection config is resolved
- **THEN** coding task maxMemories SHOULD be 5

#### Scenario: Custom profile via config file
- **GIVEN** config contains `{"injection": {"taskTypeProfiles": {"coding": {"maxMemories": 6}}}`
- **WHEN** injection config is resolved
- **THEN** coding task maxMemories SHOULD be 6

---

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required |
|-------------|------|------------|-----|----------|
| Task type detection | ✅ | ✅ | - | yes |
| Injection profiles per type | ✅ | ✅ | - | yes |
| Category weighting | ✅ | ✅ | - | yes |
| Configuration options | ✅ | ✅ | - | yes |
| Backward compatibility | ✅ | ✅ | ✅ | yes |

---

## Acceptance Criteria

1. Task type is detected from query context (or defaults to "general")
2. Each task type has configurable injection profile
3. Memory categories can be weighted per task type
4. Configuration via env vars and config file works
5. Backward compatible when task-type profiles not configured
