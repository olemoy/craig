/**
 * CRAIG Database Layer - Public API
 *
 * This module exports all public functions and types for the database layer.
 * Use this as the main entry point for database operations.
 */

// =============================================================================
// Client & Connection Management
// =============================================================================

export {
  getClient,
  initializeClient,
  closeClient,
  resetClient,
  healthCheck,
} from './client.js';

// =============================================================================
// Schema & Migrations
// =============================================================================

export {
  runMigrations,
  getCurrentSchemaVersion,
  getMigrationHistory,
} from './schema.js';

// =============================================================================
// Transaction Utilities
// =============================================================================

export { withTransaction, withTransactionClient } from './transactions.js';

// =============================================================================
// Repository Operations
// =============================================================================

export {
  insertRepository,
  getRepository,
  getRepositoryByPath,
  getRepositoryByName,
  listRepositories,
  updateRepository,
  deleteRepository,
} from './repositories.js';

// =============================================================================
// File Operations
// =============================================================================

export {
  insertFile,
  insertFiles,
  getFile,
  getFilesByRepository,
  getFilesByType,
  getFileByPath,
  updateFile,
  deleteFile,
} from './files.js';

// =============================================================================
// Chunk Operations
// =============================================================================

export {
  insertChunk,
  insertChunks,
  getChunk,
  getChunksByFile,
  getChunkByIndex,
  deleteChunksByFile,
  deleteChunk,
  getChunkCount,
} from './chunks.js';

// =============================================================================
// Embedding Operations
// =============================================================================

export {
  insertEmbedding,
  insertEmbeddings,
  getEmbedding,
  getEmbeddingByChunk,
  searchSimilarEmbeddings,
  searchSimilarEmbeddingsInRepository,
  deleteEmbeddingByChunk,
  deleteEmbedding,
  getEmbeddingCount,
} from './embeddings.js';

// =============================================================================
// Types
// =============================================================================

export type {
  // Branded ID types
  RepositoryId,
  FileId,
  ChunkId,
  EmbeddingId,

  // File type
  FileType,

  // Entity types
  Repository,
  File,
  Chunk,
  Embedding,

  // Insert types
  RepositoryInsert,
  FileInsert,
  ChunkInsert,
  EmbeddingInsert,

  // Update types
  RepositoryUpdate,
  FileUpdate,
  ChunkUpdate,
  EmbeddingUpdate,

  // Search types
  SimilarityResult,

  // Client types
  ClientOptions,
  HealthCheckResult,
} from './types.js';

// =============================================================================
// Error Types & Helper Functions
// =============================================================================

export {
  DatabaseError,
  DatabaseErrorCode,
  isBinaryFile,
  isTextOrCodeFile,
  isValidVectorDimension,
  isValidFileType,
} from './types.js';
