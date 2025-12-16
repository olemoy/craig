# ADR-002: File Processing Pipeline Architecture

## Status
Proposed

## Context
CRAIG must process diverse file types from repositories, with differentiated handling for:
- Text files (markdown, documentation)
- Code files (programming languages)
- Binary files (images, executables, archives)

The system needs efficient chunking, embedding generation, and deduplication.

## Decision
Implement a multi-stage pipeline with type-specific processing paths.

## Architecture

```
File Discovery → Type Detection → Processing Pipeline → Storage
                                         ↓
                        ┌────────────────┴────────────────┐
                        ↓                                 ↓
                Text/Code Path                      Binary Path
                        ↓                                 ↓
                Content Extraction              Metadata Extraction
                        ↓                                 ↓
                Smart Chunking                    (skip chunking)
                        ↓                                 ↓
                Embedding Generation              (skip embedding)
                        ↓                                 ↓
                Database Storage ←──────────────────────┘
```

## Components

### 1. File Type Detection
- Use file extension mapping
- Fallback to mime-type detection for ambiguous cases
- Categories: `text`, `code`, `binary`

### 2. Text/Code Processing Path
- **Content Extraction**: Read full file content
- **Smart Chunking**:
  - Respect language syntax (function/class boundaries for code)
  - Target chunk size: ~500 tokens with overlap
  - Preserve context at boundaries
- **Embedding Generation**:
  - Use Transformers.js with Xenova/all-MiniLM-L6-v2
  - Batch processing for efficiency
  - Normalize embeddings before storage

### 3. Binary Processing Path
- **Metadata Only**:
  - File size
  - Mime type
  - File hash (SHA-256)
  - Path and location
- **No Content Storage**: Content field NULL
- **No Chunking/Embedding**: Skip entirely

### 4. Deduplication Strategy
- Content-based hashing (SHA-256)
- Check hash before processing
- Update metadata if file unchanged

## File Type Mappings

### Code Files
```typescript
const CODE_EXTENSIONS = {
  '.ts': 'typescript',
  '.js': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  // ... comprehensive list
};
```

### Text Files
```typescript
const TEXT_EXTENSIONS = [
  '.md', '.txt', '.rst', '.adoc',
  '.json', '.yaml', '.yml', '.toml',
  '.xml', '.html', '.css'
];
```

### Binary Files (Exclusion List)
```typescript
const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg',
  '.pdf', '.zip', '.tar', '.gz',
  '.exe', '.bin', '.so', '.dylib',
  '.wasm', '.o', '.a'
];
```

## Error Handling
- Graceful degradation for unreadable files
- Log warnings for unknown file types
- Continue processing on individual file failures

## Performance Considerations
- Stream large files rather than loading fully into memory
- Batch embedding generation (groups of 10-20 chunks)
- Parallel file processing with worker pool
- Progress reporting for long operations
