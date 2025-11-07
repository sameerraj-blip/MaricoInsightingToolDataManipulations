import { Message } from '@shared/schema';
import { User, Bot } from 'lucide-react';
import { ChartRenderer } from './ChartRenderer';
import { InsightCard } from './InsightCard';
import { DataPreview } from './DataPreview';

interface MessageBubbleProps {
  message: Message;
  sampleRows?: Record<string, any>[];
  columns?: string[];
  numericColumns?: string[];
  dateColumns?: string[];
  totalRows?: number;
  totalColumns?: number;
}

export function MessageBubble({ 
  message, 
  sampleRows, 
  columns,
  numericColumns,
  dateColumns,
  totalRows,
  totalColumns
}: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      data-testid={`message-${message.role}`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
          <Bot className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
      
      <div className={`flex-1 max-w-[90%] ${isUser ? 'ml-auto' : 'mr-0'}`}>
        {isUser && (
          <div
            className={`rounded-xl px-4 py-3 shadow-sm bg-primary text-primary-foreground ml-auto`}
            data-testid={`message-content-${message.role}`}
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
        )}

        {!isUser && message.content && (
          <div
            className="rounded-xl px-4 py-3 shadow-sm bg-white border border-gray-100"
            data-testid={`message-content-${message.role}`}
          >
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
        )}

        {!isUser && sampleRows && columns && sampleRows.length > 0 && (
          <div className="mt-3">
            <DataPreview 
              data={sampleRows} 
              columns={columns}
              numericColumns={numericColumns}
              dateColumns={dateColumns}
              totalRows={totalRows}
              totalColumns={totalColumns}
              defaultExpanded={true}
            />
          </div>
        )}

        {!isUser && message.charts && message.charts.length > 0 && (
          <div className={`mt-3 grid gap-4 ${
            message.charts.length === 1 
              ? 'grid-cols-1' 
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}>
            {message.charts.map((chart, idx) => (
              <ChartRenderer 
                key={idx} 
                chart={chart} 
                index={idx}
                isSingleChart={message.charts!.length === 1}
              />
            ))}
          </div>
        )}

        {!isUser && message.insights && message.insights.length > 0 && (
          <div className="mt-3">
            <InsightCard insights={message.insights} />
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
          <User className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
