import path from 'path';
import {discoverFiles} from './discovery';
import {detectFileType} from './type-detector';
import {readTextFile} from './text-processor';
import {processBinary} from './binary-processor';
import {chunkText} from './chunker';
import {DEFAULT_CONFIG} from './config';

export async function processDirectory(root: string) {
  const files = await discoverFiles(root);
  const fmtTime = (d: Date) => d.toTimeString().split(' ')[0];
  for (const f of files) {
    try {
      const start = new Date();
      console.log(`[${fmtTime(start)}] Starting file: ${f}`);
      const meta = await detectFileType(f);
      if (meta.fileType === 'binary') {
        const bin = await processBinary(f);
        const end = new Date();
        console.log(`[${fmtTime(end)}] Finished binary: ${f} size=${bin.size} hash=${bin.hash}`);
      } else {
        const txt = await readTextFile(f);
        // Rough estimate: tokens ~ chars / avgCharsPerToken
        const approxCharsPerToken = 4;
        const estChunks = Math.max(1, Math.ceil(txt.length / (DEFAULT_CONFIG.tokenTarget * approxCharsPerToken)));
        console.log(`[${fmtTime(new Date())}] Estimated chunks: ~${estChunks}`);
        const chunks = chunkText(f, txt, {tokenTarget: DEFAULT_CONFIG.tokenTarget, overlapTokens: DEFAULT_CONFIG.overlapTokens, language: meta.language ?? null});
        const end = new Date();
        console.log(`[${fmtTime(end)}] Finished text: ${f} chunks=${chunks.length}`);
      }
    } catch (e) {
      console.error('error processing', f, e);
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
