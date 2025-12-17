# Future Possibilities

This document tracks potential enhancements and improvements for CRAIG that could be implemented in the future.

## Ollama Integration for Embeddings

### Current State
CRAIG currently uses transformers.js with the `Xenova/all-MiniLM-L6-v2` model for generating embeddings. This runs on CPU and produces 384-dimensional vectors.

### Opportunity
Integrate Ollama as an alternative embedding provider to improve performance and flexibility.

### Benefits

1. **GPU Acceleration**
   - Significantly faster embedding generation if GPU is available
   - Better throughput for batch processing
   - Can reduce ingestion time from hours to minutes for large codebases

2. **Better Model Options**
   - `nomic-embed-text` (768 dimensions) - Excellent for code and text
   - `mxbai-embed-large` (1024 dimensions) - High quality embeddings
   - `all-minilm` (384 dimensions) - Compatible with current schema
   - Easy to switch between models for different use cases

3. **Shared Infrastructure**
   - Leverage existing Ollama installations
   - Consistent with other local AI tooling
   - Better resource management across tools

4. **Parallel Processing**
   - Ollama handles concurrent requests efficiently
   - Can process multiple chunks simultaneously
   - Better suited for large-scale ingestion

### Implementation Considerations

#### 1. Configuration
Add environment variables or config file settings:
```bash
CRAIG_EMBEDDING_PROVIDER=ollama  # or 'transformers' (default)
CRAIG_OLLAMA_ENDPOINT=http://localhost:11434
CRAIG_OLLAMA_MODEL=nomic-embed-text
```

#### 2. Vector Dimensions
Different models produce different vector dimensions:
- Current: `all-MiniLM-L6-v2` = 384 dimensions
- Ollama `nomic-embed-text` = 768 dimensions
- Ollama `mxbai-embed-large` = 1024 dimensions

**Required changes:**
- Make vector dimension configurable in database schema
- Store dimension metadata with repository
- Validate dimension consistency when querying
- Migration strategy for existing data if changing models

#### 3. Architecture
```typescript
// Proposed abstraction layer
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}

class TransformersProvider implements EmbeddingProvider { ... }
class OllamaProvider implements EmbeddingProvider { ... }
```

#### 4. Fallback Strategy
- Primary: Use configured provider (Ollama or transformers)
- Fallback: If Ollama unavailable, fall back to transformers.js
- Validation: Check endpoint health before starting ingestion

#### 5. Migration Path
For users with existing data:
1. Option A: Re-ingest with new model (clean slate)
2. Option B: Support multiple embedding models per repository with model metadata
3. Option C: Provide migration tool to re-embed existing chunks

### Performance Expectations

Based on typical hardware:

**Current (transformers.js on CPU):**
- ~2-5 chunks/second
- 282 files with ~500 chunks = 2-4 minutes

**With Ollama (GPU):**
- ~50-100 chunks/second (estimated)
- 282 files with ~500 chunks = 10-30 seconds

**With Ollama (CPU):**
- ~10-20 chunks/second
- 282 files with ~500 chunks = 30-60 seconds

### Next Steps

1. Prototype Ollama adapter implementation
2. Benchmark performance with different models
3. Design configuration schema
4. Implement provider abstraction layer
5. Add tests for both providers
6. Document setup and migration guide
7. Add CLI flag for choosing provider during ingestion

### Related Issues
- Embedding generation is currently the bottleneck in ingestion (WP1-4 implementation)
- Need configurable vector dimensions in schema
- Consider batch embedding optimization

### References
- Ollama API docs: https://github.com/ollama/ollama/blob/main/docs/api.md
- Nomic Embed Text: https://ollama.com/library/nomic-embed-text
- Current implementation: `src/embeddings/pipeline.ts`
