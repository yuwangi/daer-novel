import { db, schema } from "../database";
import { eq, desc } from "drizzle-orm";
import { BaseService } from "./base.service";
import { createAIProvider } from "./ai/ai-config";
import type { StructuredOutline, OutlinePhase, OutlineEvent } from "../types";

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
    super("OutlineService");
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
    if (!data || typeof data !== "object") return false;
    if (!data.phases || !Array.isArray(data.phases)) return false;

    for (const phase of data.phases) {
      if (!phase.events || !Array.isArray(phase.events)) return false;
    }

    return true;
  }

  getOutlineStats(outline: StructuredOutline): OutlineStats {
    return {
      phaseCount: outline.phases?.length || 0,
      totalEvents:
        outline.phases?.reduce(
          (acc: number, p: OutlinePhase) => acc + (p.events?.length || 0),
          0,
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
    chapterNumber: number,
  ): OutlinePhase | undefined {
    if (!outline.phaseToChapterMapping) return undefined;

    const mapping = outline.phaseToChapterMapping.find(
      (m) => chapterNumber >= m.startChapter && chapterNumber <= m.endChapter,
    );

    if (!mapping) return undefined;

    return outline.phases?.find((p) => p.id === mapping.phaseId);
  }

  getEventsForChapterRange(
    outline: StructuredOutline,
    startChapter: number,
    endChapter: number,
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
    eventId: string,
  ): { event: OutlineEvent; phase: OutlinePhase } | undefined {
    if (!outline.phases) return undefined;

    for (const phase of outline.phases) {
      if (!phase.events) continue;
      const event = phase.events.find((e) => e.id === eventId);
      if (event) {
        return { event, phase };
      }
    }

    return undefined;
  }

  getPlotThreadEvents(
    outline: StructuredOutline,
    threadId: string,
  ): OutlineEvent[] {
    const thread = outline.plotThreads?.find((t) => t.id === threadId);
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
    const conflictTypeLabels: Record<string, string> = {
      internal: "内心冲突（抉择、信念动摇、恐惧等）",
      external: "外部冲突（战斗、追逐、谈判等）",
      relationship: "关系冲突（信任破裂、合作瓦解、爱恨纠葛等）",
      mystery: "悬疑冲突（解谜、调查、真相揭露等）",
    };

    const translateConflictType = (type: string | undefined): string => {
      if (!type) return "未设定";

      if (type.includes("|")) {
        const types = type.split("|").map((t) => t.trim());
        const translated = types.map((t) => conflictTypeLabels[t] || t);
        return translated.join("、");
      }

      return conflictTypeLabels[type] || type;
    };

    const phaseTypeLabels: Record<string, string> = {
      exposition: "开篇",
      rising_action: "上升",
      climax: "高潮",
      falling_action: "回落",
      resolution: "结局",
    };

    const threadTypeLabels: Record<string, string> = {
      main: "主线",
      sub: "支线",
      character: "角色线",
      world: "世界观线",
      thematic: "主题线",
    };

    const phaseIdToName = new Map<string, string>();
    const eventIdToTitle = new Map<string, string>();
    const eventIdToPhaseName = new Map<string, string>();
    const eventIndexToTitle = new Map<string, string>();

    outline.phases?.forEach((phase, pIndex) => {
      const phaseDisplayName = `阶段 ${pIndex + 1}：${phase.phaseName}`;
      phaseIdToName.set(phase.id, phaseDisplayName);

      phase.events?.forEach((event, eIndex) => {
        const eventDisplayName = `事件 ${eIndex + 1}「${event.title}」`;
        eventIdToTitle.set(event.id, eventDisplayName);
        eventIdToPhaseName.set(event.id, phaseDisplayName);

        const eventIndexKey = `事件${pIndex + 1}_${eIndex + 1}`;
        eventIndexToTitle.set(eventIndexKey, eventDisplayName);
        eventIndexToTitle.set(eventIndexKey.toLowerCase(), eventDisplayName);
      });
    });

    const getPhaseName = (phaseId: string): string => {
      if (phaseIdToName.has(phaseId)) {
        return phaseIdToName.get(phaseId)!;
      }

      const phaseMatch = phaseId.match(/phase_?(\d+)/i);
      if (phaseMatch) {
        const phaseNum = parseInt(phaseMatch[1]);
        for (const [, name] of phaseIdToName.entries()) {
          if (name.includes(`阶段 ${phaseNum}：`)) {
            return name;
          }
        }
      }

      return phaseId;
    };

    const getPhaseNames = (phaseIds: string[]): string => {
      return phaseIds.map((id) => getPhaseName(id)).join("、");
    };

    const getEventName = (eventId: string): string => {
      if (eventIdToTitle.has(eventId)) {
        return eventIdToTitle.get(eventId)!;
      }

      if (eventIndexToTitle.has(eventId)) {
        return eventIndexToTitle.get(eventId)!;
      }

      const eventMatch = eventId.match(/event_?(\d+)_?(\d+)/i);
      if (eventMatch) {
        const phaseNum = parseInt(eventMatch[1]);
        const eventNum = parseInt(eventMatch[2]);
        const eventIndexKey = `事件${phaseNum}_${eventNum}`;
        if (eventIndexToTitle.has(eventIndexKey)) {
          return eventIndexToTitle.get(eventIndexKey)!;
        }
      }

      const chineseEventMatch = eventId.match(
        /事件[零一二三四五六七八九十\d]+[_/][零一二三四五六七八九十\d]+/,
      );
      if (chineseEventMatch) {
        const key = eventId;
        if (eventIndexToTitle.has(key)) {
          return eventIndexToTitle.get(key)!;
        }
      }

      return eventId;
    };

    let summary = `# 《${outline.novelTitle}》大纲概览\n\n`;

    summary += `## 一、核心信息\n`;
    summary += `- **一句话梗概**：${outline.corePremise || "未设定"}\n`;
    summary += `- **核心主题**：${outline.centralTheme || "未设定"}\n`;
    summary += `- **叙事弧线**：${outline.narrativeArc || "未设定"}\n`;
    summary += `- **预计总字数**：${outline.estimatedTotalWords?.toLocaleString() || "未设定"} 字\n`;
    summary += `- **预计章节数**：${outline.chapterCountEstimate || "未设定"} 章\n\n`;

    if (outline.mainConflict) {
      summary += `## 二、核心冲突\n`;
      summary += `- **冲突类型**：${outline.mainConflict.type || "未设定"}\n`;
      summary += `- **冲突描述**：${outline.mainConflict.description || "未设定"}\n`;
      if (outline.mainConflict.escalatingSteps?.length) {
        summary += `- **冲突升级路径**：\n`;
        outline.mainConflict.escalatingSteps.forEach((step, i) => {
          summary += `  ${i + 1}. ${step}\n`;
        });
      }
      summary += `\n`;
    }

    summary += `## 三、阶段划分 (共 ${outline.phases?.length || 0} 个阶段)\n\n`;

    outline.phases?.forEach((phase, pIndex) => {
      const phaseIndex = pIndex + 1;
      summary += `### 阶段 ${phaseIndex}：${phase.phaseName}（${phaseTypeLabels[phase.phaseType] || phase.phaseType}）\n`;
      summary += `- **字数范围**：${phase.startWordEstimate?.toLocaleString() || 0} - ${phase.endWordEstimate?.toLocaleString() || 0} 字\n`;
      summary += `- **核心目标**：${phase.coreGoal || "未设定"}\n`;
      summary += `- **主要冲突**：${phase.mainConflict || "未设定"}\n`;
      summary += `- **失败赌注**：${phase.stakes || "未设定"}\n`;
      summary += `- **事件数量**：${phase.events?.length || 0} 个\n`;

      if (phase.events?.length) {
        summary += `\n#### 事件详情：\n`;
        phase.events.forEach((event, eIndex) => {
          const eventIndex = eIndex + 1;
          summary += `\n##### 事件 ${eventIndex}：${event.title}\n`;
          summary += `- **涉及角色**：${event.characters?.join("、") || "未设定"}\n`;
          summary += `- **冲突类型**：${translateConflictType(event.conflictType)}\n`;
          summary += `- **关键转折点**：${event.turningPoint || "未设定"}\n`;
          summary += `- **情感变化**：${event.emotionalShift || "未设定"}\n`;
          summary += `- **事件结果**：${event.outcome || "未设定"}\n`;
          summary += `- **预计字数**：${event.wordEstimate || 3000} 字\n`;

          if (event.nextEventHints?.length) {
            summary += `- **埋下伏笔**：${event.nextEventHints.join("；")}\n`;
          }
          if (event.suspenseHook) {
            summary += `- **悬念钩子**：${event.suspenseHook}\n`;
          }
          if (event.worldBuildingDetails) {
            summary += `- **世界观展示**：${event.worldBuildingDetails}\n`;
          }
        });
      }

      if (phase.characterDevelopments?.length) {
        summary += `\n#### 本阶段角色发展：\n`;
        phase.characterDevelopments.forEach((dev) => {
          summary += `- ${dev}\n`;
        });
      }

      if (phase.worldBuildingAdvancements?.length) {
        summary += `\n#### 本阶段世界观推进：\n`;
        phase.worldBuildingAdvancements.forEach((wb) => {
          summary += `- ${wb}\n`;
        });
      }

      if (phase.thematicElements?.length) {
        summary += `\n#### 本阶段主题呼应：\n`;
        phase.thematicElements.forEach((theme) => {
          summary += `- ${theme}\n`;
        });
      }

      if (phase.interPhaseHook) {
        summary += `\n#### 进入下一阶段的钩子：\n`;
        summary += `${phase.interPhaseHook}\n`;
      }

      if (pIndex < (outline.phases?.length || 0) - 1) {
        summary += `\n---\n\n`;
      }
    });

    if (outline.plotThreads?.length) {
      summary += `\n\n## 四、情节线追踪 (共 ${outline.plotThreads.length} 条)\n\n`;
      outline.plotThreads.forEach((thread) => {
        const threadType =
          threadTypeLabels[thread.threadType] || thread.threadType;
        summary += `### ${threadType}：${thread.threadName}\n`;
        summary += `- **情节线描述**：${thread.description || "未设定"}\n`;

        if (thread.phaseIds?.length) {
          summary += `- **涉及阶段**：${getPhaseNames(thread.phaseIds)}\n`;
        }

        summary += `- **关联事件数**：${thread.eventIds?.length || 0} 个\n`;

        if (thread.eventIds?.length) {
          const eventNames = thread.eventIds.map((id) => getEventName(id));
          if (eventNames.length <= 5) {
            summary += `- **关联事件**：${eventNames.join("、")}\n`;
          } else {
            summary += `- **关联事件**：${eventNames.slice(0, 3).join("、")} 等共 ${eventNames.length} 个\n`;
          }
        }

        summary += `- **收束方式**：${thread.resolution || "未设定"}\n`;
        summary += `- **主题意义**：${thread.thematicSignificance || "未设定"}\n\n`;
      });
    }

    if (outline.characterArcs?.length) {
      summary += `## 五、角色弧线\n\n`;
      outline.characterArcs.forEach((arc) => {
        summary += `### ${arc.characterName} 的弧线\n`;
        summary += `- **弧线类型**：${arc.arcType || "未设定"}\n`;

        if (arc.keyEvents?.length) {
          summary += `- **关键发展事件**：\n`;
          arc.keyEvents.forEach((event, i) => {
            let eventText = event;
            const eventIdMatch = event.match(
              /^事件[_/]?(\d+)[_/](\d+)[:：\s]+(.+)$/i,
            );
            if (eventIdMatch) {
              const phaseNum = parseInt(eventIdMatch[1]);
              const eventNum = parseInt(eventIdMatch[2]);
              const eventDesc = eventIdMatch[3];

              const eventIndexKey = `事件${phaseNum}_${eventNum}`;
              if (eventIndexToTitle.has(eventIndexKey)) {
                eventText = eventIndexToTitle.get(eventIndexKey)!;
                if (eventDesc && !eventText.includes(eventDesc)) {
                  eventText = `${eventText}：${eventDesc}`;
                }
              } else {
                eventText = `事件 ${eventNum}「${eventDesc}」`;
              }
            }
            summary += `  ${i + 1}. ${eventText}\n`;
          });
        }

        summary += `- **弧线结局**：${arc.resolution || "未设定"}\n\n`;
      });
    }

    if (outline.worldBuildingReveals?.length) {
      summary += `## 六、世界观揭示点\n\n`;
      outline.worldBuildingReveals.forEach((reveal, index) => {
        summary += `### 揭示 ${index + 1}\n`;
        summary += `- **揭示内容**：${reveal.reveal || "未设定"}\n`;
        summary += `- **出现位置**：${getPhaseName(reveal.phaseId)}\n`;

        if (reveal.eventId) {
          summary += `- **关联事件**：${getEventName(reveal.eventId)}\n`;
        }

        summary += `- **剧情意义**：${reveal.significance || "未设定"}\n\n`;
      });
    }

    if (outline.cliffhangerPoints?.length) {
      summary += `## 七、关键悬念/钩子点 (共 ${outline.cliffhangerPoints.length} 个)\n\n`;
      outline.cliffhangerPoints.forEach((point, index) => {
        summary += `### 悬念 ${index + 1}\n`;
        summary += `- **悬念描述**：${point.description || "未设定"}\n`;
        summary += `- **出现位置**：${getPhaseName(point.phaseId)}\n`;

        if (point.eventId) {
          summary += `- **关联事件**：${getEventName(point.eventId)}\n`;
        }

        summary += `- **悬念目的**：${point.purpose || "未设定"}\n\n`;
      });
    }

    if (outline.pacingGuidelines) {
      summary += `## 八、节奏指南\n\n`;
      summary += `- **整体节奏建议**：${outline.pacingGuidelines.overall || "未设定"}\n\n`;

      if (outline.pacingGuidelines.phaseSpecific?.length) {
        summary += `### 各阶段节奏调整：\n`;
        outline.pacingGuidelines.phaseSpecific.forEach((phasePacing) => {
          const pacingLabels: Record<string, string> = {
            slow: "舒缓",
            medium: "适中",
            fast: "紧凑",
          };
          summary += `- **${getPhaseName(phasePacing.phaseId)}**：节奏 ${pacingLabels[phasePacing.pacing] || phasePacing.pacing} — ${phasePacing.recommendation}\n`;
        });
      }
      summary += `\n`;
    }

    return summary;
  }

  /**
   * Get all versions for a novel
   */
  async getVersions(novelId: string) {
    try {
      console.log("Fetching versions for novel:", novelId);

      if (!db.query.outlineVersions) {
        console.error(
          "db.query.outlineVersions is undefined. Available keys:",
          Object.keys(db.query),
        );
        throw new Error("Database schema for outlineVersions not loaded");
      }

      const result = await db.query.outlineVersions.findMany({
        where: eq(schema.outlineVersions.novelId, novelId),
        orderBy: [desc(schema.outlineVersions.version)],
      });
      console.log("Found versions:", result.length);
      return result;
    } catch (error) {
      console.error("Error in getVersions:", error);
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
    mode: string = "initial",
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
    if (!targetVersion) throw new Error("Target version not found");

    return await this.createVersion(
      novelId,
      targetVersion.content,
      {
        ...(targetVersion.generationContext as object),
        rollbackFrom: targetVersion.version,
      },
      "rollback",
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
    onChunk: (chunk: string) => void,
  ) {
    // 1. Get novel data with characters and knowledge bases
    const novel = await db.query.novels.findFirst({
      where: eq(schema.novels.id, novelId),
      with: {
        characters: true,
        knowledgeBases: {
          with: {
            documents: true,
          },
        },
      },
    });

    if (!novel) throw new Error("Novel not found");

    // 3. Initialize Provider and Agent using shared utility
    const { OutlineAgent } = await import("./ai/agents");
    const provider = await createAIProvider(userId);
    const agent = new OutlineAgent(provider);

    // 4. Execute Stream
    await agent.executeStream(
      {
        novel,
        characters: (novel as any).characters,
        knowledgeBase: (novel as any).knowledgeBases?.flatMap(
          (kb: any) =>
            kb.documents?.map((doc: any) => `${doc.title}:\n${doc.content}`) ||
            [],
        ),
      },
      { mode, existingOutline },
      onChunk,
    );
  }
}

export const outlineService = new OutlineService();
