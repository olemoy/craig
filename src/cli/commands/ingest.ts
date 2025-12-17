import { resolve } from 'path';
import { existsSync } from 'fs';
import { processDirectory } from '../../processing/index.js';

export async function ingestRepo(args: string[]) {
  const fetchModel = args.includes('--fetch-model');
  const pathArg = args.find((a) => !a.startsWith('-'));
  if (!pathArg) {
    console.error('Usage: craig ingest <path> [--fetch-model]');
    return;
  }
  const fullPath = resolve(process.cwd(), pathArg);
  if (!existsSync(fullPath)) {
    console.error('Path does not exist:', fullPath);
    return;
  }

  if (fetchModel) {
    try {
      const { getPipeline } = await import('../../embeddings/cache.js');
      await getPipeline();
    } catch (e) {
      console.error('Failed to fetch model:', e instanceof Error ? e.message : String(e));
      return;
    }
  }

  console.log('Starting ingest for', fullPath);
  try {
    await processDirectory(fullPath);
    console.log('Ingest command completed (partial stub)');
  } catch (err) {
    console.error('Ingest failed:', err instanceof Error ? err.message : String(err));
  }
}
