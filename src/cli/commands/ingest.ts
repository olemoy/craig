import { resolve } from 'path';
import { existsSync } from 'fs';
import { processDirectory } from '../../processing/index.js';

export async function ingestRepo(args: string[]) {
  const pathArg = args.find((a) => !a.startsWith('-'));
  if (!pathArg) {
    console.error('Usage: craig ingest <path> [--name <name>] [--verbose]');
    return;
  }
  const fullPath = resolve(process.cwd(), pathArg);
  if (!existsSync(fullPath)) {
    console.error('Path does not exist:', fullPath);
    return;
  }

  // Parse optional arguments
  const nameIndex = args.indexOf('--name');
  const repoName = nameIndex !== -1 && args[nameIndex + 1] ? args[nameIndex + 1] : undefined;
  const verbose = args.includes('--verbose') || args.includes('-v');

  // Ensure model pipeline is available (will use local ./models if present, otherwise download into ./models)
  try {
    const { getPipeline } = await import('../../embeddings/cache.js');
    await getPipeline();
  } catch (e) {
    console.error('Failed to initialize embedding model:', e instanceof Error ? e.message : String(e));
    return;
  }

  console.log('Starting ingest for', fullPath);
  try {
    await processDirectory(fullPath, repoName, { verbose });
    console.log('Ingest completed successfully!');
  } catch (err) {
    console.error('Ingest failed:', err instanceof Error ? err.message : String(err));
  }
}
