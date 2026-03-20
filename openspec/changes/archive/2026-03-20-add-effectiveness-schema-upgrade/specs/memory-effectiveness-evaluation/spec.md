## MODIFIED Requirements

### Requirement: Memory effectiveness event model
The system MUST persist append-only evaluation events for memory capture, memory recall, and user feedback so operators can audit how long-memory behavior performed in real sessions. Recall events MUST include a source field that distinguishes automatic system-transform recall from manual user-initiated search. When the persisted `effectiveness_events` table comes from an older plugin version that lacks the `source` column, the system MUST patch the table schema during initialization before appending new recall events.

#### Scenario: Capture lifecycle emits auditable events
- **WHEN** the system evaluates assistant output for auto-capture
- **THEN** it records whether capture was considered, skipped, or stored and includes structured reason labels for non-stored outcomes

#### Scenario: Recall lifecycle emits auditable events
- **WHEN** the system executes memory recall for a new user prompt
- **THEN** it records the recall request, result count, whether context was injected, and source as system-transform

#### Scenario: Manual search emits recall events
- **WHEN** a user invokes the memory search command
- **THEN** the system records a recall event with source as manual-search and injected as false

#### Scenario: Upgraded install patches missing recall source column
- **WHEN** the plugin initializes against an existing `effectiveness_events` table created before the `source` column existed
- **THEN** it patches the table schema before new recall events are appended

#### Scenario: Feedback event remains append-only
- **WHEN** a user reports that a memory was missing, incorrect, or useful
- **THEN** the system stores a new evaluation event rather than mutating prior evaluation history

### Requirement: Quantitative effectiveness summaries
The system MUST support quantitative summaries for long-memory effectiveness that combine capture funnel, recall funnel, and feedback-confirmed quality signals, and the project MUST define how those summaries are interpreted when explicit feedback is sparse. Recall summaries MUST separate automatic and manual recall metrics.

#### Scenario: Operator requests effectiveness summary
- **WHEN** an operator runs the documented effectiveness reporting workflow
- **THEN** the system returns machine-readable summary fields for capture success, skip reasons, recall hit rate, helpful recall rate, false-positive rate, and false-negative rate, with recall metrics split into auto and manual sub-structures

#### Scenario: Summary distinguishes operational and product metrics
- **WHEN** effectiveness metrics are reported
- **THEN** the report separates operational indicators from product-outcome proxies such as repeated-context reduction or manual-search-after-recall rate

#### Scenario: Zero feedback is interpreted as unknown quality
- **WHEN** explicit feedback counts are zero or too sparse to support statistical confidence
- **THEN** maintainers treat feedback-derived rates as insufficient evidence rather than as confirmation that memory quality is good

#### Scenario: Manual rescue ratio is reported
- **WHEN** the effectiveness summary includes both auto and manual recall data
- **THEN** the system reports a manual rescue ratio representing manual search frequency relative to auto recall frequency
