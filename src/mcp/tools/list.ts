/**
 * list_repositories tool implementation
 * Lists all indexed repositories
 */

import { getClient } from '../../db/client.js';
import type { RepositoryInfo } from '../types.js';

interface RepositoryRow {
  id: string;
  name: string;
  path: string;
  commit_sha: string | null;
  ingested_at: string;
  file_count: string | number;
}

export async function listRepositories(): Promise<RepositoryInfo[]> {
  const client = await getClient();

  // Get repositories with file counts
  const result = await client.query(`
    SELECT
      r.id,
      r.name,
      r.path,
      r.commit_sha,
      r.ingested_at,
      COUNT(f.id) as file_count
    FROM repositories r
    LEFT JOIN files f ON f.repository_id = r.id
    GROUP BY r.id, r.name, r.path, r.commit_sha, r.ingested_at
    ORDER BY r.ingested_at DESC
  `);

  return result.rows.map((row) => {
    const typedRow = row as RepositoryRow;
    return {
      id: typedRow.id,
      name: typedRow.name,
      fileCount: typeof typedRow.file_count === 'string' ? parseInt(typedRow.file_count, 10) : typedRow.file_count,
    };
  });
}

export const listRepositoriesTool = {
  name: 'repos',
  description: 'List all indexed repositories. No parameters required. Returns array of repositories with id, name, and file count (absolute path excluded - use info tool if needed). Use as starting point to discover available repositories before using other tools.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};
