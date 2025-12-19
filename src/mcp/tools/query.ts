/**
 * query tool implementation
 * Performs semantic search across code repositories
 */

import { embedText } from '../../embeddings/pipeline.js';
import { getClient } from '../../db/client.js';
import { getRepositoryByPath, getRepositoryByName, getRepository } from '../../db/repositories.js';
import type { SearchResult } from '../types.js';
import { toRepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface QueryArgs {
  query: string;
  repository?: string;
  limit?: number;
  fileType?: 'code' | 'text' | 'binary';
}

interface QueryResultRow {
  chunk_id: number;
  file_id: number;
  content: string;
  chunk_index: number;
  metadata: string | null;
  repository_id: string;
  file_path: string;
  file_type: 'code' | 'text' | 'binary';
  language: string | null;
  repository_name: string;
  repository_path: string;
  similarity: number | string;
}

export async function query(args: QueryArgs): Promise<SearchResult[]> {
  const { query, repository, limit = 10, fileType } = args;

  if (!query || query.trim().length === 0) {
    throw createInvalidParamsError('query parameter is required and must not be empty');
  }

  // Generate embedding for the query
  const queryEmbedding = await embedText(query);

  const client = await getClient();
  const vectorString = `[${queryEmbedding.join(',')}]`;

  let sql = `
    SELECT
      e.chunk_id,
      c.file_id,
      c.content,
      c.chunk_index,
      c.metadata,
      f.repository_id,
      f.file_path,
      f.file_type,
      f.language,
      r.name as repository_name,
      r.path as repository_path,
      1 - (e.embedding <=> $1::vector) AS similarity
    FROM embeddings e
    JOIN chunks c ON c.id = e.chunk_id
    JOIN files f ON f.id = c.file_id
    JOIN repositories r ON r.id = f.repository_id
  `;

  const params: (string | number)[] = [vectorString];
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

  // Filter by file type if specified
  if (fileType) {
    sql += repository ? ' AND' : ' WHERE';
    sql += ` f.file_type = $${paramIndex}`;
    params.push(fileType);
    paramIndex++;
  }

  sql += `
    ORDER BY similarity DESC
    LIMIT $${paramIndex}
  `;
  params.push(limit);

  const result = await client.query(sql, params);

  return result.rows.map((row) => {
    const typedRow = row as QueryResultRow;
    // Convert absolute path to relative path
    const repoPath = typedRow.repository_path.endsWith('/') ? typedRow.repository_path : typedRow.repository_path + '/';
    const relativePath = typedRow.file_path.replace(repoPath, '');

    return {
      repository: typedRow.repository_name,
      filePath: relativePath,
      fileType: typedRow.file_type,
      language: typedRow.language,
      content: typedRow.file_type === 'binary'
        ? '(Binary file - metadata only)'
        : typedRow.content,
      similarity: typeof typedRow.similarity === 'string' ? parseFloat(typedRow.similarity) : typedRow.similarity,
    };
  });
}

export const queryTool = {
  name: 'query',
  description: 'Semantic code search using natural language queries. Parameters: query (required, string), repository (optional, string - name/path/ID), limit (optional, number, default: 10), fileType (optional, enum: code|text|binary). Use to find relevant code by describing what you\'re looking for.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query (e.g., "auth logic", "error handling")',
      },
      repository: {
        type: 'string',
        description: 'Optional: repository name/path filter',
      },
      limit: {
        type: 'number',
        description: 'Max results (default: 10)',
        default: 10,
      },
      fileType: {
        type: 'string',
        enum: ['code', 'text', 'binary'],
        description: 'Optional: filter by file type',
      },
    },
    required: ['query'],
  },
};
