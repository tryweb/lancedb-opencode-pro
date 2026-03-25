# injection-control Specification

## Purpose

控制記憶體注入的token 預算、摘要策略、動態上限，支援文字和程式碼的內容感知處理。

## ADDED Requirements

### Requirement: Token budget configuration

The system SHALL support configurable token budget modes for memory injection.

#### Scenario: Fixed mode (backward compatible)
- **WHEN** `injection.mode` is set to `"fixed"` or not specified
- **THEN** the system injects up to `maxMemories` memories (default: 3)

#### Scenario: Budget mode
- **WHEN** `injection.mode` is set to `"budget"`
- **THEN** the system estimates token count for each memory
- **AND** accumulates memories until `budgetTokens` is reached
- **AND** stops before exceeding the budget

#### Scenario: Adaptive mode with score drop tolerance
- **WHEN** `injection.mode` is set to `"adaptive"`
- **THEN** the system injects memories in score-descending order
- **AND** stops when score drop between consecutive memories exceeds `scoreDropTolerance`
- **AND** respects `minMemories` floor

### Requirement: Minimum memory injection

The system SHALL guarantee at least `minMemories` memories are injected if available.

#### Scenario: Minimum memories honored in budget mode
- **WHEN** budget mode is active and budget allowsless than `minMemories`
- **THEN** the system injects at least `minMememories` highest-scoring memories

#### Scenario: Minimum memories honored in adaptive mode
- **WHEN** adaptive mode is active and score drop would stop injection before `minMemories`
- **THEN** the system continues injecting until `minMemories` are injected

### Requirement: Injection floor threshold

The system SHALL exclude memories with scores below `injectionFloor` from injection consideration.

#### Scenario: Low-score memory excluded
- **WHEN** a memory has score below `injectionFloor` (default: 0.2)
- **THEN** the memory is not injected regardless of mode

### Requirement: Content type detection

The system SHALL detect whether memory content is pure text, pure code, or mixed.

#### Scenario: Pure text detection
- **WHEN** memory content has no code indicators(no markdown code blocks, low bracket ratio, no code keywords)
- **THEN** `detectContentType` returns `{ hasCode: false, isPureCode: false }`

#### Scenario: Pure code detection
- **WHEN** memory content has multiple code indicators (markdown code blocks, high bracket ratio, code keywords)
- **THEN** `detectContentType` returns `{ hasCode: true, isPureCode: true }`

#### Scenario: Mixed content detection
- **WHEN** memory content has some code indicators but not enough for pure code
- **THEN** `detectContentType` returns `{ hasCode: true, isPureCode: false }`

### Requirement: Smart code truncation

The system SHALL truncate code content at complete statement boundaries.

#### Scenario: Code truncated at function boundary
- **WHEN** code content exceeds `maxCodeLines` and smart truncation is enabled
- **THEN** the system finds the last complete statement before the limit
- **AND** appends a truncation indicator comment

#### Scenario: Bracket-balanced truncation
- **WHEN** truncating code content
- **THEN** open brackets and braces are matched with closing brackets
- **AND** the truncated content remains syntactically valid

### Requirement: Key sentence extraction for text

The system SHALL extract key sentences from narrative text content.

#### Scenario: Text content exceeds threshold
- **WHEN** text content exceeds `summaryTargetChars` and summarization mode is "extract" or "auto"
- **THEN** the system extracts sentences containing decision signals, fact signals, or action verbs
- **AND** returns content within `summaryTargetChars`

#### Scenario: Text content below threshold
- **WHEN** text content is below `textThreshold` (default: 300 chars)
- **THEN** the content is kept as-is without summarization

### Requirement: Token estimation

The system SHALL estimate token count for memory content.

#### Scenario: English text token estimation
- **WHEN** content is primarily English text
- **THEN** tokens are estimated as `chineseChars / 2 + nonChineseChars / 4`

#### Scenario: Mixed language token estimation
- **WHEN** content contains Chinese characters
- **THEN** Chinese characters are estimated at2 chars/token
- **AND** non-Chinese characters are estimated at 4 chars/token

#### Scenario: Code token estimation
- **WHEN** content is detected as code
- **THEN** token estimate is multiplied by 1.2 to account for higher token density

### Requirement: Summarization mode configuration

The system SHALL support multiple summarization modes.

#### Scenario: None mode
- **WHEN** `injection.summarization` is set to `"none"`
- **THEN** no summarization is performed
- **AND** content is truncated only if exceeding `maxCharsPerMemory`

#### Scenario: Truncate mode
- **WHEN** `injection.summarization` is set to `"truncate"`
- **THEN** content is truncated to `summaryTargetChars` using simple character cutoff

#### Scenario: Extract mode
- **WHEN** `injection.summarization` is set to `"extract"`
- **THEN** key sentences are extracted using heuristics

#### Scenario: Auto mode
- **WHEN** `injection.summarization` is set to `"auto"`
- **THEN** content type is detected
- **AND** appropriate summarization strategy is applied
- **AND** text threshold is 300 chars for no summarization
- **AND** code uses smart truncation

### Requirement: Code summarization configuration

The system SHALL support code-specific summarization options.

#### Scenario: Code summarization disabled
- **WHEN** `injection.codeSummarization.enabled` is `false`
- **THEN** code content is treated as text content

#### Scenario: Preserve comments option
- **WHEN** `injection.codeSummarization.preserveComments` is `true`
- **THEN** code comments are retained during summarization

#### Scenario: Preserve imports option
- **WHEN** `injection.codeSummarization.preserveImports` is `true`
- **THEN** import statements are retained at the beginning of summarized code

### Requirement: Default configuration values

The system SHALL provide sensible defaults for all injection configuration options.

#### Scenario: Default configuration applied
- **WHEN** no injection configuration is provided
- **THEN** the following defaults are applied:
  - `mode`: "fixed"
  - `maxMemories`: 3
  - `minMemories`: 1
  - `budgetTokens`: 4096
  - `maxCharsPerMemory`: 1200
  - `summarization`: "none"
  - `summaryTargetChars`: 300
  - `scoreDropTolerance`: 0.15
  - `injectionFloor`: 0.2
  - `codeSummarization.enabled`: true
  - `codeSummarization.pureCodeThreshold`: 500
  - `codeSummarization.maxCodeLines`: 15
  - `codeSummarization.codeTruncationMode`: "smart"
  - `codeSummarization.preserveComments`: true
  - `codeSummarization.preserveImports`: false