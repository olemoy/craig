# Ollama Integration

Craig supports using Ollama for generating embeddings instead of Transformers.js. This provides several benefits:

- **Faster processing** on systems with good GPU support
- **Larger models** with better quality embeddings
- **More flexibility** in model choice
- **Reduced memory usage** in the Node.js process

## Setup

### 1. Install and Start Ollama

```bash
# Install Ollama (see https://ollama.ai)
# macOS/Linux:
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve
```

### 2. Pull an Embedding Model

```bash
# Recommended: nomic-embed-text (768 dimensions)
ollama pull nomic-embed-text

# Alternative: mxbai-embed-large (1024 dimensions)
ollama pull mxbai-embed-large

# Alternative: all-minilm (384 dimensions, smaller)
ollama pull all-minilm
```

### 3. Configure Craig

Create `config.json` from the example:

```bash
cp config.example.json config.json
```

Edit `config.json` to use Ollama:

```json
{
  "embedding": {
    "provider": "ollama",
    "transformers": {
      "model": "Xenova/all-MiniLM-L6-v2",
      "dimensions": 384
    },
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "nomic-embed-text",
      "dimensions": 768,
      "options": {
        "temperature": 0
      }
    }
  }
}
```

**Important:** Make sure the `dimensions` field matches your chosen model!

### 4. Test Configuration

```bash
# Show current config
bun cli config show

# Test connectivity and embedding generation
bun cli config test
```

## Model Recommendations

### nomic-embed-text (Recommended)
- **Dimensions:** 768
- **Size:** ~274MB
- **Performance:** Excellent quality/speed balance
- **Use case:** General purpose, best for most repositories

```json
{
  "model": "nomic-embed-text",
  "dimensions": 768
}
```

### mxbai-embed-large
- **Dimensions:** 1024
- **Size:** ~669MB
- **Performance:** Higher quality, slower
- **Use case:** Large codebases where quality is critical

```json
{
  "model": "mxbai-embed-large",
  "dimensions": 1024
}
```

### all-minilm
- **Dimensions:** 384
- **Size:** ~46MB
- **Performance:** Fast, lower quality
- **Use case:** Quick testing, smaller repositories

```json
{
  "model": "all-minilm",
  "dimensions": 384
}
```

## Switching Between Providers

You can switch between Transformers.js and Ollama by changing the `provider` field:

```json
{
  "embedding": {
    "provider": "transformers"  // or "ollama"
  }
}
```

**Note:** Switching providers after ingesting data will cause compatibility issues. Embeddings from different models/providers cannot be compared. If you switch providers, you'll need to re-ingest your repositories.

## Troubleshooting

### "Cannot connect to Ollama"
- Make sure Ollama is running: `ollama serve`
- Check the baseUrl in config.json
- Try: `curl http://localhost:11434/api/tags`

### "Model not found"
- Pull the model: `ollama pull nomic-embed-text`
- List available models: `ollama list`
- Check spelling in config.json

### Slow Performance
- Check if Ollama is using GPU: Look for "cuda" or "metal" in logs
- Try a smaller model like `all-minilm`
- Reduce batch size (automatically handled)

## Performance Comparison

Based on typical repository ingestion:

| Provider | Model | Speed | Quality | Memory |
|----------|-------|-------|---------|--------|
| Transformers.js | all-MiniLM-L6-v2 | Medium | Good | High |
| Ollama | nomic-embed-text | Fast* | Excellent | Low |
| Ollama | mxbai-embed-large | Medium* | Excellent | Low |

\* With GPU acceleration. CPU-only may be slower than Transformers.js.

## Configuration Options

### Ollama Options

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "nomic-embed-text",
    "dimensions": 768,
    "options": {
      "temperature": 0,
      "num_ctx": 2048,
      "num_gpu": 1
    }
  }
}
```

- `baseUrl`: Ollama API endpoint
- `model`: Model name (must be pulled first)
- `dimensions`: Embedding vector size (must match model)
- `options`: Additional Ollama parameters
  - `temperature`: Controls randomness (0 for deterministic)
  - `num_ctx`: Context window size
  - `num_gpu`: Number of GPUs to use

## Example Workflow

```bash
# 1. Setup Ollama
ollama serve  # In one terminal
ollama pull nomic-embed-text

# 2. Configure Craig
cp config.example.json config.json
# Edit config.json to set provider: "ollama"

# 3. Test configuration
bun cli config test

# 4. Ingest repository
bun cli ingest /path/to/repo --name myrepo

# 5. Query the repository
bun cli query "authentication logic" --repo myrepo
```
