/**
 * TypeScript type definitions for the CRAIG database layer
 *
 * This module defines all types, interfaces, and errors used throughout
 * the database layer. It uses branded types for IDs to prevent confusion
 * between different entity IDs at compile time.
 */

// ============================================================================
// Branded Types for IDs
// ============================================================================

/**
 * Branded type for Repository IDs
 * Prevents accidental mixing of different ID types
 */
export type RepositoryId = number & { readonly __brand: 'RepositoryId' };

/**
 * Branded type for File IDs
 */
export type FileId = number & { readonly __brand: 'FileId' };

/**
 * Branded type for Chunk IDs
 */
export type ChunkId = number & { readonly __brand: 'ChunkId' };

/**
 * Branded type for Embedding IDs
 */
export type EmbeddingId = number & { readonly __brand: 'EmbeddingId' };

// ============================================================================
// File Type Enum
// ============================================================================

/**
 * File type classification
 * - 'text': Plain text files (markdown, txt, etc.)
 * - 'code': Source code files (ts, js, py, etc.)
 * - 'binary': Binary files (images, executables, etc.)
 *
 * CRITICAL: Binary files MUST have content=NULL and use binary_metadata
 */
export type FileType = 'text' | 'code' | 'binary';

// ============================================================================
// Core Entity Interfaces
// ============================================================================

/**
 * Repository entity
 * Represents a code repository being indexed
 */
export interface Repository {
  id: RepositoryId;
  name: string;
  path: string;
  commit_sha: string | null;
  ingested_at: Date;
  metadata: Record<string, unknown> | null;
}

/**
 * File entity
 * Represents a file within a repository
 *
 * CRITICAL CONSTRAINTS:
 * - Binary files: file_type='binary', content=NULL, binary_metadata required
 * - Text/code files: file_type='text'/'code', content required
 */
export interface File {
  id: FileId;
  repository_id: RepositoryId;
  file_path: string;
  file_type: FileType;
  content: string | null; // NULL for binary files
  binary_metadata: Record<string, unknown> | null; // For binary files only
  content_hash: string;
  size_bytes: number | null;
  last_modified: Date | null;
  language: string | null; // Programming language for code files
  metadata: Record<string, unknown> | null;
}

/**
 * Chunk entity
 * Represents a chunk of text/code from a file
 *
 * NOTE: Only text/code files are chunked. Binary files are NOT chunked.
 */
export interface Chunk {
  id: ChunkId;
  file_id: FileId;
  chunk_index: number;
  content: string;
  start_line: number | null;
  end_line: number | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Embedding entity
 * Represents a vector embedding for a chunk
 *
 * NOTE: Only chunks (from text/code files) have embeddings.
 * Binary files do NOT have embeddings.
 */
export interface Embedding {
  id: EmbeddingId;
  chunk_id: ChunkId;
  embedding: number[]; // 384-dimensional vector (all-MiniLM-L6-v2)
  created_at: Date;
}

// ============================================================================
// Insert Types (without auto-generated fields)
// ============================================================================

/**
 * Repository insert type
 * Excludes auto-generated fields: id, ingested_at
 */
export type RepositoryInsert = Omit<Repository, 'id' | 'ingested_at'>;

/**
 * File insert type
 * Excludes auto-generated field: id
 */
export type FileInsert = Omit<File, 'id'>;

/**
 * Chunk insert type
 * Excludes auto-generated field: id
 */
export type ChunkInsert = Omit<Chunk, 'id'>;

/**
 * Embedding insert type
 * Excludes auto-generated fields: id, created_at
 */
export type EmbeddingInsert = Omit<Embedding, 'id' | 'created_at'>;

// ============================================================================
// Update Types (all fields optional except id)
// ============================================================================

/**
 * Repository update type
 * All fields optional except id
 */
export type RepositoryUpdate = Partial<Omit<Repository, 'id'>> & { id: RepositoryId };

/**
 * File update type
 * All fields optional except id
 */
export type FileUpdate = Partial<Omit<File, 'id'>> & { id: FileId };

/**
 * Chunk update type
 * All fields optional except id
 */
export type ChunkUpdate = Partial<Omit<Chunk, 'id'>> & { id: ChunkId };

/**
 * Embedding update type
 * All fields optional except id
 */
export type EmbeddingUpdate = Partial<Omit<Embedding, 'id'>> & { id: EmbeddingId };

// ============================================================================
// Vector Search Types
// ============================================================================

/**
 * Similarity search result
 * Returned by searchSimilarEmbeddings()
 */
export interface SimilarityResult {
  chunk_id: ChunkId;
  file_id: FileId;
  repository_id: RepositoryId;
  file_path: string;
  content: string;
  similarity: number; // Cosine similarity score (0-1, higher is more similar)
}

// ============================================================================
// Database Error Types
// ============================================================================

/**
 * Database error codes
 * Used to distinguish between different types of database errors
 */
export enum DatabaseErrorCode {
  CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  QUERY_FAILED = 'DB_QUERY_FAILED',
  CONSTRAINT_VIOLATION = 'DB_CONSTRAINT_VIOLATION',
  NOT_FOUND = 'DB_NOT_FOUND',
  TRANSACTION_FAILED = 'DB_TRANSACTION_FAILED',
  MIGRATION_FAILED = 'DB_MIGRATION_FAILED',
  INVALID_INPUT = 'DB_INVALID_INPUT',
}

/**
 * Database error class
 * Custom error type for all database operations
 */
export class DatabaseError extends Error {
  constructor(
    public code: DatabaseErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }
  }
}

// ============================================================================
// Database Client Options
// ============================================================================

/**
 * Options for database client initialization
 */
export interface ClientOptions {
  /**
   * Data directory for persistent database
   * Use ':memory:' for in-memory database (testing)
   * Default: './data/craig.db' or CRAIG_DB_PATH environment variable
   */
  dataDir?: string;

  /**
   * Whether to run migrations automatically on initialization
   * Default: true
   */
  autoMigrate?: boolean;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  details: {
    connected: boolean;
    vectorExtension: boolean;
    schemaVersion: number;
    tableCount: number;
  };
}

// ============================================================================
// Helper Type Guards
// ============================================================================

/**
 * Type guard to check if a file is binary
 */
export function isBinaryFile(file: File): boolean {
  return file.file_type === 'binary';
}

/**
 * Type guard to check if a file is text or code
 */
export function isTextOrCodeFile(file: File): boolean {
  return file.file_type === 'text' || file.file_type === 'code';
}

/**
 * Validate vector dimensions
 * Embeddings MUST be exactly 384 dimensions (all-MiniLM-L6-v2)
 */
export function isValidVectorDimension(vector: number[]): boolean {
  return vector.length === 384;
}

/**
 * Validate file type
 */
export function isValidFileType(fileType: string): fileType is FileType {
  return fileType === 'text' || fileType === 'code' || fileType === 'binary';
}
