import { resolve } from "path";
import path from "path";
import { existsSync } from "fs";
import fs from "fs";
import { processDirectory } from "../../processing/index.js";
import { createProgressReporter } from "../progress.js";
import { getEmbeddingProvider } from "../../config/index.js";
import { checkOllamaAvailability } from "../../embeddings/ollama.js";
import type { OllamaConfig } from "../../config/index.js";

async function showSkippedFiles(repositoryName: string): Promise<void> {
  const { resolveProjectPath } = await import("../../utils/paths.js");
  const { formatFileSize } = await import("../../processing/error-logger.js");

  const date = new Date().toISOString().split('T')[0];
  const sanitizedName = repositoryName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  let logFilePath = resolveProjectPath('logs', `${sanitizedName}-errors-${date}.log`);

  if (!existsSync(logFilePath)) {
    console.log(`No error log found for today. Searching for most recent...`);

    const logsDir = resolveProjectPath('logs');
    if (!existsSync(logsDir)) {
      console.log('No logs directory found.');
      return;
    }

    const files = await fs.promises.readdir(logsDir);
    const errorLogs = files
      .filter(f => f.startsWith(`${sanitizedName}-errors-`) && f.endsWith('.log'))
      .sort()
      .reverse();

    if (errorLogs.length === 0) {
      console.log(`No error logs found for repository: ${repositoryName}`);
      return;
    }

    logFilePath = path.join(logsDir, errorLogs[0]);
    console.log(`Using: ${errorLogs[0]}\n`);
  }

  const content = await fs.promises.readFile(logFilePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.length > 0);

  if (lines.length === 0) {
    console.log('No errors found in log file.');
    return;
  }

  const skipErrorTypes = new Set([
    'file_too_large',
    'estimated_too_many_chunks',
    'too_many_chunks'
  ]);

  interface ErrorEntry {
    timestamp: string;
    filePath: string;
    errorType: string;
    message: string;
    details?: any;
  }

  const skippedFiles: ErrorEntry[] = lines
    .map(line => JSON.parse(line) as ErrorEntry)
    .filter(entry => skipErrorTypes.has(entry.errorType));

  if (skippedFiles.length === 0) {
    console.log('No skipped files found in error log.');
    return;
  }

  console.log(`\nSkipped Files Report (${skippedFiles.length} total)\n`);
  console.log('─'.repeat(100));

  const byType: Record<string, ErrorEntry[]> = {};
  for (const entry of skippedFiles) {
    if (!byType[entry.errorType]) {
      byType[entry.errorType] = [];
    }
    byType[entry.errorType].push(entry);
  }

  for (const [errorType, entries] of Object.entries(byType)) {
    console.log(`\n${errorType.toUpperCase()} (${entries.length} files):`);
    console.log('─'.repeat(100));

    for (const entry of entries) {
      let details = '';
      if (entry.details) {
        if (errorType === 'file_too_large') {
          const { fileSize, maxSize } = entry.details;
          details = `Size: ${formatFileSize(fileSize)} (max: ${formatFileSize(maxSize)})`;
        } else if (errorType === 'too_many_chunks') {
          const { chunkCount, maxChunks } = entry.details;
          details = `Chunks: ${chunkCount} (limit: ${maxChunks})`;
        } else if (errorType === 'estimated_too_many_chunks') {
          const { estimatedChunks, maxChunks } = entry.details;
          details = `Est. chunks: ${estimatedChunks} (limit: ${maxChunks})`;
        }
      }

      console.log(`  ${entry.filePath}`);
      if (details) {
        console.log(`    → ${details}`);
      }
    }
  }

  console.log('\n─'.repeat(100));
  console.log('\nTo force-ingest specific files:');
  console.log('  craig ingest <path> --force-files <file1>,<file2>,...');
  console.log('\nTo increase chunk limit for all files:');
  console.log('  craig ingest <path> --chunk-limit <number>');
}

export async function ingestRepo(args: string[]) {
  const pathArg = args.find((a) => !a.startsWith("-"));
  if (!pathArg) {
    console.error(
      "Usage: bun cli ingest <path> [--name <name>] [--resume] [--verbose|--quiet] [--force-files <path1,path2,...>] [--chunk-limit <number>] [--show-skipped]",
    );
    return;
  }
  const fullPath = resolve(process.cwd(), pathArg);
  if (!existsSync(fullPath)) {
    console.error("Path does not exist:", fullPath);
    return;
  }

  // Parse optional arguments
  const nameIndex = args.indexOf("--name");
  const repoName =
    nameIndex !== -1 && args[nameIndex + 1] ? args[nameIndex + 1] : undefined;
  const verbose = args.includes("--verbose") || args.includes("-v");
  const quiet = args.includes("--quiet") || args.includes("-q");
  const resume = args.includes("--resume");

  // Parse --force-files
  const forceFilesIndex = args.indexOf("--force-files");
  let forceFiles: Set<string> | undefined;
  if (forceFilesIndex !== -1) {
    const forceFilesArg = args[forceFilesIndex + 1];
    if (forceFilesArg) {
      const filePaths = forceFilesArg.split(",").map(p => p.trim());
      // Resolve paths relative to the repository being ingested
      forceFiles = new Set(filePaths.map(p => {
        // If path is absolute, use as-is
        if (path.isAbsolute(p)) {
          return p;
        }
        // Otherwise, resolve relative to the repository path
        return resolve(fullPath, p);
      }));

      for (const filePath of forceFiles) {
        if (!existsSync(filePath)) {
          console.warn(`Warning: Force-ingest file does not exist: ${filePath}`);
        }
      }
    }
  }

  // Parse --chunk-limit
  const chunkLimitIndex = args.indexOf("--chunk-limit");
  let chunkLimit: number | undefined;
  if (chunkLimitIndex !== -1 && args[chunkLimitIndex + 1]) {
    const chunkLimitStr = args[chunkLimitIndex + 1];
    const parsed = parseInt(chunkLimitStr, 10);

    if (isNaN(parsed) || parsed <= 0) {
      console.error(`Error: Invalid chunk limit "${chunkLimitStr}". Must be a positive integer.`);
      return;
    }

    chunkLimit = parsed;
    console.log(`⚡ Chunk limit override: ${chunkLimit} chunks per file`);
  }

  // Handle --show-skipped
  const showSkipped = args.includes("--show-skipped");
  if (showSkipped) {
    const repoNameForLog = repoName || path.basename(fullPath);
    await showSkippedFiles(repoNameForLog);
    return;
  }

  // Determine progress mode
  const progressMode = verbose ? "verbose" : quiet ? "quiet" : "progress";
  const progress = createProgressReporter(progressMode);

  // Initialize embedding provider based on config
  try {
    const provider = getEmbeddingProvider();

    if (provider.provider === "ollama") {
      if (!quiet)
        console.log(
          `Using Ollama for embeddings (${provider.config.model})...`,
        );

      // Check Ollama availability
      const availability = await checkOllamaAvailability(
        provider.config as OllamaConfig,
      );
      if (!availability.available) {
        console.error("Ollama is not available:", availability.error);
        console.error(
          "\nMake sure Ollama is running and the model is installed:",
        );
        console.error(
          `  ollama pull ${(provider.config as OllamaConfig).model}`,
        );
        return;
      }

      if (!quiet) console.log("✓ Ollama ready\n");
    } else {
      // Transformers.js - ensure model pipeline is available
      const { getPipeline } = await import("../../embeddings/cache.js");
      if (!quiet) console.log("Using Transformers.js for embeddings...");
      await getPipeline();
      if (!quiet) console.log("✓ Model ready\n");
    }
  } catch (e) {
    console.error(
      "Failed to initialize embedding provider:",
      e instanceof Error ? e.message : String(e),
    );
    return;
  }

  if (!quiet) {
    if (resume) {
      console.log("Resuming ingest for", fullPath);
    } else {
      console.log("Starting ingest for", fullPath);
    }
  }
  try {
    await processDirectory(fullPath, repoName, {
      verbose,
      progress,
      resume,
      ...(forceFiles && { forceFiles }),
      ...(chunkLimit && { chunkLimit })
    });
    if (quiet) console.log("✓ Ingest completed successfully!");
  } catch (err) {
    console.error(
      "Ingest failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
