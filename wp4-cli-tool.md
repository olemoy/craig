# Workpackage 4: CLI Tool Implementation

## Objective
Implement command-line interface for CRAIG with repository ingestion, management, and querying capabilities.

## Acceptance Criteria
1. Commander.js-based CLI with all commands
2. Repository ingestion with progress tracking
3. Update and remove operations
4. List repositories with statistics
5. Query interface for testing
6. Database management commands
7. Configuration file support
8. Colorized and formatted output
9. Error handling with helpful messages
10. Full test coverage for all commands

## Key Files to Create
- `src/cli/index.ts` - Main CLI entry point
- `src/cli/commands/ingest.ts` - Ingest command
- `src/cli/commands/update.ts` - Update command
- `src/cli/commands/remove.ts` - Remove command
- `src/cli/commands/list.ts` - List command
- `src/cli/commands/query.ts` - Query command
- `src/cli/commands/stats.ts` - Stats command
- `src/cli/commands/db.ts` - Database management
- `src/cli/progress.ts` - Progress reporting
- `src/cli/output.ts` - Output formatting
- `src/cli/config.ts` - Configuration management

## Dependencies
**Required packages:**
```json
{
  "commander": "^11.1.0",
  "ora": "^7.0.1",
  "chalk": "^5.3.0",
  "cli-table3": "^0.6.3",
  "cli-progress": "^3.12.0"
}
```

## Commands
```bash
craig ingest <path> --name <name>
craig update <name|path>
craig remove <name|path>
craig list [--format json|table]
craig query <question> --repo <name> --limit <n>
craig stats [name|path]
craig db status|vacuum|export|import
```

## Progress Display
```
Ingesting repository: /path/to/repo
✓ Found 1,247 files (892 code, 43 text, 312 binary)
⠋ Processing files... 45% (565/1,247)
  ├─ Code files: 402/892 chunked and embedded
  ├─ Text files: 38/43 chunked and embedded
  └─ Binary files: 125/312 metadata extracted
```

## Testing
- End-to-end ingest command
- Update/remove operations
- Progress reporting accuracy
- Binary vs text/code differentiation

## Dependencies
- WP1 (Database) for all operations
- WP2 (File Processing) for ingestion
- WP3 (Embedding) for generation

## Provides
- User-facing CLI tool
- Orchestration of all components
