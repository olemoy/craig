-- Migration 001: Initial database schema
-- Creates the core tables for CRAIG: repositories, files, chunks, embeddings
-- Based on ADR-001: Database Architecture

-- =============================================================================
-- REPOSITORIES TABLE
-- =============================================================================
-- Stores metadata about code repositories being indexed

CREATE TABLE repositories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  commit_sha TEXT,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

-- =============================================================================
-- FILES TABLE
-- =============================================================================
-- Stores all files from repositories (text, code, binary)
--
-- CRITICAL CONSTRAINTS:
-- - file_type must be 'text', 'code', or 'binary'
-- - Binary files: content MUST be NULL, binary_metadata should contain file info
-- - Text/code files: content should be populated
-- - Unique constraint on (repository_id, file_path)

CREATE TABLE files (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('text', 'code', 'binary')),
  content TEXT,              -- NULL for binary files
  binary_metadata JSONB,      -- For binary files: mime_type, size, etc.
  content_hash TEXT NOT NULL,
  size_bytes INTEGER,
  last_modified TIMESTAMP,
  language TEXT,              -- Programming language for code files
  metadata JSONB,
  UNIQUE(repository_id, file_path)
);

-- =============================================================================
-- CHUNKS TABLE
-- =============================================================================
-- Stores chunks of text/code files for embedding
--
-- NOTE: Only text/code files are chunked. Binary files are NOT chunked.
-- Unique constraint ensures chunks are properly ordered per file

CREATE TABLE chunks (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  metadata JSONB,
  UNIQUE(file_id, chunk_index)
);

-- =============================================================================
-- EMBEDDINGS TABLE
-- =============================================================================
-- Stores vector embeddings for chunks
--
-- NOTE: Only chunks (from text/code files) have embeddings.
-- Vector dimension: 384 (Xenova/all-MiniLM-L6-v2 model)
-- Unique constraint ensures one embedding per chunk

CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  embedding vector(384),      -- 384-dimensional vector
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chunk_id)
);
