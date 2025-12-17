import { getRepositoryByPath, getRepository, deleteRepository } from '../../db/index.js';

export async function removeCmd(args: string[]) {
  const target = args[0];
  if (!target) {
    console.error('Usage: craig remove <name|path>');
    return;
  }
  const repo = (await getRepositoryByPath(target)) ?? (await getRepository(target as any));
  if (!repo) {
    console.error('Repository not found:', target);
    return;
  }
  await deleteRepository(repo.id);
  console.log('Repository removed:', repo.name);
}
