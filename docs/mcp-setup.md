# CRAIG MCP Server Setup

This guide shows you how to use CRAIG with Claude Desktop via the Model Context Protocol (MCP).

## What is MCP?

Model Context Protocol allows AI assistants like Claude to access external tools and data sources. CRAIG's MCP server gives Claude the ability to:

- Search your codebase semantically
- Get full file context
- Analyze repository statistics
- Find similar code patterns
- List indexed repositories

## Prerequisites

1. **CRAIG installed and configured**
   ```bash
   cd /path/to/craig
   bun install
   ```

2. **At least one repository ingested**
   ```bash
   bun cli ingest /path/to/your/repo --name my-repo
   ```

3. **Claude Desktop installed**
   - Download from [claude.ai/download](https://claude.ai/download)

## Configuration

### Step 1: Locate Claude Desktop Config

The config file location depends on your OS:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Step 2: Add CRAIG MCP Server

Edit the config file and add the CRAIG server:

```json
{
  "mcpServers": {
    "craig": {
      "command": "bun",
      "args": [
        "run",
        "/Users/Ole-Alexander.Moy/Navdev/craig/src/mcp/server.ts"
      ],
      "env": {
        "CRAIG_DB_PATH": "/Users/Ole-Alexander.Moy/Navdev/craig/data/craig.db"
      }
    }
  }
}
```

**Important**: Replace `/Users/Ole-Alexander.Moy/Navdev/craig` with the actual path to your CRAIG installation.

### Step 3: Restart Claude Desktop

Completely quit and restart Claude Desktop for the changes to take effect.

## Verification

After restarting Claude Desktop, you should see the CRAIG tools available. You can test by asking Claude:

> "What repositories do you have access to?"

Claude should be able to call the `list_repositories` tool and show your ingested repositories.

## Available Tools

### 1. search_code
Semantic search across your codebase.

**Example:**
> "Search for authentication logic in my-repo"

### 2. get_file_context
Get complete file content.

**Example:**
> "Show me the contents of src/auth/login.ts in my-repo"

### 3. analyze_codebase
Get repository statistics.

**Example:**
> "Analyze the my-repo codebase"

### 4. find_similar
Find similar code patterns.

**Example:**
> "Find code similar to this function: [paste code]"

### 5. list_repositories
List all indexed repositories.

**Example:**
> "What repositories are indexed?"

## Resources

CRAIG also exposes resources that Claude can read:

- `craig://repositories` - List all repositories
- `craig://repository/{id}` - Repository details
- `craig://repository/{id}/files` - Files in repository

## Prompts

### developer_expert

Activates developer expert mode with full codebase awareness.

**Example:**
> "Use the developer_expert prompt for my-repo"

## Troubleshooting

### "Tool not found" or No Response

1. **Check the config path**: Ensure the path to `server.ts` is absolute and correct
2. **Verify bun is in PATH**: Run `which bun` in terminal
3. **Check logs**: Look in Claude Desktop logs for errors
   - macOS: `~/Library/Logs/Claude/mcp*.log`
   - Windows: `%APPDATA%\Claude\logs\mcp*.log`

### "Repository not found"

Make sure you've ingested the repository:
```bash
bun cli list  # Check which repos are indexed
bun cli ingest /path/to/repo --name repo-name  # Ingest if missing
```

### Database Path Issues

If the database isn't found, check:
1. The `CRAIG_DB_PATH` environment variable in config
2. The database exists at that location
3. The path is absolute, not relative

### Permission Errors

Ensure the database directory is writable:
```bash
ls -la /Users/Ole-Alexander.Moy/Navdev/craig/data/
chmod 755 /Users/Ole-Alexander.Moy/Navdev/craig/data/
```

## Advanced Configuration

### Multiple CRAIG Instances

You can configure multiple CRAIG instances for different projects:

```json
{
  "mcpServers": {
    "craig-project-a": {
      "command": "bun",
      "args": ["run", "/path/to/craig-a/src/mcp/server.ts"],
      "env": {
        "CRAIG_DB_PATH": "/path/to/craig-a/data/craig.db"
      }
    },
    "craig-project-b": {
      "command": "bun",
      "args": ["run", "/path/to/craig-b/src/mcp/server.ts"],
      "env": {
        "CRAIG_DB_PATH": "/path/to/craig-b/data/craig.db"
      }
    }
  }
}
```

### Custom Database Location

Set a custom database path in the config:

```json
{
  "env": {
    "CRAIG_DB_PATH": "/custom/path/to/craig.db"
  }
}
```

## Testing MCP Server Locally

You can test the MCP server without Claude Desktop:

```bash
# Start the server (it uses stdio, so won't show much)
bun run mcp

# Or use the MCP inspector tool
npx @modelcontextprotocol/inspector bun run /path/to/craig/src/mcp/server.ts
```

## Example Usage Session

Here's a typical workflow with Claude:

**You:** "What repositories do you have access to?"

**Claude:** *[calls list_repositories]* "I have access to: my-web-app, api-backend, shared-components"

**You:** "Search for React components that handle form validation"

**Claude:** *[calls search_code]* "I found several form validation components: [shows results]"

**You:** "Show me the full code for the first result"

**Claude:** *[calls get_file_context]* "Here's the complete file: [shows code]"

**You:** "Analyze the my-web-app repository"

**Claude:** *[calls analyze_codebase]* "The repository has 287 files: 245 code files (TypeScript: 200, JavaScript: 45), 35 text files, 7 binary files..."

## Support

For issues or questions:
- Check the MCP server logs in Claude Desktop
- Run `bun run mcp` directly to see error messages
- Verify your database has data: `bun cli list`

## Next Steps

- Ingest more repositories to expand Claude's knowledge
- Try the `developer_expert` prompt for enhanced assistance
- Use resources to explore repository structure
- Combine tools for complex code analysis tasks
