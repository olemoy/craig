import type { ModelConfig } from './types';
import { getEmbeddingProvider } from '../config/index.js';

/**
 * Get model configuration from config.json
 * Reads transformers settings dynamically from the config file
 */
export function getModelConfig(): ModelConfig {
  const provider = getEmbeddingProvider();

  if (provider.provider !== 'transformers') {
    throw new Error('getModelConfig() should only be called when using transformers provider');
  }

  const transformersConfig = provider.config as {
    model: string;
    dimensions: number;
    pooling?: 'mean' | 'cls';
    normalize?: boolean;
  };

  return {
    modelId: transformersConfig.model,
    dimensions: transformersConfig.dimensions,
    pooling: transformersConfig.pooling ?? 'mean',
    normalize: transformersConfig.normalize ?? true,
  };
}
