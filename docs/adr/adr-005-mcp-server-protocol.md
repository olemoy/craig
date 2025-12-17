# ADR-005: MCP Server Protocol Implementation

## Status
Proposed

## Context
CRAIG must expose querying and analytics capabilities via Model Context Protocol (MCP) for integration with Claude and other AI assistants.

## Decision
Implement MCP server following official specification with tools, resources, and prompts.

## MCP Tools

### 1. search_code
Search codebase using semantic similarity.

```typescript
{
  name: "search_code",
  description: "Semantic search across indexed codebases",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Natural language search query"
      },
      repository: {
        type: "string",
        description: "Filter to specific repository (optional)"
      },
      fileTypes: {
        type: "array",
        items: { type: "string" },
        description: "Filter to specific file types (optional)"
      },
      limit: {
        type: "number",
        default: 5,
        description: "Maximum results to return"
      }
    },
    required: ["query"]
  }
}
```

### 2. get_file_context
Retrieve full context for a specific file.

```typescript
{
  name: "get_file_context",
  description: "Get complete file content and metadata",
  inputSchema: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Path to file within repository"
      },
      repository: {
        type: "string",
        description: "Repository name or path"
      },
      includeChunks: {
        type: "boolean",
        default: false,
        description: "Include chunk breakdown"
      }
    },
    required: ["filePath", "repository"]
  }
}
```

### 3. analyze_codebase
Get high-level analytics and statistics.

```typescript
{
  name: "analyze_codebase",
  description: "Get repository statistics and composition analysis",
  inputSchema: {
    type: "object",
    properties: {
      repository: {
        type: "string",
        description: "Repository to analyze (optional, defaults to all)"
      },
      breakdown: {
        type: "string",
        enum: ["language", "fileType", "directory"],
        description: "Type of breakdown to provide"
      }
    }
  }
}
```

### 4. find_similar
Find code similar to a reference snippet.

```typescript
{
  name: "find_similar",
  description: "Find code patterns similar to a reference",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Reference code snippet"
      },
      language: {
        type: "string",
        description: "Programming language filter (optional)"
      },
      limit: {
        type: "number",
        default: 5
      }
    },
    required: ["code"]
  }
}
```

### 5. list_repositories
List all indexed repositories.

```typescript
{
  name: "list_repositories",
  description: "Get list of all indexed repositories",
  inputSchema: {
    type: "object",
    properties: {
      includeStats: {
        type: "boolean",
        default: false,
        description: "Include file counts and sizes"
      }
    }
  }
}
```

## MCP Resources

### Repository Resources
Expose repositories as navigable resources.

```typescript
// List all repositories
uri: "craig://repositories"

// Specific repository
uri: "craig://repositories/{name}"

// File tree
uri: "craig://repositories/{name}/files"

// Specific file
uri: "craig://repositories/{name}/files/{path}"
```

## MCP Prompts

### Developer Expert Persona
```typescript
{
  name: "developer_expert",
  description: "Activate CRAIG's developer expert persona for code assistance",
  arguments: [
    {
      name: "task",
      description: "Development task or question",
      required: true
    },
    {
      name: "context",
      description: "Additional context or constraints",
      required: false
    }
  ]
}
```

## Claude Desktop Integration

### Configuration
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

## Security Considerations
- Validate all file paths to prevent directory traversal
- Sanitize SQL queries to prevent injection
- Rate limit expensive operations
- Limit result sizes to prevent memory exhaustion
