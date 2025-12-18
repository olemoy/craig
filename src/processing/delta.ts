/**
 * Delta ingestion - only process changed files
 */

import fs from 'fs';
import path from 'path';
import { getClient } from '../db/client.js';
import { getFilesByRepository, deleteFile } from '../db/files.js';
import { deleteChunksByFile } from '../db/chunks.js';
import type { Repository, RepositoryId, File } from '../db/types.js';
import { sha256Hex } from './hasher.js';
import { readTextFile } from './text-processor.js';

export interface DeltaStats {
  unchanged: number;
  modified: number;
  added: number;
  deleted: number;
}

/**
 * Analyze which files need processing for resume mode
 * In resume mode, skip files that already have embeddings (fully processed)
 * Also skips binary files since they don't need embeddings
 */
export async function analyzeResume(
  repo: Repository,
  discoveredFiles: string[]
): Promise<{
  toProcess: string[];
  alreadyProcessed: string[];
}> {
  const client = await getClient();

  // Get all files that are fully processed:
  // 1. Files with embeddings (text/code files that have been chunked and embedded)
  // 2. Binary files (they don't need embeddings, just a file record)
  const result = await client.query(
    `SELECT DISTINCT f.file_path
     FROM files f
     WHERE f.repository_id = $1
     AND (
       -- Has embeddings (text/code files)
       EXISTS (
         SELECT 1 FROM chunks c
         INNER JOIN embeddings e ON e.chunk_id = c.id
         WHERE c.file_id = f.id
       )
       -- OR is a binary file (doesn't need embeddings)
       OR f.file_type = 'binary'
     )`,
    [repo.id]
  );

  const processedFiles = new Set(result.rows.map((row: any) => row.file_path));
  const toProcess: string[] = [];
  const alreadyProcessed: string[] = [];

  for (const filePath of discoveredFiles) {
    if (processedFiles.has(filePath)) {
      alreadyProcessed.push(filePath);
    } else {
      toProcess.push(filePath);
    }
  }

  return { toProcess, alreadyProcessed };
}

/**
 * Compare discovered files with database and determine what needs processing
 */
export async function analyzeDelta(
  repo: Repository,
  discoveredFiles: string[]
): Promise<{
  toAdd: string[];
  toUpdate: string[];
  toDelete: File[];
  unchanged: string[];
}> {
  // Get all files currently in database for this repository
  const dbFiles = await getFilesByRepository(repo.id);
  const dbFileMap = new Map(dbFiles.map(f => [f.file_path, f]));
  const discoveredSet = new Set(discoveredFiles);

  const toAdd: string[] = [];
  const toUpdate: string[] = [];
  const unchanged: string[] = [];

  // Check each discovered file
  for (const filePath of discoveredFiles) {
    const dbFile = dbFileMap.get(filePath);

    if (!dbFile) {
      // New file
      toAdd.push(filePath);
    } else {
      // File exists - check if modified
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(repo.path, filePath);
      const stat = await fs.promises.stat(absolutePath);

      // Fast path: if size changed, definitely modified
      if (stat.size !== dbFile.size_bytes) {
        toUpdate.push(filePath);
      } else {
        // Size is same - hash content to be sure (handles text changes with same byte count)
        let currentHash: string;

        if (dbFile.file_type === 'text' || dbFile.file_type === 'code') {
          // For text/code files, normalize text before hashing (same as during ingestion)
          const txt = await readTextFile(absolutePath);
          currentHash = sha256Hex(txt);
        } else {
          // For binary files, hash raw buffer as binary string
          const fileContent = await fs.promises.readFile(absolutePath);
          currentHash = sha256Hex(fileContent.toString('binary'));
        }

        if (currentHash !== dbFile.content_hash) {
          // Content has actually changed
          toUpdate.push(filePath);
        } else {
          // Content unchanged
          unchanged.push(filePath);
        }
      }
    }
  }

  // Find files to delete (in DB but not discovered)
  const toDelete = dbFiles.filter(f => !discoveredSet.has(f.file_path));

  return { toAdd, toUpdate, toDelete, unchanged };
}

/**
 * Delete file and all associated chunks/embeddings
 */
export async function deleteFileAndChunks(fileId: number): Promise<void> {
  // Delete chunks (which cascades to embeddings)
  await deleteChunksByFile(fileId as any);
  // Delete file
  await deleteFile(fileId as any);
}

/**
 * Update an existing file by deleting old data and re-processing
 */
export async function updateFile(fileId: number): Promise<void> {
  // Delete chunks and embeddings
  await deleteChunksByFile(fileId as any);
  // File record itself will be updated during processing
}
