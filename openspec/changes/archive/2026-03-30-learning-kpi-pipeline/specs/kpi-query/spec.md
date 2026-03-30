# kpi-query Specification

## Purpose
Provide optional plugin tool for querying aggregated KPI metrics with time range filtering.

## ADDED Requirements

### Requirement: KPI query tool
The system SHALL provide a `memory_kpi` tool that returns aggregated KPI metrics.

Runtime Surface: opencode-tool
Entrypoint: `src/index.ts` -> `hooks.tool.memory_kpi`

#### Scenario: Query default metrics
- **WHEN** user invokes memory_kpi with no parameters
- **THEN** the system returns retry-to-success rate and memory lift for the past 30 days
- **AND** includes scope, time range, and metric values

#### Scenario: Query with custom time range
- **WHEN** user invokes memory_kpi with days=7
- **THEN** the system returns metrics for the past 7 days
- **AND** days parameter accepts values from 1 to 365

#### Scenario: Query with scope filter
- **WHEN** user invokes memory_kpi with scope="project-a"
- **THEN** the system returns metrics filtered to the specified scope

### Requirement: KPI output structure
The system SHALL return structured JSON with consistent metric format.

Runtime Surface: opencode-tool
Entrypoint: `src/index.ts` -> `hooks.tool.memory_kpi`

#### Scenario: Complete metrics available
- **WHEN** both retry-to-success and lift metrics have sufficient data
- **THEN** the response includes both metrics with values, sample counts, and status

#### Scenario: Partial metrics available
- **WHEN** only retry-to-success has sufficient data
- **THEN** the response includes retry-to-success with value and lift with `insufficient-data` status
