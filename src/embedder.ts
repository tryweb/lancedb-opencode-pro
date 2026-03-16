import type { EmbeddingConfig } from "./types.js";

export interface Embedder {
  readonly model: string;
  embed(text: string): Promise<number[]>;
  dim(): Promise<number>;
}

interface OllamaEmbeddingResponse {
  embedding?: number[];
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
    const probe = await this.embed("dimension probe");
    this.cachedDim = probe.length;
    return this.cachedDim;
  }
}
