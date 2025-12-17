/**
 * Database client module
 *
 * Provides PGlite database initialization and connection management
 * using a singleton pattern. Supports both persistent and in-memory databases.
 */

import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { runMigrations, getCurrentSchemaVersion } from './schema.js';
import {
  ClientOptions,
  DatabaseError,
  DatabaseErrorCode,
  HealthCheckResult,
} from './types.js';

/**
 * Singleton database client instance
 */
let clientInstance: PGlite | null = null;

/**
 * Get the singleton database client instance
 * If not initialized, creates a new instance with default options
 *
 * @returns Promise resolving to the PGlite client instance
 * @throws DatabaseError if connection fails
 */
export async function getClient(): Promise<PGlite> {
  if (!clientInstance) {
    clientInstance = await initializeClient();
  }
  return clientInstance;
}

/**
 * Initialize the database client with custom options
 * Loads pgvector extension and optionally runs migrations
 *
 * @param options - Client configuration options
 * @returns Promise resolving to the initialized PGlite client
 * @throws DatabaseError if initialization fails
 */
export async function initializeClient(
  options: ClientOptions = {}
): Promise<PGlite> {
  try {
    const {
      dataDir = process.env.CRAIG_DB_PATH ?? './data/craig.db',
      autoMigrate = true,
    } = options;

    // Create PGlite instance with vector extension
    const client = new PGlite(dataDir, {
      extensions: { vector },
    });

    // Load pgvector extension
    await client.exec('CREATE EXTENSION IF NOT EXISTS vector;');

    // Run migrations if auto-migrate is enabled
    if (autoMigrate) {
      await runMigrations(client);
    }

    // Store as singleton instance
    clientInstance = client;

    return client;
  } catch (error) {
    throw new DatabaseError(
      DatabaseErrorCode.CONNECTION_FAILED,
      'Failed to initialize database client',
      error
    );
  }
}

/**
 * Close the database client and clean up resources
 * Resets the singleton instance
 *
 * @throws DatabaseError if closing fails
 */
export async function closeClient(): Promise<void> {
  if (clientInstance) {
    try {
      await clientInstance.close();
      clientInstance = null;
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorCode.CONNECTION_FAILED,
        'Failed to close database client',
        error
      );
    }
  }
}

/**
 * Reset the client instance without closing
 * Used primarily for testing to allow fresh initialization
 */
export function resetClient(): void {
  clientInstance = null;
}

/**
 * Check database health and readiness
 *
 * Verifies:
 * - Database connection
 * - pgvector extension loaded
 * - Current schema version
 * - Table count
 *
 * @returns Health check result with status and details
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  try {
    const client = await getClient();

    // Check basic connection
    await client.query('SELECT 1');

    // Check pgvector extension
    const vectorCheck = await client.query(
      "SELECT * FROM pg_extension WHERE extname = 'vector'"
    );

    // Get schema version
    let schemaVersion = 0;
    try {
      schemaVersion = await getCurrentSchemaVersion(client);
    } catch {
      // Schema version table might not exist yet
      schemaVersion = 0;
    }

    // Count tables
    const tablesResult = await client.query(
      `SELECT count(*) FROM information_schema.tables
       WHERE table_schema = 'public'`
    );

    const tableCount = parseInt(tablesResult.rows[0]?.count ?? '0', 10);

    return {
      healthy: true,
      details: {
        connected: true,
        vectorExtension: vectorCheck.rows.length > 0,
        schemaVersion,
        tableCount,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      details: {
        connected: false,
        vectorExtension: false,
        schemaVersion: 0,
        tableCount: 0,
      },
    };
  }
}
