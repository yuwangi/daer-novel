import { db, schema } from '../database';
import { eq, desc } from 'drizzle-orm';
import { BaseService } from './base.service';
import { createAIProvider } from './ai/ai-config';
import type { StructuredOutline, OutlinePhase, OutlineEvent, PlotThread } from '../types';

function cleanJson(text: string): string {
  if (!text) return "{}";

  let content = text.trim();

  const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  const match = markdownRegex.exec(content);
  if (match && match[1]) {
    content = match[1].trim();
  } else {
    const firstOpenBrace = content.indexOf("{");
    const firstOpenBracket = content.indexOf("[");

    let startIndex = -1;
    if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
      startIndex = Math.min(firstOpenBrace, firstOpenBracket);
    } else if (firstOpenBrace !== -1) {
      startIndex = firstOpenBrace;
    } else if (firstOpenBracket !== -1) {
      startIndex = firstOpenBracket;
    }

    if (startIndex !== -1) {
      const lastCloseBrace = content.lastIndexOf("}");
      const lastCloseBracket = content.lastIndexOf("]");
      const endIndex = Math.max(lastCloseBrace, lastCloseBracket);

      if (endIndex > startIndex) {
        content = content.substring(startIndex, endIndex + 1);
      }
    }
  }

  content = content.replace(/[\u200B-\u200D\uFEFF]/g, "");

  return content;
}

export interface ParseOutlineResult {
  success: boolean;
  data?: StructuredOutline;
  error?: string;
  isStructured: boolean;
  rawContent: string;
}

export interface OutlineStats {
  phaseCount: number;
  totalEvents: number;
  estimatedTotalWords: number;
  chapterCountEstimate: number;
  plotThreadCount: number;
  characterArcCount: number;
  cliffhangerCount: number;
}

export class OutlineService extends BaseService {
  constructor() {
    super('OutlineService');
  }

  parseOutlineContent(content: string): ParseOutlineResult {
    try {
      const cleaned = cleanJson(content);
      const parsed = JSON.parse(cleaned) as StructuredOutline;
      
      if (this._validateStructuredOutline(parsed)) {
        return {
          success: true,
          data: parsed,
          isStructured: true,
          rawContent: content,
        };
      } else {
        return {
          success: false,
          error: "大纲结构不完整，缺少必要字段",
          isStructured: false,
          rawContent: content,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        isStructured: false,
        rawContent: content,
      };
    }
  }

  private _validateStructuredOutline(data: any): data is StructuredOutline {
    if (!data || typeof data !== 'object') return false;
    if (!data.phases || !Array.isArray(data.phases)) return false;
    
    for (const phase of data.phases) {
      if (!phase.events || !Array.isArray(phase.events)) return false;
    }
    
    return true;
  }

  getOutlineStats(outline: StructuredOutline): OutlineStats {
    return {
      phaseCount: outline.phases?.length || 0,
      totalEvents: outline.phases?.reduce(
        (acc: number, p: OutlinePhase) => acc + (p.events?.length || 0), 0
      ) || 0,
      estimatedTotalWords: outline.estimatedTotalWords || 0,
      chapterCountEstimate: outline.chapterCountEstimate || 0,
      plotThreadCount: outline.plotThreads?.length || 0,
      characterArcCount: outline.characterArcs?.length || 0,
      cliffhangerCount: outline.cliffhangerPoints?.length || 0,
    };
  }

  getPhaseByChapter(
    outline: StructuredOutline,
    chapterNumber: number
  ): OutlinePhase | undefined {
    if (!outline.phaseToChapterMapping) return undefined;
    
    const mapping = outline.phaseToChapterMapping.find(
      m => chapterNumber >= m.startChapter && chapterNumber <= m.endChapter
    );
    
    if (!mapping) return undefined;
    
    return outline.phases?.find(p => p.id === mapping.phaseId);
  }

  getEventsForChapterRange(
    outline: StructuredOutline,
    startChapter: number,
    endChapter: number
  ): OutlineEvent[] {
    const phase = this.getPhaseByChapter(outline, startChapter);
    if (!phase || !phase.events) return [];
    
    const allEvents: OutlineEvent[] = [];
    
    let currentChapter = startChapter;
    for (const event of phase.events) {
      allEvents.push(event);
      const eventChapters = Math.ceil((event.wordEstimate || 3000) / 3000);
      currentChapter += eventChapters;
      
      if (currentChapter > endChapter) break;
    }
    
    return allEvents;
  }

  findEventById(
    outline: StructuredOutline,
    eventId: string
  ): { event: OutlineEvent; phase: OutlinePhase } | undefined {
    if (!outline.phases) return undefined;
    
    for (const phase of outline.phases) {
      if (!phase.events) continue;
      const event = phase.events.find(e => e.id === eventId);
      if (event) {
        return { event, phase };
      }
    }
    
    return undefined;
  }

  getPlotThreadEvents(
    outline: StructuredOutline,
    threadId: string
  ): OutlineEvent[] {
    const thread = outline.plotThreads?.find(t => t.id === threadId);
    if (!thread || !thread.eventIds) return [];
    
    const events: OutlineEvent[] = [];
    for (const eventId of thread.eventIds) {
      const found = this.findEventById(outline, eventId);
      if (found) {
        events.push(found.event);
      }
    }
    
    return events;
  }

  generateHumanReadableSummary(outline: StructuredOutline): string {
    let summary = `# 《${outline.novelTitle}》大纲概览\n\n`;
    
    summary += `## 核心信息\n`;
    summary += `- **一句话梗概**：${outline.corePremise || '未设定'}\n`;
    summary += `- **核心主题**：${outline.centralTheme || '未设定'}\n`;
    summary += `- **叙事弧线**：${outline.narrativeArc || '未设定'}\n`;
    summary += `- **预计字数**：${outline.estimatedTotalWords?.toLocaleString() || '未设定'} 字\n`;
    summary += `- **预计章节**：${outline.chapterCountEstimate || '未设定'} 章\n\n`;
    
    if (outline.mainConflict) {
      summary += `## 核心冲突\n`;
      summary += `- **类型**：${outline.mainConflict.type || '未设定'}\n`;
      summary += `- **描述**：${outline.mainConflict.description || '未设定'}\n`;
      if (outline.mainConflict.escalatingSteps?.length) {
        summary += `- **升级步骤**：\n`;
        outline.mainConflict.escalatingSteps.forEach((step, i) => {
          summary += `  ${i + 1}. ${step}\n`;
        });
      }
      summary += `\n`;
    }
    
    summary += `## 阶段划分 (共 ${outline.phases?.length || 0} 个阶段)\n\n`;
    
    outline.phases?.forEach((phase, index) => {
      const phaseTypeLabels: Record<string, string> = {
        'exposition': '开篇',
        'rising_action': '上升',
        'climax': '高潮',
        'falling_action': '回落',
        'resolution': '结局',
      };
      
      summary += `### 阶段 ${index + 1}：${phase.phaseName} (${phaseTypeLabels[phase.phaseType] || phase.phaseType})\n`;
      summary += `- **字数范围**：${phase.startWordEstimate?.toLocaleString() || 0} - ${phase.endWordEstimate?.toLocaleString() || 0} 字\n`;
      summary += `- **核心目标**：${phase.coreGoal || '未设定'}\n`;
      summary += `- **主要冲突**：${phase.mainConflict || '未设定'}\n`;
      summary += `- **赌注**：${phase.stakes || '未设定'}\n`;
      summary += `- **事件数量**：${phase.events?.length || 0} 个\n`;
      
      if (phase.events?.length) {
        summary += `\n#### 事件列表：\n`;
        phase.events.forEach((event, eIndex) => {
          summary += `\n**事件 ${eIndex + 1}：${event.title}**\n`;
          summary += `- ID: ${event.id}\n`;
          summary += `- 涉及角色：${event.characters?.join(', ') || '未设定'}\n`;
          summary += `- 冲突类型：${event.conflictType || '未设定'}\n`;
          summary += `- 转折点：${event.turningPoint || '未设定'}\n`;
          summary += `- 情感变化：${event.emotionalShift || '未设定'}\n`;
          summary += `- 结果：${event.outcome || '未设定'}\n`;
          summary += `- 预计字数：${event.wordEstimate || 3000} 字\n`;
          
          if (event.nextEventHints?.length) {
            summary += `- 伏笔：${event.nextEventHints.join('；')}\n`;
          }
          if (event.suspenseHook) {
            summary += `- 悬念钩子：${event.suspenseHook}\n`;
          }
          if (event.worldBuildingDetails) {
            summary += `- 世界观细节：${event.worldBuildingDetails}\n`;
          }
        });
      }
      
      if (phase.characterDevelopments?.length) {
        summary += `\n#### 角色发展：\n`;
        phase.characterDevelopments.forEach(dev => {
          summary += `- ${dev}\n`;
        });
      }
      
      if (phase.worldBuildingAdvancements?.length) {
        summary += `\n#### 世界观推进：\n`;
        phase.worldBuildingAdvancements.forEach(wb => {
          summary += `- ${wb}\n`;
        });
      }
      
      if (phase.interPhaseHook) {
        summary += `\n#### 阶段间钩子：\n`;
        summary += `${phase.interPhaseHook}\n`;
      }
      
      summary += `\n---\n\n`;
    });
    
    if (outline.plotThreads?.length) {
      summary += `## 情节线 (共 ${outline.plotThreads.length} 条)\n\n`;
      outline.plotThreads.forEach(thread => {
        const typeLabels: Record<string, string> = {
          'main': '主线',
          'sub': '支线',
          'character': '角色线',
          'world': '世界观线',
          'thematic': '主题线',
        };
        summary += `### ${typeLabels[thread.threadType] || thread.threadType}：${thread.threadName}\n`;
        summary += `- **描述**：${thread.description || '未设定'}\n`;
        summary += `- **涉及阶段**：${thread.phaseIds?.join(', ') || '未设定'}\n`;
        summary += `- **涉及事件数**：${thread.eventIds?.length || 0}\n`;
        summary += `- **收束方式**：${thread.resolution || '未设定'}\n`;
        summary += `- **主题意义**：${thread.thematicSignificance || '未设定'}\n\n`;
      });
    }
    
    if (outline.cliffhangerPoints?.length) {
      summary += `## 关键悬念点 (共 ${outline.cliffhangerPoints.length} 个)\n\n`;
      outline.cliffhangerPoints.forEach((point, index) => {
        summary += `### 悬念 ${index + 1}\n`;
        summary += `- **位置**：阶段 ${point.phaseId}，事件 ${point.eventId}\n`;
        summary += `- **描述**：${point.description || '未设定'}\n`;
        summary += `- **目的**：${point.purpose || '未设定'}\n\n`;
      });
    }
    
    return summary;
  }

  /**
   * Get all versions for a novel
   */
  async getVersions(novelId: string) {
    try {
      console.log('Fetching versions for novel:', novelId);
      
      if (!db.query.outlineVersions) {
        console.error('db.query.outlineVersions is undefined. Available keys:', Object.keys(db.query));
        throw new Error('Database schema for outlineVersions not loaded');
      }

      const result = await db.query.outlineVersions.findMany({
        where: eq(schema.outlineVersions.novelId, novelId),
        orderBy: [desc(schema.outlineVersions.version)],
      });
      console.log('Found versions:', result.length);
      return result;
    } catch (error) {
      console.error('Error in getVersions:', error);
      throw error;
    }
  }

  /**
   * Get specific version
   */
  async getVersion(id: string) {
    return await db.query.outlineVersions.findFirst({
      where: eq(schema.outlineVersions.id, id),
    });
  }

  /**
   * Get latest version number
   */
  async getLatestVersionNumber(novelId: string): Promise<number> {
    const latest = await db.query.outlineVersions.findFirst({
      where: eq(schema.outlineVersions.novelId, novelId),
      orderBy: [desc(schema.outlineVersions.version)],
    });
    return latest?.version || 0;
  }

  /**
   * Create new version
   */
  async createVersion(
    novelId: string, 
    content: string, 
    context: any, 
    mode: string = 'initial'
  ) {
    const latestVersion = await this.getLatestVersionNumber(novelId);
    const newVersion = latestVersion + 1;

    const [outline] = await db
      .insert(schema.outlineVersions)
      .values({
        novelId,
        content,
        version: newVersion,
        generationMode: mode,
        generationContext: context,
      })
      .returning();

    // Update novel current version
    await db
      .update(schema.novels)
      .set({ currentOutlineVersion: newVersion })
      .where(eq(schema.novels.id, novelId));

    return outline;
  }

  /**
   * Lock a version
   */
  async toggleLock(id: string, isLocked: boolean) {
    return await db
      .update(schema.outlineVersions)
      .set({ isLocked: isLocked ? 1 : 0 })
      .where(eq(schema.outlineVersions.id, id))
      .returning();
  }

  async rollback(novelId: string, targetVersionId: string) {
    const targetVersion = await this.getVersion(targetVersionId);
    if (!targetVersion) throw new Error('Target version not found');

    return await this.createVersion(
      novelId,
      targetVersion.content,
      { 
        ...targetVersion.generationContext as object, 
        rollbackFrom: targetVersion.version 
      },
      'rollback'
    );
  }

  /**
   * Stream outline generation
   */
  async generateStream(
    novelId: string, 
    userId: string,
    mode: string,
    existingOutline: string | undefined,
    onChunk: (chunk: string) => void
  ) {
    // 1. Get novel data with characters and knowledge bases
    const novel = await db.query.novels.findFirst({
      where: eq(schema.novels.id, novelId),
      with: {
        characters: true,
        knowledgeBases: {
          with: {
            documents: true
          }
        }
      }
    });
    
    if (!novel) throw new Error('Novel not found');

    // 3. Initialize Provider and Agent using shared utility
    const { OutlineAgent } = await import('./ai/agents');
    const provider = await createAIProvider(userId);
    const agent = new OutlineAgent(provider);

    // 4. Execute Stream
    await agent.executeStream(
      { 
        novel,
        characters: (novel as any).characters,
        knowledgeBase: (novel as any).knowledgeBases?.flatMap((kb: any) => 
          kb.documents?.map((doc: any) => `${doc.title}:\n${doc.content}`) || []
        )
      },
      { mode, existingOutline },
      onChunk
    );
  }
}

export const outlineService = new OutlineService();
