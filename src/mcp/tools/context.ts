/**
 * get_file_context tool implementation
 * Retrieves complete file content with metadata
 */

import { getClient } from '../../db/client.js';
import { getRepositoryByPath, getRepositoryByName, getRepository } from '../../db/repositories.js';
import type { FileContextResult } from '../types.js';
import { toRepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface GetFileContextArgs {
  filePath: string;
  repository: string;
}

export async function getFileContext(args: GetFileContextArgs): Promise<FileContextResult> {
  const { filePath, repository } = args;

  if (!filePath || filePath.trim().length === 0) {
    throw createInvalidParamsError('filePath parameter is required and must not be empty');
  }

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

  // Query file
  const client = await getClient();
  const result = await client.query(
    `SELECT
      f.id,
      f.file_path,
      f.file_type,
      f.content,
      f.binary_metadata,
      f.size_bytes,
      f.last_modified,
      f.language,
      r.name as repository_name,
      r.id as repository_id
    FROM files f
    JOIN repositories r ON r.id = f.repository_id
    WHERE f.repository_id = $1 AND f.file_path = $2`,
    [repo.id, filePath]
  );

  if (result.rows.length === 0) {
    throw createNotFoundError(`File '${filePath}' not found in repository '${repository}'`);
  }

  const file = result.rows[0];

  return {
    repository: file.repository_name,
    repositoryId: file.repository_id,
    filePath: file.file_path,
    fileType: file.file_type,
    language: file.language,
    content: file.file_type === 'binary'
      ? '(Binary file - use binaryMetadata for details)'
      : file.content,
    size: file.size_bytes,
    lastModified: file.last_modified ? new Date(file.last_modified) : null,
    binaryMetadata: file.binary_metadata,
  };
}

export const getFileContextTool = {
  name: 'get_file_context',
  description: 'Retrieve the complete content of a specific file from a repository. Returns full file content for text/code files, or metadata for binary files.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file within the repository',
      },
      repository: {
        type: 'string',
        description: 'Repository name or path',
      },
    },
    required: ['filePath', 'repository'],
  },
};
