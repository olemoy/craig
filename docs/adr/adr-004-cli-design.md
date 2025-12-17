# ADR-004: CLI Design and User Interface

## Status
Proposed

## Context
CRAIG needs a CLI tool for repository management operations. Must support:
- Ingesting repositories
- Updating/removing repositories
- Querying status and statistics
- Interactive and non-interactive modes

## Decision
Build CLI using Commander.js with progress reporting and structured output.

## Commands

### Primary Commands

```bash
# Ingest repository
craig ingest <path> [options]
  --name <name>          # Custom repository name
  --force                # Re-ingest even if already indexed
  --exclude <patterns>   # Additional exclusion patterns
  --verbose              # Detailed progress output

# Update repository
craig update <name|path> [options]
  --force                # Force full re-index
  --verbose              # Detailed progress output

# Remove repository
craig remove <name|path> [options]
  --confirm              # Skip confirmation prompt

# List repositories
craig list [options]
  --format <json|table>  # Output format
  --verbose              # Include detailed statistics

# Query interface
craig query <question> [options]
  --repo <name>          # Filter to specific repository
  --limit <n>            # Number of results (default: 5)
  --format <json|text>   # Output format

# Statistics and diagnostics
craig stats [name|path] [options]
  --format <json|table>  # Output format

# Database management
craig db [command]
  status                 # Database health check
  vacuum                 # Optimize database
  export <file>          # Export to SQL dump
  import <file>          # Import from SQL dump
```

## Output Design

### Progress Reporting
- Use ora spinner for long-running operations
- Show file counts and progress percentages
- Estimated time remaining for ingestion
- Differentiate binary vs text/code file processing

```
Ingesting repository: /path/to/repo
✓ Analyzing repository structure...
✓ Found 1,247 files (892 code, 43 text, 312 binary)
⠋ Processing files... 45% (565/1,247) - 2m 15s remaining
  ├─ Code files: 402/892 chunked and embedded
  ├─ Text files: 38/43 chunked and embedded
  └─ Binary files: 125/312 metadata extracted
```

### Structured Output
- JSON mode for programmatic consumption
- Table mode for human readability
- Colorized output for better UX

### Error Handling
- Clear error messages with actionable guidance
- Exit codes for script integration
- Verbose mode for debugging

## Configuration

### Configuration File: `~/.config/craig/config.json`
```json
{
  "dbPath": "~/.local/share/craig/craig.db",
  "defaultExcludes": [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage"
  ],
  "chunkSize": 500,
  "chunkOverlap": 50,
  "embeddingBatchSize": 20
}
```

### Environment Variables
- `CRAIG_DB_PATH`: Override database location
- `CRAIG_CONFIG`: Override config file location
- `HF_HOME`: Transformers model cache location

## Dependencies
- `commander`: CLI framework
- `ora`: Spinner/progress indicators
- `chalk`: Terminal colors
- `cli-table3`: Formatted tables
- `inquirer`: Interactive prompts (future)
