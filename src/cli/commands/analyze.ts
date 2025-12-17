import { analyzeCodebase } from '../../mcp/tools/analyze.js';
import { getRepository, updateRepository } from '../../db/repositories.js';

export async function analyzeCmd(args: string[]) {
  const repoArg = args.find((a) => !a.startsWith('-'));
  if (!repoArg) {
    console.error('Usage: craig analyze <name|path|id>');
    return;
  }

  try {
    const stats = await analyzeCodebase({ repository: repoArg });

    // Fetch existing repository to preserve metadata
    const repo = await getRepository(stats.repositoryId);
    const existingMetadata = repo?.metadata ?? {};

    // Store analysis under metadata.analysis (overwrites previous)
    const newMetadata = { ...existingMetadata, analysis: stats, last_analyzed_at: new Date().toISOString() };

    await updateRepository({ id: stats.repositoryId, metadata: newMetadata });

    console.log('Analysis stored for repository', stats.repository, 'id', stats.repositoryId);
    console.log(JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error('Analyze failed:', err instanceof Error ? err.message : String(err));
  }
}
