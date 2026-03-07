import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { logger } from "../../utils/logger";
import { getIO } from "../../socket-singleton";

export interface AIProviderConfig {
  provider: "openai" | "anthropic" | "deepseek";
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  tokensUsed?: number;
  model: string;
}

export abstract class BaseAIProvider {
  public config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  // --- Abstract methods to be implemented by providers ---
  abstract _chat(messages: AIMessage[]): Promise<AIResponse>;
  abstract _streamChat(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
  ): Promise<AIResponse>;

  // --- Wrapper methods that broadcast logs to connected clients ---
  private broadcastLog(
    interactionId: string,
    status: string,
    message: string,
    type: string = "system",
  ) {
    const io = getIO();
    console.log(
      `[BROADCAST] type=${type} status=${status} interactionId=${interactionId} msgLen=${message.length}`,
    );
    if (io) {
      io.emit("global:task:log", {
        id: Math.random().toString(36).substring(7),
        interactionId,
        timestamp: new Date().toISOString(),
        status,
        message,
        type,
        provider: this.config.provider,
        model: this.config.model,
      });
    } else {
      logger.debug(`[AI ${status}] ${message.substring(0, 100)}...`);
    }
  }

  async chat(messages: AIMessage[]): Promise<AIResponse> {
    const interactionId = Math.random().toString(36).substring(2, 11); // Generate unqiue 9-char ID

    // We only want to display the last user message as the "Prompt" for cleaner chat display,
    // but the system ones can be logged too if we want. For a chat interface, let's grab the last user message.
    const lastUserMsg =
      messages
        .slice()
        .reverse()
        .find((m) => m.role === "user") || messages[messages.length - 1];
    const promptPreview = lastUserMsg.content;

    this.broadcastLog(interactionId, "running", promptPreview, "AI_PROMPT");

    try {
      const response = await this._chat(messages);
      this.broadcastLog(
        interactionId,
        "completed",
        response.content,
        "AI_RESPONSE",
      );
      return response;
    } catch (error: any) {
      this.broadcastLog(
        interactionId,
        "failed",
        `Error: ${error.message}`,
        "AI_ERROR",
      );
      throw error;
    }
  }

  async streamChat(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
  ): Promise<AIResponse> {
    const interactionId = Math.random().toString(36).substring(2, 11);

    const lastUserMsg =
      messages
        .slice()
        .reverse()
        .find((m) => m.role === "user") || messages[messages.length - 1];
    const promptPreview = lastUserMsg.content;
    this.broadcastLog(
      interactionId,
      "running",
      promptPreview,
      "AI_PROMPT_STREAM",
    );

    try {
      const response = await this._streamChat(messages, (chunk: string) => {
        const io = getIO();
        if (io) {
          io.emit("global:task:log", {
            id: Math.random().toString(36).substring(7),
            interactionId,
            timestamp: new Date().toISOString(),
            status: "chunk",
            chunk,
            type: "AI_RESPONSE_CHUNK",
            provider: this.config.provider,
            model: this.config.model,
          });
        }
        onChunk(chunk);
      });

      this.broadcastLog(
        interactionId,
        "completed",
        response.content,
        "AI_STREAM_DONE",
      );
      return response;
    } catch (error: any) {
      this.broadcastLog(
        interactionId,
        "failed",
        `Stream Error: ${error.message}`,
        "AI_ERROR",
      );
      throw error;
    }
  }
}

export class OpenAIProvider extends BaseAIProvider {
  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: 300000, // 5 minutes
    });
  }

  async _chat(messages: AIMessage[]): Promise<AIResponse> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages as any,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens!,
      top_p: this.config.topP ?? 1,
    });

    return {
      content: response.choices[0].message.content || "",
      tokensUsed: response.usage?.total_tokens,
      model: this.config.model,
    };
  }

  async _streamChat(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
  ): Promise<AIResponse> {
    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages as any,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens!,
      stream: true,
    });

    let fullContent = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullContent += content;
        onChunk(content);
      }
    }

    return {
      content: fullContent,
      model: this.config.model,
    };
  }
}

export class AnthropicProvider extends BaseAIProvider {
  private client: Anthropic;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  async _chat(messages: AIMessage[]): Promise<AIResponse> {
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens!,
      temperature: this.config.temperature ?? 0.7,
      system: systemMessage?.content,
      messages: userMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    return {
      content:
        response.content[0].type === "text" ? response.content[0].text : "",
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      model: this.config.model,
    };
  }

  async _streamChat(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
  ): Promise<AIResponse> {
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const stream = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens!,
      stream: true,
      system: systemMessage?.content,
      messages: userMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    let fullContent = "";
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        const content = chunk.delta.text;
        fullContent += content;
        onChunk(content);
      }
    }

    return {
      content: fullContent,
      model: this.config.model,
    };
  }
}

export class DeepSeekProvider extends BaseAIProvider {
  async _chat(messages: AIMessage[]): Promise<AIResponse> {
    const response = await axios.post(
      `${this.config.baseUrl || "https://api.deepseek.com/v1"}/chat/completions`,
      {
        model: this.config.model,
        messages,
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens!,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 300000, // 5 minutes
      },
    );

    return {
      content: response.data.choices[0].message.content,
      tokensUsed: response.data.usage?.total_tokens,
      model: this.config.model,
    };
  }

  async _streamChat(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
  ): Promise<AIResponse> {
    // DeepSeek streaming implementation (similar to OpenAI)
    const response = await axios.post(
      `${this.config.baseUrl || "https://api.deepseek.com/v1"}/chat/completions`,
      {
        model: this.config.model,
        messages,
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens!,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        responseType: "stream",
        timeout: 300000, // 5 minutes
      },
    );

    let fullContent = "";
    return new Promise((resolve, reject) => {
      response.data.on("data", (chunk: Buffer) => {
        const lines = chunk
          .toString()
          .split("\n")
          .filter((line) => line.trim());
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || "";
              if (content) {
                fullContent += content;
                onChunk(content);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      });

      response.data.on("end", () => {
        resolve({
          content: fullContent,
          model: this.config.model,
        });
      });

      response.data.on("error", reject);
    });
  }
}

export class AIProviderFactory {
  static create(config: AIProviderConfig): BaseAIProvider {
    switch (config.provider) {
      case "openai":
        return new OpenAIProvider(config);
      case "anthropic":
        return new AnthropicProvider(config);
      case "deepseek":
        return new DeepSeekProvider(config);
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }
}
