# memory-provider-config Specification

## Purpose
TBD - created by archiving change add-lancedb-memory-provider. Update Purpose after archive.
## Requirements
### Requirement: Memory provider configuration contract
The system MUST support a memory configuration contract in sidecar config and environment variables with provider id, storage path, embedding settings, and retrieval settings, including both `ollama` and `openai` embedding providers and phase-1 ranking controls (`rrfK`, recency toggle, recency half-life hours, and importance weight).

#### Scenario: Valid provider configuration is loaded
- **WHEN** memory config contains `provider = "lancedb-opencode-pro"` with valid `dbPath`, `embedding`, and `retrieval` fields
- **THEN** the provider configuration is accepted and initialized without fallback

#### Scenario: Missing optional retrieval values uses defaults
- **WHEN** `memory.retrieval` omits optional mode, threshold, or phase-1 ranking control fields
- **THEN** the system applies documented defaults including `mode = hybrid`, `rrfK = 60`, recency boost enabled with a conservative half-life default, and moderate importance weighting

#### Scenario: Embedding provider defaults to ollama
- **WHEN** `memory.embedding.provider` is omitted
- **THEN** the system defaults embedding provider to `ollama` to preserve backward compatibility

#### Scenario: Environment variable overrides embedding provider settings
- **WHEN** OpenAI or Ollama embedding settings are provided in supported environment variables
- **THEN** environment variable values override sidecar configuration according to documented precedence

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

