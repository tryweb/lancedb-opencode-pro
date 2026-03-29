# Memory Explanation Specification

## Overview

This spec defines the memory explanation capability that allows users to understand why a specific memory was recalled and what factors contributed to its ranking.

## Requirements

### R1: Memory Explanation via Tool
The system SHALL provide a `memory_why` tool that accepts a memory ID and returns an explanation of why that memory was recalled.

**Runtime Surface**: opencode-tool
**Entrypoint**: src/index.ts -> tool "memory_why"

#### Scenario: Valid memory ID provided
- WHEN user calls `memory_why id="<valid-memory-id>"`
- THEN system returns explanation with breakdown of recall factors

#### Scenario: Invalid memory ID provided
- WHEN user calls `memory_why id="<invalid-id>"`
- THEN system returns error "Memory not found"

#### Scenario: Memory with full metadata
- WHEN explaining a memory with citation, recency, importance data
- THEN explanation includes all available factors

### R2: Recency Score Display
The system SHALL display the recency factor in the explanation, showing how recent the memory is relative to the recency half-life configured.

**Runtime Surface**: opencode-tool
**Entrypoint**: src/store.ts -> explainRecency() method

#### Scenario: Recent memory
- WHEN memory is within recency half-life
- THEN explanation shows "within half-life" with actual age

#### Scenario: Older memory
- WHEN memory exceeds recency half-life
- THEN explanation shows "beyond half-life" with decay applied

### R3: Citation Status Display
The system SHALL display the citation status in the explanation, showing the memory's source and verification state.

**Runtime Surface**: opencode-tool
**Entrypoint**: src/store.ts -> explainCitation() method

#### Scenario: Verified citation
- WHEN memory has verified citation
- THEN explanation shows "verified" with source type

#### Scenario: Pending citation
- WHEN memory has pending citation
- THEN explanation shows "pending verification"

### R4: Relevance Score Breakdown
The system SHALL break down the relevance score into its component factors (vector similarity, BM25 score).

**Runtime Surface**: opencode-tool
**Entrypoint**: src/store.ts -> explainRelevance() method

#### Scenario: Hybrid retrieval
- WHEN memory was retrieved via hybrid search
- THEN explanation shows both vector and BM25 contributions

### R5: Scope Match Explanation
The system SHALL explain whether the memory's scope matches the current retrieval scope.

**Runtime Surface**: opencode-tool
**Entrypoint**: src/store.ts -> explainScope() method

#### Scenario: Same project scope
- WHEN memory scope matches current project
- THEN explanation shows "matches project scope"

#### Scenario: Global scope memory
- WHEN memory is from global scope
- THEN explanation shows "from global scope" with discount factor applied

### R6: Last Recall Explanation
The system SHALL provide `memory_explain_recall` tool that explains the factors behind the last recall operation.

**Runtime Surface**: opencode-tool
**Entrypoint**: src/index.ts -> tool "memory_explain_recall"

#### Scenario: Recall session exists
- WHEN user calls `memory_explain_recall`
- THEN system returns explanation of the last recall with all factors

#### Scenario: No recall session
- WHEN no recall has occurred in current session
- THEN system returns "No recent recall to explain"

## Observability

### O1: Explanation Request Logging
- The system SHALL log explanation requests with memory ID and timestamp
- Log format: `INFO: explanation_request memory_id=<id> timestamp=<ts>`

### O2: Explanation Latency Tracking
- The system SHALL track explanation generation latency
- Expose via metrics: explanation_latency_ms
