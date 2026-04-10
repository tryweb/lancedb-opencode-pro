import assert from "node:assert";
import test from "node:test";

const CODING_KEYWORDS = ["bug", "error", "function", "refactor", "implement", "fix", "code", "class", "module", "import", "export", "async", "await", "typescript", "javascript", "python", "debug", "stack", "trace"];
const DOCS_KEYWORDS = ["document", "readme", "explain", "describe", "guide", "tutorial", "reference", "api", "specification", "write", "create doc"];
const REVIEW_KEYWORDS = ["review", "pr", "pull request", "check", "approve", "reject", "comment", "feedback", "lgtm", "nitpick"];
const RELEASE_KEYWORDS = ["deploy", "release", "version", "build", "publish", "npm", "docker", "ci", "cd", "pipeline", "rollback"];

function detectTaskType(query: string): "coding" | "documentation" | "review" | "release" | "general" {
  const lowerQuery = query.toLowerCase();
  const codingScore = CODING_KEYWORDS.filter((kw) => lowerQuery.includes(kw)).length;
  const docsScore = DOCS_KEYWORDS.filter((kw) => lowerQuery.includes(kw)).length;
  const reviewScore = REVIEW_KEYWORDS.filter((kw) => lowerQuery.includes(kw)).length;
  const releaseScore = RELEASE_KEYWORDS.filter((kw) => lowerQuery.includes(kw)).length;
  const maxScore = Math.max(codingScore, docsScore, reviewScore, releaseScore);
  if (maxScore === 0) return "general";
  if (codingScore === maxScore) return "coding";
  if (docsScore === maxScore) return "documentation";
  if (reviewScore === maxScore) return "review";
  if (releaseScore === maxScore) return "release";
  return "general";
}

const defaultProfiles = {
  coding: { maxMemories: 4, budgetTokens: 5120, summaryTargetChars: 400, categoryWeights: { decision: 1.5, entity: 1.2, fact: 1.0, preference: 0.8, other: 0.5 } },
  documentation: { maxMemories: 3, budgetTokens: 3072, summaryTargetChars: 500, categoryWeights: { decision: 1.4, fact: 1.3, entity: 1.2, preference: 0.8, other: 0.5 } },
  review: { maxMemories: 3, budgetTokens: 4096, summaryTargetChars: 300, categoryWeights: { preference: 1.4, decision: 1.2, entity: 1.0, fact: 0.9, other: 0.5 } },
  release: { maxMemories: 4, budgetTokens: 6144, summaryTargetChars: 350, categoryWeights: { decision: 1.5, entity: 1.3, fact: 1.2, preference: 0.8, other: 0.5 } },
  general: { maxMemories: 3, budgetTokens: 4096, summaryTargetChars: 300, categoryWeights: { decision: 1.3, fact: 1.0, entity: 1.0, preference: 0.9, other: 0.5 } },
};

type TaskType = "coding" | "documentation" | "review" | "release" | "general";
type MemoryCategory = "preference" | "fact" | "decision" | "entity" | "other";

function getCategoryWeights(taskType: TaskType, profiles: typeof defaultProfiles): Record<MemoryCategory, number> {
  const weights = profiles[taskType]?.categoryWeights ?? profiles.general.categoryWeights;
  return {
    decision: weights.decision ?? 1.0,
    fact: weights.fact ?? 1.0,
    entity: weights.entity ?? 1.0,
    preference: weights.preference ?? 1.0,
    other: weights.other ?? 1.0,
  };
}

test("detectTaskType returns coding for coding keywords", () => {
  assert.equal(detectTaskType("Fix this bug in my function"), "coding");
  assert.equal(detectTaskType("Implement a new module in TypeScript"), "coding");
  assert.equal(detectTaskType("Debug the stack trace error"), "coding");
});

test("detectTaskType returns documentation for docs keywords", () => {
  assert.equal(detectTaskType("Write documentation for this API"), "documentation");
  assert.equal(detectTaskType("Explain how to use this feature"), "documentation");
  assert.equal(detectTaskType("Create README for the project"), "documentation");
});

test("detectTaskType returns review for review keywords", () => {
  assert.equal(detectTaskType("Review this PR please"), "review");
  assert.equal(detectTaskType("Check and approve the pull request"), "review");
  assert.equal(detectTaskType("LGTM, just a few comments"), "review");
});

test("detectTaskType returns release for release keywords", () => {
  assert.equal(detectTaskType("Deploy this version to production"), "release");
  assert.equal(detectTaskType("Build and publish the npm package"), "release");
  assert.equal(detectTaskType("Set up CI/CD pipeline"), "release");
});

test("detectTaskType returns general for unknown queries", () => {
  assert.equal(detectTaskType("Hello, how are you?"), "general");
  assert.equal(detectTaskType("What is the weather today?"), "general");
});

test("getCategoryWeights returns correct weights for coding", () => {
  const weights = getCategoryWeights("coding", defaultProfiles);
  assert.equal(weights.decision, 1.5);
  assert.equal(weights.entity, 1.2);
  assert.equal(weights.fact, 1.0);
});

test("getCategoryWeights returns correct weights for documentation", () => {
  const weights = getCategoryWeights("documentation", defaultProfiles);
  assert.equal(weights.decision, 1.4);
  assert.equal(weights.fact, 1.3);
  assert.equal(weights.entity, 1.2);
});

test("getCategoryWeights returns correct weights for review", () => {
  const weights = getCategoryWeights("review", defaultProfiles);
  assert.equal(weights.preference, 1.4);
  assert.equal(weights.decision, 1.2);
});

test("getCategoryWeights returns correct weights for release", () => {
  const weights = getCategoryWeights("release", defaultProfiles);
  assert.equal(weights.decision, 1.5);
  assert.equal(weights.entity, 1.3);
  assert.equal(weights.fact, 1.2);
});

test("getCategoryWeights returns correct weights for general", () => {
  const weights = getCategoryWeights("general", defaultProfiles);
  assert.equal(weights.decision, 1.3);
  assert.equal(weights.fact, 1.0);
  assert.equal(weights.entity, 1.0);
});

test("profiles have correct maxMemories values", () => {
  assert.equal(defaultProfiles.coding.maxMemories, 4);
  assert.equal(defaultProfiles.documentation.maxMemories, 3);
  assert.equal(defaultProfiles.review.maxMemories, 3);
  assert.equal(defaultProfiles.release.maxMemories, 4);
  assert.equal(defaultProfiles.general.maxMemories, 3);
});

test("profiles have correct budgetTokens values", () => {
  assert.equal(defaultProfiles.coding.budgetTokens, 5120);
  assert.equal(defaultProfiles.documentation.budgetTokens, 3072);
  assert.equal(defaultProfiles.review.budgetTokens, 4096);
  assert.equal(defaultProfiles.release.budgetTokens, 6144);
  assert.equal(defaultProfiles.general.budgetTokens, 4096);
});
