import fs from 'fs';
import path from 'path';
import {FileRecord} from './types';

/**
 * Directories to ignore during file discovery
 */
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'target',
  'coverage',
  '.next',
  '.nuxt',
  'out',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'vendor',
]);

export async function discoverFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.promises.readdir(dir, {withFileTypes: true});
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        // Skip ignored directories
        if (IGNORED_DIRECTORIES.has(ent.name)) continue;
        await walk(full);
      } else if (ent.isFile()) {
        results.push(full);
      }
    }
  }
  await walk(root);
  return results;
}

export async function statFile(filePath: string): Promise<FileRecord> {
  const st = await fs.promises.stat(filePath);
  return {
    path: filePath,
    size: st.size,
    mtimeMs: st.mtimeMs,
    fileType: 'text',
  } as FileRecord;
}
