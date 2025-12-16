# Workpackage 1: Database Foundation & Schema

## Objective
Implement the PGlite database layer with pgvector support, schema setup, and core database operations.

## Acceptance Criteria
1. PGlite database initialized with proper configuration
2. Schema created per ADR-001 (repositories, files, chunks, embeddings tables)
3. pgvector extension loaded and functional
4. Database connection management with pooling
5. Core CRUD operations for all tables
6. Migration system for schema evolution
7. Database health checks and diagnostics
8. Proper indexes created (including vector index)
9. Transaction support for atomic operations
10. Full test coverage for database layer

## Key Files to Create
- `src/db/client.ts` - Database client initialization
- `src/db/schema.ts` - Schema definitions and migrations
- `src/db/repositories.ts` - Repository table operations
- `src/db/files.ts` - Files table operations
- `src/db/chunks.ts` - Chunks table operations
- `src/db/embeddings.ts` - Embeddings table operations
- `src/db/migrations/` - Migration files
- `src/db/types.ts` - TypeScript types for database entities

## Dependencies
**Required packages:**
```json
{
  "@electric-sql/pglite": "^0.2.0",
  "@electric-sql/pglite-vector": "^0.2.0"
}
```

## Schema Requirements
Follow ADR-001 exactly:
- `file_type` field: 'text', 'code', 'binary'
- `content=NULL` for binary files
- `binary_metadata` JSONB for binary file info
- Vector dimension: 384 (all-MiniLM-L6-v2)

## Testing
- Unit tests for CRUD operations
- Transaction rollback tests
- Vector search with pgvector
- Database persistence across restarts

## Dependencies
None - this is the foundation layer

## Blocks
- WP2 (File Processing)
- WP3 (Embedding Engine)
- WP4 (CLI Tool)
- WP5 (MCP Server)
