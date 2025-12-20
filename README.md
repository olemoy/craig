# CRAIG - Code Repository AI Graph

Semantic code search using embeddings and vector similarity.

## Overview

CRAIG indexes code repositories with semantic chunking for natural language search across your codebase.

**Key Features:**
- 🔍 Semantic code search with natural language
- 🧩 Smart chunking with symbol extraction and line tracking
- 🎯 Symbol-aware search - find functions, classes, interfaces by name
- 📦 Local-first with PGlite (no external database)
- 🤖 MCP server for AI assistant integration
- 🌐 Multi-language support (TypeScript, JavaScript, Python, Java, Kotlin, Go, Rust, C, C++)

## Quick Start

### Installation

```bash
bun install
cp config.example.json config.json
```

### Configuration

**Default setup (384 dimensions, Transformers.js):**
```json
{
  "embedding": {
    "provider": "transformers",
    "transformers": {
      "model": "Xenova/all-MiniLM-L6-v2",
      "dimensions": 384
    }
  },
  "processing": {
    "tokenTarget": 500,
    "overlapTokens": 64
  }
}
```

**Using Ollama:**
```bash
ollama pull all-minilm
```
```json
{
  "embedding": {
    "provider": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "all-minilm",
      "dimensions": 384
    }
  }
}
```

⚠️ Configure dimensions before ingesting. Changing dimensions requires database migration.

### Basic Usage

```bash
# Ingest a repository
bun src/cli/index.ts ingest /path/to/repo --name my-project

# Search for code
bun src/cli/index.ts query "authentication logic"

# List repositories
bun src/cli/index.ts list

# Get statistics
bun src/cli/index.ts stats my-project

# Check database health
bun src/cli/index.ts health check

# View skipped files
bun src/cli/index.ts ingest /path/to/repo --show-skipped
```

## Chunking Strategy

**Language-Aware Boundaries:**
- Splits at function, class, interface, and type boundaries
- Preserves complete semantic units with overlap for context

**Chunk Metadata:**
- Symbol name and type (function, class, interface, method, struct, etc.)
- Line numbers (1-indexed start/end)
- Definition flag for symbol declarations
- 64 token overlap with previous chunk

### Supported Languages

- **TypeScript/JavaScript**: Functions, classes, interfaces, types, enums
- **Python**: Functions, classes, decorators
- **Java**: Classes, interfaces, methods
- **Kotlin**: Functions, classes, interfaces, objects
- **Go**: Functions, structs, interfaces
- **Rust**: Functions, structs, enums, traits, impls
- **C/C++**: Functions, structs, classes, namespaces

### Configuration

```json
{
  "processing": {
    "maxFileSizeBytes": 10485760,  // 10MB file size limit
    "maxChunksPerFile": 100,        // Maximum chunks per file
    "tokenTarget": 500,             // Target chunk size
    "overlapTokens": 64             // Overlap for context
  }
}
```

### Handling Large Files

Files exceeding size or chunk limits are tracked in the database but not indexed. Use these flags to override limits:

```bash
# View skipped files with reasons
bun src/cli/index.ts ingest /path/to/repo --show-skipped

# Force-ingest specific files (bypasses all limits)
bun src/cli/index.ts ingest /path/to/repo --force-files package-lock.json,large-file.sql

# Increase chunk limit for this run (temporary override)
bun src/cli/index.ts ingest /path/to/repo --chunk-limit 200
```

**Skipped File Tracking:**
- All files are tracked in the database, even if skipped
- Skip reason and details stored in file metadata
- Enables complete repository tree representation
- Force-ingest updates existing skipped records

## MCP Server Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "craig": {
      "command": "bun",
      "args": ["run", "/path/to/craig/src/mcp/server.ts"]
    }
  }
}
```

**Available Tools:**
- `query` - Semantic search with natural language
- `repos` - List repositories with stats
- `files` - List files with pagination and pattern search (e.g., "*.ts")
- `dirs` - Directory structure navigation
- `info` - Repository info
- `stats` - Comprehensive statistics
- `file_info` - File metadata (type, language, size)
- `read` - Read file content through MCP
- `similar` - Find semantically similar code

## Ingestion Logging

Logs are created at `logs/<repository>-ingestion-<date>.log`

```bash
# Monitor in real-time
tail -f logs/<reponame>-ingestion-<date>.log

# Find errors
grep ERROR logs/*.log
```

## Advanced Features

### Resume Interrupted Ingestion

Resume incomplete ingestion, skipping already-processed files:
```bash
bun src/cli/index.ts ingest /path/to/repo --resume
```

### Database Health

Check and repair database integrity:
```bash
# Check for issues
bun src/cli/index.ts health check

# Repair orphaned records
bun src/cli/index.ts health repair

# Validate specific repository
bun src/cli/index.ts health validate my-project
```

### Incremental Updates

Update a repository after changes:
```bash
bun src/cli/index.ts update my-project
```

Detects modified, added, and deleted files automatically.

### Custom Dimensions

To change embedding dimensions:
1. Update `config.json` (e.g., 768, 1024)
2. Update `src/db/migrations/001_initial_schema.sql` line 77
3. Delete database: `rm -rf data/`
4. Re-ingest repositories

## Project Structure

```
craig/
├── src/
│   ├── cli/          # Command-line interface
│   ├── db/           # Database layer (PGlite + pgvector)
│   ├── embeddings/   # Embedding generation
│   ├── processing/   # Chunking and ingestion
│   ├── mcp/          # MCP server and tools
│   └── config/       # Configuration
├── data/             # Database files (gitignored)
├── logs/             # Ingestion logs (gitignored)
└── models/           # Downloaded models (gitignored)
```

## Performance

- **Ingestion**: ~50-100 files/second
- **Search**: <100ms for most queries
- **Database**: ~1-2MB per 1000 files
- **Memory**: ~100-200MB during ingestion, ~50MB idle

## Troubleshooting

### Dimension Mismatch
```
DatabaseError: Vector must be exactly 384 dimensions, got 768
```
**Fix:** Update config, migration file, delete database, re-ingest.

### Ollama Connection Error
```
Error: Failed to connect to Ollama
```
**Fix:** Ensure Ollama is running (`ollama list`) and model is pulled.

### Empty Search Results
**Fix:** Check repository is ingested (`list`) or re-ingest (`update`).

## Documentation

- [Embedding Dimensions](docs/embedding-dimensions.md) - Setup guide
- [MCP Optimizations](docs/mcp-optimizations.md) - Token efficiency
- [Ollama Setup](docs/ollama-setup.md) - Using Ollama

## Contributing

Contributions welcome! Please follow existing code style, add tests, and update documentation.

## License

MIT

## Built With

- [PGlite](https://pglite.dev/) - Lightweight PostgreSQL
- [Transformers.js](https://huggingface.co/docs/transformers.js) - ML models
- [Ollama](https://ollama.ai/) - Local embeddings
