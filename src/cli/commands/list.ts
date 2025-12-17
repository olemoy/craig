import { listRepositories } from '../../db/repositories.js';

export async function listRepos(args: string[]) {
  const formatIndex = args.indexOf('--format');
  let format = 'table';
  if (formatIndex !== -1 && args[formatIndex + 1]) format = args[formatIndex + 1];
  try {
    const repos = await listRepositories();
    if (format === 'json') {
      console.log(JSON.stringify(repos, null, 2));
      return;
    }
    console.log('Known repositories:');
    for (const r of repos) {
      console.log(`- ${r.name} (${r.path})`);
    }
  } catch (err) {
    console.error('List failed:', err instanceof Error ? err.message : String(err));
  }
}
