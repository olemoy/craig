# CRAIG - Code Repository AI Graph

Semantic search for code repositories using embeddings and vector similarity.

## Overview

CRAIG indexes code repositories with semantic chunking and enables natural language search across your codebase. Built with PGlite, pgvector, and embedding models (Transformers.js or Ollama).

**Key Features:**
- 🔍 Semantic code search with natural language queries
- 🧩 **Smart chunking** with symbol extraction and line tracking
- 📍 Precise navigation with line numbers and symbol definitions
- 🎯 **Symbol-aware search** - find functions, classes, and interfaces by name
- 📦 Local-first with PGlite (no external database)
- 🚀 Fast vector similarity search with pgvector
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

⚠️ **Important:** Configure dimensions before ingesting repositories. Changing dimensions requires database migration.

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
```

## How CRAIG Chunks Code

CRAIG uses intelligent semantic chunking to preserve code structure and enable precise navigation.

### Chunking Strategy

**Language-Aware Boundaries:**
- Splits code at function, class, interface, and type boundaries
- Detects symbols using language-specific patterns
- Preserves complete semantic units

**Rich Metadata:**
Each chunk includes:
- **Symbol Name**: Extracted function/class/interface name
- **Symbol Type**: `function`, `class`, `interface`, `method`, `struct`, etc.
- **Chunk Type**: Semantic classification for filtering
- **Line Numbers**: Exact start and end lines (1-indexed)
- **Definition Flag**: Marks chunks containing symbol definitions
- **Overlap**: 64 tokens from previous chunk for context preservation

**Example:**
```typescript
// Original code
export class UserService {
  async authenticate(credentials) { ... }
  async createUser(data) { ... }
}

// Creates 3 chunks:
// 1. Class definition (isDefinition: true, symbolName: "UserService", lines: 1-2)
// 2. authenticate method (symbolName: "authenticate", lines: 2-3)
// 3. createUser method (symbolName: "createUser", lines: 3-4)
```

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
    "tokenTarget": 500,             // Target chunk size
    "overlapTokens": 64             // Overlap for context
  }
}
```

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
- `files` - List files with pagination
- `dirs` - Directory structure navigation
- `info` - Repository info with absolute path
- `stats` - Comprehensive statistics
- `file_info` - File metadata with path
- `similar` - Find semantically similar code

## Ingestion Logging

CRAIG automatically creates detailed logs for each ingestion session to help monitor progress and debug issues.

### Log Files

**Location:** `logs/<repository-name>-ingestion-<date>.log`

**Example:** `logs/my-project-ingestion-2025-12-18.log`

### Log Format

```
2025-12-18 15:32:10.234 | START  | /path/to/file.ts
2025-12-18 15:32:11.156 | DONE   | /path/to/file.ts | 15 chunks | 921ms
2025-12-18 15:32:12.245 | SKIP   | /path/to/large-file.sql | Too large: 15.2 MB
2025-12-18 15:32:13.301 | ERROR  | /path/to/bad-file.ts | SyntaxError: Unexpected token
```

### Monitor in Real-Time

**Tail the log while ingesting:**
```bash
# In one terminal
bun src/cli/index.ts ingest /path/to/repo

# In another terminal
tail -f logs/<reponame>-ingestion-<date>.log
```

**Find errors:**
```bash
grep ERROR logs/*.log
```

**Session summaries:**
```bash
grep "SESSION END" logs/my-project-ingestion-2025-12-18.log
```

### Log Management

- One log file per project per day
- Multiple sessions append to same file
- Session markers separate different runs
- Gitignored by default (in `logs/`)
- Clean up old logs: `find logs/ -name "*.log" -mtime +30 -delete`

## Advanced Features

### Resume Interrupted Ingestion

If ingestion is interrupted, resume where you left off:
```bash
bun src/cli/index.ts ingest /path/to/repo --resume
```

Skips files that already have embeddings and continues processing incomplete files.

### Incremental Updates

Update a repository after changes:
```bash
bun src/cli/index.ts update my-project
```

Detects modified, added, and deleted files automatically.

### Custom Dimensions

For higher quality embeddings (requires migration):
1. Update `config.json` with new dimensions (e.g., 768, 1024)
2. Update `src/db/migrations/001_initial_schema.sql` line 77
3. Delete database: `rm -rf data/`
4. Re-ingest repositories

See [docs/embedding-dimensions.md](docs/embedding-dimensions.md) for details.

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
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity
- [Transformers.js](https://huggingface.co/docs/transformers.js) - ML models
- [Ollama](https://ollama.ai/) - Local embeddings
- [Claude Code](https://claude.com/claude-code) - AI coding assistant
