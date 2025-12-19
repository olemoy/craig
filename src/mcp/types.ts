/**
 * MCP-related type definitions
 */

import type { RepositoryId } from '../db/types.js';

export interface SearchResult {
  repository: string;
  filePath: string;
  fileType: 'code' | 'text' | 'binary';
  language: string | null; // File extension for code files (e.g., '.py', '.sql')
  content: string;
  similarity: number;
}

export interface FileInfoResult {
  path: string;
  fileType: 'code' | 'text' | 'binary';
  language: string | null; // File extension for code files (e.g., '.py', '.sql')
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
  extensions: Record<string, number>; // File extension distribution (e.g., {'.py': 10, '.sql': 5})
}

export interface SimilarCodeResult {
  repository: string;
  filePath: string;
  fileType: 'code' | 'text' | 'binary';
  language: string | null; // File extension for code files (e.g., '.py', '.sql')
  content: string;
  similarity: number;
}

export interface RepositoryInfo {
  id: string;
  name: string;
  fileCount: number;
}
