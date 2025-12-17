#!/usr/bin/env node
import { argv, exit } from 'process';
import { ingestRepo } from './commands/ingest.js';
import { listRepos } from './commands/list.js';
import { queryRepo } from './commands/query.js';
import { dbCommand } from './commands/db.js';
import { updateCmd } from './commands/update.js';
import { removeCmd } from './commands/remove.js';
import { statsCmd } from './commands/stats.js';
import { modelCmd } from './commands/model.js';
import { filesCmd } from './commands/files.js';
import { analyzeCmd } from './commands/analyze.js';
import { configCmd } from './commands/config.js';

function help() {
  console.log('craig <command> [options]\n');
  console.log('Commands:');
  console.log('  ingest <path> --name <name>           Ingest a repository');
  console.log('         [--verbose|-v] [--quiet|-q]      Progress display options');
  console.log('  analyze <name|id>                     Analyze a repository and store results');
  console.log('  list [--format json|table]            List known repositories');
  console.log('  query <question> --repo <name|id>     Semantic search in repository');
  console.log('        [--limit <n>]                     (default limit: 5)');
  console.log('  files <name|id> [--tree]              List files in repository');
  console.log('  stats <name|id>                       Repository statistics');
  console.log('  update <name|id|path>                 Re-ingest repository (delta update)');
  console.log('         [--verbose|-v] [--quiet|-q]      Progress display options');
  console.log('  remove <name|id>                      Remove repository');
  console.log('  model <action>                        Model management (fetch)');
  console.log('  config [show|test]                    Show or test embedding configuration');
  console.log('  db <action>                           Database management (status|vacuum|export|import)');
  console.log('\nProgress Options:');
  console.log('  (default)  Fixed progress bar with real-time stats');
  console.log('  --verbose  Detailed logs for each file');
  console.log('  --quiet    Minimal output, summary only');
  console.log('\nNote: Most commands accept repository name, full path, or numeric ID');
}

async function main() {
  const args = argv.slice(2);
  const cmd = args[0];
  try {
    if (!cmd || cmd === '-h' || cmd === '--help') {
      help();
      exit(0);
    }
    if (cmd === 'ingest') {
      await ingestRepo(args.slice(1));
      return;
    }
    if (cmd === 'analyze') {
      await analyzeCmd(args.slice(1));
      return;
    }
    if (cmd === 'list') {
      await listRepos(args.slice(1));
      return;
    }
    if (cmd === 'query') {
      await queryRepo(args.slice(1));
      return;
    }
    if (cmd === 'model') {
      await modelCmd(args.slice(1));
      return;
    }
    if (cmd === 'update') {
      await updateCmd(args.slice(1));
      return;
    }
    if (cmd === 'remove') {
      await removeCmd(args.slice(1));
      return;
    }
    if (cmd === 'stats') {
      await statsCmd(args.slice(1));
      return;
    }
    if (cmd === 'files') {
      await filesCmd(args.slice(1));
      return;
    }
    if (cmd === 'config') {
      await configCmd(args.slice(1));
      return;
    }
    if (cmd === 'db') {
      await dbCommand(args.slice(1));
      return;
    }
    console.error('Unknown command:', cmd);
    help();
    exit(2);
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    exit(1);
  }
}

main();