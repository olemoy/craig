import { query } from '../../mcp/tools/query.js';
import { getRepositoryByName, getRepositoryByPath, getRepository } from '../../db/repositories.js';
import type { RepositoryId } from '../../db/types.js';
import { toRepositoryId } from '../../db/types.js';

export async function queryRepo(args: string[]) {
  if (!args.length) {
    console.error('Usage: craig query <question> --repo <name|id> [--limit <n>]');
    return;
  }

  const question = args[0];
  const repoIndex = args.indexOf('--repo');
  const repoParam = repoIndex !== -1 ? args[repoIndex + 1] : undefined;
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 && args[limitIndex + 1] ? parseInt(args[limitIndex + 1], 10) : 5;

  if (!repoParam) {
    console.error('--repo parameter is required');
    console.error('Usage: craig query <question> --repo <name|id> [--limit <n>]');
    return;
  }

  // Look up repository by name, path, or UUID
  let repo = await getRepositoryByName(repoParam);
  if (!repo) repo = await getRepositoryByPath(repoParam);
  if (!repo) {
    const repoId = toRepositoryId(repoParam);
    if (repoId) {
      repo = await getRepository(repoId);
    }
  }

  if (!repo) {
    console.error(`Repository '${repoParam}' not found.`);
    console.error('Use "bun cli list" to see available repositories.');
    return;
  }

  console.log(`\nQuerying "${repo.name}" (id: ${repo.id}) for: "${question}"\n`);

  try {
    // Ensure embedding model is ready
    const { getPipeline } = await import('../../embeddings/cache.js');
    await getPipeline();

    // Perform semantic search using repository name
    const results = await query({
      query: question,
      repository: repo.name,
      limit,
    });

    if (results.length === 0) {
      console.log('No results found.');
      return;
    }

    console.log(`Found ${results.length} relevant code chunks:\n`);
    console.log('='.repeat(80));

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const similarity = (result.similarity * 100).toFixed(1);

      console.log(`\n[${i + 1}] ${result.filePath}`);
      console.log(`    Similarity: ${similarity}% | Type: ${result.fileType} | Language: ${result.language || 'unknown'}`);
      console.log(`    Chunk ${result.chunkIndex + 1}`);
      console.log('-'.repeat(80));

      if (result.fileType === 'binary') {
        console.log('    (Binary file - metadata only)');
      } else {
        // Show first 10 lines of the chunk
        const lines = result.content.split('\n').slice(0, 10);
        lines.forEach(line => {
          console.log(`    ${line}`);
        });
        if (result.content.split('\n').length > 10) {
          console.log(`    ... (${result.content.split('\n').length - 10} more lines)`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\nTip: Use --limit <n> to see more results (default: 5)`);
    console.log(`Example: bun cli query "${question}" --repo ${repo.name} --limit 10\n`);
  } catch (err) {
    console.error('Query failed:', err instanceof Error ? err.message : String(err));
  }
}
