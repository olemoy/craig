/**
 * find_similar tool implementation
 * Finds code similar to a given code snippet
 */

import { embedText } from '../../embeddings/pipeline.js';
import { getClient } from '../../db/client.js';
import { getRepositoryByPath, getRepositoryByName, getRepository } from '../../db/repositories.js';
import type { SimilarCodeResult } from '../types.js';
import { toRepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface FindSimilarArgs {
  code: string;
  repository?: string;
  limit?: number;
}

export async function findSimilar(args: FindSimilarArgs): Promise<SimilarCodeResult[]> {
  const { code, repository, limit = 10 } = args;

  if (!code || code.trim().length === 0) {
    throw createInvalidParamsError('code parameter is required and must not be empty');
  }

  // Generate embedding for the code snippet
  const codeEmbedding = await embedText(code);

  const client = await getClient();
  const vectorString = `[${codeEmbedding.join(',')}]`;

  let sql = `
    SELECT
      e.chunk_id,
      c.file_id,
      c.content,
      f.repository_id,
      f.file_path,
      f.file_type,
      f.language,
      r.name as repository_name,
      1 - (e.embedding <=> $1::vector) AS similarity
    FROM embeddings e
    JOIN chunks c ON c.id = e.chunk_id
    JOIN files f ON f.id = c.file_id
    JOIN repositories r ON r.id = f.repository_id
  `;

  const params: any[] = [vectorString];
  let paramIndex = 2;

  // Filter by repository if specified
  if (repository) {
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
    sql += ` WHERE f.repository_id = $${paramIndex}`;
    params.push(repo.id);
    paramIndex++;
  }

  sql += `
    ORDER BY similarity DESC
    LIMIT $${paramIndex}
  `;
  params.push(limit);

  const result = await client.query(sql, params);

  return result.rows.map((row: any) => ({
    repository: row.repository_name,
    filePath: row.file_path,
    fileType: row.file_type,
    language: row.language,
    content: row.file_type === 'binary'
      ? '(Binary file)'
      : row.content,
    similarity: parseFloat(row.similarity),
  }));
}

export const findSimilarTool = {
  name: 'similar',
  description: 'Find code similar to given snippet',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Code snippet to match',
      },
      repository: {
        type: 'string',
        description: 'Optional: repository filter',
      },
      limit: {
        type: 'number',
        description: 'Max results (default: 10)',
        default: 10,
      },
    },
    required: ['code'],
  },
};
