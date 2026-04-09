import type { OpencodeClient } from "@opencode-ai/sdk";

type LogLevel = "debug" | "info" | "warn" | "error";

const SERVICE_NAME = "lancedb-opencode-pro";

let _client: OpencodeClient | null = null;

export function initLogger(client: OpencodeClient): void {
  _client = client;
}

// Routes to client.app.log() when SDK client is bound, otherwise falls back to console.
export function log(
  level: LogLevel,
  message: string,
  extra?: Record<string, unknown>,
): void {
  if (_client?.app?.log) {
    _client.app
      .log({
        body: {
          service: SERVICE_NAME,
          level,
          message,
          ...(extra !== undefined ? { extra } : {}),
        },
      })
      .catch(() => consoleFallback(level, message));
    return;
  }

  consoleFallback(level, message);
}

function consoleFallback(level: LogLevel, message: string): void {
  const formatted = `[${SERVICE_NAME}] ${message}`;
  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    default:
      console.log(formatted);
      break;
  }
}
