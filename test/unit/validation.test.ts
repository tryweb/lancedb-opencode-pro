import assert from "node:assert";
import test from "node:test";
import { parseValidationOutput, classifyFailure } from "../../src/utils.js";

test("parseValidationOutput parses type-check pass", () => {
  const result = parseValidationOutput("Found 0 errors", "type-check");
  assert.equal(result.status, "pass");
  assert.equal(result.errorCount, 0);
});

test("parseValidationOutput parses type-check fail", () => {
  const result = parseValidationOutput("Found 5 errors", "type-check");
  assert.equal(result.status, "fail");
  assert.equal(result.errorCount, 5);
});

test("parseValidationOutput parses build pass", () => {
  const result = parseValidationOutput("Build succeeded", "build");
  assert.equal(result.status, "pass");
});

test("parseValidationOutput parses build fail", () => {
  const result = parseValidationOutput("Build failed with 3 errors", "build");
  assert.equal(result.status, "fail");
  assert.equal(result.errorCount, 3);
});

test("parseValidationOutput parses test pass", () => {
  const result = parseValidationOutput("10 passed, 0 failed", "test");
  assert.equal(result.status, "pass");
  assert.equal(result.passedCount, 10);
  assert.equal(result.failedCount, 0);
});

test("parseValidationOutput parses test fail", () => {
  const result = parseValidationOutput("5 passed, 3 failed", "test");
  assert.equal(result.status, "fail");
  assert.equal(result.passedCount, 5);
  assert.equal(result.failedCount, 3);
});

test("classifyFailure identifies syntax errors", () => {
  assert.equal(classifyFailure("SyntaxError: unexpected token"), "syntax");
  assert.equal(classifyFailure("Parse error: invalid syntax"), "syntax");
  assert.equal(classifyFailure("unexpected character at line 1"), "syntax");
});

test("classifyFailure identifies runtime errors", () => {
  assert.equal(classifyFailure("ReferenceError: x is not defined"), "runtime");
  assert.equal(classifyFailure("TypeError: Cannot read property 'foo'"), "runtime");
  assert.equal(classifyFailure("Error: something went wrong"), "runtime");
});

test("classifyFailure identifies logic errors", () => {
  assert.equal(classifyFailure("AssertionError: expected 5 but got 3"), "logic");
  assert.equal(classifyFailure("test failed: expected 'a' received 'b'"), "logic");
});

test("classifyFailure identifies resource errors", () => {
  assert.equal(classifyFailure("ETIMEDOUT: connection timeout"), "resource");
  assert.equal(classifyFailure("ECONNREFUSED: connection refused"), "resource");
  assert.equal(classifyFailure("OutOfMemoryError"), "resource");
});

test("classifyFailure returns unknown for unrecognized", () => {
  assert.equal(classifyFailure("some unknown error message"), "unknown");
});
