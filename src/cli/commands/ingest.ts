import { resolve } from 'path';
import { existsSync } from 'fs';
import { processDirectory } from '../../processing/index.js';
import { createProgressReporter } from '../progress.js';
import { getEmbeddingProvider } from '../../config/index.js';
import { checkOllamaAvailability } from '../../embeddings/ollama.js';
import type { OllamaConfig } from '../../config/index.js';

export async function ingestRepo(args: string[]) {
  const pathArg = args.find((a) => !a.startsWith('-'));
  if (!pathArg) {
    console.error('Usage: craig ingest <path> [--name <name>] [--resume] [--verbose|--quiet]');
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
  const resume = args.includes('--resume');

  // Determine progress mode
  const progressMode = verbose ? 'verbose' : quiet ? 'quiet' : 'progress';
  const progress = createProgressReporter(progressMode);

  // Initialize embedding provider based on config
  try {
    const provider = getEmbeddingProvider();

    if (provider.provider === 'ollama') {
      if (!quiet) console.log(`Using Ollama for embeddings (${provider.config.model})...`);

      // Check Ollama availability
      const availability = await checkOllamaAvailability(provider.config as OllamaConfig);
      if (!availability.available) {
        console.error('Ollama is not available:', availability.error);
        console.error('\nMake sure Ollama is running and the model is installed:');
        console.error(`  ollama pull ${(provider.config as OllamaConfig).model}`);
        return;
      }

      if (!quiet) console.log('✓ Ollama ready\n');
    } else {
      // Transformers.js - ensure model pipeline is available
      const { getPipeline } = await import('../../embeddings/cache.js');
      if (!quiet) console.log('Using Transformers.js for embeddings...');
      await getPipeline();
      if (!quiet) console.log('✓ Model ready\n');
    }
  } catch (e) {
    console.error('Failed to initialize embedding provider:', e instanceof Error ? e.message : String(e));
    return;
  }

  if (!quiet) {
    if (resume) {
      console.log('Resuming ingest for', fullPath);
    } else {
      console.log('Starting ingest for', fullPath);
    }
  }
  try {
    await processDirectory(fullPath, repoName, { verbose, progress, resume });
    if (quiet) console.log('✓ Ingest completed successfully!');
  } catch (err) {
    console.error('Ingest failed:', err instanceof Error ? err.message : String(err));
  }
}
