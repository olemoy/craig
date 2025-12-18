export type FileType = 'code' | 'text' | 'binary';

export interface FileRecord {
  path: string;
  size: number;
  mtimeMs: number;
  fileType: FileType;
  language?: string | null; // File extension (e.g., '.py', '.sql')
  mime?: string | null;
}

export interface ChunkRecord {
  filePath: string;
  chunkHash: string;
  text: string;
  startChar: number;
  endChar: number;
  startToken: number;
  endToken: number;
  startLine: number;
  endLine: number;
  overlapFromPrev: number;
  language?: string | null; // File extension (e.g., '.py', '.sql')
  symbolName?: string | null; // Name of function/class/interface extracted from chunk
  symbolType?: string | null; // Type: 'function', 'class', 'interface', 'type', etc.
  chunkType: string; // Semantic type: 'function', 'class', 'interface', 'type', 'variable', 'code', 'section'
}
