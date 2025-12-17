/**
 * Files table CRUD operations
 *
 * Provides functions for managing file records in the database.
 * Handles text, code, and binary files with proper validation.
 *
 * CRITICAL: Binary files MUST have content=NULL and binary_metadata populated
 */

import { getClient } from './client.js';
import {
  File,
  FileId,
  FileInsert,
  FileUpdate,
  FileType,
  RepositoryId,
  DatabaseError,
  DatabaseErrorCode,
} from './types.js';

/**
 * Map database row to File type
 */
function mapToFile(row: any): File {
  return {
    id: row.id as FileId,
    repository_id: row.repository_id as RepositoryId,
    file_path: row.file_path,
    file_type: row.file_type as FileType,
    content: row.content,
    binary_metadata: row.binary_metadata,
    content_hash: row.content_hash,
    size_bytes: row.size_bytes,
    last_modified: row.last_modified ? new Date(row.last_modified) : null,
    language: row.language,
    metadata: row.metadata,
  };
}

/**
 * Validate file data before insertion/update
 * Enforces critical binary file constraints
 */
function validateFileData(data: FileInsert | FileUpdate): void {
  // Binary files MUST have content=NULL
  if (data.file_type === 'binary' && data.content !== null && data.content !== undefined) {
    throw new DatabaseError(
      DatabaseErrorCode.CONSTRAINT_VIOLATION,
      'Binary files must have content=NULL'
    );
  }

  // Binary files SHOULD have binary_metadata
  if (data.file_type === 'binary' && !data.binary_metadata) {
    console.error(
      `Warning: Binary file '${('file_path' in data) ? data.file_path : 'unknown'}' should include binary_metadata`
    );
  }

  // Text/code files should NOT have binary_metadata
  if (
    (data.file_type === 'text' || data.file_type === 'code') &&
    data.binary_metadata !== null &&
    data.binary_metadata !== undefined
  ) {
    console.error(
      `Warning: Text/code file '${('file_path' in data) ? data.file_path : 'unknown'}' should not have binary_metadata`
    );
  }
}

/**
 * Insert a new file
 *
 * @param data - File data to insert
 * @returns The created file with generated id
 * @throws DatabaseError if insertion fails or validation fails
 */
export async function insertFile(data: FileInsert): Promise<File> {
  // Validate file data
  validateFileData(data);

  try {
    const client = await getClient();

    const params = [
      data.repository_id,
      data.file_path,
      data.file_type,
      data.content,
      data.binary_metadata ? JSON.stringify(data.binary_metadata) : null,
      data.content_hash,
      data.size_bytes ?? null,
      data.last_modified ?? null,
      data.language ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ];

    const result = await client.query(
      `INSERT INTO files (
        repository_id, file_path, file_type, content, binary_metadata,
        content_hash, size_bytes, last_modified, language, metadata
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      console.error('INSERT returned no rows for file:', data.file_path);
      console.error('Repository ID:', data.repository_id);
      console.error('Result:', result);
      throw new DatabaseError(
        DatabaseErrorCode.QUERY_FAILED,
        'Failed to insert file: no rows returned'
      );
    }

    return mapToFile(result.rows[0]);
  } catch (error) {
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      throw new DatabaseError(
        DatabaseErrorCode.CONSTRAINT_VIOLATION,
        `File with path '${data.file_path}' already exists in repository ${data.repository_id}`,
        error
      );
    }

    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      'Failed to insert file',
      error
    );
  }
}

/**
 * Insert multiple files in a batch operation
 * More efficient than individual inserts
 *
 * @param files - Array of file data to insert
 * @returns Array of created files
 * @throws DatabaseError if insertion fails
 */
export async function insertFiles(files: FileInsert[]): Promise<File[]> {
  if (files.length === 0) {
    return [];
  }

  // Validate all files first
  for (const file of files) {
    validateFileData(file);
  }

  try {
    const client = await getClient();

    // pglite/sqlite can hit limits for maximum SQL variables or statement size when
    // inserting very large batches. Split into smaller chunks to avoid those limits.
    const MAX_BATCH_SIZE = 200; // safe conservative batch size (10 params per file -> 200*10=2000 params)
    const results: any[] = [];

    for (let i = 0; i < files.length; i += MAX_BATCH_SIZE) {
      const batch = files.slice(i, i + MAX_BATCH_SIZE);
      const placeholders: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const file of batch) {
        placeholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, ` +
          `$${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, ` +
          `$${paramIndex + 8}, $${paramIndex + 9})`
        );

        values.push(
          file.repository_id,
          file.file_path,
          file.file_type,
          file.content,
          file.binary_metadata ? JSON.stringify(file.binary_metadata) : null,
          file.content_hash,
          file.size_bytes ?? null,
          file.last_modified ?? null,
          file.language ?? null,
          file.metadata ? JSON.stringify(file.metadata) : null
        );

        paramIndex += 10;
      }

      const result = await client.query(
        `INSERT INTO files (
          repository_id, file_path, file_type, content, binary_metadata,
          content_hash, size_bytes, last_modified, language, metadata
        )
         VALUES ${placeholders.join(', ')}
         RETURNING *`,
        values
      );

      results.push(...result.rows);
    }

    return results.map(mapToFile);
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to batch insert ${files.length} files`,
      error
    );
  }
}

/**
 * Get file by ID
 *
 * @param id - File ID
 * @returns The file or null if not found
 * @throws DatabaseError if query fails
 */
export async function getFile(id: FileId): Promise<File | null> {
  try {
    const client = await getClient();

    const result = await client.query('SELECT * FROM files WHERE id = $1', [
      id,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapToFile(result.rows[0]);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get file with id ${id}`,
      error
    );
  }
}

/**
 * Get all files for a repository
 *
 * @param repositoryId - Repository ID
 * @returns Array of files in the repository
 * @throws DatabaseError if query fails
 */
export async function getFilesByRepository(
  repositoryId: RepositoryId
): Promise<File[]> {
  try {
    const client = await getClient();

    const result = await client.query(
      'SELECT * FROM files WHERE repository_id = $1 ORDER BY file_path',
      [repositoryId]
    );

    return result.rows.map(mapToFile);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get files for repository ${repositoryId}`,
      error
    );
  }
}

/**
 * Get files by type for a repository
 * Useful for filtering binary files vs text/code files
 *
 * @param repositoryId - Repository ID
 * @param fileType - File type to filter by
 * @returns Array of files matching the type
 * @throws DatabaseError if query fails
 */
export async function getFilesByType(
  repositoryId: RepositoryId,
  fileType: FileType
): Promise<File[]> {
  try {
    const client = await getClient();

    const result = await client.query(
      'SELECT * FROM files WHERE repository_id = $1 AND file_type = $2 ORDER BY file_path',
      [repositoryId, fileType]
    );

    return result.rows.map(mapToFile);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get ${fileType} files for repository ${repositoryId}`,
      error
    );
  }
}

/**
 * Get file by repository ID and file path
 *
 * @param repositoryId - Repository ID
 * @param filePath - File path
 * @returns The file or null if not found
 * @throws DatabaseError if query fails
 */
export async function getFileByPath(
  repositoryId: RepositoryId,
  filePath: string
): Promise<File | null> {
  try {
    const client = await getClient();

    const result = await client.query(
      'SELECT * FROM files WHERE repository_id = $1 AND file_path = $2',
      [repositoryId, filePath]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapToFile(result.rows[0]);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get file with path '${filePath}' in repository ${repositoryId}`,
      error
    );
  }
}

/**
 * Update a file
 *
 * @param data - File update data (must include id)
 * @returns The updated file
 * @throws DatabaseError if update fails or file not found
 */
export async function updateFile(data: FileUpdate): Promise<File> {
  // Validate file data
  validateFileData(data);

  try {
    const client = await getClient();

    // Build dynamic UPDATE query based on provided fields
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.file_path !== undefined) {
      fields.push(`file_path = $${paramIndex++}`);
      values.push(data.file_path);
    }

    if (data.file_type !== undefined) {
      fields.push(`file_type = $${paramIndex++}`);
      values.push(data.file_type);
    }

    if (data.content !== undefined) {
      fields.push(`content = $${paramIndex++}`);
      values.push(data.content);
    }

    if (data.binary_metadata !== undefined) {
      fields.push(`binary_metadata = $${paramIndex++}`);
      values.push(
        data.binary_metadata ? JSON.stringify(data.binary_metadata) : null
      );
    }

    if (data.content_hash !== undefined) {
      fields.push(`content_hash = $${paramIndex++}`);
      values.push(data.content_hash);
    }

    if (data.size_bytes !== undefined) {
      fields.push(`size_bytes = $${paramIndex++}`);
      values.push(data.size_bytes);
    }

    if (data.last_modified !== undefined) {
      fields.push(`last_modified = $${paramIndex++}`);
      values.push(data.last_modified);
    }

    if (data.language !== undefined) {
      fields.push(`language = $${paramIndex++}`);
      values.push(data.language);
    }

    if (data.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(data.metadata ? JSON.stringify(data.metadata) : null);
    }

    if (fields.length === 0) {
      // No fields to update, just return the current file
      const existing = await getFile(data.id);
      if (!existing) {
        throw new DatabaseError(
          DatabaseErrorCode.NOT_FOUND,
          `File with id ${data.id} not found`
        );
      }
      return existing;
    }

    // Add id parameter
    values.push(data.id);

    const result = await client.query(
      `UPDATE files
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new DatabaseError(
        DatabaseErrorCode.NOT_FOUND,
        `File with id ${data.id} not found`
      );
    }

    return mapToFile(result.rows[0]);
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to update file with id ${data.id}`,
      error
    );
  }
}

/**
 * Delete a file
 *
 * Note: This will cascade delete all associated chunks and embeddings
 *
 * @param id - File ID to delete
 * @throws DatabaseError if deletion fails
 */
export async function deleteFile(id: FileId): Promise<void> {
  try {
    const client = await getClient();

    const result = await client.query(
      'DELETE FROM files WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw new DatabaseError(
        DatabaseErrorCode.NOT_FOUND,
        `File with id ${id} not found`
      );
    }
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to delete file with id ${id}`,
      error
    );
  }
}
