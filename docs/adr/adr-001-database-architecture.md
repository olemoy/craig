# ADR-001: Database Architecture with PGlite and pgvector

## Status
Proposed

## Context
CRAIG needs to store repository metadata, file contents, and vector embeddings for semantic search. The system must support:
- Fast semantic similarity search
- Efficient storage of file metadata and content
- Support for both text/code and binary file handling
- Lightweight deployment (no external database dependencies)

## Decision
Use PGlite with pgvector extension as the embedded database solution.

## Consequences

### Positive
- Zero external dependencies - fully embedded database
- Full PostgreSQL compatibility for complex queries
- Native vector similarity search via pgvector
- ACID compliance for data integrity
- Supports both in-memory and persistent storage
- Compatible with Bun runtime

### Negative
- Single-process limitations (no concurrent writers)
- Memory constraints for very large repositories
- Limited by pgvector performance characteristics

## Implementation Details

### Schema Design

```sql
-- Repositories table
CREATE TABLE repositories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  commit_sha TEXT,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

-- Files table (for text/code files)
CREATE TABLE files (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'text', 'code', 'binary'
  content TEXT, -- NULL for binary files
  binary_metadata JSONB, -- size, mime_type, etc. for binary files
  content_hash TEXT NOT NULL,
  size_bytes INTEGER,
  last_modified TIMESTAMP,
  language TEXT, -- programming language for code files
  metadata JSONB,
  UNIQUE(repository_id, file_path)
);

-- Chunks table (for text/code files only)
CREATE TABLE chunks (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  metadata JSONB,
  UNIQUE(file_id, chunk_index)
);

-- Embeddings table (for text/code chunks only)
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  chunk_id INTEGER REFERENCES chunks(id) ON DELETE CASCADE,
  embedding vector(384), -- Xenova/all-MiniLM-L6-v2 dimension
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chunk_id)
);

-- Indexes
CREATE INDEX idx_files_repo ON files(repository_id);
CREATE INDEX idx_files_type ON files(file_type);
CREATE INDEX idx_chunks_file ON chunks(file_id);
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops);
```

### Binary vs Text/Code Handling

- **Text/Code Files**: Full content stored, chunked, and embedded
- **Binary Files**: Metadata only (no chunking or embedding)
  - Store: size, mime type, file path, hash
  - Track in `files` table with `file_type='binary'` and `content=NULL`
  - Use `binary_metadata` JSONB field for extensible metadata

### Database Location
- Development: `./data/craig.db`
- Production: Configurable via `CRAIG_DB_PATH` environment variable
