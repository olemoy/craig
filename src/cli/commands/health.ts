/**
 * Database health check and repair command
 */

import { healthCheck, repairDatabase, validateRepository } from '../../db/health.js';
import { getRepositoryByPath, getRepositoryByName } from '../../db/repositories.js';

export async function healthCmd(args: string[]) {
  const command = args[0];

  if (command === 'check') {
    await runHealthCheck();
  } else if (command === 'repair') {
    await runRepair();
  } else if (command === 'validate') {
    const target = args[1];
    if (!target) {
      console.error('Usage: health validate <path|name>');
      return;
    }
    await runValidate(target);
  } else {
    console.log('Usage:');
    console.log('  health check          - Run database health check');
    console.log('  health repair         - Attempt to repair database issues');
    console.log('  health validate <repo> - Validate specific repository');
  }
}

async function runHealthCheck() {
  console.log('Running database health check...\n');

  const result = await healthCheck();

  console.log('Database Status:');
  console.log('  Connection:', result.details.canConnect ? '✓' : '✗');
  console.log('  Query:', result.details.canQuery ? '✓' : '✗');
  console.log('');

  console.log('Record Counts:');
  console.log('  Repositories:', result.details.repositoryCount);
  console.log('  Files:', result.details.fileCount);
  console.log('  Chunks:', result.details.chunkCount);
  console.log('  Embeddings:', result.details.embeddingCount);
  console.log('');

  if (result.details.orphanedFiles > 0 ||
      result.details.orphanedChunks > 0 ||
      result.details.orphanedEmbeddings > 0) {
    console.log('Data Integrity Issues:');
    if (result.details.orphanedFiles > 0) {
      console.log('  ⚠️  Orphaned files:', result.details.orphanedFiles);
    }
    if (result.details.orphanedChunks > 0) {
      console.log('  ⚠️  Orphaned chunks:', result.details.orphanedChunks);
    }
    if (result.details.orphanedEmbeddings > 0) {
      console.log('  ⚠️  Orphaned embeddings:', result.details.orphanedEmbeddings);
    }
    console.log('');
    console.log('Run "health repair" to fix these issues.');
    console.log('');
  }

  if (result.issues.length > 0) {
    console.log('Issues Found:');
    result.issues.forEach(issue => console.log('  ✗', issue));
    console.log('');
    console.log('Overall Health: ✗ UNHEALTHY');
  } else {
    console.log('Overall Health: ✓ HEALTHY');
  }
}

async function runRepair() {
  console.log('⚠️  This will modify the database. Make sure you have a backup!\n');

  const fixedCount = await repairDatabase();

  if (fixedCount > 0) {
    console.log(`\n✓ Database repair complete. Fixed ${fixedCount} issues.`);
    console.log('Run "health check" to verify the repairs.');
  } else {
    console.log('\n✓ No issues found to repair.');
  }
}

async function runValidate(target: string) {
  console.log(`Validating repository: ${target}\n`);

  // Try to find repository by path first, then by name
  let repo = await getRepositoryByPath(target);
  if (!repo) {
    repo = await getRepositoryByName(target);
  }

  if (!repo) {
    console.error('Repository not found:', target);
    return;
  }

  console.log(`Found repository: ${repo.name} (${repo.id})\n`);

  const result = await validateRepository(repo.id);

  if (result.valid) {
    console.log('✓ Repository data is valid');
  } else {
    console.log('✗ Repository data has issues:');
    result.issues.forEach(issue => console.log('  •', issue));
    console.log('\nRun "health repair" to fix some of these issues.');
  }
}
