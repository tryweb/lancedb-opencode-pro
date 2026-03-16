# memory-provider-config Specification

## Purpose
TBD - created by archiving change add-lancedb-memory-provider. Update Purpose after archive.
## Requirements
### Requirement: Memory provider configuration contract
The system MUST support a memory configuration contract in `opencode.json` with provider id, storage path, embedding settings, and retrieval settings.

#### Scenario: Valid provider configuration is loaded
- **WHEN** `opencode.json` contains `memory.provider = "lancedb-opencode-pro"` with valid `dbPath`, `embedding`, and `retrieval` fields
- **THEN** the provider configuration is accepted and initialized without fallback

#### Scenario: Missing optional retrieval values uses defaults
- **WHEN** `memory.retrieval` omits weights or mode fields
- **THEN** the system applies documented defaults including `mode = hybrid`, `vectorWeight = 0.7`, and `bm25Weight = 0.3`

### Requirement: Default storage path behavior
The system MUST default memory storage path to `~/.opencode/memory/lancedb` when `memory.dbPath` is not explicitly configured, and the project MUST provide a supported verification path for operators to inspect the active storage location.

#### Scenario: No dbPath provided
- **WHEN** user enables memory provider without defining `memory.dbPath`
- **THEN** storage is initialized under `~/.opencode/memory/lancedb`

#### Scenario: Operator verifies configured storage path
- **WHEN** an operator runs the documented verification flow for the active environment
- **THEN** the operator can inspect the resolved storage path and confirm that the provider initialized the expected database location

### Requirement: Embedding compatibility validation
The system MUST validate embedding model compatibility for stored vectors and prevent unsafe mixed-dimension vector retrieval, and the project MUST provide executable validation that surfaces incompatible-vector conditions before release.

#### Scenario: Embedding model dimension changes
- **WHEN** configured embedding model dimension differs from existing stored vector metadata
- **THEN** the system blocks unsafe vector mixing and provides a migration/reindex guidance signal

#### Scenario: Validation workflow detects incompatible vectors
- **WHEN** maintainers run the foundation validation workflow against mixed-dimension test data
- **THEN** the workflow reports incompatible vectors and fails the compatibility check

