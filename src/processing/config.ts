/**
 * Processing configuration
 * Reads from config.json for all processing settings
 */

import { getProcessingConfig } from '../config/index.js';

/**
 * Get the current processing configuration from config.json
 * Falls back to sensible defaults if not specified
 */
export function getConfig() {
  return getProcessingConfig();
}

// For backwards compatibility, export DEFAULT_CONFIG that reads from config
export const DEFAULT_CONFIG = getConfig();
export type ProcessingConfig = ReturnType<typeof getConfig>;
