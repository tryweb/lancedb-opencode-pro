## Why

When tasks fail, the system currently has no memory of retry strategies that worked before. Adding retry/recovery evidence tracking enables the system to suggest appropriate retry budgets, backoff strategies, and fallback approaches based on historical evidence—not by reimplementing execution engine, but by providing intelligence hints.

## What Changes

- Add retry/recovery evidence model that captures retry attempts, outcomes, and recovery strategies
- Add retry budget and stop condition suggestions based on historical evidence
- Add backoff/cooldown signal integration from OpenCode/OMO events
- Add strategy switching suggestions (fallback approaches) based on past successes

## Capabilities

### New Capabilities
- `retry-recovery-evidence`: Evidence model for tracking retry attempts and outcomes
- `retry-budget-suggestion`: Suggest appropriate retry budgets based on task type history
- `strategy-switching-suggester`: Recommend fallback strategies after repeated failures

### Modified Capabilities
- None

## Impact
- Evidence storage (can reuse existing memory or new table)
- Integration points with OpenCode/OMO event system
- No direct execution control—suggestions only
