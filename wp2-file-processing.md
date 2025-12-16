# Workpackage 2: File Processing Pipeline

## Objective
Implement file discovery, type detection, and processing pipeline that differentiates between text/code files and binary files.

## Acceptance Criteria
1. File discovery walks directory trees respecting .gitignore
2. File type detection (text/code/binary) works accurately
3. Content extraction for text/code files
4. Binary file metadata extraction (size, mime, hash)
5. Smart chunking with language-aware boundaries for code
6. Overlap preservation between chunks
7. Deduplication via content hashing
8. Progress tracking and reporting
9. Error handling for unreadable/corrupted files
10. Full test coverage including edge cases

## Key Files to Create
- `src/processing/discovery.ts` - File discovery and traversal
- `src/processing/type-detector.ts` - File type classification
- `src/processing/text-processor.ts` - Text/code file processing
- `src/processing/binary-processor.ts` - Binary file metadata extraction
- `src/processing/chunker.ts` - Smart chunking logic
- `src/processing/hasher.ts` - Content hashing utilities
- `src/processing/types.ts` - Processing-related types
- `src/processing/config.ts` - Processing configuration

## Dependencies
**Required packages:**
```json
{
  "ignore": "^5.3.0",
  "mime-types": "^2.1.35",
  "file-type": "^18.0.0"
}
```

## File Type Mappings
```typescript
const CODE_EXTENSIONS = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.go': 'go', '.rs': 'rust',
  '.java': 'java', '.cpp': 'cpp', '.c': 'c'
};

const TEXT_EXTENSIONS = [
  '.md', '.txt', '.json', '.yaml', '.yml'
];

const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.pdf', '.zip', '.exe'
];
```

## Chunking Strategy
- Target: ~500 tokens per chunk
- Overlap: 50 tokens
- Respect function/class boundaries for code
- Respect paragraph boundaries for text

## Testing
- File type detection for various extensions
- Chunking algorithm with different content types
- Binary files skip chunking
- Deduplication of unchanged files

## Dependencies
- WP1 (Database) for storing file/chunk records

## Provides To
- WP3 (chunks to embed)
- WP4 (file processing functionality)
