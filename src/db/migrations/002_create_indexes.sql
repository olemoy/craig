-- Migration 002: Create database indexes
-- Adds indexes for efficient querying and vector similarity search

-- =============================================================================
-- FILES TABLE INDEXES
-- =============================================================================

-- Index for querying files by repository
CREATE INDEX idx_files_repo ON files(repository_id);

-- Index for querying files by type (useful for filtering binary vs text/code)
CREATE INDEX idx_files_type ON files(file_type);

-- =============================================================================
-- CHUNKS TABLE INDEXES
-- =============================================================================

-- Index for querying chunks by file
CREATE INDEX idx_chunks_file ON chunks(file_id);

-- =============================================================================
-- EMBEDDINGS TABLE INDEXES
-- =============================================================================

-- Vector index for similarity search using IVFFlat algorithm
-- Uses cosine distance (vector_cosine_ops) for semantic similarity
-- IVFFlat divides vectors into lists for faster approximate nearest neighbor search
CREATE INDEX idx_embeddings_vector ON embeddings
  USING ivfflat (embedding vector_cosine_ops);
