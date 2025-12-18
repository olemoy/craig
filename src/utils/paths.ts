/**
 * Path utilities for resolving project-relative paths
 */
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Get the project root directory
 * Works regardless of where the process is started from
 */
export function getProjectRoot(): string {
  // This file is at src/utils/paths.ts, so project root is two directories up
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '../..');
}

/**
 * Resolve a path relative to the project root
 */
export function resolveProjectPath(...segments: string[]): string {
  return path.join(getProjectRoot(), ...segments);
}
