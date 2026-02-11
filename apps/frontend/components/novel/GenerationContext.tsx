import { useState } from 'react';
import { Info, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface GenerationContextProps {
  context: {
    title?: string;
    genre?: string[];
    targetWords?: number;
    worldSettings?: boolean;
    knowledgeBases?: string[];
    mode?: string;
  };
}

export default function GenerationContext({ context }: GenerationContextProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!context) return null;

  return (
    <div className="mb-6 rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10">
      <div 
        className="flex items-center justify-between p-3 px-4 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
          <Info className="w-4 h-4" />
          <span className="text-sm font-semibold">本次生成依据</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-blue-500" />}
      </div>

      {isOpen && (
        <div className="px-4 pb-4 pt-0 text-sm space-y-2">
           <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-300">
             {context.title && (
               <div className="flex items-center space-x-2">
                 <Check className="w-3 h-3 text-green-500" />
                 <span>小说标题：{context.title}</span>
               </div>
             )}
             {context.genre && (
               <div className="flex items-center space-x-2">
                 <Check className="w-3 h-3 text-green-500" />
                 <span>类型：{context.genre.join('/')}</span>
               </div>
             )}
             {context.targetWords && (
               <div className="flex items-center space-x-2">
                 <Check className="w-3 h-3 text-green-500" />
                 <span>目标字数：{context.targetWords / 10000}万字</span>
               </div>
             )}
             {context.worldSettings && (
               <div className="flex items-center space-x-2">
                 <Check className="w-3 h-3 text-green-500" />
                 <span>世界观设定：已启用</span>
               </div>
             )}
             {context.knowledgeBases && context.knowledgeBases.length > 0 && (
               <div className="flex items-center space-x-2">
                 <Check className="w-3 h-3 text-green-500" />
                 <span>知识库：{context.knowledgeBases.length}个</span>
               </div>
             )}
           </div>
        </div>
      )}
    </div>
  );
}
