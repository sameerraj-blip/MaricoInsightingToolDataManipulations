import { BaseHandler, HandlerContext, HandlerResponse } from './baseHandler.js';
import { AnalysisIntent } from '../intentClassifier.js';
import { openai } from '../../openai.js';
import { getModelForTask } from '../models.js';

/**
 * Conversational Handler
 * Handles casual chat, greetings, thanks, and non-data questions
 */
export class ConversationalHandler extends BaseHandler {
  canHandle(intent: AnalysisIntent): boolean {
    return intent.type === 'conversational';
  }

  async handle(intent: AnalysisIntent, context: HandlerContext): Promise<HandlerResponse> {
    console.log('💬 ConversationalHandler processing intent:', intent.type);
    
    // Validate data (not really needed for conversational, but good practice)
    const validation = this.validateData(intent, context);
    if (!validation.valid && validation.errors.length > 0) {
      // For conversational, we can still proceed even with validation errors
      console.log('⚠️ Validation warnings (continuing anyway):', validation.warnings);
    }

    // Build conversation history context
    const recentHistory = context.chatHistory
      .slice(-5)
      .filter(msg => msg.content && msg.content.length < 500)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const historyContext = recentHistory ? `\n\nCONVERSATION HISTORY:\n${recentHistory}` : '';

    // Use original question if available, otherwise customRequest, otherwise fallback
    const userMessage = intent.originalQuestion || intent.customRequest || 'something';
    console.log('💬 User message:', userMessage);
    
    const prompt = `You are a friendly, helpful data analyst assistant. The user just said: "${userMessage}"
${historyContext}

Respond naturally and conversationally. Be warm, friendly, and engaging. If they're greeting you, greet them back enthusiastically. If they're thanking you, acknowledge it warmly. If they're asking what you can do, briefly explain you help with data analysis.

Keep it SHORT (1-2 sentences max) and natural. Don't be robotic. Use emojis sparingly (1 max).
Just respond conversationally - no data analysis needed here.`;

    try {
      const model = getModelForTask('generation');
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a friendly, conversational data analyst assistant. Respond naturally and warmly to casual conversation. Keep responses brief and engaging.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.9, // Higher temperature for more natural, varied responses
        max_tokens: 100, // Short responses for casual chat
      });

      const answer = response.choices[0].message.content?.trim() || 
        "Hi! I'm here to help you explore your data. What would you like to know?";

      console.log('💬 Generated conversational response:', answer.substring(0, 100));
      
      if (!answer || answer.trim().length === 0) {
        console.error('❌ Empty answer from OpenAI, using fallback');
        throw new Error('Empty answer from OpenAI');
      }

      return {
        answer,
      };
    } catch (error) {
      console.error('Conversational response error:', error);
      
      // Fallback responses
      const userMessage = intent.originalQuestion || intent.customRequest || '';
      const questionLower = userMessage.toLowerCase();
      if (questionLower.match(/\b(hi|hello|hey)\b/)) {
        return { answer: "Hi there! 👋 I'm here to help you explore your data. What would you like to know?" };
      } else if (questionLower.match(/\b(thanks|thank you)\b/)) {
        return { answer: "You're welcome! Happy to help. Anything else you'd like to explore?" };
      } else if (questionLower.match(/\b(bye|goodbye)\b/)) {
        return { answer: "Goodbye! Feel free to come back if you have more questions about your data." };
      }
      
      return {
        answer: "I'm here to help! What would you like to know about your data?",
      };
    }
  }
}

