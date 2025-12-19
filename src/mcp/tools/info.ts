/**
 * info tool implementation
 * Gets basic information for a repository
 */

import { getRepositoryByName, getRepositoryByPath, getRepository } from '../../db/repositories.js';
import { getClient } from '../../db/client.js';
import type { RepositoryId } from '../../db/types.js';
import { toRepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface GetInfoArgs {
  repository: string;
}

export interface InfoResult {
  repository: string;
  fileCount: number;
  chunkCount: number;
}

export async function getInfo(args: GetInfoArgs): Promise<InfoResult> {
  const { repository } = args;

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

  interface CountRow {
    count: string | number;
  }

  const client = await getClient();

  // Get file count
  const fileCountResult = await client.query(
    'SELECT COUNT(*) as count FROM files WHERE repository_id = $1',
    [repo.id]
  );
  const fileCountRow = fileCountResult.rows[0] as CountRow | undefined;
  const fileCount = fileCountRow ? (typeof fileCountRow.count === 'string' ? parseInt(fileCountRow.count, 10) : fileCountRow.count) : 0;

  // Get chunk count
  const chunkCountResult = await client.query(
    `SELECT COUNT(*) as count
    FROM chunks c
    JOIN files f ON f.id = c.file_id
    WHERE f.repository_id = $1`,
    [repo.id]
  );
  const chunkCountRow = chunkCountResult.rows[0] as CountRow | undefined;
  const chunkCount = chunkCountRow ? (typeof chunkCountRow.count === 'string' ? parseInt(chunkCountRow.count, 10) : chunkCountRow.count) : 0;

  return {
    repository: repo.name,
    fileCount,
    chunkCount,
  };
}

export const getInfoTool = {
  name: 'info',
  description: 'Get basic repository information. Parameters: repository (required, string - name/path/ID). Returns repository name, file count, and chunk count. Use this to get a quick overview of a repository.',
  inputSchema: {
    type: 'object',
    properties: {
      repository: {
        type: 'string',
        description: 'Repository name, path, or ID',
      },
    },
    required: ['repository'],
  },
};
