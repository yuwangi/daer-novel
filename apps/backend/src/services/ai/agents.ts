import { BaseAIProvider, AIMessage, AIResponse } from './providers';
import { Novel, Character } from '../../database/schema';

export interface AgentContext {
  novel: Novel;
  characters?: Character[];
  knowledgeBase?: string[];
  previousContent?: string;
}

export abstract class BaseAgent {
  protected provider: BaseAIProvider;
  protected agentName: string;

  constructor(provider: BaseAIProvider, agentName: string) {
    this.provider = provider;
    this.agentName = agentName;
  }

  protected abstract buildSystemPrompt(context: AgentContext): string;
  protected abstract buildUserPrompt(context: AgentContext, input?: any): string;

  async execute(context: AgentContext, input?: any): Promise<AIResponse> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(context),
      },
      {
        role: 'user',
        content: this.buildUserPrompt(context, input),
      },
    ];

    return await this.provider.chat(messages);
  }

  async executeStream(
    context: AgentContext,
    input: any,
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(context),
      },
      {
        role: 'user',
        content: this.buildUserPrompt(context, input),
      },
    ];

    return await this.provider.streamChat(messages, onChunk);
  }
}

// Outline Agent - 生成全文大纲
export class OutlineAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, 'OutlineAgent');
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是一位资深网络小说大纲策划师。你的任务是根据小说设定生成完整的故事大纲。

小说标题：${context.novel.title}
小说类型：${context.novel.genre?.join('、')}
风格标签：${context.novel.style?.join('、')}
目标字数：${context.novel.targetWords}字
背景设定：${context.novel.background}

${context.novel.worldSettings ? `
世界观设定：
- 时间背景：${context.novel.worldSettings.timeBackground}
- 世界规则：${context.novel.worldSettings.worldRules?.join('；')}
- 力量体系：${context.novel.worldSettings.powerSystem}
- 禁忌规则：${context.novel.worldSettings.forbiddenRules?.join('；')}
` : ''}

${context.characters && context.characters.length > 0 ? `
人物信息：
${context.characters.map(c => `- ${c.name}（${c.role}）：${c.personality?.join('、')}`).join('\n')}
` : ''}

${context.knowledgeBase && context.knowledgeBase.length > 0 ? `
额外知识库：
${context.knowledgeBase.join('\n\n')}
` : ''}

请生成一个结构完整、逻辑清晰的故事大纲，包括：
1. 故事主线
2. 主要冲突
3. 关键转折点
4. 高潮设计
5. 结局方向

大纲应该支撑${context.novel.targetWords}字的长篇连载。`;
  }

  protected buildUserPrompt(context: AgentContext, input: any): string {
    const { mode, existingOutline } = typeof input === 'string' ? { mode: input, existingOutline: '' } : input;
    
    switch(mode) {
      case 'expand':
        return `基于以下现有大纲进行扩写，增加更多细节和情节点：\n\n${existingOutline}`;
      case 'adjust_pace_fast':
        return `调整以下大纲节奏，使其更加紧凑、爽快（删除拖沓情节，加快冲突爆发）：\n\n${existingOutline}`;
      case 'adjust_pace_slow':
        return `调整以下大纲节奏，使其更加舒缓、细腻（增加铺垫和情感描写）：\n\n${existingOutline}`;
      case 'strengthen_conflict':
        return `强化以下大纲的主线冲突，增加戏剧张力和主角面临的困境：\n\n${existingOutline}`;
      case 'preserve_characters':
        return `保留人物设定，重新生成大纲（保持角色性格和关系不变）：\n\n${existingOutline}`;
      case 'initial':
      default:
        return `请为《${context.novel.title}》生成完整的小说大纲。`;
    }
  }
}

// Title Agent - 生成书名
export class TitleAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, 'TitleAgent');
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是一位网络小说命名专家。根据小说大纲和设定，生成吸引人的书名。

小说类型：${context.novel.genre?.join('、')}
风格：${context.novel.style?.join('、')}

要求：
1. 书名要吸引目标读者
2. 体现小说核心卖点
3. 符合网文命名习惯
4. 朗朗上口，易于传播`;
  }

  protected buildUserPrompt(context: AgentContext, outline: string): string {
    return `基于《${context.novel.title}》的以下大纲，生成5个候选书名：

${outline}

请直接输出5个书名，每行一个。`;
  }
}


// Chapter Planning Agent - 章节编排
export class ChapterPlanningAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, 'ChapterPlanningAgent');
  }

  protected buildSystemPrompt(context: AgentContext): string {
    // Calculate estimated chapters
    const targetChapters = Math.ceil((context.novel.targetWords || 100000) / (context.novel.minChapterWords || 3000));
    
    return `你是小说章节结构规划师。根据大纲将小说分卷分章。

目标字数：${context.novel.targetWords}字
每章最少字数：${context.novel.minChapterWords}字
预计章节数：约${targetChapters}章（请尽量接近这个数量）

要求：
1. 合理分卷（可选）
2. 每章有明确主题
3. 章节标题吸引人
4. 节奏把控合理
5. 严格控制章节数量，确保总字数达标`;
  }

  protected buildUserPrompt(context: AgentContext, input: any): string {
    const { outline, additionalRequirements } = typeof input === 'string' ? { outline: input, additionalRequirements: '' } : input;
    
    return `基于《${context.novel.title}》的以下大纲，生成章节结构：

${outline}

${additionalRequirements ? `额外要求：\n${additionalRequirements}\n` : ''}

输出格式（JSON，严禁包含 markdown 代码块，严禁包含其他说明文字，直接返回有效的 JSON 字符串）：
{
  "volumes": [
    {
      "title": "卷名",
      "chapters": [
        {"title": "章节标题", "summary": "章节概要"}
      ]
    }
  ]
}`;
  }
  }


// Chapter Outline Agent - 章节大纲
export class ChapterOutlineAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, 'ChapterOutlineAgent');
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const characterInfo = context.characters?.map(c => 
      `- ${c.name}（${c.role}）：${c.personality?.join('、')}`
    ).join('\n');

    return `你是章节大纲撰写专家。为单个章节生成详细的剧情大纲。
 
 小说背景：${context.novel.background}
 人物信息：
 ${characterInfo}
 
 ${context.knowledgeBase && context.knowledgeBase.length > 0 ? `
 额外知识库：
 ${context.knowledgeBase.join('\n\n')}
 ` : ''}
 
 要求：
 1. 情节紧凑，有冲突
2. 符合人物性格
3. 遵守世界观规则
4. 为下一章留悬念`;
  }

  protected buildUserPrompt(context: AgentContext, chapterInfo: any): string {
    return `生成《${context.novel.title}》第${chapterInfo.order}章《${chapterInfo.title}》的详细大纲。

章节概要：${chapterInfo.summary}
${context.previousContent ? `\n前文回顾：\n${context.previousContent.slice(-500)}` : ''}

请输出详细的章节大纲（300-500字）。`;
  }
}

// Chapter Detail Agent - 章节细纲
export class ChapterDetailAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, 'ChapterDetailAgent');
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是章节细纲设计师。将章节大纲拆分为具体的场景和情节点。
 
 ${context.knowledgeBase && context.knowledgeBase.length > 0 ? `
 额外知识库：
 ${context.knowledgeBase.join('\n\n')}
 ` : ''}
 
 要求：
 1. 每个场景有明确的目标
2. 标注关键对话和动作
3. 情绪节奏起伏
4. 字数分配合理（目标${context.novel.minChapterWords}字）`;
  }

  protected buildUserPrompt(context: AgentContext, chapterOutline: string): string {
    return `基于《${context.novel.title}》的以下章节大纲，生成详细的场景细纲：

${chapterOutline}

输出格式：
场景1：[地点] [人物] [事件]
场景2：...
（至少3-5个场景）`;
  }
}

// Content Agent - 正文生成
export class ContentAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, 'ContentAgent');
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const characterInfo = context.characters?.map(c => 
      `- ${c.name}：${c.personality?.join('、')}，当前状态：${c.currentState}`
    ).join('\n');

    return `你是网络小说作家。根据细纲生成精彩的章节正文。
 
 小说风格：${context.novel.style?.join('、')}
 人物信息：
 ${characterInfo}
 
 ${context.knowledgeBase && context.knowledgeBase.length > 0 ? `
 额外知识库：
 ${context.knowledgeBase.join('\n\n')}
 ` : ''}
 
 写作要求：
 1. 文笔流畅，代入感强
2. 对话生动，符合人物性格
3. 场景描写细腻
4. 节奏紧凑，不拖沓
5. 字数：${context.novel.minChapterWords}字以上

禁止：
- 违反世界观规则
- 人物OOC（性格崩坏）
- 逻辑矛盾`;
  }

  protected buildUserPrompt(context: AgentContext, input: string | { outline: string, instructions?: string }): string {
    const { outline, instructions } = typeof input === 'string' 
      ? { outline: input, instructions: '' } 
      : input;

    return `根据《${context.novel.title}》的以下章节细纲，生成章节正文：

${outline}

${instructions ? `额外写作要求（必须严格遵守）：\n${instructions}\n` : ''}

${context.previousContent ? `\n前文衔接：\n${context.previousContent.slice(-800)}` : ''}

请开始创作，直接输出正文内容。`;
  }
  }


// Consistency Agent - 一致性校验
export class ConsistencyAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, 'ConsistencyAgent');
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是小说一致性审核专家。检查内容是否违反设定。

世界观规则：
${context.novel.worldSettings?.worldRules?.join('\n')}

禁忌规则：
${context.novel.worldSettings?.forbiddenRules?.join('\n')}

人物设定：
${context.characters?.map(c => `${c.name}：${JSON.stringify(c.abilities)}`).join('\n')}

${context.knowledgeBase && context.knowledgeBase.length > 0 ? `
知识库参考：
${context.knowledgeBase.join('\n\n')}
` : ''}
 
 检查项：
 1. 是否违反世界观规则
2. 人物能力是否超限
3. 时间线是否错误
4. 人物性格是否一致`;
  }

  protected buildUserPrompt(_context: AgentContext, content: string): string {
    return `请审核以下内容：

${content}

输出格式（JSON，严禁包含 markdown 代码块，严禁包含其他说明文字，直接返回有效的 JSON 字符串）：
{
  "passed": true/false,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1"]
}`;
  }
}

// Assist Agent - 写作助手
export class AssistAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, 'AssistAgent');
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是一位专业的网文写作助手。你的任务是辅助作者进行创作，回答他们的问题，或者根据上下文提供写作建议。

小说标题：${context.novel.title}
小说类型：${context.novel.genre?.join('、')}
风格标签：${context.novel.style?.join('、')}
背景设定：${context.novel.background}

${context.novel.worldSettings ? `
世界观设定：
- 时间背景：${context.novel.worldSettings.timeBackground}
- 世界规则：${context.novel.worldSettings.worldRules?.join('；')}
- 力量体系：${context.novel.worldSettings.powerSystem}
- 禁忌规则：${context.novel.worldSettings.forbiddenRules?.join('；')}
` : ''}

${context.characters && context.characters.length > 0 ? `
人物信息：
${context.characters.map(c => `- ${c.name}（${c.role}）：${c.personality?.join('、')}`).join('\n')}
` : ''}

请根据以上设定和作者提供的小说正文片段（如果有），回答作者的问题。
回答要求：
1. 具有启发性，能激发作者灵感
2. 贴合小说设定和风格
3. 简洁明了，直接切入重点
4. 如果作者要求生成片段，请确保风格统一`;
  }

  protected buildUserPrompt(_context: AgentContext, input: any): string {
    const { message, previousContent } = input;
    
    return `当前正文片段（上文）：
${previousContent ? previousContent.slice(-2000) : '（无）'}

作者的问题/指令：
${message}`;
  }
}
