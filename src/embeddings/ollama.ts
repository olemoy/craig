/**
 * Ollama embedding provider
 * Uses local Ollama instance for generating embeddings
 */

import { Ollama } from 'ollama';
import type { OllamaConfig } from '../config/index.js';

let ollamaClient: Ollama | null = null;

/**
 * Initialize Ollama client
 */
export function getOllamaClient(config: OllamaConfig): Ollama {
  if (!ollamaClient) {
    ollamaClient = new Ollama({
      host: config.baseUrl,
    });
  }
  return ollamaClient;
}

/**
 * Generate embedding for a single text using Ollama
 */
export async function embedTextOllama(
  text: string,
  config: OllamaConfig
): Promise<number[]> {
  const client = getOllamaClient(config);

  try {
    const response = await client.embeddings({
      model: config.model,
      prompt: text,
      options: config.options,
    });

    return response.embedding;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Ollama embedding failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in a single batch request
 * Uses Ollama's batch embedding API for efficiency
 */
async function embedBatchOllama(
  texts: string[],
  config: OllamaConfig
): Promise<number[][]> {
  const client = getOllamaClient(config);

  try {
    // Use 'input' parameter for batch processing (not 'prompt')
    const response = await client.embed({
      model: config.model,
      input: texts,
      // @ts-ignore - options may not be in type definitions yet
      options: config.options,
    });

    return response.embeddings;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Ollama batch embedding failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts using Ollama with batching and concurrency
 *
 * Uses Ollama's batch API to reduce HTTP overhead by embedding multiple texts per request.
 * Processes batches in parallel for optimal throughput without overwhelming the server.
 *
 * Features:
 * - Batches texts into groups (default 20 per batch) to reduce API calls
 * - Processes multiple batches concurrently (respects maxConcurrent)
 * - Automatic retry logic for failed batches
 * - Request timeouts to prevent hanging
 * - Frequent progress updates
 *
 * @param texts - Array of texts to embed
 * @param config - Ollama configuration
 * @param onProgress - Optional progress callback (completed, total)
 */
export async function embedTextsOllama(
  texts: string[],
  config: OllamaConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const maxConcurrent = config.maxConcurrent ?? 50;
  const batchSize = 20; // Embed 20 texts per API call
  const maxRetries = 3;
  const timeoutMs = 30000; // 30 second timeout per batch

  // Split texts into batches
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }

  const results: number[][] = [];
  let completed = 0;
  let nextBatchIndex = 0;

  // Process a single batch with retry logic
  const processBatch = async (batch: string[], retries = maxRetries): Promise<number[][]> => {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Batch embedding timeout')), timeoutMs)
      );

      const embedPromise = embedBatchOllama(batch, config);
      const embeddings = await Promise.race([embedPromise, timeoutPromise]);

      completed += batch.length;
      if (onProgress) {
        onProgress(completed, texts.length);
      }

      return embeddings;
    } catch (error) {
      if (retries > 0) {
        // Retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, (maxRetries - retries + 1) * 1000));
        return processBatch(batch, retries - 1);
      }
      throw error;
    }
  };

  // Worker function that processes batches from the queue
  const worker = async (): Promise<void> => {
    while (nextBatchIndex < batches.length) {
      const batchIndex = nextBatchIndex++;
      const batch = batches[batchIndex];

      if (batch) {
        const embeddings = await processBatch(batch);
        results.push(...embeddings);
      }
    }
  };

  // Start worker pool
  const workers: Promise<void>[] = [];
  const workerCount = Math.min(maxConcurrent, batches.length);

  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  return results;
}

/**
 * Check if Ollama is available and the model is installed
 */
export async function checkOllamaAvailability(
  config: OllamaConfig
): Promise<{ available: boolean; error?: string }> {
  try {
    const client = getOllamaClient(config);

    // Try to list models to check if Ollama is running
    const models = await client.list();

    // Check if the configured model is available
    const modelExists = models.models.some(
      (m) => m.name === config.model || m.name.startsWith(config.model + ':')
    );

    if (!modelExists) {
      return {
        available: false,
        error: `Model "${config.model}" not found. Available models: ${models.models.map((m) => m.name).join(', ')}`,
      };
    }

    return { available: true };
  } catch (error) {
    if (error instanceof Error) {
      return {
        available: false,
        error: `Cannot connect to Ollama at ${config.baseUrl}: ${error.message}`,
      };
    }
    return {
      available: false,
      error: 'Unknown error connecting to Ollama',
    };
  }
}
