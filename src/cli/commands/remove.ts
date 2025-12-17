import { getRepositoryByPath, getRepositoryByName, getRepository, deleteRepository } from '../../db/index.js';
import { toRepositoryId } from '../../db/types.js';

export async function removeCmd(args: string[]) {
  const target = args[0];
  if (!target) {
    console.error('Usage: craig remove <name|path|id>');
    return;
  }

  // Try to find repository by name, path, or UUID
  let repo = await getRepositoryByName(target);
  if (!repo) repo = await getRepositoryByPath(target);
  if (!repo) {
    const repoId = toRepositoryId(target);
    if (repoId) {
      repo = await getRepository(repoId);
    }
  }

  if (!repo) {
    console.error('Repository not found:', target);
    return;
  }
  await deleteRepository(repo.id);
  console.log('Repository removed:', repo.name);
}
