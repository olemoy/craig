# Workpackage 3: Embedding Generation Engine

## Objective
Implement embedding generation using Transformers.js with all-MiniLM-L6-v2 model. Process text/code chunks only, skip binary files.

## Acceptance Criteria
1. Transformers.js pipeline initialized with all-MiniLM-L6-v2
2. Single and batch embedding generation functions
3. Model caching and lazy loading
4. Normalization of embedding vectors
5. Progress tracking for batch operations
6. Error handling and retry logic
7. Integration with database layer for storage
8. Memory-efficient processing of large batches
9. Skip embedding generation for binary files
10. Full test coverage with mock model

## Key Files to Create
- `src/embeddings/generator.ts` - Core embedding generation
- `src/embeddings/pipeline.ts` - Transformers.js pipeline management
- `src/embeddings/batch.ts` - Batch processing logic
- `src/embeddings/cache.ts` - Model and embedding caching
- `src/embeddings/types.ts` - Embedding-related types
- `src/embeddings/config.ts` - Model configuration

## Dependencies
**Required packages:**
```json
{
  "@xenova/transformers": "^2.17.0"
}
```

## Model Configuration
```typescript
{
  modelId: 'Xenova/all-MiniLM-L6-v2',
  dimensions: 384,
  pooling: 'mean',
  normalize: true
}
```

## Batch Processing
- Default batch size: 20 chunks
- Concurrent batches: 2
- Retry attempts: 3
- Memory efficient processing

## Binary File Handling
```typescript
// Explicitly skip binary files
const embeddableChunks = chunks.filter(c =>
  c.file.type === 'text' || c.file.type === 'code'
);
```

## Testing
- Embedding generation with real model
- Verify 384 dimensions
- Batch processing efficiency
- Binary files completely skipped

## Dependencies
- WP1 (Database) for storing embeddings
- WP2 (File Processing) for receiving chunks

## Provides To
- WP4 (CLI) embedding functionality
- WP5 (MCP) search functionality
