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
  overlapFromPrev: number;
  language?: string | null; // File extension (e.g., '.py', '.sql')
}
