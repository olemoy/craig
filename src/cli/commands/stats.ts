import { getRepositoryByPath, getRepository } from '../../db/index.js';
import { getFilesByRepository, getChunksByFile } from '../../db/index.js';

export async function statsCmd(args: string[]) {
  const target = args[0];
  if (!target) {
    console.error('Usage: craig stats <name|path>');
    return;
  }
  const repo = (await getRepositoryByPath(target)) ?? (await getRepository(target as any));
  if (!repo) {
    console.error('Repository not found:', target);
    return;
  }
  const files = await getFilesByRepository(repo.id);
  let chunkCount = 0;
  for (const f of files) {
    const chunks = await getChunksByFile(f.id);
    chunkCount += chunks.length;
  }
  console.log(`Repository: ${repo.name}`);
  console.log(`Files: ${files.length}`);
  console.log(`Chunks: ${chunkCount}`);
}
