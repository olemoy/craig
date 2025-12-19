import { getPipeline } from "./cache";
import { getModelConfig } from "./config";
import { getEmbeddingProvider } from "../config/index.js";
import { embedTextOllama, embedTextsOllama } from "./ollama.js";
import type { OllamaConfig } from "../config/index.js";

interface TensorLike {
  data: Float32Array | number[];
  dims?: number[];
}

interface ModelConfig {
  pooling: string;
  normalize: boolean;
  dimensions: number;
}

interface EmbeddingProvider {
  provider: 'ollama' | 'transformers';
  config: OllamaConfig | Record<string, unknown>;
}

function l2normalize(vec: number[]) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0) || 1);
  return vec.map((v) => v / norm);
}

function isOllamaConfig(config: OllamaConfig | Record<string, unknown>): config is OllamaConfig {
  return 'model' in config && typeof config.model === 'string';
}

export async function embedText(text: string): Promise<number[]> {
  const provider = getEmbeddingProvider() as EmbeddingProvider;

  if (provider.provider === "ollama") {
    if (!isOllamaConfig(provider.config)) {
      throw new Error('Invalid Ollama config');
    }
    return embedTextOllama(text, provider.config);
  }

  // Transformers.js implementation
  const modelConfig = getModelConfig() as ModelConfig;
  const pipe = await getPipeline();
  const result = await pipe(text, { pooling: modelConfig.pooling });

  // Extract the embedding vector from the result
  let vec: number[];
  if (result && typeof result === "object" && "data" in result) {
    // Handle Tensor object
    const tensorResult = result as TensorLike;
    vec = Array.from(tensorResult.data);
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
 *
 * @param texts - Array of texts to embed
 * @param onProgress - Optional progress callback (completed, total)
 */
export async function embedTexts(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const provider = getEmbeddingProvider() as EmbeddingProvider;

  if (provider.provider === "ollama") {
    if (!isOllamaConfig(provider.config)) {
      throw new Error('Invalid Ollama config');
    }
    return embedTextsOllama(texts, provider.config, onProgress);
  }

  // Transformers.js implementation - batch processing for progress tracking
  const modelConfig = getModelConfig() as ModelConfig;
  const pipe = await getPipeline();

  // For large batches, split into smaller chunks to report progress
  const BATCH_SIZE = 500;
  if (texts.length > BATCH_SIZE && onProgress) {
    const allResults: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const result = await pipe(batch, { pooling: modelConfig.pooling });

      // Extract embeddings from batch result
      const batchResults = extractEmbeddings(result, batch.length, modelConfig);
      allResults.push(...batchResults);

      // Report progress
      onProgress(Math.min(i + BATCH_SIZE, texts.length), texts.length);
    }

    return allResults;
  }

  // Single batch for small inputs
  const result = await pipe(texts, { pooling: modelConfig.pooling });
  const results = extractEmbeddings(result, texts.length, modelConfig);

  if (onProgress) {
    onProgress(texts.length, texts.length);
  }

  return results;
}

/**
 * Extract embeddings from pipeline result
 */
function extractEmbeddings(result: unknown, textCount: number, modelConfig: ModelConfig): number[][] {
  const results: number[][] = [];

  if (
    result &&
    typeof result === "object" &&
    "data" in result &&
    "dims" in result
  ) {
    // Handle batched Tensor output
    const tensorResult = result as TensorLike & { dims: number[] };
    const data = tensorResult.data;
    const dims = tensorResult.dims;
    const embeddingDim = dims[dims.length - 1] ?? modelConfig.dimensions;

    for (let i = 0; i < textCount; i++) {
      const start = i * embeddingDim;
      const end = start + embeddingDim;
      const vec = Array.from(data.slice(start, end));
      results.push(modelConfig.normalize ? l2normalize(vec) : vec);
    }
  } else if (Array.isArray(result)) {
    // Handle array of arrays
    for (const vec of result) {
      let vecArray: number[];
      if (Array.isArray(vec)) {
        vecArray = vec;
      } else if (vec && typeof vec === 'object' && 'data' in vec) {
        const tensorVec = vec as TensorLike;
        vecArray = Array.from(tensorVec.data);
      } else {
        throw new Error(`Unexpected vector format in batch result`);
      }
      results.push(modelConfig.normalize ? l2normalize(vecArray) : vecArray);
    }
  } else {
    throw new Error(
      `Unexpected batch embedding result format: ${typeof result}`,
    );
  }

  return results;
}
