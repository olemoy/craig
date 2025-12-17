export const DEFAULT_CONFIG = {
  tokenTarget: 500,
  overlapTokens: 64,
  maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
  concurrency: 4,
};

export type ProcessingConfig = typeof DEFAULT_CONFIG;
