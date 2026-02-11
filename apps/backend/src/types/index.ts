export interface Novel {
  id: string;
  userId: string;
  title?: string;
  genre: string[];
  style: string[];
  targetWords: number;
  minChapterWords: number;
  background?: string;
  worldSettings?: {
    timeBackground?: string;
    worldRules?: string[];
    powerSystem?: string;
    forbiddenRules?: string[];
  };
  status: 'draft' | 'generating' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface Character {
  id: string;
  novelId: string;
  name: string;
  role: string;
  personality: string[];
  abilities: Array<{ name: string; level: number }>;
  relationships?: Array<{ characterId: string; relation: string }>;
  currentState?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chapter {
  id: string;
  novelId: string;
  volumeId?: string;
  title: string;
  order: number;
  outline?: string;
  detailOutline?: string;
  content?: string;
  wordCount: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  novelId: string;
  chapterId?: string;
  type: 'outline' | 'title' | 'chapter_planning' | 'chapter_outline' | 'chapter_detail' | 'content' | 'consistency';
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIConfig {
  id: string;
  userId: string;
  provider: 'openai' | 'anthropic' | 'deepseek';
  model: string;
  apiKey: string;
  baseUrl?: string;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  isDefault: number;
  createdAt: Date;
  updatedAt: Date;
}
