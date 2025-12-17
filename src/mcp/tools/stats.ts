/**
 * get_stats tool implementation
 * Gets statistics for a repository
 */

import { getRepositoryByName, getRepositoryByPath, getRepository } from '../../db/repositories.js';
import { getFilesByRepository, getChunksByFile } from '../../db/index.js';
import type { RepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface GetStatsArgs {
  repository: string;
}

export interface RepositoryStats {
  repository: string;
  repositoryId: number;
  repositoryPath: string;
  commitSha: string | null;
  ingestedAt: string | Date;
  fileCount: number;
  chunkCount: number;
}

export async function getStats(args: GetStatsArgs): Promise<RepositoryStats> {
  const { repository } = args;

  if (!repository || repository.trim().length === 0) {
    throw createInvalidParamsError('repository parameter is required');
  }

  // Look up repository
  let repo = await getRepositoryByName(repository);
  if (!repo) repo = await getRepositoryByPath(repository);
  if (!repo && /^\d+$/.test(repository)) {
    repo = await getRepository(parseInt(repository, 10) as RepositoryId);
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
    repositoryId: repo.id,
    repositoryPath: repo.path,
    commitSha: repo.commit_sha,
    ingestedAt: repo.ingested_at,
    fileCount: files.length,
    chunkCount,
  };
}

export const getStatsTool = {
  name: 'get_stats',
  description: 'Get statistics for a repository including file count, chunk count, and ingestion metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      repository: {
        type: 'string',
        description: 'Repository name, path, or numeric ID',
      },
    },
    required: ['repository'],
  },
};
