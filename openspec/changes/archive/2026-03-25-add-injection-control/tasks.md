## 1. Type Definitions

- [x] 1.1 Add `InjectionMode`, `SummarizationMode`, `CodeTruncationMode` types to `src/types.ts`
- [x] 1.2 Add `InjectionConfig` interface to `src/types.ts` with all configuration fields
- [x] 1.3 Add `CodeSummarizationConfig` interface to `src/types.ts`
- [x] 1.4 Add `ContentType`, `ContentDetection`, `SummarizedContent` types to `src/types.ts`
- [x] 1.5 Add `injection` field to `MemoryRuntimeConfig` interface

## 2. Configuration

- [x] 2.1 Add default injection configuration values to `src/config.ts`
- [x] 2.2 Add environment variable parsing for injection settings (LANCEDB_OPENCODE_PRO_INJECTION_*)
- [x] 2.3 Add sidecar config parsing for `injection` block
- [x] 2.4 Add validation for injection configuration values (mode, budgetTokens, thresholds)

## 3. Content Detection Module

- [x] 3.1 Create `src/summarize.ts` module
- [x] 3.2 Implement `detectContentType(text: string): ContentDetection` function
- [x] 3.3 Implement `calculateBracketBalance(text: string): number` helper
- [x] 3.4 Implement `countCodeKeywords(text: string): number` helper
- [x] 3.5 Implement `calculateIndentationRatio(text: string): number` helper

## 4. Token Estimation

- [x] 4.1 Implement `estimateTokens(text: string, contentType: ContentType): number` function
- [x] 4.2 Add Chinese character detection for accurate token estimation
- [x] 4.3 Add code token density multiplier (1.2x)

## 5. Summarization Functions

- [x] 5.1 Implement `truncateText(text: string, maxChars: number): string` function
- [x] 5.2 Implement `smartTruncateCode(code: string, maxLines: number): string` function
- [x] 5.3 Implement `extractKeySentences(text: string, targetChars: number): string` function
- [x] 5.4 Implement `summarizeContent(text: string, config: SummarizationConfig): SummarizedContent` main function
- [x] 5.5 Implement `splitCodeAndText(text: string): ContentPart[]` helper for mixed content

## 6. Injection Control Logic

- [x] 6.1 Implement `calculateInjectionLimit(results: SearchResult[], config: InjectionConfig): number` function
- [x] 6.2 Implement budget mode logic with token accumulation
- [x] 6.3 Implement adaptive mode logic with score drop tolerance
- [x] 6.4 Implement `injectionFloor` filtering

## 7. Integration

- [x] 7.1 Modify `experimental.chat.system.transform` hook to use injection config
- [x] 7.2 Replace hardcoded `limit: 3` with dynamic limit calculation
- [x] 7.3 Add summarization call before injecting memory block
- [x] 7.4 Update memory block format to include summarization metadata if applicable

## 8. Unit Tests

- [x] 8.1 Add tests for `detectContentType` with various content types
- [x] 8.2 Add tests for `estimateTokens` accuracy
- [x] 8.3 Add tests for `smartTruncateCode` bracket balance
- [x] 8.4 Add tests for `extractKeySentences` key sentence detection
- [x] 8.5 Add tests for budget mode limit calculation
- [x] 8.6 Add tests for adaptive mode score drop tolerance
- [x] 8.7 Add tests for injection floor filtering

## 9. Regression Tests

- [x] 9.1 Add regression test for backward-compatible default behavior (mode: fixed, maxMemories: 3)
- [x] 9.2 Add regression test for budget mode token accumulation
- [x] 9.3 Add regression test for code summarization preserving syntax validity
- [x] 9.4 Add regression test for Chinese text token estimation
- [x] 9.5 Add regression test for minimum memories floor

## 10. Documentation

- [x] 10.1 Update README.md with injection configuration section
- [x] 10.2 Add injection configuration examples for common use cases
- [x] 10.3 Update CHANGELOG.md with new feature entry
- [x] 10.4 Add inline documentation for all new types and functions