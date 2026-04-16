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

export interface OutlineEvent {
  id: string;
  title: string;
  description: string;
  characters: string[];
  conflictType: 'internal' | 'external' | 'relationship' | 'mystery';
  turningPoint: string;
  emotionalShift: string;
  outcome: string;
  wordEstimate: number;
  nextEventHints: string[];
  suspenseHook?: string;
  worldBuildingDetails?: string;
}

export interface OutlinePhase {
  id: string;
  phaseName: string;
  phaseType: 'exposition' | 'rising_action' | 'climax' | 'falling_action' | 'resolution';
  startWordEstimate: number;
  endWordEstimate: number;
  coreGoal: string;
  mainConflict: string;
  stakes: string;
  events: OutlineEvent[];
  characterDevelopments: string[];
  worldBuildingAdvancements: string[];
  thematicElements: string[];
  interPhaseHook?: string;
}

export interface PlotThread {
  id: string;
  threadName: string;
  threadType: 'main' | 'sub' | 'character' | 'world' | 'thematic';
  description: string;
  phaseIds: string[];
  eventIds: string[];
  resolution: string;
  thematicSignificance: string;
}

export interface StructuredOutline {
  version: '1.0';
  novelTitle: string;
  corePremise: string;
  centralTheme: string;
  narrativeArc: string;
  mainConflict: {
    type: string;
    description: string;
    escalatingSteps: string[];
  };
  phases: OutlinePhase[];
  plotThreads: PlotThread[];
  characterArcs: {
    characterName: string;
    arcType: string;
    keyEvents: string[];
    resolution: string;
  }[];
  worldBuildingReveals: {
    reveal: string;
    phaseId: string;
    eventId: string;
    significance: string;
  }[];
  pacingGuidelines: {
    overall: string;
    phaseSpecific: {
      phaseId: string;
      pacing: string;
      recommendation: string;
    }[];
  };
  cliffhangerPoints: {
    phaseId: string;
    eventId: string;
    description: string;
    purpose: string;
  }[];
  estimatedTotalWords: number;
  chapterCountEstimate: number;
  phaseToChapterMapping: {
    phaseId: string;
    startChapter: number;
    endChapter: number;
  }[];
}
