/**
 * MCP-related type definitions
 */

import type { RepositoryId } from '../db/types.js';

export interface SearchResult {
  repository: string;
  repositoryId: RepositoryId;
  filePath: string;
  fileType: 'code' | 'text' | 'binary';
  language: string | null;
  content: string;
  similarity: number;
  chunkIndex: number;
  metadata?: {
    startChar?: number;
    endChar?: number;
    startToken?: number;
    endToken?: number;
  };
}

export interface FileContextResult {
  repository: string;
  repositoryId: RepositoryId;
  filePath: string;
  fileType: 'code' | 'text' | 'binary';
  language: string | null;
  content: string | null;
  size: number;
  lastModified: Date | null;
  binaryMetadata?: {
    size: number;
    hash: string;
  };
}

export interface RepositoryStats {
  repository: string;
  repositoryId: RepositoryId;
  path: string;
  ingestedAt: Date;
  totalFiles: number;
  codeFiles: number;
  textFiles: number;
  binaryFiles: number;
  totalChunks: number;
  totalEmbeddings: number;
  languages: Record<string, number>;
}

export interface SimilarCodeResult {
  repository: string;
  repositoryId: RepositoryId;
  filePath: string;
  fileType: 'code' | 'text' | 'binary';
  language: string | null;
  content: string;
  similarity: number;
}

export interface RepositoryInfo {
  id: RepositoryId;
  name: string;
  path: string;
  commitSha: string | null;
  ingestedAt: Date;
  fileCount?: number;
}
