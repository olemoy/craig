import { resolve } from 'path';
import { existsSync } from 'fs';
import { processDirectory } from '../../processing/index.js';

export async function ingestRepo(args: string[]) {
  const pathArg = args[0];
  if (!pathArg) {
    console.error('Usage: craig ingest <path> --name <name>');
    return;
  }
  const fullPath = resolve(process.cwd(), pathArg);
  if (!existsSync(fullPath)) {
    console.error('Path does not exist:', fullPath);
    return;
  }
  console.log('Starting ingest for', fullPath);
  try {
    await processDirectory(fullPath);
    console.log('Ingest command completed (partial stub)');
  } catch (err) {
    console.error('Ingest failed:', err instanceof Error ? err.message : String(err));
  }
}
