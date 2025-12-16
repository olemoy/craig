# Work Package List

## Phase 1: Foundation - Database & Core Ingestion

### WP1.1: Setup PGlite Database Schema
**Objective**: Create database foundation with pgvector support

**Tasks**:
- Initialize PGlite database with pgvector extension
- Create projects table with fields: id, name, reference, source_path, ingestion_date, content_hash, last_updated
- Create files table with fields: id, project_id, path, content (nullable), file_hash, is_binary (boolean), metadata (JSON)
- Create embeddings table with fields: id, file_id, chunk_id, vector (pgvector type), chunk_text, start_line, end_line
- Create ingestion_status table with fields: id, project_id, status, progress, current_file, total_files, processed_files, started_at, completed_at, error
- Add appropriate indexes for performance (project_id, file_id, is_binary, vector similarity)
- Add constraint: embeddings can only reference files where is_binary=false
- Create database initialization script
- Write database migration/setup utilities

**Deliverables**:
- Database schema definition
- Initialization script
- Basic connection and query utilities

**Dependencies**: None

---

### WP1.2: Build Filesystem Scanner and Change Detection
**Objective**: Scan directories, detect file types, and track changes

**Tasks**:
- Implement recursive directory traversal
- Create file type detection:
  - Primary: Extension-based classification (code, text, markdown, config, binary)
  - Secondary: Content inspection for binary detection (null bytes, non-UTF8)
  - Maintain lists of known extensions for each category
- Create file filtering logic:
  - Exclude node_modules, .git, dist, build, .next, out directories
  - Exclude hidden files/directories (configurable)
  - Exclude files over 1MB (configurable threshold)
- Implement content hash calculation for all files (binary and text)
- Implement project-level content hash (aggregate of all file hashes)
- Extract file metadata (type, size, modified date, detected language, is_binary flag)
- Implement change detection by comparing file hashes
- Create utilities to identify new, modified, and deleted files
- Handle symlinks appropriately
- Add configurable filtering rules

**Deliverables**:
- Filesystem scanner module
- File type detection utilities
- Hash calculation utilities
- Change detection logic
- File metadata extractor

**Dependencies**: WP1.1

---

### WP1.3: Implement Code Parsing and Chunking
**Objective**: Parse text/code files and create intelligent chunks for embedding

**Tasks**:
- Implement language detection for text/code files (using file extensions and content analysis)
- Create chunking strategy for different file types:
  - Function/method level chunking for code
  - Class level chunking for larger classes
  - Fixed-size chunking for unstructured content (500-1000 tokens)
- Implement overlapping chunks (10% overlap) to preserve context
- Extract chunk metadata (start line, end line, type, language)
- Handle edge cases (very large functions, mixed content files)
- Preserve code structure information (indentation, hierarchy)
- Create chunk quality validation (ensure chunks are meaningful)
- **Skip chunking entirely for binary files** (is_binary=true)

**Deliverables**:
- Code parser module
- Chunking engine for text/code files
- Language detection utilities
- Chunk validation logic

**Dependencies**: WP1.2

---

### WP1.4: Integrate Transformers.js for Embeddings
**Objective**: Generate vector embeddings for text/code chunks only

**Tasks**:
- Research and select appropriate HuggingFace embedding model (e.g., CodeBERT, all-MiniLM-L6-v2)
- Integrate Transformers.js library with Bun runtime
- Implement model loading and initialization
- Create embedding generation pipeline:
  - Preprocess chunk text
  - Generate embeddings via model
  - Normalize vectors if needed
- **Only process chunks from text/code files** (is_binary=false)
- Implement batch processing for efficiency
- Add error handling and retry logic
- Store embeddings in pgvector format
- Optimize for memory usage (model caching, batch sizes)
- Add progress tracking for embedding generation

**Deliverables**:
- Embedding generation module
- Model loading utilities
- Batch processing pipeline
- Performance optimization

**Dependencies**: WP1.3

---

## Phase 2: CLI Ingestion Tool

### WP2.1: Create CLI Interface with Commands
**Objective**: Build command-line interface for all ingestion operations

**Tasks**:
- Setup CLI framework (e.g., using commander.js or similar)
- Implement `ingest <directory-path> --name <name>` command:
  - Validate directory path exists
  - Generate unique project reference
  - Orchestrate full ingestion pipeline (text/code files get embeddings, binary files metadata only)
- Implement `ingest-delta <project-id>` command:
  - Fetch project from database
  - Compare current directory state with stored hashes
  - Process only changed files (respecting binary vs text classification)
- Implement `purge <project-id>` command:
  - Remove all project data (files, embeddings, status)
  - Confirm deletion with user
- Implement `status <project-id>` command:
  - Query ingestion_status table
  - Display formatted progress information
- Implement `list` command:
  - Display all projects with metadata
  - Show counts of text/code files vs binary files
- Implement `check-updates <project-id>` command:
  - Compare hashes without ingesting
- Add global options (--verbose, --quiet, --config)
- Create help documentation for all commands

**Deliverables**:
- Complete CLI application
- Command implementations
- Help documentation
- Input validation

**Dependencies**: WP1.4

---

### WP2.2: Implement Logging System
**Objective**: Comprehensive logging to stdout and database

**Tasks**:
- Create stdout progress reporter:
  - Real-time percentage display
  - Current file being processed (indicate if binary or text/code)
  - Elapsed time and estimated completion
  - Files processed / total files
  - Separate counts for text/code files (with embeddings) vs binary files (metadata only)
  - Pretty formatting with colors (if terminal supports)
- Implement database status updates:
  - Update ingestion_status table in real-time
  - Track progress percentage
  - Store current file being processed
  - Record timestamps
- Create error logging:
  - Log errors to stderr
  - Store error details in database
  - Include stack traces for debugging
- Add different log levels (debug, info, warn, error)
- Implement log rotation for file-based logs (optional)
- Create structured logging format (JSON for programmatic parsing)
- Add performance metrics logging (files/second, time per operation, embeddings generated)

**Deliverables**:
- Logging framework
- Progress reporter
- Database status updater
- Error handling system

**Dependencies**: WP2.1

---

### WP2.3: Add Ingestion Status Tracking
**Objective**: Track ingestion state for resumability and monitoring

**Tasks**:
- Implement status state machine (pending → in_progress → completed/failed)
- Create checkpoint mechanism for interruption handling
- Implement resume capability:
  - Detect incomplete ingestion
  - Skip already processed files
  - Continue from last checkpoint
- Add transaction support for atomic updates
- Implement cleanup for failed ingestions
- Create status query utilities for external monitoring
- Add validation for status transitions
- Implement timeout detection for stalled ingestions
- Create status history tracking (optional)

**Deliverables**:
- Status tracking system
- Resume capability
- Checkpoint mechanism
- Status query utilities

**Dependencies**: WP2.2

---

## Phase 3: MCP Query & Analytics Server

### WP3.1: Setup MCP Server Framework
**Objective**: Initialize MCP server with database connection

**Tasks**:
- Setup MCP SDK for Bun runtime
- Initialize MCP server with proper configuration
- Establish PGlite database connection (shared with CLI)
- Define MCP tool schema for all operations
- Implement basic request/response handling
- Add error handling and logging
- Create server lifecycle management (startup, shutdown)
- Add health check endpoint
- Configure server settings (timeouts, concurrency)
- Write server initialization and bootstrap code

**Deliverables**:
- MCP server application
- Database connection layer
- Tool schema definitions
- Server configuration

**Dependencies**: WP2.3

---

### WP3.2: Implement Query Tools
**Objective**: Core MCP tools for code querying

**Tasks**:
- Implement `list_projects` tool:
  - Query all projects from database
  - Return formatted project list with metadata
  - Include statistics (file count by type: text/code vs binary, size, ingestion date)
- Implement `get_file_structure` tool:
  - Build hierarchical tree from files table (including binary files)
  - Return JSON representation of directory structure
  - Include file metadata in tree nodes (is_binary flag, size, type)
- Implement `search_code` tool:
  - Accept natural language query
  - Generate query embedding using same model
  - Perform pgvector similarity search on embeddings table
  - **Only searches text/code files** (files where is_binary=false)
  - Rank and return relevant code chunks with context
  - Include file path, line numbers, similarity score
- Implement `get_file_content` tool:
  - Retrieve file content from database
  - Return NULL or error message for binary files (is_binary=true)
  - Support syntax highlighting hints for text/code
  - Return file metadata
- Implement `query_ingestion_status` tool:
  - Fetch current status from ingestion_status table
  - Return progress information
  - Handle multiple concurrent ingestions
- Add pagination support for large result sets
- Implement result caching for frequently accessed data

**Deliverables**:
- Query tool implementations
- Vector search functionality (text/code only)
- Result formatting utilities
- Caching layer

**Dependencies**: WP3.1

---

### WP3.3: Build Agent Analytics Layer
**Objective**: Developer expert agent persona for code insights

**Tasks**:
- Design agent prompt engineering for code analysis
- Implement architecture pattern detection:
  - Identify common patterns (MVC, microservices, layered architecture)
  - Detect frameworks and libraries in use (from code files, config files)
  - Map component relationships
- Implement dependency analysis:
  - Parse import/require statements from code files
  - Analyze package.json, requirements.txt, etc. from config files
  - Build dependency graph
  - Identify external dependencies
  - Detect circular dependencies
- Implement code quality insights:
  - Code complexity estimation
  - Comment density analysis
  - File size and structure analysis
  - Naming convention detection
- Create natural language explanation generator:
  - Convert technical findings to readable insights
  - Provide context-aware recommendations
  - Suggest refactoring opportunities
- Implement context aggregation for multi-file analysis
- Add confidence scoring for insights
- Create insight caching to avoid redundant analysis
- **Note**: Analytics focus on text/code files; binary files provide structural context only

**Deliverables**:
- Agent analytics engine
- Pattern detection algorithms
- Dependency analyzer
- Insight generation system

**Dependencies**: WP3.2

---

### WP3.4: Add Management Tools
**Objective**: Project management and maintenance tools

**Tasks**:
- Implement `check_for_updates` tool:
  - Calculate current directory content hash (all files including binary)
  - Compare with stored project hash
  - Return list of changed files (both text/code and binary)
  - Estimate delta ingestion scope (how many embeddings need regeneration)
- Implement `get_project_metadata` tool:
  - Retrieve comprehensive project information
  - Calculate statistics:
    - Total files (breakdown: text/code vs binary)
    - Lines of code (text/code files only)
    - Languages detected
    - Total embeddings generated
  - Return ingestion history
  - Include health metrics
- Add project validation utilities:
  - Verify database integrity
  - Check for missing embeddings (for non-binary files)
  - Validate file references
  - Ensure binary files have no embeddings
- Implement project comparison tool (optional):
  - Compare two projects
  - Highlight differences
- Add bulk operations support (optional):
  - Batch status checks
  - Multiple project queries

**Deliverables**:
- Management tool implementations
- Update detection system
- Metadata aggregator
- Validation utilities

**Dependencies**: WP3.3

---

## Phase 4: GitHub URL Support & MCP-Triggered Ingestion

### WP4.1: Add GitHub URL Ingestion
**Objective**: Support remote repository cloning and ingestion

**Tasks**:
- Implement Git operations wrapper (using Bun's subprocess or libgit2)
- Add `git clone` functionality:
  - Clone to temporary directory
  - Handle authentication (SSH keys, tokens)
  - Support shallow clones for large repos
- Extract git commit hash for tracking
- Implement git-based change detection:
  - Use `git diff` between commits
  - More accurate than hash-based detection
- Add `git pull` for delta updates
- Implement cleanup of temporary clone directories
- Support for different git hosting providers (GitHub, GitLab, Bitbucket)
- Handle submodules and LFS files appropriately
- Add rate limiting for API calls
- Update database schema to track git-specific metadata (commit hash, remote URL, branch)
- Modify CLI commands to accept URLs
- Add URL validation and parsing
- **Binary file handling remains the same**: tracked in structure, not ingested

**Deliverables**:
- Git operations module
- URL-based ingestion pipeline
- Enhanced change detection
- Cleanup utilities

**Dependencies**: WP3.4

---

### WP4.2: Implement Subprocess Spawning from MCP
**Objective**: MCP-triggered ingestion via CLI subprocess

**Tasks**:
- Implement `trigger_ingest` tool:
  - Spawn CLI `ingest` command as subprocess
  - Pass parameters (source, name, options)
  - Return process ID for tracking
  - Non-blocking operation
- Implement `trigger_delta_ingest` tool:
  - Spawn CLI `ingest-delta` command
  - Monitor via process ID
- Implement `trigger_purge` tool:
  - Spawn CLI `purge` command
  - Confirm completion
- Add subprocess management:
  - Track running processes
  - Handle process completion
  - Capture exit codes
  - Log stdout/stderr
- Implement process cleanup on server shutdown
- Add concurrent ingestion limits
- Create queue for ingestion requests (optional)
- Handle subprocess failures gracefully

**Deliverables**:
- Subprocess spawning tools
- Process management system
- Queue implementation (if needed)
- Failure handling

**Dependencies**: WP4.1

---

### WP4.3: Add Subprocess Monitoring
**Objective**: Monitor and manage running ingestion subprocesses

**Tasks**:
- Implement process status tracking:
  - Store active process IDs in memory or database
  - Track start time and last activity
- Create monitoring tool for MCP:
  - Query ingestion_status table for subprocess progress
  - Return real-time status updates
  - List all active ingestion processes
- Implement process timeout detection:
  - Identify stalled processes
  - Send termination signals if needed
- Add process cancellation capability:
  - Cancel running ingestion
  - Clean up partial data
  - Update status appropriately
- Implement log tailing for subprocess output (optional)
- Create dashboard view of all active ingestions (optional)
- Add notifications for completion/failure (optional)
- Implement retry logic for failed subprocess operations

**Deliverables**:
- Process monitoring system
- Status query tools
- Cancellation capability
- Timeout handling

**Dependencies**: WP4.2

---

## Implementation Notes

### Recommended Order
1. **Phase 1** (WP1.1 → WP1.2 → WP1.3 → WP1.4): Core foundation with binary file handling
2. **Phase 2** (WP2.1 → WP2.2 → WP2.3): CLI tool with differentiated processing
3. **Phase 3** (WP3.1 → WP3.2 → WP3.3 → WP3.4): MCP server with binary-aware queries
4. **Phase 4** (WP4.1 → WP4.2 → WP4.3): Advanced features

### Testing Strategy
- Unit tests for each module (database, scanner, chunker, embeddings, binary detection)
- Integration tests for CLI commands with mixed file types
- End-to-end tests for MCP tools
- Performance tests for large codebases with many binary files (1000+ files)
- Test with various project types (TypeScript, Python, JavaScript, mixed with images/PDFs)
- Verify binary files appear in structure but have no embeddings

### Key Technical Decisions Needed
- Specific HuggingFace embedding model selection
- Chunk size and overlap percentage
- File size limits for ingestion
- Vector dimension size
- Query result limits
- Caching strategy
- Binary file size threshold (when to exclude entirely)

### Risk Mitigation
- Large files: Implement size limits and streaming
- Memory usage: Batch processing and model caching
- Database locking: Proper transaction management
- Subprocess failures: Comprehensive error handling and cleanup
- Binary file detection: Robust content inspection fallback

---

**End of Work Package List**
