/**
 * Database schema and migration management
 *
 * Provides migration tracking and execution functionality.
 * Migrations are SQL files numbered sequentially (000_, 001_, 002_, etc.)
 */

import { PGlite } from '@electric-sql/pglite';
import { DatabaseError, DatabaseErrorCode } from './types.js';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory path of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Migration file metadata
 */
interface Migration {
  version: number;
  filename: string;
  description: string;
  sql: string;
}

/**
 * Get current schema version from database
 *
 * @param client - PGlite client instance
 * @returns Current schema version (0 if no migrations applied)
 */
export async function getCurrentSchemaVersion(
  client: PGlite
): Promise<number> {
  try {
    const result = await client.query(
      'SELECT MAX(version) as version FROM schema_version'
    );

    const version = result.rows[0]?.version;
    return version !== null && version !== undefined ? parseInt(String(version), 10) : 0;
  } catch (error) {
    // Table might not exist yet
    return 0;
  }
}

/**
 * Get all migration files from the migrations directory
 *
 * @returns Array of migration metadata sorted by version
 */
async function getMigrations(): Promise<Migration[]> {
  try {
    const files = await readdir(MIGRATIONS_DIR);

    // Filter for SQL files and parse their metadata
    const migrations: Migration[] = [];

    for (const filename of files) {
      if (!filename.endsWith('.sql')) {
        continue;
      }

      // Parse filename: 000_migration_tracker.sql -> version=0, description=migration_tracker
      const match = filename.match(/^(\d{3})_(.+)\.sql$/);
      if (!match) {
        console.warn(`Skipping invalid migration filename: ${filename}`);
        continue;
      }

      const version = parseInt(match[1], 10);
      const description = match[2].replace(/_/g, ' ');

      // Read the SQL file
      const filepath = join(MIGRATIONS_DIR, filename);
      const file = Bun.file(filepath);
      const sql = await file.text();

      migrations.push({
        version,
        filename,
        description,
        sql,
      });
    }

    // Sort by version number
    return migrations.sort((a, b) => a.version - b.version);
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.MIGRATION_FAILED,
      `Failed to read migrations directory: ${MIGRATIONS_DIR}`,
      error
    );
  }
}

/**
 * Apply a single migration to the database
 *
 * @param client - PGlite client instance
 * @param migration - Migration to apply
 */
async function applyMigration(
  client: PGlite,
  migration: Migration
): Promise<void> {
  try {
    // Execute migration SQL
    await client.exec(migration.sql);

    // Record migration in schema_version table (unless it's migration 000 which creates the table)
    if (migration.version > 0) {
      await client.query(
        `INSERT INTO schema_version (version, description)
         VALUES ($1, $2)
         ON CONFLICT (version) DO NOTHING`,
        [migration.version, migration.description]
      );
    }
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.MIGRATION_FAILED,
      `Failed to apply migration ${migration.version}: ${migration.description}`,
      error
    );
  }
}

/**
 * Run all pending migrations
 *
 * This function:
 * 1. Ensures schema_version table exists (migration 000)
 * 2. Checks current schema version
 * 3. Applies all pending migrations in order
 * 4. Updates schema_version after each successful migration
 *
 * Migrations are idempotent - safe to run multiple times
 *
 * @param client - PGlite client instance
 * @throws DatabaseError if any migration fails
 */
export async function runMigrations(client: PGlite): Promise<void> {
  try {
    // Get all available migrations
    const migrations = await getMigrations();

    if (migrations.length === 0) {
      console.warn('No migrations found in', MIGRATIONS_DIR);
      return;
    }

    // First, ensure migration 000 (schema_version table) is applied
    const migration000 = migrations.find((m) => m.version === 0);
    if (migration000) {
      await client.exec(migration000.sql);
    }

    // Get current schema version
    const currentVersion = await getCurrentSchemaVersion(client);

    // Apply pending migrations
    const pendingMigrations = migrations.filter(
      (m) => m.version > currentVersion
    );

    if (pendingMigrations.length === 0) {
      return; // All migrations already applied
    }

    console.log(
      `Applying ${pendingMigrations.length} pending migration(s)...`
    );

    for (const migration of pendingMigrations) {
      console.log(
        `  Applying migration ${migration.version}: ${migration.description}`
      );
      await applyMigration(client, migration);
    }

    console.log('All migrations applied successfully');
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(
      DatabaseErrorCode.MIGRATION_FAILED,
      'Migration process failed',
      error
    );
  }
}

/**
 * Get migration history from database
 *
 * @param client - PGlite client instance
 * @returns Array of applied migrations with timestamps
 */
export async function getMigrationHistory(
  client: PGlite
): Promise<Array<{ version: number; description: string; applied_at: Date }>> {
  try {
    const result = await client.query(
      'SELECT version, description, applied_at FROM schema_version ORDER BY version'
    );

    return result.rows.map((row) => ({
      version: parseInt(String(row.version), 10),
      description: String(row.description),
      applied_at: new Date(String(row.applied_at)),
    }));
  } catch (error) {
    // Table might not exist yet
    return [];
  }
}
