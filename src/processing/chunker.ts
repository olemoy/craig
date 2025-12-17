import {sha256Hex} from './hasher';
import {ChunkRecord} from './types';

function approxTokensFromChars(chars: number) {
  return Math.max(1, Math.floor(chars / 4));
}

export function chunkText(filePath: string, text: string, opts: {tokenTarget: number; overlapTokens: number; language?: string | null}): ChunkRecord[] {
  const chunks: ChunkRecord[] = [];
  const targetChars = opts.tokenTarget * 4; // heuristic
  const overlapChars = opts.overlapTokens * 4;
  let start = 0;
  const len = text.length;
  while (start < len) {
    let end = Math.min(len, start + targetChars);
    // try to break at last double newline for prose
    if (end < len) {
      const idx = text.lastIndexOf('\n\n', end);
      if (idx > start) end = idx + 2;
    }
    const chunkText = text.slice(start, end);
    const chunkHash = sha256Hex((opts.language || '') + '\u0000' + chunkText.normalize('NFC'));
    const startToken = approxTokensFromChars(start);
    const endToken = approxTokensFromChars(end);
    const overlapFromPrev = chunks.length === 0 ? 0 : opts.overlapTokens;
    chunks.push({
      filePath,
      chunkHash,
      text: chunkText,
      startChar: start,
      endChar: end,
      startToken,
      endToken,
      overlapFromPrev,
      language: opts.language ?? null,
    });
    if (end === len) break;
    start = Math.max(0, end - overlapChars);
  }
  return chunks;
}
