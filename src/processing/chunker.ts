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

// Symbol extraction patterns - capture symbol names
const SYMBOL_PATTERNS: Record<string, { pattern: RegExp; type: string }[]> = {
  typescript: [
    { pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, type: 'function' },
    { pattern: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/, type: 'class' },
    { pattern: /^(?:export\s+)?interface\s+(\w+)/, type: 'interface' },
    { pattern: /^(?:export\s+)?type\s+(\w+)/, type: 'type' },
    { pattern: /^(?:export\s+)?const\s+(\w+)\s*=/, type: 'variable' },
    { pattern: /^(?:export\s+)?enum\s+(\w+)/, type: 'enum' },
  ],
  javascript: [
    { pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, type: 'function' },
    { pattern: /^(?:export\s+)?class\s+(\w+)/, type: 'class' },
    { pattern: /^(?:export\s+)?const\s+(\w+)\s*=/, type: 'variable' },
  ],
  python: [
    { pattern: /^(?:async\s+)?def\s+(\w+)/, type: 'function' },
    { pattern: /^class\s+(\w+)/, type: 'class' },
  ],
  java: [
    { pattern: /^(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/, type: 'class' },
    { pattern: /^(?:public|private|protected)?\s*interface\s+(\w+)/, type: 'interface' },
    { pattern: /^(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?\w+\s+(\w+)\s*\(/, type: 'method' },
  ],
  kotlin: [
    { pattern: /^(?:suspend\s+)?fun\s+(\w+)/, type: 'function' },
    { pattern: /^(?:data\s+)?class\s+(\w+)/, type: 'class' },
    { pattern: /^interface\s+(\w+)/, type: 'interface' },
    { pattern: /^object\s+(\w+)/, type: 'object' },
  ],
};

interface SymbolInfo {
  symbolName?: string | undefined;
  symbolType?: string | undefined;
}

function extractSymbol(line: string, language: string | null): SymbolInfo {
  if (!language) return {};
  const patterns = SYMBOL_PATTERNS[language];
  if (!patterns) return {};

  for (const { pattern, type } of patterns) {
    const match = line.match(pattern);
    if (match && match[1]) {
      return { symbolName: match[1], symbolType: type };
    }
  }
  return {};
}

function detectChunkType(firstLine: string, language: string | null): string {
  if (!firstLine || !language) return 'code';

  const line = firstLine.toLowerCase();

  if (line.includes('function') || line.includes('def ') || line.includes('fn ') || line.includes('fun ')) {
    return 'function';
  }
  if (line.includes('class ')) return 'class';
  if (line.includes('interface ')) return 'interface';
  if (line.includes('struct ')) return 'struct';
  if (line.includes('enum ')) return 'enum';
  if (line.includes('type ')) return 'type';
  if (line.includes('const ') || line.includes('let ') || line.includes('var ')) {
    return 'variable';
  }

  return 'code';
}

interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
  symbolInfo: SymbolInfo;
  chunkType: string;
}

function chunkCode(text: string, language: string | null, maxTokens: number): CodeChunk[] {
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
  const chunks: CodeChunk[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]!;
    const end = boundaries[i + 1]!;
    const chunkLines = lines.slice(start, end);
    const content = chunkLines.join('\n').trim();

    if (!content) continue;

    const firstLine = chunkLines[0]?.trim() ?? '';
    const symbolInfo = extractSymbol(firstLine, language);
    const chunkType = detectChunkType(firstLine, language);

    const tokens = estimateTokens(content);
    if (tokens <= maxTokens) {
      chunks.push({
        content,
        startLine: start + 1, // 1-indexed
        endLine: end,
        symbolInfo,
        chunkType,
      });
    } else {
      // Split large chunks
      chunks.push(...splitLargeChunk(chunkLines, start, maxTokens, language, symbolInfo));
    }
  }

  return chunks.length > 0 ? chunks : chunkByLines(text, maxTokens);
}

function chunkMarkdown(text: string, maxTokens: number): CodeChunk[] {
  const lines = text.split('\n');
  const chunks: CodeChunk[] = [];
  const sections: { start: number; end: number; heading: string }[] = [];

  // Find headings
  let currentStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
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

    const firstLine = sectionLines[0] ?? '';
    const headingMatch = firstLine.match(/^(#{1,6})\s+(.+)$/);
    const symbolInfo: SymbolInfo = headingMatch
      ? { symbolName: headingMatch[2]?.trim(), symbolType: `h${headingMatch[1]?.length}` }
      : {};

    const tokens = estimateTokens(content);
    if (tokens <= maxTokens) {
      chunks.push({
        content,
        startLine: section.start + 1,
        endLine: section.end,
        symbolInfo,
        chunkType: 'section',
      });
    } else {
      // Split on paragraphs
      const paragraphs = content.split(/\n\n+/);
      let current = '';
      let lineStart = section.start + 1;
      for (const para of paragraphs) {
        const test = current + (current ? '\n\n' : '') + para;
        if (estimateTokens(test) > maxTokens && current) {
          const lineCount = current.split('\n').length;
          chunks.push({
            content: current,
            startLine: lineStart,
            endLine: lineStart + lineCount - 1,
            symbolInfo,
            chunkType: 'section',
          });
          lineStart += lineCount;
          current = para;
        } else {
          current = test;
        }
      }
      if (current) {
        chunks.push({
          content: current,
          startLine: lineStart,
          endLine: section.end,
          symbolInfo,
          chunkType: 'section',
        });
      }
    }
  }

  return chunks.length > 0 ? chunks : chunkByLines(text, maxTokens);
}

function splitLargeChunk(
  lines: string[],
  baseLineNumber: number,
  maxTokens: number,
  language: string | null,
  symbolInfo?: SymbolInfo
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let current: string[] = [];
  let currentStartLine = baseLineNumber;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    current.push(line);
    const content = current.join('\n');

    if (estimateTokens(content) >= maxTokens) {
      if (current.length > 1) {
        current.pop();
        chunks.push({
          content: current.join('\n').trim(),
          startLine: currentStartLine + 1,
          endLine: currentStartLine + current.length,
          symbolInfo: symbolInfo ?? {},
          chunkType: 'code',
        });
        currentStartLine = baseLineNumber + i;
        current = [line];
      } else {
        chunks.push({
          content: content.trim(),
          startLine: currentStartLine + 1,
          endLine: currentStartLine + 1,
          symbolInfo: symbolInfo ?? {},
          chunkType: 'code',
        });
        currentStartLine = baseLineNumber + i + 1;
        current = [];
      }
    }
  }

  if (current.length > 0) {
    chunks.push({
      content: current.join('\n').trim(),
      startLine: currentStartLine + 1,
      endLine: baseLineNumber + lines.length,
      symbolInfo: symbolInfo ?? {},
      chunkType: 'code',
    });
  }

  return chunks;
}

function chunkByLines(text: string, maxTokens: number): CodeChunk[] {
  const lines = text.split('\n');
  return splitLargeChunk(lines, 0, maxTokens, null);
}

export function chunkText(
  filePath: string,
  text: string,
  opts: {tokenTarget: number; overlapTokens: number; language?: string | null}
): ChunkRecord[] {
  const maxTokens = opts.tokenTarget;
  const overlapTokens = opts.overlapTokens;
  const ext = filePath.split('.').pop()?.toLowerCase();

  // Determine chunking strategy
  let codeChunks: CodeChunk[];
  if (ext === 'md' || ext === 'markdown') {
    codeChunks = chunkMarkdown(text, maxTokens);
  } else if (ext === 'json') {
    // JSON: try to keep as single chunk if reasonable
    if (estimateTokens(text) <= maxTokens) {
      const lines = text.split('\n');
      codeChunks = [{
        content: text,
        startLine: 1,
        endLine: lines.length,
        symbolInfo: {},
        chunkType: 'code',
      }];
    } else {
      codeChunks = chunkByLines(text, maxTokens);
    }
  } else {
    codeChunks = chunkCode(text, opts.language, maxTokens);
  }

  // Convert to ChunkRecord format with overlap
  const chunks: ChunkRecord[] = [];
  let charOffset = 0;

  for (let i = 0; i < codeChunks.length; i++) {
    const codeChunk = codeChunks[i]!;
    const chunkText = codeChunk.content;

    // Find actual position in original text
    const startChar = text.indexOf(chunkText, charOffset);
    const endChar = startChar + chunkText.length;

    // Calculate overlap: if not first chunk, include overlap tokens from end of previous chunk
    let actualChunkText = chunkText;
    let actualOverlap = 0;

    if (i > 0 && overlapTokens > 0) {
      const prevChunk = codeChunks[i - 1]!;
      const prevContent = prevChunk.content;
      const prevTokens = estimateTokens(prevContent);

      // Calculate how many characters to include from previous chunk
      const overlapChars = Math.floor((prevContent.length * overlapTokens) / prevTokens);
      const overlapText = prevContent.slice(-overlapChars);

      actualChunkText = overlapText + '\n' + chunkText;
      actualOverlap = estimateTokens(overlapText);
    }

    charOffset = endChar;

    // Simple hash without normalize() - much faster!
    const chunkHash = sha256Hex((opts.language || '') + '\u0000' + actualChunkText);
    const startToken = estimateTokens(text.slice(0, startChar));
    const endToken = estimateTokens(text.slice(0, endChar));

    chunks.push({
      filePath,
      chunkHash,
      text: actualChunkText,
      startChar: startChar >= 0 ? startChar : 0,
      endChar: endChar > 0 ? endChar : chunkText.length,
      startToken,
      endToken,
      startLine: codeChunk.startLine,
      endLine: codeChunk.endLine,
      overlapFromPrev: actualOverlap,
      language: opts.language ?? null,
      symbolName: codeChunk.symbolInfo.symbolName ?? null,
      symbolType: codeChunk.symbolInfo.symbolType ?? null,
      chunkType: codeChunk.chunkType,
    });
  }

  return chunks;
}
