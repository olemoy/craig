import path from 'path';
import {discoverFiles} from './discovery';
import {detectFileType} from './type-detector';
import {readTextFile} from './text-processor';
import {processBinary} from './binary-processor';
import {chunkText} from './chunker';
import {DEFAULT_CONFIG} from './config';

export async function processDirectory(root: string) {
  const files = await discoverFiles(root);
  for (const f of files) {
    try {
      const meta = await detectFileType(f);
      if (meta.fileType === 'binary') {
        const bin = await processBinary(f);
        console.log('binary', f, bin.size, bin.hash);
      } else {
        const txt = await readTextFile(f);
        const chunks = chunkText(f, txt, {tokenTarget: DEFAULT_CONFIG.tokenTarget, overlapTokens: DEFAULT_CONFIG.overlapTokens, language: meta.language ?? null});
        console.log('text', f, 'chunks', chunks.length);
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
