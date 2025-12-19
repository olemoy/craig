/**
 * Database health check and repair utilities
 * Helps diagnose and fix common database issues
 */

import { getClient } from './client.js';
import type { RepositoryId } from './types.js';

export interface HealthCheckResult {
  healthy: boolean;
  issues: string[];
  details: {
    canConnect: boolean;
    canQuery: boolean;
    repositoryCount: number;
    fileCount: number;
    chunkCount: number;
    embeddingCount: number;
    orphanedFiles: number;
    orphanedChunks: number;
    orphanedEmbeddings: number;
  };
}

/**
 * Perform a comprehensive health check on the database
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  const issues: string[] = [];
  const details = {
    canConnect: false,
    canQuery: false,
    repositoryCount: 0,
    fileCount: 0,
    chunkCount: 0,
    embeddingCount: 0,
    orphanedFiles: 0,
    orphanedChunks: 0,
    orphanedEmbeddings: 0,
  };

  try {
    // Test connection
    const client = await getClient();
    details.canConnect = true;

    // Test basic queries
    try {
      const repoResult = await client.query('SELECT COUNT(*) as count FROM repositories');
      details.repositoryCount = parseInt((repoResult.rows[0] as any).count, 10);
      details.canQuery = true;
    } catch (error) {
      issues.push(`Cannot query repositories table: ${error}`);
    }

    try {
      const fileResult = await client.query('SELECT COUNT(*) as count FROM files');
      details.fileCount = parseInt((fileResult.rows[0] as any).count, 10);
    } catch (error) {
      issues.push(`Cannot query files table: ${error}`);
    }

    try {
      const chunkResult = await client.query('SELECT COUNT(*) as count FROM chunks');
      details.chunkCount = parseInt((chunkResult.rows[0] as any).count, 10);
    } catch (error) {
      issues.push(`Cannot query chunks table: ${error}`);
    }

    try {
      const embeddingResult = await client.query('SELECT COUNT(*) as count FROM embeddings');
      details.embeddingCount = parseInt((embeddingResult.rows[0] as any).count, 10);
    } catch (error) {
      issues.push(`Cannot query embeddings table: ${error}`);
    }

    // Check for orphaned records
    try {
      const orphanedFilesResult = await client.query(`
        SELECT COUNT(*) as count
        FROM files f
        LEFT JOIN repositories r ON f.repository_id = r.id
        WHERE r.id IS NULL
      `);
      details.orphanedFiles = parseInt((orphanedFilesResult.rows[0] as any).count, 10);
      if (details.orphanedFiles > 0) {
        issues.push(`Found ${details.orphanedFiles} orphaned files (no parent repository)`);
      }
    } catch (error) {
      issues.push(`Cannot check for orphaned files: ${error}`);
    }

    try {
      const orphanedChunksResult = await client.query(`
        SELECT COUNT(*) as count
        FROM chunks c
        LEFT JOIN files f ON c.file_id = f.id
        WHERE f.id IS NULL
      `);
      details.orphanedChunks = parseInt((orphanedChunksResult.rows[0] as any).count, 10);
      if (details.orphanedChunks > 0) {
        issues.push(`Found ${details.orphanedChunks} orphaned chunks (no parent file)`);
      }
    } catch (error) {
      issues.push(`Cannot check for orphaned chunks: ${error}`);
    }

    try {
      const orphanedEmbeddingsResult = await client.query(`
        SELECT COUNT(*) as count
        FROM embeddings e
        LEFT JOIN chunks c ON e.chunk_id = c.id
        WHERE c.id IS NULL
      `);
      details.orphanedEmbeddings = parseInt((orphanedEmbeddingsResult.rows[0] as any).count, 10);
      if (details.orphanedEmbeddings > 0) {
        issues.push(`Found ${details.orphanedEmbeddings} orphaned embeddings (no parent chunk)`);
      }
    } catch (error) {
      issues.push(`Cannot check for orphaned embeddings: ${error}`);
    }

  } catch (error) {
    issues.push(`Cannot connect to database: ${error}`);
  }

  return {
    healthy: issues.length === 0,
    issues,
    details,
  };
}

/**
 * Attempt to repair common database issues
 * Returns the number of issues fixed
 */
export async function repairDatabase(): Promise<number> {
  const client = await getClient();
  let fixedCount = 0;

  console.log('Starting database repair...');

  // Clean up orphaned embeddings
  try {
    const countBefore = await client.query('SELECT COUNT(*) as count FROM embeddings WHERE chunk_id NOT IN (SELECT id FROM chunks)');
    const deletedCount = parseInt((countBefore.rows[0] as any).count, 10);

    if (deletedCount > 0) {
      await client.query(`
        DELETE FROM embeddings
        WHERE chunk_id NOT IN (SELECT id FROM chunks)
      `);
      console.log(`✓ Removed ${deletedCount} orphaned embeddings`);
      fixedCount += deletedCount;
    }
  } catch (error) {
    console.error(`✗ Failed to remove orphaned embeddings: ${error}`);
  }

  // Clean up orphaned chunks
  try {
    const countBefore = await client.query('SELECT COUNT(*) as count FROM chunks WHERE file_id NOT IN (SELECT id FROM files)');
    const deletedCount = parseInt((countBefore.rows[0] as any).count, 10);

    if (deletedCount > 0) {
      await client.query(`
        DELETE FROM chunks
        WHERE file_id NOT IN (SELECT id FROM files)
      `);
      console.log(`✓ Removed ${deletedCount} orphaned chunks`);
      fixedCount += deletedCount;
    }
  } catch (error) {
    console.error(`✗ Failed to remove orphaned chunks: ${error}`);
  }

  // Clean up orphaned files
  try {
    const countBefore = await client.query('SELECT COUNT(*) as count FROM files WHERE repository_id NOT IN (SELECT id FROM repositories)');
    const deletedCount = parseInt((countBefore.rows[0] as any).count, 10);

    if (deletedCount > 0) {
      await client.query(`
        DELETE FROM files
        WHERE repository_id NOT IN (SELECT id FROM repositories)
      `);
      console.log(`✓ Removed ${deletedCount} orphaned files`);
      fixedCount += deletedCount;
    }
  } catch (error) {
    console.error(`✗ Failed to remove orphaned files: ${error}`);
  }

  // Vacuum to reclaim space (if supported by PGLite)
  try {
    await client.query('VACUUM');
    console.log('✓ Database vacuumed');
  } catch (error) {
    // Vacuum might not be supported, ignore
  }

  console.log(`Database repair complete. Fixed ${fixedCount} issues.`);
  return fixedCount;
}

/**
 * Validate that a repository's data is consistent
 */
export async function validateRepository(repositoryId: RepositoryId): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const client = await getClient();
  const issues: string[] = [];

  // Check if repository exists
  const repoResult = await client.query(
    'SELECT id FROM repositories WHERE id = $1',
    [repositoryId]
  );
  if (repoResult.rows.length === 0) {
    issues.push('Repository does not exist');
    return { valid: false, issues };
  }

  // Check files
  try {
    await client.query(
      'SELECT COUNT(*) as count FROM files WHERE repository_id = $1',
      [repositoryId]
    );

    // Check for files with NULL required fields
    const invalidFilesResult = await client.query(`
      SELECT COUNT(*) as count FROM files
      WHERE repository_id = $1
      AND (file_path IS NULL OR file_type IS NULL OR content_hash IS NULL)
    `, [repositoryId]);
    const invalidFiles = parseInt((invalidFilesResult.rows[0] as any).count, 10);

    if (invalidFiles > 0) {
      issues.push(`Found ${invalidFiles} files with NULL required fields`);
    }
  } catch (error) {
    issues.push(`Error checking files: ${error}`);
  }

  // Check chunks
  try {
    await client.query(`
      SELECT COUNT(*) as count FROM chunks c
      INNER JOIN files f ON c.file_id = f.id
      WHERE f.repository_id = $1
    `, [repositoryId]);

    // Check for chunks without embeddings (for non-binary files)
    const missingEmbeddingsResult = await client.query(`
      SELECT COUNT(*) as count FROM chunks c
      INNER JOIN files f ON c.file_id = f.id
      LEFT JOIN embeddings e ON c.id = e.chunk_id
      WHERE f.repository_id = $1
      AND f.file_type != 'binary'
      AND e.id IS NULL
    `, [repositoryId]);
    const missingEmbeddings = parseInt((missingEmbeddingsResult.rows[0] as any).count, 10);

    if (missingEmbeddings > 0) {
      issues.push(`Found ${missingEmbeddings} chunks without embeddings`);
    }
  } catch (error) {
    issues.push(`Error checking chunks: ${error}`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
