import { BaseAIProvider, AIMessage, AIResponse } from "./providers";
import { Novel, Character } from "../../database/schema";

export interface AgentContext {
  novel: Partial<Novel>;
  characters?: Character[];
  knowledgeBase?: string[];
  previousContent?: string;
  sourceChunks?: string[]; // Multiple chunks from source file for analysis
}

export abstract class BaseAgent {
  protected provider: BaseAIProvider;
  protected agentName: string;

  constructor(provider: BaseAIProvider, agentName: string) {
    this.provider = provider;
    this.agentName = agentName;
  }

  protected abstract buildSystemPrompt(context: AgentContext): string;
  protected abstract buildUserPrompt(
    context: AgentContext,
    input?: any,
  ): string;

  async execute(context: AgentContext, input?: any): Promise<AIResponse> {
    const messages: AIMessage[] = [
      {
        role: "system",
        content: this.buildSystemPrompt(context),
      },
      {
        role: "user",
        content: this.buildUserPrompt(context, input),
      },
    ];

    return await this.provider.chat(messages);
  }

  async executeStream(
    context: AgentContext,
    input: any,
    onChunk: (chunk: string) => void,
  ): Promise<AIResponse> {
    const messages: AIMessage[] = [
      {
        role: "system",
        content: this.buildSystemPrompt(context),
      },
      {
        role: "user",
        content: this.buildUserPrompt(context, input),
      },
    ];

    return await this.provider.streamChat(messages, onChunk);
  }
}

// Outline Agent - 生成全文大纲
export class OutlineAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "OutlineAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是一位资深网络小说大纲策划师。你的任务是根据小说设定生成完整的故事大纲。

小说标题：${context.novel.title}
小说类型：${context.novel.genre?.join("、")}
风格标签：${context.novel.style?.join("、")}
目标字数：${context.novel.targetWords}字
背景设定：${context.novel.background}

${
  context.novel.worldSettings
    ? `
世界观设定：
- 时间背景：${context.novel.worldSettings.timeBackground}
- 世界规则：${context.novel.worldSettings.worldRules?.join("；")}
- 力量体系：${context.novel.worldSettings.powerSystem}
- 禁忌规则：${context.novel.worldSettings.forbiddenRules?.join("；")}
`
    : ""
}

${
  context.characters && context.characters.length > 0
    ? `
人物信息：
${context.characters.map((c) => `- ${c.name}（${c.role}）：${c.personality?.join("、")}`).join("\n")}
`
    : ""
}

${
  context.knowledgeBase && context.knowledgeBase.length > 0
    ? `
额外知识库：
${context.knowledgeBase.join("\n\n")}
`
    : ""
}

请生成一个结构完整、逻辑清晰的故事大纲，包括：
1. 故事主线
2. 主要冲突
3. 关键转折点
4. 高潮设计
5. 结局方向

大纲应该支撑${context.novel.targetWords}字的长篇连载。`;
  }

  protected buildUserPrompt(context: AgentContext, input: any): string {
    const { mode, existingOutline } =
      typeof input === "string"
        ? { mode: input, existingOutline: "" }
        : input || { mode: "initial", existingOutline: "" };

    switch (mode) {
      case "expand":
        return `基于以下现有大纲进行扩写，增加更多细节和情节点：\n\n${existingOutline}`;
      case "adjust_pace_fast":
        return `调整以下大纲节奏，使其更加紧凑、爽快（删除拖沓情节，加快冲突爆发）：\n\n${existingOutline}`;
      case "adjust_pace_slow":
        return `调整以下大纲节奏，使其更加舒缓、细腻（增加铺垫和情感描写）：\n\n${existingOutline}`;
      case "strengthen_conflict":
        return `强化以下大纲的主线冲突，增加戏剧张力和主角面临的困境：\n\n${existingOutline}`;
      case "preserve_characters":
        return `保留人物设定，重新生成大纲（保持角色性格和关系不变）：\n\n${existingOutline}`;
      case "initial":
      default:
        return `请为《${context.novel.title}》生成完整的小说大纲。${existingOutline ? `\n\n参考已有剧情脉络：\n${existingOutline}` : ""}`;
    }
  }
}

// Title Agent - 生成书名
export class TitleAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "TitleAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是一位深谙当前中国网络文学市场爆款逻辑的白金级网文命名专家，精通番茄小说、起点中文网、刺猬猫等平台的点击率标题设计。
你的任务是根据小说设定与大纲，生成具有极强点击欲望、符合当前市场趋势的爆款网文书名。

小说类型：${context.novel.genre?.join("、") || "未设定"}
风格标签：${context.novel.style?.join("、") || "未设定"}

【爆款书名生成指南】：
1. 拒绝套路与模板化：坚决避免大量使用“XXXX：YYYY”这种泛化且廉价的两段式公式。不要生搬硬套，书名应该自然、有灵气。
2. 提炼核心意象与情感：从大纲中提取最抓人的一个画面、一个悬念、或者一种极致的情感作为书名核心（例如：《白夜行》、《开端》、《隐秘的角落》）。
3. 留白与悬念感：好的书名不需要把所有设定都塞进去。用精炼的字词勾勒出意境，让读者产生探索欲，而不是一眼看到底。
4. 结合文风与气质：
   - 如果是严肃/悬疑/正剧：书名要冷峻、克制、有哲理暗示。
   - 如果是治愈/言情/日常：书名可以轻快、生活化，或者带有独特的个人情绪（如《去有风的地方》、《我的天才女友》）。
   - 如果是奇幻/科幻/玄幻：提取最核心的世界观名词或奇观象徵（如《诡秘之主》、《三体》、《道诡异仙》）。
5. 字数精简有力：鼓励使用 4-10 个字以内的短名，越简练越要有记忆点和力量感。
6. 严禁烂俗网文词汇：绝对不要包含“修罗场”、“顶级大佬”、“满级”、“逆天”、“校花”、“霸总”、“娇妻”、“所有人以为”、“其实我”等浓浓的流水线廉价感词汇。

【输出要求】：
- 发挥极强的创造力和文学功底，生成5个立意新颖、风格迥异且极具高级感的候选书名。
- 每一个书名都必须精准贴合剧情大纲，坚决不做空洞的“标题党”。`;
  }

  protected buildUserPrompt(context: AgentContext, outline: string): string {
    return `基于《${context.novel.title || "未命名"}》的以下大纲，综合运用上述命名法则，生成5个不同风格又极具网感的候选书名：

【参考大纲】：
${outline}

请直接输出5个书名，每行一个（千万不要加序号或多余的解释文字）。`;
  }
}

// Concept Expand Agent - 灵感扩写 (用于作品创建前)
export class ConceptExpandAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "ConceptExpandAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是一位资深网文主编。你的任务是根据作者提供的初步构思，进行文学性的扩写和润色。

小说类型：${context.novel.genre?.join("、") || "未设定"}
风格标签：${context.novel.style?.join("、") || "未设定"}

要求：
1. 扩写内容要保持原意的核心，但增加细节和戏剧性
2. 文笔要符合网文流行风格
3. 增加一些悬念或钩子

${
  context.novel.writingStyleRules
    ? `
必须严格遵守的专属文风设定：
${context.novel.writingStyleRules}
`
    : ""
}`;
  }

  protected buildUserPrompt(
    _context: AgentContext,
    background: string,
  ): string {
    return `基于以下初步初步构想，扩写一段大约 300-500 字的小说简介/背景设定：

${background}

请直接输出扩写后的内容，不要包含任何其他说明文字。`;
  }
}

// Chapter Planning Agent - 章节编排
export class ChapterPlanningAgent extends BaseAgent {
  private targetChapters: number = 0;

  constructor(provider: BaseAIProvider) {
    super(provider, "ChapterPlanningAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    // Calculate required chapters: must strictly match this count
    this.targetChapters = Math.ceil(
      (context.novel.targetWords || 100000) /
        (context.novel.minChapterWords || 3000),
    );

    return `你是小说章节结构规划师。根据大纲将小说分卷分章。

目标字数：${context.novel.targetWords}字
每章最少字数：${context.novel.minChapterWords}字
【强制要求】总章节数：必须恰好为 ${this.targetChapters} 章（${context.novel.targetWords}字 ÷ ${context.novel.minChapterWords}字/章 = ${this.targetChapters}章）

要求：
1. 合理分卷，章节分布均匀
2. 每章有明确主题，概要详尽
3. 章节标题吸引人，有代入感
4. 节奏把控合理，早、中、后期各段节奏匹配
5. 【核心约束】所有分卷的章节合计总数必须等于 ${this.targetChapters} 章，不得减少，否则将导致总字数严重不达标
6. 若大纲内容不足以支撑该章节数，请主动对每个情节段进行细化拆分（例如："修炼突破"可拆为：困境铺垫→关键契机→突破前夕→成功蜕变等多章）`;
  }

  protected buildUserPrompt(context: AgentContext, input: any): string {
    const { outline, additionalRequirements } =
      typeof input === "string"
        ? { outline: input, additionalRequirements: "" }
        : input || { outline: "", additionalRequirements: "" };

    // Recalculate in case buildSystemPrompt wasn't called (defensive)
    const chapters =
      this.targetChapters ||
      Math.ceil(
        (context.novel.targetWords || 100000) /
          (context.novel.minChapterWords || 3000),
      );

    return `基于《${context.novel.title}》的以下大纲，生成章节结构：

${outline}

${additionalRequirements ? `额外要求：\n${additionalRequirements}\n` : ""}

⚠️ 【强制约束，不得违反】：所有卷的章节总数必须恰好等于 ${chapters} 章。请在输出前自行统计确认，若不足请继续细化拆分情节直至达标。

输出格式（JSON，严禁包含 markdown 代码块，严禁包含其他说明文字，直接返回有效的 JSON 字符串）：
{
  "volumes": [
    {
      "title": "卷名",
      "chapters": [
        {"title": "章节标题", "summary": "章节概要（50字以上）"}
      ]
    }
  ]
}`;
  }
}

// Chapter Outline Agent - 章节大纲
export class ChapterOutlineAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "ChapterOutlineAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const characterInfo = context.characters
      ?.map((c) => `- ${c.name}（${c.role}）：${c.personality?.join("、")}`)
      .join("\n");

    return `你是章节大纲撰写专家。为单个章节生成详细的剧情大纲。
 
 小说背景：${context.novel.background}
 人物信息：
 ${characterInfo}
 
 ${
   context.knowledgeBase && context.knowledgeBase.length > 0
     ? `
 额外知识库：
 ${context.knowledgeBase.join("\n\n")}
 `
     : ""
 }
 
 要求：
 1. 情节紧凑，有冲突
2. 符合人物性格
3. 遵守世界观规则
4. 为下一章留悬念`;
  }

  protected buildUserPrompt(context: AgentContext, chapterInfo: any): string {
    return `生成《${context.novel.title}》第${chapterInfo.order}章《${chapterInfo.title}》的详细大纲。

章节概要：${chapterInfo.summary}
${context.previousContent ? `\n前文回顾：\n${context.previousContent.slice(-this.provider.config.maxTokens!)}` : ""}

请输出详细的章节大纲（300-500字）。`;
  }
}

// Chapter Detail Agent - 章节细纲
export class ChapterDetailAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "ChapterDetailAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是章节细纲设计师。将章节大纲拆分为具体的场景和情节点。
 
 ${
   context.knowledgeBase && context.knowledgeBase.length > 0
     ? `
 额外知识库：
 ${context.knowledgeBase.join("\n\n")}
 `
     : ""
 }
 
 要求：
 1. 每个场景有明确的目标
2. 标注关键对话和动作
3. 情绪节奏起伏
4. 字数分配合理（目标${context.novel.minChapterWords}字）`;
  }

  protected buildUserPrompt(
    context: AgentContext,
    chapterOutline: string,
  ): string {
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
    super(provider, "ContentAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const characterInfo = context.characters
      ?.map(
        (c) =>
          `- ${c.name}：${c.personality?.join("、")}，当前状态：${c.currentState}`,
      )
      .join("\n");

    return `你是网络小说作家。根据细纲生成精彩的章节正文。
 
 小说风格：${context.novel.style?.join("、")}
 人物信息：
 ${characterInfo}
 
 ${
   context.knowledgeBase && context.knowledgeBase.length > 0
     ? `
 额外知识库：
 ${context.knowledgeBase.join("\n\n")}
 `
     : ""
 }

 ${
   context.novel.writingStyleRules
     ? `
必须严格遵守的专属文风设定（务必完美模仿）：
${context.novel.writingStyleRules}
 `
     : ""
 }
 
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

  protected buildUserPrompt(
    context: AgentContext,
    input: string | { outline: string; instructions?: string },
  ): string {
    const { outline, instructions } =
      typeof input === "string"
        ? { outline: input, instructions: "" }
        : input || { outline: "", instructions: "" };

    return `根据《${context.novel.title}》的以下章节细纲，生成章节正文：

${outline}

${instructions ? `额外写作要求（必须严格遵守）：\n${instructions}\n` : ""}

${context.previousContent ? `\n前文衔接：\n${context.previousContent.slice(-this.provider.config.maxTokens!)}` : ""}

请开始创作，直接输出正文内容。`;
  }
}

// Consistency Agent - 一致性校验
export class ConsistencyAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "ConsistencyAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是小说一致性审核专家。检查内容是否违反设定。

世界观规则：
${context.novel.worldSettings?.worldRules?.join("\n")}

禁忌规则：
${context.novel.worldSettings?.forbiddenRules?.join("\n")}

人物设定：
${context.characters?.map((c) => `${c.name}：${JSON.stringify(c.abilities)}`).join("\n")}

${
  context.knowledgeBase && context.knowledgeBase.length > 0
    ? `
知识库参考：
${context.knowledgeBase.join("\n\n")}
`
    : ""
}
 
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
    super(provider, "AssistAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是一位专业的网文写作助手。你的任务是辅助作者进行创作，回答他们的问题，或者根据上下文提供写作建议。

小说标题：${context.novel.title}
小说类型：${context.novel.genre?.join("、")}
风格标签：${context.novel.style?.join("、")}
背景设定：${context.novel.background}

${
  context.novel.worldSettings
    ? `
世界观设定：
- 时间背景：${context.novel.worldSettings.timeBackground}
- 世界规则：${context.novel.worldSettings.worldRules?.join("；")}
- 力量体系：${context.novel.worldSettings.powerSystem}
- 禁忌规则：${context.novel.worldSettings.forbiddenRules?.join("；")}
`
    : ""
}

${
  context.characters && context.characters.length > 0
    ? `
人物信息：
${context.characters.map((c) => `- ${c.name}（${c.role}）：${c.personality?.join("、")}`).join("\n")}
`
    : ""
}

${
  context.novel.writingStyleRules
    ? `
必须严格遵守的该小说专属文风设定（如果是续写/改写操作，请完美模仿）：
${context.novel.writingStyleRules}
`
    : ""
}

请根据以上设定和作者提供的小说正文片段（如果有），回答作者的问题。
回答要求：
1. 具有启发性，能激发作者灵感
2. 贴合小说设定和风格
3. 简洁明了，直接切入重点
4. 如果作者要求生成片段，请确保风格统一`;
  }

  protected buildUserPrompt(_context: AgentContext, input: any): string {
    const { message, previousContent } = input || {
      message: "",
      previousContent: "",
    };

    return `当前正文片段（上文）：
${previousContent ? previousContent.slice(-this.provider.config.maxTokens!) : "（无）"}

作者的问题/指令：
${message}`;
  }
}

// OOC Agent - 角色一致性检测
export class OocAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "OocAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是一位严谨的文学资深编辑，专长是人物设定连续性（OOC）审查。你的任务是审查小说片段，确认其中的角色（对话、心理、行为、能力表现）是否符合其既定人设。

已知角色设定：
${context.characters
  ?.map(
    (c) => `【${c.name}】(${c.role})
性格：${c.personality?.join("、")}
当前状态/描述：${c.currentState || "无"}
能力专长：${JSON.stringify(c.abilities)}`,
  )
  .join("\n\n")}

审查要求：
1. 提取输入片段中出现的所有已知角色。
2. 逐一比对他们的行为、台词语气和能力，看是否存在严重偏离（即 OOC，Out Of Character）。
3. 如果未出现已知角色，或所有出场角色均符合人设，则 passed 为 true。
4. 如果发现明显的 OOC，说明是哪个角色，以及为什么违和（原设定是什么，这里写成了什么）。`;
  }

  protected buildUserPrompt(_context: AgentContext, input: any): string {
    return `请审核以下正文片段的角色一致性：

${input}

输出格式（JSON，严禁包含 markdown 代码块，严禁包含其他说明文字，直接返回有效的 JSON 字符串）：
{
  "passed": true/false,
  "issues": ["角色A的违和点描述", "角色B的能力超限描述"]
}`;
  }
}

// Character Agent - 人物设定生成/提取
export class CharacterAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "CharacterAgent");
  }

  protected buildSystemPrompt(_context: AgentContext): string {
    return `你是一位资深文学分析师。你的任务是从小说片段中提取或设计详尽的人物人设卡。
    
要求：
1. **深度提取**：提取至少 10-15 位重要角色（如果采样中存在这么多）。
2. **优先级排序**：根据角色对全书剧情的影响力（重要程度）进行降序排列。
3. **能力细化**：必须深入分析角色的“能力/技能/功法/专长”并填充到 capabilities 字段。
4. **属性完整**：包含姓名、角色定位（主角/反派/重要配角）、性格标签、详尽描述、核心能力。
5. 输出格式为 JSON 数组。`;
  }

  protected buildUserPrompt(context: AgentContext, _input: any): string {
    const chunks = context.sourceChunks || [];
    return `请分析以下小说采样内容并提取/设计角色人设卡：

${chunks.map((c, i) => `--- 采样片段 ${i + 1} ---\n${c}`).join("\n\n")}

输出格式（JSON，严禁包含 markdown 代码块）：
[
  {
    "name": "角色姓名",
    "role": "角色定位（如：男主角、幕后黑手、青梅竹马等）",
    "personality": ["性格标签1", "性格标签2"],
    "description": "外貌特征、出身背景与核心动机的详尽描述",
    "capabilities": "【重点】能力体系、功法技能、过人之处或职业专长",
    "importance": 10
  }
]
（importance 为 1-10 的数字，10 为最高优先级）`;
  }
}

// Global Analysis Agent - 全局统筹分析
export class GlobalAnalysisAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "GlobalAnalysisAgent");
  }

  protected buildSystemPrompt(_context: AgentContext): string {
    return `你是一位严谨的文学分析专家和资深主编。你的任务是基于提供的小说原文片段，客观、准确地提取小说的核心设定和剧情脉络。

核心原则：
1. **基于事实**：所有分析必须严格依据提供的原文片段，严禁臆测、编造或添加原文中不存在的情节。
2. **通盘视角**：结合开头、中段和结尾的采样，还原故事的整体架构。
3. **结构清晰**：输出结构化数据，便于后续处理。

分析维度：
- **背景设定**：时代背景、地理环境、社会形态等。
- **力量体系**：修炼等级、异能系统、魔法规则等（需准确提取名词）。
- **核心冲突**：贯穿全文的主要矛盾。
- **剧情走向**：从开篇到结尾的关键转折和发展脉络。
- **结局形态**：根据结尾片段判断故事的最终落脚点。

请以 JSON 格式输出分析结果。`;
  }

  protected buildUserPrompt(context: AgentContext, _input: any): string {
    const chunks = context.sourceChunks || [];
    return `请仔细阅读以下小说采样片段（包含开头、中段、结尾），进行深度分析：

${chunks.map((c, i) => `--- 采样片段 ${i + 1} (${i === 0 ? "开头" : i === chunks.length - 1 ? "结尾" : "中段"}) ---\n${c}`).join("\n\n")}

请输出 JSON 数据（严禁包含 markdown 代码块）：
{
  "background": "核心背景设定与世界观描述（300-500字），重点描述时代、地点、核心规则。",
  "theme": "小说类型与主题风格（如：玄幻-凡人流、科幻-赛博朋克、都市-重生流等）。",
  "summary": "【全书剧情大纲】（800-1500字）。请详细梳理故事脉络：\n1. 开篇：主角身份、初始处境、核心金手指/转折点。\n2. 发展：主要经历的副本/事件、实力提升过程、遇到的关键人物。\n3. 高潮：主要矛盾的爆发点。\n4. 结局：最终的归宿或状态（依据结尾片段）。\n注意：必须基于原文内容，不要进行创意续写。"
}`;
  }
}

// Knowledge Extraction Agent - 知识提取
export class KnowledgeExtractionAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "KnowledgeExtractionAgent");
  }

  protected buildSystemPrompt(_context: AgentContext): string {
    return `你是一位小说资料整理专家。你的任务是从采样片段中提取世界观、势力、地理、物品、境界等核心知识点。
    
要求：
1. **准确性**：提取的信息必须真实源自采样内容，严禁胡编乱造。
2. **分类提取**：将信息分类为：世界观、势力组织、地理环境、力量体系、特殊物品、历史事件。
3. **内容深度**：每个知识点的描述要详实，涵盖其设定背景和在文中的作用。
4. 输出格式为 JSON 数组。`;
  }

  protected buildUserPrompt(context: AgentContext, _input: any): string {
    const chunks = context.sourceChunks || [];
    return `请从以下采样内容中提取核心设定知识点：

${chunks.map((c, i) => `--- 采样片段 ${i + 1} ---\n${c}`).join("\n\n")}

输出格式（JSON，严禁包含 markdown 代码块）：
[
  {
    "category": "类别（如：力量体系）",
    "title": "知识点名称（如：灵根、赛博义体等）",
    "content": "关于该设定的详尽描述"
  }
]`;
  }
}

// Style Extraction Agent - 文风提取
export class StyleExtractionAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "StyleExtractionAgent");
  }

  protected buildSystemPrompt(_context: AgentContext): string {
    return `你是一位资深的文学鉴赏家和自然语言处理专家。你的任务是深度剖析用户提供的小说文本采样，并提取出系统性的“文风设定规则”（Style Mimicry Rules）。

这些规则将被注入到后续的 AI 写作提示词（Prompt）中，用于指导 AI 完美模仿该用户的特定写作风格。

输出必须是一个包含各项文风建议的 JSON 对象。`;
  }

  protected buildUserPrompt(_context: AgentContext, input: string): string {
    return `请仔细分析以下小说文本片段，提炼出其独特的写作风格规则：

--- 文本采样开始 ---
${input}
--- 文本采样结束 ---

请从以下几个维度进行深度提炼，并输出 JSON 数据（严禁包含 markdown 代码块）：
{
  "sentence_length": "句子长短习惯（例如：喜欢用短句增加节奏感，还是喜欢长难句进行细腻叙述）",
  "vocabulary": "词汇偏好（例如：用词华丽复古，还是通俗接地气，或是带有特定的二次元/网文色彩）",
  "pacing": "行文节奏（例如：节奏极快直奔主题，还是慢热铺垫细节）",
  "tone": "叙述基调（例如：幽默诙谐、冷酷客观、深沉压抑、热血激昂）",
  "descriptive_focus": "描写侧重点（例如：偏爱心理描写、注重动作细节、喜欢景物渲染代替情绪等）",
  "dialogue_style": "对话风格（例如：对话精简多潜台词，还是话痨式吐槽，是否带特定的方言或口癖）",
  "summary_rule": "总结：请写一段 100-200 字的总括性『文风模仿指令』。这段指令会直接插入到 AI 的 Prompt 中作为核心指导原则（例如：‘请采用冷酷客观的第三人称视角，多用短句，动作描写要如老派武侠般干脆利落，减少不必要的心理独白，对话要简短且暗藏杀机...’）"
}`;
  }
}

// ================================================================
// Sandbox Agent - For plot sandbox "what-if" scenario generation
// ================================================================
export class SandboxAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "SandboxAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const characterInfo =
      context.characters
        ?.map(
          (c) =>
            `- ${c.name}（性格：${c.personality?.join("、")}，状态：${c.currentState}）`,
        )
        .join("\n") || "（暂无角色信息）";

    const stylePart = context.novel.writingStyleRules
      ? `\n文风要求（请模仿以下风格）：\n${context.novel.writingStyleRules}\n`
      : "";

    return `你是一位擅长写网文的剧情推演专家。根据作者提出的假设前提，推演精彩的分支剧情。

小说标题：${context.novel.title}
小说类型：${context.novel.genre?.join("、") || "未设定"}
背景设定：${context.novel.background || "未设定"}

主要角色信息：
${characterInfo}
${stylePart}
推演要求：
1. 剧情必须遵守本小说的世界观规则
2. 角色行为必须与其性格一致，避免 OOC（性格崩坏）
3. 推演结果要有戏剧性和可读性，设置合理的冲突与转折
4. 字数控制在 800-1500 字
5. 用纯叙事文本写作，不使用 Markdown 标题或分隔符`;
  }

  protected buildUserPrompt(
    _context: AgentContext,
    input: { premise: string; existingContent?: string },
  ): string {
    const existingPart = input.existingContent
      ? `已有的推演内容（可在此基础上续写或重写）：\n${input.existingContent}\n\n---\n请生成完整的推演结果：`
      : "请生成完整的推演结果：";
    return `请根据以下假设前提，推演出一段精彩的分支剧情：\n\n假设前提：${input.premise}\n\n${existingPart}`;
  }
}
