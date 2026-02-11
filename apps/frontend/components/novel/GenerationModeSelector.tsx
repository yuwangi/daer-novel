import { useState, useRef, useEffect } from 'react';
import { Sparkles, ChevronDown, Zap, Clock, TrendingUp, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GenerationModeSelectorProps {
  onGenerate: (mode: string) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

const MODES = [
  { id: 'initial', label: '基于当前设定重新生成', icon: RefreshCw, desc: '完全重新生成' },
  { id: 'expand', label: '在现有大纲基础上扩写', icon: TrendingUp, desc: '增加细节' },
  { id: 'adjust_pace_fast', label: '调整节奏：更爽/更快', icon: Zap, desc: '加快冲突' },
  { id: 'adjust_pace_slow', label: '调整节奏：更慢/细腻', icon: Clock, desc: '增加铺垫' },
  { id: 'strengthen_conflict', label: '强化主线冲突', icon: TrendingUp, desc: '增加张力' },
  { id: 'preserve_characters', label: '保留人物设定重新生成', icon: Users, desc: '人设不变' },
];

export default function GenerationModeSelector({ onGenerate, isGenerating, disabled }: GenerationModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <div className="flex rounded-md shadow-sm">
        <Button
          type="button"
          onClick={() => onGenerate('initial')}
          disabled={disabled || isGenerating}
          className="rounded-l-md rounded-r-none border-r-0 focus:z-10"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {isGenerating ? '生成中...' : 'AI 生成大纲'}
        </Button>
        <Button
          type="button"
          disabled={disabled || isGenerating}
          className="rounded-l-none rounded-r-md px-2 focus:z-10 bg-primary-600 border-l border-primary-700 hover:bg-primary-700"
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronDown className="h-4 w-4 text-white" />
        </Button>
      </div>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-72 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none animate-fadeIn border border-gray-100 dark:border-gray-700">
          <div className="py-1">
            {MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    onGenerate(mode.id);
                    setIsOpen(false);
                  }}
                  className="group flex w-full items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                    <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{mode.label}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{mode.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
