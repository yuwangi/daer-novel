'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, X, Sparkles } from 'lucide-react';
import { io as createSocket, Socket } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';

// Module-level singleton socket – survives React StrictMode double-mount
let _socket: Socket | null = null;
let _listenerCount = 0;

function getOrCreateSocket(): Socket {
  if (!_socket || _socket.disconnected) {
    _socket = createSocket(
      typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002')
        : 'http://localhost:8002',
      { transports: ['websocket', 'polling'] }
    );
  }
  return _socket;
}

interface LogEntry {
  id: string;
  interactionId?: string;
  timestamp: string;
  type: string;
  status: 'running' | 'chunk' | 'completed' | 'failed';
  message?: string;
  chunk?: string;
  provider?: string;
  model?: string;
}

interface AIInteraction {
  interactionId: string;
  prompt: string;
  response: string;
  status: 'running' | 'completed' | 'failed';
  provider?: string;
  model?: string;
  timestamp: string;
  error?: string;
}

export function GlobalAILogViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [interactions, setInteractions] = useState<{ [key: string]: AIInteraction }>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasActiveInteractions = Object.values(interactions).some(i => i.status === 'running');
  const totalCount = Object.keys(interactions).length;

  // Use singleton socket. Remove any stale listeners before registering to guard
  // against React StrictMode double-mount and Next.js HMR orphaned listeners.
  useEffect(() => {
    const socket = getOrCreateSocket();

      const handleLog = (data: LogEntry) => {
      console.log('[SOCKET RECV]', data.type, data.status, data.interactionId);
      setInteractions((prev) => {
        const iId = data.interactionId || 'unknown';

        // Always create a NEW copy of both the map AND the specific entry
        // so that React 18 StrictMode's double-invocation of the updater
        // doesn't mutate prev and cause each chunk to be appended twice.
        const existing: AIInteraction = prev[iId] ?? {
          interactionId: iId,
          prompt: '',
          response: '',
          status: 'running' as const,
          provider: data.provider,
          model: data.model,
          timestamp: data.timestamp,
        };

        let updated: AIInteraction;

        if (data.type === 'AI_PROMPT' || data.type === 'AI_PROMPT_STREAM') {
          updated = { ...existing, prompt: data.message || '' };
        } else if (data.type === 'AI_RESPONSE' && data.message) {
          updated = { ...existing, response: data.message, status: 'completed' };
        } else if (data.type === 'AI_STREAM_DONE') {
          updated = { ...existing, status: 'completed' };
        } else if (data.status === 'chunk' && data.chunk) {
          updated = { ...existing, response: existing.response + data.chunk };
        } else if (data.status === 'completed') {
          updated = { ...existing, status: 'completed' };
        } else if (data.status === 'failed') {
          updated = { ...existing, status: 'failed', error: data.message };
        } else {
          return prev; // nothing to change
        }

        return { ...prev, [iId]: updated };
      });
    };

    // Remove ALL previous global:task:log listeners before adding ours.
    // This prevents duplicates from StrictMode double-invocation and HMR.
    socket.removeAllListeners('global:task:log');
    socket.on('global:task:log', handleLog);

    return () => {
      // On true unmount disconnect and clear all listeners
      socket.removeAllListeners('global:task:log');
    };
  }, []);

  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [interactions, isOpen]);

  const interactionList = Object.values(interactions).sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 group"
        title="Daer AI 助手交互记录"
      >
        <div className="relative flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-1 active:translate-y-0 transition-all duration-200">
          <Bot className="h-6 w-6 text-white transition-transform group-hover:scale-110" />
          {hasActiveInteractions && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full animate-pulse shadow-sm" />
          )}
          {totalCount > 0 && !hasActiveInteractions && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full flex items-center justify-center border border-indigo-200">
              {totalCount}
            </span>
          )}
        </div>
      </button>

      {/* Side Drawer Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Side Drawer */}
      <div
        className={`fixed right-0 top-0 h-full z-50 flex flex-col w-[420px] max-w-[95vw] bg-white dark:bg-zinc-950 shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-600 to-violet-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Bot className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm leading-tight">Daer AI 助手</h2>
              <p className="text-indigo-200 text-xs">
                {hasActiveInteractions ? '正在思考中…' : `${totalCount} 条交互记录`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveInteractions && (
              <span className="flex items-center gap-1 bg-white/20 text-white text-xs px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />
                处理中
              </span>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-xl hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/70 dark:bg-zinc-900/50">
          {interactionList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-16">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-indigo-400" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">暂无交互记录</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-[220px] leading-relaxed">
                  在任意页面使用 AI 功能后，对话会实时显示在这里
                </p>
              </div>
            </div>
          ) : (
            interactionList.map((interaction, idx) => (
              <div key={interaction.interactionId} className="flex flex-col gap-3">
                {/* Interaction index label */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">
                    #{idx + 1} · {new Date(interaction.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
                </div>

                {/* User Prompt Bubble */}
                {interaction.prompt && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-gradient-to-br from-indigo-500 to-violet-600 text-white px-4 py-3 rounded-2xl rounded-tr-md shadow-sm text-sm leading-relaxed">
                      <p className="whitespace-pre-wrap">{interaction.prompt}</p>
                    </div>
                  </div>
                )}

                {/* AI Response Bubble */}
                {(interaction.response || interaction.status === 'running') && (
                  <div className="flex justify-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-indigo-500" />
                    </div>

                    <div className="max-w-[85%] flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Daer AI</span>
                        {interaction.provider && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                            {interaction.provider} · {interaction.model}
                          </span>
                        )}
                        {interaction.status === 'running' && (
                          <span className="text-[10px] text-emerald-500 font-medium animate-pulse">● 生成中</span>
                        )}
                      </div>

                      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-gray-200 px-4 py-3 rounded-2xl rounded-tl-md shadow-sm text-sm leading-relaxed">
                        {interaction.response ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2">
                            <ReactMarkdown>{interaction.response}</ReactMarkdown>
                          </div>
                        ) : (
                          <div className="flex gap-1 py-0.5">
                            <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" />
                          </div>
                        )}

                        {interaction.status === 'failed' && (
                          <div className="mt-2 text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/50 text-xs">
                            ⚠️ 错误：{interaction.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <p className="text-center text-[11px] text-gray-400 dark:text-gray-600">
            所有 AI 交互均在此实时显示 · 由 Daer AI 提供
          </p>
        </div>
      </div>
    </>
  );
}
