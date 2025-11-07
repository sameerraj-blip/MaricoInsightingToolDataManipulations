# Testing Guide for Agent System Checkpoint 1

## 🧪 Test Scenarios

### Test 1: Conversational Queries ✅
**Purpose**: Verify conversational handler works

**Test Queries**:
1. "Hi"
2. "Hello"
3. "Thanks"
4. "What can you do?"

**Expected Behavior**:
- Should be classified as `conversational` intent
- Should get friendly, natural AI-generated responses
- No data analysis should occur

**How to Test**:
1. Upload a data file
2. Send one of the test queries
3. Check console logs for: `🤖 Using new agent system`
4. Check console logs for: `🎯 Intent: conversational`
5. Verify response is conversational (not data analysis)

---

### Test 2: Correlation Queries ✅
**Purpose**: Verify correlation handler works with filters

**Test Queries**:
1. "What affects revenue?"
2. "What affects revenue? Only show positive correlations"
3. "What affects revenue? Don't include negative correlations"
4. "What affects sales? Exclude marketing spend"

**Expected Behavior**:
- Should be classified as `correlation` intent
- Should extract target variable (revenue, sales)
- Should apply filters correctly
- Should generate correlation charts and insights

**How to Test**:
1. Upload a data file with numeric columns (revenue, sales, marketing spend, etc.)
2. Send test query
3. Check console logs:
   - `🤖 Using new agent system`
   - `🎯 Intent: correlation (confidence: X)`
   - `✅ Routing to handler: CorrelationHandler`
4. Verify response includes:
   - Answer mentioning the target variable
   - Charts (scatter plots, bar charts)
   - Insights about correlations

---

### Test 3: Context References ✅
**Purpose**: Verify context resolver works

**Test Flow**:
1. First query: "What affects revenue?"
2. Second query: "Make that prettier" or "Show me that chart again"

**Expected Behavior**:
- Second query should resolve "that" to the previous chart
- Should understand context from conversation history

**How to Test**:
1. Upload data file
2. Ask: "What affects revenue?"
3. Wait for response with charts
4. Ask: "Show me that chart again"
5. Check console logs for: `✅ Resolved context reference`
6. Verify response references the previous chart

---

### Test 4: Error Handling ✅
**Purpose**: Verify error recovery works

**Test Queries**:
1. "What affects nonexistent_column?"
2. "Analyze invalid_variable"

**Expected Behavior**:
- Should detect column doesn't exist
- Should suggest similar column names
- Should return helpful error message (not crash)

**How to Test**:
1. Upload data file
2. Send query with non-existent column
3. Check console logs for validation errors
4. Verify response includes:
   - Helpful error message
   - Suggestions for similar columns
   - No crash/exception

---

### Test 5: Fallback to Legacy System ✅
**Purpose**: Verify fallback works if agent system fails

**How to Test**:
1. Temporarily break agent system (e.g., comment out handler registration)
2. Send any query
3. Check console logs for: `⚠️ Agent system error, falling back to legacy system`
4. Verify response still works (from legacy system)

---

## 🔍 Debugging Tips

### Check Console Logs

Look for these log messages:

**Success Indicators**:
- `🤖 Using new agent system`
- `🎯 Intent: [type] (confidence: X)`
- `✅ Routing to handler: [HandlerName]`
- `✅ Intent classified: [type]`

**Warning Indicators**:
- `⚠️ Agent system error, falling back to legacy system`
- `⚠️ Validation warnings`
- `❓ Low confidence, asking for clarification`

**Error Indicators**:
- `❌ Intent classification failed`
- `❌ Handler execution failed`
- `❌ Orchestrator error`

### Common Issues

1. **"Cannot find module './agents/index.js'"**
   - Check file paths are correct
   - Verify TypeScript compilation

2. **"Handler not found"**
   - Check handlers are registered in `index.ts`
   - Verify `canHandle()` method returns true

3. **"Intent classification fails"**
   - Check OpenAI API key is set
   - Check Azure OpenAI configuration
   - Verify model name is correct

4. **"Column not found"**
   - Check column names match exactly (case-insensitive)
   - Verify data file has the expected columns

---

## 📊 Test Data Requirements

For comprehensive testing, use a data file with:

- **Numeric columns**: revenue, sales, marketing_spend, etc.
- **Date columns**: date, month, week, etc.
- **Categorical columns**: region, product_type, etc.
- **At least 10-20 rows** of data

**Sample CSV**:
```csv
date,revenue,sales,marketing_spend,region
2024-01-01,1000,500,200,North
2024-01-02,1200,600,250,South
...
```

---

## ✅ Success Criteria

The checkpoint is successful if:

1. ✅ Conversational queries work (greetings, thanks)
2. ✅ Correlation queries work ("What affects X?")
3. ✅ Filters work ("only positive", "don't include negative")
4. ✅ Error handling works (helpful messages, no crashes)
5. ✅ Fallback to legacy system works
6. ✅ No console errors (only warnings are acceptable)
7. ✅ Responses are natural and helpful

---

## 🚀 Quick Test Commands

### Start the server:
```bash
cd server
npm run dev
```

### Test via API:
```bash
# Upload file first, then:
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your_session_id",
    "message": "What affects revenue?",
    "chatHistory": []
  }'
```

### Or use the frontend:
1. Start client: `cd client && npm run dev`
2. Upload a file
3. Try the test queries in the chat interface

---

## 📝 Test Checklist

- [ ] Conversational query: "Hi"
- [ ] Conversational query: "Thanks"
- [ ] Correlation query: "What affects revenue?"
- [ ] Correlation with filter: "What affects revenue? Only positive"
- [ ] Context reference: "Show me that chart"
- [ ] Error case: "What affects nonexistent?"
- [ ] Check console logs for agent system usage
- [ ] Verify no crashes
- [ ] Verify responses are helpful

---

## 🐛 If Something Doesn't Work

1. **Check console logs** - Look for error messages
2. **Verify environment variables** - Azure OpenAI config
3. **Check file paths** - All imports should resolve
4. **Test with simple query first** - "Hi" should always work
5. **Check handler registration** - Should see 3 handlers initialized

---

## 📞 Next Steps After Testing

Once testing is complete:
- Report any issues found
- Note which queries work/don't work
- Share console logs if errors occur
- We'll fix issues before moving to Phase 2

