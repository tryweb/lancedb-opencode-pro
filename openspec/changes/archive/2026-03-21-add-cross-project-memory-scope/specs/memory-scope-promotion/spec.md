# memory-scope-promotion Specification

## Purpose

Provide tools for users to manually promote project-scoped memories to global scope and to demote unused global memories back to project scope.

## Requirements

### Requirement: Manual promotion tool

The system MUST provide a `memory_scope_promote` tool that accepts a memory ID and promotes it from project to global scope.

#### Scenario: User promotes a memory
- **WHEN** user invokes `memory_scope_promote` with a valid memory ID
- **THEN** the memory's scope is updated to `"global"`
- **AND** the tool returns confirmation with the updated memory details

#### Scenario: Promotion of non-existent memory
- **WHEN** user invokes `memory_scope_promote` with a non-existent memory ID
- **THEN** the tool returns an error with guidance

### Requirement: Manual demotion tool

The system MUST provide a `memory_scope_demote` tool that accepts a memory ID and demotes it from global to project scope.

#### Scenario: User demotes a memory
- **WHEN** user invokes `memory_scope_demote` with a valid memory ID
- **THEN** the memory's scope is updated to `"project"`
- **AND** the tool returns confirmation with the updated memory details

#### Scenario: Demotion of project-scoped memory
- **WHEN** user invokes `memory_scope_demote` on a project-scoped memory
- **THEN** the tool returns an error indicating scope is already project

### Requirement: Confirmation required for promotion/demotion

The system MUST require explicit confirmation signal before executing scope changes.

#### Scenario: Promotion without confirmation
- **WHEN** user invokes `memory_scope_promote` without confirmation
- **THEN** the tool returns guidance for safe execution

### Requirement: Promotion prompt from detection

When the global detection heuristic triggers, the system MUST present a structured prompt offering the user choices.

#### Scenario: Detection prompt options
- **WHEN** global detection triggers during memory storage
- **THEN** the user is presented with options:
  - "Promote to global scope" (stores the memory as global)
  - "Keep as project scope" (keeps the memory as project-scoped)
  - "Dismiss" (same as keep as project scope)

### Requirement: Unused global detection

The system MUST track when global memories are recalled and identify those not used within a configurable time window.

#### Scenario: Unused global memory detected
- **WHEN** a global memory has not been recalled in the past 30 days (configurable via `unused_days_threshold`)
- **THEN** the system presents a demotion prompt listing unused global memories

#### Scenario: Demotion prompt options for unused memories
- **WHEN** unused global memories are detected
- **THEN** the user is presented with options:
  - "Demote all unused" (moves all to project scope)
  - "Review individually" (allows per-memory demotion)
  - "Keep all" (dismisses the prompt)
