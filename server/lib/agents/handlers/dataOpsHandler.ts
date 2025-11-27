import { BaseHandler, HandlerContext, HandlerResponse } from './baseHandler.js';
import { AnalysisIntent } from '../intentClassifier.js';
import { removeNulls, convertDataType, getDataPreview, validateDataOperation, filterData, deleteRows, removeColumns, addColumn, updateColumnValues, createDerivedColumn, countNulls, NullCountOptions } from '../../dataManipulator.js';
import { detectOutliersIQR, detectOutliersZScore, removeOutliers, capOutliers, detectDuplicates, removeDuplicates, normalizeColumn, standardizeColumn, cleanText } from '../../dataCleaning.js';
import { generateColumnStatistics, formatStatisticsTable } from '../../dataStatistics.js';
import { loadFullDatasetForAnalysis, clearDataCache } from '../../dataLoader.js';
import { updateProcessedDataBlob } from '../../blobStorage.js';
import { getChatBySessionIdEfficient, updateChatDocument, ChatDocument } from '../../cosmosDB.js';
import { createDataSummary } from '../../fileParser.js';
import { findMatchingColumn } from '../utils/columnMatcher.js';
import { openai } from '../../openai.js';
import { getModelForTask } from '../models.js';
import type { DataOpsContext, DataOpsFilter, DataOpsPendingOperation } from '../../../../shared/schema.js';

type DefaultValueConfig =
  | { kind: 'static'; value: any }
  | { kind: 'random'; min: number; max: number; integer: boolean };

interface AddColumnDetails {
  columnName?: string;
  columnNames?: string[]; // For multiple columns
  defaultValueConfig?: DefaultValueConfig;
}

type UpdateRange =
  | { type: 'all'; startIndex?: number; endIndex?: number }
  | { type: 'first'; count: number }
  | { type: 'last'; count: number };

interface UpdateColumnDetails {
  columnName?: string;
  valueConfig?: DefaultValueConfig;
  range?: UpdateRange;
}

/**
 * DataOps Handler
 * Handles data manipulation operations like null removal, type conversion, preview, statistics
 */
export class DataOpsHandler extends BaseHandler {
  private readonly pronounReferenceRegex = /\b(above|those|these|them|that\s+row|that\s+rows|filtered|shown|displayed|same\s+rows?)\b/i;
  private readonly contextTtlMs = 10 * 60 * 1000; // 10 minutes
  private readonly pendingTtlMs = 5 * 60 * 1000; // 5 minutes for clarification memory

  canHandle(intent: AnalysisIntent): boolean {
    return intent.type === 'dataOps';
  }

  async handle(intent: AnalysisIntent, context: HandlerContext): Promise<HandlerResponse> {
    console.log('🔧 DataOpsHandler handling request:', intent);

    // Validate data
    const validation = this.validateData(intent, context);
    if (!validation.valid) {
      return {
        answer: `I can't perform this operation: ${validation.errors.join(', ')}`,
        error: validation.errors.join(', '),
      };
    }

    // Load full dataset from blob (always use full dataset, not sampleRows)
    let fullData: Record<string, any>[];
    try {
      fullData = await loadFullDatasetForAnalysis(context.sessionId);
      console.log(`✅ Loaded ${fullData.length} rows for data operation`);
    } catch (error) {
      console.error('❌ Failed to load full dataset:', error);
      return {
        answer: 'Failed to load data. Please try again.',
        error: 'Failed to load dataset',
      };
    }

    // Load chat document to access dataOps context and metadata
    let sessionDoc: ChatDocument | null = null;
    try {
      sessionDoc = await getChatBySessionIdEfficient(context.sessionId);
    } catch (error) {
      console.error('❌ Failed to fetch session document:', error);
      return {
        answer: 'Failed to fetch session context. Please try again.',
        error: 'Failed to load session document',
      };
    }

    if (!sessionDoc) {
      return {
        answer: 'Session not found. Please upload your file again.',
        error: 'Session document missing',
      };
    }

    const pendingOperation = this.getPendingOperation(sessionDoc);
    let operation = intent.operation;
    
    // If no operation in intent, try AI-based detection first, then fallback to regex
    if (!operation || operation === 'unknown') {
      const availableColumns = context.summary.columns.map(c => c.name);
      operation = await this.detectOperationWithAI(intent.customRequest || '', availableColumns);
    }
    
    let usedPendingOperation = false;

    if ((!operation || operation === 'unknown') && pendingOperation) {
      operation = pendingOperation.type;
      usedPendingOperation = true;
      console.log(`🔁 Continuing pending data operation: ${operation}`);
    }

    console.log(`🔧 Detected operation: ${operation} from query: "${intent.customRequest || ''}"`);

    try {
      switch (operation) {
        case 'remove_nulls':
          return await this.handleRemoveNulls(intent, context, fullData, sessionDoc);
        
        case 'convert_type':
          return await this.handleConvertType(intent, context, fullData, sessionDoc);
        
        case 'preview':
          if (usedPendingOperation) {
            await this.persistDataOpsContext(sessionDoc, { pendingOperation: null });
          }
          return await this.handlePreview(intent, context, fullData, sessionDoc);
        
        case 'summary':
          if (usedPendingOperation) {
            await this.persistDataOpsContext(sessionDoc, { pendingOperation: null });
          }
          return await this.handleSummary(intent, context, fullData, sessionDoc);
        
        case 'delete_rows':
          if (usedPendingOperation) {
            await this.persistDataOpsContext(sessionDoc, { pendingOperation: null });
          }
          return await this.handleDeleteRows(intent, context, fullData, sessionDoc);

        case 'remove_column':
          return await this.handleRemoveColumn(intent, context, fullData, sessionDoc, usedPendingOperation ? pendingOperation : null);

        case 'add_column':
          return await this.handleAddColumn(intent, context, fullData, sessionDoc, usedPendingOperation ? pendingOperation : null);

        case 'update_column':
          return await this.handleUpdateColumnValues(intent, context, fullData, sessionDoc, usedPendingOperation ? pendingOperation : null);

        case 'preview_operation':
          return await this.handlePreviewOperation(intent, context, fullData, sessionDoc);

        case 'feature_engineering':
        case 'create_derived_column':
          return await this.handleFeatureEngineering(intent, context, fullData, sessionDoc);

        case 'data_cleaning':
        case 'remove_outliers':
        case 'remove_duplicates':
        case 'normalize':
        case 'standardize':
          return await this.handleDataCleaning(intent, context, fullData, sessionDoc);

        case 'count_nulls':
          return await this.handleCountNulls(intent, context, fullData, sessionDoc);
        
        default:
          // For preview-like queries that weren't detected, try preview anyway
          const queryLower = (intent.customRequest || '').toLowerCase();
          if (queryLower.match(/\b(rows?|data|show|display|give me|preview)\b/)) {
            console.log(`🔧 Falling back to preview for query: "${intent.customRequest}"`);
            return await this.handlePreview(intent, context, fullData, sessionDoc);
          }
          
          return {
            answer: `I'm not sure what data operation you want. You can:\n- Count NULL values (e.g., "how many null values", "count nulls in column X", "nulls between rows 5 and 10")\n- Delete rows (e.g., "delete row where SKU = SKU11")\n- Remove null values\n- Convert column types\n- Show data preview (e.g., "show 10 rows", "last 20 rows")\n- Get data summary/statistics`,
            requiresClarification: true,
          };
      }
    } catch (error) {
      console.error('❌ DataOpsHandler error:', error);
      return {
        answer: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Detect operation from user query using AI for better understanding
   */
  private async detectOperationWithAI(query: string, availableColumns: string[]): Promise<string> {
    const prompt = `You are an operation classifier for data operations. Determine what operation the user wants to perform.

USER QUERY: "${query}"

AVAILABLE COLUMNS: ${availableColumns.join(', ')}

OPERATIONS:
1. "feature_engineering" or "create_derived_column" - User wants to CREATE a NEW column by COMBINING/OPERATING on EXISTING columns (e.g., "add column X and Y", "create column Z = X + Y", "where you add two columns X and Y", "name the new column Z" when X and Y are existing columns)
2. "add_column" - User wants to CREATE NEW columns with NEW names (not based on existing columns). This includes phrases like "add a new column called X", "create column named Y", "add column Z with value V", "add column X with the value Y for all the rows"
3. "update_column" - User wants to UPDATE values in an EXISTING column (column must already exist in available columns)
4. "remove_column" - User wants to DELETE a column
5. "delete_rows" - User wants to DELETE rows
6. "remove_nulls" - User wants to remove/impute NULL values
7. "convert_type" - User wants to convert column data type
8. "preview" - User wants to VIEW/SHOW data (e.g., "show rows", "display data", "preview", "give me rows", "last 10 rows", "first 20 rows")
9. "summary" - User wants statistics
10. "count_nulls" - User wants to count NULL values

KEY DISTINCTIONS:
- CRITICAL: "add a new column called X with the value Y for all the rows" → add_column (NOT preview, even though it mentions "rows")
- CRITICAL: "add column X with value Y" → add_column (NOT preview)
- If user mentions EXISTING column names (from available columns) in context of "add column" or "create column", it's likely "feature_engineering"
- If user says "add column X" where X is NOT in available columns, it's "add_column"
- If user says "set column X to Y" or "update column X" where X IS in available columns, it's "update_column"
- "preview" is ONLY for viewing/showing data, NOT for creating columns
- Examples of feature_engineering:
  * "add two columns X and Y" (where X and Y exist in available columns) → feature_engineering
  * "create column Z where you add X and Y" → feature_engineering
  * "add column X and Y and name the new column Z" → feature_engineering (Z is the result, X and Y are sources)
  * "create column Total = Price * Quantity" → feature_engineering
- Examples of add_column:
  * "add column Comments" (Comments doesn't exist) → add_column
  * "create new column named Status" → add_column
  * "add a new column called status with the value active for all the rows" → add_column
  * "add column Status with value active" → add_column
  * "create column Notes with default value empty" → add_column
- Examples of preview:
  * "show rows" → preview
  * "display data" → preview
  * "last 10 rows" → preview
  * "give me the first 20 rows" → preview

OUTPUT FORMAT (JSON only, no markdown):
{
  "operation": "feature_engineering" | "add_column" | "update_column" | "remove_column" | "delete_rows" | "remove_nulls" | "convert_type" | "preview" | "summary" | "count_nulls" | "unknown",
  "reasoning": "brief explanation"
}`;

    try {
      const model = getModelForTask('intent');
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You classify data operations from natural language queries. Output only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 150,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return this.detectOperation(query); // Fallback to regex
      }

      const parsed = JSON.parse(content);
      const operation = parsed.operation;
      
      if (operation && operation !== 'unknown') {
        console.log(`🤖 AI detected operation: ${operation} (reasoning: ${parsed.reasoning || 'N/A'})`);
        return operation;
      }
    } catch (error) {
      console.error('❌ Failed to detect operation using AI:', error);
    }
    
    // Fallback to regex-based detection
    return this.detectOperation(query);
  }

  /**
   * Detect operation from user query (regex-based fallback)
   */
  private detectOperation(query: string): string {
    const lower = query.toLowerCase();
    
    // Check for feature engineering first
    if (lower.match(/\b(create|add|make)\s+(?:column|col)\s+.*\s*(?:=|as|equals|with)\s*[a-zA-Z0-9_\[\]+\-*\/()]/) ||
        lower.match(/\b(create|add|make)\s+.*\s+column\s+.*\s*(?:=|as|equals)/)) {
      return 'feature_engineering';
    }
    
    // Check for data cleaning operations
    if (lower.match(/\b(remove|delete)\s+outliers?\b/)) {
      return 'remove_outliers';
    }
    if (lower.match(/\b(cap|limit|clamp)\s+outliers?\b/)) {
      return 'cap_outliers';
    }
    if (lower.match(/\b(remove|delete)\s+duplicates?\b/)) {
      return 'remove_duplicates';
    }
    if (lower.match(/\bnormalize\b/)) {
      return 'normalize';
    }
    if (lower.match(/\bstandardize\b/)) {
      return 'standardize';
    }
    
    // Check for delete/remove row operations (before remove_nulls)
    if (lower.match(/\b(delete|remove|drop)\s+(row|rows?)\b/) || 
        lower.match(/\b(delete|remove|drop)\s+.*\b(row|rows?)\b/)) {
      return 'delete_rows';
    }
    
    // Check for NULL counting queries first (before remove_nulls)
    if (lower.match(/\b(how many|count|number of|total)\s+(null|nulls?|missing|empty)\s+(values?|cells?|entries?)\b/) ||
        lower.match(/\b(null|nulls?|missing|empty)\s+(values?|cells?|entries?)\s+(in|for|across|between)\b/) ||
        lower.match(/\bcount\s+(null|nulls?|missing|empty)\b/)) {
      return 'count_nulls';
    }
    
    if (lower.match(/\b(remove|delete|impute|fill)\s+null/)) {
      return 'remove_nulls';
    }
    if (lower.match(/\b(convert|change)\s+type/)) {
      return 'convert_type';
    }
    if (lower.match(/\b(delete|remove|drop)\s+(?:the\s+)?column\b/) ||
        lower.match(/\b(delete|remove|drop)\s+[a-z0-9_\s]+column\b/)) {
      return 'remove_column';
    }
    // IMPORTANT: Check for add_column BEFORE preview to avoid false matches on "for all the rows"
    if (lower.match(/\b(add|create|insert)\s+(?:a\s+)?(?:new\s+)?column\b/)) {
      // Check if it's feature engineering (has expression) or simple add
      if (lower.match(/\b(add|create|insert)\s+(?:a\s+)?(?:new\s+)?column\s+.*\s*(?:=|as|equals)/)) {
        return 'feature_engineering';
      }
      return 'add_column';
    }
    if (lower.match(/\b(set|fill|update|change|put|apply|assign|write|add)\b.*\bcolumn\b/)) {
      return 'update_column';
    }
    // Match preview operations: show/display/give me rows, last/first/top N rows, preview data
    // IMPORTANT: Only match explicit preview requests, not just any mention of "rows"
    if (lower.match(/\b(show|display|preview|give me)\s+(?:me\s+)?(?:the\s+)?(?:data|rows?)\b/) || 
        lower.match(/\b(last|first|top|bottom)\s+\d+\s+rows?\b/)) {
      return 'preview';
    }
    if (lower.match(/\b(summary|statistics|describe|stats)\b/)) {
      return 'summary';
    }
    
    return 'unknown';
  }

  /**
   * Handle null removal operation
   */
  private async handleRemoveNulls(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    sessionDoc: ChatDocument
  ): Promise<HandlerResponse> {
    // Check if clarification needed
    if (!intent.column && !intent.customRequest?.toLowerCase().includes('entire')) {
      return {
        answer: 'Is this about a specific column or the entire dataset?',
        requiresClarification: true,
      };
    }

    // Extract column if specified
    let column: string | undefined;
    if (intent.column) {
      column = findMatchingColumn(intent.column, context.summary.columns.map(c => c.name)) || undefined;
    }

    // Extract method (default to 'delete' if not specified)
    const method = this.extractNullMethod(intent.customRequest || '') || 'delete';

    // Apply operation
    const modifiedData = removeNulls(data, column, method as any);

    // Save to blob and update CosmosDB
    const result = await this.saveDataAndUpdateMetadata(
      context.sessionId,
      modifiedData,
      'remove_nulls',
      `Removed nulls from ${column || 'entire dataset'} using ${method}`,
      sessionDoc
    );

    const rowsAffected = data.length - modifiedData.length;
    const previewRows = Math.min(100, modifiedData.length);
    const answer = `✅ Successfully ${method === 'delete' ? 'removed' : 'imputed'} null values${column ? ` in column "${column}"` : ' in the entire dataset'}.\n\n` +
      `- Original rows: ${data.length}\n` +
      `- ${method === 'delete' ? 'Rows removed' : 'Values imputed'}: ${rowsAffected}\n` +
      `- New dataset size: ${modifiedData.length} rows\n\n` +
      `Showing first ${previewRows} of ${modifiedData.length} rows:`;

    return {
      answer,
      table: {
        type: 'preview',
        data: modifiedData.slice(0, previewRows),
        columns: Object.keys(modifiedData[0] || {}),
        totalRows: modifiedData.length,
      },
      operationResult: {
        success: true,
        operation: 'remove_nulls',
        newVersion: result.version,
        rowsAffected,
      },
    };
  }

  /**
   * Handle type conversion operation
   */
  private async handleConvertType(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    sessionDoc: ChatDocument
  ): Promise<HandlerResponse> {
    if (!intent.column || !intent.targetType) {
      return {
        answer: 'Please specify which column to convert and the target type (numeric, percentage, date, string, boolean).',
        requiresClarification: true,
      };
    }

    const column = findMatchingColumn(intent.column, context.summary.columns.map(c => c.name));
    if (!column) {
      return {
        answer: `Column "${intent.column}" not found. Available columns: ${context.summary.columns.map(c => c.name).join(', ')}`,
        error: 'Column not found',
      };
    }

    // Apply conversion
    const modifiedData = convertDataType(data, column, intent.targetType as any);

    // Save to blob and update CosmosDB
    const result = await this.saveDataAndUpdateMetadata(
      context.sessionId,
      modifiedData,
      'convert_type',
      `Converted column "${column}" to ${intent.targetType}`,
      sessionDoc
    );

    const previewRows = Math.min(100, modifiedData.length);
    return {
      answer: `✅ Successfully converted column "${column}" to ${intent.targetType}.\n\nShowing first ${previewRows} of ${modifiedData.length} rows:`,
      table: {
        type: 'preview',
        data: modifiedData.slice(0, previewRows),
        columns: Object.keys(modifiedData[0] || {}),
        totalRows: modifiedData.length,
      },
      operationResult: {
        success: true,
        operation: 'convert_type',
        newVersion: result.version,
      },
    };
  }

  /**
   * Handle column removal operation
   */
  private async handleRemoveColumn(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    sessionDoc: ChatDocument,
    pendingOperation?: DataOpsPendingOperation | null
  ): Promise<HandlerResponse> {
    const availableColumns = context.summary.columns.map(c => c.name);
    const query = intent.customRequest || '';

    const column =
      (intent.column && findMatchingColumn(intent.column, availableColumns)) ||
      this.resolveColumnFromText(query, availableColumns);

    if (!column) {
      await this.persistDataOpsContext(sessionDoc, {
        pendingOperation: {
          type: 'remove_column',
          step: 'awaiting_column',
          timestamp: Date.now(),
          details: {
            prompt: query,
          },
        },
      });

      return {
        answer: `Please tell me which column you want to remove. For example: "Remove column PAB nGRP Adstocked".`,
        requiresClarification: false,
      };
    }

    const modifiedData = removeColumns(data, [column]);

    const result = await this.saveDataAndUpdateMetadata(
      context.sessionId,
      modifiedData,
      'remove_column',
      `Removed column "${column}" from dataset`,
      sessionDoc
    );

    await this.persistDataOpsContext(sessionDoc, {
      pendingOperation: null,
      filters: null,
    });

    const previewRows = Math.min(100, modifiedData.length);
    return {
      answer: `✅ Removed column "${column}" from the dataset.\n\nShowing first ${previewRows} of ${modifiedData.length} rows:`,
      table: {
        type: 'preview',
        data: modifiedData.slice(0, previewRows),
        columns: Object.keys(modifiedData[0] || {}),
        totalRows: modifiedData.length,
      },
      operationResult: {
        success: true,
        operation: 'remove_column',
        newVersion: result.version,
      },
    };
  }

  /**
   * Extract add column details using AI (column names and default values)
   */
  private async extractAddColumnDetailsWithAI(query: string): Promise<{ columnNames: string[]; defaultValueConfig?: DefaultValueConfig } | null> {
    const prompt = `You are a data operation assistant. Extract column names and default values from the user's query when they want to add/create new columns.

USER QUERY: "${query}"

YOUR TASK:
- Extract ALL column names that the user wants to create/add
- Extract the default value that should be set for all rows (if specified)
- Handle various phrasings:
  * "add a new column called status with the value active for all the rows" → columnNames: ["status"], defaultValue: "active"
  * "create column Comments with default value empty" → columnNames: ["Comments"], defaultValue: ""
  * "add column Status with value active" → columnNames: ["Status"], defaultValue: "active"
  * "create columns A, B, and C with value 0" → columnNames: ["A", "B", "C"], defaultValue: 0
  * "add column Notes" → columnNames: ["Notes"], defaultValue: null (no default specified)
  * "create column Price with default 100" → columnNames: ["Price"], defaultValue: 100
  * "add column Active with value true" → columnNames: ["Active"], defaultValue: true

VALUE EXTRACTION RULES:
- Look for patterns like: "with the value X", "with value X", "with default value X", "default X", "set to X", "fill with X", "containing X"
- Extract the actual value (string, number, boolean, or null)
- For strings: preserve the exact text (e.g., "active", "pending", "completed")
- For numbers: convert to number type
- For booleans: recognize "true"/"false", "yes"/"no", "1"/"0"
- If no value is specified, return null for defaultValue

OUTPUT FORMAT (JSON only, no markdown):
{
  "columnNames": ["Column1", "Column2"],
  "defaultValue": "value" | number | boolean | null
}

IMPORTANT:
- Return null if you cannot clearly identify column names
- Return an array even if only one column is found
- Preserve the exact spelling and capitalization of column names
- Extract the actual value, not the word "value" itself`;

    try {
      const model = getModelForTask('intent');
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You extract column names and default values from natural language queries for adding columns. Output only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 300,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      const columnNames = parsed.columnNames;
      const defaultValue = parsed.defaultValue;
      
      if (!columnNames || !Array.isArray(columnNames) || columnNames.length === 0) {
        return null;
      }

      // Clean and validate column names
      const cleanedColumnNames = columnNames
        .map((name: any) => {
          if (typeof name !== 'string') return null;
          return name.replace(/["']/g, '').trim();
        })
        .filter((name: string | null): name is string => name !== null && name.length > 0);

      if (cleanedColumnNames.length === 0) {
        return null;
      }

      // Build defaultValueConfig
      let defaultValueConfig: DefaultValueConfig | undefined;
      if (defaultValue !== null && defaultValue !== undefined) {
        // Normalize the value
        const normalizedValue = this.normalizeFilterValue(defaultValue);
        defaultValueConfig = {
          kind: 'static',
          value: normalizedValue,
        };
      }

      return {
        columnNames: cleanedColumnNames,
        defaultValueConfig,
      };
    } catch (error) {
      console.error('❌ Failed to extract add column details using AI:', error);
      return null;
    }
  }

  /**
   * Handle add column operation (supports multiple columns)
   */
  private async handleAddColumn(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    sessionDoc: ChatDocument,
    pendingOperation?: DataOpsPendingOperation | null
  ): Promise<HandlerResponse> {
    const query = intent.customRequest || '';
    const existingColumns = context.summary.columns.map(c => c.name);

    // First try AI-based extraction for both column names and default values
    const aiExtraction = await this.extractAddColumnDetailsWithAI(query);
    
    let columnsToAdd: string[] = [];
    let defaultValueConfig: DefaultValueConfig | undefined;

    if (aiExtraction && aiExtraction.columnNames.length > 0) {
      // Use AI extraction results
      columnsToAdd = aiExtraction.columnNames;
      defaultValueConfig = aiExtraction.defaultValueConfig;
    } else {
      // Fallback to previous methods
      const columnNames = await this.extractColumnNames(query);
      
      if (columnNames && columnNames.length > 0) {
        columnsToAdd = columnNames;
      } else {
        // Fallback to single column extraction
        const addDetails = this.extractAddColumnDetails(query);
        const priorDetails = pendingOperation?.details?.prompt
          ? this.extractAddColumnDetails(pendingOperation.details.prompt)
          : {};
        const rawColumnName =
          intent.column ||
          addDetails.columnName ||
          (pendingOperation?.details?.columnName as string | undefined) ||
          priorDetails.columnName;
        const columnName = rawColumnName ? rawColumnName.trim() : undefined;

        if (columnName) {
          columnsToAdd = [columnName];
        }
      }

      // Extract default value config from regex-based method if AI didn't find it
      if (!defaultValueConfig) {
        const addDetails = this.extractAddColumnDetails(query);
        defaultValueConfig =
          addDetails.defaultValueConfig ||
          (pendingOperation?.details?.defaultValueConfig as DefaultValueConfig | undefined);
      }
    }

    if (columnsToAdd.length === 0) {
      await this.persistDataOpsContext(sessionDoc, {
        pendingOperation: {
          type: 'add_column',
          step: 'awaiting_column',
          timestamp: Date.now(),
          details: {
            prompt: query,
          },
        },
      });

      return {
        answer: `What should I name the new column(s)? You can reply with something like "Add column Comments" or "Create columns XYZ and ABC".`,
        requiresClarification: false,
      };
    }

    // Check for existing columns
    const existingCols = columnsToAdd.filter(col => 
      existingColumns.some(existing => existing.toLowerCase().trim() === col.toLowerCase().trim())
    );
    if (existingCols.length > 0) {
      return {
        answer: `Column${existingCols.length > 1 ? 's' : ''} "${existingCols.join('", "')}" already exist${existingCols.length > 1 ? '' : 's'}. Please choose different name${existingCols.length > 1 ? 's' : ''}.`,
      };
    }

    const defaultValue = this.buildValueGenerator(defaultValueConfig);

    // Add all columns
    let modifiedData = data;
    const addedColumns: string[] = [];
    for (const columnName of columnsToAdd) {
      modifiedData = addColumn(modifiedData, columnName, defaultValue);
      addedColumns.push(columnName);
    }

    const result = await this.saveDataAndUpdateMetadata(
      context.sessionId,
      modifiedData,
      'add_column',
      `Added ${addedColumns.length} column${addedColumns.length > 1 ? 's' : ''}: ${addedColumns.map(c => `"${c}"`).join(', ')} with ${
        defaultValueConfig
          ? defaultValueConfig.kind === 'random'
            ? `random ${defaultValueConfig.integer ? 'integers' : 'decimals'} between ${defaultValueConfig.min} and ${defaultValueConfig.max}`
            : `default value ${JSON.stringify(defaultValueConfig.value)}`
          : 'null values'
      }`,
      sessionDoc
    );

    await this.persistDataOpsContext(sessionDoc, {
      pendingOperation: null,
      filters: null,
    });

    const previewRows = Math.min(100, modifiedData.length);
    return {
      answer: `✅ Added ${addedColumns.length} new column${addedColumns.length > 1 ? 's' : ''}: ${addedColumns.map(c => `"${c}"`).join(', ')}${
        defaultValueConfig
          ? defaultValueConfig.kind === 'random'
            ? ` (random ${defaultValueConfig.integer ? 'integer' : 'decimal'} between ${defaultValueConfig.min} and ${defaultValueConfig.max})`
            : ` (default value: ${defaultValueConfig.value})`
          : ''
      }.\n\nShowing first ${previewRows} of ${modifiedData.length} rows:`,
      table: {
        type: 'preview',
        data: modifiedData.slice(0, previewRows),
        columns: Object.keys(modifiedData[0] || {}),
        totalRows: modifiedData.length,
      },
      operationResult: {
        success: true,
        operation: 'add_column',
        newVersion: result.version,
      },
    };
  }

  /**
   * Extract update column details using AI (column name, value, and range)
   */
  private async extractUpdateColumnDetailsWithAI(query: string, availableColumns: string[]): Promise<{ columnName: string; valueConfig?: DefaultValueConfig; range?: UpdateRange } | null> {
    const prompt = `You are a data operation assistant. Extract column name, value, and row range from the user's query when they want to update/set column values.

USER QUERY: "${query}"

AVAILABLE COLUMNS: ${availableColumns.join(', ')}

YOUR TASK:
- Extract the column name that should be updated (must match one of the available columns exactly, case-insensitive)
- Extract the value that should be set for all rows (or specified rows)
- Extract the row range if specified (first N rows, last N rows, rows X to Y, or all rows)
- Handle various phrasings:
  * "set PAB nGRP Adstocked to 90" → columnName: "PAB nGRP Adstocked", value: 90
  * "set column X to Y" → columnName: "X", value: Y
  * "update column Status to active" → columnName: "Status", value: "active"
  * "fill column Price with 100" → columnName: "Price", value: 100
  * "set column X to 90 for all rows" → columnName: "X", value: 90 (no range, updates all)
  * "set column X to 90 for first 10 rows" → columnName: "X", value: 90, range: { type: "first", count: 10 }
  * "set column X to 90 for last 5 rows" → columnName: "X", value: 90, range: { type: "last", count: 5 }
  * "set column X to 90 for rows 1 to 10" → columnName: "X", value: 90, range: { type: "all", startIndex: 0, endIndex: 9 }

VALUE EXTRACTION RULES:
- Extract the actual value (string, number, boolean, or null)
- For strings: preserve the exact text (e.g., "active", "pending", "completed")
- For numbers: return as NUMBER type, not string (e.g., 90 not "90", 100.5 not "100.5", -10 not "-10")
- For booleans: return as boolean type (true/false), not string
- CRITICAL: If the value is numeric (like 90, 100, 0.5), return it as a number type in JSON, not a string
- The value should be set for ALL rows unless a range is specified
- If no value is specified, return null for valueConfig

RANGE EXTRACTION:
- If user says "for all rows" or doesn't specify a range, don't include range (updates all rows by default)
- If user says "for first N rows" or "first N", return range: { type: "first", count: N }
- If user says "for last N rows" or "last N", return range: { type: "last", count: N }
- If user says "for rows X to Y" or "rows X-Y", return range: { type: "all", startIndex: X-1, endIndex: Y-1 } (convert to 0-based)
- If no range is mentioned, don't include range (means update all rows)

COLUMN MATCHING:
- Match column names exactly to available columns (case-insensitive)
- Handle partial matches if the column name in the query is a substring of an available column
- For example, if query says "PAB" and available column is "PAB nGRP Adstocked", match to "PAB nGRP Adstocked"

OUTPUT FORMAT (JSON only, no markdown):
{
  "columnName": "ExactColumnNameFromAvailableColumns" | null,
  "value": "value" | number | boolean | null,
  "range": { "type": "first" | "last" | "all", "count"?: number, "startIndex"?: number, "endIndex"?: number } | null
}

IMPORTANT:
- Match column names exactly to available columns (case-insensitive)
- Return null for columnName if you cannot identify it or match it to an available column
- Extract the actual value, not the word "value" itself
- If no range is specified, the value should be applied to ALL rows
- startIndex and endIndex should be 0-based (row 1 = startIndex 0, row 10 = endIndex 9)`;

    try {
      const model = getModelForTask('intent');
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You extract column names, values, and row ranges from natural language queries for updating columns. Output only valid JSON. Match column names exactly to available columns.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 400,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      const columnName = parsed.columnName;
      const value = parsed.value;
      const range = parsed.range;
      
      if (!columnName || typeof columnName !== 'string') {
        return null;
      }

      // Match column name to available columns (case-insensitive, handle partial matches)
      const matchedColumn = findMatchingColumn(columnName, availableColumns);
      if (!matchedColumn) {
        console.log(`⚠️ Could not match column "${columnName}" to available columns`);
        return null;
      }

      // Build valueConfig
      let valueConfig: DefaultValueConfig | undefined;
      if (value !== null && value !== undefined) {
        const normalizedValue = this.normalizeFilterValue(value);
        valueConfig = {
          kind: 'static',
          value: normalizedValue,
        };
      }

      // Build range
      let updateRange: UpdateRange | undefined;
      if (range) {
        if (range.type === 'first' && range.count) {
          updateRange = { type: 'first', count: range.count };
        } else if (range.type === 'last' && range.count) {
          updateRange = { type: 'last', count: range.count };
        } else if (range.type === 'all' && (range.startIndex !== undefined || range.endIndex !== undefined)) {
          updateRange = { 
            type: 'all', 
            startIndex: range.startIndex !== undefined ? range.startIndex : undefined,
            endIndex: range.endIndex !== undefined ? range.endIndex : undefined
          };
        }
      }
      // If no range specified, default to all rows (undefined means all rows in updateColumnValues)

      return {
        columnName: matchedColumn,
        valueConfig,
        range: updateRange,
      };
    } catch (error) {
      console.error('❌ Failed to extract update column details using AI:', error);
      return null;
    }
  }

  /**
   * Handle update column values operation
   */
  private async handleUpdateColumnValues(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    sessionDoc: ChatDocument,
    pendingOperation?: DataOpsPendingOperation | null
  ): Promise<HandlerResponse> {
    const query = intent.customRequest || '';
    const availableColumns = context.summary.columns.map(c => c.name);
    
    // First try AI-based extraction
    const aiExtraction = await this.extractUpdateColumnDetailsWithAI(query, availableColumns);
    
    let column: string | undefined;
    let valueConfig: DefaultValueConfig | undefined;
    let range: UpdateRange | undefined;

    if (aiExtraction && aiExtraction.columnName) {
      // Use AI extraction results
      column = aiExtraction.columnName;
      valueConfig = aiExtraction.valueConfig;
      range = aiExtraction.range;
      const valueStr = valueConfig?.kind === 'static' ? valueConfig.value : valueConfig?.kind === 'random' ? `random(${valueConfig.min}-${valueConfig.max})` : 'null';
      console.log(`🤖 AI extracted: column="${column}", value=${valueStr}, range=${range ? JSON.stringify(range) : 'all rows'}`);
    } else {
      // Fallback to regex-based extraction
      const details = this.extractUpdateColumnDetails(query);
      const pendingDetails = (pendingOperation?.details || {}) as UpdateColumnDetails;

      const matchedColumn1 = intent.column ? findMatchingColumn(intent.column, availableColumns) : null;
      const matchedColumn2 = details.columnName ? findMatchingColumn(details.columnName, availableColumns) : null;
      const matchedColumn3 = this.resolveColumnFromText(query, availableColumns);
      const matchedColumn4 = pendingDetails?.columnName ? findMatchingColumn(pendingDetails.columnName, availableColumns) : null;
      
      column = matchedColumn1 || matchedColumn2 || matchedColumn3 || matchedColumn4 || undefined;

      valueConfig =
        details.valueConfig ||
        pendingDetails?.valueConfig;

      range = details.range || pendingDetails?.range;
      const valueStr = valueConfig?.kind === 'static' ? valueConfig.value : valueConfig?.kind === 'random' ? `random(${valueConfig.min}-${valueConfig.max})` : 'null';
      console.log(`📝 Regex fallback: column="${column}", value=${valueStr}, range=${range ? JSON.stringify(range) : 'all rows'}`);
    }

    if (!column) {
      await this.persistDataOpsContext(sessionDoc, {
        pendingOperation: {
          type: 'update_column',
          step: 'awaiting_column',
          timestamp: Date.now(),
          details: {
            columnName: undefined,
            valueConfig,
            range,
          },
        },
      });

      return {
        answer: `Which column should I update? Available options include: ${availableColumns.join(', ')}.`,
        requiresClarification: false,
      };
    }

    if (!valueConfig) {
      await this.persistDataOpsContext(sessionDoc, {
        pendingOperation: {
          type: 'update_column',
          step: 'awaiting_value',
          timestamp: Date.now(),
          details: {
            columnName: column,
            range,
            valueConfig: undefined,
          },
        },
      });

      return {
        answer: `What value should I use for column "${column}"? You can say things like "set it to 90" or "fill with random numbers between 0 and 100".`,
        requiresClarification: false,
      };
    }

    // If no range specified, default to all rows (undefined means all rows in updateColumnValues)
    const finalRange = range || { type: 'all' as const };
    const valueGenerator = this.buildValueGenerator(valueConfig);
    const modifiedData = updateColumnValues(
      data,
      column,
      valueGenerator,
      { range: finalRange }
    );

    const result = await this.saveDataAndUpdateMetadata(
      context.sessionId,
      modifiedData,
      'update_column',
      `Updated column "${column}" ${this.describeRange(finalRange)} with ${
        valueConfig.kind === 'random'
          ? `random ${valueConfig.integer ? 'integers' : 'decimals'} between ${valueConfig.min} and ${valueConfig.max}`
          : `value ${JSON.stringify(valueConfig.value)}`
      }`,
      sessionDoc
    );

    await this.persistDataOpsContext(sessionDoc, {
      pendingOperation: null,
      filters: null,
    });

    const previewRows = Math.min(100, modifiedData.length);
    return {
      answer: `✅ Updated column "${column}"${this.describeRange(finalRange)} with ${
        valueConfig.kind === 'random'
          ? `random ${valueConfig.integer ? 'integers' : 'decimals'} between ${valueConfig.min} and ${valueConfig.max}`
          : `value ${valueConfig.value}`
      }.\n\nShowing first ${previewRows} of ${modifiedData.length} rows:`,
      table: {
        type: 'preview',
        data: modifiedData.slice(0, previewRows),
        columns: Object.keys(modifiedData[0] || {}),
        totalRows: modifiedData.length,
      },
      operationResult: {
        success: true,
        operation: 'update_column',
        newVersion: result.version,
      },
    };
  }

  /**
   * Extract filter conditions from natural language query using AI
   */
  private async extractFiltersFromQuery(
    query: string,
    availableColumns: string[]
  ): Promise<Array<{ column: string; operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'startsWith' | 'endsWith'; value: any }>> {
    const prompt = `You are a filter extraction assistant for data operations. Extract filter conditions from the user's query.

USER QUERY: "${query}"

AVAILABLE COLUMNS: ${availableColumns.join(', ')}

YOUR TASK:
- Extract any filter conditions from the query (e.g., "where column = value", "only when column is value", "column equals value")
- Match column names to the available columns (case-insensitive, handle spaces/underscores)
- Extract the full filter value, including multi-word values (e.g., "Route A", "New York", "Product Category 1")
- Determine the operator: "=" for equals/is, "!=" for not equals, ">" for greater than, etc.
- If no filters are found, return an empty array

EXAMPLES:
- "show rows where Routes is Route A" → [{ column: "Routes", operator: "=", value: "Route A" }]
- "only when route equals Route A" → [{ column: "Routes", operator: "=", value: "Route A" }]
- "give me data where Routes = Route A" → [{ column: "Routes", operator: "=", value: "Route A" }]
- "can you give me all the row with Routes is Route A" → [{ column: "Routes", operator: "=", value: "Route A" }]
- "delete row where SKU = SKU11" → [{ column: "SKU", operator: "=", value: "SKU11" }]
- "delete rows where SKU is SKU11" → [{ column: "SKU", operator: "=", value: "SKU11" }]
- "remove row with SKU equals SKU11" → [{ column: "SKU", operator: "=", value: "SKU11" }]
- "show rows where cost > 100" → [{ column: "Costs", operator: ">", value: 100 }]
- "filter by Routes equals Route A and Costs > 50" → [{ column: "Routes", operator: "=", value: "Route A" }, { column: "Costs", operator: ">", value: 50 }]

OUTPUT FORMAT (JSON only, no markdown):
{
  "filters": [
    {
      "column": "exact_column_name_from_available_columns",
      "operator": "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "startsWith" | "endsWith",
      "value": "string_value_or_number"
    }
  ]
}

IMPORTANT:
- Match column names exactly to available columns (case-insensitive)
- Preserve the full value including spaces (e.g., "Route A" not just "Route")
- Use "=" for equals/is/equals to
- Convert numeric strings to numbers when appropriate
- Return empty array if no filters found`;

    try {
      const model = getModelForTask('intent');
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You extract filter conditions from natural language queries. Output only valid JSON. Match column names exactly to available columns.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2, // Low temperature for consistent extraction
        max_tokens: 300,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return [];
      }

      const parsed = JSON.parse(content);
      const filters = parsed.filters || [];
      
      // Validate that columns exist in available columns
      const validFilters = filters.filter((f: any) => {
        const matchedColumn = findMatchingColumn(f.column, availableColumns);
        return matchedColumn !== null;
      }).map((f: any) => {
        const matchedColumn = findMatchingColumn(f.column, availableColumns);
        if (!matchedColumn) {
          return null;
        }
        return {
          column: matchedColumn,
          operator: f.operator || '=',
          value: this.normalizeFilterValue(f.value),
        };
      }).filter((f: any): f is { column: string; operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'startsWith' | 'endsWith'; value: any } => f !== null);

      return validFilters;
    } catch (error) {
      console.error('❌ Failed to extract filters using AI:', error);
      return []; // Fallback to empty array
    }
  }

  /**
   * Normalize filter value (e.g., convert "null"/"none" → null, numeric strings → numbers)
   */
  private normalizeFilterValue(value: any): any {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      const lower = trimmed.toLowerCase();

      // Common null-like tokens
      if (['null', 'none', 'nil', 'n/a', 'na', 'blank', 'empty', 'missing'].includes(lower)) {
        return null;
      }

      if (lower === 'true') {
        return true;
      }
      if (lower === 'false') {
        return false;
      }

      const numeric = Number(trimmed);
      if (!isNaN(numeric) && trimmed !== '') {
        return numeric;
      }

      return trimmed;
    }

    return value;
  }

  /**
   * Handle data preview operation
   */
  private async handlePreview(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    sessionDoc: ChatDocument
  ): Promise<HandlerResponse> {
    const query = intent.customRequest || '';
    const queryLower = query.toLowerCase();
    
    // Extract filters using AI instead of regex
    const availableColumns = context.summary.columns.map(c => c.name);
    const filters = await this.extractFiltersFromQuery(query, availableColumns);
    
    // Extract limit and position from query
    // Patterns: "last 10 rows", "first 20 rows", "top 100 rows", "show 50 rows", "give me 15 rows"
    let limit = 100; // default
    let offset = 0;
    let position = 'first'; // 'first', 'last', or 'top'
    
    // Match "last N rows" - show last N rows from the end
    const lastMatch = queryLower.match(/\blast\s+(\d+)\s+rows?/i);
    if (lastMatch) {
      limit = parseInt(lastMatch[1], 10);
      position = 'last';
      // Note: offset will be calculated after filtering
    } else {
      // Match "first N rows" or "top N rows" - show first N rows
      const firstMatch = queryLower.match(/\b(first|top)\s+(\d+)\s+rows?/i);
      if (firstMatch) {
        limit = parseInt(firstMatch[2], 10);
        position = 'first';
        offset = 0;
      } else {
        // Match "show N rows" or "give me N rows" or "display N rows" - default to first N
        const numberMatch = queryLower.match(/\b(show|display|give me)\s+(\d+)\s+rows?/i);
        if (numberMatch) {
          limit = parseInt(numberMatch[2], 10);
          position = 'first';
          offset = 0;
        } else {
          // Match just a number (e.g., "show 10" or "10 rows")
          const simpleNumberMatch = queryLower.match(/\b(\d+)\s*rows?/i);
          if (simpleNumberMatch) {
            limit = parseInt(simpleNumberMatch[1], 10);
            position = 'first';
            offset = 0;
          }
        }
      }
    }

    // Apply filters first, then pagination
    let filteredData = data;
    if (filters.length > 0) {
      for (const filter of filters) {
        filteredData = filterData(filteredData, filter.column, filter.operator, filter.value);
      }
    }
    
    // Calculate offset for "last N rows" after filtering
    if (position === 'last' && filteredData.length > 0) {
      offset = Math.max(0, filteredData.length - limit);
    }
    
    const preview = getDataPreview(filteredData, limit, offset);
    
    const positionText = position === 'last' ? 'last' : position === 'top' ? 'top' : 'first';
    const filterText = filters.length > 0 
      ? ` (filtered: ${filters.map(f => `${f.column} = ${f.value}`).join(', ')})`
      : '';
    const answer = `Showing ${positionText} ${preview.length} of ${filteredData.length} rows${filterText}:`;

    await this.persistDataOpsContext(
      sessionDoc,
      filters.length > 0
        ? {
            lastOperation: 'preview',
            lastQuery: query,
            filters,
            pendingOperation: null,
          }
        : {
            filters: null,
            pendingOperation: null,
          }
    );

    return {
      answer,
      table: {
        type: 'preview',
        data: preview,
        columns: Object.keys(data[0] || {}),
        totalRows: filteredData.length,
        pagination: {
          page: 1,
          limit,
          totalPages: Math.ceil(filteredData.length / limit),
          hasNextPage: filteredData.length > limit,
        },
      },
    };
  }

  /**
   * Handle delete rows operation
   */
  private async handleDeleteRows(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    sessionDoc: ChatDocument
  ): Promise<HandlerResponse> {
    const query = intent.customRequest || '';
    
    // Extract filters using AI (same as preview)
    const availableColumns = context.summary.columns.map(c => c.name);
    let filters = await this.extractFiltersFromQuery(query, availableColumns);
    let reusedContextFilters = false;

    if (filters.length === 0) {
      const contextFilters = this.getFiltersFromContext(query, sessionDoc);
      if (contextFilters.length > 0) {
        filters = contextFilters;
        reusedContextFilters = true;
        console.log('🔁 Reusing filters from previous data preview for delete_rows operation.');
      }
    }
    
    if (filters.length === 0) {
      return {
        answer: 'I need to know which rows to delete. Please specify a condition like "delete row where SKU = SKU11" or "delete rows where column = value".',
        requiresClarification: true,
      };
    }

    // Delete rows matching the filter conditions
    const { data: modifiedData, rowsDeleted } = deleteRows(data, filters);

    if (rowsDeleted === 0) {
      return {
        answer: `No rows matched the deletion criteria. The filter conditions were: ${filters.map(f => `${f.column} ${f.operator} ${f.value}`).join(', ')}`,
      };
    }

    // Save to blob and update CosmosDB
    const filterSummary = filters.map(f => `${f.column} ${f.operator} ${f.value}`).join(' and ');
    const result = await this.saveDataAndUpdateMetadata(
      context.sessionId,
      modifiedData,
      'delete_rows',
      `Deleted ${rowsDeleted} row(s) where ${filterSummary}`,
      sessionDoc
    );

    const contextNote = reusedContextFilters ? '\n\nℹ️ Used the filters from your last preview since you referenced "those/above" rows.' : '';
    const previewRows = Math.min(100, modifiedData.length);
    const answer = `✅ Successfully deleted ${rowsDeleted} row(s) where ${filterSummary}.${contextNote}\n\n` +
      `- Original rows: ${data.length}\n` +
      `- Rows deleted: ${rowsDeleted}\n` +
      `- Remaining rows: ${modifiedData.length}\n\n` +
      `Showing first ${previewRows} of ${modifiedData.length} rows:`;

    await this.persistDataOpsContext(sessionDoc, {
      filters: null,
      pendingOperation: null,
    });

    return {
      answer,
      table: {
        type: 'preview',
        data: modifiedData.slice(0, previewRows),
        columns: Object.keys(modifiedData[0] || {}),
        totalRows: modifiedData.length,
      },
      operationResult: {
        success: true,
        operation: 'delete_rows',
        newVersion: result.version,
        rowsAffected: rowsDeleted,
      },
    };
  }

  /**
   * Handle data summary/statistics operation
   */
  /**
   * Extract column names from summary query using AI
   */
  private async extractSummaryColumns(query: string, availableColumns: string[]): Promise<string[] | null> {
    const prompt = `You are a column extraction assistant. Extract column names from a summary/statistics query.

USER QUERY: "${query}"

AVAILABLE COLUMNS: ${availableColumns.join(', ')}

YOUR TASK:
- Extract column names if user wants summary for specific column(s)
- Patterns to recognize:
  * "summary for X" → ["X"]
  * "summary of X" → ["X"]
  * "statistics for X only" → ["X"]
  * "X summary" → ["X"]
  * "summary for X and Y" → ["X", "Y"]
  * "statistics for X, Y, Z" → ["X", "Y", "Z"]
- If user says "summary" or "statistics" without mentioning specific columns, return null (show all)
- Match column names to available columns (case-insensitive, handle spaces)
- Return null if no specific columns are mentioned

OUTPUT FORMAT (JSON only, no markdown):
{
  "columns": ["Column1", "Column2"] | null
}

IMPORTANT:
- Return null if user wants summary for ALL columns
- Return array of column names if user wants summary for specific columns
- Match column names exactly to available columns`;

    try {
      const model = getModelForTask('intent');
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You extract column names from summary queries. Output only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 150,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      const columns = parsed.columns;
      
      if (!columns || !Array.isArray(columns) || columns.length === 0) {
        return null;
      }

      // Match extracted columns to available columns
      const matchedColumns = columns
        .map((col: any) => {
          if (typeof col !== 'string') return null;
          return findMatchingColumn(col.trim(), availableColumns);
        })
        .filter((col: string | null): col is string => col !== null);

      return matchedColumns.length > 0 ? matchedColumns : null;
    } catch (error) {
      console.error('❌ Failed to extract summary columns using AI:', error);
      return null;
    }
  }

  private async handleSummary(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    _sessionDoc: ChatDocument
  ): Promise<HandlerResponse> {
    const query = intent.customRequest || '';
    const availableColumns = context.summary.columns.map(c => c.name);
    
    // Extract column names using AI first
    let targetColumns: string[] | null = await this.extractSummaryColumns(query, availableColumns);
    
    // Fallback: try using intent.column or variables
    if (!targetColumns || targetColumns.length === 0) {
      if (intent.column) {
        const matched = findMatchingColumn(intent.column, availableColumns);
        if (matched) {
          targetColumns = [matched];
        }
      } else if (intent.variables && intent.variables.length > 0) {
        targetColumns = intent.variables
          .map(v => findMatchingColumn(v, availableColumns))
          .filter((col): col is string => col !== null);
      }
    }
    
    // Generate comprehensive statistics
    const allStatistics = generateColumnStatistics(data, context.summary);
    
    // Filter to specific columns if requested
    let statistics = allStatistics;
    let answerText = `Here's a comprehensive summary of your data:\n\n- Total rows: ${data.length}\n- Total columns: ${context.summary.columnCount}\n- Numeric columns: ${context.summary.numericColumns.length}\n\nColumn statistics:`;
    
    if (targetColumns && targetColumns.length > 0) {
      // Filter statistics to only show requested columns
      statistics = allStatistics.filter(stat => 
        targetColumns!.some(targetCol => 
          stat.variable.toLowerCase() === targetCol.toLowerCase()
        )
      );
      
      if (statistics.length > 0) {
        answerText = `Here's a summary for ${targetColumns.length === 1 ? `column "${targetColumns[0]}"` : `columns: ${targetColumns.join(', ')}`}:\n\n- Total rows: ${data.length}\n\nColumn statistics:`;
      } else {
        // Column not found, show all but mention it
        answerText = `I couldn't find the specific column(s) you mentioned. Here's a summary of all columns:\n\n- Total rows: ${data.length}\n- Total columns: ${context.summary.columnCount}\n- Numeric columns: ${context.summary.numericColumns.length}\n\nColumn statistics:`;
        statistics = allStatistics;
      }
    }
    
    const tableData = formatStatisticsTable(statistics);

    return {
      answer: answerText,
      table: {
        type: 'statistics',
        data: tableData,
        columns: Object.keys(tableData[0] || {}),
        totalRows: statistics.length,
      },
    };
  }

  /**
   * Use AI to extract NULL counting options from natural language query
   */
  private async extractNullCountOptions(
    query: string,
    availableColumns: string[],
    totalRows: number
  ): Promise<NullCountOptions | null> {
    const prompt = `You are a data analysis assistant. Extract parameters for counting NULL values from the user's query.

USER QUERY: "${query}"

AVAILABLE COLUMNS: ${availableColumns.join(', ')}
TOTAL ROWS IN DATASET: ${totalRows}

YOUR TASK:
Extract the following information from the query:
1. **Columns**: Which columns to check? (can be specific column names, "all", or a range like "between X and Y")
2. **Row Range**: Which rows to check?
   - Specific row: "row 5", "row number 20", "in row 10", "20th row", "the 20th row", "row 20" → extract the row number (1-based, convert to 0-based)
   - Row range: "between row 5 and 10", "rows 1 to 100", "from row 10 to row 20", "rows 5-10" → extract start and end (1-based)
   - First N rows: "first 50 rows", "first 50" → startRow: 0, endRow: 50
   - Last N rows: "last 20 rows", "last 20" → startRow: ${Math.max(0, totalRows - 20)}, endRow: ${totalRows}
   - If not specified, check all rows

IMPORTANT:
- Row numbers in user queries are 1-based (row 1 is the first row, row 20 is the 20th row)
- Handle ordinal numbers: "20th row" = row 20, "5th row" = row 5, "first row" = row 1, "last row" = row ${totalRows}
- Column names should be matched exactly to available columns (case-insensitive)
- If user says "entire dataset", "all", "my dataset", or doesn't mention columns, don't specify columns (check all)
- If user mentions specific columns, extract them and match to available columns
- For "NULL values present in the entire dataset" → check all columns and all rows

EXAMPLES:
- "NULL values in my dataset" → { "columns": null, "startRow": null, "endRow": null }
- "NULLs in row 5" → { "columns": null, "specificRow": 4 }
- "NULLs in row 20" → { "columns": null, "specificRow": 19 }
- "NULLs in the 20th row" → { "columns": null, "specificRow": 19 }
- "tell me number of NULL values present in the 20th row" → { "columns": null, "specificRow": 19 }
- "NULLs in column PA TOM" → { "columns": ["PA TOM"], "startRow": null, "endRow": null }
- "NULLs between row 5 and 10" → { "columns": null, "startRow": 4, "endRow": 10 }
- "NULLs in PA TOM between rows 1 and 50" → { "columns": ["PA TOM"], "startRow": 0, "endRow": 50 }
- "NULLs in first 100 rows" → { "columns": null, "startRow": 0, "endRow": 100 }
- "NULLs in last 20 rows" → { "columns": null, "startRow": ${Math.max(0, totalRows - 20)}, "endRow": ${totalRows} }
- "NULLs between columns X and Y" → extract column range and set columns array

OUTPUT FORMAT (JSON only, no markdown):
{
  "columns": ["column1", "column2"] | null,  // null or empty array means all columns
  "specificRow": 19,  // 0-based index (row 20 = 19), only if specific row requested
  "startRow": 0,  // 0-based index, only if range requested
  "endRow": 100  // 1-based end (exclusive), only if range requested
}

CRITICAL: 
- Always return a valid JSON object, even if some fields are null
- For "20th row", extract 20 and convert to 0-based: specificRow: 19
- If columns is null or empty array, it means check all columns
- Return null only if you truly cannot understand the query intent`;

    try {
      const model = getModelForTask('intent');
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You extract NULL counting parameters from natural language queries. Output only valid JSON. Return null if intent is unclear.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 300,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      
      // If parsed is null, return null
      if (parsed === null || (typeof parsed === 'object' && Object.keys(parsed).length === 0)) {
        return null;
      }

      const options: NullCountOptions = {};

      // Handle columns
      if (parsed.columns && Array.isArray(parsed.columns) && parsed.columns.length > 0) {
        // Match column names to available columns
        const matchedColumns: string[] = [];
        for (const colName of parsed.columns) {
          const matched = findMatchingColumn(String(colName), availableColumns);
          if (matched) {
            matchedColumns.push(matched);
          }
        }
        if (matchedColumns.length > 0) {
          options.columns = matchedColumns;
        }
      }

      // Handle row specifications
      if (parsed.specificRow !== undefined && parsed.specificRow !== null) {
        // Convert from 1-based to 0-based if needed, or use as-is if already 0-based
        const rowNum = typeof parsed.specificRow === 'number' ? parsed.specificRow : parseInt(String(parsed.specificRow), 10);
        // If the number seems 1-based (greater than 0 and reasonable), convert to 0-based
        if (rowNum > 0 && rowNum <= totalRows) {
          options.specificRow = rowNum - 1;
        } else if (rowNum >= 0 && rowNum < totalRows) {
          options.specificRow = rowNum;
        }
      } else if (parsed.startRow !== undefined || parsed.endRow !== undefined) {
        // Handle row range
        if (parsed.startRow !== undefined && parsed.startRow !== null) {
          const start = typeof parsed.startRow === 'number' ? parsed.startRow : parseInt(String(parsed.startRow), 10);
          // Convert from 1-based to 0-based if needed
          if (start > 0 && start <= totalRows) {
            options.startRow = start - 1;
          } else if (start >= 0 && start < totalRows) {
            options.startRow = start;
          } else {
            options.startRow = 0;
          }
        }
        if (parsed.endRow !== undefined && parsed.endRow !== null) {
          const end = typeof parsed.endRow === 'number' ? parsed.endRow : parseInt(String(parsed.endRow), 10);
          // End is exclusive, so if it's 1-based, use as-is; if 0-based, add 1
          if (end > 0 && end <= totalRows) {
            options.endRow = end;
          } else if (end >= 0 && end <= totalRows) {
            options.endRow = end + 1;
          } else {
            options.endRow = totalRows;
          }
        }
      }

      return options;
    } catch (error) {
      console.error('❌ Failed to extract NULL count options using AI:', error);
      return null;
    }
  }

  /**
   * Extract null handling method from query
   */
  private extractNullMethod(query: string): string | null {
    const lower = query.toLowerCase();
    
    if (lower.match(/\b(mean|average)\b/)) return 'mean';
    if (lower.match(/\bmedian\b/)) return 'median';
    if (lower.match(/\bmode\b/)) return 'mode';
    if (lower.match(/\b(delete|remove|drop)\b/)) return 'delete';
    if (lower.match(/\bcustom\b/)) return 'custom';
    
    return null;
  }

  /**
   * Determine if we should reuse filters from previous preview
   */
  private getFiltersFromContext(query: string, sessionDoc: ChatDocument): DataOpsFilter[] {
    if (!sessionDoc.dataOpsContext?.filters || sessionDoc.dataOpsContext.filters.length === 0) {
      return [];
    }

    if (!this.pronounReferenceRegex.test(query.toLowerCase())) {
      return [];
    }

    const age = Date.now() - sessionDoc.dataOpsContext.timestamp;
    if (age > this.contextTtlMs) {
      console.log('⚠️ Stored dataOps context expired, ignoring previous filters.');
      return [];
    }

    return sessionDoc.dataOpsContext.filters;
  }

  /**
   * Retrieve pending operation awaiting clarification (if still valid)
   */
  private getPendingOperation(sessionDoc: ChatDocument): DataOpsPendingOperation | null {
    const pending = sessionDoc.dataOpsContext?.pendingOperation;
    if (!pending) {
      return null;
    }

    if (Date.now() - pending.timestamp > this.pendingTtlMs) {
      return null;
    }

    return pending;
  }

  private describeRange(range?: UpdateColumnDetails['range']): string {
    if (!range) {
      return '';
    }

    if (range.type === 'first') {
      return range.count ? ` for the first ${range.count} rows` : '';
    }

    if (range.type === 'last') {
      return range.count ? ` for the last ${range.count} rows` : '';
    }

    if (range.type === 'all' && (range.startIndex !== undefined || range.endIndex !== undefined)) {
      const start = (range.startIndex ?? 0) + 1;
      const end = (range.endIndex ?? (range.startIndex ?? 0)) + 1;
      return ` for rows ${start}-${end}`;
    }

    return '';
  }

  /**
   * Try to resolve a column reference from free-form text
   */
  private resolveColumnFromText(query: string, columns: string[]): string | undefined {
    if (!query) {
      return undefined;
    }

    for (const column of columns) {
      const regex = new RegExp(`\\b${this.escapeRegExp(column)}\\b`, 'i');
      if (regex.test(query)) {
        return column;
      }
    }

    const fuzzy = findMatchingColumn(query, columns);
    return fuzzy || undefined;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extract multiple column names from natural language query using AI
   */
  private async extractColumnNames(query: string): Promise<string[] | null> {
    const prompt = `You are a column name extraction assistant for data operations. Extract column names from the user's query when they want to add/create multiple columns.

USER QUERY: "${query}"

YOUR TASK:
- Extract ALL column names that the user wants to create/add
- Handle various phrasings:
  * "create column XYZ and add PA nGRP Adstocked and PAB nGRP Adstocked" → ["XYZ", "PA nGRP Adstocked", "PAB nGRP Adstocked"]
  * "add columns A, B, and C" → ["A", "B", "C"]
  * "create column name XYZ and add PA nGRP Adstocked and PAB nGRP Adstocked" → ["XYZ", "PA nGRP Adstocked", "PAB nGRP Adstocked"]
  * "add a column named Sales and another called Revenue" → ["Sales", "Revenue"]
  * "create columns: Product, Category, Price" → ["Product", "Category", "Price"]
- If only ONE column is mentioned, return an array with that single column
- If NO clear column names are found, return null
- Preserve exact column names including spaces and special characters
- Remove quotes if present around column names
- Trim whitespace from column names

EXAMPLES:
- "can you create a column name XYZ and add PA nGRP Adstocked and PAB nGRP Adstocked" → ["XYZ", "PA nGRP Adstocked", "PAB nGRP Adstocked"]
- "add column Comments" → ["Comments"]
- "create columns Revenue and Profit" → ["Revenue", "Profit"]
- "add a column named Sales" → ["Sales"]
- "create column XYZ" → ["XYZ"]

OUTPUT FORMAT (JSON only, no markdown):
{
  "columnNames": ["Column1", "Column2", "Column3"] | null
}

IMPORTANT:
- Return null if you cannot clearly identify column names
- Return an array even if only one column is found
- Preserve the exact spelling and capitalization of column names`;

    try {
      const model = getModelForTask('intent');
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You extract column names from natural language queries for adding columns. Output only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 200,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      const columnNames = parsed.columnNames;
      
      if (!columnNames || !Array.isArray(columnNames) || columnNames.length === 0) {
        return null;
      }

      // Clean and validate column names
      const cleaned = columnNames
        .map((name: any) => {
          if (typeof name !== 'string') return null;
          return name.replace(/["']/g, '').trim();
        })
        .filter((name: string | null): name is string => name !== null && name.length > 0);

      return cleaned.length > 0 ? cleaned : null;
    } catch (error) {
      console.error('❌ Failed to extract column names using AI:', error);
      return null; // Fallback to single column extraction
    }
  }

  /**
   * Extract column name and default value instructions for add-column requests
   */
  private extractAddColumnDetails(query: string): AddColumnDetails {
    if (!query) {
      return {};
    }

    // Improved column name extraction - handles "called", "named", etc.
    const columnMatch = query.match(
      /\b(?:add|create|insert)\s+(?:another\s+)?(?:a\s+)?(?:new\s+)?column(?:\s+(?:called|named|for|titled|as|name))?\s+([^.,;]+?)(?=(?:\s+(?:with|default|set|fill|value|containing|for\s+all)\b|[.,;]|$))/i
    );
    const columnName = columnMatch ? columnMatch[1].replace(/["']/g, '').trim() : undefined;

    // Improved value extraction - handles "with the value", "with value", "with default value", etc.
    // Pattern 1: "with the value X" or "with value X"
    let valueMatch = query.match(/\bwith\s+(?:the\s+)?(?:default\s+)?value\s+(?:of\s+)?([^\s.,;]+(?:\s+[^\s.,;]+)*?)(?=\s+(?:for|in|to|$)|[.,;]|$)/i);
    
    // Pattern 2: "with default X" or "default X"
    if (!valueMatch) {
      valueMatch = query.match(/\b(?:with\s+)?default(?:ed)?\s+(?:value\s+)?(?:of\s+)?([^\s.,;]+(?:\s+[^\s.,;]+)*?)(?=\s+(?:for|in|to|$)|[.,;]|$)/i);
    }
    
    // Pattern 3: "set to X" or "set all values to X"
    if (!valueMatch) {
      valueMatch = query.match(/\bset\s+(?:all\s+)?(?:values?\s+)?to\s+([^\s.,;]+(?:\s+[^\s.,;]+)*?)(?=\s+(?:for|in|$)|[.,;]|$)/i);
    }
    
    // Pattern 4: "fill with X" or "filled with X"
    if (!valueMatch) {
      valueMatch = query.match(/\bfill(?:ed)?\s+with\s+([^\s.,;]+(?:\s+[^\s.,;]+)*?)(?=\s+(?:for|in|$)|[.,;]|$)/i);
    }

    if (valueMatch) {
      const valueStr = valueMatch[1].trim();
      // Remove trailing phrases like "for all the rows", "for all rows", etc.
      const cleanedValue = valueStr.replace(/\s+(?:for\s+all\s+(?:the\s+)?rows?|in\s+all\s+rows?)$/i, '').trim();
      
      return {
        columnName,
        defaultValueConfig: {
          kind: 'static',
          value: this.normalizeFilterValue(cleanedValue),
        },
      };
    }

    const randomMatch = query.match(
      /\brandom(?:\s+(?:value|values|number|numbers|ints|integers))?(?:\s+(?:between|from))?\s*(-?\d+(?:\.\d+)?)\s*(?:and|to|-)\s*(-?\d+(?:\.\d+)?)/i
    );
    if (randomMatch) {
      const min = parseFloat(randomMatch[1]);
      const max = parseFloat(randomMatch[2]);
      if (!isNaN(min) && !isNaN(max)) {
        const integer = /\b(integer|whole|no\s+decimals|round)\b/i.test(query);
        return {
          columnName,
          defaultValueConfig: { kind: 'random', min: Math.min(min, max), max: Math.max(min, max), integer },
        };
      }
    }

    return { columnName };
  }

  /**
   * Extract details for update column operation
   */
  private extractUpdateColumnDetails(query: string): UpdateColumnDetails {
    if (!query) {
      return {};
    }

    const columnMatch = query.match(/\bcolumn\s+(?:named\s+|called\s+|name\s+)?([a-z0-9_\- ]+)/i);

    const range = this.extractRowRange(query);
    const valueConfig = this.extractValueConfigFromQuery(query);

    return {
      columnName: columnMatch ? columnMatch[1].replace(/["']/g, '').trim() : undefined,
      range,
      valueConfig,
    };
  }

  private extractRowRange(query: string): UpdateColumnDetails['range'] | undefined {
    if (!query) return undefined;

    const numberRangeMatch = query.match(/\brows?\s+(?:number\s+)?(\d+)\s*(?:to|-|through)\s*(\d+)\b/i);
    if (numberRangeMatch) {
      const start = parseInt(numberRangeMatch[1], 10);
      const end = parseInt(numberRangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end)) {
        return { type: 'all', startIndex: Math.min(start, end) - 1, endIndex: Math.max(start, end) - 1 };
      }
    }

    const firstMatch = query.match(/\b(first|top)\s+(\d+)\s+rows?\b/i);
    if (firstMatch) {
      return { type: 'first', count: parseInt(firstMatch[2], 10) };
    }

    const lastMatch = query.match(/\b(last|bottom)\s+(\d+)\s+rows?\b/i);
    if (lastMatch) {
      return { type: 'last', count: parseInt(lastMatch[2], 10) };
    }

    return undefined;
  }

  private extractValueConfigFromQuery(query: string): DefaultValueConfig | undefined {
    if (!query) {
      return undefined;
    }

    const randomMatch = query.match(
      /\brandom(?:\s+(?:value|values|number|numbers|ints|integers))?(?:\s+(?:between|from))?\s*(-?\d+(?:\.\d+)?)\s*(?:and|to|-)\s*(-?\d+(?:\.\d+)?)/i
    );
    if (randomMatch) {
      const min = parseFloat(randomMatch[1]);
      const max = parseFloat(randomMatch[2]);
      if (!isNaN(min) && !isNaN(max)) {
        const integer = /\b(integer|whole|no\s+decimals|round)\b/i.test(query);
        return { kind: 'random', min: Math.min(min, max), max: Math.max(min, max), integer };
      }
    }

    const valuePhraseMatch = query.match(/\b(?:value|set|assign|put|apply|fill|add)\s+(?:the\s+)?value\s+("?)([^\s".,;]+)\1/i);
    if (valuePhraseMatch) {
      return { kind: 'static', value: this.normalizeFilterValue(valuePhraseMatch[2]) };
    }

    const columnValueMatch = query.match(/\bcolumn\s+[^\s]+?\s+(?:to|=|as)\s+("?)([^\s".,;]+)\1/i);
    if (columnValueMatch) {
      return { kind: 'static', value: this.normalizeFilterValue(columnValueMatch[2]) };
    }

    const toValueMatch = query.match(/\b(?:to|=)\s+("?)(-?\d+(?:\.\d+)?|[a-zA-Z][\w\s]+)\1(?=\b|$)/i);
    if (toValueMatch) {
      return { kind: 'static', value: this.normalizeFilterValue(toValueMatch[2]) };
    }

    return undefined;
  }

  private buildValueGenerator(config?: DefaultValueConfig): any {
    if (!config) {
      return null;
    }

    if (config.kind === 'static') {
      return config.value;
    }

    if (config.kind === 'random') {
      const { min, max, integer } = config;
      return () => {
        const rnd = Math.random() * (max - min) + min;
        return integer ? Math.round(rnd) : Number(rnd.toFixed(2));
      };
    }

    return null;
  }

  /**
   * Extract feature engineering details using AI
   */
  private async extractFeatureEngineeringDetails(query: string, availableColumns: string[]): Promise<{ columnName: string; expression: string } | null> {
    const prompt = `You are a feature engineering parser. Extract the new column name and expression from the user's query.

USER QUERY: "${query}"

AVAILABLE COLUMNS: ${availableColumns.join(', ')}

YOUR TASK:
- Extract the NEW column name (the result column to be created)
- Extract the EXPRESSION (how to calculate it from existing columns)
- Handle various phrasings:
  * "add two columns X and Y" → columnName: (inferred or ask), expression: "X + Y"
  * "add two columns X and Y and name the new column Z" → columnName: "Z", expression: "X + Y"
  * "create column Z where you add X and Y" → columnName: "Z", expression: "X + Y"
  * "create column Z = X + Y" → columnName: "Z", expression: "X + Y"
  * "add column X and Y" → columnName: (inferred), expression: "X + Y"
  * "create column Total = Price * Quantity" → columnName: "Total", expression: "Price * Quantity"

RULES:
- If user says "add two columns X and Y", the operation is addition: "X + Y"
- If user says "add columns X, Y, Z", the operation is addition: "X + Y + Z"
- If user mentions "multiply", "times", "*" → use multiplication
- If user mentions "subtract", "minus", "-" → use subtraction
- If user mentions "divide", "/" → use division
- Default operation when multiple columns are mentioned is ADDITION (+)
- Match column names to available columns (case-insensitive, handle spaces)
- If new column name is not specified, infer a reasonable name or use "NewColumn"

OUTPUT FORMAT (JSON only, no markdown):
{
  "columnName": "NewColumnName",
  "expression": "[Column1] + [Column2]" | "[Column1] * [Column2]" | etc.
}

IMPORTANT:
- Use [ColumnName] format for column references in expression
- Return null if you cannot determine the expression`;

    try {
      const model = getModelForTask('intent');
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You extract feature engineering details from natural language queries. Output only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 200,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      if (parsed.columnName && parsed.expression) {
        return {
          columnName: parsed.columnName.trim(),
          expression: parsed.expression.trim(),
        };
      }
    } catch (error) {
      console.error('❌ Failed to extract feature engineering details using AI:', error);
    }
    
    return null;
  }

  /**
   * Handle feature engineering: create derived columns from expressions
   */
  private async handleFeatureEngineering(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    sessionDoc: ChatDocument
  ): Promise<HandlerResponse> {
    const query = intent.customRequest || '';
    const availableColumns = context.summary.columns.map(c => c.name);

    // First try AI-based extraction
    let columnName: string | null = null;
    let expression: string | null = null;
    
    const aiExtraction = await this.extractFeatureEngineeringDetails(query, availableColumns);
    if (aiExtraction) {
      columnName = aiExtraction.columnName;
      expression = aiExtraction.expression;
    } else {
      // Fallback to regex-based extraction
      const columnMatch = query.match(/\b(?:create|add|make)\s+(?:column|col)\s+([a-zA-Z0-9_ ]+?)\s*(?:=|as|equals|with)\s*(.+)/i);
      columnName = intent.column || (columnMatch ? columnMatch[1].trim() : null);
      expression = columnMatch ? columnMatch[2].trim() : null;
    }

    if (!columnName) {
      return {
        answer: 'Please specify a name for the new column. For example: "Create column Revenue = Price * Quantity" or "Add two columns X and Y and name it Total"',
        requiresClarification: true,
      };
    }

    if (!expression) {
      return {
        answer: `Please specify the formula for column "${columnName}". For example: "Create column ${columnName} = [Column A] + [Column B]" or "Add columns X and Y to create ${columnName}"`,
        requiresClarification: true,
      };
    }

    // Validate operation
    const validation = validateDataOperation(data, 'create_derived_column', {
      columnName,
      expression,
      availableColumns,
    });

    if (!validation.valid) {
      return {
        answer: validation.error || 'Invalid operation',
        error: validation.error,
      };
    }

    // Create derived column
    const result = createDerivedColumn(data, columnName, expression, availableColumns);

    if (result.errors.length > 0) {
      return {
        answer: `Error creating column: ${result.errors.join(', ')}`,
        error: result.errors.join(', '),
      };
    }

    // Save to blob and update CosmosDB
    const saveResult = await this.saveDataAndUpdateMetadata(
      context.sessionId,
      result.data,
      'create_derived_column',
      `Created derived column "${columnName}" with expression: ${expression}`,
      sessionDoc
    );

    const previewRows = Math.min(100, result.data.length);
    return {
      answer: `✅ Successfully created derived column "${columnName}" using expression: ${expression}\n\nShowing first ${previewRows} of ${result.data.length} rows:`,
      table: {
        type: 'preview',
        data: result.data.slice(0, previewRows),
        columns: Object.keys(result.data[0] || {}),
        totalRows: result.data.length,
      },
      operationResult: {
        success: true,
        operation: 'create_derived_column',
        newVersion: saveResult.version,
      },
    };
  }

  /**
   * Handle data cleaning operations: outliers, duplicates, normalization
   */
  private async handleDataCleaning(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    sessionDoc: ChatDocument
  ): Promise<HandlerResponse> {
    const query = intent.customRequest || '';
    const queryLower = query.toLowerCase();
    const availableColumns = context.summary.columns.map(c => c.name);

    // Detect operation type
    let operation: 'remove_outliers' | 'cap_outliers' | 'remove_duplicates' | 'normalize' | 'standardize' | null = null;
    let column: string | undefined = intent.column;

    if (queryLower.match(/\b(remove|delete)\s+outliers?\b/)) {
      operation = 'remove_outliers';
    } else if (queryLower.match(/\b(cap|limit|clamp)\s+outliers?\b/)) {
      operation = 'cap_outliers';
    } else if (queryLower.match(/\b(remove|delete)\s+duplicates?\b/)) {
      operation = 'remove_duplicates';
    } else if (queryLower.match(/\bnormalize\b/)) {
      operation = 'normalize';
    } else if (queryLower.match(/\bstandardize\b/)) {
      operation = 'standardize';
    }

    if (!operation) {
      return {
        answer: 'Please specify a data cleaning operation. Available: remove outliers, cap outliers, remove duplicates, normalize, standardize.',
        requiresClarification: true,
      };
    }

    // Extract column if not provided
    if (!column && (operation === 'remove_outliers' || operation === 'cap_outliers' || operation === 'normalize' || operation === 'standardize')) {
      column = this.resolveColumnFromText(query, availableColumns);
      if (!column) {
        return {
          answer: `Please specify which column to ${operation}. Available columns: ${availableColumns.join(', ')}`,
          requiresClarification: true,
        };
      }
    }

    let modifiedData: Record<string, any>[] = [...data];
    let description = '';
    let rowsAffected = 0;

    try {
      switch (operation) {
        case 'remove_outliers': {
          if (!column) {
            return { answer: 'Column is required for outlier removal', error: 'Column required' };
          }
          const method = queryLower.includes('z-score') || queryLower.includes('zscore') ? 'zscore' : 'iqr';
          const threshold = queryLower.match(/threshold[:\s]+(\d+\.?\d*)/)?.[1] 
            ? parseFloat(queryLower.match(/threshold[:\s]+(\d+\.?\d*)/)![1])
            : undefined;
          const result = removeOutliers(data, column, method, threshold);
          modifiedData = result.data;
          rowsAffected = result.rowsRemoved;
          description = `Removed ${rowsAffected} outlier(s) from column "${column}" using ${method.toUpperCase()} method`;
          break;
        }

        case 'cap_outliers': {
          if (!column) {
            return { answer: 'Column is required for outlier capping', error: 'Column required' };
          }
          const method = queryLower.includes('z-score') || queryLower.includes('zscore') ? 'zscore' : 'iqr';
          const threshold = queryLower.match(/threshold[:\s]+(\d+\.?\d*)/)?.[1]
            ? parseFloat(queryLower.match(/threshold[:\s]+(\d+\.?\d*)/)![1])
            : undefined;
          modifiedData = capOutliers(data, column, method, threshold);
          description = `Capped outliers in column "${column}" using ${method.toUpperCase()} method`;
          break;
        }

        case 'remove_duplicates': {
          const keep = queryLower.includes('keep last') ? 'last' : 'first';
          const result = removeDuplicates(data, undefined, keep);
          modifiedData = result.data;
          rowsAffected = result.rowsRemoved;
          description = `Removed ${rowsAffected} duplicate row(s) (keeping ${keep})`;
          break;
        }

        case 'normalize': {
          if (!column) {
            return { answer: 'Column is required for normalization', error: 'Column required' };
          }
          modifiedData = normalizeColumn(data, column);
          description = `Normalized column "${column}" (min-max scaling to 0-1)`;
          break;
        }

        case 'standardize': {
          if (!column) {
            return { answer: 'Column is required for standardization', error: 'Column required' };
          }
          modifiedData = standardizeColumn(data, column);
          description = `Standardized column "${column}" (Z-score: mean=0, std=1)`;
          break;
        }
      }

      // Save to blob and update CosmosDB
      const saveResult = await this.saveDataAndUpdateMetadata(
        context.sessionId,
        modifiedData,
        operation,
        description,
        sessionDoc
      );

      const previewRows = Math.min(100, modifiedData.length);
      const answer = `✅ ${description}.\n\n` +
        (rowsAffected > 0 ? `- Rows affected: ${rowsAffected}\n` : '') +
        `- Original rows: ${data.length}\n` +
        `- New dataset size: ${modifiedData.length} rows\n\n` +
        `Showing first ${previewRows} of ${modifiedData.length} rows:`;

      return {
        answer,
        table: {
          type: 'preview',
          data: modifiedData.slice(0, previewRows),
          columns: Object.keys(modifiedData[0] || {}),
          totalRows: modifiedData.length,
        },
        operationResult: {
          success: true,
          operation,
          newVersion: saveResult.version,
          rowsAffected: rowsAffected > 0 ? rowsAffected : undefined,
        },
      };
    } catch (error) {
      return {
        answer: `Error performing data cleaning: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handle NULL counting queries with flexible options
   * Uses AI to parse natural language queries instead of regex
   */
  private async handleCountNulls(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    sessionDoc: ChatDocument
  ): Promise<HandlerResponse> {
    const query = intent.customRequest || '';
    const availableColumns = context.summary.columns.map(c => c.name);

    // Use AI to extract NULL counting parameters
    const options = await this.extractNullCountOptions(query, availableColumns, data.length);

    if (!options) {
      return {
        answer: 'I had trouble understanding your NULL counting query. Please try rephrasing, for example:\n- "How many NULL values in my dataset"\n- "Count NULLs in column X"\n- "NULLs in row 5"\n- "NULLs between rows 10 and 20"',
        requiresClarification: true,
      };
    }

    // Count NULLs
    const result = countNulls(data, options);

    // Format response
    let answer = `📊 **NULL Value Count**\n\n`;
    
    // If specific row was requested, lead with that
    if (options.specificRow !== undefined) {
      const rowNum = options.specificRow + 1; // Convert back to 1-based for display
      const rowResult = result.byRow?.[0];
      if (rowResult) {
        answer += `**Row ${rowNum}**: ${rowResult.nullCount} NULL value(s) out of ${rowResult.totalColumns} columns (${rowResult.percentage.toFixed(2)}%)\n\n`;
        
        // Show which columns have NULLs in this row
        if (rowResult.nullCount > 0) {
          answer += `**Columns with NULL values in row ${rowNum}**:\n`;
          const columnsWithNulls: string[] = [];
          const columnsToCheck = options.columns || Object.keys(data[0] || {});
          for (const col of columnsToCheck) {
            const value = data[options.specificRow!]?.[col];
            if (value === null || value === undefined || value === '') {
              columnsWithNulls.push(col);
            }
          }
          if (columnsWithNulls.length > 0) {
            answer += columnsWithNulls.map(col => `- ${col}`).join('\n') + '\n\n';
          }
        } else {
          answer += `✅ No NULL values found in row ${rowNum}.\n\n`;
        }
      }
    } else {
      // Summary for general queries
      answer += `**Total NULLs**: ${result.totalNulls} out of ${result.totalCells} cells (${result.nullPercentage.toFixed(2)}%)\n\n`;

      // Column breakdown
      if (result.byColumn.length > 0) {
        answer += `**Breakdown by Column**:\n`;
        const sortedColumns = [...result.byColumn].sort((a, b) => b.nullCount - a.nullCount);
        for (const col of sortedColumns) {
          if (col.nullCount > 0 || result.byColumn.length <= 10) {
            answer += `- **${col.column}**: ${col.nullCount} NULLs (${col.percentage.toFixed(2)}% of ${col.totalRows} rows)\n`;
          }
        }
        answer += `\n`;
      }

      // Row breakdown (if range requested)
      if (result.byRow && result.byRow.length > 0 && result.byRow.length > 1) {
        answer += `**Breakdown by Row**:\n`;
        for (const row of result.byRow) {
          answer += `- **Row ${row.rowIndex + 1}**: ${row.nullCount} NULLs (${row.percentage.toFixed(2)}% of ${row.totalColumns} columns)\n`;
        }
        answer += `\n`;
      }
    }

    // Create table data for display
    const tableData = result.byColumn.map(col => ({
      Column: col.column,
      'NULL Count': col.nullCount,
      'Total Rows': col.totalRows,
      'Percentage': `${col.percentage.toFixed(2)}%`,
    }));

    return {
      answer,
      table: {
        type: 'statistics',
        data: tableData,
        columns: ['Column', 'NULL Count', 'Total Rows', 'Percentage'],
        totalRows: result.byColumn.length,
      },
      operationResult: {
        success: true,
        operation: 'count_nulls',
        totalNulls: result.totalNulls,
        totalCells: result.totalCells,
        nullPercentage: result.nullPercentage,
      },
    };
  }

  /**
   * Handle preview operation (dry-run mode)
   */
  private async handlePreviewOperation(
    intent: AnalysisIntent,
    context: HandlerContext,
    data: Record<string, any>[],
    sessionDoc: ChatDocument
  ): Promise<HandlerResponse> {
    // Extract operation details from intent
    const operationType = intent.operation || 'unknown';
    const query = intent.customRequest || '';

    // Create a copy of data for preview
    let previewData = [...data];
    let impact: {
      rowsBefore: number;
      rowsAfter: number;
      columnsBefore: string[];
      columnsAfter: string[];
      affectedRows?: number;
      affectedColumns?: string[];
      warnings?: string[];
    } = {
      rowsBefore: data.length,
      rowsAfter: data.length,
      columnsBefore: Object.keys(data[0] || {}),
      columnsAfter: Object.keys(data[0] || {}),
    };

    const warnings: string[] = [];

    try {
      // Simulate the operation without saving
      switch (operationType) {
        case 'remove_nulls': {
          const column = intent.column;
          const method = this.extractNullMethod(query) || 'delete';
          const beforeRows = previewData.length;
          previewData = removeNulls(previewData, column, method as any);
          impact.rowsAfter = previewData.length;
          impact.affectedRows = beforeRows - previewData.length;
          impact.affectedColumns = column ? [column] : impact.columnsBefore;
          if (method === 'delete' && impact.affectedRows > 0) {
            warnings.push(`This will delete ${impact.affectedRows} row(s)`);
          }
          break;
        }

        case 'convert_type': {
          const column = intent.column;
          const targetType = intent.targetType;
          if (column && targetType) {
            previewData = convertDataType(previewData, column, targetType as any);
            impact.affectedColumns = [column];
          }
          break;
        }

        case 'remove_column': {
          const column = intent.column || this.resolveColumnFromText(query, impact.columnsBefore);
          if (column) {
            previewData = removeColumns(previewData, [column]);
            impact.columnsAfter = Object.keys(previewData[0] || {});
            impact.affectedColumns = [column];
            warnings.push(`Column "${column}" will be permanently removed`);
          }
          break;
        }

        case 'delete_rows': {
          const availableColumns = context.summary.columns.map(c => c.name);
          const filters = await this.extractFiltersFromQuery(query, availableColumns);
          if (filters.length > 0) {
            const beforeRows = previewData.length;
            const result = deleteRows(previewData, filters);
            previewData = result.data;
            impact.rowsAfter = previewData.length;
            impact.affectedRows = result.rowsDeleted;
            warnings.push(`This will permanently delete ${result.rowsDeleted} row(s)`);
          }
          break;
        }

        default:
          return {
            answer: `Preview not available for operation: ${operationType}. Please specify a valid operation.`,
            requiresClarification: true,
          };
      }

      // Show before/after comparison
      const beforeSample = data.slice(0, 5);
      const afterSample = previewData.slice(0, 5);

      let answer = `📊 **Operation Preview** (Dry-run mode)\n\n`;
      answer += `**Operation**: ${operationType}\n`;
      answer += `**Impact Summary**:\n`;
      answer += `- Rows: ${impact.rowsBefore} → ${impact.rowsAfter} (${impact.rowsAfter - impact.rowsBefore >= 0 ? '+' : ''}${impact.rowsAfter - impact.rowsBefore})\n`;
      answer += `- Columns: ${impact.columnsBefore.length} → ${impact.columnsAfter.length}\n`;
      if (impact.affectedRows) {
        answer += `- Rows affected: ${impact.affectedRows}\n`;
      }
      if (impact.affectedColumns && impact.affectedColumns.length > 0) {
        answer += `- Columns affected: ${impact.affectedColumns.join(', ')}\n`;
      }

      if (warnings.length > 0) {
        answer += `\n⚠️ **Warnings**:\n${warnings.map(w => `- ${w}`).join('\n')}\n`;
      }

      answer += `\n**Sample Data (Before)**:`;
      answer += `\n**Sample Data (After)**:`;

      return {
        answer,
        table: {
          type: 'preview',
          data: afterSample,
          columns: impact.columnsAfter,
          totalRows: impact.rowsAfter,
        },
        operationResult: {
          success: true,
          operation: 'preview_operation',
          preview: true,
          impact,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };
    } catch (error) {
      return {
        answer: `Error previewing operation: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Persist or clear the last data preview context for future references
   */
  private async persistDataOpsContext(
    sessionDoc: ChatDocument,
    update?: {
      lastOperation?: string | null;
      lastQuery?: string | null;
      filters?: DataOpsFilter[] | null;
      pendingOperation?: DataOpsPendingOperation | null;
    }
  ): Promise<void> {
    if (!update) {
      return;
    }

    const context: DataOpsContext = sessionDoc.dataOpsContext || {
      timestamp: Date.now(),
    };

    if ('lastOperation' in update) {
      if (update.lastOperation) {
        context.lastOperation = update.lastOperation;
      } else {
        delete context.lastOperation;
      }
    }

    if ('lastQuery' in update) {
      if (update.lastQuery) {
        context.lastQuery = update.lastQuery;
      } else {
        delete context.lastQuery;
      }
    }

    if ('filters' in update) {
      if (update.filters && update.filters.length > 0) {
        context.filters = update.filters;
      } else {
        delete context.filters;
      }
    }

    if ('pendingOperation' in update) {
      if (update.pendingOperation) {
        context.pendingOperation = update.pendingOperation;
      } else {
        delete context.pendingOperation;
      }
    }

    const hasContextData =
      Boolean(context.lastOperation) ||
      Boolean(context.lastQuery) ||
      (context.filters && context.filters.length > 0) ||
      Boolean(context.pendingOperation);

    if (!hasContextData) {
      delete sessionDoc.dataOpsContext;
      await updateChatDocument(sessionDoc);
      return;
    }

    context.timestamp = Date.now();
    sessionDoc.dataOpsContext = context;
    await updateChatDocument(sessionDoc);
  }

  /**
   * Save modified data to blob and update CosmosDB metadata
   */
  private async saveDataAndUpdateMetadata(
    sessionId: string,
    modifiedData: Record<string, any>[],
    operation: string,
    description: string,
    sessionDoc?: ChatDocument
  ): Promise<{ version: number }> {
    // Get current document
    const doc = sessionDoc ?? await getChatBySessionIdEfficient(sessionId);
    if (!doc) {
      throw new Error('Session not found');
    }

    // Determine new version
    const currentVersion = doc.currentDataBlob?.version || 1;
    const newVersion = currentVersion + 1;

    // Get username from document
    const username = doc.username;

    // Save new version to blob
    const newBlob = await updateProcessedDataBlob(
      sessionId,
      modifiedData,
      newVersion,
      username
    );

    // Update CosmosDB metadata
    doc.currentDataBlob = {
      blobUrl: newBlob.blobUrl,
      blobName: newBlob.blobName,
      version: newVersion,
      lastUpdated: Date.now(),
    };

    // Update sample rows (first 100)
    doc.sampleRows = modifiedData.slice(0, 100).map(row => {
      const serializedRow: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        if (value instanceof Date) {
          serializedRow[key] = value.toISOString();
        } else {
          serializedRow[key] = value;
        }
      }
      return serializedRow;
    });

    // Update data summary
    doc.dataSummary = createDataSummary(modifiedData);

    // Update column statistics
    const { generateColumnStatistics } = await import('../../cosmosDB.js');
    doc.columnStatistics = generateColumnStatistics(modifiedData, doc.dataSummary.numericColumns);

    // Add to version history with enhanced metadata
    if (!doc.dataVersions) {
      doc.dataVersions = [];
    }
    
    // Calculate impact metrics
    const rowsBefore = sessionDoc?.dataSummary?.rowCount || 0;
    const rowsAfter = modifiedData.length;
    const columnsBefore = sessionDoc?.dataSummary?.columns?.map(c => c.name) || [];
    const columnsAfter = Object.keys(modifiedData[0] || {});
    const affectedColumns = columnsBefore.filter(c => !columnsAfter.includes(c))
      .concat(columnsAfter.filter(c => !columnsBefore.includes(c)));

    doc.dataVersions.push({
      versionId: `v${newVersion}`,
      blobName: newBlob.blobName,
      operation,
      description,
      timestamp: Date.now(),
      parameters: {
        rowsBefore,
        rowsAfter,
        columnsBefore: columnsBefore.length,
        columnsAfter: columnsAfter.length,
        affectedRows: rowsAfter - rowsBefore,
        affectedColumns: affectedColumns.length > 0 ? affectedColumns : undefined,
      },
      affectedRows: rowsAfter - rowsBefore,
      affectedColumns: affectedColumns.length > 0 ? affectedColumns : undefined,
      rowsBefore,
      rowsAfter,
    });

    // Keep only last 10 versions
    if (doc.dataVersions.length > 10) {
      doc.dataVersions = doc.dataVersions.slice(-10);
    }

    // Update document
    await updateChatDocument(doc);

    // Clear cache so next load gets fresh data
    clearDataCache(sessionId);

    return { version: newVersion };
  }
}
