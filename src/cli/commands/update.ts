import { getRepositoryByPath, updateRepository, getRepository } from '../../db/index.js';

export async function updateCmd(args: string[]) {
  const target = args[0];
  if (!target) {
    console.error('Usage: craig update <name|path>');
    return;
  }
  // Try to find by path first
  const repo = (await getRepositoryByPath(target)) ?? (await getRepository(target as any));
  if (!repo) {
    console.error('Repository not found:', target);
    return;
  }
  console.log('Updating repository', repo.name);
  // Stub: bump ingested_at
  await updateRepository({ id: repo.id, metadata: { updated_by: 'cli' } });
  console.log('Update completed (stub)');
}
