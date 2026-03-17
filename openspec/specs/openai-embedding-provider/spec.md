# openai-embedding-provider Specification

## Purpose
TBD - created by archiving change support-openai-api-model-config. Update Purpose after archive.
## Requirements
### Requirement: OpenAI embedding provider execution
The system MUST support an `openai` embedding provider that requests embeddings from an OpenAI-compatible API endpoint and returns vectors consumable by the existing memory write and search pipeline.

#### Scenario: OpenAI embedding request succeeds
- **WHEN** `embedding.provider` is `openai` and valid `apiKey` and `model` are configured
- **THEN** the system sends an embedding request to the configured OpenAI endpoint and uses the returned vector for memory indexing or retrieval

#### Scenario: OpenAI endpoint override is configured
- **WHEN** `embedding.provider` is `openai` and `embedding.baseUrl` is configured
- **THEN** the system uses the configured base URL instead of the default OpenAI endpoint

### Requirement: OpenAI provider configuration validation
The system MUST fail fast with actionable validation errors when `openai` provider settings are incomplete or invalid.

#### Scenario: Missing API key for openai provider
- **WHEN** `embedding.provider` is `openai` and no OpenAI API key is resolved from configuration or environment
- **THEN** initialization fails with an explicit error that indicates which key is missing and how to provide it

#### Scenario: Missing model for openai provider
- **WHEN** `embedding.provider` is `openai` and no model is configured
- **THEN** initialization fails with an explicit error that requests a valid OpenAI embedding model name

