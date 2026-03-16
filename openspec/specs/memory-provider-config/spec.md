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
The system MUST default memory storage path to `~/.opencode/memory/lancedb` when `memory.dbPath` is not explicitly configured.

#### Scenario: No dbPath provided
- **WHEN** user enables memory provider without defining `memory.dbPath`
- **THEN** storage is initialized under `~/.opencode/memory/lancedb`

### Requirement: Embedding compatibility validation
The system MUST validate embedding model compatibility for stored vectors and prevent unsafe mixed-dimension vector retrieval.

#### Scenario: Embedding model dimension changes
- **WHEN** configured embedding model dimension differs from existing stored vector metadata
- **THEN** the system blocks unsafe vector mixing and provides a migration/reindex guidance signal

