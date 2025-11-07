# RAG (Retrieval-Augmented Generation) Setup Guide

## What is RAG?

RAG (Retrieval-Augmented Generation) enhances the chatbot by:
1. **Retrieving relevant data** based on the question's meaning (semantic search)
2. **Finding similar past questions** and their answers
3. **Providing actual data context** instead of just metadata
4. **Improving accuracy** by grounding answers in real data

## How It Works

### 1. Data Chunking (On Upload)
When a file is uploaded:
- Data is chunked into:
  - **Column descriptions**: What each column represents
  - **Statistical patterns**: Min, max, avg, median for numeric columns
  - **Row groups**: Sample rows with context
- Chunks are stored in a vector store (in-memory, per session)

### 2. Embedding Generation (Background)
- Each chunk is converted to an embedding (vector representation)
- Embeddings capture semantic meaning
- Generated in background (non-blocking)

### 3. Retrieval (On Question)
When user asks a question:
- Question is converted to an embedding
- Semantic search finds most relevant chunks (cosine similarity)
- Hybrid search combines semantic + keyword matching
- Top 5 most relevant chunks are retrieved

### 4. Augmented Generation
- Retrieved chunks are added to the AI prompt
- AI generates answer grounded in actual data
- More accurate and context-aware responses

## Azure OpenAI Setup

### Required: Embeddings Deployment

You need to create an **embeddings deployment** in Azure OpenAI:

1. Go to Azure Portal → Your OpenAI Resource
2. Navigate to "Deployments" or "Model deployments"
3. Create a new deployment:
   - **Model**: `text-embedding-ada-002` (recommended) or `text-embedding-3-small`
   - **Deployment name**: e.g., `text-embedding-ada-002`
   - **Version**: Latest

### Environment Variables

The embedding model is configured in `server/lib/ragService.ts`:

```typescript
const EMBEDDING_MODEL = 'text-embedding-ada-002';
```

**Important**: Make sure this matches your Azure OpenAI deployment name!

If your deployment has a different name, update it:

```typescript
const EMBEDDING_MODEL = 'your-embedding-deployment-name';
```

## How to Verify RAG is Working

### 1. Check Logs
On file upload, you should see:
```
📚 Initializing RAG for semantic search...
✅ RAG initialized - embeddings will be generated in background
```

### 2. Test Semantic Search
Ask questions that require understanding data patterns:
- "What are the trends in the data?"
- "Show me outliers"
- "What columns are most important?"

The AI should reference actual data patterns, not just metadata.

### 3. Check for Retrieved Context
In the AI prompt (check server logs), you should see:
```
RETRIEVED RELEVANT DATA CONTEXT:
1. [column] Column "Revenue" (numeric): ...
2. [statistical] Statistical summary for "Revenue": ...
```

## Troubleshooting

### Issue: "Error generating embedding"
**Solution**: 
- Check if embeddings deployment exists in Azure OpenAI
- Verify deployment name matches `EMBEDDING_MODEL` in `ragService.ts`
- Check Azure OpenAI API key and endpoint

### Issue: RAG not working, no retrieved context
**Solution**:
- Check server logs for RAG errors
- Verify embeddings are being generated (check logs)
- Ensure sessionId is being passed correctly

### Issue: Slow responses
**Solution**:
- Embeddings are generated in background (non-blocking)
- First question might be slower if embeddings aren't ready
- Subsequent questions should be fast (embeddings cached)

## Performance Notes

1. **First Question**: Might be slower if embeddings are still generating
2. **Subsequent Questions**: Fast (embeddings cached)
3. **Memory**: In-memory vector store (cleared on new upload)
4. **Scalability**: For production, consider moving to CosmosDB vector search

## Future Enhancements

1. **Persistent Storage**: Store embeddings in CosmosDB
2. **Vector Index**: Use vector index for faster search
3. **Re-ranking**: Add cross-encoder for better relevance
4. **Caching**: Cache question embeddings
5. **Batch Processing**: Optimize embedding generation

## Cost Considerations

- Embeddings API calls: ~$0.0001 per 1K tokens
- Typical dataset: ~50-200 chunks = ~$0.01-0.05 per upload
- Very cost-effective for improved accuracy

## Architecture

```
Upload File
    ↓
Chunk Data (columns, stats, rows)
    ↓
Generate Embeddings (background)
    ↓
Store in Vector Store (in-memory)
    ↓
[User asks question]
    ↓
Generate Question Embedding
    ↓
Semantic Search (cosine similarity)
    ↓
Retrieve Top-K Chunks
    ↓
Augment AI Prompt
    ↓
Generate Grounded Answer
```

