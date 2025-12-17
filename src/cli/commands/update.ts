import { getRepositoryByPath, getRepository } from '../../db/index.js';
import { getRepositoryByName } from '../../db/repositories.js';
import { processDirectory } from '../../processing/index.js';
import { createProgressReporter } from '../progress.js';
import type { RepositoryId } from '../../db/types.js';

export async function updateCmd(args: string[]) {
  const target = args[0];
  if (!target) {
    console.error('Usage: craig update <name|id|path> [--verbose|--quiet]');
    return;
  }

  // Parse optional arguments
  const verbose = args.includes('--verbose') || args.includes('-v');
  const quiet = args.includes('--quiet') || args.includes('-q');

  // Determine progress mode
  const progressMode = verbose ? 'verbose' : quiet ? 'quiet' : 'progress';
  const progress = createProgressReporter(progressMode);

  // Try to find repository by name, path, or ID
  let repo = await getRepositoryByName(target);
  if (!repo) repo = await getRepositoryByPath(target);
  if (!repo && /^\d+$/.test(target)) {
    repo = await getRepository(parseInt(target, 10) as RepositoryId);
  }

  if (!repo) {
    console.error('Repository not found:', target);
    return;
  }

  if (!quiet) console.log('Updating repository:', repo.name);

  try {
    // Re-ingest the repository (will perform delta ingestion)
    await processDirectory(repo.path, repo.name, { verbose, progress });
    if (quiet) console.log('✓ Update completed successfully!');
  } catch (err) {
    console.error('Update failed:', err instanceof Error ? err.message : String(err));
  }
}
