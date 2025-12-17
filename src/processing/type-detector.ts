import fs from 'fs';
import path from 'path';
import {FileType} from './types';

const CODE_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.go': 'go', '.rs': 'rust',
  '.java': 'java', '.cpp': 'cpp', '.c': 'c'
};

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml']);
const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Archives
  '.zip', '.tar', '.gz', '.rar', '.7z',
  // Executables
  '.exe', '.dll', '.so', '.dylib',
  // Media
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
  // Fonts
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
]);

export async function detectFileType(filePath: string): Promise<{fileType: FileType; language?: string | null}> {
  const ext = path.extname(filePath).toLowerCase();
  if (CODE_EXTENSIONS[ext]) return {fileType: 'code', language: CODE_EXTENSIONS[ext]};
  if (TEXT_EXTENSIONS.has(ext)) return {fileType: 'text', language: null};
  if (BINARY_EXTENSIONS.has(ext)) return {fileType: 'binary', language: null};

  // Fallback: read a chunk and test for non-text bytes
  try {
    const fd = await fs.promises.open(filePath, 'r');
    const {buffer} = await fd.read(Buffer.alloc(512), 0, 512, 0);
    await fd.close();
    const isText = buffer.every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126));
    return {fileType: isText ? 'text' : 'binary', language: null};
  } catch (e) {
    return {fileType: 'binary', language: null};
  }
}
