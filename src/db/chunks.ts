/**
 * Chunks table CRUD operations
 *
 * Provides functions for managing chunk records in the database.
 * Chunks represent segments of text/code files for embedding.
 *
 * NOTE: Only text/code files are chunked. Binary files are NOT chunked.
 */

import { getClient } from './client.js';
import {
  Chunk,
  ChunkId,
  ChunkInsert,
  FileId,
  DatabaseError,
  DatabaseErrorCode,
} from './types.js';

/**
 * Map database row to Chunk type
 */
function mapToChunk(row: any): Chunk {
  return {
    id: row.id as ChunkId,
    file_id: row.file_id as FileId,
    chunk_index: parseInt(String(row.chunk_index), 10),
    content: row.content,
    start_line: row.start_line !== null ? parseInt(String(row.start_line), 10) : null,
    end_line: row.end_line !== null ? parseInt(String(row.end_line), 10) : null,
    metadata: row.metadata,
  };
}

/**
 * Insert a single chunk
 *
 * @param data - Chunk data to insert
 * @returns The created chunk with generated id
 * @throws DatabaseError if insertion fails
 */
export async function insertChunk(data: ChunkInsert): Promise<Chunk> {
  try {
    const client = await getClient();

    const result = await client.query(
      `INSERT INTO chunks (file_id, chunk_index, content, start_line, end_line, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.file_id,
        data.chunk_index,
        data.content,
        data.start_line ?? null,
        data.end_line ?? null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );

    if (result.rows.length === 0) {
      throw new DatabaseError(
        DatabaseErrorCode.QUERY_FAILED,
        'Failed to insert chunk: no rows returned'
      );
    }

    return mapToChunk(result.rows[0]);
  } catch (error) {
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      throw new DatabaseError(
        DatabaseErrorCode.CONSTRAINT_VIOLATION,
        `Chunk with index ${data.chunk_index} already exists for file ${data.file_id}`,
        error
      );
    }

    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      'Failed to insert chunk',
      error
    );
  }
}

/**
 * Insert multiple chunks in a batch operation
 * CRITICAL for performance when processing files with many chunks
 *
 * Automatically splits large batches to stay within SQLite's 999 parameter limit.
 * Each chunk requires 6 parameters, so max batch size is 150 chunks (900 parameters).
 *
 * @param chunks - Array of chunk data to insert
 * @returns Array of created chunks
 * @throws DatabaseError if insertion fails
 */
export async function insertChunks(chunks: ChunkInsert[]): Promise<Chunk[]> {
  if (chunks.length === 0) {
    return [];
  }

  // Each chunk needs 6 parameters (file_id, chunk_index, content, start_line, end_line, metadata)
  // SQLite limit: 999 parameters
  // 999 / 6 = 166, use 150 to be safe (150 * 6 = 900 parameters)
  const MAX_BATCH_SIZE = 150;

  // Split into batches if needed
  if (chunks.length > MAX_BATCH_SIZE) {
    const results: Chunk[] = [];
    for (let i = 0; i < chunks.length; i += MAX_BATCH_SIZE) {
      const batch = chunks.slice(i, i + MAX_BATCH_SIZE);
      const batchResults = await insertChunks(batch);
      results.push(...batchResults);
    }
    return results;
  }

  try {
    const client = await getClient();

    // Build parameterized query for batch insert
    const placeholders: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const chunk of chunks) {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, ` +
        `$${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`
      );

      values.push(
        chunk.file_id,
        chunk.chunk_index,
        chunk.content,
        chunk.start_line ?? null,
        chunk.end_line ?? null,
        chunk.metadata ? JSON.stringify(chunk.metadata) : null
      );

      paramIndex += 6;
    }

    const result = await client.query(
      `INSERT INTO chunks (file_id, chunk_index, content, start_line, end_line, metadata)
       VALUES ${placeholders.join(', ')}
       RETURNING *`,
      values
    );

    return result.rows.map(mapToChunk);
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }

    // Include original error message for debugging
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to batch insert ${chunks.length} chunks: ${errorMsg}`,
      error
    );
  }
}

/**
 * Get chunk by ID
 *
 * @param id - Chunk ID
 * @returns The chunk or null if not found
 * @throws DatabaseError if query fails
 */
export async function getChunk(id: ChunkId): Promise<Chunk | null> {
  try {
    const client = await getClient();

    const result = await client.query('SELECT * FROM chunks WHERE id = $1', [
      id,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapToChunk(result.rows[0]);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get chunk with id ${id}`,
      error
    );
  }
}

/**
 * Get all chunks for a file
 * Returns chunks ordered by chunk_index
 *
 * @param fileId - File ID
 * @returns Array of chunks for the file, ordered by index
 * @throws DatabaseError if query fails
 */
export async function getChunksByFile(fileId: FileId): Promise<Chunk[]> {
  try {
    const client = await getClient();

    const result = await client.query(
      'SELECT * FROM chunks WHERE file_id = $1 ORDER BY chunk_index',
      [fileId]
    );

    return result.rows.map(mapToChunk);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get chunks for file ${fileId}`,
      error
    );
  }
}

/**
 * Get a specific chunk by file ID and chunk index
 *
 * @param fileId - File ID
 * @param chunkIndex - Chunk index
 * @returns The chunk or null if not found
 * @throws DatabaseError if query fails
 */
export async function getChunkByIndex(
  fileId: FileId,
  chunkIndex: number
): Promise<Chunk | null> {
  try {
    const client = await getClient();

    const result = await client.query(
      'SELECT * FROM chunks WHERE file_id = $1 AND chunk_index = $2',
      [fileId, chunkIndex]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapToChunk(result.rows[0]);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get chunk ${chunkIndex} for file ${fileId}`,
      error
    );
  }
}

/**
 * Delete all chunks for a file
 * Useful when re-processing a file
 *
 * @param fileId - File ID
 * @returns Number of chunks deleted
 * @throws DatabaseError if deletion fails
 */
export async function deleteChunksByFile(fileId: FileId): Promise<number> {
  try {
    const client = await getClient();

    const result = await client.query(
      'DELETE FROM chunks WHERE file_id = $1 RETURNING id',
      [fileId]
    );

    return result.rows.length;
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to delete chunks for file ${fileId}`,
      error
    );
  }
}

/**
 * Delete a specific chunk
 *
 * Note: This will cascade delete the associated embedding
 *
 * @param id - Chunk ID to delete
 * @throws DatabaseError if deletion fails
 */
export async function deleteChunk(id: ChunkId): Promise<void> {
  try {
    const client = await getClient();

    const result = await client.query(
      'DELETE FROM chunks WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw new DatabaseError(
        DatabaseErrorCode.NOT_FOUND,
        `Chunk with id ${id} not found`
      );
    }
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to delete chunk with id ${id}`,
      error
    );
  }
}

/**
 * Get count of chunks for a file
 *
 * @param fileId - File ID
 * @returns Number of chunks for the file
 * @throws DatabaseError if query fails
 */
export async function getChunkCount(fileId: FileId): Promise<number> {
  try {
    const client = await getClient();

    const result = await client.query(
      'SELECT COUNT(*) as count FROM chunks WHERE file_id = $1',
      [fileId]
    );

    return parseInt(String(((result.rows[0] as any)?.count) ?? '0'), 10);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get chunk count for file ${fileId}`,
      error
    );
  }
}
