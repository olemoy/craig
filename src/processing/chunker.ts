import {sha256Hex} from './hasher';
import {ChunkRecord} from './types';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Code boundary patterns for different languages
const CODE_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /^(export\s+)?(async\s+)?function\s+\w+/,
    /^(export\s+)?(abstract\s+)?class\s+\w+/,
    /^(export\s+)?interface\s+\w+/,
    /^(export\s+)?type\s+\w+/,
    /^(export\s+)?const\s+\w+\s*=/,
    /^(export\s+)?enum\s+\w+/,
  ],
  javascript: [
    /^(export\s+)?(async\s+)?function\s+\w+/,
    /^(export\s+)?class\s+\w+/,
    /^(export\s+)?const\s+\w+\s*=/,
    /^(module\.exports|exports)\s*[.=]/,
  ],
  python: [
    /^(async\s+)?def\s+\w+/,
    /^class\s+\w+/,
    /^@\w+/,
  ],
  java: [
    /^(public|private|protected)?\s*(static\s+)?(abstract\s+)?(final\s+)?class\s+\w+/,
    /^(public|private|protected)?\s*(static\s+)?(final\s+)?\w+\s+\w+\s*\(/,
    /^(public|private|protected)?\s*interface\s+\w+/,
  ],
  kotlin: [
    /^(fun|suspend\s+fun)\s+\w+/,
    /^(data\s+)?class\s+\w+/,
    /^interface\s+\w+/,
    /^object\s+\w+/,
  ],
};

function chunkCode(text: string, language: string | null, maxTokens: number): string[] {
  const lines = text.split('\n');
  const patterns = language ? CODE_PATTERNS[language] || [] : [];

  if (patterns.length === 0) {
    // Fall back to line-based chunking
    return chunkByLines(text, maxTokens);
  }

  // Find function/class boundaries
  const boundaries: number[] = [0];
  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i]?.trim() ?? '';
    if (trimmed && patterns.some(p => p.test(trimmed))) {
      boundaries.push(i);
    }
  }
  boundaries.push(lines.length);

  // Create chunks from boundaries
  const chunks: string[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]!;
    const end = boundaries[i + 1]!;
    const chunkLines = lines.slice(start, end);
    const content = chunkLines.join('\n').trim();

    if (!content) continue;

    const tokens = estimateTokens(content);
    if (tokens <= maxTokens) {
      chunks.push(content);
    } else {
      // Split large chunks
      chunks.push(...splitLargeChunk(chunkLines, maxTokens));
    }
  }

  return chunks.length > 0 ? chunks : chunkByLines(text, maxTokens);
}

function chunkMarkdown(text: string, maxTokens: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  const sections: { start: number; end: number; heading: string }[] = [];

  // Find headings
  let currentStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.match(/^#{1,6}\s+.+$/)) {
      if (i > currentStart) {
        sections.push({ start: currentStart, end: i, heading: '' });
      }
      currentStart = i;
    }
  }
  sections.push({ start: currentStart, end: lines.length, heading: '' });

  // Create chunks from sections
  for (const section of sections) {
    const sectionLines = lines.slice(section.start, section.end);
    const content = sectionLines.join('\n').trim();

    if (!content) continue;

    const tokens = estimateTokens(content);
    if (tokens <= maxTokens) {
      chunks.push(content);
    } else {
      // Split on paragraphs
      const paragraphs = content.split(/\n\n+/);
      let current = '';
      for (const para of paragraphs) {
        const test = current + (current ? '\n\n' : '') + para;
        if (estimateTokens(test) > maxTokens && current) {
          chunks.push(current);
          current = para;
        } else {
          current = test;
        }
      }
      if (current) chunks.push(current);
    }
  }

  return chunks.length > 0 ? chunks : chunkByLines(text, maxTokens);
}

function splitLargeChunk(lines: string[], maxTokens: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    current.push(line);
    if (estimateTokens(current.join('\n')) >= maxTokens) {
      if (current.length > 1) {
        current.pop();
        chunks.push(current.join('\n').trim());
        current = [line];
      } else {
        chunks.push(current.join('\n').trim());
        current = [];
      }
    }
  }

  if (current.length > 0) {
    chunks.push(current.join('\n').trim());
  }

  return chunks;
}

function chunkByLines(text: string, maxTokens: number): string[] {
  const lines = text.split('\n');
  return splitLargeChunk(lines, maxTokens);
}

export function chunkText(
  filePath: string,
  text: string,
  opts: {tokenTarget: number; overlapTokens: number; language?: string | null}
): ChunkRecord[] {
  const maxTokens = opts.tokenTarget;
  const ext = filePath.split('.').pop()?.toLowerCase();

  // Determine chunking strategy
  let textChunks: string[];
  if (ext === 'md' || ext === 'markdown') {
    textChunks = chunkMarkdown(text, maxTokens);
  } else if (ext === 'json') {
    // JSON: try to keep as single chunk if reasonable
    if (estimateTokens(text) <= maxTokens) {
      textChunks = [text];
    } else {
      textChunks = chunkByLines(text, maxTokens);
    }
  } else {
    textChunks = chunkCode(text, opts.language, maxTokens);
  }

  // Convert to ChunkRecord format with overlap
  const chunks: ChunkRecord[] = [];
  let charOffset = 0;

  for (let i = 0; i < textChunks.length; i++) {
    const chunkText = textChunks[i]!;

    // Find actual position in original text (simple approach)
    const startChar = text.indexOf(chunkText, charOffset);
    const endChar = startChar + chunkText.length;
    charOffset = endChar;

    // Simple hash without normalize() - much faster!
    const chunkHash = sha256Hex((opts.language || '') + '\u0000' + chunkText);
    const startToken = estimateTokens(text.slice(0, startChar));
    const endToken = estimateTokens(text.slice(0, endChar));

    chunks.push({
      filePath,
      chunkHash,
      text: chunkText,
      startChar: startChar >= 0 ? startChar : 0,
      endChar: endChar > 0 ? endChar : chunkText.length,
      startToken,
      endToken,
      overlapFromPrev: 0, // Simplified - no overlap for code chunks
      language: opts.language ?? null,
    });
  }

  return chunks;
}
