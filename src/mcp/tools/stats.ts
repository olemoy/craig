/**
 * get_stats tool implementation
 * Gets statistics for a repository
 */

import { getRepositoryByName, getRepositoryByPath, getRepository } from '../../db/repositories.js';
import { getFilesByRepository, getChunksByFile } from '../../db/index.js';
import type { RepositoryId } from '../../db/types.js';
import { toRepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface GetStatsArgs {
  repository: string;
}

export interface StatsResult {
  repository: string;
  fileCount: number;
  chunkCount: number;
}

export async function getStats(args: GetStatsArgs): Promise<StatsResult> {
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
    fileCount: files.length,
    chunkCount,
  };
}

export const getStatsTool = {
  name: 'stats',
  description: 'Get repository statistics (files, chunks, embeddings). Parameters: repository (required, string - name/path/ID). Returns counts for files, chunks, and embeddings. Useful for understanding repository ingestion status.',
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
