import type { EmbeddingConfig } from "./types.js";

export interface Embedder {
  readonly model: string;
  embed(text: string): Promise<number[]>;
  dim(): Promise<number>;
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
        console.warn(
          `[lancedb-opencode-pro] Ollama unreachable, using fallback dim ${fb} for model "${this.model}"`,
        );
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
        console.warn(
          `[lancedb-opencode-pro] OpenAI embedding probe failed, using fallback dim ${fb} for model "${this.model}"`,
        );
        return fb;
      }
      throw new Error(
        `OpenAI embedding probe failed and no known fallback dimension for model "${this.model}"`,
      );
    }
  }
}

export function createEmbedder(config: EmbeddingConfig): Embedder {
  if (config.provider === "openai") {
    return new OpenAIEmbedder(config);
  }
  return new OllamaEmbedder(config);
}
