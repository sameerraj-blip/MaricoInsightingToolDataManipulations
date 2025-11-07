# Fundamental Architecture Principles

## Core Principle

**WE ARE BUILDING A GENERAL-PURPOSE AI ANALYST - NOT A SPECIFIC SOLUTION**

### Critical Requirements

1. **ANY Dataset**: The system must work with:
   - Any column names (not hardcoded to "PA", "PAB", etc.)
   - Any data structure (time series, cross-sectional, panel data, etc.)
   - Any domain (marketing, finance, operations, healthcare, etc.)
   - Any data types (numeric, categorical, dates, text, etc.)

2. **ANY Question**: The system must understand:
   - Natural language queries without domain-specific patterns
   - Complex multi-part questions
   - Context-dependent references ("that chart", "the previous analysis")
   - Implicit relationships and constraints
   - Domain-specific terminology (learned from data, not hardcoded)

3. **NO Hardcoding**: 
   - ❌ NO hardcoded brand names, column names, or patterns
   - ❌ NO domain-specific logic (e.g., "sister brands", "campaigns")
   - ❌ NO assumption about data structure
   - ✅ YES: General-purpose intent understanding
   - ✅ YES: Dynamic column matching
   - ✅ YES: Context-aware query interpretation

## Current Problems

### Problem 1: Hardcoded Patterns
```typescript
// BAD: Hardcoded pattern matching
if (question.includes("is my brand")) {
  // Extract brand...
}

// GOOD: AI understands intent from context
const intent = await classifyIntent(question, context);
// AI figures out relationships from the question itself
```

### Problem 2: Domain-Specific Logic
```typescript
// BAD: Assumes marketing domain
if (mentionsNegativeImpact && sisterBrandsToFilter.length > 0) {
  // Filter sister brands...
}

// GOOD: General relationship filtering
if (intent.filters?.excludeNegativeFor) {
  // Filter negative correlations for specified variables
  // Works for ANY domain, ANY relationship type
}
```

### Problem 3: Column Name Assumptions
```typescript
// BAD: Assumes specific column structure
const suffixes = ['TOM', 'nGRP', 'nGRP Adstocked'];

// GOOD: Discover column patterns from data
const columnPatterns = discoverColumnPatterns(summary);
// AI learns that "PA TOM", "PA nGRP" might be related to "PA"
```

## Fundamental Architecture

### 1. Intent Classification (General-Purpose)

The intent classifier should understand:
- **Relationships**: "affects", "impacts", "correlates with", "influences"
- **Constraints**: "don't include", "exclude", "only show", "filter out"
- **Conditions**: "where X is negative", "if Y > threshold", "above average"
- **Groupings**: "sister brands", "competitors", "categories" (learned from context)
- **Temporal**: "last 12 months", "rolling average", "month-over-month"

**Key**: The AI should extract structured intent WITHOUT knowing the domain.

### 2. Column Matching (Pattern Discovery)

Instead of hardcoding suffixes, discover patterns:
```typescript
// Discover that columns might have prefixes/suffixes
const columnHierarchy = discoverColumnHierarchy(columns);
// "PA TOM", "PA nGRP" → prefix: "PA"
// "PAB nGRP", "PAB 3+" → prefix: "PAB"
// AI can then match "PA" to "PA TOM" automatically
```

### 3. Relationship Extraction (Context-Aware)

Understand relationships from natural language:
- "X is my brand" → X is the primary entity
- "Y, Z are sister brands" → Y, Z are related entities of type "sister brand"
- "don't want negative impact" → filter constraint: exclude negative correlations

**Key**: Extract these as general relationships, not domain-specific.

### 4. Filter Application (General Constraint System)

```typescript
interface FilterConstraint {
  type: 'exclude' | 'include' | 'condition';
  target: string[]; // Variables to apply to
  condition: {
    correlationSign?: 'positive' | 'negative';
    threshold?: number;
    comparison?: 'above' | 'below' | 'equals';
  };
  scope?: 'all' | 'specific'; // Apply to all or specific variables
}
```

### 5. Dynamic Handler Selection

Handlers should be:
- **Modular**: Each handles a specific analysis type
- **Composable**: Can chain handlers for complex queries
- **Extensible**: Easy to add new analysis types
- **Domain-agnostic**: Work with any data structure

## Implementation Strategy

### Phase 1: Remove Hardcoding
1. Remove all hardcoded brand names, column names, patterns
2. Replace with AI-powered extraction
3. Use column discovery instead of assumptions

### Phase 2: Generalize Intent Classification
1. Enhance prompt to understand ANY relationship type
2. Extract constraints as structured data
3. Support nested/conditional constraints

### Phase 3: Pattern Discovery
1. Implement column hierarchy discovery
2. Learn naming patterns from data
3. Auto-match partial names to full column names

### Phase 4: Constraint System
1. Build general constraint application system
2. Support complex boolean logic
3. Apply constraints post-analysis (not pre-filter)

## Example: How It Should Work

**User Query**: "PA is my brand. PAB, PAEC are sister brands. Don't want negative impact."

**System Understanding** (no hardcoding):
1. Intent Classifier extracts:
   - Primary entity: "PA" (from "is my brand")
   - Related entities: ["PAB", "PAEC"] (from "sister brands")
   - Relationship type: "sister brand" (learned from context)
   - Constraint: "don't want negative impact" → exclude negative correlations for related entities

2. Column Matcher:
   - Discovers "PA TOM", "PA nGRP" match "PA"
   - Discovers "PAB nGRP", "PAB 3+" match "PAB"
   - Uses discovered patterns, not hardcoded suffixes

3. Correlation Handler:
   - Calculates all correlations
   - Applies constraint: For entities in "sister brand" relationship, exclude negative correlations
   - Works for ANY relationship type, not just "sister brands"

**Key**: The system understands the STRUCTURE of the request, not the DOMAIN.

## Success Criteria

✅ Works with marketing data (brands, campaigns)
✅ Works with financial data (companies, sectors)
✅ Works with operations data (products, categories)
✅ Works with healthcare data (patients, conditions)
✅ Works with ANY domain without code changes

## Next Steps

1. **Refactor Intent Classifier**: Remove domain assumptions, enhance general understanding
2. **Implement Column Discovery**: Learn patterns from data structure
3. **Build Constraint System**: General-purpose filtering logic
4. **Test with Multiple Domains**: Verify general-purpose nature

---

**Remember**: We're building an AI Analyst that can analyze ANY data and answer ANY question. The intelligence comes from the AI, not from hardcoded patterns.

