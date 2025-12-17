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
}

export interface ListFilesResult {
  repository: string;
  fileCount: number;
  files: string[];
}

export async function listFiles(args: ListFilesArgs): Promise<ListFilesResult> {
  const { repository, path } = args;

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

  // Get all files, optionally filtered by path
  const client = await getClient();
  const repoPath = repo.path.endsWith('/') ? repo.path : repo.path + '/';

  let sql = `SELECT file_path FROM files WHERE repository_id = $1`;
  const params: any[] = [repo.id];

  // Filter by path if provided
  if (path) {
    const filterPath = path.startsWith('/') ? path.slice(1) : path;
    const fullFilterPath = repoPath + filterPath;
    sql += ` AND file_path LIKE $2`;
    params.push(fullFilterPath + '%');
  }

  sql += ` ORDER BY file_path`;

  const result = await client.query(sql, params);

  // Convert absolute paths to relative paths
  const files: string[] = result.rows.map((row: any) =>
    row.file_path.replace(repoPath, '')
  );

  return {
    repository: repo.name,
    fileCount: files.length,
    files,
  };
}

export const listFilesTool = {
  name: 'files',
  description: 'List files in repository as relative paths',
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
    },
    required: ['repository'],
  },
};
