export interface User {
  uid: string;
  email: string;
  display_name: string;
  created_at: string;
  last_login: string;
}

export interface ChatMessage {
  id: number;
  user_uid: string;
  session_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  model_used: string;
  timestamp: string;
}

export interface ContextMemory {
  id: number;
  user_uid: string;
  key: string;
  value: string;
  type: string;
  timestamp: string;
}

export interface AutomationTask {
  id: number;
  user_uid: string;
  name: string;
  command: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output: string;
  created_at: string;
  completed_at: string | null;
}

export interface AuthenticatedRequest extends Express.Request {
  user?: {
    uid: string;
    email: string;
    name: string;
  };
  dbUser?: User;
}

export interface ChatRequest {
  message: string;
  provider?: string;
  sessionId?: string;
}

export interface CliRequest {
  command: string;
  workDir?: string;
}

export interface TaskRequest {
  name: string;
  command: string;
}

export interface SseChunk {
  content?: string;
  stream?: string;
  output?: string;
  error?: string;
  status?: string;
  taskId?: number;
  exitCode?: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  providers: {
    openai: boolean;
    gemini: boolean;
    grok: boolean;
    openrouter: boolean;
  };
}
