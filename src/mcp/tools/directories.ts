/**
 * directories tool implementation
 * Returns directory structure without files
 */

import { getClient } from '../../db/client.js';
import { getRepositoryByName, getRepositoryByPath, getRepository } from '../../db/repositories.js';
import type { RepositoryId } from '../../db/types.js';
import { toRepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface GetDirectoriesArgs {
  repository: string;
  path?: string;
  depth?: number;
}

export interface GetDirectoriesResult {
  repository: string;
  directories: string[];
}

export async function getDirectories(args: GetDirectoriesArgs): Promise<GetDirectoriesResult> {
  const { repository, path, depth } = args;

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

  // Get all files to extract unique directories
  const client = await getClient();
  const repoPath = repo.path.endsWith('/') ? repo.path : repo.path + '/';

  let sql = `SELECT DISTINCT file_path FROM files WHERE repository_id = $1`;
  const params: any[] = [repo.id];

  // Filter by path if provided
  if (path) {
    const filterPath = path.startsWith('/') ? path.slice(1) : path;
    const fullFilterPath = repoPath + filterPath;
    sql += ` AND file_path LIKE $2`;
    params.push(fullFilterPath + '%');
  }

  const result = await client.query(sql, params);

  // Extract unique directories from file paths
  const dirSet = new Set<string>();

  for (const row of result.rows) {
    const relativePath = row.file_path.replace(repoPath, '');
    const parts = relativePath.split('/');

    // Remove the filename (last part) and build directory paths
    parts.pop();

    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

      // Apply depth filter if specified (0 = root only, 1 = one level down, etc.)
      const pathDepth = currentPath.split('/').length - 1;
      if (depth !== undefined && pathDepth > depth) {
        break;
      }

      // Filter by starting path if provided
      if (path) {
        const filterPath = path.startsWith('/') ? path.slice(1) : path;
        const normalizedFilter = filterPath.endsWith('/') ? filterPath.slice(0, -1) : filterPath;

        if (currentPath === normalizedFilter || currentPath.startsWith(normalizedFilter + '/')) {
          dirSet.add(currentPath);
        }
      } else {
        dirSet.add(currentPath);
      }
    }
  }

  // Convert to sorted array
  const directories = Array.from(dirSet).sort();

  return {
    repository: repo.name,
    directories,
  };
}

export const getDirectoriesTool = {
  name: 'directories',
  description: 'Get directory structure (no files)',
  inputSchema: {
    type: 'object',
    properties: {
      repository: {
        type: 'string',
        description: 'Repository name, path, or ID',
      },
      path: {
        type: 'string',
        description: 'Optional: filter to directories under this path',
      },
      depth: {
        type: 'number',
        description: 'Optional: depth from root (0=root only, 1=one level down)',
      },
    },
    required: ['repository'],
  },
};
