/**
 * list_repositories tool implementation
 * Lists all indexed repositories
 */

import { getClient } from '../../db/client.js';
import type { RepositoryInfo } from '../types.js';

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

  return result.rows.map((row: any) => ({
    name: row.name,
    path: row.path,
    fileCount: parseInt(row.file_count, 10),
  }));
}

export const listRepositoriesTool = {
  name: 'repos',
  description: 'List all indexed repositories',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};
