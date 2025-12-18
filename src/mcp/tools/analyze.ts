/**
 * analyze_codebase tool implementation
 * Provides repository statistics and metrics
 */

import { getClient } from '../../db/client.js';
import { getRepositoryByPath, getRepositoryByName, getRepository } from '../../db/repositories.js';
import type { RepositoryStats } from '../types.js';
import { toRepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface AnalyzeCodebaseArgs {
  repository: string;
}

export async function analyzeCodebase(args: AnalyzeCodebaseArgs): Promise<RepositoryStats> {
  const { repository } = args;

  if (!repository || repository.trim().length === 0) {
    throw createInvalidParamsError('repository parameter is required and must not be empty');
  }

  // Try to find repository by name, path, or UUID
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

  const client = await getClient();

  // Get file counts by type
  const fileStatsResult = await client.query(
    `SELECT
      file_type,
      COUNT(*) as count
    FROM files
    WHERE repository_id = $1
    GROUP BY file_type`,
    [repo.id]
  );

  const fileStats: Record<string, number> = {
    code: 0,
    text: 0,
    binary: 0,
  };

  for (const row of fileStatsResult.rows) {
    fileStats[row.file_type] = parseInt(row.count, 10);
  }

  const totalFiles = fileStats.code + fileStats.text + fileStats.binary;

  // Get total chunks
  const chunksResult = await client.query(
    `SELECT COUNT(*) as count
    FROM chunks c
    JOIN files f ON f.id = c.file_id
    WHERE f.repository_id = $1`,
    [repo.id]
  );

  const totalChunks = parseInt(chunksResult.rows[0]?.count ?? '0', 10);

  // Get total embeddings
  const embeddingsResult = await client.query(
    `SELECT COUNT(*) as count
    FROM embeddings e
    JOIN chunks c ON c.id = e.chunk_id
    JOIN files f ON f.id = c.file_id
    WHERE f.repository_id = $1`,
    [repo.id]
  );

  const totalEmbeddings = parseInt(embeddingsResult.rows[0]?.count ?? '0', 10);

  // Get language distribution
  const languagesResult = await client.query(
    `SELECT
      language,
      COUNT(*) as count
    FROM files
    WHERE repository_id = $1 AND language IS NOT NULL
    GROUP BY language
    ORDER BY count DESC`,
    [repo.id]
  );

  const languages: Record<string, number> = {};
  for (const row of languagesResult.rows) {
    if (row.language) {
      languages[row.language] = parseInt(row.count, 10);
    }
  }

  return {
    repository: repo.name,
    totalFiles,
    codeFiles: fileStats.code,
    textFiles: fileStats.text,
    binaryFiles: fileStats.binary,
    totalChunks,
    totalEmbeddings,
    languages,
  };
}

export const analyzeCodebaseTool = {
  name: 'analyze',
  description: 'Analyze repository metrics and language distribution. Parameters: repository (required, string - name/path/ID). Returns detailed stats including file counts by type (code/text/binary), language distribution, chunk counts, and embeddings. Use for comprehensive repository overview.',
  inputSchema: {
    type: 'object',
    properties: {
      repository: {
        type: 'string',
        description: 'Repository name or path',
      },
    },
    required: ['repository'],
  },
};
