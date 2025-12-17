import type { Chunk, Embedding } from './types';
import { embedText } from './pipeline';

export type BatchOptions = {
  batchSize?: number;
  concurrentBatches?: number;
  retries?: number;
};

export async function embedChunks(chunks: Chunk[], onProgress?: (completed: number, total: number) => void, opts?: BatchOptions): Promise<Record<string, Embedding>> {
  const options = { batchSize: 20, concurrentBatches: 2, retries: 3, ...opts };
  const embeddable = chunks.filter(c => c.file.type === 'text' || c.file.type === 'code');
  const total = embeddable.length;
  const out: Record<string, Embedding> = {};
  let completed = 0;

  const batches: Chunk[][] = [];
  for (let i = 0; i < embeddable.length; i += options.batchSize) {
    batches.push(embeddable.slice(i, i + options.batchSize));
  }

  async function processBatch(batch: Chunk[]) {
    for (const chunk of batch) {
      let attempts = 0;
      while (attempts < (options.retries ?? 1)) {
        try {
          const vec = await embedText(chunk.text);
          out[chunk.id] = vec;
          completed++;
          onProgress?.(completed, total);
          break;
        } catch (e) {
          attempts++;
          if (attempts >= (options.retries ?? 1)) throw e;
        }
      }
    }
  }

  for (let i = 0; i < batches.length; i += options.concurrentBatches) {
    const slice = batches.slice(i, i + options.concurrentBatches);
    await Promise.all(slice.map(b => processBatch(b)));
  }

  return out;
}
