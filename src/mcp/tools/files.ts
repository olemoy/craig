/**
 * list_files tool implementation
 * Lists all files in a repository
 */

import { getClient } from '../../db/client.js';
import { getRepositoryByName, getRepositoryByPath, getRepository } from '../../db/repositories.js';
import type { RepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface ListFilesArgs {
  repository: string;
}

export interface FileInfo {
  filePath: string;
  relativePath: string;
  fileType: 'code' | 'text' | 'binary';
  language: string | null;
  sizeBytes: number;
}

export interface ListFilesResult {
  repository: string;
  repositoryId: number;
  repositoryPath: string;
  fileCount: number;
  files: FileInfo[];
}

export async function listFiles(args: ListFilesArgs): Promise<ListFilesResult> {
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

  // Get all files
  const client = await getClient();
  const result = await client.query(
    `SELECT file_path, file_type, language, size_bytes
     FROM files
     WHERE repository_id = $1
     ORDER BY file_path`,
    [repo.id]
  );

  const repoPath = repo.path.endsWith('/') ? repo.path : repo.path + '/';

  const files: FileInfo[] = result.rows.map((row: any) => ({
    filePath: row.file_path,
    relativePath: row.file_path.replace(repoPath, ''),
    fileType: row.file_type,
    language: row.language,
    sizeBytes: parseInt(row.size_bytes, 10),
  }));

  return {
    repository: repo.name,
    repositoryId: repo.id,
    repositoryPath: repo.path,
    fileCount: files.length,
    files,
  };
}

export const listFilesTool = {
  name: 'list_files',
  description: 'List all files in a repository with metadata (type, language, size). Useful for understanding repository structure and file organization.',
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
