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

// Random color selection for spinners
function randomColor(): 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray' {
  const colors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray'] as const;
  return colors[Math.floor(Math.random() * colors.length)];
}

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
    const MAX_BATCH_SIZE = 90; // safe conservative batch size (10 params per file -> 90*10=900 params)
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
 * Get file metadata (without content) for delta analysis
 *
 * Much more memory-efficient than getFilesByRepository for large repos.
 * Excludes content, binary_metadata, and metadata fields.
 *
 * @param repositoryId - Repository ID
 * @returns Array of files with only metadata fields
 * @throws DatabaseError if query fails
 */
export async function getFileMetadataByRepository(
  repositoryId: RepositoryId,
  options?: { showProgress?: boolean }
): Promise<File[]> {
  try {
    const client = await getClient();
    const showProgress = options?.showProgress ?? true;

    // Get count first
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM files WHERE repository_id = $1',
      [repositoryId]
    );
    const totalFiles = parseInt((countResult.rows[0] as any).count, 10);

    const BATCH_SIZE = 1000; // Larger batch size since we're not loading content

    if (totalFiles <= BATCH_SIZE) {
      // Small repo - single query
      const result = await client.query(
        `SELECT id, repository_id, file_path, file_type, content_hash,
                size_bytes, last_modified, language
         FROM files
         WHERE repository_id = $1
         ORDER BY file_path`,
        [repositoryId]
      );
      return result.rows.map(row => ({
        ...mapToFile(row),
        content: null,
        binary_metadata: null,
        metadata: null,
      }));
    }

    // Large repo - paginate with progress indicator
    let spinner: any = null;
    if (showProgress) {
      // Dynamic import to avoid issues if not available
      try {
        const { default: yoctoSpinner } = await import('yocto-spinner');
        const { dots12 } = await import('cli-spinners');
        spinner = yoctoSpinner({
          text: `Loading file metadata (0/${totalFiles})...`,
          indent: 2,
          spinner: dots12,
          color: randomColor()
        });
        spinner.start();
      } catch {
        // Fallback if spinner not available
        console.log(`  Loading ${totalFiles} files...`);
      }
    }

    const allFiles: File[] = [];
    let offset = 0;

    try {
      while (offset < totalFiles) {
        const batchResult = await client.query(
          `SELECT id, repository_id, file_path, file_type, content_hash,
                  size_bytes, last_modified, language
           FROM files
           WHERE repository_id = $1
           ORDER BY file_path
           LIMIT $2 OFFSET $3`,
          [repositoryId, BATCH_SIZE, offset]
        );

        const batchFiles = batchResult.rows.map(row => ({
          ...mapToFile(row),
          content: null,
          binary_metadata: null,
          metadata: null,
        }));

        allFiles.push(...batchFiles);
        offset += BATCH_SIZE;

        // Update spinner text and color
        if (spinner) {
          const loaded = Math.min(offset, totalFiles);
          spinner.color = randomColor();
          spinner.text = `Loading file metadata (${loaded}/${totalFiles})...`;
        }
      }

      if (spinner) {
        spinner.success(`Loaded ${totalFiles} files`);
      }

      return allFiles;
    } catch (error) {
      if (spinner) {
        spinner.error('Failed to load files');
      }
      throw error;
    }
  } catch (error) {
    console.error('getFileMetadataByRepository failed:');
    console.error('  Repository ID:', repositoryId);
    console.error('  Error:', error);
    if (error instanceof Error) {
      console.error('  Error message:', error.message);
      console.error('  Error stack:', error.stack);
    }

    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get file metadata for repository ${repositoryId}: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Get all files for a repository
 *
 * Uses pagination to handle large repositories that might exhaust WASM memory.
 * PGLite can hit "Out of bounds memory access" errors with large result sets.
 *
 * WARNING: For large repositories, this loads all file content into memory.
 * Consider using getFileMetadataByRepository() if you only need metadata.
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

    // First, get the count to determine if we need pagination
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM files WHERE repository_id = $1',
      [repositoryId]
    );
    const totalFiles = parseInt((countResult.rows[0] as any).count, 10);

    // If fewer than 500 files, fetch all at once
    const BATCH_SIZE = 500;
    if (totalFiles <= BATCH_SIZE) {
      const result = await client.query(
        'SELECT * FROM files WHERE repository_id = $1 ORDER BY file_path',
        [repositoryId]
      );
      return result.rows.map(mapToFile);
    }

    // For large repositories, use pagination to avoid WASM memory issues
    console.log(`  Large repository detected (${totalFiles} files), using pagination...`);
    const allFiles: File[] = [];
    let offset = 0;

    while (offset < totalFiles) {
      const batchResult = await client.query(
        'SELECT * FROM files WHERE repository_id = $1 ORDER BY file_path LIMIT $2 OFFSET $3',
        [repositoryId, BATCH_SIZE, offset]
      );

      const batchFiles = batchResult.rows.map(mapToFile);
      allFiles.push(...batchFiles);
      offset += BATCH_SIZE;

      // Log progress for large fetches
      if (totalFiles > BATCH_SIZE) {
        console.log(`  Loaded ${Math.min(offset, totalFiles)}/${totalFiles} files...`);
      }
    }

    return allFiles;
  } catch (error) {
    // Log the actual error for debugging
    console.error('getFilesByRepository failed:');
    console.error('  Repository ID:', repositoryId);
    console.error('  Error:', error);
    if (error instanceof Error) {
      console.error('  Error message:', error.message);
      console.error('  Error stack:', error.stack);
    }

    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get files for repository ${repositoryId}: ${error instanceof Error ? error.message : String(error)}`,
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
