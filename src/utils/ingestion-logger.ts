/**
 * Ingestion logger for tracking file processing
 * Creates per-project, per-day log files in logs/ directory
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { resolveProjectPath } from './paths.js';

export interface IngestionLogger {
  sessionStart(mode: string, totalFiles: number): void;
  start(filePath: string): void;
  done(filePath: string, chunks: number, durationMs: number): void;
  skip(filePath: string, reason: string): void;
  error(filePath: string, error: string): void;
  resume(filePath: string): void;
  sessionEnd(stats: { filesProcessed: number; totalChunks: number; durationMs: number }): void;
  flush(): void;
}

interface LogEntry {
  timestamp: Date;
  type: 'SESSION_START' | 'SESSION_END' | 'START' | 'DONE' | 'SKIP' | 'ERROR' | 'RESUME';
  filePath?: string;
  metadata?: string;
}

class IngestionLoggerImpl implements IngestionLogger {
  private logPath: string;
  private buffer: LogEntry[] = [];
  private lastFlush: number = Date.now();
  private flushInterval: number = 1000; // Flush every 1 second
  private fileStartTimes: Map<string, number> = new Map();

  constructor(repositoryName: string) {
    this.logPath = this.getLogFilePath(repositoryName);
    this.ensureLogsDirectory();
  }

  private getLogFilePath(repositoryName: string): string {
    const logsDir = resolveProjectPath('logs');
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedName = repositoryName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    return join(logsDir, `${sanitizedName}-ingestion-${date}.log`);
  }

  private ensureLogsDirectory(): void {
    const logsDir = resolveProjectPath('logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private writeEntry(entry: LogEntry): void {
    this.buffer.push(entry);

    // Auto-flush if buffer is large or time interval elapsed
    if (this.buffer.length >= 10 || Date.now() - this.lastFlush > this.flushInterval) {
      this.flush();
    }
  }

  private formatEntry(entry: LogEntry): string {
    const timestamp = this.formatTimestamp(entry.timestamp);
    const type = entry.type.padEnd(13); // Longest is SESSION_START

    if (entry.filePath) {
      if (entry.metadata) {
        return `${timestamp} | ${type} | ${entry.filePath} | ${entry.metadata}`;
      }
      return `${timestamp} | ${type} | ${entry.filePath}`;
    }

    // Session markers
    if (entry.metadata) {
      return `${timestamp} | ${entry.metadata}`;
    }

    return `${timestamp} | ${type}`;
  }

  sessionStart(mode: string, totalFiles: number): void {
    const separator = '='.repeat(80);
    this.writeEntry({
      timestamp: new Date(),
      type: 'SESSION_START',
      metadata: `${separator}\nSESSION START | Mode: ${mode} | Files: ${totalFiles.toLocaleString()}\n${separator}`,
    });
  }

  start(filePath: string): void {
    this.fileStartTimes.set(filePath, Date.now());
    this.writeEntry({
      timestamp: new Date(),
      type: 'START',
      filePath,
    });
  }

  done(filePath: string, chunks: number, durationMs: number): void {
    this.writeEntry({
      timestamp: new Date(),
      type: 'DONE',
      filePath,
      metadata: `${chunks} chunks | ${durationMs}ms`,
    });
    this.fileStartTimes.delete(filePath);
  }

  skip(filePath: string, reason: string): void {
    this.writeEntry({
      timestamp: new Date(),
      type: 'SKIP',
      filePath,
      metadata: reason,
    });
  }

  error(filePath: string, error: string): void {
    this.writeEntry({
      timestamp: new Date(),
      type: 'ERROR',
      filePath,
      metadata: error,
    });
  }

  resume(filePath: string): void {
    this.writeEntry({
      timestamp: new Date(),
      type: 'RESUME',
      filePath,
      metadata: 'Already processed',
    });
  }

  sessionEnd(stats: { filesProcessed: number; totalChunks: number; durationMs: number }): void {
    const separator = '='.repeat(80);
    const duration = this.formatDuration(stats.durationMs);
    this.writeEntry({
      timestamp: new Date(),
      type: 'SESSION_END',
      metadata: `${separator}\nSESSION END | Files: ${stats.filesProcessed.toLocaleString()} | Chunks: ${stats.totalChunks.toLocaleString()} | Duration: ${duration}\n${separator}`,
    });
    this.flush(); // Always flush at session end
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const lines = this.buffer.map(entry => this.formatEntry(entry)).join('\n') + '\n';

    try {
      appendFileSync(this.logPath, lines, 'utf-8');
      this.buffer = [];
      this.lastFlush = Date.now();
    } catch (error) {
      console.error('Failed to write to ingestion log:', error);
    }
  }
}

/**
 * Create an ingestion logger for the given repository
 */
export function createIngestionLogger(repositoryName: string): IngestionLogger {
  return new IngestionLoggerImpl(repositoryName);
}

/**
 * No-op logger for when logging is disabled
 */
export function createNoOpLogger(): IngestionLogger {
  return {
    sessionStart: () => {},
    start: () => {},
    done: () => {},
    skip: () => {},
    error: () => {},
    resume: () => {},
    sessionEnd: () => {},
    flush: () => {},
  };
}
