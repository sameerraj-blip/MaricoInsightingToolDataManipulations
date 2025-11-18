import { ThinkingStep } from '@shared/schema';
import { CheckCircle2, Loader2, AlertCircle, Circle } from 'lucide-react';

interface ThinkingDisplayProps {
  steps: ThinkingStep[];
}

export function ThinkingDisplay({ steps }: ThinkingDisplayProps) {
  console.log('🎨 ThinkingDisplay rendered with steps:', steps);
  if (!steps || steps.length === 0) {
    console.log('⚠️ ThinkingDisplay: No steps to display');
    return null;
  }

  // Group steps by step name to track status changes
  const stepMap = new Map<string, ThinkingStep>();
  const stepOrder: string[] = [];

  for (const step of steps) {
    if (!stepMap.has(step.step)) {
      stepMap.set(step.step, step);
      stepOrder.push(step.step);
    } else {
      // Update with latest status
      const existing = stepMap.get(step.step)!;
      if (step.timestamp > existing.timestamp) {
        stepMap.set(step.step, step);
      }
    }
  }

  const getStepIcon = (status: ThinkingStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'active':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
      default:
        return <Circle className="w-4 h-4 text-gray-300" />;
    }
  };

  const getStepTextColor = (status: ThinkingStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-gray-600';
      case 'active':
        return 'text-blue-600 font-medium';
      case 'error':
        return 'text-red-600';
      case 'pending':
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="mt-3 ml-11 space-y-2">
      <div className="text-xs font-medium text-gray-500 mb-2">Thinking...</div>
      <div className="space-y-1.5">
        {stepOrder.map((stepName) => {
          const step = stepMap.get(stepName)!;
          const isActive = step.status === 'active';
          const isCompleted = step.status === 'completed';
          const isError = step.status === 'error';

          return (
            <div
              key={stepName}
              className={`flex items-start gap-2 text-xs transition-all duration-200 ${
                isActive ? 'opacity-100' : isCompleted ? 'opacity-75' : 'opacity-50'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getStepIcon(step.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className={getStepTextColor(step.status)}>
                  {step.step}
                </div>
                {step.details && (
                  <div className="text-xs text-gray-500 mt-0.5 ml-0">
                    {step.details}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

