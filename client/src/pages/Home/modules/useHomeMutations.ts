import { useMutation } from '@tanstack/react-query';
import { Message, UploadResponse, ChatResponse } from '@shared/schema';
import { apiRequest, uploadFile } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface UseHomeMutationsProps {
  sessionId: string | null;
  messages: Message[];
  setSessionId: (id: string | null) => void;
  setInitialCharts: (charts: UploadResponse['charts']) => void;
  setInitialInsights: (insights: UploadResponse['insights']) => void;
  setSampleRows: (rows: Record<string, any>[]) => void;
  setColumns: (columns: string[]) => void;
  setNumericColumns: (columns: string[]) => void;
  setDateColumns: (columns: string[]) => void;
  setTotalRows: (rows: number) => void;
  setTotalColumns: (columns: number) => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
}

export const useHomeMutations = ({
  sessionId,
  messages,
  setSessionId,
  setInitialCharts,
  setInitialInsights,
  setSampleRows,
  setColumns,
  setNumericColumns,
  setDateColumns,
  setTotalRows,
  setTotalColumns,
  setMessages,
}: UseHomeMutationsProps) => {
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return await uploadFile<UploadResponse>('/api/upload', file);
    },
    onSuccess: (data) => {
      console.log("upload chart data from the backend",data)
      setSessionId(data.sessionId);
      setInitialCharts(data.charts);
      setInitialInsights(data.insights);
      
      // Store sample rows and columns for data preview
      if (data.sampleRows && data.sampleRows.length > 0) {
        setSampleRows(data.sampleRows);
        setColumns(data.summary.columns.map(c => c.name));
        setNumericColumns(data.summary.numericColumns);
        setDateColumns(data.summary.dateColumns);
        setTotalRows(data.summary.rowCount);
        setTotalColumns(data.summary.columnCount);
      }
      
      // Create initial assistant message with charts and insights - more conversational
      const initialMessage: Message = {
        role: 'assistant',
        content: `Hi! 👋 I've just finished analyzing your data. Here's what I found:\n\n📊 Your dataset has ${data.summary.rowCount} rows and ${data.summary.columnCount} columns\n🔢 ${data.summary.numericColumns.length} numeric columns to work with\n📅 ${data.summary.dateColumns.length} date columns for time-based analysis\n\nI've created ${data.charts.length} visualizations and ${data.insights.length} key insights to get you started. Feel free to ask me anything about your data - I'm here to help! What would you like to explore first?`,
        charts: data.charts,
        insights: data.insights,
        timestamp: Date.now(),
      };
      
      setMessages([initialMessage]);
      
      toast({
        title: 'Analysis Complete',
        description: 'Your data has been analyzed successfully!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive',
      });
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      console.log('📤 Sending chat message:', message);
      console.log('📋 SessionId:', sessionId);
      console.log('💬 Chat history length:', messages.length);
      
      // Send full chat history for context (last 15 messages to maintain conversation flow)
      const chatHistory = messages.slice(-15).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      console.log('📤 Request payload:', {
        sessionId,
        message,
        chatHistoryLength: chatHistory.length,
      });
      
      try {
        const response = await apiRequest<ChatResponse>({
          method: 'POST',
          route: '/api/chat',
          data: {
            sessionId,
            message,
            chatHistory,
          },
        });
        
        console.log('✅ API request successful, response:', response);
        return response;
      } catch (error) {
        console.error('❌ API request failed:', error);
        throw error;
      }
    },
    onSuccess: (data, message) => {
      console.log('✅ Chat response received:', data);
      console.log('📝 Answer:', data.answer);
      console.log('📊 Charts:', data.charts?.length || 0);
      console.log('💡 Insights:', data.insights?.length || 0);
      
      if (!data.answer || data.answer.trim().length === 0) {
        console.error('❌ Empty answer received from server!');
        toast({
          title: 'Error',
          description: 'Received empty response from server. Please try again.',
          variant: 'destructive',
        });
        return;
      }
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        charts: data.charts,
        insights: data.insights,
        timestamp: Date.now(),
      };
      
      console.log('💬 Adding assistant message to chat:', assistantMessage.content.substring(0, 50));
      setMessages((prev) => {
        const updated = [...prev, assistantMessage];
        console.log('📋 Total messages now:', updated.length);
        return updated;
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  return {
    uploadMutation,
    chatMutation,
  };
};
