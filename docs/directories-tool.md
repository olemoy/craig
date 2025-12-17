# Directories Tool

Returns directory structure without files - useful for understanding repository organization.

## Basic Usage

### Get All Directories
```json
{
  "repository": "my-app"
}
```

**Response:**
```json
{
  "repository": "my-app",
  "directories": [
    "docs",
    "src",
    "src/components",
    "src/utils",
    "src/utils/helpers",
    "tests",
    "tests/unit",
    "tests/integration"
  ]
}
```

## Parameters

### `repository` (required)
Repository name, path, or ID

### `path` (optional)
Filter to directories under a specific path

**Example:**
```json
{
  "repository": "my-app",
  "path": "src"
}
```

**Response:**
```json
{
  "repository": "my-app",
  "directories": [
    "src",
    "src/components",
    "src/utils",
    "src/utils/helpers"
  ]
}
```

### `depth` (optional)
Maximum depth from root (0 = root level only, 1 = one level down, etc.)

**Example - Root level only (depth=0):**
```json
{
  "repository": "my-app",
  "depth": 0
}
```

**Response:**
```json
{
  "repository": "my-app",
  "directories": [
    "docs",
    "src",
    "tests"
  ]
}
```

**Example - One level down (depth=1):**
```json
{
  "repository": "my-app",
  "depth": 1
}
```

**Response:**
```json
{
  "repository": "my-app",
  "directories": [
    "docs",
    "src",
    "src/components",
    "src/utils",
    "tests",
    "tests/unit",
    "tests/integration"
  ]
}
```

## Combining Parameters

You can combine `path` and `depth` to focus on specific parts of the structure:

```json
{
  "repository": "my-app",
  "path": "src",
  "depth": 1
}
```

**Response:**
```json
{
  "repository": "my-app",
  "directories": [
    "src",
    "src/components",
    "src/utils"
  ]
}
```

This shows only directories under `src/` and limits depth to 1 level down from root.

## Use Cases

### 1. Repository Overview
Get a high-level view of repository organization:
```json
{ "repository": "my-app", "depth": 0 }
```

### 2. Explore Subdirectories
Navigate deeper into specific areas:
```json
{ "repository": "my-app", "path": "src", "depth": 1 }
```

### 3. Build Navigation UI
Create a hierarchical navigation tree:
```javascript
const result = await directories({ repository: "my-app" });
const tree = buildTree(result.directories);
```

### 4. Find Test Structure
Understand test organization:
```json
{ "repository": "my-app", "path": "tests" }
```

### 5. Compare Module Organization
See how different modules are structured:
```javascript
const srcStructure = await directories({ repository: "my-app", path: "src" });
const testStructure = await directories({ repository: "my-app", path: "tests" });
```

## Output Format

- **Sorted alphabetically** - Directories appear in alphabetical order
- **Relative paths** - All paths relative to repository root
- **No trailing slashes** - Paths like `src/components`, not `src/components/`
- **No duplicates** - Each directory appears only once
- **Empty directories excluded** - Only directories containing files are shown

## Token Efficiency

The directories tool is extremely token-efficient compared to getting full file listings:

### Files Tool (100 files across 20 directories)
```json
{
  "repository": "my-app",
  "fileCount": 100,
  "files": [
    "src/components/Button.tsx",
    "src/components/Input.tsx",
    ... 98 more files
  ]
}
```
**Token count:** ~1,000 tokens

### Directories Tool (same repository)
```json
{
  "repository": "my-app",
  "directories": [
    "docs",
    "src",
    "src/components",
    ... 17 more directories
  ]
}
```
**Token count:** ~60 tokens

**Savings:** ~94% reduction (940 tokens saved)

## Examples

### Example 1: Monorepo Structure
```json
{
  "repository": "my-monorepo",
  "depth": 1
}
```

**Response:**
```json
{
  "repository": "my-monorepo",
  "directories": [
    "apps",
    "apps/admin",
    "apps/client",
    "packages",
    "packages/api",
    "packages/mobile",
    "packages/web"
  ]
}
```

### Example 2: Source Code Organization
```json
{
  "repository": "backend-service",
  "path": "src",
  "depth": 2
}
```

**Response:**
```json
{
  "repository": "backend-service",
  "directories": [
    "src",
    "src/controllers",
    "src/controllers/api",
    "src/models",
    "src/services",
    "src/services/auth",
    "src/utils"
  ]
}
```

### Example 3: Documentation Structure
```json
{
  "repository": "my-project",
  "path": "docs"
}
```

**Response:**
```json
{
  "repository": "my-project",
  "directories": [
    "docs",
    "docs/api",
    "docs/guides",
    "docs/reference",
    "docs/tutorials"
  ]
}
```

## Comparison with Files Tool

| Aspect | `directories` | `files` |
|--------|---------------|---------|
| Returns | Directory paths only | File paths only |
| Token usage | Very low (~3 per dir) | Low (~10 per file) |
| Depth control | Yes, via `depth` parameter | No |
| Best for | Understanding structure | Locating specific files |
| Performance | Fast (dedupes from files) | Fast (direct query) |

## Tips

1. **Start broad, then narrow** - Use `depth: 0` first to see root level, then explore deeper
2. **Combine with files tool** - Get directory structure first, then list files in specific directories
3. **Cache results** - Directory structure changes infrequently, cache it
4. **Use for navigation** - Build UI navigation from directory structure
5. **Filter early** - Use `path` parameter to focus on relevant areas

## Implementation Notes

- Directories are derived from file paths (no separate directory table)
- Only directories containing files are returned
- Empty directories (no files) won't appear
- Depth is counted from repository root: 0=root level, 1=one level down, etc.
- Sorting is natural alphabetical order
