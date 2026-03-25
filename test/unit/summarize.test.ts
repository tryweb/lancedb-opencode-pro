import assert from "node:assert/strict";
import test from "node:test";
import {
  detectContentType,
  calculateBracketBalance,
  countCodeKeywords,
  calculateIndentationRatio,
  estimateTokens,
  truncateText,
  smartTruncateCode,
  extractKeySentences,
  splitCodeAndText,
  summarizeContent,
  calculateInjectionLimit,
  createSummarizationConfig,
} from "../../src/summarize.js";
import type { InjectionConfig, SummarizationConfig } from "../../src/types.js";

test("detectContentType: detects pure text with no code indicators", () => {
  const text = "This is a simple narrative text without any code.";
  const result = detectContentType(text);
  assert.strictEqual(result.hasCode, false);
  assert.strictEqual(result.isPureCode, false);
});

test("detectContentType: detects markdown code blocks", () => {
  const text = "Here is some code:\n```typescript\nconst x = 1;\n```\nDone.";
  const result = detectContentType(text);
  assert.strictEqual(result.hasCode, true);
  assert.strictEqual(result.isPureCode, false);
});

test("detectContentType: detects markdown code blocks", () => {
  const text = "Here is some code:\n```typescript\nconst x = 1;\n```\nDone.";
  const result = detectContentType(text);
  assert.strictEqual(result.hasCode, true);
});

test("detectContentType: correctly identifies text without code", () => {
  const text = "This is a simple narrative text without any code.";
  const result = detectContentType(text);
  assert.strictEqual(result.hasCode, false);
});

test("detectContentType: handles Chinese text", () => {
  const text = "這是一段中文描述，我們解決了一個 Alpine Linux DNS 解析問題。";
  const result = detectContentType(text);
  assert.strictEqual(result.hasCode, false);
});

test("calculateBracketBalance: returns 0 for no brackets", () => {
  assert.strictEqual(calculateBracketBalance("no brackets here"), 0);
});

test("calculateBracketBalance: counts bracket pairs", () => {
  assert.strictEqual(calculateBracketBalance("{hello}"), 1);
  assert.strictEqual(calculateBracketBalance("({data})"), 2);
  assert.strictEqual(calculateBracketBalance("{{{{"), 4);
});

test("countCodeKeywords: counts zero for no keywords", () => {
  assert.strictEqual(countCodeKeywords("hello world"), 0);
});

test("countCodeKeywords: counts multiple keywords", () => {
  const code = "async function test() { return await fetch(); }";
  const count = countCodeKeywords(code);
  assert.ok(count >= 3);
});

test("calculateIndentationRatio: returns 0 for no indentation", () => {
  assert.strictEqual(calculateIndentationRatio("a\nb\nc"), 0);
});

test("calculateIndentationRatio: calculates ratio for indented code", () => {
  const code = "function test() {\n  const x = 1;\n  return x;\n}";
  const ratio = calculateIndentationRatio(code);
  assert.ok(ratio > 0.3);
});

test("estimateTokens: estimates English text tokens", () => {
  const text = "Hello world this is a test";
  const tokens = estimateTokens(text, "text");
  assert.ok(tokens > 0);
  assert.ok(tokens < text.length);
});

test("estimateTokens: applies multiplier for code", () => {
  const text = "function test() { return 1; }";
  const textTokens = estimateTokens(text, "text");
  const codeTokens = estimateTokens(text, "code");
  assert.ok(codeTokens > textTokens);
});

test("estimateTokens: estimates Chinese text tokens correctly", () => {
  const text = "這是中文測試";
  const tokens = estimateTokens(text, "text");
  const expectedChineseChars = 5;
  assert.ok(tokens >= expectedChineseChars / 2);
});

test("truncateText: keeps short text unchanged", () => {
  const text = "short";
  assert.strictEqual(truncateText(text, 100), text);
});

test("truncateText: truncates long text with ellipsis", () => {
  const text = "This is a long text that should be truncated";
  const result = truncateText(text, 10);
  assert.strictEqual(result.length, 10);
  assert.ok(result.endsWith("..."));
});

test("smartTruncateCode: keeps short code unchanged", () => {
  const code = "const x = 1;";
  const result = smartTruncateCode(code, 10);
  assert.strictEqual(result, code);
});

test("smartTruncateCode: truncates at bracket boundaries", () => {
  const code = `function test() {
  const x = 1;
  return x;
}

function another() {
  const y = 2;
}`;
  const result = smartTruncateCode(code, 3);
  assert.ok(result.includes("// ... (truncated)"));
  assert.ok(!result.includes("another"));
});

test("extractKeySentences: extracts sentences matching key patterns", () => {
  const text = "We fixed the DNS issue. The solution was to add gcompat. We decided to use Alpine.";
  const result = extractKeySentences(text, 100);
  assert.ok(result.includes("fixed"));
});

test("extractKeySentences: returns first sentences if no key patterns", () => {
  const text = "This is normal text. Nothing special.";
  const result = extractKeySentences(text, 50);
  assert.ok(result.length > 0);
});

test("splitCodeAndText: splits mixed content correctly", () => {
  const text = "Here is code:\n```js\nconst x = 1;\n```\nAnd more text.";
  const parts = splitCodeAndText(text);
  assert.strictEqual(parts.length, 3);
  assert.strictEqual(parts[0].type, "text");
  assert.strictEqual(parts[1].type, "code");
  assert.strictEqual(parts[2].type, "text");
});

test("splitCodeAndText: handles code-only content", () => {
  const text = "```js\nconst x = 1;\n```";
  const parts = splitCodeAndText(text);
  assert.strictEqual(parts.length, 1);
  assert.strictEqual(parts[0].type, "code");
});

test("splitCodeAndText: handles text-only content", () => {
  const text = "Just plain text without code blocks.";
  const parts = splitCodeAndText(text);
  assert.strictEqual(parts.length, 1);
  assert.strictEqual(parts[0].type, "text");
});

test("summarizeContent: keeps short text unchanged in none mode", () => {
  const defaultConfig: SummarizationConfig = {
    mode: "none",
    textThreshold: 300,
    codeThreshold: 500,
    summaryTargetChars: 300,
    maxCodeLines: 15,
    codeTruncationMode: "smart",
    preserveComments: true,
    preserveImports: false,
  };
  const text = "Short text";
  const result = summarizeContent(text, defaultConfig);
  assert.strictEqual(result.type, "kept");
  assert.strictEqual(result.content, text);
});

test("summarizeContent: truncates in truncate mode", () => {
  const config: SummarizationConfig = {
    mode: "truncate",
    textThreshold: 10,
    codeThreshold: 500,
    summaryTargetChars: 50,
    maxCodeLines: 15,
    codeTruncationMode: "smart",
    preserveComments: true,
    preserveImports: false,
  };
  const text = "This is a very long text that should be truncated because it exceeds the threshold and needs to be shortened to fit within the limit we specified.";
  const result = summarizeContent(text, config);
  assert.strictEqual(result.type, "truncated");
  assert.ok(result.content.length <= 53);
});

test("calculateInjectionLimit: returns 0 for empty results", () => {
  const config: InjectionConfig = {
    mode: "fixed",
    maxMemories: 3,
    minMemories: 1,
    budgetTokens: 4096,
    maxCharsPerMemory: 1200,
    summarization: "none",
    summaryTargetChars: 300,
    scoreDropTolerance: 0.15,
    injectionFloor: 0.2,
    codeSummarization: {
      enabled: true,
      pureCodeThreshold: 500,
      maxCodeLines: 15,
      codeTruncationMode: "smart",
      preserveComments: true,
      preserveImports: false,
    },
  };
  assert.strictEqual(calculateInjectionLimit([], config), 0);
});

test("calculateInjectionLimit: respects maxMemories in fixed mode", () => {
  const config: InjectionConfig = {
    mode: "fixed",
    maxMemories: 2,
    minMemories: 1,
    budgetTokens: 4096,
    maxCharsPerMemory: 1200,
    summarization: "none",
    summaryTargetChars: 300,
    scoreDropTolerance: 0.15,
    injectionFloor: 0.2,
    codeSummarization: {
      enabled: true,
      pureCodeThreshold: 500,
      maxCodeLines: 15,
      codeTruncationMode: "smart",
      preserveComments: true,
      preserveImports: false,
    },
  };
  const createMockResult = (score: number, text: string) => ({
    record: { id: `id-${score}`, text, score, vector: [], category: "other" as const, scope: "test", importance: 0.5, timestamp: Date.now(), lastRecalled: 0, recallCount: 0, projectCount: 0, schemaVersion: 1, embeddingModel: "test", vectorDim: 0, metadataJson: "{}" },
    score,
    vectorScore: score,
    bm25Score: score,
  });
  const results = [
    createMockResult(0.9, "high"),
    createMockResult(0.8, "medium"),
    createMockResult(0.7, "low"),
  ];
  const limit = calculateInjectionLimit(results, config);
  assert.strictEqual(limit, 2);
});

test("calculateInjectionLimit: filters by injectionFloor", () => {
  const config: InjectionConfig = {
    mode: "fixed",
    maxMemories: 5,
    minMemories: 1,
    budgetTokens: 4096,
    maxCharsPerMemory: 1200,
    summarization: "none",
    summaryTargetChars: 300,
    scoreDropTolerance: 0.15,
    injectionFloor: 0.5,
    codeSummarization: {
      enabled: true,
      pureCodeThreshold: 500,
      maxCodeLines: 15,
      codeTruncationMode: "smart",
      preserveComments: true,
      preserveImports: false,
    },
  };
  const createMockResult = (score: number, text: string) => ({
    record: { id: `id-${score}`, text, score, vector: [], category: "other" as const, scope: "test", importance: 0.5, timestamp: Date.now(), lastRecalled: 0, recallCount: 0, projectCount: 0, schemaVersion: 1, embeddingModel: "test", vectorDim: 0, metadataJson: "{}" },
    score,
    vectorScore: score,
    bm25Score: score,
  });
  const results = [
    createMockResult(0.9, "high"),
    createMockResult(0.4, "below-floor"),
    createMockResult(0.8, "medium"),
  ];
  const limit = calculateInjectionLimit(results, config);
  assert.strictEqual(limit, 2);
});

test("createSummarizationConfig: creates config from injection config", () => {
  const injection: InjectionConfig = {
    mode: "fixed",
    maxMemories: 3,
    minMemories: 1,
    budgetTokens: 4096,
    maxCharsPerMemory: 1200,
    summarization: "auto",
    summaryTargetChars: 300,
    scoreDropTolerance: 0.15,
    injectionFloor: 0.2,
    codeSummarization: {
      enabled: true,
      pureCodeThreshold: 500,
      maxCodeLines: 15,
      codeTruncationMode: "smart",
      preserveComments: true,
      preserveImports: false,
    },
  };
  const config = createSummarizationConfig(injection);
  assert.strictEqual(config.mode, "auto");
  assert.strictEqual(config.textThreshold, 300);
  assert.strictEqual(config.codeThreshold, 500);
  assert.strictEqual(config.maxCodeLines, 15);
});