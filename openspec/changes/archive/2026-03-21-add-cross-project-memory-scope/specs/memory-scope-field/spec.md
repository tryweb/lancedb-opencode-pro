# memory-scope-field Specification

## Purpose

Add a `scope` metadata field to memory entries to distinguish between project-specific and globally shared knowledge.

## Requirements

### Requirement: Memory scope field

The system MUST store a `scope` field on every memory entry with value `"project"` or `"global"`, defaulting to `"project"` when not specified.

#### Scenario: New memory entry inherits project scope
- **WHEN** a new memory is stored without explicit scope
- **THEN** the entry is stored with `scope: "project"`

#### Scenario: Global memory promotion
- **WHEN** a memory is promoted to global scope
- **THEN** the entry's `scope` field is updated to `"global"`

#### Scenario: Existing memories maintain project scope
- **WHEN** existing memories without explicit scope are queried
- **THEN** they are treated as `scope: "project"` for backward compatibility

### Requirement: Scope field queryable

The system MUST support filtering memories by scope field during storage and retrieval operations.

#### Scenario: Query only project memories
- **WHEN** retrieval is constrained to project scope
- **THEN** memories with `scope: "global"` are excluded from results

#### Scenario: Query only global memories
- **WHEN** retrieval requests global scope only
- **THEN** memories with `scope: "project"` are excluded from results

### Requirement: Scope persisted

The system MUST persist the scope field to LanceDB storage and include it in all memory entry responses.

#### Scenario: Scope survives restart
- **WHEN** the system restarts after storing a global-scoped memory
- **THEN** the memory is still returned with `scope: "global"`
