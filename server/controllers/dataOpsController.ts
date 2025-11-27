import { Request, Response } from "express";
import { getChatBySessionIdForUser, updateChatDocument, addMessagesBySessionId, getChatBySessionIdEfficient, ChatDocument } from "../lib/cosmosDB.js";
import { parseDataOpsIntent, executeDataOperation } from "../lib/dataOps/dataOpsOrchestrator.js";
import { Message } from "../../shared/schema.js";

function sendSSE(res: Response, event: string, data: any): boolean {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch (error) {
    console.error('Error sending SSE:', error);
    return false;
  }
}

/**
 * Non-streaming Data Ops chat endpoint
 */
export const dataOpsChatWithAI = async (req: Request, res: Response) => {
  try {
    console.log('📨 dataOpsChatWithAI() called');
    const { sessionId, message, chatHistory, targetTimestamp, dataOpsMode } = req.body;
    const username = (req.body.username as string) || (req.headers['x-user-email'] as string);

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!username) {
      return res.status(401).json({ error: 'Missing authenticated user email' });
    }

    // Get chat document
    const chatDocument = await getChatBySessionIdForUser(sessionId, username);
    if (!chatDocument) {
      return res.status(404).json({ error: 'Session not found. Please upload a file first.' });
    }

    // Update dataOpsMode if provided
    if (dataOpsMode !== undefined && chatDocument.dataOpsMode !== dataOpsMode) {
      chatDocument.dataOpsMode = dataOpsMode;
      await updateChatDocument(chatDocument);
    }

    // Load data - try rawData first, then blob storage, then sampleRows
    let fullData: Record<string, any>[] = [];
    
    console.log(`🔍 Checking data sources - rawData: ${chatDocument.rawData?.length || 0}, sampleRows: ${chatDocument.sampleRows?.length || 0}`);
    
    if (chatDocument.rawData && Array.isArray(chatDocument.rawData) && chatDocument.rawData.length > 0) {
      fullData = chatDocument.rawData;
      console.log(`✅ Using rawData from document: ${fullData.length} rows`);
    } else {
      // Try to load from blob storage (processed data or original file)
      const { getFileFromBlob } = await import('../lib/blobStorage.js');
      const blobName = (chatDocument as any).currentDataBlob?.blobName || chatDocument.blobInfo?.blobName;
      
      if (blobName) {
        try {
          console.log(`📦 Attempting to load from blob: ${blobName}`);
          const blobBuffer = await getFileFromBlob(blobName);
          
          // Try parsing as JSON first (processed data)
          try {
            const blobData = JSON.parse(blobBuffer.toString('utf-8'));
            if (Array.isArray(blobData)) {
              fullData = blobData;
              console.log(`✅ Loaded ${fullData.length} rows from processed data blob`);
            }
          } catch {
            // If not JSON, try parsing as CSV/Excel (original file)
            const { parseFile } = await import('../lib/fileParser.js');
            const parsedData = await parseFile(blobBuffer, chatDocument.fileName);
            if (parsedData && parsedData.length > 0) {
              fullData = parsedData;
              console.log(`✅ Loaded ${fullData.length} rows from original file blob`);
            }
          }
        } catch (error) {
          console.error('⚠️ Failed to load from blob:', error);
        }
      }
    }
    
    // Fallback to sampleRows if still empty
    if (fullData.length === 0 && chatDocument.sampleRows && Array.isArray(chatDocument.sampleRows) && chatDocument.sampleRows.length > 0) {
      fullData = chatDocument.sampleRows;
      console.log(`⚠️ Using sampleRows as fallback: ${fullData.length} rows`);
    }
    
    if (fullData.length === 0) {
      console.error('❌ No data available in document');
      return res.status(400).json({ error: 'No data found. Please upload your file again.' });
    }
    
    console.log(`✅ Using ${fullData.length} rows for data operation`);

    // Parse intent
    const intent = await parseDataOpsIntent(message, chatHistory || [], chatDocument.dataSummary, chatDocument);

    // Execute operation
    const result = await executeDataOperation(intent, fullData, sessionId, chatDocument, message);

    // Save messages
    try {
      await addMessagesBySessionId(sessionId, [
        {
          role: 'user',
          content: message,
          timestamp: Date.now(),
          userEmail: username.toLowerCase(),
        },
        {
          role: 'assistant',
          content: result.answer,
          timestamp: Date.now(),
        },
      ]);
    } catch (error) {
      console.error("⚠️ Failed to save messages:", error);
    }

    res.json({
      answer: result.answer,
      preview: result.preview,
      summary: result.summary,
      saved: result.saved,
    });
  } catch (error) {
    console.error('Data Ops chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process data operation';
    res.status(500).json({ error: errorMessage });
  }
};

/**
 * Streaming Data Ops chat endpoint using Server-Sent Events (SSE)
 */
export const dataOpsChatWithAIStream = async (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    console.log('📨 dataOpsChatWithAIStream() called');
    const { sessionId, message, chatHistory, targetTimestamp, dataOpsMode } = req.body;
    const username = (req.body.username as string) || (req.headers['x-user-email'] as string);

    if (!sessionId || !message) {
      sendSSE(res, 'error', { message: 'Missing required fields' });
      res.end();
      return;
    }

    if (!username) {
      sendSSE(res, 'error', { message: 'Missing authenticated user email' });
      res.end();
      return;
    }

    // Get chat document
    const chatDocument = await getChatBySessionIdForUser(sessionId, username);
    if (!chatDocument) {
      sendSSE(res, 'error', { message: 'Session not found. Please upload a file first.' });
      res.end();
      return;
    }

    // Update dataOpsMode if provided
    if (dataOpsMode !== undefined && chatDocument.dataOpsMode !== dataOpsMode) {
      chatDocument.dataOpsMode = dataOpsMode;
      await updateChatDocument(chatDocument);
    }

    // Send thinking step
    sendSSE(res, 'thinking', {
      step: 'Processing data operation',
      status: 'active',
      timestamp: Date.now(),
    });

    // Load data - try rawData first, then blob storage, then sampleRows
    let fullData: Record<string, any>[] = [];
    
    console.log(`🔍 Checking data sources - rawData: ${chatDocument.rawData?.length || 0}, sampleRows: ${chatDocument.sampleRows?.length || 0}`);
    
    if (chatDocument.rawData && Array.isArray(chatDocument.rawData) && chatDocument.rawData.length > 0) {
      fullData = chatDocument.rawData;
      console.log(`✅ Using rawData from document: ${fullData.length} rows`);
    } else {
      // Try to load from blob storage (processed data or original file)
      const { getFileFromBlob } = await import('../lib/blobStorage.js');
      const blobName = (chatDocument as any).currentDataBlob?.blobName || chatDocument.blobInfo?.blobName;
      
      if (blobName) {
        try {
          console.log(`📦 Attempting to load from blob: ${blobName}`);
          const blobBuffer = await getFileFromBlob(blobName);
          
          // Try parsing as JSON first (processed data)
          try {
            const blobData = JSON.parse(blobBuffer.toString('utf-8'));
            if (Array.isArray(blobData)) {
              fullData = blobData;
              console.log(`✅ Loaded ${fullData.length} rows from processed data blob`);
            }
          } catch {
            // If not JSON, try parsing as CSV/Excel (original file)
            const { parseFile } = await import('../lib/fileParser.js');
            const parsedData = await parseFile(blobBuffer, chatDocument.fileName);
            if (parsedData && parsedData.length > 0) {
              fullData = parsedData;
              console.log(`✅ Loaded ${fullData.length} rows from original file blob`);
            }
          }
        } catch (error) {
          console.error('⚠️ Failed to load from blob:', error);
        }
      }
    }
    
    // Fallback to sampleRows if still empty
    if (fullData.length === 0 && chatDocument.sampleRows && Array.isArray(chatDocument.sampleRows) && chatDocument.sampleRows.length > 0) {
      fullData = chatDocument.sampleRows;
      console.log(`⚠️ Using sampleRows as fallback: ${fullData.length} rows`);
    }
    
    if (fullData.length === 0) {
      console.error('❌ No data available in document');
      sendSSE(res, 'error', { message: 'No data found. Please upload your file again.' });
      res.end();
      return;
    }
    
    console.log(`✅ Using ${fullData.length} rows for data operation`);

    // Parse intent
    sendSSE(res, 'thinking', {
      step: 'Understanding your request',
      status: 'active',
      timestamp: Date.now(),
    });

    const intent = await parseDataOpsIntent(message, chatHistory || [], chatDocument.dataSummary, chatDocument);

    sendSSE(res, 'thinking', {
      step: 'Understanding your request',
      status: 'completed',
      timestamp: Date.now(),
    });

    // Execute operation
    sendSSE(res, 'thinking', {
      step: 'Executing data operation',
      status: 'active',
      timestamp: Date.now(),
    });

    const result = await executeDataOperation(intent, fullData, sessionId, chatDocument, message);

    sendSSE(res, 'thinking', {
      step: 'Executing data operation',
      status: 'completed',
      timestamp: Date.now(),
    });

    // Save messages
    try {
      await addMessagesBySessionId(sessionId, [
        {
          role: 'user',
          content: message,
          timestamp: Date.now(),
          userEmail: username.toLowerCase(),
        },
        {
          role: 'assistant',
          content: result.answer,
          timestamp: Date.now(),
        },
      ]);
    } catch (error) {
      console.error("⚠️ Failed to save messages:", error);
    }

    // Send response
    sendSSE(res, 'response', {
      answer: result.answer,
      preview: result.preview,
      summary: result.summary,
      saved: result.saved,
    });

    sendSSE(res, 'done', {});
    res.end();
    console.log('✅ Data Ops stream completed successfully');
  } catch (error) {
    console.error('Data Ops stream error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process data operation';
    sendSSE(res, 'error', { message: errorMessage });
    res.end();
  }
};

