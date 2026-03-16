## ADDED Requirements

### Requirement: Automatic durable memory capture
The system MUST automatically capture durable memory candidates from successful conversation outcomes at end-of-turn or end-of-session lifecycle points without requiring explicit user commands.

#### Scenario: Successful troubleshooting outcome
- **WHEN** a session concludes with a stable solution signal (for example, fixed configuration or validated command sequence)
- **THEN** the system persists a structured memory entry in LanceDB in the active scope

### Requirement: Hybrid retrieval for context injection
The system MUST support hybrid retrieval combining vector similarity and BM25 lexical matching with configurable weights.

#### Scenario: Hybrid retrieval returns ranked matches
- **WHEN** user submits a new troubleshooting prompt with memory provider enabled in hybrid mode
- **THEN** the system computes vector and BM25 candidates, applies configured weighting, and returns ranked memories for context injection

### Requirement: Context injection safety
The system MUST inject retrieved memory context as auxiliary guidance and MUST NOT override user prompt intent.

#### Scenario: Retrieved memory is presented as suggestion
- **WHEN** relevant past memory is found for a new issue
- **THEN** the injected context is framed as optional historical guidance rather than mandatory instruction

### Requirement: Retrieval fallback behavior
The system MUST degrade gracefully when one retrieval component is unavailable.

#### Scenario: BM25 index unavailable
- **WHEN** BM25/FTS retrieval fails or is temporarily unavailable
- **THEN** the system continues with vector-only retrieval and emits an operational warning signal
