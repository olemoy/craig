# MCP Tool Optimizations

This document describes the optimizations made to reduce token usage and improve agent usability.

## Tool Name Changes

**Shorter, more intuitive names for agent usage:**

| Old Name | New Name | Reason |
|----------|----------|--------|
| `query` | `search` | More intuitive, aligns with functionality |
| `list_repositories` | `repos` | 50% shorter, clear abbreviation |
| `list_files` | `files` | 50% shorter, action is implied |
| `get_file_context` | `read_file` | Clearer action verb, 40% shorter |
| `get_stats` | `stats` | 40% shorter, action is implied |
| `analyze_codebase` | `analyze` | 40% shorter, target is implied |
| `find_similar` | `similar` | 30% shorter, action is implied |

## Description Optimizations

**Reduced from 10-30 words to 3-7 words:**

- `search`: "Semantic code search using natural language queries" (7 words vs 12)
- `repos`: "List all indexed repositories" (4 words vs 9)
- `files`: "List files in a repository with metadata" (7 words vs 14)
- `stats`: "Get repository statistics (files, chunks, embeddings)" (6 words vs 10)
- `read_file`: "Read complete file content from repository" (6 words vs 14)
- `analyze`: "Analyze repository metrics and language distribution" (6 words vs 14)
- `similar`: "Find code similar to given snippet" (6 words vs 17)

## Output Format Optimizations

### 1. Removed JSON Indentation
**Before:** `JSON.stringify(results, null, 2)` - 2-space indentation
**After:** `JSON.stringify(results)` - compact JSON

**Token Savings:** ~25-35% reduction in output size

### 2. Removed Redundant Fields

#### SearchResult
**Removed:**
- `repositoryId` - Can look up by name if needed
- `chunkIndex` - Internal detail, not needed for most use cases
- `metadata` - Rarely used character/token positions

**Kept:**
- `repository` - Name for display
- `filePath` - Location
- `fileType` - Context about file
- `language` - Programming language
- `content` - The actual code
- `similarity` - Relevance score

**Token Savings:** ~20-30 tokens per result

#### FileContextResult
**Removed:**
- `repositoryId` - Can look up by name
- `lastModified` - Rarely needed
- `binaryMetadata` - Unnecessary detail

**Token Savings:** ~15-20 tokens per result

#### RepositoryInfo
**Removed:**
- `id` - Internal UUID, can look up by name
- `commitSha` - Not needed for basic listing
- `ingestedAt` - Not needed for basic listing

**Token Savings:** ~40-60 tokens per repo

#### RepositoryStats (analyze command)
**Removed:**
- `repositoryId` - Can look up by name
- `path` - Not needed when querying by name
- `ingestedAt` - Metadata not critical for analysis

**Token Savings:** ~40-60 tokens per result

#### StatsResult (stats command)
**Removed:**
- `repositoryId` - Can look up by name
- `repositoryPath` - Not needed when querying by name
- `commitSha` - Not needed for basic stats
- `ingestedAt` - Not needed for basic stats

**Token Savings:** ~40-60 tokens per result

## Parameter Description Optimizations

**Shortened parameter descriptions:**
- "Natural language search query (e.g., ...)" → "Natural language query (e.g., ...)"
- "Optional: Filter results to a specific repository (name or path)" → "Optional: repository name/path filter"
- "Repository name, path, or numeric ID" → "Repository name, path, or ID"
- "Maximum number of results to return (default: 10)" → "Max results (default: 10)"

## Overall Token Savings

### Per-Request Savings
- **Tool descriptions:** ~40-60 tokens saved across all tools
- **Parameter descriptions:** ~30-50 tokens saved per tool invocation
- **Output format (no indentation):** ~25-35% reduction per result
- **Removed fields:** ~20-60 tokens per result depending on tool

### Example Calculation (search with 10 results)
- **Before:** ~3000-4000 tokens
- **After:** ~1800-2400 tokens
- **Savings:** ~40% reduction

### For Large Result Sets
With 50 search results:
- **Before:** ~15,000-20,000 tokens
- **After:** ~9,000-12,000 tokens
- **Savings:** ~8,000 tokens or ~40%

## Agent Usability Improvements

1. **Shorter names** - Easier to remember and type
2. **Action-focused descriptions** - Clear intent
3. **Concise output** - Faster parsing, less noise
4. **Essential fields only** - Focus on what agents actually use
5. **Consistent naming** - All tools follow same pattern (verb or noun)

## Backward Compatibility

These changes are **breaking** for existing MCP clients. If you need to support old tool names, you can add aliases in the server handler.

## Testing

After making these changes:
1. Test each tool with the MCP inspector
2. Verify output structure is valid JSON
3. Check that removed fields aren't critical for your use case
4. Update any client code that depends on removed fields

## Future Optimizations

Potential further optimizations:
1. Add pagination for large result sets (files list)
2. Add field filtering (let agents request only needed fields)
3. Consider compressed output format for very large results
4. Add result caching for repeated queries
