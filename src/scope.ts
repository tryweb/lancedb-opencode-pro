import { execFileSync } from "node:child_process";
import { stableHash } from "./utils.js";

export function deriveProjectScope(worktree: string): string {
  const remote = tryGetGitRemote(worktree);
  if (remote) {
    return `project:${stableHash(remote).slice(0, 16)}`;
  }
  return `project:local:${stableHash(worktree).slice(0, 16)}`;
}

export function buildScopeFilter(activeScope: string, includeGlobal: boolean): string[] {
  return includeGlobal ? [activeScope, "global"] : [activeScope];
}

function tryGetGitRemote(worktree: string): string | null {
  try {
    const output = execFileSync("git", ["-C", worktree, "config", "--get", "remote.origin.url"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return output.length > 0 ? output : null;
  } catch {
    return null;
  }
}
