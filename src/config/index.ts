/**
 * Configuration management
 * Loads and validates config.json
 */

import fs from 'fs';
import path from 'path';

export interface TransformersConfig {
  model: string;
  dimensions: number;
  pooling?: 'mean' | 'cls';
  normalize?: boolean;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  dimensions: number;
  maxConcurrent?: number; // Max concurrent embedding requests (default: 50)
  options?: {
    temperature?: number;
    [key: string]: any;
  };
}

export interface EmbeddingConfig {
  provider: 'transformers' | 'ollama';
  transformers: TransformersConfig;
  ollama: OllamaConfig;
}

export interface ProcessingConfig {
  maxFileSizeBytes: number;
  tokenTarget: number;
  overlapTokens: number;
  concurrency: number;
}

export interface Config {
  embedding: EmbeddingConfig;
  processing?: ProcessingConfig;
}

let cachedConfig: Config | null = null;

/**
 * Load configuration from config.json
 */
export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.resolve(process.cwd(), 'config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(
      'config.json not found. Please create one based on config.example.json'
    );
  }

  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData) as Config;

    // Validate config
    if (!config.embedding?.provider) {
      throw new Error('config.json: embedding.provider is required');
    }

    if (!['transformers', 'ollama'].includes(config.embedding.provider)) {
      throw new Error(
        'config.json: embedding.provider must be "transformers" or "ollama"'
      );
    }

    cachedConfig = config;
    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('config.json: Invalid JSON format');
    }
    throw error;
  }
}

/**
 * Get embedding configuration
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  return loadConfig().embedding;
}

/**
 * Get the current embedding provider settings
 */
export function getEmbeddingProvider(): {
  provider: 'transformers' | 'ollama';
  config: TransformersConfig | OllamaConfig;
  dimensions: number;
} {
  const embeddingConfig = getEmbeddingConfig();
  const provider = embeddingConfig.provider;

  if (provider === 'ollama') {
    return {
      provider: 'ollama',
      config: embeddingConfig.ollama,
      dimensions: embeddingConfig.ollama.dimensions,
    };
  }

  return {
    provider: 'transformers',
    config: embeddingConfig.transformers,
    dimensions: embeddingConfig.transformers.dimensions,
  };
}

/**
 * Get processing configuration with defaults
 */
export function getProcessingConfig(): ProcessingConfig {
  const config = loadConfig();

  // Provide defaults if not specified in config
  return {
    maxFileSizeBytes: config.processing?.maxFileSizeBytes ?? 10 * 1024 * 1024, // 10MB default
    tokenTarget: config.processing?.tokenTarget ?? 500,
    overlapTokens: config.processing?.overlapTokens ?? 64,
    concurrency: config.processing?.concurrency ?? 4,
  };
}
