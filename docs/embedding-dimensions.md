# Embedding Dimensions - Critical Constraint

## The Problem

The database schema **hardcodes** the vector dimension to **384**:

```sql
-- src/db/migrations/001_initial_schema.sql
CREATE TABLE embeddings (
  embedding vector(384)  -- FIXED at 384 dimensions
);
```

This means you **CANNOT** change embedding dimensions without deleting the database and re-ingesting everything.

## Why This Matters

Different embedding models produce different vector dimensions:

| Model | Provider | Dimensions |
|-------|----------|------------|
| `Xenova/all-MiniLM-L6-v2` | Transformers.js | 384 ✅ |
| `all-minilm` | Ollama | 384 ✅ |
| `nomic-embed-text` | Ollama | 768 ❌ |
| `mxbai-embed-large` | Ollama | 1024 ❌ |
| `snowflake-arctic-embed` | Ollama | 1024 ❌ |

**You can ONLY use models with 384 dimensions with the current database.**

## Validation

CRAIG automatically validates dimension compatibility on startup. If you configure a model with the wrong dimensions, you'll get this error:

```
Error: Embedding dimension mismatch: config specifies 768 dimensions,
but database requires 384 dimensions.
Either:
  1. Update config.json to use a model with 384 dimensions, OR
  2. Delete the database (rm -rf data/) and update the migration
     to use vector(768), then re-ingest all repositories.
```

## Compatible Ollama Models (384 dimensions)

These Ollama models work out-of-the-box:

### `all-minilm`
```bash
ollama pull all-minilm
```

```json
{
  "embedding": {
    "provider": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "all-minilm",
      "dimensions": 384
    }
  }
}
```

**Pros:**
- Same dimensions as default Transformers.js model
- Fast inference
- Good quality embeddings

**Cons:**
- Smaller model, may have lower quality than larger models

## Using Different Dimensions (768, 1024, etc.)

If you want to use a model with different dimensions:

### Step 1: Update the Migration

Edit `src/db/migrations/001_initial_schema.sql`:

```sql
-- Change from:
embedding vector(384),

-- To (for example, 768 dimensions):
embedding vector(768),
```

### Step 2: Update the Validation

Edit `src/embeddings/pipeline.ts`:

```typescript
// Change from:
const REQUIRED_DIMENSIONS = 384;

// To:
const REQUIRED_DIMENSIONS = 768;
```

### Step 3: Delete Existing Database

```bash
rm -rf data/
```

### Step 4: Update Config

```json
{
  "embedding": {
    "provider": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "nomic-embed-text",
      "dimensions": 768
    }
  }
}
```

### Step 5: Re-ingest All Repositories

```bash
bun src/cli/index.ts ingest /path/to/repo --name my-repo
```

## Important Constraints

### ❌ Cannot Mix Dimensions

You **CANNOT** have embeddings with different dimensions in the same database:

```
❌ WRONG: Ingest repo1 with 384-dim model, then switch to 768-dim model for repo2
✅ CORRECT: Pick one dimension, stick with it for ALL repositories
```

### ❌ Cannot Search Across Different Models

Even if two models have the same dimensions, embeddings from different models are **NOT comparable**:

```
❌ WRONG: Ingest with Transformers.js (384), search with Ollama all-minilm (384)
✅ CORRECT: Use the same model for ingestion AND searching
```

### ✅ Can Switch Models (Same Dimensions)

If both models have 384 dimensions, you can switch, but you must **re-ingest everything**:

1. Delete database: `rm -rf data/`
2. Update config to new model
3. Re-ingest all repositories

The old embeddings are incompatible with the new model.

## Recommended Setup

### For Development (Default)
**Use Transformers.js** - No external dependencies, works offline:

```json
{
  "embedding": {
    "provider": "transformers",
    "transformers": {
      "model": "Xenova/all-MiniLM-L6-v2",
      "dimensions": 384
    }
  }
}
```

### For Production (Better Quality)
**Use Ollama with larger model** - Better embeddings, requires setup:

1. Install Ollama
2. Pull a model: `ollama pull nomic-embed-text`
3. Update migration to `vector(768)`
4. Update validation to `REQUIRED_DIMENSIONS = 768`
5. Configure Ollama:

```json
{
  "embedding": {
    "provider": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "nomic-embed-text",
      "dimensions": 768
    }
  }
}
```

6. Ingest repositories

### For Speed (384 dimensions)
**Use Ollama with all-minilm** - Same dimension, no migration needed:

```json
{
  "embedding": {
    "provider": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "all-minilm",
      "dimensions": 384
    }
  }
}
```

## Checking Model Dimensions

### Ollama
```bash
ollama show nomic-embed-text --parameters
```

Look for embedding dimension in the output.

### Or Test Programmatically
```bash
ollama run nomic-embed-text
>>> /bye

ollama embeddings nomic-embed-text "test"
```

Count the array length in the output.

## Migration Path

If you already have data and want to switch dimensions:

1. **Export repo list:**
   ```bash
   bun src/cli/index.ts list > repos.txt
   ```

2. **Update migration and validation** (see steps above)

3. **Delete database:**
   ```bash
   rm -rf data/
   ```

4. **Update config** with new model

5. **Re-ingest repositories:**
   ```bash
   # Read repos from repos.txt and re-ingest each one
   bun src/cli/index.ts ingest /path/to/repo1
   bun src/cli/index.ts ingest /path/to/repo2
   ```

## Summary

✅ **DO:**
- Use models with 384 dimensions (default setup)
- Re-ingest everything when changing models
- Delete database when changing dimensions
- Stick with one model for all repositories

❌ **DON'T:**
- Mix different dimensions in same database
- Change models without re-ingesting
- Compare embeddings from different models
- Try to migrate embeddings between dimensions
