# CRAIG - Code Repository AI Graph

Semantic search for code repositories using embeddings and vector similarity.

## What is CRAIG?

CRAIG indexes your code repositories and enables natural language semantic search across your codebase. Built with PGlite, pgvector, and your choice of embedding models (Transformers.js or Ollama).

**Key Features:**
- 🔍 Semantic code search using natural language queries
- 📦 Local-first with PGlite (no external database required)
- 🚀 Fast vector similarity search with pgvector
- 🤖 MCP server for Claude Desktop integration
- 💾 Supports multiple embedding providers (Transformers.js, Ollama)
- 🎯 Binary file detection (images, executables excluded from indexing)

## Installation

```bash
# Install dependencies
bun install

# Copy example config
cp config.example.json config.json
```

## Initial Setup

**⚠️ CRITICAL: Configure embedding dimensions BEFORE ingesting any repositories!**

You cannot change dimensions later without deleting your database and re-ingesting everything.

### Choose Your Embedding Model

| Setup | Dimensions | Model | Pros | Cons |
|-------|------------|-------|------|------|
| **Default** | **384** | `all-MiniLM-L6-v2` (Transformers.js) | No external dependencies, works offline | Lower quality |
| **Default** | **384** | `all-minilm` (Ollama) | Faster than Transformers.js | Requires Ollama |
| Advanced | 768 | `nomic-embed-text` (Ollama) | Better quality | Requires migration changes |
| Advanced | 1024 | `mxbai-embed-large` (Ollama) | Best quality | Requires migration changes |

### Quick Setup (384 Dimensions - Recommended)

**Option A: Transformers.js (No External Dependencies)**

Edit `config.json`:
```json
{
  "embedding": {
    "provider": "transformers",
    "transformers": {
      "model": "Xenova/all-MiniLM-L6-v2",
      "dimensions": 384
    }
  }
}
```

**Option B: Ollama (Faster)**

1. Install Ollama: https://ollama.ai
2. Pull the model: `ollama pull all-minilm`
3. Edit `config.json`:
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

### Advanced Setup (768/1024 Dimensions)

**As of v1.1.0, embedding dimensions are fully configurable!** You only need to:
1. Update `config.json` with your desired dimensions
2. Update the migration file: `src/db/migrations/001_initial_schema.sql` (line 77: `vector(384)` → `vector(YOUR_DIM)`)
3. Delete the database: `rm -rf data/`
4. Re-ingest your repositories

For higher quality embeddings, see [docs/embedding-dimensions.md](docs/embedding-dimensions.md) for detailed instructions.

## Usage

### CLI Commands

**Ingest a repository:**
```bash
bun src/cli/index.ts ingest /path/to/repo --name my-project

# Resume interrupted ingestion (skips already-processed files)
bun src/cli/index.ts ingest /path/to/repo --resume

# Verbose output
bun src/cli/index.ts ingest /path/to/repo --verbose
```

**Search for code:**
```bash
bun src/cli/index.ts query "authentication logic"
bun src/cli/index.ts query "error handling for API calls" --limit 5
```

**List repositories:**
```bash
bun src/cli/index.ts list
```

**Get repository statistics:**
```bash
bun src/cli/index.ts stats my-project
```

**Update repository (incremental):**
```bash
bun src/cli/index.ts update my-project
```

### Resume Interrupted Ingestion

If ingestion is interrupted (crash, Ctrl-C, system shutdown), use the `--resume` flag to continue where you left off:

```bash
bun src/cli/index.ts ingest /path/to/repo --resume
```

**How it works:**
- Checks which files already have embeddings in the database
- Skips fully processed files (assumes they haven't changed)
- Continues processing only incomplete or new files
- Shows progress: "✓ Already processed: X | ⏭️ To process: Y"

**When to use:**
- Ingestion was interrupted or crashed
- You want to continue a partial ingestion
- You know files haven't changed and want to save time
- **Retrying failed files** - Files that errored during processing

**When NOT to use:**
- Files may have been modified (use regular `ingest` or `update` instead)
- Starting a fresh ingestion of a new repository

**Example output:**
```
Resuming ingestion:
  ✓ Already processed: 1523
  ⏭️  To process:        47

Starting to process 47 remaining files...
```

**Retrying failed files:**

If some files fail during ingestion, they won't have embeddings and will automatically be retried when you run with `--resume`:

```bash
# After failed ingestion with errors
bun src/cli/index.ts ingest /path/to/repo --resume

# Failed files will be included in "To process" count
# Successfully processed files are skipped
```

### MCP Server (Claude Desktop Integration)

Start the MCP server:
```bash
bun src/mcp/server.ts
```

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):
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

**Available MCP Tools:**
- `search` - Semantic code search
- `repos` - List indexed repositories
- `files` - List files in repository (with pagination support)
- `directories` - Get directory structure (with pagination support)
- `read_file` - Read file content
- `stats` - Repository statistics
- `analyze` - Code metrics and language distribution
- `similar` - Find similar code snippets

**MCP Tool Pagination:**

The `files` and `directories` tools support pagination for large repositories:

```javascript
// List first 100 files
tools.files({ repository: "my-repo", limit: 100, offset: 0 })

// List next 100 files
tools.files({ repository: "my-repo", limit: 100, offset: 100 })

// Response includes pagination metadata:
{
  "repository": "my-repo",
  "total": 1523,        // Total files available
  "count": 100,         // Files returned in this response
  "files": [...],
  "more": true,         // More results available
  "next": 100           // Offset for next page
}
```

## Project Structure

```
craig/
├── src/
│   ├── cli/              # Command-line interface
│   ├── db/               # Database layer (PGlite + pgvector)
│   ├── embeddings/       # Embedding generation (Transformers.js, Ollama)
│   ├── processing/       # File discovery, chunking, ingestion
│   ├── mcp/              # MCP server and tools
│   └── config/           # Configuration management
├── docs/                 # Documentation
├── config.json           # Your configuration
└── data/                 # Database files (gitignored)
```

## Configuration

### config.json Structure

```json
{
  "embedding": {
    "provider": "transformers" | "ollama",
    "transformers": {
      "model": "Xenova/all-MiniLM-L6-v2",
      "dimensions": 384
    },
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "all-minilm",
      "dimensions": 384,
      "options": {
        "temperature": 0
      }
    }
  }
}
```

**Configuration commands:**
```bash
# Show current configuration
bun src/cli/index.ts config show

# Test embedding provider
bun src/cli/index.ts config test
```

## Examples

### Search for Authentication Code
```bash
$ bun src/cli/index.ts query "JWT token validation"

Found 5 results:
1. src/auth/jwt.ts (similarity: 0.89)
   - validateToken function implementation
2. src/middleware/auth.ts (similarity: 0.85)
   - JWT middleware for Express
...
```

### Find Similar Code
```bash
$ bun src/cli/index.ts similar "async function fetchUser(id)"

Similar code found:
1. src/api/users.ts (similarity: 0.92)
2. src/services/user-service.ts (similarity: 0.87)
...
```

### Repository Statistics
```bash
$ bun src/cli/index.ts stats my-project

Repository: my-project
Files: 1,234
Chunks: 5,678
Languages: TypeScript (45%), JavaScript (30%), JSON (15%), Markdown (10%)
```

## Architecture

### Database Schema

- **repositories** - Repository metadata (UUID-based IDs)
- **files** - All files (text, code, binary) with content
- **chunks** - Text/code chunks for embedding
- **embeddings** - 384-dimensional vectors (pgvector)

### Processing Pipeline

1. **Discovery** - Find all files in repository (respects .gitignore)
2. **Classification** - Detect file type (code/text/binary)
3. **Chunking** - Split text/code into overlapping chunks
4. **Embedding** - Generate vector embeddings
5. **Indexing** - Store in PGlite with vector index

### Search Pipeline

1. **Query Embedding** - Convert search query to vector
2. **Vector Search** - Find similar chunks using cosine distance
3. **Ranking** - Sort by similarity score
4. **Results** - Return relevant code snippets

## Documentation

- [Embedding Dimensions](docs/embedding-dimensions.md) - Critical setup information
- [MCP Optimizations](docs/mcp-optimizations.md) - Token efficiency details
- [Files Tool](docs/files-tool-optimization.md) - File listing optimization
- [Directories Tool](docs/directories-tool.md) - Directory structure navigation
- [Ollama Setup](docs/ollama-setup.md) - Using Ollama for embeddings

## Troubleshooting

### Dimension Mismatch Error

```
DatabaseError: Vector must be exactly 384 dimensions, got 768
```

**Solution:** Your config.json and database schema don't match. To change dimensions:
1. Update `config.json` with desired dimensions
2. Update `src/db/migrations/001_initial_schema.sql` line 77
3. Delete database: `rm -rf data/`
4. Re-ingest all repositories

**Note:** As of v1.1.0, there's no hardcoded dimension validation. The system reads dimensions from config.json.

### Ollama Connection Error

```
Error: Failed to connect to Ollama at http://localhost:11434
```

**Solution:**
1. Check Ollama is running: `ollama list`
2. Verify baseUrl in config.json
3. Pull the model: `ollama pull all-minilm`

### Files Failed During Ingestion

```
ERROR: Error processing /path/to/file.ts:
  SyntaxError: Unexpected token
```

**Solution:** Failed files will not have embeddings. To retry them:

```bash
# Resume ingestion - failed files will be retried
bun src/cli/index.ts ingest /path/to/repo --resume
```

Files that failed will be included in the "To process" count since they don't have embeddings.

### Empty Search Results

**Common causes:**
- Repository not ingested yet
- Query too specific
- Wrong repository name

**Solutions:**
```bash
# List repositories
bun src/cli/index.ts list

# Re-ingest repository
bun src/cli/index.ts update my-project
```

## Development

### Running Tests
```bash
bun test
```

### Building
```bash
bun build src/mcp/server.ts --target=node --outfile=dist/mcp-server.js
```

## Performance

- **Ingestion**: ~50-100 files/second (depends on file size)
- **Search**: <100ms for most queries
- **Database size**: ~1-2MB per 1000 files (excluding source files)
- **Memory usage**: ~100-200MB during ingestion, ~50MB idle

## Limitations

- No incremental chunk updates (must re-process entire file)
- Binary files are detected but not indexed
- Requires re-ingestion when changing embedding models
- Single database instance (no distributed setup)

## Changelog

### v1.1.0 (Latest)

**New Features:**
- ✨ **Resume functionality** for interrupted ingestion (`--resume` flag)
  - Skips already-processed files with embeddings
  - Continues from where ingestion was interrupted
  - Shows progress analysis before resuming

- 📄 **MCP tool pagination** for files and directories
  - `limit` and `offset` parameters for large repositories
  - Optimized response format with shorter field names
  - Pagination metadata: `total`, `count`, `more`, `next`

- ⚙️ **Fully configurable embedding dimensions**
  - No hardcoded dimension validation
  - Dimensions read entirely from `config.json`
  - Simplified setup process

**Improvements:**
- Token-efficient MCP responses (shorter field names)
- Better error messages for dimension mismatches
- Clearer migration file comments

## Roadmap

- [ ] Incremental chunk updates
- [ ] Support for multiple repositories in parallel
- [ ] Web UI for search and exploration
- [ ] Support for additional embedding providers
- [ ] Query result caching
- [ ] Fuzzy file name matching

## Contributing

Contributions welcome! Please:
1. Follow existing code style
2. Add tests for new features
3. Update documentation
4. Keep commits focused and clear

## License

MIT

## Credits

Built with:
- [PGlite](https://pglite.dev/) - Lightweight PostgreSQL
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity search
- [Transformers.js](https://huggingface.co/docs/transformers.js) - In-browser ML models
- [Ollama](https://ollama.ai/) - Local LLM and embedding models
