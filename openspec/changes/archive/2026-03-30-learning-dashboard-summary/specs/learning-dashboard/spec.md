# learning-dashboard Specification

## Purpose
Provide users with a unified weekly learning summary combining capture, recall, and feedback metrics with trend indicators and actionable insights.

## ADDED Requirements

### Requirement: Dashboard tool invocation
The system SHALL provide a `memory_dashboard` tool that returns an aggregated weekly summary of learning effectiveness metrics.

Runtime Surface: `opencode-tool`
Entrypoint: `src/index.ts` -> `hooks.tool.memory_dashboard`

#### Scenario: User requests weekly dashboard
- **WHEN** user invokes memory_dashboard with no parameters
- **THEN** the system returns a summary for the past 7 days
- **AND** the summary includes capture, recall, and feedback sections

#### Scenario: Dashboard with custom time range
- **WHEN** user invokes memory_dashboard with days=14
- **THEN** the system returns a summary for the past 14 days
- **AND** days parameter accepts values from 1 to 90

#### Scenario: Dashboard with scope filter
- **WHEN** user invokes memory_dashboard with scope="project-a"
- **THEN** the system returns metrics filtered to the specified scope
- **AND** global scope memories are included if includeGlobalScope is true

### Requirement: Capture metrics aggregation
The system SHALL aggregate capture effectiveness metrics including total captures, success rate, and skip reason breakdown.

#### Scenario: Capture section shows success rate
- **WHEN** dashboard is generated
- **THEN** capture section includes total events considered, stored count, skipped count
- **AND** success rate is calculated as stored / considered

#### Scenario: Capture section shows skip reasons
- **WHEN** dashboard is generated and captures were skipped
- **THEN** the response includes breakdown by skip reason
- **AND** skip reasons are sorted by frequency descending

### Requirement: Recall metrics aggregation
The system SHALL aggregate recall effectiveness metrics including total recalls, hit rate, and injection rate.

#### Scenario: Recall section shows hit rate
- **WHEN** dashboard is generated
- **THEN** recall section includes total recall requests, injected count, results returned
- **AND** hit rate is calculated for recalls with results > 0

#### Scenario: Recall section distinguishes auto vs manual
- **WHEN** dashboard is generated
- **THEN** recall metrics are separated by source (system-transform vs manual-search)
- **AND** manual rescue ratio is calculated (manual recalls with results / auto recalls without)

### Requirement: Feedback metrics aggregation
The system SHALL aggregate feedback metrics including missing, wrong, and useful counts.

#### Scenario: Feedback section shows quality breakdown
- **WHEN** dashboard is generated
- **THEN** feedback section includes missing count, wrong count, useful positive/negative counts
- **AND** helpful rate is calculated as useful.positive / (useful.positive + useful.negative)

#### Scenario: Feedback section shows false rates
- **WHEN** dashboard is generated
- **THEN** false positive rate is calculated from wrong feedback
- **AND** false negative rate is calculated from missing feedback

### Requirement: Week-over-week trend indicators
The system SHALL calculate trend indicators comparing current period to previous equivalent period.

#### Scenario: Trend indicators improve
- **WHEN** current period metrics are better than previous period
- **THEN** trend indicator shows "improving" with percentage change
- **AND** percentage is calculated as ((current - previous) / previous) * 100

#### Scenario: Trend indicators decline
- **WHEN** current period metrics are worse than previous period
- **THEN** trend indicator shows "declining" with percentage change

#### Scenario: Trend indicators stable
- **WHEN** current period metrics are within 5% of previous period
- **THEN** trend indicator shows "stable"

#### Scenario: No trend with insufficient history
- **WHEN** previous period has no events
- **THEN** trend indicator shows "insufficient-data"
- **AND** dashboard still shows current period metrics

### Requirement: Actionable insights generation
The system SHALL generate rule-based insights from effectiveness metrics.

#### Scenario: Low recall hit rate insight
- **WHEN** recall hit rate < 50%
- **THEN** insight suggests "Consider refining memory capture quality or query specificity"

#### Scenario: High skip rate insight
- **WHEN** capture skip rate > 50%
- **THEN** insight suggests "High skip rate may indicate duplicate content orembedding issues"

#### Scenario: Low feedback helpful rate insight
- **WHEN** feedback helpful rate < 70%
- **THEN** insight suggests "Memory quality could improve with more explicit feedback"

#### Scenario: No insights when no issues detected
- **WHEN** all metrics are within healthy ranges
- **THEN** insight message indicates "Learning effectiveness is within healthy ranges"

### Requirement: Memory category breakdown
The system SHALL include memory counts by category from recent captures.

#### Scenario: Category breakdown included
- **WHEN** dashboard is generated
- **THEN** summary includes count of memories by category (preference, fact, decision, entity, other)
- **AND** sample memories from each category are shown (max 3 per category)

### Requirement: Minimum sample threshold for trends
The system SHALL require minimum sample counts before showing trend indicators.

#### Scenario: Trend hidden for low samples
- **WHEN** either current or previous period has fewer than 5 events
- **THEN** trend indicator shows "insufficient-data" instead of percentage
- **AND** dashboard explains minimum sample requirement