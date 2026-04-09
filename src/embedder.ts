import type { EmbedderHealth, EmbedderRetryConfig, EmbeddingConfig } from "./types.js";
import { log } from "./logger.js";

export interface Embedder {
  readonly model: string;
  embed(text: string): Promise<number[]>;
  dim(): Promise<number>;
}

let globalEmbedderHealth: EmbedderHealth = {
  status: "healthy",
  lastError: null,
  lastSuccess: null,
  retryCount: 0,
  fallbackActive: false,
};

export function getEmbedderHealth(): EmbedderHealth {
  return globalEmbedderHealth;
}

export function setEmbedderHealth(health: Partial<EmbedderHealth>): void {
  globalEmbedderHealth = { ...globalEmbedderHealth, ...health };
}

export function resetEmbedderHealth(): void {
  globalEmbedderHealth = {
    status: "healthy",
    lastError: null,
    lastSuccess: null,
    retryCount: 0,
    fallbackActive: false,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedWithRetry(
  embedder: Embedder,
  config: EmbeddingConfig,
  text: string,
): Promise<number[]> {
  const retry = config.retry ?? {
    enabled: true,
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
  };

  if (!retry.enabled) {
    return embedder.embed(text);
  }

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < retry.maxAttempts) {
    attempt++;
    try {
      const result = await embedder.embed(text);
      globalEmbedderHealth.lastSuccess = Date.now();
      globalEmbedderHealth.lastError = null;
      if (globalEmbedderHealth.status === "degraded") {
        globalEmbedderHealth.status = "healthy";
        log("info", "Embedder recovered, resuming normal mode");
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      globalEmbedderHealth.retryCount++;
      globalEmbedderHealth.lastError = lastError.message;

      if (attempt >= retry.maxAttempts) {
        break;
      }

      const delay = Math.floor(
        retry.initialDelayMs * Math.pow(retry.backoffMultiplier, attempt - 1),
      );
      log("warn", `Embedder failed (attempt ${attempt}/${retry.maxAttempts}), retrying in ${delay}ms: ${lastError.message}`);
      await sleep(delay);
    }
  }

  globalEmbedderHealth.status = "degraded";
  globalEmbedderHealth.fallbackActive = true;
  log("warn", `Embedder unavailable after ${retry.maxAttempts} attempts, falling back to BM25-only search`);
  throw lastError;
}

async function dimWithRetry(embedder: Embedder, config: EmbeddingConfig): Promise<number> {
  const retry = config.retry ?? {
    enabled: true,
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
  };

  if (!retry.enabled) {
    return embedder.dim();
  }

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < retry.maxAttempts) {
    attempt++;
    try {
      const result = await embedder.dim();
      globalEmbedderHealth.lastSuccess = Date.now();
      globalEmbedderHealth.lastError = null;
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      globalEmbedderHealth.retryCount++;
      globalEmbedderHealth.lastError = lastError.message;

      if (attempt >= retry.maxAttempts) {
        break;
      }

      const delay = Math.floor(
        retry.initialDelayMs * Math.pow(retry.backoffMultiplier, attempt - 1),
      );
      await sleep(delay);
    }
  }

  globalEmbedderHealth.status = "degraded";
  globalEmbedderHealth.fallbackActive = true;
  throw lastError;
}

interface OllamaEmbeddingResponse {
  embedding?: number[];
}

interface OpenAIEmbeddingResponse {
  data?: Array<{
    embedding?: number[];
  }>;
}

const KNOWN_MODEL_DIMS: Record<string, number> = {
  "nomic-embed-text": 768,
  "mxbai-embed-large": 1024,
  "all-minilm": 384,
  "snowflake-arctic-embed": 1024,
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

function fallbackDim(model: string): number | null {
  const normalized = model.toLowerCase().replace(/:.*$/, "");
  for (const [prefix, dim] of Object.entries(KNOWN_MODEL_DIMS)) {
    if (normalized === prefix || normalized.startsWith(`${prefix}:`)) return dim;
  }
  return null;
}

export class OllamaEmbedder implements Embedder {
  readonly model: string;
  private cachedDim: number | null = null;

  constructor(private readonly config: EmbeddingConfig) {
    this.model = config.model;
  }

  async embed(text: string): Promise<number[]> {
    const endpoint = `${this.config.baseUrl ?? "http://127.0.0.1:11434"}/api/embeddings`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 6000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding request failed: HTTP ${response.status}`);
      }

      const data = (await response.json()) as OllamaEmbeddingResponse;
      if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
        throw new Error("Ollama embedding response missing embedding vector");
      }

      if (this.cachedDim === null) {
        this.cachedDim = data.embedding.length;
      }

      return data.embedding;
    } finally {
      clearTimeout(timeout);
    }
  }

  async dim(): Promise<number> {
    if (this.cachedDim !== null) return this.cachedDim;
    try {
      const probe = await this.embed("dimension probe");
      this.cachedDim = probe.length;
      return this.cachedDim;
    } catch {
      const fb = fallbackDim(this.model);
      if (fb !== null) {
        log("warn", `Ollama unreachable, using fallback dim ${fb} for model "${this.model}"`);
        return fb;
      }
      throw new Error(
        `Ollama unreachable and no known fallback dimension for model "${this.model}"`,
      );
    }
  }
}

export class OpenAIEmbedder implements Embedder {
  readonly model: string;
  private cachedDim: number | null = null;

  constructor(private readonly config: EmbeddingConfig) {
    this.model = config.model;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.config.apiKey) {
      throw new Error(
        "OpenAI embedding request failed: missing apiKey. Set embedding.apiKey or LANCEDB_OPENCODE_PRO_OPENAI_API_KEY.",
      );
    }

    const baseUrl = (this.config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    const endpoint = `${baseUrl}/embeddings`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 6000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          input: text,
          encoding_format: "float",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        const suffix = details ? ` - ${details.slice(0, 240)}` : "";
        throw new Error(`OpenAI embedding request failed: HTTP ${response.status}${suffix}`);
      }

      const data = (await response.json()) as OpenAIEmbeddingResponse;
      const vector = data.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error("OpenAI embedding response missing embedding vector");
      }

      if (this.cachedDim === null) {
        this.cachedDim = vector.length;
      }

      return vector;
    } finally {
      clearTimeout(timeout);
    }
  }

  async dim(): Promise<number> {
    if (this.cachedDim !== null) return this.cachedDim;
    try {
      const probe = await this.embed("dimension probe");
      this.cachedDim = probe.length;
      return this.cachedDim;
    } catch {
      const fb = fallbackDim(this.model);
      if (fb !== null) {
        log("warn", `OpenAI embedding probe failed, using fallback dim ${fb} for model "${this.model}"`);
        return fb;
      }
      throw new Error(
        `OpenAI embedding probe failed and no known fallback dimension for model "${this.model}"`,
      );
    }
  }
}

export function createEmbedder(config: EmbeddingConfig): Embedder {
  const inner = config.provider === "openai"
    ? new OpenAIEmbedder(config)
    : new OllamaEmbedder(config);

  return {
    get model() {
      return inner.model;
    },
    async embed(text: string): Promise<number[]> {
      return embedWithRetry(inner, config, text);
    },
    async dim(): Promise<number> {
      return dimWithRetry(inner, config);
    },
  };
}
