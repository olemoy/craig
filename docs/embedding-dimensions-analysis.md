# Embedding Dimensions Analysis

Understanding the tradeoffs between 384, 768, and 1024-dimensional embeddings for code search.

## Quick Answer

**For most code search use cases, 384 dimensions is likely sufficient.** The jump to 1024 dimensions offers marginal improvements but comes with real costs.

## Detailed Breakdown

### What Dimensions Represent

Each dimension in an embedding vector captures a different aspect of the semantic meaning:
- Low dimensions (384): Capture broad concepts and relationships
- High dimensions (1024): Capture finer-grained nuances and distinctions

Think of it like image resolution:
- 384D = 720p video (good enough for most purposes)
- 768D = 1080p video (noticeably better in some cases)
- 1024D = 4K video (great, but do you need it?)

### Theoretical Benefits of Higher Dimensions

#### 1. Better Semantic Distinction
**384 dimensions:**
```
"calculate user age" → [0.23, -0.45, 0.67, ...]
"compute user age"   → [0.24, -0.44, 0.68, ...]  // Very similar
```

**1024 dimensions:**
```
"calculate user age" → [0.23, -0.45, 0.67, ..., 0.12, -0.89, ...]
"compute user age"   → [0.24, -0.44, 0.68, ..., 0.09, -0.91, ...]  // More distinct
```

The model can capture subtle differences between:
- "fix bug" vs "patch issue" vs "resolve problem"
- "authenticate user" vs "verify credentials" vs "validate login"

#### 2. Better Context Preservation
Higher dimensions can preserve more context from the original text:
- Function signatures AND implementation details
- Architectural patterns AND specific implementations
- Domain concepts AND technical details

#### 3. Reduced "Collision" Risk
With more dimensions, less chance of unrelated code getting similar embeddings.

### Real-World Impact for Code Search

Let's be honest about what matters:

#### Scenarios Where Higher Dimensions Help (1024D)

1. **Large, Complex Codebases**
   - 100,000+ files
   - Multiple similar modules (e.g., 50 different API clients)
   - Need to distinguish between very similar code patterns

2. **Fine-Grained Retrieval**
   - "Find the React component that validates email AND shows inline errors"
   - vs "Find the React component that validates email" (broader)
   - Higher dimensions help with multi-faceted queries

3. **Cross-Language Code Search**
   - Searching across JavaScript, TypeScript, Python, Java, etc.
   - More dimensions help capture language-specific idioms while preserving semantic similarity

4. **Advanced RAG Scenarios**
   - Generating code based on complex requirements
   - Need precise context retrieval for LLM prompts
   - Every bit of accuracy helps reduce hallucinations

#### Scenarios Where 384D is Fine

1. **Most Codebases**
   - < 10,000 files
   - Standard web applications
   - Typical retrieval: "find authentication code", "where is error handling"

2. **Simple Queries**
   - Keyword-like searches
   - Finding specific function names or concepts
   - 384D already captures these well

3. **Prototyping/MVPs**
   - Faster iteration
   - Lower resource requirements
   - Good enough to validate the approach

### Practical Costs of Higher Dimensions

#### 1. Storage Cost

```
For 10,000 chunks:

384D:  10,000 × 384 × 4 bytes = 15.4 MB
768D:  10,000 × 768 × 4 bytes = 30.7 MB  (2x)
1024D: 10,000 × 1024 × 4 bytes = 40.9 MB (2.7x)

For 1,000,000 chunks (large enterprise codebase):

384D:  1.5 GB
768D:  3.1 GB
1024D: 4.1 GB
```

Storage is cheap, but this affects:
- RAM usage during search
- Database size
- Backup sizes
- Transfer speeds

#### 2. Query Performance

Vector similarity computation scales with dimensions:

```
Cosine similarity for one comparison:

384D:  ~384 multiplications + 384 additions
1024D: ~1024 multiplications + 1024 additions (2.7x slower)

For searching 10,000 chunks:
384D:  ~5-10ms
1024D: ~15-25ms (2-3x slower)
```

This compounds with:
- Number of chunks to search
- Frequency of queries
- Concurrent users

#### 3. Indexing Performance

Creating embeddings takes longer:

```
Embedding generation speed (approximate, with Ollama on GPU):

384D:  ~50 chunks/second
768D:  ~40 chunks/second
1024D: ~30 chunks/second
```

For ingestion of 500 chunks:
- 384D: ~10 seconds
- 1024D: ~17 seconds

#### 4. Model Size & Startup Time

```
Model weights on disk:

all-MiniLM-L6-v2 (384D):     ~90 MB
nomic-embed-text (768D):     ~275 MB
mxbai-embed-large (1024D):   ~670 MB
```

Affects:
- Initial model download time
- Memory footprint
- Cold start latency

## Benchmark Studies (External Research)

Research on embedding dimensions shows:

1. **Retrieval Accuracy**
   - 384D → 768D: ~5-10% improvement in nDCG@10
   - 768D → 1024D: ~2-5% improvement in nDCG@10
   - Diminishing returns at higher dimensions

2. **Task-Specific Results**
   - Code search: 384D often sufficient
   - Natural language QA: 768D+ shows benefits
   - Cross-lingual: Higher dimensions help more

## Recommendations for CRAIG

### Start with 384D
**Rationale:**
- Fast iteration
- Proven to work well for code search
- Lower resource requirements
- Current schema already supports it

### Consider 768D/1024D If:
1. You have a large codebase (>50,000 files)
2. You're consistently getting poor retrieval results with 384D
3. You have GPU resources available (makes the performance hit manageable)
4. You're building advanced RAG features that need precise context

### Implementation Strategy

```typescript
// Make dimensions configurable per repository
interface Repository {
  id: number;
  name: string;
  embedding_model: string;     // "all-MiniLM-L6-v2"
  embedding_dimensions: number; // 384
  // ...
}
```

This allows:
- Testing different dimensions on different repos
- A/B testing retrieval quality
- Gradual migration
- User choice based on their needs

## Testing Plan

Before committing to higher dimensions, benchmark:

1. **Retrieval Quality**
   ```bash
   # Create test queries for your codebase
   # Compare top-10 results between 384D and 1024D
   # Measure: precision, recall, nDCG
   ```

2. **Performance**
   ```bash
   # Ingestion time for 1000 files
   # Query latency for 10,000 chunks
   # Memory usage during search
   ```

3. **User Experience**
   ```bash
   # Does higher dimension actually help developers find code faster?
   # Run A/B test with real users
   ```

## Conclusion

**384 dimensions is a great default.** Only move to higher dimensions if you:
1. Have measured data showing 384D is insufficient
2. Have the infrastructure to handle the costs
3. Have a specific use case that benefits from finer-grained embeddings

The biggest wins in code search come from:
- Good chunking strategy (✅ you have this)
- Relevant context in chunks
- Query understanding
- Re-ranking strategies

Dimensions are just one factor, and often not the bottleneck.

## References

- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) - Benchmark different embedding models
- "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks" (Reimers & Gurevych, 2019)
- Pinecone's analysis: "The Curse of Dimensionality in Vector Search"
