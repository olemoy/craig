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

function help() {
  console.log('craig <command> [options]\n');
  console.log('Commands:');
  console.log('  ingest <path> --name <name>   Ingest a repository');
  console.log('  list [--format json|table]    List known repositories');
  console.log('  query <question> --repo <name> Query a repository (stub)');
  console.log('  db <action>                   Database management (status|vacuum|export|import)');
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