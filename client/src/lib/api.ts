import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getUserEmail } from '@/utils/userStorage';
import { 
  UploadResponse, 
  ChatResponse,
  UserAnalysisSessionsResponse,
  CompleteAnalysisData,
  ColumnStatisticsResponse,
  RawDataResponse,
  Dashboard,
  ChartSpec,
  ThinkingStep,
} from '@shared/schema';

// Base configuration for your backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? (typeof window !== 'undefined' ? window.location.origin : 'https://marico-insight-safe.vercel.app')
    : 'http://localhost:3002');

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 0, // No timeout - wait indefinitely for response
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding user email to headers
apiClient.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to: ${config.url}`);
    
    // Add user email to headers if available
    const userEmail = getUserEmail();
    if (userEmail) {
      config.headers = config.headers || {};
      config.headers['X-User-Email'] = userEmail;
      console.log(`Adding user email to headers: ${userEmail}`);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling with CORS retry logic
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    // Check if request was cancelled/aborted FIRST - don't treat as network error
    if (axios.isCancel(error) || error?.code === 'ERR_CANCELED' || error?.name === 'AbortError') {
      console.log('🚫 Request was cancelled');
      // Create a custom error that will be caught by apiRequest
      const cancelError = new Error('Request cancelled');
      (cancelError as any).isCancel = true;
      (cancelError as any).code = 'ERR_CANCELED';
      throw cancelError;
    }
    
    // Handle CORS and network errors with retry logic
    if (error.code === 'ERR_NETWORK' || 
        error.message.includes('CORS') || 
        error.message.includes('Network Error') ||
        error.message.includes('Failed to fetch')) {
      
      console.log('CORS/Network error detected, retrying once...');
      
      // Retry once for CORS/network errors
      try {
        if (error.config) {
          const retryResponse = await apiClient.request(error.config);
          return retryResponse;
        }
      } catch (retryError) {
        console.log('Retry failed:', retryError);
        throw new Error('Network error: CORS issue persists after retry');
      }
    }
    
    if (error.response) {
      // Server responded with error status
      const errorData = error.response.data as any;
      const message = errorData?.error || errorData?.message || error.message || 'Request failed';
      throw new Error(message);
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('Network error: No response from server');
    } else {
      // Something else happened
      throw new Error(`Request error: ${error.message}`);
    }
  }
);

// Generic API request function
export interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  route: string;
  data?: any;
  config?: AxiosRequestConfig;
  signal?: AbortSignal; // Add abort signal support
}

export async function apiRequest<T = any>({
  method,
  route,
  data,
  config = {},
  signal
}: ApiRequestOptions): Promise<T> {
  try {
    console.log(`🌐 Making ${method} request to ${route}`);
    const response = await apiClient.request({
      method,
      url: route,
      data,
      signal, // Add signal to request
      ...config,
    });
    console.log(`✅ ${method} ${route} - Status: ${response.status}`);
    console.log('📦 Response data:', response.data);
    return response.data;
  } catch (error: any) {
    // Check if request was aborted (check both axios cancel and our custom cancel error)
    if (axios.isCancel(error) || 
        error?.name === 'AbortError' || 
        error?.code === 'ERR_CANCELED' ||
        error?.isCancel === true ||
        error?.message === 'Request cancelled') {
      console.log(`🚫 ${method} ${route} was cancelled`);
      throw new Error('Request cancelled');
    }
    console.error(`❌ ${method} ${route} failed:`, error);
    throw error; // Error is already handled by interceptor
  }
}

// Convenience methods for common HTTP methods
export const api = {
  get: <T = any>(route: string, config?: AxiosRequestConfig & { signal?: AbortSignal }) =>
    apiRequest<T>({ method: 'GET', route, config, signal: config?.signal }),
  
  post: <T = any>(route: string, data?: any, config?: AxiosRequestConfig & { signal?: AbortSignal }) =>
    apiRequest<T>({ method: 'POST', route, data, config, signal: config?.signal }),
  
  put: <T = any>(route: string, data?: any, config?: AxiosRequestConfig & { signal?: AbortSignal }) =>
    apiRequest<T>({ method: 'PUT', route, data, config, signal: config?.signal }),
  
  patch: <T = any>(route: string, data?: any, config?: AxiosRequestConfig & { signal?: AbortSignal }) =>
    apiRequest<T>({ method: 'PATCH', route, data, config, signal: config?.signal }),
  
  delete: <T = any>(route: string, config?: AxiosRequestConfig & { signal?: AbortSignal }) =>
    apiRequest<T>({ method: 'DELETE', route, config, signal: config?.signal }),
};

// File upload helper
export async function uploadFile<T = any>(
  route: string,
  file: File,
  additionalData?: Record<string, any>
): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  
  // Add any additional data to formData
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }
  
  // Get user email for headers
  const userEmail = getUserEmail();
  const headers: Record<string, string> = {
    'Content-Type': 'multipart/form-data',
  };
  
  if (userEmail) {
    headers['X-User-Email'] = userEmail;
    console.log(`Adding user email to upload headers: ${userEmail}`);
  }
  
  return apiRequest<T>({
    method: 'POST',
    route,
    data: formData,
    config: {
      headers,
    },
  });
}

// Data retrieval API functions
export const dataApi = {
  // Get all analysis sessions for a user
  getUserSessions: (username: string) =>
    api.get<UserAnalysisSessionsResponse>(`/data/user/${username}/sessions`),
  
  // Get complete analysis data for a specific chat
  getAnalysisData: (chatId: string, username: string) =>
    api.get<CompleteAnalysisData>(`/data/chat/${chatId}?username=${username}`),
  
  // Get analysis data by session ID
  getAnalysisDataBySession: (sessionId: string) =>
    api.get<CompleteAnalysisData>(`/data/session/${sessionId}`),
  
  // Get column statistics for a specific analysis
  getColumnStatistics: (chatId: string, username: string) =>
    api.get<ColumnStatisticsResponse>(`/data/chat/${chatId}/statistics?username=${username}`),
  
  // Get raw data for a specific analysis (with pagination)
  getRawData: (chatId: string, username: string, page = 1, limit = 100) =>
    api.get<RawDataResponse>(`/data/chat/${chatId}/raw-data?username=${username}&page=${page}&limit=${limit}`),
};

// Sessions API functions
export const sessionsApi = {
  // Get all sessions for the current user
  getAllSessions: () => api.get('/api/sessions'),
  
  // Get sessions with pagination
  getSessionsPaginated: (pageSize: number = 10, continuationToken?: string) => {
    const params = new URLSearchParams({ pageSize: pageSize.toString() });
    if (continuationToken) {
      params.append('continuationToken', continuationToken);
    }
    return api.get(`/sessions/paginated?${params}`);
  },
  
  // Get sessions with filters
  getSessionsFiltered: (filters: {
    startDate?: string;
    endDate?: string;
    fileName?: string;
    minMessageCount?: number;
    maxMessageCount?: number;
  }) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    return api.get(`/api/sessions/filtered?${params}`);
  },
  
  // Get session statistics
  getSessionStatistics: () => api.get('/api/sessions/statistics'),
  
  // Get detailed session by session ID
  getSessionDetails: (sessionId: string) => api.get(`/api/sessions/details/${sessionId}`),
  
  // Get sessions by specific user
  getSessionsByUser: (username: string) => api.get(`/api/sessions/user/${username}`),
  
  // Update session name by session ID
  updateSessionName: (sessionId: string, fileName: string) =>
    api.patch(`/api/sessions/${sessionId}`, { fileName }),
  
  // Delete session by session ID
  deleteSession: (sessionId: string) => api.delete(`/api/sessions/${sessionId}`),
};

export default apiClient;

// Streaming chat request with SSE support
export interface StreamChatCallbacks {
  onThinkingStep?: (step: ThinkingStep) => void;
  onResponse?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}

export async function streamChatRequest(
  sessionId: string,
  message: string,
  chatHistory: Array<{ role: string; content: string }>,
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const userEmail = getUserEmail();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (userEmail) {
    headers['X-User-Email'] = userEmail;
  }

  try {
    console.log('🌐 Starting SSE stream to:', `${API_BASE_URL}/api/chat/stream`);
    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers,
      credentials: 'include', // Include credentials for CORS
      body: JSON.stringify({
        sessionId,
        message,
        chatHistory,
      }),
      signal,
    });
    
    console.log('📡 SSE response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = 'message';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages (event + data pairs separated by double newlines)
        // SSE format: "event: type\ndata: {...}\n\n"
        let messageEnd;
        while ((messageEnd = buffer.indexOf('\n\n')) !== -1) {
          const message = buffer.substring(0, messageEnd);
          buffer = buffer.substring(messageEnd + 2);
          
          let eventType = 'message';
          let data = '';
          
          const lines = message.split('\n');
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
              data = line.substring(6).trim();
            }
          }
          
          if (data) {
            try {
              const parsed = JSON.parse(data);
              console.log('📡 SSE event received:', eventType, parsed);

              if (eventType === 'thinking' && callbacks.onThinkingStep) {
                callbacks.onThinkingStep(parsed as ThinkingStep);
              } else if (eventType === 'response' && callbacks.onResponse) {
                callbacks.onResponse(parsed as ChatResponse);
              } else if (eventType === 'error' && callbacks.onError) {
                callbacks.onError(new Error(parsed.message || 'Unknown error'));
              } else if (eventType === 'done' && callbacks.onDone) {
                callbacks.onDone();
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError, data);
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        let eventType = 'message';
        let data = '';
        
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            data = line.substring(6).trim();
          }
        }
        
        if (data) {
          try {
            const parsed = JSON.parse(data);
            console.log('📡 Final SSE event:', eventType, parsed);
            
            if (eventType === 'thinking' && callbacks.onThinkingStep) {
              callbacks.onThinkingStep(parsed as ThinkingStep);
            } else if (eventType === 'response' && callbacks.onResponse) {
              callbacks.onResponse(parsed as ChatResponse);
            } else if (eventType === 'error' && callbacks.onError) {
              callbacks.onError(new Error(parsed.message || 'Unknown error'));
            } else if (eventType === 'done' && callbacks.onDone) {
              callbacks.onDone();
            }
          } catch (parseError) {
            console.error('Error parsing final SSE data:', parseError);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log('🚫 Stream request was cancelled');
      return;
    }
    
    if (callbacks.onError) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    } else {
      throw error;
    }
  }
}

// Dashboards API
export const dashboardsApi = {
  list: () => api.get<{ dashboards: Dashboard[] }>('/api/dashboards'),
  get: (dashboardId: string) => api.get<Dashboard>(`/api/dashboards/${dashboardId}`),
  create: (name: string, charts?: ChartSpec[]) =>
    api.post<Dashboard>('/api/dashboards', { name, charts }),
  remove: (dashboardId: string) =>
    api.delete(`/api/dashboards/${dashboardId}`),
  addChart: (dashboardId: string, chart: ChartSpec, sheetId?: string) =>
    api.post<Dashboard>(`/api/dashboards/${dashboardId}/charts`, { chart, sheetId }),
  removeChart: (dashboardId: string, payload: { index?: number; title?: string; type?: ChartSpec['type']; sheetId?: string }) =>
    api.delete<Dashboard>(`/api/dashboards/${dashboardId}/charts`, { data: payload as any }),
  addSheet: (dashboardId: string, name: string) =>
    api.post<Dashboard>(`/api/dashboards/${dashboardId}/sheets`, { name }),
  removeSheet: (dashboardId: string, sheetId: string) =>
    api.delete<Dashboard>(`/api/dashboards/${dashboardId}/sheets/${sheetId}`),
  renameSheet: (dashboardId: string, sheetId: string, name: string) =>
    api.patch<Dashboard>(`/api/dashboards/${dashboardId}/sheets/${sheetId}`, { name }),
  rename: (dashboardId: string, name: string) =>
    api.patch<Dashboard>(`/api/dashboards/${dashboardId}`, { name }),
  updateChartInsightOrRecommendation: (
    dashboardId: string,
    chartIndex: number,
    updates: { keyInsight?: string },
    sheetId?: string
  ) =>
    api.patch<Dashboard>(`/api/dashboards/${dashboardId}/charts/${chartIndex}`, {
      sheetId,
      ...updates,
    }),
};
