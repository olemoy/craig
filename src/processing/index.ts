import path from 'path';
import fs from 'fs';
import {discoverFiles} from './discovery';
import {detectFileType} from './type-detector';
import {readTextFile} from './text-processor';
import {processBinary} from './binary-processor';
import {chunkText} from './chunker';
import {DEFAULT_CONFIG} from './config';
import {insertRepository, getRepositoryByPath, updateRepository} from '../db/repositories.js';
import {insertFile, updateFile as updateFileRecord, getFileByPath} from '../db/files.js';
import {insertChunks} from '../db/chunks.js';
import {insertEmbeddings} from '../db/embeddings.js';
import {embedTexts} from '../embeddings/pipeline.js';
import {analyzeDelta, deleteFileAndChunks, updateFile} from './delta.js';
import type {RepositoryId, FileId} from '../db/types.js';
import type {ProgressReporter} from '../cli/progress.js';
import {logProcessingError, formatFileSize, generateErrorSummary} from './error-logger.js';

export async function processDirectory(
  root: string,
  repoName?: string,
  opts?: { verbose?: boolean; progress?: ProgressReporter }
) {
  const fmtTime = (d: Date) => d.toTimeString().split(' ')[0];
  const verbose = opts?.verbose ?? false;
  const progress = opts?.progress;
  const log = verbose ? console.log : () => {};

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

  // Display processing configuration early
  const processingConfig = DEFAULT_CONFIG;
  const maxSizeMsg = `File size limit: ${formatFileSize(processingConfig.maxFileSizeBytes)}`;
  if (progress) {
    progress.log(maxSizeMsg);
  } else {
    console.log(maxSizeMsg);
  }

  progress?.updatePhase('discovery', 'Discovering files...');
  const discoveredFiles = await discoverFiles(root);

  // Analyze what changed
  let filesToProcess: string[] = discoveredFiles;

  if (isDeltaIngestion) {
    const delta = await analyzeDelta(repo, discoveredFiles);

    const deltaMsg = `Delta Analysis:\n  📄 Unchanged: ${delta.unchanged.length}\n  ✏️  Modified:  ${delta.toUpdate.length}\n  ➕ New:       ${delta.toAdd.length}\n  ➖ Deleted:   ${delta.toDelete.length}`;
    if (progress) {
      progress.log(deltaMsg);
    } else {
      console.log(deltaMsg);
    }

    // Delete removed files
    if (delta.toDelete.length > 0) {
      progress?.updatePhase('cleanup', 'Deleting removed files...');
    }
    for (const file of delta.toDelete) {
      log(`[${fmtTime(new Date())}] Deleting: ${file.file_path}`);
      await deleteFileAndChunks(file.id);
    }

    // Update modified files (delete old chunks/embeddings)
    for (const filePath of delta.toUpdate) {
      const existingFile = await getFileByPath(repo.id, filePath);
      if (existingFile) {
        await updateFile(existingFile.id);
      }
    }

    // Only process new and modified files
    filesToProcess = [...delta.toAdd, ...delta.toUpdate];

    if (filesToProcess.length === 0) {
      const msg = '✓ Repository is up to date, no changes detected.';
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

    const procMsg = `Processing ${filesToProcess.length} changed files...`;
    if (progress) {
      progress.log(procMsg);
    } else {
      console.log(procMsg);
    }
  }

  const files = filesToProcess;
  let skippedFiles = 0;

  // Start progress tracking
  progress?.start(files.length);

  for (const f of files) {
    try {
      const start = new Date();
      const meta = await detectFileType(f);
      const stat = await fs.promises.stat(f);

      // Check file size before processing
      if (stat.size > DEFAULT_CONFIG.maxFileSizeBytes) {
        const errorMsg = `File too large: ${formatFileSize(stat.size)} (max: ${formatFileSize(DEFAULT_CONFIG.maxFileSizeBytes)})`;
        await logProcessingError({
          timestamp: new Date(),
          filePath: f,
          errorType: 'file_too_large',
          message: errorMsg,
          details: {
            fileSize: stat.size,
            maxSize: DEFAULT_CONFIG.maxFileSizeBytes,
          },
        });

        if (progress) {
          progress.error(`Skipping ${f}: ${errorMsg}`);
        } else {
          console.error(`ERROR: Skipping ${f}: ${errorMsg}`);
        }

        skippedFiles++;
        progress?.updateFile(f, 0);
        continue; // Skip this file and continue with the next one
      }

      if (meta.fileType === 'binary') {
        log(`[${fmtTime(start)}] Processing: ${f} (binary)`);
        const bin = await processBinary(f);

        // Check if file exists for update
        const existingFile = await getFileByPath(repo.id, f);

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
            file_type: 'binary',
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
        }

        const end = new Date();
        progress?.updateFile(f, 0);
      } else {
        const txt = await readTextFile(f);
        log(`[${fmtTime(start)}] Processing: ${f}`);

        log(`  → Chunking text...`);
        const chunks = chunkText(f, txt, {
          tokenTarget: DEFAULT_CONFIG.tokenTarget,
          overlapTokens: DEFAULT_CONFIG.overlapTokens,
          language: meta.language ?? null
        });
        log(`  → Created ${chunks.length} chunks`);

        // Warn user about large files (hybrid approach)
        const LARGE_FILE_THRESHOLD = 1000;
        if (chunks.length > LARGE_FILE_THRESHOLD) {
          progress?.warnLargeFile(f, chunks.length);
        }

        // Check if file exists for update
        log(`  → Checking if file exists in DB...`);
        const existingFile = await getFileByPath(repo.id, f);
        let fileRecord;

        if (existingFile) {
          // Update existing file
          log(`  → Updating existing file record...`);
          fileRecord = await updateFileRecord({
            id: existingFile.id,
            content: txt,
            content_hash: chunks.length > 0 ? chunks[0].chunkHash : '',
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
            file_type: meta.fileType === 'code' ? 'code' : 'text',
            content: txt,
            binary_metadata: null,
            content_hash: chunks.length > 0 ? chunks[0].chunkHash : '',
            size_bytes: stat.size,
            last_modified: stat.mtime,
            language: meta.language ?? null,
            metadata: null,
          });
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
            }))
          );
          log(`  → Chunk records inserted`);

          // Generate embeddings using batch processing (much faster!)
          log(`  → Generating ${chunkRecords.length} embeddings...`);
          const texts = chunkRecords.map(r => r.content);

          // Enable chunk-level progress tracking for large files (hybrid approach)
          const LARGE_FILE_THRESHOLD = 1000;
          const embeddingVectors = await embedTexts(
            texts,
            chunkRecords.length > LARGE_FILE_THRESHOLD
              ? (completed, total) => progress?.updateChunkProgress(f, completed, total)
              : undefined
          );

          const embeddings = chunkRecords.map((chunkRecord, idx) => ({
            chunk_id: chunkRecord.id,
            embedding: embeddingVectors[idx]!,
          }));

          await insertEmbeddings(embeddings);
          log(`  ✓ Generated and inserted ${embeddings.length} embeddings`);
        }

        const end = new Date();
        progress?.updateFile(f, chunks.length);
      }
    } catch (e) {
      const errMsg = `Error processing ${f}: ${e}`;

      // Log to error file
      await logProcessingError({
        timestamp: new Date(),
        filePath: f,
        errorType: 'processing_error',
        message: String(e),
        details: {
          error: e instanceof Error ? {
            name: e.name,
            message: e.message,
            stack: e.stack,
          } : e,
        },
      });

      if (progress) {
        progress.error(errMsg);
      } else {
        console.error(errMsg);
      }

      // Continue processing other files
      skippedFiles++;
      progress?.updateFile(f, 0);
    }
  }

  // Finish progress tracking
  progress?.updatePhase('complete', 'Finalizing...');

  // Update repository metadata
  await updateRepository({
    id: repo.id,
    metadata: {
      last_ingested: new Date().toISOString(),
      file_count: discoveredFiles.length,
    },
  });

  progress?.finish();

  if (!progress) {
    console.log(`\n✓ Ingestion complete for repository: ${repo.name}`);
    console.log(`  Total files in repository: ${discoveredFiles.length}`);
    if (isDeltaIngestion) {
      console.log(`  Files processed: ${filesToProcess.length}`);
    }
    if (skippedFiles > 0) {
      console.log(`  Files skipped: ${skippedFiles}`);
    }
  } else if (skippedFiles > 0) {
    // Show skipped files count in progress mode too
    const skipMsg = `\n✓ Processing complete. Files skipped: ${skippedFiles}`;
    progress.log(skipMsg);
  }

  // Show error summary if there were any processing errors
  const errorSummary = await generateErrorSummary();
  if (errorSummary && !errorSummary.includes('No processing errors') && !errorSummary.includes('No error log')) {
    if (progress) {
      progress.log('\n' + errorSummary);
      progress.log('See processing-error.log for detailed error information.');
    } else {
      console.log(errorSummary);
      console.log('See processing-error.log for detailed error information.');
    }
  }
}

if (require.main === module) {
  const root = process.argv[2] || '.';
  processDirectory(path.resolve(root)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
