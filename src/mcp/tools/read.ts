/**
 * read_file tool implementation
 * Returns complete file content through MCP
 */

import { readFile as fsReadFile } from 'fs/promises';
import { getClient } from '../../db/client.js';
import { getRepositoryByPath, getRepositoryByName, getRepository } from '../../db/repositories.js';
import { toRepositoryId } from '../../db/types.js';
import { createInvalidParamsError, createNotFoundError } from '../errors.js';

export interface ReadFileArgs {
  filePath: string;
  repository: string;
}

export interface ReadFileResult {
  repository: string;
  filePath: string;
  content: string;
  fileType: 'code' | 'text' | 'binary';
  language: string | null;
  size: number;
}

export async function readFile(args: ReadFileArgs): Promise<ReadFileResult> {
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

  // Query file metadata
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

  interface FileInfoRow {
    id: number;
    file_path: string;
    file_type: 'code' | 'text' | 'binary';
    size_bytes: number;
    language: string | null;
  }

  if (result.rows.length === 0) {
    throw createNotFoundError(`File '${filePath}' not found in repository '${repository}'`);
  }

  const file = result.rows[0] as FileInfoRow;

  // Read file content from disk
  let content: string;
  try {
    if (file.file_type === 'binary') {
      content = '(Binary file - content not available as text)';
    } else {
      const buffer = await fsReadFile(file.file_path);
      content = buffer.toString('utf-8');
    }
  } catch (error) {
    throw createNotFoundError(`Failed to read file '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    repository: repo.name,
    filePath: normalizedPath,
    content,
    fileType: file.file_type,
    language: file.language,
    size: file.size_bytes,
  };
}

export const readFileTool = {
  name: 'read',
  description: 'Read complete file content through MCP. Parameters: filePath (required, string - relative path like "src/main.ts" or "README.md"), repository (required, string - name/path/ID). Returns: repository, filePath, content (full text for code/text files, placeholder for binary), fileType, language, size. Use this to access file content instead of direct file system access.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Relative file path in repository (e.g., "src/main.ts", "README.md")',
      },
      repository: {
        type: 'string',
        description: 'Repository name, path, or ID',
      },
    },
    required: ['filePath', 'repository'],
  },
};
