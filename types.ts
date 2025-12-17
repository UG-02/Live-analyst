
export interface AgentSuggestions {
  suggestedQuestions: string[];
  objectionHandling: string[];
  productRecommendations: string[];
}

export interface AnalysisData {
  sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Mixed';
  emotion: string;
  intent: string;
  entities: string[];
  suggestions?: AgentSuggestions;
}

export interface TranscriptItem {
  id: string;
  speaker: 'User' | 'Model' | 'Customer' | 'Sales Rep' | 'Speaker 1' | 'Speaker 2' | 'Transcript';
  text: string;
  timestamp: string;
  analysis?: AnalysisData; // Optional, mainly for user/customer turns
}

export enum SessionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  PROCESSING = 'PROCESSING',
  ERROR = 'ERROR',
}

// Format expected from File Upload JSON response
export interface DiarizedTurn {
  speaker: string;
  text: string;
  sentiment?: string;
  emotion?: string;
  intent?: string;
  entities?: string[];
  suggestions?: AgentSuggestions;
}
