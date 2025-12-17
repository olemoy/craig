# ADR-003: Embedding Strategy with Transformers.js

## Status
Proposed

## Context
CRAIG requires efficient semantic search over code and documentation. Need to balance:
- Model quality vs speed
- Memory footprint vs performance
- Local execution vs API dependencies

## Decision
Use Transformers.js with Xenova/all-MiniLM-L6-v2 model for local embedding generation.

## Rationale

### Model Selection: all-MiniLM-L6-v2
- **Dimensions**: 384 (good balance of quality/size)
- **Performance**: Fast inference, suitable for local execution
- **Quality**: Strong general-purpose semantic understanding
- **Size**: ~23MB model, manageable for local storage
- **License**: Apache 2.0, commercial-friendly

### Transformers.js Benefits
- Pure JavaScript implementation
- No Python dependencies
- Works with Bun runtime
- Automatic model caching
- WebAssembly-accelerated inference

## Implementation Details

### Model Initialization
```typescript
import { pipeline } from '@xenova/transformers';

// Lazy-load embedding pipeline
let embeddingPipeline: any = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return embeddingPipeline;
}
```

### Embedding Generation
```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const pipeline = await getEmbeddingPipeline();

  // Generate embedding
  const output = await pipeline(text, {
    pooling: 'mean',
    normalize: true
  });

  // Extract float array
  return Array.from(output.data);
}
```

### Batch Processing
```typescript
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const pipeline = await getEmbeddingPipeline();
  const BATCH_SIZE = 20;
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await Promise.all(
      batch.map(text => generateEmbedding(text))
    );
    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}
```

### Model Caching
- Default cache: `~/.cache/huggingface/transformers/`
- Configurable via `HF_HOME` environment variable
- First run downloads model (~23MB)
- Subsequent runs use cached model

## Performance Characteristics

### Speed
- Single embedding: ~10-50ms (CPU-dependent)
- Batch of 20: ~200-500ms
- Recommended: Process in batches for efficiency

### Memory
- Model: ~23MB
- Per-embedding overhead: ~1.5KB (384 floats)
- Batch processing: ~5-10MB working memory

## Alternatives Considered

### OpenAI/Cohere APIs
- Pros: Higher quality, larger context windows
- Cons: External dependencies, cost, latency, privacy concerns
- Rejected: Violates "local-first" principle

### Sentence-Transformers (Python)
- Pros: Battle-tested, extensive model options
- Cons: Requires Python runtime, complex deployment
- Rejected: Adds runtime dependency

### all-mpnet-base-v2
- Pros: Better quality than MiniLM
- Cons: Larger model (~420MB), slower inference
- Rejected: Size/speed trade-off not worth marginal quality gain

## Future Considerations
- Support for multi-lingual models if needed
- Code-specific models (e.g., CodeBERT) as optional enhancement
- Incremental embedding updates for changed files
