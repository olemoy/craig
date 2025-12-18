/**
 * info tool implementation
 * Gets basic information for a repository including absolute path
 */

import { getRepositoryByName, getRepositoryByPath, getRepository } from '../../db/repositories.js';
import { getFilesByRepository, getChunksByFile } from '../../db/index.js';
import type { RepositoryId } from '../../db/types.js';
import { toRepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface GetInfoArgs {
  repository: string;
}

export interface InfoResult {
  repository: string;
  path: string;
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

  // Get files and count chunks
  const files = await getFilesByRepository(repo.id);
  let chunkCount = 0;
  for (const f of files) {
    const chunks = await getChunksByFile(f.id);
    chunkCount += chunks.length;
  }

  return {
    repository: repo.name,
    path: repo.path,
    fileCount: files.length,
    chunkCount,
  };
}

export const getInfoTool = {
  name: 'info',
  description: 'Get basic repository information. Parameters: repository (required, string - name/path/ID). Returns repository name, absolute path, file count, and chunk count. Use this to get the absolute path or quick overview of a repository.',
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
