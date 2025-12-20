import path from "path";
import fs from "fs";
import { discoverFiles } from "./discovery";
import { detectFileType } from "./type-detector";
import { readTextFile } from "./text-processor";
import { processBinary } from "./binary-processor";
import { chunkText } from "./chunker";
import { sha256Hex } from "./hasher.js";
import { DEFAULT_CONFIG } from "./config";
import {
  insertRepository,
  getRepositoryByPath,
  updateRepository,
} from "../db/repositories.js";
import {
  insertFile,
  updateFile as updateFileRecord,
  getFileByPath,
} from "../db/files.js";
import { insertChunks } from "../db/chunks.js";
import { insertEmbeddings } from "../db/embeddings.js";
import { embedTexts } from "../embeddings/pipeline.js";
import {
  analyzeDelta,
  analyzeResume,
  deleteFileAndChunks,
  updateFile,
} from "./delta.js";
import type { RepositoryId, FileId } from "../db/types.js";
import type { ProgressReporter } from "../cli/progress.js";
import {
  logProcessingError,
  formatFileSize,
  generateErrorSummary,
  initializeErrorLogger,
  getErrorLogFileName,
} from "./error-logger.js";
import { createIngestionLogger } from "../utils/ingestion-logger.js";

export interface ProcessingOptions {
  verbose?: boolean;
  progress?: ProgressReporter;
  resume?: boolean;
  forceFiles?: Set<string>;  // Absolute paths to force-ingest
  chunkLimit?: number;        // Runtime override for maxChunksPerFile
}

export async function processDirectory(
  root: string,
  repoName?: string,
  opts?: ProcessingOptions,
) {
  const fmtTime = (d: Date) => d.toTimeString().split(" ")[0];
  const verbose = opts?.verbose ?? false;
  const progress = opts?.progress;
  const resume = opts?.resume ?? false;
  const forceFiles = opts?.forceFiles;
  const chunkLimitOverride = opts?.chunkLimit;
  const log = verbose ? console.log : () => {};

  // Helper to convert absolute paths to relative paths for display
  const toRelativePath = (absolutePath: string, repoPath: string): string => {
    return path.relative(repoPath, absolutePath);
  };

  // Get or create repository record
  let repo = await getRepositoryByPath(root);
  let isDeltaIngestion = false;

  if (!repo) {
    const name = repoName || path.basename(root);
    repo = await insertRepository({
      name,
      path: root,
      commit_sha: null,
      metadata: null,
    });
    const msg = `Created repository: ${repo.name} (id: ${repo.id})`;
    if (progress) {
      progress.log(msg);
    } else {
      console.log(msg);
    }
  } else {
    const msg1 = `Existing repository found: ${repo.name} (id: ${repo.id})`;
    const msg2 = `Performing delta ingestion (only processing changes)...`;
    if (progress) {
      progress.log(msg1);
      progress.log(msg2);
    } else {
      console.log(msg1);
      console.log(msg2);
    }
    isDeltaIngestion = true;
  }

  // Initialize error logger for this repository
  initializeErrorLogger(repo.name);

  // Apply runtime overrides to configuration
  const processingConfig = {
    ...DEFAULT_CONFIG,
    ...(chunkLimitOverride && { maxChunksPerFile: chunkLimitOverride })
  };

  // Display processing configuration on single line
  const maxSizeMsg = `File size limit: ${formatFileSize(processingConfig.maxFileSizeBytes)}`;
  const chunkLimitMsg = processingConfig.skipLargeFiles && processingConfig.maxChunksPerFile
    ? ` | Chunk limit: ${processingConfig.maxChunksPerFile} chunks per file`
    : '';
  const configMsg = maxSizeMsg + chunkLimitMsg;

  if (progress) {
    progress.log(configMsg);
  } else {
    console.log(configMsg);
  }

  progress?.updatePhase("discovery", "Discovering files...");
  const discoveredFiles = await discoverFiles(root);

  // Analyze what changed
  let filesToProcess: string[] = discoveredFiles;

  if (isDeltaIngestion && resume) {
    // Resume mode: skip files that already have embeddings
    const resumeAnalysis = await analyzeResume(repo, discoveredFiles);

    const resumeMsg = `Resuming ingestion:\n  ✓ Already processed: ${resumeAnalysis.alreadyProcessed.length}\n  ⏭️  To process:        ${resumeAnalysis.toProcess.length}`;
    if (progress) {
      progress.log(resumeMsg);
    } else {
      console.log(resumeMsg);
    }

    filesToProcess = resumeAnalysis.toProcess;

    if (filesToProcess.length === 0) {
      const msg = "✓ All files already processed, nothing to resume.";
      if (progress) {
        progress.log(msg);
      } else {
        console.log(msg);
      }
      await updateRepository({
        id: repo.id,
        metadata: { last_checked: new Date().toISOString() },
      });
      return;
    }

    const procMsg = `Starting to process ${filesToProcess.length} remaining files...`;
    if (progress) {
      progress.log(procMsg);
    } else {
      console.log(procMsg);
    }
  } else if (isDeltaIngestion) {
    const delta = await analyzeDelta(repo, discoveredFiles);

    // Delta analysis summary is now shown by the spinner in analyzeDelta()

    // Provide guidance if many files are marked as modified
    if (
      delta.toUpdate.length > 0 &&
      delta.toUpdate.length > delta.toAdd.length * 0.5
    ) {
      const tipMsg =
        "\nℹ️  Tip: If many files show as modified but haven't changed, you may need to re-ingest after the recent hash calculation fix.";
      console.log(tipMsg);
    }

    // Delete removed files
    if (delta.toDelete.length > 0) {
      progress?.updatePhase("cleanup", "Deleting removed files...");
    }
    for (const file of delta.toDelete) {
      log(`[${fmtTime(new Date())}] Deleting: ${file.file_path}`);
      await deleteFileAndChunks(file.id);
      // Yield to event loop to keep UI responsive
      await Bun.sleep(0);
    }

    // Update modified files (delete old chunks/embeddings)
    for (const filePath of delta.toUpdate) {
      const existingFile = await getFileByPath(repo.id, filePath);
      if (existingFile) {
        await updateFile(existingFile.id);
      }
      // Yield to event loop to keep UI responsive
      await Bun.sleep(0);
    }

    // Only process new and modified files
    filesToProcess = [...delta.toAdd, ...delta.toUpdate];

    if (filesToProcess.length === 0) {
      console.log("✓ Repository is up to date, no changes detected.");

      // Provide specific feedback about what wasn't found
      if (delta.toAdd.length === 0 && delta.toUpdate.length === 0) {
        console.log("  No new files or modifications found.");
      }

      // Helpful tip for users
      console.log(
        "\nℹ️  If this seems incorrect, you can drop and re-ingest the repository:",
      );
      console.log("  1. Delete the repository from the database");
      console.log("  2. Run ingestion again to do a complete re-index");

      await updateRepository({
        id: repo.id,
        metadata: { last_checked: new Date().toISOString() },
      });
      return;
    }

    // Provide clearer messaging about what will be processed
    let procMsg = `Processing ${filesToProcess.length} changed file${filesToProcess.length === 1 ? "" : "s"}...`;
    if (delta.toAdd.length > 0 && delta.toUpdate.length === 0) {
      procMsg = `Processing ${delta.toAdd.length} new file${delta.toAdd.length === 1 ? "" : "s"}...`;
    } else if (delta.toAdd.length === 0 && delta.toUpdate.length > 0) {
      procMsg = `Processing ${delta.toUpdate.length} modified file${delta.toUpdate.length === 1 ? "" : "s"}...`;
    } else if (delta.toAdd.length > 0 && delta.toUpdate.length > 0) {
      procMsg = `Processing ${delta.toAdd.length} new and ${delta.toUpdate.length} modified file${delta.toUpdate.length === 1 ? "" : "s"}...`;
    }

    if (progress) {
      progress.log(procMsg);
    } else {
      console.log(procMsg);
    }
  }

  const files = filesToProcess;
  let skippedFiles = 0;
  let skippedDueToSize = 0;
  let skippedDueToError = 0;
  let filesIngested = 0; // New files added to DB
  let totalErrors = 0; // Total errors encountered
  let totalChunksProcessed = 0; // Track total chunks

  // Create ingestion logger
  const logger = createIngestionLogger(repo.name);
  const sessionStartTime = Date.now();
  const mode = resume ? "resume" : isDeltaIngestion ? "update" : "ingest";
  logger.sessionStart(mode, files.length);

  // Start progress tracking
  progress?.start(files.length);

  for (const f of files) {
    const fileStartTime = Date.now();
    try {
      logger.start(f);
      const start = new Date();
      const meta = await detectFileType(f);
      const stat = await fs.promises.stat(f);

      // Check if file exists in database and clean up failed attempts
      let existingFile = await getFileByPath(repo.id, f);

      // If file exists but processing failed, delete it for clean retry
      if (existingFile && meta.fileType !== "binary") {
        const { getChunkCount } = await import("../db/chunks.js");
        const { getClient } = await import("../db/client.js");
        const chunkCount = await getChunkCount(existingFile.id);

        // Check if embeddings exist for the chunks
        let needsCleanup = false;
        if (chunkCount === 0) {
          // No chunks at all - failed during chunking
          needsCleanup = true;
        } else {
          // Has chunks - check if embeddings exist
          const dbClient = await getClient();
          const embeddingResult = await dbClient.query(
            `SELECT COUNT(*) as count
             FROM embeddings e
             INNER JOIN chunks c ON c.id = e.chunk_id
             WHERE c.file_id = $1`,
            [existingFile.id],
          );
          interface CountRow {
            count: string | number;
          }
          const countRow = embeddingResult.rows[0] as CountRow;
          const embeddingCount =
            typeof countRow.count === "string"
              ? parseInt(countRow.count, 10)
              : countRow.count;
          if (embeddingCount === 0) {
            // Has chunks but no embeddings - failed during embedding
            needsCleanup = true;
          }
        }

        if (needsCleanup) {
          const displayPath = toRelativePath(f, repo.path);
          log(
            `[${fmtTime(new Date())}] Cleaning up failed file for retry: ${displayPath}`,
          );
          await deleteFileAndChunks(existingFile.id);
          existingFile = null; // Treat as new file for re-insertion
        }
      }

      const isNewFile = !existingFile;

      // Check if this file should be force-ingested
      const isForceFile = forceFiles && forceFiles.has(f);

      // Check file size before processing
      if (!isForceFile && stat.size > processingConfig.maxFileSizeBytes) {
        const displayPath = toRelativePath(f, repo.path);
        const errorMsg = `File too large: ${formatFileSize(stat.size)} (max: ${formatFileSize(DEFAULT_CONFIG.maxFileSizeBytes)})`;
        await logProcessingError({
          timestamp: new Date(),
          filePath: f,
          errorType: "file_too_large",
          message: errorMsg,
          details: {
            fileSize: stat.size,
            maxSize: DEFAULT_CONFIG.maxFileSizeBytes,
          },
        });

        if (progress) {
          progress.error(`Skipping ${displayPath}: ${errorMsg}`);
        } else {
          console.error(`ERROR: Skipping ${displayPath}: ${errorMsg}`);
        }

        // Create file record for skipped file
        const fileHash = ""; // Empty hash since we didn't read the file
        if (existingFile) {
          // Update existing file with skip metadata
          await updateFileRecord({
            id: existingFile.id,
            content: null,
            content_hash: fileHash,
            size_bytes: stat.size,
            last_modified: stat.mtime,
            metadata: {
              skipped: true,
              skip_reason: "file_too_large",
              skip_details: {
                fileSize: stat.size,
                maxSize: processingConfig.maxFileSizeBytes,
              },
            },
          });
        } else {
          // Insert new file record with skip metadata
          await insertFile({
            repository_id: repo.id,
            file_path: f,
            file_type: meta.fileType,
            content: null,
            binary_metadata: null,
            content_hash: fileHash,
            size_bytes: stat.size,
            last_modified: stat.mtime,
            language: meta.language ?? null,
            metadata: {
              skipped: true,
              skip_reason: "file_too_large",
              skip_details: {
                fileSize: stat.size,
                maxSize: processingConfig.maxFileSizeBytes,
              },
            },
          });
        }

        skippedFiles++;
        skippedDueToSize++;
        logger.skip(f, `File too large: ${formatFileSize(stat.size)}`);
        progress?.updateFile(f, 0);

        // Yield to event loop before continuing to next file
        await Bun.sleep(0);
        continue; // Skip this file and continue with the next one
      }

      // Notify if force-ingesting a large file
      if (isForceFile && stat.size > processingConfig.maxFileSizeBytes) {
        const displayPath = toRelativePath(f, repo.path);
        const forceMsg = `⚡ Force-ingesting: ${displayPath} (bypassing size limit)`;
        if (progress) {
          progress.log(forceMsg);
        } else {
          console.log(forceMsg);
        }
      }

      // Pre-filter by estimated chunk count (avoid reading obviously large files)
      if (
        !isForceFile &&
        meta.fileType !== "binary" &&
        processingConfig.skipLargeFiles &&
        processingConfig.maxChunksPerFile
      ) {
        // Quick estimation: fileSize / (tokenTarget * 4 chars/token)
        const estimatedChunks = Math.ceil(
          stat.size / (processingConfig.tokenTarget * 4),
        );
        const threshold = processingConfig.maxChunksPerFile * 1.5; // Add 50% buffer for estimation error

        if (estimatedChunks > threshold) {
          const displayPath = toRelativePath(f, repo.path);
          const warnMsg = `File estimated at ~${estimatedChunks} chunks (limit: ${processingConfig.maxChunksPerFile})`;
          await logProcessingError({
            timestamp: new Date(),
            filePath: f,
            errorType: "estimated_too_many_chunks",
            message: warnMsg,
            details: {
              estimatedChunks,
              maxChunks: processingConfig.maxChunksPerFile,
              fileSize: stat.size,
            },
          });

          if (progress) {
            progress.log(` - Skipping ${displayPath}: ${warnMsg}`);
          } else {
            console.log(` - Skipping ${displayPath}: ${warnMsg}`);
          }

          // Create file record for skipped file
          const fileHash = ""; // Empty hash since we didn't read the file
          if (existingFile) {
            // Update existing file with skip metadata
            await updateFileRecord({
              id: existingFile.id,
              content: null,
              content_hash: fileHash,
              size_bytes: stat.size,
              last_modified: stat.mtime,
              metadata: {
                skipped: true,
                skip_reason: "estimated_too_many_chunks",
                skip_details: {
                  estimatedChunks,
                  maxChunks: processingConfig.maxChunksPerFile,
                  fileSize: stat.size,
                },
              },
            });
          } else {
            // Insert new file record with skip metadata
            await insertFile({
              repository_id: repo.id,
              file_path: f,
              file_type: meta.fileType,
              content: null,
              binary_metadata: null,
              content_hash: fileHash,
              size_bytes: stat.size,
              last_modified: stat.mtime,
              language: meta.language ?? null,
              metadata: {
                skipped: true,
                skip_reason: "estimated_too_many_chunks",
                skip_details: {
                  estimatedChunks,
                  maxChunks: processingConfig.maxChunksPerFile,
                  fileSize: stat.size,
                },
              },
            });
          }

          skippedFiles++;
          logger.skip(f, warnMsg);
          progress?.updateFile(f, 0);

          // Yield to event loop before continuing to next file
          await Bun.sleep(0);
          continue;
        }
      }

      if (meta.fileType === "binary") {
        log(`[${fmtTime(start)}] Processing: ${f} (binary)`);
        const bin = await processBinary(f);

        if (existingFile) {
          // Update existing file
          await updateFileRecord({
            id: existingFile.id,
            content: null,
            binary_metadata: {
              size: bin.size,
              hash: bin.hash,
            },
            content_hash: bin.hash,
            size_bytes: bin.size,
            last_modified: stat.mtime,
          });
        } else {
          // Insert new file
          await insertFile({
            repository_id: repo.id,
            file_path: f,
            file_type: "binary",
            content: null,
            binary_metadata: {
              size: bin.size,
              hash: bin.hash,
            },
            content_hash: bin.hash,
            size_bytes: bin.size,
            last_modified: stat.mtime,
            language: null,
            metadata: null,
          });
          filesIngested++;
        }

        const end = new Date();
        const duration = Date.now() - fileStartTime;
        logger.done(f, 0, duration);
        progress?.updateFile(f, 0);

        // Yield to event loop after processing binary file
        await Bun.sleep(0);
      } else {
        const txt = await readTextFile(f);
        log(`[${fmtTime(start)}] Processing: ${f}`);

        log(`  → Chunking text...`);
        const chunks = chunkText(f, txt, {
          tokenTarget: DEFAULT_CONFIG.tokenTarget,
          overlapTokens: DEFAULT_CONFIG.overlapTokens,
          language: meta.language ?? null,
        });
        log(`  → Created ${chunks.length} chunks`);

        // Check chunk count limit
        if (
          !isForceFile &&
          processingConfig.skipLargeFiles &&
          processingConfig.maxChunksPerFile &&
          chunks.length > processingConfig.maxChunksPerFile
        ) {
          const displayPath = toRelativePath(f, repo.path);
          const warnMsg = `File produces ${chunks.length} chunks (limit: ${processingConfig.maxChunksPerFile})`;
          await logProcessingError({
            timestamp: new Date(),
            filePath: f,
            errorType: "too_many_chunks",
            message: warnMsg,
            details: {
              chunkCount: chunks.length,
              maxChunks: processingConfig.maxChunksPerFile,
            },
          });

          if (progress) {
            progress.log(` - Skipping ${displayPath}: ${warnMsg}`);
          } else {
            console.log(` - Skipping ${displayPath}: ${warnMsg}`);
          }

          // Create file record for skipped file (we have content hash since we read the file)
          const fileHash = sha256Hex(txt);
          if (existingFile) {
            // Update existing file with skip metadata
            await updateFileRecord({
              id: existingFile.id,
              content: null,
              content_hash: fileHash,
              size_bytes: stat.size,
              last_modified: stat.mtime,
              metadata: {
                skipped: true,
                skip_reason: "too_many_chunks",
                skip_details: {
                  chunkCount: chunks.length,
                  maxChunks: processingConfig.maxChunksPerFile,
                },
              },
            });
          } else {
            // Insert new file record with skip metadata
            await insertFile({
              repository_id: repo.id,
              file_path: f,
              file_type: meta.fileType,
              content: null,
              binary_metadata: null,
              content_hash: fileHash,
              size_bytes: stat.size,
              last_modified: stat.mtime,
              language: meta.language ?? null,
              metadata: {
                skipped: true,
                skip_reason: "too_many_chunks",
                skip_details: {
                  chunkCount: chunks.length,
                  maxChunks: processingConfig.maxChunksPerFile,
                },
              },
            });
          }

          skippedFiles++;
          logger.skip(f, warnMsg);
          progress?.updateFile(f, 0);

          // Yield to event loop before continuing to next file
          await Bun.sleep(0);
          continue;
        }

        // Notify if force-ingesting a file with many chunks
        if (isForceFile && processingConfig.maxChunksPerFile && chunks.length > processingConfig.maxChunksPerFile) {
          const displayPath = toRelativePath(f, repo.path);
          const forceMsg = `⚡ Force-ingesting: ${displayPath} (${chunks.length} chunks, bypassing limit of ${processingConfig.maxChunksPerFile})`;
          if (progress) {
            progress.log(forceMsg);
          } else {
            console.log(forceMsg);
          }
        }

        // Warn user about large files (hybrid approach)
        const LARGE_FILE_THRESHOLD = 1000;
        if (chunks.length > LARGE_FILE_THRESHOLD) {
          progress?.warnLargeFile(f, chunks.length);
        }

        // Calculate proper file content hash (hash of entire normalized text)
        const fileHash = sha256Hex(txt);

        // Use existingFile from earlier check
        let fileRecord;

        if (existingFile) {
          // Update existing file
          log(`  → Updating existing file record...`);
          fileRecord = await updateFileRecord({
            id: existingFile.id,
            content: txt,
            content_hash: fileHash,
            size_bytes: stat.size,
            last_modified: stat.mtime,
            language: meta.language ?? null,
          });
        } else {
          // Insert new file
          log(`  → Inserting new file record...`);
          fileRecord = await insertFile({
            repository_id: repo.id,
            file_path: f,
            file_type: meta.fileType === "code" ? "code" : "text",
            content: txt,
            binary_metadata: null,
            content_hash: fileHash,
            size_bytes: stat.size,
            last_modified: stat.mtime,
            language: meta.language ?? null,
            metadata: null,
          });
          filesIngested++;
        }
        log(`  → File record saved (id: ${fileRecord.id})`);

        // Insert chunks and generate embeddings
        if (chunks.length > 0) {
          log(`  → Inserting ${chunks.length} chunk records...`);
          const chunkRecords = await insertChunks(
            chunks.map((chunk, index) => ({
              file_id: fileRecord.id,
              chunk_index: index,
              content: chunk.text,
              start_line: null,
              end_line: null,
              metadata: {
                startChar: chunk.startChar,
                endChar: chunk.endChar,
                startToken: chunk.startToken,
                endToken: chunk.endToken,
                overlapFromPrev: chunk.overlapFromPrev,
              },
            })),
          );
          log(`  → Chunk records inserted`);

          // Generate embeddings using batch processing (much faster!)
          log(`  → Generating ${chunkRecords.length} embeddings...`);
          const texts = chunkRecords.map((r) => r.content);

          // Enable chunk-level progress tracking for large files (hybrid approach)
          const LARGE_FILE_THRESHOLD = 1000;
          const embeddingVectors = await embedTexts(
            texts,
            chunkRecords.length > LARGE_FILE_THRESHOLD
              ? (completed, total) =>
                  progress?.updateChunkProgress(f, completed, total)
              : undefined,
          );

          const embeddings = chunkRecords.map((chunkRecord, idx) => ({
            chunk_id: chunkRecord.id,
            embedding: embeddingVectors[idx]!,
          }));

          await insertEmbeddings(embeddings);
          log(`  ✓ Generated and inserted ${embeddings.length} embeddings`);
        }

        const end = new Date();
        const duration = Date.now() - fileStartTime;
        totalChunksProcessed += chunks.length;
        logger.done(f, chunks.length, duration);
        progress?.updateFile(f, chunks.length);
      }

      // Yield to event loop after each file to keep UI responsive (spinner animation)
      await Bun.sleep(0);
    } catch (e) {
      const displayPath = toRelativePath(f, repo.path);
      // Detailed error message for console
      let errMsg: string;
      if (e instanceof Error) {
        errMsg = `Error processing ${displayPath}:\n  ${e.name}: ${e.message}`;
        if (e.stack) {
          // Show first line of stack trace for context
          const stackLine = e.stack.split("\n")[1]?.trim();
          if (stackLine) {
            errMsg += `\n  at ${stackLine}`;
          }
        }
      } else {
        errMsg = `Error processing ${displayPath}: ${String(e)}`;
      }

      // Log to error file
      await logProcessingError({
        timestamp: new Date(),
        filePath: f,
        errorType: "processing_error",
        message: String(e),
        details: {
          error:
            e instanceof Error
              ? {
                  name: e.name,
                  message: e.message,
                  stack: e.stack,
                }
              : e,
        },
      });

      if (progress) {
        progress.error(errMsg);
      } else {
        console.error(`ERROR: ${errMsg}`);
      }

      // Continue processing other files
      skippedFiles++;
      skippedDueToError++;
      totalErrors++;
      logger.error(f, e instanceof Error ? e.message : String(e));
      progress?.updateFile(f, 0);

      // Yield to event loop after error handling
      await Bun.sleep(0);
    }
  }

  // Finish progress tracking
  progress?.updatePhase("complete", "Finalizing...");

  // Update repository metadata
  await updateRepository({
    id: repo.id,
    metadata: {
      last_ingested: new Date().toISOString(),
      file_count: discoveredFiles.length,
    },
  });

  // End logging session
  const sessionDuration = Date.now() - sessionStartTime;
  const processedFileCount = files.length - skippedFiles;
  logger.sessionEnd({
    filesProcessed: processedFileCount,
    totalChunks: totalChunksProcessed,
    durationMs: sessionDuration,
  });
  logger.flush();

  progress?.finish();

  if (!progress) {
    console.log(`\n✓ Ingestion complete for repository: ${repo.name}`);
    console.log(`  Total files in repository: ${discoveredFiles.length}`);

    const filesProcessed = files.length - skippedFiles;
    console.log(`  Files processed: ${filesProcessed}`);
    console.log(`  Files ingested (new): ${filesIngested}`);

    if (skippedFiles > 0) {
      console.log(`  Files skipped: ${skippedFiles}`);
      if (skippedDueToSize > 0) {
        console.log(`    - Too large: ${skippedDueToSize}`);
      }
      if (skippedDueToError > 0) {
        console.log(`    - Errors: ${skippedDueToError}`);
      }
    }

    if (totalErrors > 0) {
      console.log(`  Total errors: ${totalErrors}`);
      console.log(`\n  ⚠️  To retry failed files, run:`);
      console.log(`     craig ingest ${root} --resume`);
    }
  } else {
    // Show summary in progress mode
    let summaryMsg = `\n✓ Processing complete`;
    summaryMsg += `\n  Files processed: ${files.length - skippedFiles}`;
    summaryMsg += `\n  Files ingested (new): ${filesIngested}`;
    if (skippedFiles > 0) {
      summaryMsg += `\n  Files skipped: ${skippedFiles}`;
      if (skippedDueToSize > 0) {
        summaryMsg += ` (${skippedDueToSize} too large)`;
      }
      if (skippedDueToError > 0) {
        summaryMsg += ` (${skippedDueToError} errors)`;
      }
    }
    if (totalErrors > 0) {
      summaryMsg += `\n  Total errors: ${totalErrors}`;
    }
    progress.log(summaryMsg);
  }

  // Show error summary if there were any processing errors
  const errorSummary = await generateErrorSummary();
  if (
    errorSummary &&
    !errorSummary.includes("No processing errors") &&
    !errorSummary.includes("No error log")
  ) {
    const errorLogFile = getErrorLogFileName();
    if (progress) {
      progress.log("\n" + errorSummary);
      progress.log(`See ${errorLogFile} for detailed error information.`);
    } else {
      console.log(errorSummary);
      console.log(`See ${errorLogFile} for detailed error information.`);
    }
  }
}

if (require.main === module) {
  const root = process.argv[2] || ".";
  processDirectory(path.resolve(root)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
