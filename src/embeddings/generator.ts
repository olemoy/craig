import type { Chunk, Embedding } from './types';
import { embedText } from './pipeline';
import { embedChunks } from './batch';

export async function generateEmbeddingForText(text: string): Promise<Embedding> {
  return embedText(text);
}

export async function generateEmbeddingsForChunks(chunks: Chunk[], onProgress?: (done: number, total: number) => void) {
  return embedChunks(chunks, onProgress);
}
