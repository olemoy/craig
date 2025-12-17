import { resolve } from 'path';
import { existsSync } from 'fs';
import { processDirectory } from '../../processing/index.js';
import { createProgressReporter } from '../progress.js';

export async function ingestRepo(args: string[]) {
  const pathArg = args.find((a) => !a.startsWith('-'));
  if (!pathArg) {
    console.error('Usage: craig ingest <path> [--name <name>] [--verbose|--quiet]');
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
  const quiet = args.includes('--quiet') || args.includes('-q');

  // Determine progress mode
  const progressMode = verbose ? 'verbose' : quiet ? 'quiet' : 'progress';
  const progress = createProgressReporter(progressMode);

  // Ensure model pipeline is available (will use local ./models if present, otherwise download into ./models)
  try {
    const { getPipeline } = await import('../../embeddings/cache.js');
    if (!quiet) console.log('Initializing embedding model...');
    await getPipeline();
    if (!quiet) console.log('✓ Model ready\n');
  } catch (e) {
    console.error('Failed to initialize embedding model:', e instanceof Error ? e.message : String(e));
    return;
  }

  if (!quiet) console.log('Starting ingest for', fullPath);
  try {
    await processDirectory(fullPath, repoName, { verbose, progress });
    if (quiet) console.log('✓ Ingest completed successfully!');
  } catch (err) {
    console.error('Ingest failed:', err instanceof Error ? err.message : String(err));
  }
}
