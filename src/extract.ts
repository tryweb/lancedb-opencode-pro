import type { CaptureCandidate, MemoryCategory } from "./types.js";

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

export function extractCaptureCandidate(text: string, minChars: number): CaptureCandidate | null {
  const normalized = text.trim();
  if (normalized.length < minChars) return null;

  const lower = normalized.toLowerCase();
  if (!POSITIVE_SIGNALS.some((signal) => lower.includes(signal.toLowerCase()))) {
    return null;
  }

  const category = classifyCategory(lower);
  const importance = category === "decision" ? 0.9 : category === "fact" ? 0.75 : 0.65;

  return {
    text: clipText(normalized, 1200),
    category,
    importance,
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
