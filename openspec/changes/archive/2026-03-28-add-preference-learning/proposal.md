## Why

Current memory system treats all captured content equally. Users repeatedly express preferences (code style, tool choices, workflow patterns) but the system doesn't learn from these signals. Adding preference learning enables the system to adapt to user habits, reducing repeated context and clarification turns.

## What Changes

- Add preference profile aggregator that collects preference signals from memory content
- Add preference conflict resolution rules (recent signal wins over old, direct signal wins over inferred)
- Add scope precedence resolver (project > global by default)
- Add preference-aware prompt injection that layers preferences, decisions, and success patterns into context

## Capabilities

### New Capabilities

- `preference-profile-aggregator`: Aggregates preference signals from memory content into structured profiles
- `preference-conflict-resolution`: Rules for resolving conflicting preference signals (recency + directness priority)
- `preference-scope-precedence`: Scope-level preference precedence rules (project > global default)
- `preference-prompt-injection`: Context injection that layers preferences, decisions, and success patterns

### Modified Capabilities

- `memory-auto-capture-and-recall`: May need to tag preference-related content during capture

## Impact

- New preference inference logic in memory processing pipeline
- New injection mode for preference-aware context
- Potential storage for preference profiles (new table or extended metadata)
