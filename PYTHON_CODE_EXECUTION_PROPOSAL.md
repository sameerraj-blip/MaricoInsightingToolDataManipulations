# Python Code Execution for Data Analysis - Proposal

## Current Problem

The query "which was the best month for PA TOM?" is returning aggregate statistics instead of identifying the specific month. While we've fixed the "best" recognition issue, there's a deeper question: **Should we use AI-generated Python code for complex data extraction?**

## The Question

**User's Point**: For complex data extraction, should the AI generate Python code and execute it, rather than hardcoding logic in TypeScript?

## Two Approaches

### Approach 1: TypeScript Logic (Current)
**Pros:**
- ✅ Fast execution (no code generation overhead)
- ✅ Type-safe
- ✅ Easy to debug
- ✅ No security risks (no code execution)
- ✅ Works for simple operations (max, min, average, filtering)

**Cons:**
- ❌ Need to code every operation type
- ❌ Hard to handle complex queries
- ❌ Not flexible for novel requests
- ❌ Maintenance burden

### Approach 2: AI-Generated Python Code Execution
**Pros:**
- ✅ Extremely flexible - handles ANY query
- ✅ AI can generate complex pandas/numpy operations
- ✅ No need to code every operation type
- ✅ Can handle novel, complex queries automatically
- ✅ Natural language → code → results

**Cons:**
- ❌ Security risk (code execution)
- ❌ Slower (code generation + execution)
- ❌ Error handling complexity
- ❌ Need Python runtime in production
- ❌ Debugging AI-generated code is harder

## Hybrid Approach (Recommended)

**Use TypeScript for simple operations, AI-generated code for complex ones:**

### Simple Operations (TypeScript - Current)
- Max, min, average, sum, count
- Basic filtering
- Simple aggregations
- "Which month had highest X?" ✅ (just fixed)

### Complex Operations (AI-Generated Python)
- Multi-step filtering with complex conditions
- Group by multiple dimensions
- Complex aggregations
- Data transformations
- Joins/merges
- Statistical tests
- Time series analysis

## Implementation Strategy

### Phase 1: Keep TypeScript for Simple Queries ✅
- Statistical queries (max, min, avg) - DONE
- Basic filtering - DONE
- Simple aggregations - DONE

### Phase 2: Add Python Execution for Complex Queries
1. **Detect Complexity**: If query requires complex operations, use Python
2. **Generate Code**: AI generates pandas/numpy code
3. **Execute Safely**: Sandboxed Python execution
4. **Return Results**: Parse results and return to user

### Example Flow

```
User: "Show me the average PA TOM for each quarter, but only include months where competitor spend was above 50k"

1. Intent Classifier: Detects complex multi-step query
2. Complexity Detector: Flags as "complex" (group by + filter + aggregation)
3. Code Generator: AI generates Python code:
   ```python
   import pandas as pd
   df = pd.DataFrame(data)
   filtered = df[df['Competitor Spend'] > 50000]
   result = filtered.groupby('Quarter')['PA TOM'].mean()
   return result.to_dict()
   ```
4. Execute: Run in sandboxed Python environment
5. Return: Format results as answer + chart
```

## Security Considerations

1. **Sandboxed Execution**: Use isolated Python environment
2. **Code Validation**: Check for dangerous operations (file I/O, network, etc.)
3. **Time Limits**: Kill long-running code
4. **Resource Limits**: Memory/CPU limits
5. **Whitelist Libraries**: Only allow pandas, numpy, scipy (no os, sys, subprocess)

## When to Use Each

### Use TypeScript (Current System)
- ✅ Simple statistical queries
- ✅ Basic filtering
- ✅ Standard aggregations
- ✅ Performance-critical operations

### Use AI-Generated Python
- ✅ Complex multi-step queries
- ✅ Novel operations we haven't coded
- ✅ Advanced statistical analysis
- ✅ Data transformations
- ✅ When TypeScript logic would be too complex

## Recommendation

**Start with TypeScript for 80% of queries, add Python for the remaining 20% complex ones.**

1. **Keep current TypeScript handlers** for simple operations (they're fast and reliable)
2. **Add Python execution layer** for complex queries that TypeScript can't handle
3. **Use AI to decide**: Intent classifier can flag queries as "complex" → route to Python executor
4. **Gradual migration**: Move complex operations to Python as needed

## Implementation Plan

### Step 1: Add Complexity Detection
- Enhance intent classifier to detect complex queries
- Add `complexity: 'simple' | 'complex'` to AnalysisIntent

### Step 2: Create Python Executor
- `server/lib/agents/executors/pythonExecutor.ts`
- Sandboxed Python execution
- Code validation
- Error handling

### Step 3: Create Code Generator
- `server/lib/agents/codeGenerator.ts`
- AI generates pandas/numpy code from intent
- Validates code before execution

### Step 4: Integrate
- Route complex queries to Python executor
- Keep simple queries in TypeScript handlers

## Example: "Best Month" Query

**Current (TypeScript)**: ✅ Works now after fix
- Fast, reliable, no code generation needed

**If we used Python**: Would generate:
```python
df = pd.DataFrame(data)
max_row = df.loc[df['PA TOM'].idxmax()]
return max_row['Month']
```

**Verdict**: TypeScript is better for this simple case - faster, simpler, no overhead.

## Conclusion

**For "best month" queries**: TypeScript is perfect ✅ (just needed to recognize "best")

**For complex queries**: Python execution would be powerful, but:
- Add security overhead
- Add complexity
- Slower execution
- Only needed for ~20% of queries

**Recommendation**: Keep TypeScript for simple queries, add Python executor for truly complex ones that TypeScript can't handle.

