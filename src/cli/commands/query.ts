export async function queryRepo(args: string[]) {
  if (!args.length) {
    console.error('Usage: craig query <question> --repo <name>');
    return;
  }
  const question = args[0];
  const repoIndex = args.indexOf('--repo');
  const repo = repoIndex !== -1 ? args[repoIndex + 1] : undefined;
  console.log('Querying', repo ?? 'default', 'for:', question);
  console.log('Query command is a stub and will be implemented by WP4');
}
