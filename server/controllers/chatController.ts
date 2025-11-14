import { Request, Response } from "express";
import { answerQuestion } from "../lib/dataAnalyzer.js";
import { processChartData } from "../lib/chartGenerator.js";
import { generateChartInsights } from "../lib/insightGenerator.js";
import { chatResponseSchema } from "../../shared/schema.js";
import { getChatBySessionIdEfficient, addMessageToChat, addMessagesBySessionId } from "../lib/cosmosDB.js";

export const chatWithAI = async (req: Request, res: Response) => {
  try {
    console.log('📨 chatWithAI() called');
    const { sessionId, message, chatHistory } = req.body;
    const username = req.body.username || req.headers['x-user-email'] || 'anonymous@example.com';

    console.log('📥 Request body:', { sessionId, message: message?.substring(0, 50), chatHistoryLength: chatHistory?.length });

    if (!sessionId || !message) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get chat document from CosmosDB by session ID
    console.log('🔍 Fetching chat document for sessionId:', sessionId);
    const chatDocument = await getChatBySessionIdEfficient(sessionId);

    if (!chatDocument) {
      console.log('❌ Chat document not found');
      return res.status(404).json({ error: 'Session not found. Please upload a file first.' });
    }

    console.log('✅ Chat document found, calling answerQuestion()');
    // Get chat-level insights from the document to inform chart insights
    const chatLevelInsights = chatDocument.insights && Array.isArray(chatDocument.insights) && chatDocument.insights.length > 0
      ? chatDocument.insights
      : undefined;
    
    // Answer the question using data from CosmosDB
    const result = await answerQuestion(
      chatDocument.rawData, // Use the actual data stored in CosmosDB
      message,
      chatHistory || [],
      chatDocument.dataSummary,
      sessionId, // Pass sessionId for RAG
      chatLevelInsights // Pass chat insights to inform chart insights
    );

    // Ensure every chart has per-chart keyInsight and recommendation before validation
    // Use chat-level insights to inform chart insights (prefer result insights, fallback to document insights)
    const finalChatInsights = result.insights && Array.isArray(result.insights) && result.insights.length > 0
      ? result.insights
      : chatLevelInsights;
    
    if (result.charts && Array.isArray(result.charts)) {
      try {
        result.charts = await Promise.all(
          result.charts.map(async (c: any) => {
            const dataForChart = c.data && Array.isArray(c.data)
              ? c.data
              : processChartData(chatDocument.rawData, c);
            const insights = !('keyInsight' in c)
              ? await generateChartInsights(c, dataForChart, chatDocument.dataSummary, chatLevelInsights)
              : null;
            return {
              ...c,
              data: dataForChart,
              keyInsight: c.keyInsight ?? insights?.keyInsight,
            };
          })
        );
      } catch (e) {
        console.error('Final enrichment of chat charts failed:', e);
      }
    }

    // Validate response has answer
    if (!result || !result.answer || result.answer.trim().length === 0) {
      console.error('❌ Empty answer from answerQuestion:', result);
      return res.status(500).json({
        error: 'Failed to generate response. Please try again.',
        answer: "I'm sorry, I couldn't generate a response. Please try rephrasing your question.",
      });
    }
    
    console.log('✅ Answer generated:', result.answer.substring(0, 100));
    console.log('📤 Response being sent:', {
      answerLength: result.answer?.length,
      hasCharts: !!result.charts,
      chartsCount: result.charts?.length || 0,
      hasInsights: !!result.insights,
      insightsCount: result.insights?.length || 0,
    });
    
    // Validate response
    let validated = chatResponseSchema.parse(result);
    console.log('✅ Response validated successfully');

    // Ensure overall chat insights always present: derive from charts if missing
    if ((!validated.insights || validated.insights.length === 0) && Array.isArray(validated.charts) && validated.charts.length > 0) {
      try {
        const derived = validated.charts
          .map((c: any, idx: number) => {
            const text = c?.keyInsight || (c?.title ? `Insight: ${c.title}` : null);
            return text ? { id: idx + 1, text } : null;
          })
          .filter(Boolean) as { id: number; text: string }[];
        if (derived.length > 0) {
          validated = { ...validated, insights: derived } as any;
        }
      } catch {}
    }

    // Save messages to CosmosDB (by sessionId to avoid partition mismatches)
    try {
      await addMessagesBySessionId(sessionId, [
        {
          role: 'user',
          content: message,
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: validated.answer,
          charts: validated.charts,
          insights: validated.insights,
          timestamp: Date.now(),
        },
      ]);

      console.log(`✅ Messages saved to chat: ${chatDocument.id}`);
    } catch (cosmosError) {
      console.error("⚠️ Failed to save messages to CosmosDB:", cosmosError);
      // Continue without failing the chat - CosmosDB is optional
    }

    console.log('📨 Sending response to client:', {
      answerLength: validated.answer.length,
      chartsCount: validated.charts?.length || 0,
      insightsCount: validated.insights?.length || 0,
    });
    res.json(validated);
    console.log('✅ Response sent successfully');
  } catch (error) {
    console.error('Chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process message';
    // Always return a valid response with an answer field
    res.status(500).json({
      error: errorMessage,
      answer: `I'm sorry, I encountered an error: ${errorMessage}. Please try again or rephrase your question.`,
      charts: [],
      insights: [],
    });
  }
};
