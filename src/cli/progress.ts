/**
 * Progress reporter for CLI commands
 * Uses yocto-spinner for clean, animated progress updates
 */

// Random color selection for spinners
function randomColor():
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray" {
  const colors = [
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "gray",
  ] as const;
  return colors[Math.floor(Math.random() * colors.length)];
}

export interface ProgressStats {
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  totalEmbeddings: number;
  currentFile?: string;
  phase?: "discovery" | "processing" | "cleanup" | "complete";
  startTime: number;
  lastUpdateTime: number;
  processingRates: number[]; // Sliding window for smoothed ETA
}

export interface ProgressReporter {
  start(totalFiles: number): void;
  updateFile(filePath: string, chunks: number): void;
  updatePhase(phase: ProgressStats["phase"], message?: string): void;
  warnLargeFile(fileName: string, estimatedChunks: number): void;
  updateChunkProgress(
    fileName: string,
    processedChunks: number,
    totalChunks: number,
  ): void;
  finish(): void;
  log(message: string): void;
  error(message: string): void;
}

export function createProgressReporter(
  mode: "progress" | "verbose" | "quiet",
): ProgressReporter {
  if (mode === "verbose") {
    return createVerboseReporter();
  } else if (mode === "quiet") {
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

function shortenFilename(filePath: string, maxLength: number = 40): string {
  const filename = filePath.split("/").pop() || filePath;
  if (filename.length <= maxLength) return filename;
  const start = filename.substring(0, maxLength - 3);
  return `${start}...`;
}

// Progress reporter using yocto-spinner for cleaner output
function createBarReporter(): ProgressReporter {
  let spinner: any = null;
  let isFinished: boolean = false;
  let stats: ProgressStats = {
    totalFiles: 0,
    processedFiles: 0,
    totalChunks: 0,
    totalEmbeddings: 0,
    phase: "discovery",
    startTime: 0,
    lastUpdateTime: 0,
    processingRates: [],
  };

  function updateSpinnerText() {
    if (!spinner) return;

    const now = Date.now();
    const elapsed = formatDuration(now - stats.startTime);
    const percentage = Math.round(
      (stats.processedFiles / stats.totalFiles) * 100,
    );
    const filename = shortenFilename(stats.currentFile || "");

    spinner.color = randomColor();
    spinner.text = `Ingesting files: ${percentage}% | ${stats.processedFiles}/${stats.totalFiles} | ⏱ ${elapsed} | ${filename}`;
  }

  return {
    async start(totalFiles: number) {
      stats.totalFiles = totalFiles;
      stats.processedFiles = 0;
      stats.totalChunks = 0;
      stats.totalEmbeddings = 0;
      stats.phase = "processing";
      stats.startTime = Date.now();
      stats.lastUpdateTime = Date.now();
      stats.processingRates = [];

      // Import and start spinner
      try {
        const { default: yoctoSpinner } = await import("yocto-spinner");
        const { dots12 } = await import("cli-spinners");
        spinner = yoctoSpinner({
          text: `Ingesting files: 0% | 0/${totalFiles} | ⏱ 0s`,
          spinner: dots12,
          color: randomColor(),
        });
        spinner.start();
      } catch {
        console.log(`  Processing ${totalFiles} files...`);
      }
    },

    updateFile(filePath: string, chunks: number) {
      const now = Date.now();

      // Update stats
      stats.processedFiles++;
      stats.totalChunks += chunks;
      stats.totalEmbeddings += chunks;
      stats.currentFile = filePath;

      // Update spinner text (throttled to every 100ms)
      const timeSinceLastUpdate = now - stats.lastUpdateTime;
      if (timeSinceLastUpdate >= 100) {
        stats.lastUpdateTime = now;
        updateSpinnerText();
      }
    },

    updatePhase(phase: ProgressStats["phase"], message?: string) {
      stats.phase = phase;
    },

    warnLargeFile(fileName: string, estimatedChunks: number) {
      const shortName = fileName.split("/").pop() || fileName;
      if (spinner) {
        spinner.stop();
      }
      console.log(
        `⚠ Large file detected: ${shortName} (~${estimatedChunks.toLocaleString()} chunks, may take several minutes)`,
      );
      if (spinner) {
        spinner.start();
        updateSpinnerText();
      }
    },

    updateChunkProgress(
      fileName: string,
      processedChunks: number,
      totalChunks: number,
    ) {
      // Don't update spinner during chunk processing (keeps display stable)
    },

    finish() {
      const elapsed = formatDuration(Date.now() - stats.startTime);
      isFinished = true;

      if (spinner) {
        spinner.success(
          `Completed: ${stats.totalFiles} files | ${stats.totalChunks} chunks | ⏱ ${elapsed}`,
        );
      } else {
        console.log(`\n✓ Processing complete`);
        console.log(
          `  Files processed: ${stats.processedFiles}/${stats.totalFiles}`,
        );
        console.log(`  Total chunks: ${stats.totalChunks}`);
        console.log(`  Total embeddings: ${stats.totalEmbeddings}`);
        console.log(`  Duration: ${elapsed}`);
      }
    },

    log(message: string) {
      if (spinner && !isFinished) {
        spinner.stop();
      }
      console.log(message);
      if (spinner && !isFinished) {
        spinner.start();
        updateSpinnerText();
      }
    },

    error(message: string) {
      if (spinner && !isFinished) {
        spinner.stop();
      }
      console.error("ERROR: " + message);
      if (spinner && !isFinished) {
        spinner.start();
        updateSpinnerText();
      }
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
      const time = new Date().toTimeString().split(" ")[0];
      console.log(`[${time}] Processed: ${filePath} (${chunks} chunks)`);
    },

    updatePhase(phase: ProgressStats["phase"], message?: string) {
      if (message) {
        console.log(message);
      }
    },

    warnLargeFile(fileName: string, estimatedChunks: number) {
      const time = new Date().toTimeString().split(" ")[0];
      const shortName = fileName.split("/").pop() || fileName;
      console.log(
        `[${time}] ⚠ Large file: ${shortName} (~${estimatedChunks.toLocaleString()} chunks)`,
      );
    },

    updateChunkProgress(
      fileName: string,
      processedChunks: number,
      totalChunks: number,
    ) {
      // Log every 100 chunks to avoid spam
      if (processedChunks % 100 === 0 || processedChunks === totalChunks) {
        const time = new Date().toTimeString().split(" ")[0];
        const shortName = fileName.split("/").pop() || fileName;
        const percentage = Math.round((processedChunks / totalChunks) * 100);
        console.log(
          `[${time}] Embedding ${shortName}: ${processedChunks.toLocaleString()}/${totalChunks.toLocaleString()} (${percentage}%)`,
        );
      }
    },

    finish() {
      console.log("✓ Processing complete");
    },

    log(message: string) {
      console.log(message);
    },

    error(message: string) {
      console.error("ERROR:", message);
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
      if (message.includes("✓") || message.includes("ERROR")) {
        console.log(message);
      }
    },
    error(message: string) {
      console.error("ERROR:", message);
    },
  };
}
