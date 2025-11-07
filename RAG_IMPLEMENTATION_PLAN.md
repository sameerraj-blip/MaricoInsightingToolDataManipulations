# RAG Implementation Plan for Conversational Data Analysis

## Why RAG is Critical

### Current Problems:
1. **No Data Context**: Only metadata (column names, types) sent to AI - no actual data samples
2. **No Semantic Understanding**: Can't find relevant rows/patterns based on question meaning
3. **No Memory of Similar Questions**: Can't retrieve similar past questions/answers
4. **Inefficient**: Full dataset passed but not intelligently retrieved
5. **Limited Accuracy**: AI guesses without seeing actual data patterns

### RAG Benefits:
1. **Retrieve Relevant Data**: Find actual data rows/chunks relevant to the question
2. **Semantic Search**: Understand question intent and find matching data
3. **Better Context**: Only include relevant data in prompts (saves tokens, improves accuracy)
4. **Learn from Past**: Retrieve similar questions and their successful answers
5. **Hybrid Search**: Combine semantic + keyword matching for best results

## Architecture

```
User Question
    ↓
[1] Generate Embedding (OpenAI)
    ↓
[2] Semantic Search
    ├─→ Data Chunks (embedded rows/patterns)
    ├─→ Past Questions/Answers (similar conversations)
    └─→ Column Descriptions (semantic matching)
    ↓
[3] Retrieve Top-K Relevant Chunks
    ↓
[4] Augment Prompt with Retrieved Context
    ↓
[5] Generate Answer with Grounded Data
```

## Implementation Steps

### Step 1: Add Embedding Infrastructure
- Install: `@langchain/openai` or use OpenAI embeddings directly
- Create embedding service
- Generate embeddings for:
  - Data chunks (rows grouped intelligently)
  - Column descriptions
  - Past questions/answers

### Step 2: Data Chunking Strategy
- **Row-based chunks**: Group related rows (e.g., by category, time period)
- **Pattern chunks**: Extract statistical patterns, outliers, trends
- **Column chunks**: Semantic descriptions of what each column represents
- **Size**: ~500-1000 tokens per chunk

### Step 3: Vector Storage
- **Option A**: CosmosDB with vector search (if supported)
- **Option B**: In-memory vector store (for small datasets)
- **Option C**: Separate vector DB (Pinecone, Weaviate, Qdrant)
- Store: `{chunkId, embedding, metadata, content}`

### Step 4: Retrieval Function
- Semantic similarity search (cosine similarity)
- Hybrid search (semantic + keyword)
- Top-K retrieval (K=5-10 most relevant chunks)
- Re-ranking based on relevance

### Step 5: Integration
- Modify `answerQuestion()` to:
  1. Generate question embedding
  2. Retrieve relevant chunks
  3. Augment prompt with retrieved context
  4. Generate answer grounded in actual data

## Data Chunking Strategies

### 1. Row-Based Chunks
```typescript
// Group rows by category or time period
const chunks = [
  {
    type: 'row_group',
    content: 'Rows 1-100: Product A sales data...',
    metadata: { category: 'Product A', dateRange: '2024-01' },
    embedding: [...]
  }
]
```

### 2. Statistical Pattern Chunks
```typescript
// Extract patterns and insights
const chunks = [
  {
    type: 'pattern',
    content: 'Revenue shows 15% increase in Q2, driven by Product B...',
    metadata: { patternType: 'trend', column: 'Revenue' },
    embedding: [...]
  }
]
```

### 3. Column Description Chunks
```typescript
// Semantic descriptions of columns
const chunks = [
  {
    type: 'column',
    content: 'Revenue column: Total sales revenue in USD, ranges from $0 to $1M...',
    metadata: { columnName: 'Revenue', dataType: 'numeric' },
    embedding: [...]
  }
]
```

## Retrieval Strategies

### 1. Semantic Search
- Generate embedding for user question
- Find chunks with highest cosine similarity
- Return top-K most relevant

### 2. Hybrid Search
- Combine semantic similarity (70%)
- With keyword matching (30%)
- Better for specific column names, numbers

### 3. Multi-Stage Retrieval
- Stage 1: Broad semantic search (top 20)
- Stage 2: Re-rank with cross-encoder
- Stage 3: Return top-K (top 5-10)

## Integration Points

### Modify `generateGeneralAnswer()`:
```typescript
async function generateGeneralAnswer(
  data: Record<string, any>[],
  question: string,
  chatHistory: Message[],
  summary: DataSummary
) {
  // NEW: Retrieve relevant context
  const retrievedContext = await retrieveRelevantContext(
    question,
    data,
    summary,
    chatHistory
  );
  
  const prompt = `... 
  
  RETRIEVED DATA CONTEXT:
  ${retrievedContext.map(c => c.content).join('\n\n')}
  
  ...`;
}
```

## Performance Considerations

1. **Caching**: Cache embeddings for data chunks (don't regenerate on every query)
2. **Lazy Loading**: Only generate embeddings when needed
3. **Batch Processing**: Generate embeddings in batches
4. **Indexing**: Use vector index for fast similarity search

## Cost Optimization

1. **Selective Embedding**: Only embed relevant columns/chunks
2. **Caching**: Cache embeddings in CosmosDB
3. **Batch API**: Use OpenAI batch API for bulk embeddings
4. **Chunk Size**: Optimize chunk size to balance context vs tokens

## Next Steps

1. ✅ Create embedding service
2. ✅ Implement data chunking
3. ✅ Add vector storage (CosmosDB or in-memory)
4. ✅ Build retrieval function
5. ✅ Integrate into answerQuestion()
6. ✅ Add caching layer
7. ✅ Test and optimize

