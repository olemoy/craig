/**
 * file_info tool implementation
 * Retrieves file metadata including absolute path for agent to access
 */

import { getClient } from '../../db/client.js';
import { getRepositoryByPath, getRepositoryByName, getRepository } from '../../db/repositories.js';
import type { FileInfoResult } from '../types.js';
import { toRepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface GetFileInfoArgs {
  filePath: string;
  repository: string;
}

export async function getFileInfo(args: GetFileInfoArgs): Promise<FileInfoResult> {
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

  // Build absolute path from relative path
  const repoPath = repo.path.endsWith('/') ? repo.path : repo.path + '/';
  const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  const absolutePath = repoPath + normalizedPath;

  // Query file using absolute path
  const client = await getClient();
  const result = await client.query(
    `SELECT
      f.id,
      f.file_path,
      f.file_type,
      f.size_bytes,
      f.language
    FROM files f
    WHERE f.repository_id = $1 AND f.file_path = $2`,
    [repo.id, absolutePath]
  );

  if (result.rows.length === 0) {
    throw createNotFoundError(`File '${filePath}' not found in repository '${repository}'`);
  }

  const file = result.rows[0];

  // Return metadata for agent to access file directly
  return {
    path: normalizedPath,
    absolutePath: file.file_path,
    fileType: file.file_type,
    language: file.language,
    size: file.size_bytes,
  };
}

export const getFileInfoTool = {
  name: 'file_info',
  description: 'Get file metadata and absolute path for direct access. Parameters: filePath (required, string - relative path like "src/main.ts" or "README.md"), repository (required, string - name/path/ID). Returns: path (relative), absolutePath (for agent to read), fileType (code/text/binary), language, size (bytes). Agent should use returned absolutePath with its Read tool to access file content.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Relative file path in repository (e.g., "README.md", "src/main.ts")',
      },
      repository: {
        type: 'string',
        description: 'Repository name, path, or ID',
      },
    },
    required: ['filePath', 'repository'],
  },
};
