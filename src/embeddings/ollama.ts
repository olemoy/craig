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
 * Generate embeddings for multiple texts using Ollama with proper concurrency limiting
 *
 * Maintains exactly maxConcurrent requests in-flight at any time for optimal throughput
 * without overwhelming the Ollama server.
 *
 * Uses a worker pool approach: maintains a pool of workers that process texts from a queue,
 * ensuring consistent parallelism throughout the operation.
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
  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  let completed = 0;
  let nextIndex = 0;

  // Worker function that processes texts from the queue
  const worker = async (): Promise<void> => {
    while (nextIndex < texts.length) {
      const index = nextIndex++;
      const text = texts[index];

      if (text !== undefined) {
        const embedding = await embedTextOllama(text, config);
        results[index] = embedding;
        completed++;

        // Report progress periodically
        if (onProgress && (completed % 50 === 0 || completed === texts.length)) {
          onProgress(completed, texts.length);
        }
      }
    }
  };

  // Start worker pool
  const workers: Promise<void>[] = [];
  const workerCount = Math.min(maxConcurrent, texts.length);

  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  // Filter out any null values (shouldn't happen, but TypeScript safety)
  return results.filter((r): r is number[] => r !== null);
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
