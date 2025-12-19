/**
 * file_info tool implementation
 * Retrieves file metadata (type, language, size) without file path access
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

  interface FileMetadataRow {
    id: number;
    file_path: string;
    file_type: 'code' | 'text' | 'binary';
    size_bytes: number;
    language: string | null;
  }

  if (result.rows.length === 0) {
    throw createNotFoundError(`File '${filePath}' not found in repository '${repository}'`);
  }

  const file = result.rows[0] as FileMetadataRow;

  // Return metadata only - agents must use read tool for content
  return {
    path: normalizedPath,
    fileType: file.file_type,
    language: file.language,
    size: file.size_bytes,
  };
}

export const getFileInfoTool = {
  name: 'file_info',
  description: 'Get file metadata (type, language, size). Parameters: filePath (required, string - relative path like "src/main.ts" or "README.md"), repository (required, string - name/path/ID). Returns: path (relative), fileType (code/text/binary), language, size (bytes). To read file content, use the "read" tool instead.',
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
