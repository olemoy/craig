/**
 * Progress reporter for CLI commands
 * Provides a fixed progress bar with real-time stats
 */

import cliProgress from 'cli-progress';

export interface ProgressStats {
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  totalEmbeddings: number;
  currentFile?: string;
  phase?: 'discovery' | 'processing' | 'cleanup' | 'complete';
  startTime: number;
  lastUpdateTime: number;
  processingRates: number[];  // Sliding window for smoothed ETA
}

export interface ProgressReporter {
  start(totalFiles: number): void;
  updateFile(filePath: string, chunks: number): void;
  updatePhase(phase: ProgressStats['phase'], message?: string): void;
  warnLargeFile(fileName: string, estimatedChunks: number): void;
  updateChunkProgress(fileName: string, processedChunks: number, totalChunks: number): void;
  finish(): void;
  log(message: string): void;
  error(message: string): void;
}

export function createProgressReporter(mode: 'progress' | 'verbose' | 'quiet'): ProgressReporter {
  if (mode === 'verbose') {
    return createVerboseReporter();
  } else if (mode === 'quiet') {
    return createQuietReporter();
  }
  return createBarReporter();
}

// Helper functions for time formatting
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function calculateETA(stats: ProgressStats): string {
  const { totalFiles, processedFiles, startTime, processingRates } = stats;

  // Need at least 5% progress or 10 files before showing ETA
  if (processedFiles < Math.max(Math.floor(totalFiles * 0.05), 10)) {
    return 'Calculating...';
  }

  // Calculate average rate from sliding window
  if (processingRates.length === 0) return 'Calculating...';

  const avgRate = processingRates.reduce((a, b) => a + b) / processingRates.length;
  const remainingFiles = totalFiles - processedFiles;
  const etaMs = remainingFiles / avgRate;

  return `~${formatDuration(etaMs)} left`;
}

// Progress bar mode - fixed display with stats
function createBarReporter(): ProgressReporter {
  let bar: cliProgress.SingleBar | null = null;
  let stats: ProgressStats = {
    totalFiles: 0,
    processedFiles: 0,
    totalChunks: 0,
    totalEmbeddings: 0,
    phase: 'discovery',
    startTime: 0,
    lastUpdateTime: 0,
    processingRates: [],
  };

  const multibar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: ' {bar} | {percentage}% | {value}/{total} files | ⏱ {elapsed} | {eta}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  }, cliProgress.Presets.shades_classic);

  return {
    start(totalFiles: number) {
      stats.totalFiles = totalFiles;
      stats.processedFiles = 0;
      stats.totalChunks = 0;
      stats.totalEmbeddings = 0;
      stats.phase = 'processing';
      stats.startTime = Date.now();
      stats.lastUpdateTime = Date.now();
      stats.processingRates = [];

      bar = multibar.create(totalFiles, 0, {
        elapsed: '0s',
        eta: 'Calculating...',
      });
    },

    updateFile(filePath: string, chunks: number) {
      const now = Date.now();
      stats.processedFiles++;
      stats.totalChunks += chunks;
      stats.totalEmbeddings += chunks;
      stats.currentFile = filePath;

      // Calculate rate for smoothed ETA
      const timeSinceLastUpdate = now - stats.lastUpdateTime;
      if (timeSinceLastUpdate > 0) {
        const rate = 1000 / timeSinceLastUpdate; // files per second
        stats.processingRates.push(rate);

        // Keep sliding window of last 20 rates
        if (stats.processingRates.length > 20) {
          stats.processingRates.shift();
        }
      }
      stats.lastUpdateTime = now;

      // Calculate elapsed time and ETA
      const elapsed = formatDuration(now - stats.startTime);
      const eta = calculateETA(stats);

      bar?.update(stats.processedFiles, {
        elapsed,
        eta,
      });
    },

    updatePhase(phase: ProgressStats['phase'], message?: string) {
      stats.phase = phase;
      // Phase changes don't update the bar, they just log
    },

    warnLargeFile(fileName: string, estimatedChunks: number) {
      const shortName = fileName.split('/').pop() || fileName;
      multibar.log(`⚠ Large file detected: ${shortName} (~${estimatedChunks.toLocaleString()} chunks, may take several minutes)\n`);
    },

    updateChunkProgress(fileName: string, processedChunks: number, totalChunks: number) {
      // Don't update bar during chunk processing (keeps display stable)
    },

    finish() {
      const elapsed = formatDuration(Date.now() - stats.startTime);
      if (bar) {
        bar.update(stats.totalFiles, {
          elapsed,
          eta: 'Complete!',
        });
      }
      multibar.stop();

      // Print summary
      console.log(`\n✓ Processing complete`);
      console.log(`  Files processed: ${stats.processedFiles}/${stats.totalFiles}`);
      console.log(`  Total chunks: ${stats.totalChunks}`);
      console.log(`  Total embeddings: ${stats.totalEmbeddings}`);
      console.log(`  Duration: ${elapsed}`);
    },

    log(message: string) {
      // In progress mode, only show important messages
      if (message.includes('✓') || message.includes('repository') || message.includes('Delta') || message.includes('File size')) {
        multibar.log(message + '\n');
      }
    },

    error(message: string) {
      multibar.log('ERROR: ' + message + '\n');
    },
  };
}

// Verbose mode - logs everything
function createVerboseReporter(): ProgressReporter {
  return {
    start(totalFiles: number) {
      console.log(`Starting processing of ${totalFiles} files...`);
    },

    updateFile(filePath: string, chunks: number) {
      const time = new Date().toTimeString().split(' ')[0];
      console.log(`[${time}] Processed: ${filePath} (${chunks} chunks)`);
    },

    updatePhase(phase: ProgressStats['phase'], message?: string) {
      if (message) {
        console.log(message);
      }
    },

    warnLargeFile(fileName: string, estimatedChunks: number) {
      const time = new Date().toTimeString().split(' ')[0];
      const shortName = fileName.split('/').pop() || fileName;
      console.log(`[${time}] ⚠ Large file: ${shortName} (~${estimatedChunks.toLocaleString()} chunks)`);
    },

    updateChunkProgress(fileName: string, processedChunks: number, totalChunks: number) {
      // Log every 100 chunks to avoid spam
      if (processedChunks % 100 === 0 || processedChunks === totalChunks) {
        const time = new Date().toTimeString().split(' ')[0];
        const shortName = fileName.split('/').pop() || fileName;
        const percentage = Math.round((processedChunks / totalChunks) * 100);
        console.log(`[${time}] Embedding ${shortName}: ${processedChunks.toLocaleString()}/${totalChunks.toLocaleString()} (${percentage}%)`);
      }
    },

    finish() {
      console.log('✓ Processing complete');
    },

    log(message: string) {
      console.log(message);
    },

    error(message: string) {
      console.error('ERROR:', message);
    },
  };
}

// Quiet mode - minimal output
function createQuietReporter(): ProgressReporter {
  return {
    start() {},
    updateFile() {},
    updatePhase() {},
    warnLargeFile() {},
    updateChunkProgress() {},
    finish() {},
    log(message: string) {
      // Only show important messages
      if (message.includes('✓') || message.includes('ERROR')) {
        console.log(message);
      }
    },
    error(message: string) {
      console.error('ERROR:', message);
    },
  };
}
