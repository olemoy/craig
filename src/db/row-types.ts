/**
 * Type-safe database row types
 *
 * These types represent the raw data returned from PGlite queries.
 * They are used to safely map database results to application types.
 *
 * IMPORTANT: These types match the actual database schema.
 * Any changes to migrations should be reflected here.
 */

/**
 * Raw repository row from database
 */
export interface RepositoryRow {
  id: string; // UUID
  name: string;
  path: string;
  commit_sha: string | null;
  ingested_at: string; // ISO timestamp
  metadata: string | null; // JSON string
}

/**
 * Raw file row from database
 */
export interface FileRow {
  id: number;
  repository_id: string; // UUID
  file_path: string;
  file_type: 'code' | 'text' | 'binary';
  content: string | null;
  binary_metadata: string | null; // JSON string
  content_hash: string;
  size_bytes: number;
  last_modified: string | null; // ISO timestamp
  language: string | null;
  metadata: string | null; // JSON string
}

/**
 * Raw chunk row from database
 */
export interface ChunkRow {
  id: number;
  file_id: number;
  chunk_index: number;
  content: string;
  start_line: number;
  end_line: number;
  metadata: string | null; // JSON string
}

/**
 * Raw embedding row from database
 */
export interface EmbeddingRow {
  id: number;
  chunk_id: number;
  embedding: string; // Vector as string "[1,2,3,...]"
  created_at: string; // ISO timestamp
}

/**
 * Raw similarity search result from database
 */
export interface SimilarityResultRow {
  chunk_id: number;
  file_id: number;
  repository_id: string; // UUID
  file_path: string;
  content: string;
  similarity: number | string; // Can be returned as string by PGlite
}

/**
 * Type guard to check if a value is a valid row object
 */
export function isRowObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type-safe row extractor with validation
 */
export function assertRowType<T extends Record<string, unknown>>(
  row: unknown,
  requiredFields: (keyof T)[]
): asserts row is T {
  if (!isRowObject(row)) {
    throw new Error('Expected row to be an object');
  }

  for (const field of requiredFields) {
    if (!(field in row)) {
      throw new Error(`Missing required field: ${String(field)}`);
    }
  }
}

/**
 * Safe JSON parse helper
 */
export function parseJSON<T = unknown>(value: string | null): T | null {
  if (value === null) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Safe date parse helper
 */
export function parseDate(value: string | null): Date {
  if (value === null) {
    return new Date();
  }
  return new Date(value);
}

/**
 * Safe number parse helper
 */
export function parseNumber(value: number | string): number {
  if (typeof value === 'number') return value;
  return parseFloat(String(value));
}

/**
 * Safe vector parse helper
 */
export function parseVector(value: string): number[] {
  // Vector is stored as "[1,2,3,...]" string
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error('Vector must be an array');
    }
    if (!parsed.every(v => typeof v === 'number')) {
      throw new Error('Vector must contain only numbers');
    }
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse vector: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
