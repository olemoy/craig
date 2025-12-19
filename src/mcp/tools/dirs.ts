/**
 * dirs tool implementation
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
  limit?: number;
  offset?: number;
}

export interface GetDirectoriesResult {
  repository: string;
  total: number;
  count: number;
  directories: string[];
  more: boolean;
  next?: number | undefined;
}

interface FilePathRow {
  file_path: string;
}

export async function getDirectories(args: GetDirectoriesArgs): Promise<GetDirectoriesResult> {
  const { repository, path, depth = 0, limit = 100, offset = 0 } = args;

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
  const params: (string | number)[] = [repo.id];

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
    const typedRow = row as FilePathRow;
    const relativePath = typedRow.file_path.replace(repoPath, '');
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
  const allDirectories = Array.from(dirSet).sort();
  const total = allDirectories.length;

  // Apply pagination
  let directories: string[];
  if (limit !== undefined) {
    directories = allDirectories.slice(offset, offset + limit);
  } else {
    directories = allDirectories.slice(offset);
  }

  const count = directories.length;
  const more = limit !== undefined && (offset + count) < total;
  const next = more ? offset + count : undefined;

  return {
    repository: repo.name,
    total,
    count,
    directories,
    more,
    next,
  };
}

export const getDirectoriesTool = {
  name: 'dirs',
  description: 'Get directory structure (no files). Parameters: repository (required, string - name/path/ID), path (optional, string - filter to subdirectory), depth (optional, number, default: 0 - where 0=root only, 1=one level down, etc.), limit (optional, number, default: 100 - keep low to avoid context bloat), offset (optional, number, default: 0 - for pagination). Returns paginated results. Start with root-level exploration (depth=0), then drill down incrementally.',
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
        description: 'Optional: depth from root (0=root only, 1=one level down, default: 0)',
        default: 0,
      },
      limit: {
        type: 'number',
        description: 'Optional: maximum number of directories to return (default: 100)',
        default: 100,
      },
      offset: {
        type: 'number',
        description: 'Optional: number of directories to skip (for pagination, default: 0)',
        default: 0,
      },
    },
    required: ['repository'],
  },
};
