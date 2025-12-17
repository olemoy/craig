# Files Tool Optimization

## Changes Made

### Before
```json
{
  "repository": "my-repo",
  "repositoryId": "uuid-here",
  "repositoryPath": "/full/path/to/repo",
  "fileCount": 3,
  "files": [
    {
      "filePath": "/full/path/to/repo/src/index.ts",
      "relativePath": "src/index.ts",
      "fileType": "code",
      "language": "typescript",
      "sizeBytes": 1234
    },
    {
      "filePath": "/full/path/to/repo/README.md",
      "relativePath": "README.md",
      "fileType": "text",
      "language": null,
      "sizeBytes": 567
    },
    {
      "filePath": "/full/path/to/repo/docs/guide.md",
      "relativePath": "docs/guide.md",
      "fileType": "text",
      "language": null,
      "sizeBytes": 890
    }
  ]
}
```

**Token count:** ~350 tokens for 3 files

### After
```json
{
  "repository": "my-repo",
  "fileCount": 3,
  "files": [
    "README.md",
    "docs/guide.md",
    "src/index.ts"
  ]
}
```

**Token count:** ~30 tokens for 3 files

**Savings:** ~91% reduction (320 tokens saved)

## Rationale for Removed Fields

### `repositoryId`
- Redundant when repository name is provided
- Can look up by name if UUID is needed
- Saves ~40 tokens per response

### `repositoryPath`
- Not needed for listing files
- Agents typically query by name, not path
- Saves ~20-30 tokens per response

### `filePath` (absolute)
- Replaced with relative path as the main value
- Absolute paths are verbose and redundant
- All paths in a repo share the same prefix

### `relativePath` field
- Now the `files` array is just strings (relative paths)
- No need for nested objects
- Massively reduces token usage

### `fileType`
- Can be inferred from file extension
  - `.ts`, `.js`, `.py` → code
  - `.md`, `.txt` → text
  - `.png`, `.jpg` → binary
- Not critical for most agent use cases
- Saves ~15 tokens per file

### `language`
- Can be inferred from file extension
  - `.ts` → typescript
  - `.py` → python
  - `.js` → javascript
- Not critical for listing files
- Saves ~15 tokens per file

### `sizeBytes`
- Rarely needed for file listing
- Can be fetched with `read_file` if needed
- Saves ~10 tokens per file

## New Optional Parameter: `path`

Filter files to a specific directory:

```json
{
  "repository": "my-repo",
  "path": "src/components"
}
```

Returns only files under `src/components/`:

```json
{
  "repository": "my-repo",
  "fileCount": 5,
  "files": [
    "src/components/Button.tsx",
    "src/components/Input.tsx",
    "src/components/Modal.tsx",
    "src/components/Select.tsx",
    "src/components/index.ts"
  ]
}
```

### Path Examples

- `"src/"` - All files under src directory
- `"docs/"` - All files under docs directory
- `"src/components"` - All files under src/components
- `""` or omitted - All files in repository

## Token Savings by Scale

| Files | Before | After | Savings |
|-------|--------|-------|---------|
| 10    | ~1,200 | ~100  | ~92%    |
| 50    | ~6,000 | ~500  | ~92%    |
| 100   | ~12,000| ~1,000| ~92%    |
| 500   | ~60,000| ~5,000| ~92%    |

## Use Cases

### 1. Explore Repository Structure
```javascript
// Get all files
const all = await files({ repository: "my-app" });

// Explore subdirectories
const srcFiles = await files({ repository: "my-app", path: "src" });
const testFiles = await files({ repository: "my-app", path: "tests" });
```

### 2. Find Files by Extension
```javascript
const files = await files({ repository: "my-app" });
const tsFiles = files.files.filter(f => f.endsWith('.ts'));
const mdFiles = files.files.filter(f => f.endsWith('.md'));
```

### 3. Build File Tree
```javascript
const result = await files({ repository: "my-app" });
const tree = {};
result.files.forEach(path => {
  const parts = path.split('/');
  // Build tree structure from parts
});
```

## Implementation Details

- Files are always sorted alphabetically
- Paths are always relative to repository root
- No trailing slashes in directory paths
- Binary files are included in the list (can filter by extension if needed)

## Migration Guide

If you're using the old format:

### Before
```javascript
const result = await files({ repository: "my-app" });
for (const file of result.files) {
  console.log(file.relativePath, file.fileType, file.language);
}
```

### After
```javascript
const result = await files({ repository: "my-app" });
for (const file of result.files) {
  // file is now just a string (relative path)
  console.log(file);

  // Infer type/language from extension if needed
  const ext = file.split('.').pop();
  const isCode = ['ts', 'js', 'py', 'go', 'rs'].includes(ext);
}
```
