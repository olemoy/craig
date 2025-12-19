/**
 * Repository table CRUD operations
 *
 * Provides functions for managing repository records in the database.
 * A repository represents a code repository being indexed by CRAIG.
 */

import { getClient } from './client.js';
import {
  Repository,
  RepositoryId,
  RepositoryInsert,
  RepositoryUpdate,
  DatabaseError,
  DatabaseErrorCode,
} from './types.js';
import { RepositoryRow, parseJSON, parseDate } from './row-types.js';

/**
 * Map database row to Repository type
 */
function mapToRepository(row: RepositoryRow): Repository {
  return {
    id: row.id as RepositoryId,
    name: row.name,
    path: row.path,
    commit_sha: row.commit_sha,
    ingested_at: parseDate(row.ingested_at),
    metadata: parseJSON(row.metadata),
  };
}

/**
 * Generate a new UUID for repository ID
 */
function generateRepositoryId(): RepositoryId {
  // Use crypto.randomUUID() for generating UUIDs
  return crypto.randomUUID() as RepositoryId;
}

/**
 * Insert a new repository
 *
 * @param data - Repository data to insert
 * @returns The created repository with generated id and timestamp
 * @throws DatabaseError if insertion fails or path already exists
 */
export async function insertRepository(
  data: RepositoryInsert
): Promise<Repository> {
  try {
    const client = await getClient();

    // Generate UUID for the repository
    const id = generateRepositoryId();

    const result = await client.query(
      `INSERT INTO repositories (id, name, path, commit_sha, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        id,
        data.name,
        data.path,
        data.commit_sha ?? null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );

    if (result.rows.length === 0) {
      throw new DatabaseError(
        DatabaseErrorCode.QUERY_FAILED,
        'Failed to insert repository: no rows returned'
      );
    }

    return mapToRepository(result.rows[0] as RepositoryRow);
  } catch (error) {
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      throw new DatabaseError(
        DatabaseErrorCode.CONSTRAINT_VIOLATION,
        `Repository with path '${data.path}' already exists`,
        error
      );
    }

    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      'Failed to insert repository',
      error
    );
  }
}

/**
 * Get repository by ID
 *
 * @param id - Repository ID
 * @returns The repository or null if not found
 * @throws DatabaseError if query fails
 */
export async function getRepository(
  id: RepositoryId
): Promise<Repository | null> {
  try {
    const client = await getClient();

    const result = await client.query(
      'SELECT * FROM repositories WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapToRepository(result.rows[0] as RepositoryRow);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get repository with id ${id}`,
      error
    );
  }
}

/**
 * Get repository by path
 *
 * @param path - Repository path
 * @returns The repository or null if not found
 * @throws DatabaseError if query fails
 */
export async function getRepositoryByPath(
  path: string
): Promise<Repository | null> {
  try {
    const client = await getClient();

    const result = await client.query(
      'SELECT * FROM repositories WHERE path = $1',
      [path]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapToRepository(result.rows[0] as RepositoryRow);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get repository with path '${path}'`,
      error
    );
  }
}

/**
 * Get repository by name
 *
 * @param name - Repository name
 * @returns The repository or null if not found
 * @throws DatabaseError if query fails
 */
export async function getRepositoryByName(
  name: string
): Promise<Repository | null> {
  try {
    const client = await getClient();

    const result = await client.query(
      'SELECT * FROM repositories WHERE name = $1',
      [name]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapToRepository(result.rows[0] as RepositoryRow);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to get repository with name '${name}'`,
      error
    );
  }
}

/**
 * List all repositories
 *
 * @returns Array of all repositories
 * @throws DatabaseError if query fails
 */
export async function listRepositories(): Promise<Repository[]> {
  try {
    const client = await getClient();

    const result = await client.query(
      'SELECT * FROM repositories ORDER BY ingested_at DESC'
    );

    return result.rows.map(row => mapToRepository(row as RepositoryRow));
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      'Failed to list repositories',
      error
    );
  }
}

/**
 * Update a repository
 *
 * @param data - Repository update data (must include id)
 * @returns The updated repository
 * @throws DatabaseError if update fails or repository not found
 */
export async function updateRepository(
  data: RepositoryUpdate
): Promise<Repository> {
  try {
    const client = await getClient();

    // Build dynamic UPDATE query based on provided fields
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (data.path !== undefined) {
      fields.push(`path = $${paramIndex++}`);
      values.push(data.path);
    }

    if (data.commit_sha !== undefined) {
      fields.push(`commit_sha = $${paramIndex++}`);
      values.push(data.commit_sha);
    }

    if (data.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(data.metadata ? JSON.stringify(data.metadata) : null);
    }

    if (fields.length === 0) {
      // No fields to update, just return the current repository
      const existing = await getRepository(data.id);
      if (!existing) {
        throw new DatabaseError(
          DatabaseErrorCode.NOT_FOUND,
          `Repository with id ${data.id} not found`
        );
      }
      return existing;
    }

    // Add id parameter
    values.push(data.id);

    const result = await client.query(
      `UPDATE repositories
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new DatabaseError(
        DatabaseErrorCode.NOT_FOUND,
        `Repository with id ${data.id} not found`
      );
    }

    return mapToRepository(result.rows[0] as RepositoryRow);
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }

    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      throw new DatabaseError(
        DatabaseErrorCode.CONSTRAINT_VIOLATION,
        `Repository with path '${data.path}' already exists`,
        error
      );
    }

    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to update repository with id ${data.id}`,
      error
    );
  }
}

/**
 * Delete a repository
 *
 * Note: This will cascade delete all associated files, chunks, and embeddings
 *
 * @param id - Repository ID to delete
 * @throws DatabaseError if deletion fails
 */
export async function deleteRepository(id: RepositoryId): Promise<void> {
  try {
    const client = await getClient();

    const result = await client.query(
      'DELETE FROM repositories WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw new DatabaseError(
        DatabaseErrorCode.NOT_FOUND,
        `Repository with id ${id} not found`
      );
    }
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(
      DatabaseErrorCode.QUERY_FAILED,
      `Failed to delete repository with id ${id}`,
      error
    );
  }
}
