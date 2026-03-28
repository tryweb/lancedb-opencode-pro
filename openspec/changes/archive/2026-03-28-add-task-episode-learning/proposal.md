## Why

Users repeat similar tasks across sessions. Without episodic learning, the system cannot recall how similar tasks were solved before. Adding task episode capture and pattern extraction enables the system to learn from past successes and failures, reducing redundant attempts.

## What Changes

- Add task episode capture mechanism that tracks task execution start/end, commands, and outcomes
- Add validation outcome ingestion (type/build/test results)
- Add failure taxonomy classification (syntax, runtime, logic, resource, unknown)
- Add success pattern extraction from completed episodes
- Add similar task recall for task initialization

## Capabilities

### New Capabilities
- `task-episode-capture`: Track task execution with start/end, commands, outcomes
- `validation-outcome-ingestion`: Parse and store type/build/test validation results
- `failure-taxonomy`: Standardized failure classification system
- `success-pattern-extraction`: Extract patterns from successful task completions
- `similar-task-recall`: Find and present similar past tasks before execution

### Modified Capabilities
- None

## Impact
- New event hooks for task lifecycle tracking
- Pattern storage in memory or separate table
- Similar task matching via vector search
