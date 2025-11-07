import { AnalysisIntent, classifyIntent } from './intentClassifier.js';
import { resolveContextReferences } from './contextResolver.js';
import { retrieveContext } from './contextRetriever.js';
import { BaseHandler, HandlerContext, HandlerResponse } from './handlers/baseHandler.js';
import { DataSummary, Message, ChartSpec, Insight } from '../../../shared/schema.js';
import { createErrorResponse, getFallbackSuggestions } from './utils/errorRecovery.js';
import { askClarifyingQuestion } from './utils/clarification.js';

/**
 * Agent Orchestrator
 * Main entry point for processing user queries
 * Routes to appropriate handlers and implements fallback chain
 */
export class AgentOrchestrator {
  private handlers: BaseHandler[] = [];
  
  /**
   * Get handler count (for initialization check)
   */
  getHandlerCount(): number {
    return this.handlers.length;
  }

  /**
   * Register a handler
   */
  registerHandler(handler: BaseHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Process a user query
   * Implements the complete flow: intent classification → validation → routing → response
   */
  async processQuery(
    question: string,
    chatHistory: Message[],
    data: Record<string, any>[],
    summary: DataSummary,
    sessionId: string
  ): Promise<{ answer: string; charts?: ChartSpec[]; insights?: Insight[] }> {
    try {
      console.log(`\n🔍 Processing query: "${question}"`);

      // Step 1: Resolve context references ("that", "it", etc.)
      const enrichedQuestion = resolveContextReferences(question, chatHistory);
      if (enrichedQuestion !== question) {
        console.log(`📝 Enriched question: "${enrichedQuestion}"`);
      }

      // Step 2: Classify intent
      const intent = await classifyIntent(enrichedQuestion, chatHistory, summary);
      console.log(`🎯 Intent: ${intent.type} (confidence: ${intent.confidence.toFixed(2)})`);

      // Step 3: Check if clarification needed
      // For conversational queries, skip clarification - they're usually simple greetings
      // Only ask for clarification if explicitly required AND not conversational
      if (intent.type === 'conversational') {
        console.log(`💬 Conversational query detected, skipping clarification check`);
      } else if (intent.requiresClarification || intent.confidence < 0.5) {
        console.log(`❓ Low confidence (${intent.confidence.toFixed(2)}) or clarification required, asking for clarification`);
        return askClarifyingQuestion(intent, summary);
      }

      // Step 4: Retrieve context (RAG)
      const context = await retrieveContext(
        enrichedQuestion,
        data,
        summary,
        chatHistory,
        sessionId
      );

      // Step 5: Build handler context
      const handlerContext: HandlerContext = {
        data,
        summary,
        context,
        chatHistory,
        sessionId,
      };

      // Step 6: Route to appropriate handler
      const handler = this.findHandler(intent);
      
      if (!handler) {
        console.log(`⚠️ No handler found for intent type: ${intent.type}`);
        // Fallback to general handler or return error
        return this.handleFallback(intent, handlerContext);
      }

      console.log(`✅ Routing to handler: ${handler.constructor.name}`);

      // Step 7: Execute handler
      try {
        // Add original question to intent for handlers that need it
        const intentWithQuestion = { ...intent, originalQuestion: enrichedQuestion };
        const response = await handler.handle(intentWithQuestion, handlerContext);
        
        // Validate response
        if (response.error) {
          console.log(`⚠️ Handler returned error: ${response.error}`);
          return this.handleError(response.error, intent, handlerContext);
        }

        if (response.requiresClarification) {
          return askClarifyingQuestion(intent, summary);
        }

        // Validate answer exists
        if (!response.answer || response.answer.trim().length === 0) {
          console.error('❌ Handler returned empty answer');
          throw new Error('Handler returned empty answer');
        }
        
        // Return successful response
        console.log(`✅ Handler returned answer (${response.answer.length} chars)`);
        return {
          answer: response.answer,
          charts: response.charts,
          insights: response.insights,
        };
      } catch (handlerError) {
        console.error(`❌ Handler execution failed:`, handlerError);
        return this.recoverFromError(handlerError, enrichedQuestion, intent, handlerContext);
      }
    } catch (error) {
      console.error(`❌ Orchestrator error:`, error);
      return this.recoverFromError(
        error,
        question,
        { type: 'custom', confidence: 0.3, customRequest: question },
        { data, summary, context: { dataChunks: [], pastQueries: [], mentionedColumns: [] }, chatHistory, sessionId }
      );
    }
  }

  /**
   * Find appropriate handler for intent
   */
  private findHandler(intent: AnalysisIntent): BaseHandler | null {
    for (const handler of this.handlers) {
      if (handler.canHandle(intent)) {
        return handler;
      }
    }
    return null;
  }

  /**
   * Handle fallback when no specific handler found
   */
  private async handleFallback(
    intent: AnalysisIntent,
    context: HandlerContext
  ): Promise<{ answer: string; charts?: ChartSpec[]; insights?: Insight[] }> {
    // Try to use general handler if available (it can handle custom types)
    const generalHandler = this.handlers.find(h => h.canHandle(intent));
    
    if (generalHandler) {
      try {
        const response = await generalHandler.handle(intent, context);
        return {
          answer: response.answer,
          charts: response.charts,
          insights: response.insights,
        };
      } catch (error) {
        // Continue to error handling
      }
    }

    // Return helpful error message
    const suggestions = getFallbackSuggestions(intent, context.summary);
    return {
      answer: `I'm not sure how to handle that request. Here are some things I can help with:\n\n${suggestions.map(s => `- ${s}`).join('\n')}`,
    };
  }

  /**
   * Handle errors with recovery
   */
  private handleError(
    error: string,
    intent: AnalysisIntent,
    context: HandlerContext
  ): { answer: string; charts?: ChartSpec[]; insights?: Insight[] } {
    const suggestions = getFallbackSuggestions(intent, context.summary);
    return createErrorResponse(new Error(error), intent, context.summary, suggestions);
  }

  /**
   * Recover from errors with fallback chain
   */
  private async recoverFromError(
    error: unknown,
    question: string,
    intent: AnalysisIntent,
    context: HandlerContext
  ): Promise<{ answer: string; charts?: ChartSpec[]; insights?: Insight[] }> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`🔄 Error recovery: ${errorMessage}`);

    // Fallback Chain:
    // 1. Try general handler
    const generalHandler = this.handlers.find(h => h.canHandle(intent));
    if (generalHandler) {
      try {
        console.log(`🔄 Trying general handler as fallback...`);
        const response = await generalHandler.handle(intent, context);
        if (!response.error) {
          return {
            answer: response.answer,
            charts: response.charts,
            insights: response.insights,
          };
        }
      } catch (fallbackError) {
        console.log(`⚠️ General handler also failed`);
      }
    }

    // 2. Ask clarifying question (but not for conversational queries)
    if (intent.confidence < 0.5 && intent.type !== 'conversational') {
      return askClarifyingQuestion(intent, context.summary);
    }

    // 3. Return helpful error with suggestions (or simple response for conversational)
    if (intent.type === 'conversational') {
      // For conversational queries, just return a friendly message
      const userMessage = intent.customRequest || question || '';
      const questionLower = userMessage.toLowerCase();
      if (questionLower.match(/\b(hi|hello|hey)\b/)) {
        return { answer: "Hi there! 👋 I'm here to help you explore your data. What would you like to know?" };
      }
      return { answer: "I'm here to help! What would you like to know about your data?" };
    }
    
    const suggestions = getFallbackSuggestions(intent, context.summary);
    return createErrorResponse(
      error instanceof Error ? error : new Error(errorMessage),
      intent,
      context.summary,
      suggestions
    );
  }
}

// Singleton instance
let orchestratorInstance: AgentOrchestrator | null = null;

/**
 * Get or create orchestrator instance
 */
export function getOrchestrator(): AgentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AgentOrchestrator();
  }
  return orchestratorInstance;
}

