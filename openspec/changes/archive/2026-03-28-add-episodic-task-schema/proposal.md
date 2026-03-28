## Why

Current memory system captures individual events but lacks structured representation of task execution episodes. To enable episodic learning and retry/recovery intelligence, we need a dedicated schema for capturing task-level execution records with validation outcomes, failure classifications, and success patterns.

## What Changes

- Add new `episodic_tasks` table for task episode records
- Define task states: pending, running, success, failed, timeout
- Add failure taxonomy classification system
- Integrate task capture with existing session events

## Capabilities

### New Capabilities
- `episodic-task-schema`: Core schema for task episode records with states, outcomes, and metadata

### Modified Capabilities
- None (this is a foundational schema change)

## Impact
- New database table: `episodic_tasks`
- Schema extensions to existing types
- No impact on existing memory operations
