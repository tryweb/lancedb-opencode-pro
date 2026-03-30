# kpi-memory-lift Specification

## Purpose
Calculate memory "lift" metric comparing task success rates with/without recall to measure memory system value.

## ADDED Requirements

### Requirement: Memory lift calculation
The system SHALL calculate memory lift by comparing success rates of tasks that used recall vs those that didn't.

Runtime Surface: internal-api
Entrypoint: `src/store.ts` -> `calculateMemoryLift()`

#### Scenario: Calculate lift with sufficient data
- **WHEN** there are 5+ tasks in each group (with recall, without recall)
- **THEN** the system returns lift = (success_rate_with_recall - success_rate_without_recall) / success_rate_without_recall
- **AND** includes success rates for both groups and sample counts

#### Scenario: Insufficient data in one group
- **WHEN** one group has fewer than 5 tasks
- **THEN** the system returns `insufficient-data` status
- **AND** includes counts for both groups

#### Scenario: No tasks with recall
- **WHEN** no tasks have used memory recall
- **THEN** the system returns `no-recall-data` status
- **AND** explains that lift cannot be calculated without recall data

### Requirement: Recall usage detection
The system SHALL determine whether a task used memory recall from existing data.

Runtime Surface: internal-api
Entrypoint: `src/store.ts` -> `taskUsedRecall(record)`

#### Scenario: Detect recall from validation outcomes
- **WHEN** validationOutcomesJson contains recall-related entries
- **THEN** the task is marked as using recall

#### Scenario: Detect recall from metadata
- **WHEN** metadataJson contains `recallUsed: true`
- **THEN** the task is marked as using recall
