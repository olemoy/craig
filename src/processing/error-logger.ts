/**
 * Error logger for file processing
 * Logs processing errors to processing-error.log with timestamps
 */

import fs from 'fs';
import path from 'path';

export interface ProcessingError {
  timestamp: Date;
  filePath: string;
  errorType: 'file_too_large' | 'processing_error' | 'unsupported_format' | 'unknown';
  message: string;
  details?: any;
}

/**
 * Log a processing error to the error log file
 * File is created in the project root as processing-error.log
 */
export async function logProcessingError(error: ProcessingError): Promise<void> {
  const logFilePath = path.resolve(process.cwd(), 'processing-error.log');

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
    // If we can't write to the log file, output to stderr
    console.error(`Failed to write to error log: ${e}`);
    console.error(`Original error: ${JSON.stringify(logEntry)}`);
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
  const logFilePath = path.resolve(process.cwd(), 'processing-error.log');

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
  const logFilePath = path.resolve(process.cwd(), 'processing-error.log');

  try {
    await fs.promises.unlink(logFilePath);
  } catch (e) {
    if ((e as any).code !== 'ENOENT') {
      throw e;
    }
    // File doesn't exist, nothing to clear
  }
}
