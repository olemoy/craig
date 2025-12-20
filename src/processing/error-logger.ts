/**
 * Error logger for file processing
 * Logs processing errors to logs/<repo-name>-errors-<date>.log
 */

import fs from 'fs';
import { join } from 'path';
import { resolveProjectPath } from '../utils/paths.js';

export interface ProcessingError {
  timestamp: Date;
  filePath: string;
  errorType: 'file_too_large' | 'processing_error' | 'unsupported_format' | 'unknown' | 'estimated_too_many_chunks' | 'too_many_chunks';
  message: string;
  details?: any;
}

// Current error log file path (set by initializeErrorLogger)
let currentErrorLogPath: string | null = null;

// Track log write failures
let logWriteFailures = 0;
let lastLogWriteError: Error | null = null;

/**
 * Initialize error logger for a repository
 * Creates log file in logs/<repo-name>-errors-<date>.log
 */
export function initializeErrorLogger(repositoryName: string): string {
  const logsDir = resolveProjectPath('logs');
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedName = repositoryName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  currentErrorLogPath = join(logsDir, `${sanitizedName}-errors-${date}.log`);

  // Reset failure tracking for new logger
  logWriteFailures = 0;
  lastLogWriteError = null;

  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  return currentErrorLogPath;
}

/**
 * Get the current error log file name (just the filename, not the full path)
 */
export function getErrorLogFileName(): string {
  if (!currentErrorLogPath) {
    return 'processing-error.log';
  }
  return currentErrorLogPath.split('/').pop() || 'processing-error.log';
}

/**
 * Log a processing error to the error log file
 */
export async function logProcessingError(error: ProcessingError): Promise<void> {
  const logFilePath = currentErrorLogPath || resolveProjectPath('processing-error.log');

  const timestamp = error.timestamp.toISOString();
  const logEntry = {
    timestamp,
    filePath: error.filePath,
    errorType: error.errorType,
    message: error.message,
    ...(error.details && { details: error.details }),
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    await fs.promises.appendFile(logFilePath, logLine, 'utf-8');
  } catch (e) {
    // Track this failure
    logWriteFailures++;
    lastLogWriteError = e instanceof Error ? e : new Error(String(e));

    // Output to stderr as fallback - make it very visible
    console.error('⚠️  WARNING: Failed to write to error log file!');
    console.error(`   Log file: ${logFilePath}`);
    console.error(`   Failure reason: ${e}`);
    console.error(`   Total log write failures so far: ${logWriteFailures}`);
    console.error(`   Original error that couldn't be logged: ${JSON.stringify(logEntry)}`);
  }
}

/**
 * Helper to format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Create a summary report of all errors from the log file
 */
export async function generateErrorSummary(): Promise<string> {
  const logFilePath = currentErrorLogPath || resolveProjectPath('processing-error.log');

  try {
    const content = await fs.promises.readFile(logFilePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);

    if (lines.length === 0) {
      return 'No processing errors found.';
    }

    const errors = lines.map(line => JSON.parse(line) as ProcessingError);

    const errorsByType: Record<string, number> = {};
    for (const error of errors) {
      errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1;
    }

    let summary = `\nProcessing Error Summary (${errors.length} total errors):\n`;
    for (const [type, count] of Object.entries(errorsByType)) {
      summary += `  - ${type}: ${count}\n`;
    }

    return summary;
  } catch (e) {
    if ((e as any).code === 'ENOENT') {
      return 'No error log file found.';
    }
    return `Failed to read error log: ${e}`;
  }
}

/**
 * Clear the error log file
 */
export async function clearErrorLog(): Promise<void> {
  const logFilePath = currentErrorLogPath || resolveProjectPath('processing-error.log');

  try {
    await fs.promises.unlink(logFilePath);
  } catch (e) {
    if ((e as any).code !== 'ENOENT') {
      throw e;
    }
    // File doesn't exist, nothing to clear
  }
}

/**
 * Get the number of log write failures that have occurred
 */
export function getLogWriteFailureCount(): number {
  return logWriteFailures;
}

/**
 * Get the last log write error that occurred
 */
export function getLastLogWriteError(): Error | null {
  return lastLogWriteError;
}

/**
 * Check if error logging is degraded (has failures)
 * Returns a warning message if degraded, null otherwise
 */
export function getLoggingHealthWarning(): string | null {
  if (logWriteFailures === 0) {
    return null;
  }

  return `⚠️  Warning: Error logging is degraded. ${logWriteFailures} log write failure(s) occurred. Errors were output to stderr instead. Last error: ${lastLogWriteError?.message}`;
}
