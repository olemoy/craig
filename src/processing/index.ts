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

export async function processDirectory(root: string, repoName?: string, opts?: { verbose?: boolean }) {
  const fmtTime = (d: Date) => d.toTimeString().split(' ')[0];
  const verbose = opts?.verbose ?? false;
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
    console.log(`Created repository: ${repo.name} (id: ${repo.id})`);
  } else {
    console.log(`Existing repository found: ${repo.name} (id: ${repo.id})`);
    console.log(`Performing delta ingestion (only processing changes)...\n`);
    isDeltaIngestion = true;
  }

  const discoveredFiles = await discoverFiles(root);

  // Analyze what changed
  let filesToProcess: string[] = discoveredFiles;

  if (isDeltaIngestion) {
    const delta = await analyzeDelta(repo, discoveredFiles);

    console.log(`Delta Analysis:`);
    console.log(`  📄 Unchanged: ${delta.unchanged.length}`);
    console.log(`  ✏️  Modified:  ${delta.toUpdate.length}`);
    console.log(`  ➕ New:       ${delta.toAdd.length}`);
    console.log(`  ➖ Deleted:   ${delta.toDelete.length}\n`);

    // Delete removed files
    for (const file of delta.toDelete) {
      console.log(`[${fmtTime(new Date())}] Deleting: ${file.file_path}`);
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
      console.log('✓ Repository is up to date, no changes detected.');
      await updateRepository({
        id: repo.id,
        metadata: { last_checked: new Date().toISOString() },
      });
      return;
    }

    console.log(`Processing ${filesToProcess.length} changed files...\n`);
  }

  const files = filesToProcess;

  for (const f of files) {
    try {
      const start = new Date();
      const meta = await detectFileType(f);
      const stat = await fs.promises.stat(f);

      if (meta.fileType === 'binary') {
        console.log(`[${fmtTime(start)}] Processing: ${f} (binary)`);
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
        console.log(`[${fmtTime(end)}] Finished: ${f} (binary, ${Math.round(bin.size / 1024)}KB)`);
      } else {
        const txt = await readTextFile(f);
        console.log(`[${fmtTime(start)}] Processing: ${f}`);

        log(`  → Chunking text...`);
        const chunks = chunkText(f, txt, {
          tokenTarget: DEFAULT_CONFIG.tokenTarget,
          overlapTokens: DEFAULT_CONFIG.overlapTokens,
          language: meta.language ?? null
        });
        log(`  → Created ${chunks.length} chunks`);

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
          const embeddingVectors = await embedTexts(texts);

          const embeddings = chunkRecords.map((chunkRecord, idx) => ({
            chunk_id: chunkRecord.id,
            embedding: embeddingVectors[idx]!,
          }));

          await insertEmbeddings(embeddings);
          log(`  ✓ Generated and inserted ${embeddings.length} embeddings`);
        }

        const end = new Date();
        console.log(`[${fmtTime(end)}] Finished: ${f} - chunks:${chunks.length}`);
      }
    } catch (e) {
      console.error('error processing', f, e);
    }
  }

  // Update repository metadata
  await updateRepository({
    id: repo.id,
    metadata: {
      last_ingested: new Date().toISOString(),
      file_count: discoveredFiles.length,
    },
  });

  console.log(`\n✓ Ingestion complete for repository: ${repo.name}`);
  console.log(`  Total files in repository: ${discoveredFiles.length}`);
  if (isDeltaIngestion) {
    console.log(`  Files processed: ${filesToProcess.length}`);
  }
}

if (require.main === module) {
  const root = process.argv[2] || '.';
  processDirectory(path.resolve(root)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
