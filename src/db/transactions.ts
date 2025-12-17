/**
 * Transaction utilities
 *
 * Provides a callback-based transaction API with automatic rollback on error.
 * Ensures that database operations are atomic and consistent.
 */

import { PGlite } from '@electric-sql/pglite';
import { getClient } from './client.js';
import { DatabaseError, DatabaseErrorCode } from './types.js';

/**
 * Execute a function within a database transaction
 *
 * The transaction is automatically committed if the callback succeeds,
 * or rolled back if it throws an error.
 *
 * Example usage:
 * ```typescript
 * const result = await withTransaction(async (client) => {
 *   await insertRepository(client, repo);
 *   await insertFiles(client, files);
 *   return { success: true };
 * });
 * ```
 *
 * @param callback - Function to execute within the transaction
 * @returns The value returned by the callback
 * @throws DatabaseError if transaction fails
 */
export async function withTransaction<T>(
  callback: (client: PGlite) => Promise<T>
): Promise<T> {
  const client = await getClient();

  try {
    // Begin transaction
    await client.exec('BEGIN');

    // Execute callback
    const result = await callback(client);

    // Commit transaction
    await client.exec('COMMIT');

    return result;
  } catch (error) {
    // Rollback on error
    try {
      await client.exec('ROLLBACK');
    } catch (rollbackError) {
      // Log rollback error but throw original error
      console.error('Failed to rollback transaction:', rollbackError);
    }

    // Wrap error in DatabaseError if it isn't already
    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(
      DatabaseErrorCode.TRANSACTION_FAILED,
      'Transaction failed and was rolled back',
      error
    );
  }
}

/**
 * Execute a function within a transaction with explicit client parameter
 *
 * This variant allows passing a specific client instance, useful for testing.
 *
 * @param client - PGlite client instance to use
 * @param callback - Function to execute within the transaction
 * @returns The value returned by the callback
 * @throws DatabaseError if transaction fails
 */
export async function withTransactionClient<T>(
  client: PGlite,
  callback: (client: PGlite) => Promise<T>
): Promise<T> {
  try {
    // Begin transaction
    await client.exec('BEGIN');

    // Execute callback
    const result = await callback(client);

    // Commit transaction
    await client.exec('COMMIT');

    return result;
  } catch (error) {
    // Rollback on error
    try {
      await client.exec('ROLLBACK');
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError);
    }

    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(
      DatabaseErrorCode.TRANSACTION_FAILED,
      'Transaction failed and was rolled back',
      error
    );
  }
}
