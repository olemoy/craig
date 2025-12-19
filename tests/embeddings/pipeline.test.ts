/**
 * Tests for embedding generation pipeline
 * Tests text embedding and dimension validation
 */

import { describe, it, expect } from 'bun:test';
import { embedText, embedTexts } from '../../src/embeddings/pipeline.js';

describe('Embedding Pipeline - Single Text', () => {
  it('should generate embedding for simple text', async () => {
    const text = 'Hello, world!';
    const embedding = await embedText(text);

    expect(embedding).toBeInstanceOf(Array);
    expect(embedding.length).toBe(384); // Default dimension
    expect(embedding.every(n => typeof n === 'number')).toBe(true);
  });

  it('should generate embedding for code snippet', async () => {
    const code = 'function hello() { return "world"; }';
    const embedding = await embedText(code);

    expect(embedding.length).toBe(384);
    expect(embedding.every(n => typeof n === 'number')).toBe(true);
  });

  it('should generate embedding for long text', async () => {
    const longText = 'word '.repeat(1000);
    const embedding = await embedText(longText);

    expect(embedding.length).toBe(384);
    expect(embedding.every(n => typeof n === 'number')).toBe(true);
  });

  it('should handle empty string', async () => {
    const embedding = await embedText('');

    expect(embedding.length).toBe(384);
    expect(embedding.every(n => typeof n === 'number')).toBe(true);
  });

  it('should handle special characters', async () => {
    const text = '!@#$%^&*()_+-={}[]|:;"<>,.?/~`';
    const embedding = await embedText(text);

    expect(embedding.length).toBe(384);
  });

  it('should handle unicode characters', async () => {
    const text = 'こんにちは世界 🌍 مرحبا العالم';
    const embedding = await embedText(text);

    expect(embedding.length).toBe(384);
  });

  it('should generate different embeddings for different text', async () => {
    const emb1 = await embedText('authentication logic');
    const emb2 = await embedText('database connection');

    // Embeddings should be different
    const similarity = cosineSimilarity(emb1, emb2);
    expect(similarity).toBeLessThan(0.99);
  });

  it('should generate similar embeddings for similar text', async () => {
    const emb1 = await embedText('user authentication');
    const emb2 = await embedText('authenticate user');

    const similarity = cosineSimilarity(emb1, emb2);
    expect(similarity).toBeGreaterThan(0.7); // Should be fairly similar
  });

  it('should generate valid floating point numbers', async () => {
    const embedding = await embedText('test');

    embedding.forEach(value => {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
    });
  });

  it('should handle newlines and whitespace', async () => {
    const text = '  \n\n  Hello  \t\t World  \n  ';
    const embedding = await embedText(text);

    expect(embedding.length).toBe(384);
  });
});

describe('Embedding Pipeline - Batch Processing', () => {
  it('should generate embeddings for multiple texts', async () => {
    const texts = ['Hello', 'World', 'CRAIG'];
    const embeddings = await embedTexts(texts);

    expect(embeddings.length).toBe(3);
    embeddings.forEach(emb => {
      expect(emb.length).toBe(384);
    });
  });

  it('should handle empty batch', async () => {
    const embeddings = await embedTexts([]);
    expect(embeddings.length).toBe(0);
  });

  it('should handle single item batch', async () => {
    const embeddings = await embedTexts(['test']);

    expect(embeddings.length).toBe(1);
    expect(embeddings[0].length).toBe(384);
  });

  it('should handle large batch', async () => {
    const texts = Array.from({ length: 100 }, (_, i) => `text ${i}`);
    const embeddings = await embedTexts(texts);

    expect(embeddings.length).toBe(100);
    embeddings.forEach(emb => {
      expect(emb.length).toBe(384);
    });
  });

  it('should maintain order in batch processing', async () => {
    const texts = ['first', 'second', 'third'];
    const embeddings = await embedTexts(texts);

    // Generate individual embeddings for comparison
    const emb1 = await embedText('first');
    const emb2 = await embedText('second');
    const emb3 = await embedText('third');

    // Order should be preserved
    expect(cosineSimilarity(embeddings[0], emb1)).toBeGreaterThan(0.99);
    expect(cosineSimilarity(embeddings[1], emb2)).toBeGreaterThan(0.99);
    expect(cosineSimilarity(embeddings[2], emb3)).toBeGreaterThan(0.99);
  });

  it('should handle batch with mixed content', async () => {
    const texts = [
      'Short',
      'A much longer piece of text that contains many more words',
      '',
      'Special chars: !@#$%',
      '日本語',
    ];
    const embeddings = await embedTexts(texts);

    expect(embeddings.length).toBe(5);
    embeddings.forEach(emb => {
      expect(emb.length).toBe(384);
    });
  });
});

describe('Embedding Pipeline - Error Handling', () => {
  it('should handle null input gracefully', async () => {
    await expect(embedText(null as any)).rejects.toThrow();
  });

  it('should handle undefined input gracefully', async () => {
    await expect(embedText(undefined as any)).rejects.toThrow();
  });

  it('should handle non-string input', async () => {
    await expect(embedText(123 as any)).rejects.toThrow();
    await expect(embedText({} as any)).rejects.toThrow();
    await expect(embedText([] as any)).rejects.toThrow();
  });

  it('should handle batch with null items', async () => {
    await expect(embedTexts([null as any])).rejects.toThrow();
  });

  it('should handle batch with undefined items', async () => {
    await expect(embedTexts([undefined as any])).rejects.toThrow();
  });
});

describe('Embedding Pipeline - Performance', () => {
  it('should generate embedding in reasonable time', async () => {
    const start = Date.now();
    await embedText('test performance');
    const elapsed = Date.now() - start;

    // Should complete within 5 seconds (generous for first load)
    expect(elapsed).toBeLessThan(5000);
  });

  it('should batch process faster than sequential', async () => {
    const texts = Array.from({ length: 10 }, (_, i) => `text ${i}`);

    // Batch processing
    const batchStart = Date.now();
    await embedTexts(texts);
    const batchTime = Date.now() - batchStart;

    // Sequential processing (only do 5 to save time)
    const seqStart = Date.now();
    for (let i = 0; i < 5; i++) {
      await embedText(texts[i]);
    }
    const seqTime = Date.now() - seqStart;

    // Batch should be more efficient (even comparing 10 batch vs 5 sequential)
    const estimatedSeqForAll = (seqTime / 5) * 10;
    expect(batchTime).toBeLessThan(estimatedSeqForAll);
  });
});

describe('Embedding Pipeline - Normalization', () => {
  it('should produce normalized vectors', async () => {
    const embedding = await embedText('normalize test');

    // Calculate magnitude
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );

    // Should be approximately 1.0 (normalized)
    expect(magnitude).toBeGreaterThan(0.99);
    expect(magnitude).toBeLessThan(1.01);
  });

  it('should produce vectors in expected range', async () => {
    const embedding = await embedText('range test');

    // Values should typically be in [-1, 1] range for normalized vectors
    embedding.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(-1.5);
      expect(value).toBeLessThanOrEqual(1.5);
    });
  });
});

// Helper function for cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dotProduct / (magA * magB);
}
