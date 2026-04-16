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
    const targetWords = context.novel.targetWords || 100000;
    const avgChapterWords = context.novel.minChapterWords || 3000;
    const estimatedChapters = Math.ceil(targetWords / avgChapterWords);
    const phasesCount = this._calculatePhaseCount(targetWords);

    return `你是一位世界级的网络小说结构大师和情节建筑师。你的任务是为《${context.novel.title}》创建一个**极度详细、事件驱动、可直接扩写成章节**的结构化大纲。

====【核心原则】====
1. **大纲必须细到可以直接扩写**：每个事件节点都应该包含足够的细节，让作者（或AI）可以直接据此写出章节正文，无需再构思"发生了什么"。
2. **事件链必须完整**：采用因果关系链设计，每个事件都有明确的"触发条件→核心动作→即时后果→长远影响"。
3. **拒绝模糊表述**：禁止使用"主角经历了一些冒险"、"剧情逐渐展开"这类空泛描述。每个节点都必须是具体的、可执行的事件。
4. **悬念钩子前置**：每一个阶段结束时必须设计强有力的钩子，让读者迫切想知道下一章发生了什么。
5. **角色弧线绑定事件**：角色的成长、变化、抉择必须与具体事件绑定，而不是孤立的"角色成长了"。

====【小说基础设定】====
小说标题：${context.novel.title}
小说类型：${context.novel.genre?.join("、")}
风格标签：${context.novel.style?.join("、")}
目标字数：${targetWords}字（约${estimatedChapters}章）
背景设定：${context.novel.background}

${
  context.novel.worldSettings
    ? `
【世界观设定】
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
【核心人物设定】
${context.characters.map((c) => `
[${c.role}] ${c.name}
  性格：${c.personality?.join("、")}
  能力：${JSON.stringify(c.abilities)}
  当前状态：${c.currentState || "未设定"}
  关系：${c.relationships ? c.relationships.map(r => `${r.characterId}: ${r.relation}`).join("，") : "暂无"}
`).join("\n")}
`
    : ""
}

${
  context.knowledgeBase && context.knowledgeBase.length > 0
    ? `
【额外知识库参考】
${context.knowledgeBase.join("\n\n---\n\n")}
`
    : ""
}

====【叙事结构要求】====
将故事划分为 **${phasesCount}个阶段**，遵循经典的五幕结构但根据字数灵活调整：

1. **开篇阶段（Exposition）**：约占总字数的15-20%
   - 建立世界、引入主角、展示日常
   - 必须设计"初始状态被打破"的触发事件
   - 每一个世界观元素都必须通过具体事件展示，而非纯说明

2. **上升阶段（Rising Action）**：约占总字数的40-50%
   - 这是故事的主体，必须包含**层层递进的事件链**
   - 每个小事件的失败/成功必须直接影响下一个事件的难度
   - 必须设计"中点反转"：故事进行到一半时，主角的认知或处境发生根本性改变

3. **高潮阶段（Climax）**：约占总字数的15-20%
   - 核心冲突的最终爆发
   - 必须是"不可逆转"的事件：主角做出无法回头的选择，或世界发生永久性改变
   - 高潮内部也要有节奏：小高潮→喘息→更大高潮→最终对决

4. **回落阶段（Falling Action）**：约占总字数的10-15%
   - 处理高潮的余波
   - 展示"世界变了"的具体表现
   - 收束次要情节线

5. **结局阶段（Resolution）**：约占总字数的5-10%
   - 主角的最终状态与开篇形成对比
   - 必须有"余韵"：不是简单的结束，而是让读者回味的场景
   - 如果有续作可能，设计开放式钩子但不影响本故事的完整性

====【单个事件的必填字段】====
每个具体事件必须包含以下要素，缺一不可：

1. **事件标题**：简洁但具体（如"主角在拍卖会遭遇暗杀"而非"主角遇到麻烦"）
2. **详细描述**：80-150字，具体到"谁说了什么、做了什么、结果如何"
3. **涉及角色**：列出所有出场角色，并简要说明他们在本事件中的角色
4. **冲突类型**：
   - internal（内心冲突：抉择、信念动摇、恐惧等）
   - external（外部冲突：战斗、追逐、谈判等）
   - relationship（关系冲突：信任破裂、合作瓦解、爱恨纠葛等）
   - mystery（悬疑冲突：解谜、调查、真相揭露等）
5. **转折点**：本事件中最关键的"意外"或"抉择"，是事件从量变到质变的点
6. **情感变化**：主角及主要角色在事件前后的情绪状态变化（具体，而非"主角很生气"）
7. **事件结果**：具体、可衡量的结果（如"主角获得了地图但失去了同伴"）
8. **字数估算**：这个事件大约需要多少字来描写
9. **下一事件线索**：本事件埋下的、将在未来事件中触发的伏笔（至少2条）
10. **悬念钩子（可选但推荐）**：如果本事件是章节或阶段结尾，设计让读者欲罢不能的最后一句话或场景

====【阶段级必填要素】====
每个阶段除了包含事件列表，还必须明确：

1. **阶段核心目标**：主角在这个阶段想要达成什么？（必须具体）
2. **主要冲突源**：是谁/什么在阻止主角达成目标？
3. **赌注（Stakes）**：如果主角失败了，会失去什么？（必须逐步升级）
4. **角色发展节点**：这个阶段中，哪个角色会发生什么显著变化？通过哪个具体事件体现？
5. **世界观推进**：这个阶段会揭露或展示哪些新的世界观元素？如何展示？
6. **主题呼应**：这个阶段如何呼应小说的核心主题？
7. **阶段间钩子**：这个阶段结束时，用什么事件或悬念让读者进入下一个阶段？

====【输出格式要求】====
【绝对重要】你必须以严格的 JSON 格式输出，不要包含任何额外的解释文字、问候语、Markdown代码块标记。直接输出纯净的 JSON 对象。

JSON 结构必须严格遵循以下 schema：

{
  "version": "1.0",
  "novelTitle": "小说标题",
  "corePremise": "一句话概括核心故事 premise（ elevator pitch 级别）",
  "centralTheme": "小说的核心主题（如："成长意味着接受不完美"、"权力的代价"）",
  "narrativeArc": "描述整体叙事弧线的类型和特点",
  "mainConflict": {
    "type": "冲突类型（如："人 vs 人"、"人 vs 自我"、"人 vs 社会"、"人 vs 自然"）",
    "description": "核心冲突的详细描述",
    "escalatingSteps": ["冲突升级的关键步骤1", "步骤2", "至少5个具体步骤"]
  },
  "phases": [
    {
      "id": "phase_1",
      "phaseName": "阶段名称（如："初入山门"、"暗流涌动"）",
      "phaseType": "exposition | rising_action | climax | falling_action | resolution",
      "startWordEstimate": 本阶段开始的字数位置（如0）,
      "endWordEstimate": 本阶段结束的字数位置（如30000）,
      "coreGoal": "主角在本阶段的核心目标（必须具体）",
      "mainConflict": "本阶段的主要冲突是什么",
      "stakes": "本阶段失败的后果",
      "events": [
        {
          "id": "event_1_1",
          "title": "事件具体标题",
          "description": "80-150字的详细描述，具体到谁说了什么做了什么",
          "characters": ["角色A", "角色B"],
          "conflictType": "internal | external | relationship | mystery",
          "turningPoint": "本事件的关键转折点/意外/抉择",
          "emotionalShift": "角色的情感变化描述",
          "outcome": "事件的具体结果",
          "wordEstimate": 3000,
          "nextEventHints": ["伏笔1", "伏笔2"],
          "suspenseHook": "如果是结尾事件，这里写悬念钩子",
          "worldBuildingDetails": "本事件展示了哪些世界观细节"
        }
      ],
      "characterDevelopments": [
        "通过事件X，角色A从胆小变得敢于承担责任",
        "通过事件Y，角色B对主角的态度从怀疑变为信任"
      ],
      "worldBuildingAdvancements": [
        "通过拍卖会场景展示了这个世界的货币体系和阶层差异",
        "通过战斗场景具体展示了力量体系的运作方式"
      ],
      "thematicElements": [
        "本阶段探讨了"勇气"的主题：主角在事件1中被迫面对恐惧",
        "本阶段呼应了"代价"主题：主角获得力量但失去了某样东西"
      ],
      "interPhaseHook": "连接到下一阶段的钩子事件或悬念"
    }
  ],
  "plotThreads": [
    {
      "id": "thread_main",
      "threadName": "主线情节线名称",
      "threadType": "main",
      "description": "这条线的整体描述",
      "phaseIds": ["phase_1", "phase_2", "phase_3"],
      "eventIds": ["event_1_1", "event_2_3"],
      "resolution": "这条线如何收尾",
      "thematicSignificance": "这条线对主题的意义"
    }
  ],
  "characterArcs": [
    {
      "characterName": "角色名",
      "arcType": "弧线类型（如："成长弧"、"堕落弧"、"平坦弧"）",
      "keyEvents": ["通过事件X发生变化", "通过事件Y进一步发展"],
      "resolution": "弧线的最终状态"
    }
  ],
  "worldBuildingReveals": [
    {
      "reveal": "揭示的内容",
      "phaseId": "phase_2",
      "eventId": "event_2_2",
      "significance": "这个揭示的重要性"
    }
  ],
  "pacingGuidelines": {
    "overall": "整体节奏建议",
    "phaseSpecific": [
      {
        "phaseId": "phase_1",
        "pacing": "slow | medium | fast",
        "recommendation": "具体建议"
      }
    ]
  },
  "cliffhangerPoints": [
    {
      "phaseId": "phase_1",
      "eventId": "event_1_5",
      "description": "悬念描述",
      "purpose": "这个悬念的目的"
    }
  ],
  "estimatedTotalWords": ${targetWords},
  "chapterCountEstimate": ${estimatedChapters},
  "phaseToChapterMapping": [
    {
      "phaseId": "phase_1",
      "startChapter": 1,
      "endChapter": 10
    }
  ]
}

====【质量检查清单】====
在输出之前，请确保：

1. [ ] 每个事件都有具体的"谁、在什么时间、在哪里、做了什么、为什么、结果如何"
2. [ ] 事件之间有明确的因果链，而不是孤立的场景
3. [ ] 冲突是逐步升级的，赌注越来越大
4. [ ] 每个角色的弧线都绑定到具体事件，而非抽象描述
5. [ ] 世界观是通过事件展示的，而非"信息 dumps"
6. [ ] 每3-5个事件就有一个明显的转折点或反转
7. [ ] 悬念钩子设计在每个阶段的结尾，以及关键章节的结尾
8. [ ] 没有模糊、空泛的描述（如"主角经历了很多"）
9. [ ] JSON 格式完全正确，没有语法错误
10. [ ] 字数分配与目标${targetWords}字大致匹配

现在，请开始生成这份极度详细、事件驱动的结构化大纲。`;
  }

  private _calculatePhaseCount(targetWords: number): number {
    if (targetWords <= 50000) return 4;
    if (targetWords <= 100000) return 5;
    if (targetWords <= 200000) return 6;
    if (targetWords <= 500000) return 7;
    return 8;
  }

  protected buildUserPrompt(context: AgentContext, input: any): string {
    const { mode, existingOutline } =
      typeof input === "string"
        ? { mode: input, existingOutline: "" }
        : input || { mode: "initial", existingOutline: "" };

    const baseInstruction = `【重要提醒】
1. 请直接输出纯净的 JSON，**绝对不要**包含任何 markdown 代码块标记（如 \`\`\`json），不要包含任何解释文字、问候语、思考过程。
2. 你的唯一输出就是那个 JSON 对象本身。
3. 确保每个事件都足够详细，可以直接用来扩写章节正文。
4. 确保事件之间有明确的因果关系链。

`;

    switch (mode) {
      case "expand":
        return `${baseInstruction}【任务】基于以下现有大纲进行深度扩写。

要求：
1. 将原有模糊的情节节点拆分为具体的事件序列
2. 为每个事件添加因果关系（触发条件、中间过程、后果）
3. 增加角色在每个事件中的具体行为和对话线索
4. 设计明确的悬念钩子

【现有大纲参考】：
${existingOutline}

请输出扩展后的完整结构化 JSON 大纲。`;

      case "adjust_pace_fast":
        return `${baseInstruction}【任务】重新设计以下大纲，使其节奏更加紧凑爽快。

调整方向：
1. 删除或合并拖沓的过渡场景
2. 让冲突更早、更猛烈地爆发
3. 减少纯说明性段落，将世界观融入事件
4. 增加每章结尾的悬念密度
5. 确保每3个事件内就有一个小高潮或反转

【原大纲参考】：
${existingOutline}

请输出节奏调整后的完整结构化 JSON 大纲。`;

      case "adjust_pace_slow":
        return `${baseInstruction}【任务】重新设计以下大纲，使其节奏更加舒缓细腻。

调整方向：
1. 增加场景的铺垫和氛围感描写
2. 深入挖掘角色的内心活动和情感变化
3. 为关键事件增加更多的酝酿过程
4. 增加次要角色的互动场景
5. 让世界观的揭示更加自然、渐进

【原大纲参考】：
${existingOutline}

请输出节奏调整后的完整结构化 JSON 大纲。`;

      case "strengthen_conflict":
        return `${baseInstruction}【任务】强化以下大纲的主线冲突，增加戏剧张力。

强化方向：
1. 让反派更加主动、更加聪明，而不是被动等待主角挑战
2. 增加主角的"失败"场景：让他们努力但仍然受挫
3. 提高赌注：失败的后果越来越严重
4. 设计"两难选择"：主角必须在两个都不想失去的选项中抉择
5. 增加"信任破裂"或"盟友背叛"的情节线

【原大纲参考】：
${existingOutline}

请输出冲突强化后的完整结构化 JSON 大纲。`;

      case "preserve_characters":
        return `${baseInstruction}【任务】重新生成大纲，但必须严格保留以下人物设定。

要求：
1. 所有角色的性格、能力、关系必须保持不变
2. 角色的行为必须严格符合其既定性格
3. 但情节走向、事件安排可以完全重新设计
4. 保持原有的角色弧线方向，但可以调整具体实现事件

【原有人物与大纲参考】：
${existingOutline}

请输出保留人设但重新设计情节的完整结构化 JSON 大纲。`;

      case "initial":
      default:
        let prompt = `${baseInstruction}【任务】为《${context.novel.title}》生成一份完整的、极度详细的、事件驱动的结构化小说大纲。

【核心要求】：
1. 每个事件节点必须具体到"谁、在什么情况下、做了什么、具体结果"
2. 事件之间必须有明确的因果链：事件A的结果直接触发事件B
3. 冲突必须层层升级：赌注越来越大，难度越来越高
4. 角色的成长/变化必须绑定到具体事件，而非抽象描述
5. 每3-5个事件设计一个反转或意外
6. 每个阶段结尾必须有强有力的悬念钩子`;

        if (existingOutline) {
          prompt += `\n\n【参考剧情脉络】（请在此基础上扩展和细化，而非完全照搬）：
${existingOutline}`;
        }

        prompt += `\n\n请输出完整的结构化 JSON 大纲。`;
        return prompt;
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

// Volume Planning Agent - 分卷规划
export class VolumePlanningAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "VolumePlanningAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是一位资深网文主编。你的任务是根据小说大纲进行【宏观分卷规划】。
    
小说标题：${context.novel.title}
目标总字数：${context.novel.targetWords}字
目标章节规模：每卷建议包含 150-250 章

要求：
1. **宏观拆分**：根据大纲脉络，将全书拆分为若干大卷（如：第一卷：初出茅庐；第二卷：名动一方...）。
2. **卷概要详尽**：每卷必须提供清晰的剧情走向概要，需涵盖该卷的核心矛盾、高潮及转场。
3. **结构合理**：确保各卷之间逻辑衔接紧密，符合长篇连载的节奏（起承转合）。

输出格式（JSON，严禁包含 markdown 代码块）：
{
  "volumes": [
    {
      "title": "卷名",
      "summary": "本卷核心剧情概要（200-500字）"
    }
  ]
}`;
  }

  protected buildUserPrompt(context: AgentContext, outline: string): string {
    return `基于《${context.novel.title}》的以下大纲，规划全书的分卷结构：

${outline}

【重要要求】：请直接返回有效的 JSON 字符串，严禁包含 markdown 代码块标识符（如 \` \` \` json），严禁包含任何前导或后置的说明文字。保证输出仅包含纯净的 JSON。`;
  }
}

// Chapter Planning Agent - 阶段性章节编排 (按卷生成)
export class ChapterPlanningAgent extends BaseAgent {
  constructor(provider: BaseAIProvider) {
    super(provider, "ChapterPlanningAgent");
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return `你是一位精密的小说章节规划师。你的任务是针对特定的【卷（Volume）】进行详细的章节拆分。
    
小说标题：${context.novel.title}
每章建议字数：${context.novel.minChapterWords}字

要求：
1. **微观拆分**：根据提供的【卷概要】，将其细化为具体的章节列表。
2. **章节连贯**：每章有明确的主题，概要需详尽（50字以上），确保情节推进自然。
3. **节奏把控**：在卷内保持良好的冲突密度，合理设置钩子。

输出格式（JSON，严禁包含 markdown 代码块）：
{
  "chapters": [
    {"title": "章节标题", "summary": "章节概要"}
  ]
}
`;
  }

  protected buildUserPrompt(
    context: AgentContext,
    input: {
      volumeTitle: string;
      volumeSummary: string;
      novelOutline: string;
      targetCount: number;
      existingChaptersContext?: string;
      additionalRequirements?: string;
    },
  ): string {
    return `当前正在为《${context.novel.title}》的以下卷进行章节规划：

【卷名】：${input.volumeTitle}
【卷概要】：${input.volumeSummary}

【全书大纲参考】：
${input.novelOutline}

${input.existingChaptersContext ? `【本卷已有章节（请跳过这些已有的剧情，继续往下发展）】：\n${input.existingChaptersContext}\n` : ""}

【目标生成章节数】：${input.targetCount} 章

${input.additionalRequirements ? `额外要求：\n${input.additionalRequirements}\n` : ""}

【重要要求】：
1. 请为本卷生成详细的章节列表，数量应接近 ${input.targetCount} 章。
${input.existingChaptersContext ? "2. 由于本卷已存在部分章节，请紧密承接上面提供的【本卷已有章节】的剧情线索，继续展开后续剧情！切勿从头开始。" : "2. 请从头开始为本卷规划情节。"}
3. 章节标题必须纯净，**绝对不要**包含任何“第X章”或“第一章”之类的序号前缀。直接输出纯标题内容（例如不要输出"第一章：青铜裂镜"，直接输出"青铜裂镜"）。
4. 请直接返回有效的 JSON 字符串，严禁包含 markdown 代码块标识符，严禁包含任何前导或后置的说明文字。保证输出仅包含纯净的 JSON。`;
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

【重要要求】：请直接返回有效的 JSON 字符串，严禁包含 markdown 代码块标识符（如 \` \` \` json），严禁包含任何前导或后置的说明文字。保证输出仅包含纯净的 JSON：
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

【重要要求】：请直接返回有效的 JSON 字符串，严禁包含 markdown 代码块标识符（如 \` \` \` json），严禁包含任何前导或后置的说明文字。保证输出仅包含纯净的 JSON：
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

【重要要求】：请直接返回有效的 JSON 字符串，严禁包含 markdown 代码块标识符（如 \` \` \` json），严禁包含任何前导或后置的说明文字。应包含 1-10 的 importance 权重。保证输出仅包含纯净的 JSON 数组：
[
  {
    "name": "角色姓名",
    "role": "角色定位（如：男主角、幕后黑手、青梅竹马等）",
    "personality": ["性格标签1", "性格标签2"],
    "description": "外貌特征、出身背景与核心动机的详尽描述",
    "capabilities": "【重点】能力体系、功法技能、过人之处或职业专长",
    "importance": 10
  }
]`;
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

【重要要求】：请直接返回有效的 JSON 字符串，严禁包含 markdown 代码块标识符（如 \` \` \` json），严禁包含任何前导或后置的说明文字。保证输出仅包含纯净的 JSON：
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

【重要要求】：请直接返回有效的 JSON 字符串，严禁包含 markdown 代码块标识符（如 \` \` \` json），严禁包含任何前导或后置的说明文字。保证输出仅包含纯净的 JSON 数组：
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

【重要要求】：请从以下几个维度进行深度提炼，并请直接返回有效的 JSON 字符串，严禁包含 markdown 代码块标识符（如 \` \` \` json），严禁包含任何前导或后置的说明文字。保证输出仅包含纯净的 JSON：
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
