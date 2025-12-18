/**
 * MCP-related type definitions
 */

import type { RepositoryId } from '../db/types.js';

export interface SearchResult {
  repository: string;
  filePath: string;
  fileType: 'code' | 'text' | 'binary';
  language: string | null;
  content: string;
  similarity: number;
}

export interface FileInfoResult {
  path: string;
  absolutePath: string;
  fileType: 'code' | 'text' | 'binary';
  language: string | null;
  size: number;
}

export interface RepositoryStats {
  repository: string;
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
  filePath: string;
  fileType: 'code' | 'text' | 'binary';
  language: string | null;
  content: string;
  similarity: number;
}

export interface RepositoryInfo {
  id: string;
  name: string;
  fileCount: number;
}
