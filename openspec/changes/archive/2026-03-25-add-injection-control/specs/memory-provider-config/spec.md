# memory-provider-config Specification Delta

## Purpose

TBD - created by archiving change add-lancedb-memory-provider. Update Purpose after archive.

## MODIFIED Requirements

### Requirement: Memory provider configuration contract

The system MUST support a memory configuration contract in sidecar config and environment variables with provider id, storage path, embedding settings, retrieval settings, and injection settings, including both `ollama` and `openai` embedding providers and phase-1 ranking controls (`rrfK`, recency toggle, recency half-life hours, and importance weight).

The system MUST support injection configuration for token budget control, summarization, and content-aware processing.

#### Scenario: Valid provider configuration is loaded
- **WHEN** memory config contains `provider = "lancedb-opencode-pro"` with valid `dbPath`, `embedding`, `retrieval`, and optional `injection` fields
- **THEN** the provider configuration is accepted and initialized without fallback

#### Scenario: Missing optional retrieval values uses defaults
- **WHEN** `memory.retrieval` omits optional mode, threshold, or phase-1 ranking control fields
- **THEN** the system applies documented defaults including `mode = hybrid`, `rrfK = 60`, recency boost enabled with a conservative half-life default, and moderate importance weighting

#### Scenario: Missing injection configuration uses backward-compatible defaults
- **WHEN** `memory.injection` is omitted or partially specified
- **THEN** the system applies defaults equivalent to fixed injection of 3 memories with no summarization
- **AND** `mode` defaults to "fixed"
- **AND** `maxMemories` defaults to 3

#### Scenario: Embedding provider defaults to ollama
- **WHEN** `memory.embedding.provider` is omitted
- **THEN** the system defaults embedding provider to `ollama` to preserve backward compatibility

#### Scenario: Environment variable overrides embedding provider settings
- **WHEN** OpenAI or Ollama embedding settings are provided in supported environment variables
- **THEN** environment variable values override sidecar configuration according to documented precedence

#### Scenario: Environment variable overrides injection settings
- **WHEN** injection settings are provided in environment variables (e.g., `LANCEDB_OPENCODE_PRO_INJECTION_MODE`)
- **THEN** environment variable values override sidecar configuration

## ADDED Requirements

### Requirement: Injection configuration schema

The system MUST support an `injection` configuration block with the following structure:

#### Scenario: Full injection configuration
- **WHEN** user provides full injection configuration
- **THEN** the system accepts:
  - `mode`: "fixed" | "budget" | "adaptive"
  - `maxMemories`: number (default: 3)
  - `minMemories`: number (default: 1)
  - `budgetTokens`: number (default: 4096)
  - `maxCharsPerMemory`: number (default: 1200)
  - `summarization`: "none" | "truncate" | "extract" | "auto"
  - `summaryTargetChars`: number (default: 300)
  - `scoreDropTolerance`: number (default: 0.15)
  - `injectionFloor`: number (default: 0.2)
  - `codeSummarization`: object with `enabled`, `pureCodeThreshold`, `maxCodeLines`, `codeTruncationMode`, `preserveComments`, `preserveImports`

#### Scenario: Partial injection configuration
- **WHEN** user provides partial injection configuration
- **THEN** the system merges with defaults for unspecified fields