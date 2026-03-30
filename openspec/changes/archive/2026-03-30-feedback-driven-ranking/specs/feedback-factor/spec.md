# Spec: Feedback Factor in Retrieval Scoring

## Requirement

The system SHALL calculate a feedback factor for each memory during retrieval, using historical feedback events to boost helpful memories and penalize unhelpful/wrong memories.

### Requirement: Feedback factor calculation is operable via runtime surface

Runtime Surface: internal-api  
Entrypoint: `store.ts:search()` called by `index.ts:memory_search` and auto-recall hooks

#### Scenario: Helpful feedback boosts memory ranking
- **GIVEN** a memory has received 3 "helpful" feedback events and 1 "unhelpful" feedback event
- **WHEN** the memory is retrieved via `memory_search`
- **THEN** the memory's feedback factor SHOULD be approximately 1.4 (40% boost)
- **AND** the memory SHOULD rank higher than a neutral memory with similar vector/BM25 scores

#### Scenario: Wrong feedback penalizes memory ranking
- **GIVEN** a memory has received 3 "wrong" feedback events
- **WHEN** the memory is retrieved via `memory_search`
- **THEN** the memory's feedback factor SHOULD be approximately 0.4 (60% penalty)
- **AND** the memory SHOULD rank lower than a neutral memory with similar vector/BM25 scores

#### Scenario: No feedback history uses neutral factor
- **GIVEN** a memory has no feedback events
- **WHEN** the memory is retrieved via `memory_search`
- **THEN** the memory's feedback factor SHOULD be 1.0 (neutral)
- **AND** the memory SHOULD NOT be penalized or boosted based on feedback

#### Scenario: Mixed feedback balances to neutral
- **GIVEN** a memory has received 2 "helpful" and 2 "unhelpful" feedback events
- **WHEN** the memory is retrieved via `memory_search`
- **THEN** the memory's feedback factor SHOULD be approximately 1.0 (neutral)

#### Scenario: Feedback with only unhelpful events
- **GIVEN** a memory has received 0 "helpful" and 2 "unhelpful" feedback events
- **WHEN** the memory is retrieved via `memory_search`
- **THEN** the memory's feedback factor SHOULD be less than 1.0 (penalized)

---

## Requirement

The system SHALL provide a configuration option to control feedback weight influence on retrieval scores.

### Requirement: Feedback weight configuration is operable

Runtime Surface: internal-api (config)  
Entrypoint: `config.ts:resolveRetrievalConfig()`

#### Scenario: Feedback disabled via config
- **GIVEN** `feedbackWeight` is set to 0.0
- **WHEN** memories are retrieved
- **THEN** all memories SHOULD receive a feedback factor of 1.0 regardless of their feedback history

#### Scenario: Strong feedback influence
- **GIVEN** `feedbackWeight` is set to 1.0
- **AND** a memory has 100% helpful rate with 0 wrong feedback
- **WHEN** the memory is retrieved
- **THEN** the feedback factor SHOULD be approximately 2.0 (100% boost)

#### Scenario: Configuration via environment variable
- **GIVEN** environment variable `LANCEDB_OPENCODE_PRO_FEEDBACK_WEIGHT` is set to 0.5
- **WHEN** the plugin loads configuration
- **THEN** `config.retrieval.feedbackWeight` SHOULD equal 0.5

#### Scenario: Configuration via JSON config
- **GIVEN** config file contains `{"retrieval": {"feedbackWeight": 0.4}}`
- **WHEN** the plugin loads configuration
- **THEN** `config.retrieval.feedbackWeight` SHOULD equal 0.4

---

## Requirement

The system SHALL limit feedback queries to recent events to balance relevance and performance.

### Requirement: Feedback window is time-bounded

Runtime Surface: internal-api  
Entrypoint: `store.ts:getMemoryFeedbackStats()`

#### Scenario: Only recent feedback affects scoring
- **GIVEN** a memory has 10 helpful feedback events, all older than 30 days
- **AND** the memory has no recent feedback
- **WHEN** the memory is retrieved
- **THEN** the feedback factor SHOULD be calculated as if no feedback exists (neutral)

---

## Requirement

The system SHALL fail gracefully when feedback queries fail.

### Requirement: Feedback query failures do not break retrieval

Runtime Surface: internal-api  
Entrypoint: `store.ts:search()`

#### Scenario: Feedback query failure uses neutral factor
- **GIVEN** the feedback query encounters an error
- **WHEN** memories are retrieved
- **THEN** all memories SHOULD receive a feedback factor of 1.0
- **AND** a warning SHOULD be logged

---

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|-------------|------|------------|-----|---------------------|
| Feedback factor calculation | ✅ | ✅ | n/a | yes |
| Configuration options | ✅ | ✅ | n/a | yes |
| Feedback window bounded | ✅ | ✅ | n/a | yes |
| Graceful failure | ✅ | ✅ | n/a | yes |
| Ranking improvement (helpful vs neutral) | ✅ | ✅ | ✅ | yes |

---

## Acceptance Criteria

1. Memories with helpful feedback rank higher than neutral memories with similar relevance scores
2. Memories with wrong/unhelpful feedback rank lower than neutral memories
3. `feedbackWeight=0` completely disables the feature (backward compatible)
4. Environment variable `LANCEDB_OPENCODE_PRO_FEEDBACK_WEIGHT` works
5. Feedback older than 30 days is not counted
6. Search does not fail if feedback query fails
