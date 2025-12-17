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
 * Generate embeddings for multiple texts using Ollama
 * Processes in batches for efficiency
 */
export async function embedTextsOllama(
  texts: string[],
  config: OllamaConfig,
  batchSize: number = 10
): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Process in batches to avoid overwhelming Ollama
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(
      batch.map((text) => embedTextOllama(text, config))
    );
    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
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
