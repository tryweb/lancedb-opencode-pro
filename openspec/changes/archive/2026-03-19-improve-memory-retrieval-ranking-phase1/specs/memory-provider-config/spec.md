## MODIFIED Requirements

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
