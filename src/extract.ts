import type { CaptureCandidateResult, MemoryCategory } from "./types.js";

const POSITIVE_SIGNALS = [
  "fixed",
  "resolved",
  "works now",
  "successful",
  "done",
  "完成",
  "已解決",
  "修復",
  "成功",
];

const DECISION_SIGNALS = ["decide", "decision", "tradeoff", "architecture", "採用", "決定", "架構"];
const FACT_SIGNALS = ["because", "root cause", "原因", "由於"];
const PREF_SIGNALS = ["prefer", "preference", "偏好", "習慣"];

const GLOBAL_KEYWORDS = [
  // Distributions
  "alpine",
  "debian",
  "ubuntu",
  "centos",
  "fedora",
  "arch",
  // Containers
  "docker",
  "dockerfile",
  "docker-compose",
  "containerd",
  // Orchestration
  "kubernetes",
  "k8s",
  "helm",
  "kubectl",
  // Shells/Systems
  "bash",
  "shell",
  "linux",
  "unix",
  "posix",
  "busybox",
  // Web servers
  "nginx",
  "apache",
  "caddy",
  // Databases
  "postgres",
  "postgresql",
  "mysql",
  "redis",
  "mongodb",
  "sqlite",
  // Cloud
  "aws",
  "gcp",
  "azure",
  "digitalocean",
  // VCS
  "git",
  "github",
  "gitlab",
  "bitbucket",
  // Protocols
  "api",
  "rest",
  "graphql",
  "grpc",
  "http",
  "https",
  // Package managers
  "npm",
  "yarn",
  "pnpm",
  "pip",
  "cargo",
  "make",
  "cmake",
];

export function extractCaptureCandidate(text: string, minChars: number): CaptureCandidateResult {
  const normalized = text.trim();
  if (normalized.length < minChars) {
    return { candidate: null, skipReason: "below-min-chars" };
  }

  const lower = normalized.toLowerCase();
  if (!POSITIVE_SIGNALS.some((signal) => lower.includes(signal.toLowerCase()))) {
    return { candidate: null, skipReason: "no-positive-signal" };
  }

  const category = classifyCategory(lower);
  const importance = category === "decision" ? 0.9 : category === "fact" ? 0.75 : 0.65;

  return {
    candidate: {
      text: clipText(normalized, 1200),
      category,
      importance,
    },
  };
}

function classifyCategory(text: string): MemoryCategory {
  if (DECISION_SIGNALS.some((signal) => text.includes(signal.toLowerCase()))) return "decision";
  if (FACT_SIGNALS.some((signal) => text.includes(signal.toLowerCase()))) return "fact";
  if (PREF_SIGNALS.some((signal) => text.includes(signal.toLowerCase()))) return "preference";
  return "other";
}

function clipText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

export function detectGlobalWorthiness(content: string): number {
  const lower = content.toLowerCase();
  let matches = 0;
  for (const keyword of GLOBAL_KEYWORDS) {
    if (lower.includes(keyword)) {
      matches += 1;
    }
  }
  return matches;
}

export function isGlobalCandidate(content: string, threshold: number): boolean {
  return detectGlobalWorthiness(content) >= threshold;
}
