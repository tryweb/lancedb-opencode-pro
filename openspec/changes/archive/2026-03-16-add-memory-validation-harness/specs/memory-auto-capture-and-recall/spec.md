## MODIFIED Requirements

### Requirement: Automatic durable memory capture
The system MUST automatically capture durable memory candidates from successful conversation outcomes at end-of-turn or end-of-session lifecycle points without requiring explicit user commands, and the project MUST provide automated regression checks that verify captured text eligibility, category assignment, and minimum-length enforcement.

#### Scenario: Successful troubleshooting outcome
- **WHEN** a session concludes with a stable solution signal (for example, fixed configuration or validated command sequence)
- **THEN** the system persists a structured memory entry in LanceDB in the active scope

#### Scenario: Regression coverage validates capture rules
- **WHEN** maintainers run the auto-capture regression workflow
- **THEN** the workflow verifies that qualifying assistant output is captured, short output below the configured minimum is skipped, and stored category metadata matches the extraction rules

### Requirement: Hybrid retrieval for context injection
The system MUST support hybrid retrieval combining vector similarity and BM25 lexical matching with configurable weights, and the project MUST provide a retrieval-quality workflow that measures ranked-result quality against documented thresholds.

#### Scenario: Hybrid retrieval returns ranked matches
- **WHEN** user submits a new troubleshooting prompt with memory provider enabled in hybrid mode
- **THEN** the system computes vector and BM25 candidates, applies configured weighting, and returns ranked memories for context injection

#### Scenario: Retrieval quality workflow reports recall metrics
- **WHEN** maintainers run the retrieval-quality workflow against the defined query set
- **THEN** the workflow reports recall and robustness metrics that can be compared with the documented release thresholds

### Requirement: Retrieval fallback behavior
The system MUST degrade gracefully when one retrieval component is unavailable, and the project MUST provide automated verification that fallback behavior does not crash plugin recall flows.

#### Scenario: BM25 index unavailable
- **WHEN** BM25/FTS retrieval fails or is temporarily unavailable
- **THEN** the system continues with vector-only retrieval and emits an operational warning signal

#### Scenario: Embedding backend unavailable during verification
- **WHEN** validation exercises a retrieval path while the embedding backend is unavailable
- **THEN** the system remains operational and returns the documented degraded behavior instead of crashing the plugin hooks
