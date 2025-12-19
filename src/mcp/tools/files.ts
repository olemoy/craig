/**
 * list_files tool implementation
 * Lists all files in a repository
 */

import { getClient } from '../../db/client.js';
import { getRepositoryByName, getRepositoryByPath, getRepository } from '../../db/repositories.js';
import type { RepositoryId } from '../../db/types.js';
import { toRepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface ListFilesArgs {
  repository: string;
  path?: string;
  pattern?: string;
  limit?: number;
  offset?: number;
}

export interface ListFilesResult {
  repository: string;
  total: number;
  count: number;
  files: string[];
  more: boolean;
  next?: number | undefined;
}

interface FilePathRow {
  file_path: string;
}

interface CountRow {
  count: string | number;
}

export async function listFiles(args: ListFilesArgs): Promise<ListFilesResult> {
  const { repository, path, pattern, limit = 100, offset = 0 } = args;

  if (!repository || repository.trim().length === 0) {
    throw createInvalidParamsError('repository parameter is required');
  }

  // Look up repository by name, path, or UUID
  let repo = await getRepositoryByName(repository);
  if (!repo) repo = await getRepositoryByPath(repository);
  if (!repo) {
    const repoId = toRepositoryId(repository);
    if (repoId) {
      repo = await getRepository(repoId);
    }
  }

  if (!repo) {
    throw createNotFoundError(`Repository '${repository}' not found`);
  }

  // Get files, optionally filtered by path, with pagination
  const client = await getClient();
  const repoPath = repo.path.endsWith('/') ? repo.path : repo.path + '/';

  // Build base query for counting and fetching
  let baseWhere = `WHERE repository_id = $1`;
  const params: (string | number)[] = [repo.id];

  // Filter by path if provided
  if (path) {
    const filterPath = path.startsWith('/') ? path.slice(1) : path;
    const fullFilterPath = repoPath + filterPath;
    baseWhere += ` AND file_path LIKE $${params.length + 1}`;
    params.push(fullFilterPath + '%');
  }

  // Filter by filename pattern if provided (glob-style: *.ts, *config*, etc.)
  if (pattern) {
    // Convert glob pattern to SQL LIKE pattern
    const sqlPattern = pattern.replace(/\*/g, '%').replace(/\?/g, '_');
    baseWhere += ` AND file_path LIKE $${params.length + 1}`;
    params.push(sqlPattern);
  }

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as count FROM files ${baseWhere}`,
    params
  );
  const countRow = countResult.rows[0] as CountRow;
  const total = typeof countRow.count === 'string' ? parseInt(countRow.count, 10) : countRow.count;

  // Build paginated query
  let sql = `SELECT file_path FROM files ${baseWhere} ORDER BY file_path`;
  const queryParams = [...params];

  if (limit !== undefined) {
    sql += ` LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit);
  }

  if (offset > 0) {
    sql += ` OFFSET $${queryParams.length + 1}`;
    queryParams.push(offset);
  }

  const result = await client.query(sql, queryParams);

  // Convert absolute paths to relative paths
  const files: string[] = result.rows.map((row) => {
    const typedRow = row as FilePathRow;
    return typedRow.file_path.replace(repoPath, '');
  });

  const count = files.length;
  const more = limit !== undefined && (offset + count) < total;
  const next = more ? offset + count : undefined;

  return {
    repository: repo.name,
    total,
    count,
    files,
    more,
    next,
  };
}

export const listFilesTool = {
  name: 'files',
  description: 'List files in repository as relative paths. Parameters: repository (required, string - name/path/ID), path (optional, string - filter to subdirectory), pattern (optional, string - filename pattern like "*.ts" or "*config*"), limit (optional, number, default: 100 - keep low to avoid context bloat), offset (optional, number, default: 0 - for pagination). Returns paginated results with total count and "more" flag. Use pattern to search by filename.',
  inputSchema: {
    type: 'object',
    properties: {
      repository: {
        type: 'string',
        description: 'Repository name, path, or ID',
      },
      path: {
        type: 'string',
        description: 'Optional: filter to files under this path (e.g., "src/", "docs/")',
      },
      pattern: {
        type: 'string',
        description: 'Optional: filename pattern using wildcards (e.g., "*.ts", "*test*", "config.*")',
      },
      limit: {
        type: 'number',
        description: 'Optional: maximum number of files to return (default: 100)',
        default: 100,
      },
      offset: {
        type: 'number',
        description: 'Optional: number of files to skip (for pagination, default: 0)',
        default: 0,
      },
    },
    required: ['repository'],
  },
};
