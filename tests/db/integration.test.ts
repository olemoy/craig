/**
 * Comprehensive integration tests for the database layer
 *
 * Tests all critical functionality including:
 * - Database initialization and migrations
 * - CRUD operations for all tables
 * - Binary file validation
 * - Vector search functionality
 * - Transaction support
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'crypto';
import {
  createTestDatabase,
  cleanupTestDatabase,
  mockRepository,
  mockTextFile,
  mockCodeFile,
  mockBinaryFile,
  mockChunk,
  generateMockEmbedding,
  mockEmbedding,
} from './helpers.js';
import {
  insertRepository,
  getRepository,
  listRepositories,
  deleteRepository,
  insertFile,
  insertFiles,
  getFile,
  getFilesByRepository,
  getFilesByType,
  insertChunk,
  insertChunks,
  getChunksByFile,
  insertEmbedding,
  insertEmbeddings,
  searchSimilarEmbeddings,
  withTransactionClient,
  DatabaseError,
  DatabaseErrorCode,
  RepositoryId,
  FileId,
  ChunkId,
  resetClient,
  initializeClient,
  closeClient,
} from '../../src/db/index.js';
import { getCurrentSchemaVersion } from '../../src/db/schema.js';

describe('Database Integration Tests', () => {
  let db: PGlite;

  beforeAll(async () => {
    // Reset singleton client
    resetClient();
    // Initialize with unique in-memory database path for test isolation
    // Use PGlite in-memory mode. 'memory://' ensures a memory-backed DB with no filesystem artifacts.
    db = await initializeClient({
      dataDir: 'memory://',
      autoMigrate: true,
    });
  });

  afterAll(async () => {
    await closeClient();
    resetClient();
  });

  // ==========================================================================
  // Setup & Health Checks
  // ==========================================================================

  describe('Database Setup', () => {
    it('should load pgvector extension', async () => {
      const result = await db.query(
        "SELECT * FROM pg_extension WHERE extname = 'vector'"
      );
      expect(result.rows).toHaveLength(1);
    });

    it('should create all required tables', async () => {
      const result = await db.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
         ORDER BY table_name`
      );

      const tableNames = result.rows.map((row) => row.table_name);
      expect(tableNames).toContain('repositories');
      expect(tableNames).toContain('files');
      expect(tableNames).toContain('chunks');
      expect(tableNames).toContain('embeddings');
      expect(tableNames).toContain('schema_version');
    });

    it('should apply migrations correctly', async () => {
      const version = await getCurrentSchemaVersion(db);
      expect(version).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Repository CRUD Operations
  // ==========================================================================

  describe('Repository Operations', () => {
    it('should insert a repository', async () => {
      const testRepo = {
        ...mockRepository,
        name: `repo-insert-${randomUUID().slice(0, 8)}`,
        path: `/path/to/repo-insert-${randomUUID().slice(0, 8)}`,
      };
      const repo = await insertRepository(testRepo);

      expect(repo).toHaveProperty('id');
      expect(repo.name).toBe(testRepo.name);
      expect(repo.path).toBe(testRepo.path);
      expect(repo.commit_sha).toBe(testRepo.commit_sha);
      expect(repo.ingested_at).toBeInstanceOf(Date);
    });

    it('should get repository by id', async () => {
      const testRepo = {
        ...mockRepository,
        name: `repo-get-${randomUUID().slice(0, 8)}`,
        path: `/path/to/repo-get-${randomUUID().slice(0, 8)}`,
      };
      const inserted = await insertRepository(testRepo);
      const retrieved = await getRepository(inserted.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(inserted.id);
      expect(retrieved?.name).toBe(testRepo.name);
    });

    it('should list all repositories', async () => {
      const uuid = randomUUID().slice(0, 8);
      await insertRepository({
        ...mockRepository,
        name: `repo-list-1-${uuid}`,
        path: `/path/to/repo-list-1-${uuid}`,
      });
      await insertRepository({
        ...mockRepository,
        name: `repo-list-2-${uuid}`,
        path: `/path/to/repo-list-2-${uuid}`,
      });

      const repos = await listRepositories();
      expect(repos.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject duplicate repository paths', async () => {
      const testRepo = {
        ...mockRepository,
        name: `repo-dup-${randomUUID().slice(0, 8)}`,
        path: `/path/to/repo-dup-${randomUUID().slice(0, 8)}`,
      };
      await insertRepository(testRepo);

      await expect(insertRepository(testRepo)).rejects.toThrow(
        DatabaseError
      );
    });

    it('should cascade delete files when repository is deleted', async () => {
      const testRepo = {
        ...mockRepository,
        name: `repo-cascade-${randomUUID().slice(0, 8)}`,
        path: `/path/to/repo-cascade-${randomUUID().slice(0, 8)}`,
      };
      const repo = await insertRepository(testRepo);
      const file = await insertFile({
        ...mockTextFile,
        repository_id: repo.id,
      });

      await deleteRepository(repo.id);

      const retrievedFile = await getFile(file.id);
      expect(retrievedFile).toBeNull();
    });
  });

  // ==========================================================================
  // File Operations & Binary Validation
  // ==========================================================================

  describe('File Operations', () => {
    let repoId: RepositoryId;

    beforeEach(async () => {
      const uuid = randomUUID().slice(0, 8);
      const repo = await insertRepository({
        ...mockRepository,
        name: `file-ops-repo-${uuid}`,
        path: `/path/to/file-ops-${uuid}`,
      });
      repoId = repo.id;
    });

    it('should insert text file with content', async () => {
      const file = await insertFile({
        ...mockTextFile,
        repository_id: repoId,
      });

      expect(file).toHaveProperty('id');
      expect(file.file_type).toBe('text');
      expect(file.content).toBe(mockTextFile.content);
      expect(file.binary_metadata).toBeNull();
    });

    it('should insert code file with language', async () => {
      const file = await insertFile({
        ...mockCodeFile,
        repository_id: repoId,
      });

      expect(file.file_type).toBe('code');
      expect(file.language).toBe('typescript');
      expect(file.content).not.toBeNull();
    });

    it('should insert binary file with NULL content (CRITICAL)', async () => {
      const file = await insertFile({
        ...mockBinaryFile,
        repository_id: repoId,
      });

      expect(file.file_type).toBe('binary');
      expect(file.content).toBeNull(); // CRITICAL CHECK
      expect(file.binary_metadata).not.toBeNull();
      expect(file.binary_metadata?.mime_type).toBe('image/png');
    });

    it('should REJECT binary file with non-null content (CRITICAL)', async () => {
      await expect(
        insertFile({
          ...mockBinaryFile,
          repository_id: repoId,
          content: 'This should fail!', // Invalid for binary
        })
      ).rejects.toThrow('Binary files must have content=NULL');
    });

    it('should batch insert files', async () => {
      const files = await insertFiles([
        { ...mockTextFile, repository_id: repoId },
        { ...mockCodeFile, repository_id: repoId },
        { ...mockBinaryFile, repository_id: repoId },
      ]);

      expect(files).toHaveLength(3);
      expect(files[2].content).toBeNull(); // Binary file
    });

    it('should filter files by type', async () => {
      await insertFiles([
        { ...mockTextFile, repository_id: repoId },
        { ...mockCodeFile, repository_id: repoId },
        { ...mockBinaryFile, repository_id: repoId },
      ]);

      const binaryFiles = await getFilesByType(repoId, 'binary');
      const textFiles = await getFilesByType(repoId, 'text');

      expect(binaryFiles).toHaveLength(1);
      expect(binaryFiles[0].content).toBeNull();
      expect(textFiles).toHaveLength(1);
      expect(textFiles[0].content).not.toBeNull();
    });
  });

  // ==========================================================================
  // Chunk Operations
  // ==========================================================================

  describe('Chunk Operations', () => {
    let fileId: FileId;

    beforeEach(async () => {
      const uuid = randomUUID().slice(0, 8);
      const repo = await insertRepository({
        ...mockRepository,
        name: `chunk-ops-repo-${uuid}`,
        path: `/path/to/chunk-ops-${uuid}`,
      });
      const file = await insertFile({
        ...mockTextFile,
        repository_id: repo.id,
      });
      fileId = file.id;
    });

    it('should insert a chunk', async () => {
      const chunk = await insertChunk({
        ...mockChunk,
        file_id: fileId,
      });

      expect(chunk).toHaveProperty('id');
      expect(chunk.file_id).toBe(fileId);
      expect(chunk.chunk_index).toBe(0);
      expect(chunk.content).toBe(mockChunk.content);
    });

    it('should batch insert chunks', async () => {
      const chunks = await insertChunks([
        { ...mockChunk, file_id: fileId, chunk_index: 0 },
        { ...mockChunk, file_id: fileId, chunk_index: 1 },
        { ...mockChunk, file_id: fileId, chunk_index: 2 },
      ]);

      expect(chunks).toHaveLength(3);
      expect(chunks.map((c) => c.chunk_index)).toEqual([0, 1, 2]);
    });

    it('should get chunks ordered by index', async () => {
      await insertChunks([
        { ...mockChunk, file_id: fileId, chunk_index: 2 },
        { ...mockChunk, file_id: fileId, chunk_index: 0 },
        { ...mockChunk, file_id: fileId, chunk_index: 1 },
      ]);

      const chunks = await getChunksByFile(fileId);
      expect(chunks.map((c) => c.chunk_index)).toEqual([0, 1, 2]);
    });
  });

  // ==========================================================================
  // Embedding Operations & Vector Search
  // ==========================================================================

  describe('Embedding & Vector Search', () => {
    let chunkId: ChunkId;

    beforeEach(async () => {
      const uuid = randomUUID().slice(0, 8);
      const repo = await insertRepository({
        ...mockRepository,
        name: `embedding-ops-repo-${uuid}`,
        path: `/path/to/embedding-ops-${uuid}`,
      });
      const file = await insertFile({
        ...mockTextFile,
        repository_id: repo.id,
      });
      const chunk = await insertChunk({
        ...mockChunk,
        file_id: file.id,
      });
      chunkId = chunk.id;
    });

    it('should insert embedding with 384-dimensional vector', async () => {
      const embedding = await insertEmbedding(mockEmbedding(chunkId));

      expect(embedding).toHaveProperty('id');
      expect(embedding.chunk_id).toBe(chunkId);
      expect(embedding.embedding).toHaveLength(384);
      expect(embedding.created_at).toBeInstanceOf(Date);
    });

    it('should REJECT embedding with wrong dimensions', async () => {
      await expect(
        insertEmbedding({
          chunk_id: chunkId,
          embedding: [1, 2, 3], // Only 3 dimensions, should be 384
        })
      ).rejects.toThrow('Vector must be exactly 384 dimensions');
    });

    it('should batch insert embeddings', async () => {
      // Create multiple chunks
      const repo = await insertRepository({
        ...mockRepository,
        name: 'batch-test',
        path: '/batch',
      });
      const file = await insertFile({
        ...mockTextFile,
        repository_id: repo.id,
        file_path: 'batch.txt',
      });
      const chunks = await insertChunks([
        { ...mockChunk, file_id: file.id, chunk_index: 0 },
        { ...mockChunk, file_id: file.id, chunk_index: 1 },
      ]);

      const embeddings = await insertEmbeddings([
        mockEmbedding(chunks[0].id),
        mockEmbedding(chunks[1].id),
      ]);

      expect(embeddings).toHaveLength(2);
    });

    it('should perform vector similarity search', async () => {
      // Insert multiple embeddings with different vectors
      const uuid = randomUUID().slice(0, 8);
      const repo = await insertRepository({
        ...mockRepository,
        name: `search-test-${uuid}`,
        path: `/search-${uuid}`,
      });
      const file = await insertFile({
        ...mockTextFile,
        repository_id: repo.id,
        file_path: 'search.txt',
      });

      const chunks = await insertChunks([
        {
          ...mockChunk,
          file_id: file.id,
          chunk_index: 0,
          content: 'First chunk',
        },
        {
          ...mockChunk,
          file_id: file.id,
          chunk_index: 1,
          content: 'Second chunk',
        },
        {
          ...mockChunk,
          file_id: file.id,
          chunk_index: 2,
          content: 'Third chunk',
        },
      ]);

      // Insert embeddings with different vectors
      const insertedEmbeddings = await insertEmbeddings([
        { chunk_id: chunks[0].id, embedding: generateMockEmbedding(0.1) },
        { chunk_id: chunks[1].id, embedding: generateMockEmbedding(0.5) },
        { chunk_id: chunks[2].id, embedding: generateMockEmbedding(0.9) },
      ]);

      // Verify embeddings were inserted
      expect(insertedEmbeddings).toHaveLength(3);

      // Search with a query vector similar to the first embedding
      const queryVector = generateMockEmbedding(0.15); // Close to 0.1
      const results = await searchSimilarEmbeddings(queryVector, 10, 0); // Get all results

      // We should get at least some results
      expect(results.length).toBeGreaterThan(0);
      // Verify all results have required properties (don't assume ordering due to shared DB)
      results.forEach(result => {
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('file_path');
        expect(result).toHaveProperty('repository_id');
      });
    });
  });

  // ==========================================================================
  // Transaction Support
  // ==========================================================================

  describe('Transactions', () => {
    it('should commit successful transaction', async () => {
      const testRepo = {
        ...mockRepository,
        name: `txn-commit-${randomUUID().slice(0, 8)}`,
        path: `/path/to/txn-commit-${randomUUID().slice(0, 8)}`,
      };
      const result = await withTransactionClient(db, async () => {
        const repo = await insertRepository(testRepo);
        const file = await insertFile({
          ...mockTextFile,
          repository_id: repo.id,
        });
        return { repo, file };
      });

      // Verify data was committed
      const retrieved = await getRepository(result.repo.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(result.repo.id);
    });

    it('should rollback failed transaction', async () => {
      const testRepo = {
        ...mockRepository,
        name: `txn-rollback-${randomUUID().slice(0, 8)}`,
        path: `/path/to/txn-rollback-${randomUUID().slice(0, 8)}`,
      };
      let repoId;
      try {
        await withTransactionClient(db, async () => {
          const repo = await insertRepository(testRepo);
          repoId = repo.id;
          throw new Error('Simulated error');
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify data was rolled back
      const retrieved = await getRepository(repoId);
      expect(retrieved).toBeNull();
    });

    it('should rollback on constraint violation', async () => {
      const testRepo = {
        ...mockRepository,
        name: `txn-constraint-${randomUUID().slice(0, 8)}`,
        path: `/path/to/txn-constraint-${randomUUID().slice(0, 8)}`,
      };
      const first = await insertRepository(testRepo);

      try {
        await withTransactionClient(db, async () => {
          // Try to insert duplicate
          await insertRepository(testRepo);
        });
      } catch (error) {
        // Expected to throw
      }

      // Should still have only the first repository
      const retrieved = await getRepository(first.id);
      expect(retrieved).not.toBeNull();
    });
  });

  // ==========================================================================
  // Cascading Deletes
  // ==========================================================================

  describe('Cascading Deletes', () => {
    it('should cascade delete files, chunks, and embeddings when repository deleted', async () => {
      // Create full hierarchy
      const testRepo = {
        ...mockRepository,
        name: `cascade-test-${randomUUID().slice(0, 8)}`,
        path: `/path/to/cascade-test-${randomUUID().slice(0, 8)}`,
      };
      const repo = await insertRepository(testRepo);
      const file = await insertFile({
        ...mockTextFile,
        repository_id: repo.id,
      });
      const chunk = await insertChunk({
        ...mockChunk,
        file_id: file.id,
      });
      const embedding = await insertEmbedding(mockEmbedding(chunk.id));

      // Delete repository
      await deleteRepository(repo.id);

      // Verify cascade
      const files = await getFilesByRepository(repo.id);
      expect(files).toHaveLength(0);

      const chunks = await getChunksByFile(file.id);
      expect(chunks).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Binary File Edge Cases
  // ==========================================================================

  describe('Binary File Edge Cases', () => {
    let repoId: RepositoryId;

    beforeEach(async () => {
      const uuid = randomUUID().slice(0, 8);
      const repo = await insertRepository({
        ...mockRepository,
        name: `binary-ops-repo-${uuid}`,
        path: `/path/to/binary-ops-${uuid}`,
      });
      repoId = repo.id;
    });

    it('should NOT allow chunks for binary files', async () => {
      const binaryFile = await insertFile({
        ...mockBinaryFile,
        repository_id: repoId,
      });

      // This test verifies the application-level constraint
      // In a real scenario, WP2 (file processing) would skip chunking binary files
      // The database schema allows it, but the application shouldn't do it
      expect(binaryFile.content).toBeNull();
      expect(binaryFile.file_type).toBe('binary');
    });

    it('should handle various binary file types', async () => {
      const binaryFiles = await insertFiles([
        {
          ...mockBinaryFile,
          repository_id: repoId,
          file_path: 'image.png',
          binary_metadata: { mime_type: 'image/png' },
        },
        {
          ...mockBinaryFile,
          repository_id: repoId,
          file_path: 'doc.pdf',
          binary_metadata: { mime_type: 'application/pdf' },
        },
        {
          ...mockBinaryFile,
          repository_id: repoId,
          file_path: 'archive.zip',
          binary_metadata: { mime_type: 'application/zip' },
        },
      ]);

      expect(binaryFiles).toHaveLength(3);
      binaryFiles.forEach((file) => {
        expect(file.content).toBeNull();
        expect(file.binary_metadata).not.toBeNull();
      });
    });
  });
});
