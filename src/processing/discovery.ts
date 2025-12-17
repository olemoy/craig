import fs from 'fs';
import path from 'path';
import {FileRecord} from './types';

export async function discoverFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.promises.readdir(dir, {withFileTypes: true});
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === '.git') continue;
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
