/**
 * Test helpers and utilities
 *
 * Provides common test setup, teardown, and fixture data
 */

import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { runMigrations } from '../../src/db/schema.js';
import {
  RepositoryInsert,
  FileInsert,
  ChunkInsert,
  EmbeddingInsert,
} from '../../src/db/types.js';

/**
 * Create an in-memory test database with migrations applied
 * Each test should create its own database to ensure isolation
 */
export async function createTestDatabase(): Promise<PGlite> {
  const client = new PGlite(':memory:', {
    extensions: { vector },
  });

  // Load pgvector extension
  await client.exec('CREATE EXTENSION IF NOT EXISTS vector;');

  // Run migrations
  await runMigrations(client);

  return client;
}

/**
 * Cleanup test database
 */
export async function cleanupTestDatabase(client: PGlite): Promise<void> {
  await client.close();
}

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Sample repository data
 */
export const mockRepository: RepositoryInsert = {
  name: 'test-repo',
  path: '/path/to/test-repo',
  commit_sha: 'abc123def456',
  metadata: {
    branch: 'main',
    lastUpdated: '2025-01-01T00:00:00Z',
  },
};

/**
 * Sample text file
 */
export const mockTextFile: FileInsert = {
  repository_id: 1 as any, // Will be set by tests
  file_path: 'README.md',
  file_type: 'text',
  content: '# Test Repository\n\nThis is a test repository for CRAIG.',
  binary_metadata: null,
  content_hash: 'hash_readme',
  size_bytes: 50,
  last_modified: null,
  language: null,
  metadata: null,
};

/**
 * Sample code file
 */
export const mockCodeFile: FileInsert = {
  repository_id: 1 as any, // Will be set by tests
  file_path: 'src/index.ts',
  file_type: 'code',
  content: 'console.log("Hello, CRAIG!");',
  binary_metadata: null,
  content_hash: 'hash_index',
  size_bytes: 29,
  last_modified: null,
  language: 'typescript',
  metadata: {
    imports: [],
    exports: [],
  },
};

/**
 * Sample binary file (CRITICAL: content=NULL)
 */
export const mockBinaryFile: FileInsert = {
  repository_id: 1 as any, // Will be set by tests
  file_path: 'assets/logo.png',
  file_type: 'binary',
  content: null, // CRITICAL: NULL for binary files
  binary_metadata: {
    mime_type: 'image/png',
    size: 1024,
    dimensions: { width: 100, height: 100 },
  },
  content_hash: 'hash_logo',
  size_bytes: 1024,
  last_modified: null,
  language: null,
  metadata: null,
};

/**
 * Sample chunk
 */
export const mockChunk: ChunkInsert = {
  file_id: 1 as any, // Will be set by tests
  chunk_index: 0,
  content: 'This is a test chunk of content for embedding.',
  start_line: 1,
  end_line: 1,
  metadata: {
    tokens: 10,
  },
};

/**
 * Generate a mock embedding vector (384 dimensions)
 * Values are random for testing purposes
 */
export function generateMockEmbedding(seed: number = 0.5): number[] {
  return Array.from({ length: 384 }, (_, i) => {
    // Simple deterministic pseudo-random based on index and seed
    return Math.sin(i * seed) * 0.5 + 0.5;
  });
}

/**
 * Sample embedding
 */
export function mockEmbedding(chunkId: any): EmbeddingInsert {
  return {
    chunk_id: chunkId,
    embedding: generateMockEmbedding(),
  };
}

/**
 * Create a test repository with files, chunks, and embeddings
 * Useful for integration tests
 */
export async function createTestRepositoryWithData(
  client: PGlite
): Promise<{
  repositoryId: number;
  textFileId: number;
  codeFileId: number;
  binaryFileId: number;
  chunkIds: number[];
  embeddingIds: number[];
}> {
  // Insert repository
  const repoResult = await client.query(
    `INSERT INTO repositories (name, path, commit_sha, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      mockRepository.name,
      mockRepository.path,
      mockRepository.commit_sha,
      JSON.stringify(mockRepository.metadata),
    ]
  );
  const repositoryId = repoResult.rows[0].id;

  // Insert text file
  const textFileResult = await client.query(
    `INSERT INTO files (repository_id, file_path, file_type, content, content_hash, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      repositoryId,
      mockTextFile.file_path,
      mockTextFile.file_type,
      mockTextFile.content,
      mockTextFile.content_hash,
      mockTextFile.size_bytes,
    ]
  );
  const textFileId = textFileResult.rows[0].id;

  // Insert code file
  const codeFileResult = await client.query(
    `INSERT INTO files (repository_id, file_path, file_type, content, content_hash, size_bytes, language, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      repositoryId,
      mockCodeFile.file_path,
      mockCodeFile.file_type,
      mockCodeFile.content,
      mockCodeFile.content_hash,
      mockCodeFile.size_bytes,
      mockCodeFile.language,
      JSON.stringify(mockCodeFile.metadata),
    ]
  );
  const codeFileId = codeFileResult.rows[0].id;

  // Insert binary file
  const binaryFileResult = await client.query(
    `INSERT INTO files (repository_id, file_path, file_type, content, binary_metadata, content_hash, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      repositoryId,
      mockBinaryFile.file_path,
      mockBinaryFile.file_type,
      null, // CRITICAL: NULL for binary
      JSON.stringify(mockBinaryFile.binary_metadata),
      mockBinaryFile.content_hash,
      mockBinaryFile.size_bytes,
    ]
  );
  const binaryFileId = binaryFileResult.rows[0].id;

  // Insert chunks for text file
  const chunk1Result = await client.query(
    `INSERT INTO chunks (file_id, chunk_index, content, start_line, end_line)
     VALUES ($1, 0, $2, 1, 1)
     RETURNING id`,
    [textFileId, '# Test Repository']
  );
  const chunk2Result = await client.query(
    `INSERT INTO chunks (file_id, chunk_index, content, start_line, end_line)
     VALUES ($1, 1, $2, 3, 3)
     RETURNING id`,
    [textFileId, 'This is a test repository for CRAIG.']
  );

  const chunkIds = [chunk1Result.rows[0].id, chunk2Result.rows[0].id];

  // Insert embeddings
  const embedding1 = generateMockEmbedding(0.1);
  const embedding2 = generateMockEmbedding(0.9);

  const emb1Result = await client.query(
    `INSERT INTO embeddings (chunk_id, embedding)
     VALUES ($1, $2::vector)
     RETURNING id`,
    [chunkIds[0], `[${embedding1.join(',')}]`]
  );
  const emb2Result = await client.query(
    `INSERT INTO embeddings (chunk_id, embedding)
     VALUES ($1, $2::vector)
     RETURNING id`,
    [chunkIds[1], `[${embedding2.join(',')}]`]
  );

  const embeddingIds = [emb1Result.rows[0].id, emb2Result.rows[0].id];

  return {
    repositoryId,
    textFileId,
    codeFileId,
    binaryFileId,
    chunkIds,
    embeddingIds,
  };
}
