import { getPipeline } from "./cache";
import { getModelConfig } from "./config";
import { getEmbeddingProvider } from "../config/index.js";
import { embedTextOllama, embedTextsOllama } from "./ollama.js";
import type { OllamaConfig } from "../config/index.js";

// Database schema requires 384-dimensional vectors (hardcoded in migration)
const REQUIRED_DIMENSIONS = 768;

function l2normalize(vec: number[]) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0) || 1);
  return vec.map((v) => v / norm);
}

function validateDimensions(provider: ReturnType<typeof getEmbeddingProvider>) {
  if (provider.dimensions !== REQUIRED_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: config specifies ${provider.dimensions} dimensions, ` +
        `but database requires ${REQUIRED_DIMENSIONS} dimensions. ` +
        `Either:\n` +
        `  1. Update config.json to use a model with ${REQUIRED_DIMENSIONS} dimensions, OR\n` +
        `  2. Delete the database (rm -rf data/) and update the migration to use vector(${provider.dimensions}), then re-ingest all repositories.`,
    );
  }
}

export async function embedText(text: string): Promise<number[]> {
  const provider = getEmbeddingProvider();
  validateDimensions(provider);

  if (provider.provider === "ollama") {
    return embedTextOllama(text, provider.config as OllamaConfig);
  }

  // Transformers.js implementation
  const modelConfig = getModelConfig();
  const pipe = await getPipeline();
  const result = await pipe(text, { pooling: modelConfig.pooling });

  // Extract the embedding vector from the result
  let vec: number[];
  if (result && typeof result === "object" && "data" in result) {
    // Handle Tensor object
    vec = Array.from(result.data as number[]);
  } else if (Array.isArray(result) && Array.isArray(result[0])) {
    // Handle nested array
    vec = result[0];
  } else if (Array.isArray(result)) {
    // Handle flat array
    vec = result;
  } else {
    throw new Error(`Unexpected embedding result format: ${typeof result}`);
  }

  return modelConfig.normalize ? l2normalize(vec) : vec;
}

/**
 * Batch embed multiple texts at once (much faster than calling embedText repeatedly)
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const provider = getEmbeddingProvider();
  validateDimensions(provider);

  if (provider.provider === "ollama") {
    return embedTextsOllama(texts, provider.config as OllamaConfig);
  }

  // Transformers.js implementation
  const modelConfig = getModelConfig();
  const pipe = await getPipeline();
  const result = await pipe(texts, { pooling: modelConfig.pooling });

  // Extract embeddings from batch result
  const results: number[][] = [];

  if (
    result &&
    typeof result === "object" &&
    "data" in result &&
    "dims" in result
  ) {
    // Handle batched Tensor output
    const data = result.data as Float32Array | number[];
    const dims = result.dims as number[];
    const embeddingDim = dims[dims.length - 1] ?? modelConfig.dimensions;

    for (let i = 0; i < texts.length; i++) {
      const start = i * embeddingDim;
      const end = start + embeddingDim;
      const vec = Array.from(data.slice(start, end));
      results.push(modelConfig.normalize ? l2normalize(vec) : vec);
    }
  } else if (Array.isArray(result)) {
    // Handle array of arrays
    for (const vec of result) {
      const vecArray = Array.isArray(vec) ? vec : Array.from(vec as any);
      results.push(modelConfig.normalize ? l2normalize(vecArray) : vecArray);
    }
  } else {
    throw new Error(
      `Unexpected batch embedding result format: ${typeof result}`,
    );
  }

  return results;
}
