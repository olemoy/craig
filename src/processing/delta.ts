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

export interface DeltaStats {
  unchanged: number;
  modified: number;
  added: number;
  deleted: number;
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
      const stat = await fs.promises.stat(filePath);
      const lastModified = dbFile.last_modified;

      // Compare timestamps at second precision (to avoid filesystem/db precision differences)
      const fileModTime = Math.floor(stat.mtime.getTime() / 1000);
      const dbModTime = lastModified ? Math.floor(new Date(lastModified).getTime() / 1000) : 0;

      if (!lastModified || fileModTime > dbModTime) {
        // File modified since last ingestion
        toUpdate.push(filePath);
      } else if (stat.size !== dbFile.size_bytes) {
        // Size changed
        toUpdate.push(filePath);
      } else {
        // Unchanged
        unchanged.push(filePath);
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
