# Workpackage 5: MCP Server Implementation

## Objective
Implement Model Context Protocol server that exposes CRAIG's querying and analytics to Claude and AI assistants.

## Acceptance Criteria
1. MCP server following official protocol specification
2. All tools implemented (search_code, get_file_context, etc.)
3. Resource handlers for repositories and files
4. Developer expert prompt implementation
5. Stdio transport for Claude Desktop integration
6. Vector similarity search with pgvector
7. Structured error handling
8. Response formatting and validation
9. Proper handling of binary files (metadata only)
10. Full test coverage with mock MCP client

## Key Files to Create
- `src/mcp/server.ts` - Main MCP server
- `src/mcp/tools/search.ts` - search_code tool
- `src/mcp/tools/context.ts` - get_file_context tool
- `src/mcp/tools/analyze.ts` - analyze_codebase tool
- `src/mcp/tools/similar.ts` - find_similar tool
- `src/mcp/tools/list.ts` - list_repositories tool
- `src/mcp/resources/index.ts` - Resource handlers
- `src/mcp/prompts/developer.ts` - Developer expert prompt
- `src/mcp/types.ts` - MCP-related types
- `src/mcp/errors.ts` - Error handling

## Dependencies
**Required packages:**
```json
{
  "@modelcontextprotocol/sdk": "^0.5.0"
}
```

## MCP Tools
1. **search_code** - Semantic search across codebases
2. **get_file_context** - Get complete file content
3. **analyze_codebase** - Repository statistics
4. **find_similar** - Find similar code patterns
5. **list_repositories** - List indexed repositories

## Binary File Handling
```typescript
// In search results
if (result.fileType === 'binary') {
  return {
    filePath: result.filePath,
    fileType: 'binary',
    snippet: '(Binary file - metadata only)',
    metadata: result.binaryMetadata
  };
}
```

## Claude Desktop Config
```json
{
  "mcpServers": {
    "craig": {
      "command": "bun",
      "args": ["run", "/path/to/craig/dist/mcp-server.js"],
      "env": {
        "CRAIG_DB_PATH": "/path/to/craig.db"
      }
    }
  }
}
```

## Testing
- All tools execute successfully
- Search returns relevant results
- Binary files show metadata only
- Claude Desktop integration

## Dependencies
- WP1 (Database) for queries
- WP3 (Embedding) for search

## Provides
- MCP interface for AI assistants
- Developer expert persona
