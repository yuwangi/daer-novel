import { useState } from 'react';
import { History, Lock, Unlock, RotateCcw, ChevronRight, ChevronDown, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface OutlineVersion {
  id: string;
  version: number;
  content: string;
  generationMode: string;
  createdAt: string;
  isLocked: number;
}

interface OutlineVersionManagerProps {
  versions: OutlineVersion[];
  currentVersion: OutlineVersion | null;
  onSelectVersion: (version: OutlineVersion) => void;
  onRollback: (version: OutlineVersion) => void;
  onLock: (version: OutlineVersion) => void;
}

export default function OutlineVersionManager({
  versions,
  currentVersion,
  onSelectVersion,
  onRollback,
  onLock,
}: OutlineVersionManagerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!versions.length) return null;

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden glass">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-primary-500" />
          <span className="font-semibold text-gray-900 dark:text-white">
            大纲版本历史 
            <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              {versions.length}
            </span>
          </span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </div>

      {isOpen && (
        <div className="border-t border-gray-100 dark:border-gray-800 max-h-[300px] overflow-y-auto">
          {versions.map((version) => (
            <div 
              key={version.id}
              className={cn(
                "p-4 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors",
                currentVersion?.id === version.id && "bg-primary-50/30 dark:bg-primary-900/10"
              )}
            >
              <div className="flex items-start justify-between">
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => onSelectVersion(version)}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={cn(
                      "px-2 py-0.5 text-xs font-bold rounded-md",
                      currentVersion?.id === version.id 
                        ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    )}>
                      v{version.version}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {version.generationMode === 'initial' ? '初始生成' :
                       version.generationMode === 'expand' ? 'AI 扩写' :
                       version.generationMode === 'adjust_pace_fast' ? '节奏调整(快)' :
                       version.generationMode === 'adjust_pace_slow' ? '节奏调整(慢)' :
                       version.generationMode === 'strengthen_conflict' ? '强化冲突' :
                       version.generationMode === 'preserve_characters' ? '保留人设' :
                       version.generationMode === 'manual' ? '手动修改' :
                       version.generationMode === 'rollback' ? '版本回滚' : '未知操作'}
                    </span>
                    {version.isLocked === 1 && <Lock className="w-3 h-3 text-amber-500" />}
                  </div>
                  <p className="text-xs text-gray-500">
                    {format(new Date(version.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </p>
                </div>

                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={(e) => { e.stopPropagation(); onLock(version); }}
                    title={version.isLocked ? "解锁" : "锁定"}
                  >
                    {version.isLocked ? 
                      <Lock className="w-4 h-4 text-amber-500" /> : 
                      <Unlock className="w-4 h-4 text-gray-400" />
                    }
                  </Button>
                  
                  {currentVersion?.id !== version.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
                      onClick={(e) => { e.stopPropagation(); onRollback(version); }}
                      title="回滚到此版本"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  )}
                  
                  {currentVersion?.id === version.id && (
                    <CheckCircle className="w-5 h-5 text-primary-500 mx-1.5" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
