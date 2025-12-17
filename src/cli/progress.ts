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

// Progress bar mode - fixed display with stats
function createBarReporter(): ProgressReporter {
  let bar: cliProgress.SingleBar | null = null;
  let stats: ProgressStats = {
    totalFiles: 0,
    processedFiles: 0,
    totalChunks: 0,
    totalEmbeddings: 0,
    phase: 'discovery',
  };

  const multibar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: ' {bar} | {percentage}% | {value}/{total} files | Chunks: {chunks} | {status}',
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

      bar = multibar.create(totalFiles, 0, {
        chunks: 0,
        status: 'Starting...',
      });
    },

    updateFile(filePath: string, chunks: number) {
      stats.processedFiles++;
      stats.totalChunks += chunks;
      stats.totalEmbeddings += chunks;
      stats.currentFile = filePath;

      // Get just the filename for display
      const fileName = filePath.split('/').pop() || filePath;
      const shortPath = fileName.length > 40 ? '...' + fileName.slice(-37) : fileName;

      bar?.update(stats.processedFiles, {
        chunks: stats.totalChunks,
        status: shortPath,
      });
    },

    updatePhase(phase: ProgressStats['phase'], message?: string) {
      stats.phase = phase;
      if (message) {
        bar?.update(stats.processedFiles, {
          chunks: stats.totalChunks,
          status: message,
        });
      }
    },

    warnLargeFile(fileName: string, estimatedChunks: number) {
      const shortName = fileName.split('/').pop() || fileName;
      multibar.log(`⚠ Large file detected: ${shortName} (~${estimatedChunks.toLocaleString()} chunks, may take several minutes)\n`);
    },

    updateChunkProgress(fileName: string, processedChunks: number, totalChunks: number) {
      const shortName = fileName.split('/').pop() || fileName;
      const percentage = Math.round((processedChunks / totalChunks) * 100);
      bar?.update(stats.processedFiles, {
        chunks: stats.totalChunks + processedChunks,
        status: `${shortName} - Embedding: ${processedChunks.toLocaleString()}/${totalChunks.toLocaleString()} (${percentage}%)`,
      });
    },

    finish() {
      if (bar) {
        bar.update(stats.totalFiles, {
          chunks: stats.totalChunks,
          status: 'Complete!',
        });
      }
      multibar.stop();

      // Print summary
      console.log(`\n✓ Processing complete`);
      console.log(`  Files processed: ${stats.processedFiles}/${stats.totalFiles}`);
      console.log(`  Total chunks: ${stats.totalChunks}`);
      console.log(`  Total embeddings: ${stats.totalEmbeddings}`);
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
