import { useState, useRef, useEffect } from 'react';
import { Message } from '@shared/schema';
import { MessageBubble } from '@/pages/Home/Components/MessageBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Upload as UploadIcon, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onUploadNew: () => void;
  isLoading: boolean;
  onLoadHistory?: () => void;
  canLoadHistory?: boolean;
  loadingHistory?: boolean;
  sampleRows?: Record<string, any>[];
  columns?: string[];
  numericColumns?: string[];
  dateColumns?: string[];
  totalRows?: number;
  totalColumns?: number;
}

// Dynamic suggestions based on conversation context
const getSuggestions = (messages: Message[], columns?: string[], numericColumns?: string[]) => {
  // If there's conversation history, suggest follow-ups
  if (messages.length > 1) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'assistant' && lastMessage.content) {
      // Extract mentioned columns from last response
      const mentionedCols = (columns || []).filter(col => 
        lastMessage.content.toLowerCase().includes(col.toLowerCase())
      );
      
      if (mentionedCols.length > 0) {
        return [
          `Tell me more about ${mentionedCols[0]}`,
          `What affects ${mentionedCols[0]}?`,
          `Show me trends for ${mentionedCols[0]}`,
          "What else can you show me?"
        ];
      }
    }
  }
  
  // Default suggestions
  return [
    "What affects revenue?",
    "Show me trends over time",
    "What are the top performers?",
    "Analyze correlations in the data"
  ];
};

export function ChatInterface({ 
  messages, 
  onSendMessage, 
  onUploadNew, 
  isLoading, 
  onLoadHistory,
  canLoadHistory = false,
  loadingHistory = false,
  sampleRows, 
  columns,
  numericColumns,
  dateColumns,
  totalRows,
  totalColumns
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!isLoading) {
      onSendMessage(suggestion);
    }
  };

  return (
    <div className="flex flex-col bg-gradient-to-br from-slate-50 to-white h-[calc(100vh-80px)] relative">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div />
            {onLoadHistory && canLoadHistory && (
              <Button variant="outline" size="sm" onClick={onLoadHistory} disabled={loadingHistory || isLoading}>
                {loadingHistory ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
                Load chat history
              </Button>
            )}
          </div>
          {messages.map((message, idx) => (
            <MessageBubble 
              key={idx} 
              message={message} 
              sampleRows={idx === 0 ? sampleRows : undefined}
              columns={idx === 0 ? columns : undefined}
              numericColumns={idx === 0 ? numericColumns : undefined}
              dateColumns={idx === 0 ? dateColumns : undefined}
              totalRows={idx === 0 ? totalRows : undefined}
              totalColumns={idx === 0 ? totalColumns : undefined}
            />
          ))}
          
          {isLoading && (
            <div className="flex gap-3 justify-start mb-6">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
                <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
              </div>
              <Card className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-600">Analyzing your question...</p>
              </Card>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900 mb-3 text-center">Try asking:</h3>
              <div className="flex flex-wrap gap-2 justify-center" data-testid="suggestion-chips">
                {getSuggestions(messages, columns, numericColumns).map((suggestion, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={isLoading}
                    data-testid={`suggestion-${idx}`}
                    className="text-xs px-3 py-1.5 rounded-full border-gray-200 hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {/* Show follow-up suggestions after assistant messages */}
          {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !isLoading && (
            <div className="mb-4 mt-2">
              <div className="flex flex-wrap gap-2 justify-center">
                {getSuggestions(messages, columns, numericColumns).slice(0, 3).map((suggestion, idx) => (
                  <Button
                    key={idx}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={isLoading}
                    className="text-xs px-3 py-1.5 rounded-full text-gray-600 hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about your data..."
              disabled={isLoading}
              data-testid="input-message"
              className="flex-1 h-10 text-sm rounded-xl bg-white border-2 border-gray-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary shadow-sm"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              data-testid="button-send"
              size="icon"
              className="h-10 w-10 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
