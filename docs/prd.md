# Product Requirements Document (PRD) or CRAIG - CODE RETRIEVAL AI GAMBIT (for now)
## RAG MCP for Code Traversal & Analytics

**Version**: 1.0  
**Date**: December 2025

---

## 1. Purpose

An MCP server enabling intelligent code analysis and traversal by ingesting code repositories into a vector database. This allows AI assistants to understand codebases through semantic search and provide expert-level code analytics, architecture insights, and development guidance.

---

## 2. Core Capabilities

### 2.1 Data Ingestion
- Import code from local filesystem paths (git repositories or plain directories)
- Ingest text files, markdown files, configuration files, and code files
- Track binary files in file structure but do not process content or generate embeddings
- Track projects with metadata: name, unique reference, source path, ingestion date, content hash
- Support full ingestion and delta ingestion (detecting changes via content hashing)
- Run as standalone CLI tool or MCP-triggered subprocess
- Track and report ingestion progress in real-time

### 2.2 Query & Analysis
- Retrieve complete file structures and hierarchies (including binary files)
- Semantic code search using vector embeddings (text/code files only)
- Access file content and metadata
- Provide code analytics through developer expert agent persona:
  - Architecture pattern detection
  - Dependency analysis
  - Code quality insights
  - Component relationships

### 2.3 Management
- Query project status and metadata
- Purge projects from database
- Check for updates in source directories
- Monitor ongoing ingestion progress

### 2.4 Logging & Status Reporting
- CLI outputs progress to stdout (percentage, current file, elapsed time)
- All operations log to database status tables
- MCP can query database for status when subprocess is running
- Error logging with recovery information

---

## 3. Technical Stack

- **Runtime**: Bun
- **Vector Database**: PGlite with pgvector extension (file-based, shared access)
- **Machine Learning**: Transformers.js with HuggingFace embedding models
- **Source Input**: Local filesystem paths (Phase 1-3), GitHub URLs (Phase 4)
- **Interface**: MCP protocol for AI assistant integration

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Server Process                    │
│                                                           │
│  ┌────────────┐  ┌──────────┐  ┌──────────────┐        │
│  │  Query     │  │ Trigger  │  │  Management  │        │
│  │  Tools     │  │ Ingest   │  │  Tools       │        │
│  │            │  │ (Phase 4)│  │              │        │
│  └─────┬──────┘  └─────┬────┘  └──────┬───────┘        │
│        │               │               │                 │
└────────┼───────────────┼───────────────┼─────────────────┘
         │               │(spawn CLI)    │
         │               ▼               │
         │        ┌─────────────┐        │
         │        │  CLI Worker │        │
         │        │ (subprocess)│        │
         │        └──────┬──────┘        │
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  PGlite DB File      │
              │  + pgvector          │
              │                      │
              │  • Projects          │
              │  • Files             │
              │  • Embeddings        │
              │  • Status            │
              └──────────────────────┘
                         ▲
                         │
              ┌──────────┴──────────┐
              │  Standalone CLI     │
              │  (manual/scheduled) │
              └─────────────────────┘
```

---

## 5. Data Model

### 5.1 Projects Table
- `id`: Unique project identifier
- `name`: Human-readable project name
- `reference`: Unique reference (hash-based)
- `source_path`: Filesystem path to source code
- `ingestion_date`: Timestamp of initial ingestion
- `content_hash`: Hash of all file contents for change detection
- `last_updated`: Timestamp of last delta ingestion

### 5.2 Files Table
- `id`: Unique file identifier
- `project_id`: Foreign key to projects
- `path`: Relative file path within project
- `content`: File text content (NULL for binary files)
- `file_hash`: Individual file content hash
- `is_binary`: Boolean flag indicating binary file
- `metadata`: JSON (language, size, type, modified_date)

### 5.3 Embeddings Table
- `id`: Unique embedding identifier
- `file_id`: Foreign key to files
- `chunk_id`: Chunk number within file
- `vector`: Vector embedding (pgvector type)
- `chunk_text`: Original text chunk
- `start_line`: Starting line number
- `end_line`: Ending line number

### 5.4 Ingestion Status Table
- `id`: Unique status record identifier
- `project_id`: Foreign key to projects
- `status`: Current status (pending, in_progress, completed, failed)
- `progress`: Percentage complete (0-100)
- `current_file`: Currently processing file path
- `total_files`: Total number of files to process
- `processed_files`: Number of files processed
- `started_at`: Timestamp when ingestion started
- `completed_at`: Timestamp when ingestion completed
- `error`: Error message if failed

---

## 6. File Processing Rules

### 6.1 Text/Code Files (Full Processing)
Files that are read, chunked, and embedded:
- **Code files**: .ts, .js, .tsx, .jsx, .py, .java, .go, .rs, .c, .cpp, .h, .cs, .rb, .php, etc.
- **Text files**: .txt
- **Markdown files**: .md, .mdx
- **Configuration files**: .json, .yaml, .yml, .toml, .ini, .env, .config
- **Other text**: .xml, .html, .css, .scss, .sql, .sh, .bash

### 6.2 Binary Files (Metadata Only)
Files that are tracked in file structure but not ingested:
- **Images**: .png, .jpg, .jpeg, .gif, .svg, .webp, .ico
- **Archives**: .zip, .tar, .gz, .rar, .7z
- **Executables**: .exe, .dll, .so, .dylib, .bin
- **Media**: .mp4, .mp3, .wav, .avi, .mov
- **Documents**: .pdf, .docx, .xlsx, .pptx
- **Other**: Any file detected as binary by content inspection

### 6.3 File Detection
- Primary: File extension matching
- Secondary: Content inspection (check for null bytes or non-UTF8 sequences)
- Binary files: Store in files table with `is_binary=true` and `content=NULL`
- No embeddings generated for binary files

---

## 7. CLI Interface

### Commands
```
ingest <directory-path> --name <name>
  Full ingestion of a local directory

ingest-delta <project-id>
  Incremental update based on content hash comparison

purge <project-id>
  Remove project and all associated data

status <project-id>
  Check ingestion status and progress

list
  List all ingested projects

check-updates <project-id>
  Check if source directory has changes
```

### Output Format
- **stdout**: Real-time progress (percentage, current file, elapsed time)
- **stderr**: Errors and warnings
- **exit codes**: 0 (success), 1 (error), 2 (partial success)

---

## 8. MCP Tools

### Query Tools
- `list_projects`: Return all ingested projects with metadata
- `get_file_structure`: Retrieve hierarchical file tree for a project (includes binary files)
- `query_code`: Semantic search across project code using natural language (text/code files only)
- `get_file_content`: Retrieve full content of specific file (returns NULL for binary files)
- `query_ingestion_status`: Check progress of ongoing ingestion

### Management Tools
- `get_project_metadata`: Retrieve project information and statistics

### Phase 4 Tools (Future)
- `check_for_updates`: Detect changes in source directory
- `trigger_ingest`: Spawn CLI ingestion subprocess
- `trigger_delta_ingest`: Spawn delta ingestion subprocess
- `trigger_purge`: Spawn purge subprocess

---

## 9. Agent Persona

The MCP server operates with a **Developer Expert Agent** persona that:
- Understands code architecture and design patterns
- Provides context-aware code explanations
- Identifies dependencies and relationships
- Offers insights on code quality and maintainability
- Suggests improvements and refactoring opportunities
- Answers technical questions about the codebase

---

## 10. Ingestion Strategy

### File Filtering
Exclude from processing:
- `node_modules/`, `.git/`, `dist/`, `build/`, `.next/`, `out/`
- Hidden files and directories (starting with `.`)
- Files larger than 1MB (configurable)

### File Categorization
1. **Text/Code files**: Read content, generate embeddings
2. **Binary files**: Store metadata only, mark as binary
3. **Excluded files**: Not tracked at all

### Chunking Strategy (Text/Code Files Only)
- Function/method level for most languages
- Class level for larger classes
- Fixed size (500-1000 tokens) for unstructured content
- Preserve context with overlapping chunks (10% overlap)

### Change Detection
- Calculate hash of all file contents (project-level)
- Store individual file hashes for granular change detection
- On delta ingestion:
  - Compare file hashes
  - Re-process only changed/new text/code files
  - Update metadata for changed binary files
  - Remove embeddings for deleted files

---

## 11. Future Enhancements (Phase 4)

### GitHub URL Support
- Clone remote repositories
- Track via git commit hashes
- Automatic update detection via `git fetch`
- Support for private repositories (authentication)

### MCP-Triggered Operations
- Spawn CLI as subprocess from MCP tools
- Non-blocking operation with progress monitoring
- Handle concurrent ingestion requests
- Queue management for multiple projects

---

## 12. Success Criteria

- Successfully ingest projects with 1000+ files (text, code, and binary)
- Binary files appear in file structure but don't consume embedding resources
- Semantic search returns relevant results within 2 seconds (text/code only)
- Delta ingestion processes only changed files
- CLI provides clear progress feedback
- MCP tools respond within acceptable timeframes
- Agent provides accurate code analysis and insights

---

